/**
 * Llamada de voz de la sala, como una llamada de grupo.
 *
 * El audio va directo de un jugador a otro (WebRTC, cifrado de extremo a extremo por el propio navegador):
 * el servidor solo pasa las ofertas y respuestas para que se encuentren, y nunca recibe audio.
 * Cada par de participantes tiene su conexión; con 4–6 jugadores es poco ancho de banda (voz Opus).
 *
 * Para no saturar el servidor, cada oferta/respuesta se envía de una vez con todos sus candidatos dentro
 * (sin ir mandándolos uno a uno).
 */
import type { Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient, VoicePeer, VoiceSdp } from '../../shared/protocol';

type PabloSocket = Socket<ServerToClient, ClientToServer>;
export type VoiceStatus = 'off' | 'connecting' | 'on';

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  /** Somos quien manda la oferta (el de identificador menor). */
  offerer: boolean;
}

/** Espera a tener todos los candidatos (o como mucho unos segundos) y devuelve la descripción completa. */
function gathered(pc: RTCPeerConnection, ms = 3000): Promise<VoiceSdp | null> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      const d = pc.localDescription;
      resolve(d && (d.type === 'offer' || d.type === 'answer') ? { type: d.type, sdp: d.sdp } : null);
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', check);
    check();
  });
}

export class VoiceCall {
  status: VoiceStatus = 'off';
  muted = false;
  /** Último aviso (y cuándo, para volver a mostrarlo aunque se repita el mismo). */
  error: string | null = null;
  errorAt = 0;
  private stream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];
  private peers = new Map<string, Peer>();
  private list: VoicePeer[] = [];
  private rejoining = false;
  /** Ya nos ha visto el servidor en la lista (hasta entonces, la lista que llega puede ser de antes de entrar). */
  private listed = false;
  private subs = new Set<() => void>();

  constructor(private socket: PabloSocket) {
    socket.on('voice:signal', this.onSignal);
    socket.on('connect', this.onReconnect);
  }

  subscribe(cb: () => void) {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
  private notify() {
    this.subs.forEach((s) => s());
  }
  private fail(error: string | null) {
    this.error = error;
    this.errorAt = error ? Date.now() : this.errorAt;
    if (error) console.warn('Voz:', error);
  }

  /** ¿Está conectado el audio con este participante? */
  connected(id: string) {
    const s = this.peers.get(id)?.pc.connectionState;
    return s === 'connected';
  }

  static supported() {
    return typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async join() {
    if (this.status !== 'off') return;
    this.fail(null);
    if (!VoiceCall.supported()) {
      this.fail('Este navegador no permite llamadas de voz.');
      return this.notify();
    }
    this.status = 'connecting';
    this.notify();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch {
      this.status = 'off';
      this.fail('No se ha podido usar el micrófono. Dale permiso en el navegador o en los ajustes del móvil.');
      return this.notify();
    }
    this.applyMute();
    const err = await this.emitJoin();
    if (err) {
      this.stopLocal();
      this.status = 'off';
      this.fail(err);
      return this.notify();
    }
    this.status = 'on';
    this.listed = false;
    if (this.muted) this.socket.emit('voice:mute', { muted: true });
    this.notify();
    this.sync(this.list);
  }

  private emitJoin(): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('No responde el servidor.'), 8000);
      this.socket.emit('voice:join', (r) => {
        clearTimeout(timer);
        if (!r.ok) return resolve(r.error);
        this.iceServers = r.iceServers;
        resolve(null);
      });
    });
  }

  /** Al volver la conexión con el servidor, se vuelve a entrar en la llamada (las conexiones de audio se rehacen). */
  private onReconnect = async () => {
    if (this.status !== 'on') return;
    this.rejoining = true;
    this.listed = false;
    this.closePeers();
    const err = await this.emitJoin();
    this.rejoining = false;
    if (err) return this.leave(err);
    if (this.muted) this.socket.emit('voice:mute', { muted: true });
    this.sync(this.list);
  };

  leave(error: string | null = null) {
    if (this.status !== 'off' && this.socket.connected) this.socket.emit('voice:leave');
    this.closePeers();
    this.stopLocal();
    this.status = 'off';
    this.fail(error);
    this.notify();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMute();
    if (this.status === 'on') this.socket.emit('voice:mute', { muted });
    this.notify();
  }

  private applyMute() {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
  }

  /** Lista de participantes que manda el servidor con el estado de la sala. */
  sync(list: VoicePeer[]) {
    this.list = list;
    if (this.status !== 'on' || this.rejoining) return;
    const me = this.socket.id;
    if (!me) return;
    if (!list.some((p) => p.id === me)) {
      if (this.listed) this.leave(); // ya no estás sentado
      return;
    }
    this.listed = true;
    const ids = new Set(list.map((p) => p.id));
    for (const [id] of this.peers) if (!ids.has(id)) this.closePeer(id);
    for (const p of list) {
      if (p.id === me || this.peers.has(p.id)) continue;
      const peer = this.create(p.id, me < p.id);
      if (peer.offerer) void this.offer(p.id, peer);
    }
    this.notify();
  }

  private create(id: string, offerer: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    for (const track of this.stream?.getAudioTracks() ?? []) pc.addTrack(track, this.stream!);
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      void audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      this.notify();
      if (pc.connectionState === 'failed') {
        // Se reintenta una vez pasado un rato (la red puede haber cambiado).
        this.closePeer(id);
        setTimeout(() => this.sync(this.list), 3000);
      }
    };
    const peer = { pc, audio, offerer };
    this.peers.set(id, peer);
    return peer;
  }

  private async offer(id: string, peer: Peer) {
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      const sdp = await gathered(peer.pc);
      if (sdp && this.peers.get(id) === peer) this.socket.emit('voice:signal', { to: id, sdp });
    } catch (e) {
      console.warn('Voz: no se pudo crear la oferta', e);
    }
  }

  private onSignal = async ({ from, sdp }: { from: string; sdp: VoiceSdp }) => {
    if (this.status !== 'on') return;
    try {
      if (sdp.type === 'offer') {
        if (!this.list.some((p) => p.id === from)) return;
        // Una oferta nueva sustituye a la conexión anterior con ese participante.
        if (this.peers.has(from)) this.closePeer(from);
        const peer = this.create(from, false);
        await peer.pc.setRemoteDescription(sdp);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        const answer = await gathered(peer.pc);
        if (answer && this.peers.get(from) === peer) this.socket.emit('voice:signal', { to: from, sdp: answer });
      } else {
        const peer = this.peers.get(from);
        if (peer?.offerer && peer.pc.signalingState === 'have-local-offer') await peer.pc.setRemoteDescription(sdp);
      }
    } catch (e) {
      console.warn('Voz: señal no válida', e);
    }
    this.notify();
  };

  private closePeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    p.audio.srcObject = null;
    p.audio.remove();
  }

  private closePeers() {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }

  private stopLocal() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  dispose() {
    this.leave();
    this.socket.off('voice:signal', this.onSignal);
    this.socket.off('connect', this.onReconnect);
    this.subs.clear();
  }
}
