/**
 * Arranque de las apps de iPhone y Android. En la web no hace nada.
 *
 * - Anuncio al entrar: con la pantalla de carga visible se muestra el anuncio de apertura y después
 *   se oculta la pantalla de carga. La primera vez que se abre la app tras instalarla no se muestra
 *   (lo recomienda Google: el jugador acaba de aceptar la privacidad y aún no ha visto el juego).
 * - Al volver a la app tras más de 30 minutos fuera, se vuelve a mostrar, salvo si estaba en una partida.
 */
import { isNativeApp, showAppOpenAd } from './ads';

const LAUNCHES_KEY = 'pablo.launches';
const BACKGROUND_MIN_MS = 30 * 60 * 1000;

const inMatch = () => /^#\/(sala|practica)/.test(window.location.hash);

export async function startNativeApp(): Promise<void> {
  if (!isNativeApp()) return;
  const [{ SplashScreen }, { App }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
  ]);

  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0f3d2e' }).catch(() => {});

  const launches = Number(localStorage.getItem(LAUNCHES_KEY) ?? '0') + 1;
  localStorage.setItem(LAUNCHES_KEY, String(launches));

  try {
    if (launches > 1) await showAppOpenAd();
  } finally {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  }

  // Botón «atrás» de Android: navega dentro del juego en lugar de cerrar la app.
  App.addListener('backButton', ({ canGoBack }) => {
    if (window.location.hash && window.location.hash !== '#/') {
      if (canGoBack) window.history.back();
      else window.location.hash = '#/';
    } else {
      App.exitApp();
    }
  });

  let leftAt = 0;
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      leftAt = Date.now();
      return;
    }
    if (leftAt && Date.now() - leftAt > BACKGROUND_MIN_MS && !inMatch()) void showAppOpenAd(3000);
    leftAt = 0;
  });
}
