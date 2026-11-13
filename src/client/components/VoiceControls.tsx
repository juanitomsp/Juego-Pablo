import { useEffect, useState } from 'react';
import type { RoomInfo } from '../../shared/protocol';
import { VoiceCall } from '../services/voice';
import { Icon } from './Icon';
import { t, tServer } from '../i18n';

/** Se re-renderiza cuando cambia algo de la llamada. */
export function useVoice(call: VoiceCall) {
  const [, setN] = useState(0);
  useEffect(() => call.subscribe(() => setN((n) => n + 1)), [call]);
  return call;
}

/**
 * Botones de la llamada de voz: entrar, silenciar el micro y colgar. Indica quién está en la llamada.
 * Solo para quien está sentado (los que miran no entran, igual que en el chat).
 */
export function VoiceControls({ call, room, compact = false }: { call: VoiceCall; room: RoomInfo; compact?: boolean }) {
  useVoice(call);
  const [showErr, setShowErr] = useState(false);
  useEffect(() => {
    if (!call.error) return;
    setShowErr(true);
    const tm = setTimeout(() => setShowErr(false), 6000);
    return () => clearTimeout(tm);
  }, [call.error, call.errorAt]);

  if (room.yourSeat === null) return null;
  const nameOf = (seat: number) => room.seats[seat]?.name ?? t('Jugador');
  const others = room.voice.filter((p) => p.seat !== room.yourSeat);
  const who = room.voice.map((p) => `${nameOf(p.seat)}${p.muted ? ' 🔇' : ''}`).join(', ');
  const error = showErr && call.error ? <span className="voice-error">{tServer(call.error)}</span> : null;

  if (call.status !== 'on')
    return (
      <span className="voice-controls">
        <button
          className="voice-join"
          disabled={call.status === 'connecting'}
          title={room.voice.length ? t('En la llamada: {who}', { who }) : t('Habla con la mesa como en una llamada')}
          onClick={() => void call.join()}
        >
          <Icon name="mic" size={18} />
          <span className="tb-label">
            {' '}
            {call.status === 'connecting' ? t('Conectando…') : room.voice.length ? t('Unirse a la voz ({n})', { n: room.voice.length }) : t('Voz')}
          </span>
        </button>
        {error}
      </span>
    );

  return (
    <span className="voice-controls on">
      <button
        className={call.muted ? '' : 'on'}
        aria-label={call.muted ? t('Activar el micrófono') : t('Silenciar el micrófono')}
        title={call.muted ? t('Micrófono silenciado') : t('Micrófono activado')}
        onClick={() => call.setMuted(!call.muted)}
      >
        <Icon name={call.muted ? 'micOff' : 'mic'} size={18} />
        {!compact && <span className="tb-label"> {call.muted ? t('Silenciado') : t('Hablando')}</span>}
      </button>
      <span className="voice-who" title={t('En la llamada: {who}', { who })}>
        {others.length === 0
          ? t('Solo tú')
          : others.map((p) => (
              <span key={p.id} className={`voice-peer ${call.connected(p.id) ? 'ok' : 'wait'}`}>
                {nameOf(p.seat)}
                {p.muted && ' 🔇'}
              </span>
            ))}
      </span>
      <button className="voice-hangup" aria-label={t('Colgar')} title={t('Salir de la llamada')} onClick={() => call.leave()}>
        <Icon name="hangup" size={18} />
      </button>
      {error}
    </span>
  );
}
