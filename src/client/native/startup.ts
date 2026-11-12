/**
 * Arranque de las apps de iPhone y Android. En la web no hace nada.
 * Barra de estado, pantalla de carga y botón «atrás» de Android.
 */
import { Capacitor } from '@capacitor/core';

export async function startNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const [{ SplashScreen }, { App }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
  ]);

  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0f3d2e' }).catch(() => {});
  await SplashScreen.hide({ fadeOutDuration: 250 });

  // Botón «atrás» de Android: navega dentro del juego en lugar de cerrar la app.
  App.addListener('backButton', ({ canGoBack }) => {
    if (window.location.hash && window.location.hash !== '#/') {
      if (canGoBack) window.history.back();
      else window.location.hash = '#/';
    } else {
      App.exitApp();
    }
  });
}
