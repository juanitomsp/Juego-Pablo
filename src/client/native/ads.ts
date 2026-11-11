/**
 * Anuncios en las apps de iPhone y Android (AdMob). En la web no se muestra ninguno.
 *
 * Orden al abrir la app:
 *  1. Consentimiento (obligatorio en Europa): formulario de Google (UMP) si hace falta.
 *  2. iPhone: permiso de seguimiento (ATT), solo la primera vez.
 *  3. Anuncio de apertura mientras sigue la pantalla de carga (máx. 4 s; si no llega, se entra sin anuncio).
 *
 * Por defecto se usan los identificadores de PRUEBA de Google. Para los reales, define al compilar
 * VITE_ADMOB_APP_OPEN_ANDROID y VITE_ADMOB_APP_OPEN_IOS (ver docs/APPS_MOVILES.md).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppOpenAdPlugin {
  loadAndShow(options: { adUnitId: string; timeoutMs?: number }): Promise<{ shown: boolean; reason?: string }>;
}
const AppOpenAd = registerPlugin<AppOpenAdPlugin>('AppOpenAd');

const TEST_UNITS = {
  android: 'ca-app-pub-3940256099942544/9257395921',
  ios: 'ca-app-pub-3940256099942544/5575463023',
};

const env = import.meta.env;
const unitFor = (platform: string) =>
  platform === 'ios'
    ? (env.VITE_ADMOB_APP_OPEN_IOS as string | undefined) || TEST_UNITS.ios
    : (env.VITE_ADMOB_APP_OPEN_ANDROID as string | undefined) || TEST_UNITS.android;

export const isNativeApp = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

let ready: Promise<boolean> | null = null;
let privacyOptionsRequired = false;

/** Consentimiento + permiso de seguimiento + inicio de AdMob. Devuelve si se pueden pedir anuncios. */
export function prepareAds(): Promise<boolean> {
  if (!isNativeApp()) return Promise.resolve(false);
  ready ??= (async () => {
    const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
    let canRequestAds = true;
    try {
      let info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        info = await AdMob.showConsentForm();
      }
      canRequestAds = info.canRequestAds;
      privacyOptionsRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
    } catch (e) {
      console.warn('Consentimiento de anuncios no disponible', e);
    }
    if (nativePlatform() === 'ios') {
      try {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) {
        console.warn('Permiso de seguimiento no disponible', e);
      }
    }
    if (canRequestAds) await AdMob.initialize({});
    return canRequestAds;
  })();
  return ready;
}

/** Muestra el anuncio de apertura si llega a tiempo. Nunca lanza error: si falla, se entra sin anuncio. */
export async function showAppOpenAd(timeoutMs = 4000): Promise<boolean> {
  try {
    if (!(await prepareAds())) return false;
    const r = await AppOpenAd.loadAndShow({ adUnitId: unitFor(nativePlatform()), timeoutMs });
    return r.shown;
  } catch (e) {
    console.warn('Anuncio de apertura no mostrado', e);
    return false;
  }
}

/** ¿Hay que ofrecer el botón «Privacidad de los anuncios»? (lo exige Google si el usuario está en Europa) */
export const adsPrivacyOptionsRequired = () => privacyOptionsRequired;

/** Abre el formulario para cambiar el consentimiento de anuncios. */
export async function showAdsPrivacyOptions(): Promise<void> {
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.showPrivacyOptionsForm();
}
