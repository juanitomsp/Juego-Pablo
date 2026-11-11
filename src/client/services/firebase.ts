/**
 * Cuentas opcionales con Google (Firebase Authentication) y estadísticas en Firestore.
 *
 * Está DESACTIVADO hasta que se configuren las variables VITE_FIREBASE_* (ver docs/CUENTAS_Y_DATOS.md).
 * Sin ellas el juego funciona igual: las estadísticas se guardan solo en el navegador.
 *
 * Minimización de datos: en Firestore solo se guarda el resumen numérico de cada partida bajo
 * users/{uid}/matches. No se guardan email, foto ni nombres de otros jugadores.
 */
import { Capacitor } from '@capacitor/core';
import type { MatchSummary } from './stats';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseEnabled = !!(config.apiKey && config.projectId && config.authDomain);

export interface AccountUser {
  uid: string;
  displayName: string | null;
}

type Libs = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  a: typeof import('firebase/auth');
  f: typeof import('firebase/firestore');
};

let libs: Promise<Libs> | null = null;
function load(): Promise<Libs> {
  if (!firebaseEnabled) return Promise.reject(new Error('Firebase no está configurado.'));
  libs ??= (async () => {
    const [{ initializeApp }, a, f] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(config);
    // En las apps nativas, getAuth() intenta cargar un iframe que el WebView de iPhone bloquea:
    // se inicializa solo con almacenamiento local (el inicio de sesión lo hace el plugin nativo).
    const auth = Capacitor.isNativePlatform()
      ? a.initializeAuth(app, { persistence: a.indexedDBLocalPersistence })
      : a.getAuth(app);
    auth.languageCode = 'es';
    return { auth, db: f.getFirestore(app), a, f };
  })();
  return libs;
}

export function onUserChanged(cb: (u: AccountUser | null) => void): () => void {
  if (!firebaseEnabled) {
    cb(null);
    return () => {};
  }
  let unsub = () => {};
  let cancelled = false;
  load().then(({ auth, a }) => {
    if (cancelled) return;
    unsub = a.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, displayName: u.displayName } : null));
  });
  return () => {
    cancelled = true;
    unsub();
  };
}

export type AuthProviderId = 'google' | 'apple';

/** Proveedores disponibles: Google siempre; Apple en iPhone (Apple lo exige si se ofrece Google). */
export function availableProviders(): AuthProviderId[] {
  return Capacitor.getPlatform() === 'ios' ? ['apple', 'google'] : ['google'];
}

/** Obtiene una credencial de Firebase: en el móvil con la ventana nativa; en la web, con una ventana emergente. */
async function credentialFor(provider: AuthProviderId, { a }: Libs) {
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    if (provider === 'apple') {
      const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
      if (!r.credential?.idToken) throw new Error('No se pudo iniciar sesión con Apple.');
      return new a.OAuthProvider('apple.com').credential({ idToken: r.credential.idToken, rawNonce: r.credential.nonce });
    }
    const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    if (!r.credential?.idToken) throw new Error('No se pudo iniciar sesión con Google.');
    return a.GoogleAuthProvider.credential(r.credential.idToken);
  }
  return null;
}

export async function signIn(provider: AuthProviderId): Promise<void> {
  const libs = await load();
  const { auth, a } = libs;
  const credential = await credentialFor(provider, libs);
  if (credential) {
    await a.signInWithCredential(auth, credential);
    return;
  }
  const webProvider = provider === 'apple' ? new a.OAuthProvider('apple.com') : new a.GoogleAuthProvider();
  await a.signInWithPopup(auth, webProvider);
}

/** Compatibilidad con el código anterior. */
export const signInWithGoogle = () => signIn('google');

export async function signOutUser(): Promise<void> {
  const { auth, a } = await load();
  await a.signOut(auth);
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut().catch(() => {});
  }
}

export async function saveRemoteMatch(uid: string, m: MatchSummary): Promise<void> {
  const { db, f } = await load();
  // Solo los campos que admiten las reglas de Firestore (las partidas antiguas pueden traer otros).
  const { id, date, mode, players, won, pablos, hands, handsWon, tricksWon, betsMade, betsWon } = m;
  await f.setDoc(f.doc(db, 'users', uid, 'matches', id), { id, date, mode, players, won, pablos, hands, handsWon, tricksWon, betsMade, betsWon });
}

export async function loadRemoteMatches(uid: string): Promise<MatchSummary[]> {
  const { db, f } = await load();
  const q = f.query(f.collection(db, 'users', uid, 'matches'), f.orderBy('date', 'desc'), f.limit(500));
  const snap = await f.getDocs(q);
  return snap.docs.map((d) => d.data() as MatchSummary);
}

/** Derecho de supresión: borra todas las partidas guardadas y la cuenta de Firebase. */
export async function deleteAccountAndData(uid: string): Promise<void> {
  const { db, f, auth, a } = await load();
  const snap = await f.getDocs(f.collection(db, 'users', uid, 'matches'));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = f.writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  if (auth.currentUser) {
    const user = auth.currentUser;
    try {
      await a.deleteUser(user);
    } catch {
      // Firebase exige un inicio de sesión reciente para borrar la cuenta: se vuelve a pedir.
      const provider: AuthProviderId = user.providerData.some((p) => p.providerId === 'apple.com') ? 'apple' : 'google';
      const credential = await credentialFor(provider, await load());
      if (credential) await a.reauthenticateWithCredential(user, credential);
      else await a.reauthenticateWithPopup(user, provider === 'apple' ? new a.OAuthProvider('apple.com') : new a.GoogleAuthProvider());
      await a.deleteUser(user);
    }
  }
}
