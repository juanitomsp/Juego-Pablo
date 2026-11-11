/**
 * Página pública para borrar la cuenta (#/borrar-cuenta). Google Play exige un enlace web
 * donde se pueda pedir el borrado de la cuenta y sus datos sin tener la app instalada.
 */
import { useState } from 'react';
import { go } from '../App';
import { useAccount } from '../account';
import { availableProviders, deleteAccountAndData, signIn } from '../services/firebase';

export function DeleteAccountScreen() {
  const { enabled, user } = useAccount();
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Algo ha fallado.');
    }
  };

  return (
    <main className="page narrow">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>Borrar mi cuenta</span>
      </nav>
      <section className="panel">
        <h2>Borrar tu cuenta de El Pablo y tus datos</h2>
        <p>Se borrarán de forma definitiva:</p>
        <ul>
          <li>Tu cuenta de usuario (inicio de sesión con Google o Apple).</li>
          <li>Todas las estadísticas de tus partidas guardadas en la nube.</li>
        </ul>
        <p className="muted small">
          No guardamos más datos tuyos en el servidor. Los datos guardados solo en tu móvil se borran al desinstalar la app o desde Estadísticas →
          «Borrar datos de este navegador».
        </p>

        {!enabled && <p className="muted">Las cuentas no están activadas en este servidor: no hay ningún dato tuyo que borrar.</p>}

        {enabled && done && <p className="big">✅ Cuenta y datos borrados.</p>}

        {enabled && !done && !user && (
          <>
            <p>Para comprobar que la cuenta es tuya, inicia sesión con la misma cuenta que usas en el juego:</p>
            <div className="row">
              {availableProviders().map((p) => (
                <button key={p} className="primary" onClick={() => run(() => signIn(p))}>
                  {p === 'apple' ? ' Iniciar sesión con Apple' : 'Entrar con Google'}
                </button>
              ))}
            </div>
          </>
        )}

        {enabled && !done && user && (
          <div className="row">
            <button
              className="danger"
              onClick={() =>
                confirm('Se borrarán tu cuenta y todas tus partidas guardadas. No se puede deshacer. ¿Continuar?') &&
                run(async () => {
                  await deleteAccountAndData(user.uid);
                  setDone(true);
                })
              }
            >
              Borrar mi cuenta y mis datos
            </button>
          </div>
        )}

        {msg && <p className="error">{msg}</p>}
        <p className="muted small">
          ¿No puedes iniciar sesión? Escríbenos a <strong>[email de contacto]</strong> desde el email de tu cuenta y la borraremos en un máximo de 30 días.
        </p>
      </section>
    </main>
  );
}
