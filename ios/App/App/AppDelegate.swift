import UIKit
import Capacitor
import FirebaseCore
import GoogleMobileAds

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Cuentas (Google / Apple): solo si ya se ha añadido GoogleService-Info.plist (ver docs/APPS_MOVILES.md).
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

/// Pantalla principal: la de Capacitor más los plugins propios de la app.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppOpenAdPlugin())
    }
}

/// Anuncio de apertura (formato «App Open» de AdMob): el único que Google permite mostrar al entrar.
/// Se carga y se muestra mientras sigue la pantalla de carga; si no llega a tiempo, no se muestra.
/// Uso desde JS: src/client/native/ads.ts
@objc(AppOpenAdPlugin)
public class AppOpenAdPlugin: CAPPlugin, CAPBridgedPlugin, FullScreenContentDelegate {
    public let identifier = "AppOpenAdPlugin"
    public let jsName = "AppOpenAd"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadAndShow", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var appOpenAd: AppOpenAd?
    private var finished = true
    private var loaded = false

    @objc func loadAndShow(_ call: CAPPluginCall) {
        guard let adUnitId = call.getString("adUnitId"), !adUnitId.isEmpty else {
            call.reject("Falta adUnitId")
            return
        }
        let timeout = Double(call.getInt("timeoutMs") ?? 4000) / 1000.0
        DispatchQueue.main.async {
            self.pendingCall = call
            self.finished = false
            self.loaded = false
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
                if !self.loaded { self.finish(shown: false, reason: "timeout") }
            }
            AppOpenAd.load(with: adUnitId, request: Request()) { ad, error in
                if self.finished { return } // llegó tarde: el jugador ya está dentro
                guard let ad = ad, error == nil else {
                    self.finish(shown: false, reason: error?.localizedDescription ?? "error")
                    return
                }
                guard let viewController = self.bridge?.viewController else {
                    self.finish(shown: false, reason: "sin vista")
                    return
                }
                self.loaded = true
                self.appOpenAd = ad
                ad.fullScreenContentDelegate = self
                ad.present(from: viewController)
            }
        }
    }

    private func finish(shown: Bool, reason: String?) {
        if finished { return }
        finished = true
        var result: [String: Any] = ["shown": shown]
        if let reason = reason { result["reason"] = reason }
        pendingCall?.resolve(result)
        pendingCall = nil
        appOpenAd = nil
    }

    public func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        finish(shown: true, reason: nil)
    }

    public func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        finish(shown: false, reason: error.localizedDescription)
    }
}
