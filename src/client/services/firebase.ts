/**
 * Cuentas opcionales con Google (Firebase Authentication) y estadísticas en Firestore.
 *
 * Está DESACTIVADO hasta que se configuren las variables VITE_FIREBASE_* (ver docs/CUENTAS_Y_DATOS.md).
 * Sin ellas el juego funciona igual: las estadísticas se guardan solo en el navegador.
 *
 * Minimización de datos: en Firestore solo se guarda el resumen numérico de cada partida bajo
 * users/{uid}/matches. No se guardan email, foto ni nombres de otros jugadores.
 */
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
    const auth = a.getAuth(app);
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

export async function signInWithGoogle(): Promise<void> {
  const { auth, a } = await load();
  await a.signInWithPopup(auth, new a.GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  const { auth, a } = await load();
  await a.signOut(auth);
}

export async function saveRemoteMatch(uid: string, m: MatchSummary): Promise<void> {
  const { db, f } = await load();
  await f.setDoc(f.doc(db, 'users', uid, 'matches', m.id), m);
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
    try {
      await a.deleteUser(auth.currentUser);
    } catch {
      // Firebase exige un inicio de sesión reciente para borrar la cuenta.
      await a.reauthenticateWithPopup(auth.currentUser, new a.GoogleAuthProvider());
      await a.deleteUser(auth.currentUser);
    }
  }
}
