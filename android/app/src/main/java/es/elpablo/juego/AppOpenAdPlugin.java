package es.elpablo.juego;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.appopen.AppOpenAd;

/**
 * Anuncio de apertura (formato «App Open» de AdMob): el único formato que Google permite mostrar
 * al entrar en la app. Se carga y se muestra mientras sigue visible la pantalla de carga.
 * Si no llega a tiempo (timeoutMs), no se muestra y el jugador entra directamente.
 * Uso desde JS: src/client/native/ads.ts
 */
@CapacitorPlugin(name = "AppOpenAd")
public class AppOpenAdPlugin extends Plugin {

    @PluginMethod
    public void loadAndShow(PluginCall call) {
        final String adUnitId = call.getString("adUnitId");
        final int timeoutMs = call.getInt("timeoutMs", 4000);
        if (adUnitId == null || adUnitId.isEmpty()) {
            call.reject("Falta adUnitId");
            return;
        }
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            final boolean[] finished = { false };
            final boolean[] loaded = { false };
            final Handler handler = new Handler(Looper.getMainLooper());

            final Runnable timeout = () -> {
                if (!loaded[0]) finish(call, finished, false, "timeout");
            };
            handler.postDelayed(timeout, timeoutMs);

            AppOpenAd.load(activity, adUnitId, new AdRequest.Builder().build(), new AppOpenAd.AppOpenAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull AppOpenAd ad) {
                    if (finished[0]) return; // llegó tarde: el jugador ya está dentro
                    loaded[0] = true;
                    handler.removeCallbacks(timeout);
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            finish(call, finished, true, null);
                        }

                        @Override
                        public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                            finish(call, finished, false, error.getMessage());
                        }
                    });
                    ad.show(activity);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    handler.removeCallbacks(timeout);
                    finish(call, finished, false, error.getMessage());
                }
            });
        });
    }

    private static void finish(PluginCall call, boolean[] finished, boolean shown, String reason) {
        if (finished[0]) return;
        finished[0] = true;
        JSObject result = new JSObject();
        result.put("shown", shown);
        if (reason != null) result.put("reason", reason);
        call.resolve(result);
    }
}
