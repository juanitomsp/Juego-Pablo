"""
Aplica la configuración nativa del juego a los proyectos generados por Capacitor (android/ e ios/).
Es idempotente: se puede ejecutar varias veces. Lo usa también la compilación de GitHub.

  python scripts/native/configurar-nativo.py

Identificadores de AdMob: por defecto se usan los de PRUEBA de Google. Para los reales, define
ADMOB_APP_ID_ANDROID y ADMOB_APP_ID_IOS al compilar (ver docs/APPS_MOVILES.md).
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)

# IDs de aplicación de PRUEBA publicados por Google (no generan ingresos, no tienen riesgo).
TEST_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713'
TEST_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511'
APP_ID_ANDROID = os.environ.get('ADMOB_APP_ID_ANDROID') or TEST_APP_ID_ANDROID
APP_ID_IOS = os.environ.get('ADMOB_APP_ID_IOS') or TEST_APP_ID_IOS


def read(p):
    with open(p, encoding='utf8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf8', newline='\n') as f:
        f.write(s)


def ensure(p, marker, insert_after, text):
    """Inserta `text` tras `insert_after` si `marker` no está ya en el fichero."""
    s = read(p)
    if marker in s:
        return
    if insert_after not in s:
        sys.exit(f'No encuentro el punto de inserción en {p}: {insert_after!r}')
    write(p, s.replace(insert_after, insert_after + text, 1))


# ------------------------------------------------------------------ Android
if os.path.isdir('android'):
    ensure('android/variables.gradle', 'rgcfaIncludeGoogle', 'ext {\n',
           "    // Inicio de sesión con Google (plugin @capacitor-firebase/authentication)\n"
           "    rgcfaIncludeGoogle = true\n"
           "    // SDK de anuncios de Google, el mismo que usa @capacitor-community/admob\n"
           "    playServicesAdsVersion = '24.7.+'\n")

    gradle = 'android/app/build.gradle'
    g = read(gradle)
    if "findProperty('versionCode')" not in g:
        # Google Play exige que el número de versión suba en cada subida: lo pone la compilación de GitHub.
        g = g.replace('        versionCode 1\n', "        versionCode ((project.findProperty('versionCode') ?: '1') as Integer)\n", 1)
        write(gradle, g)
    ensure(gradle, 'admobAppId', '        versionName "1.0"\n',
           "        // ID de la app en AdMob (por defecto, el de prueba de Google)\n"
           f"        manifestPlaceholders = [admobAppId: (System.getenv('ADMOB_APP_ID_ANDROID') ?: '{TEST_APP_ID_ANDROID}')]\n")
    ensure(gradle, 'play-services-ads', 'dependencies {\n',
           '    // Necesario para el anuncio de apertura (AppOpenAdPlugin.java)\n'
           '    implementation "com.google.android.gms:play-services-ads:$rootProject.ext.playServicesAdsVersion"\n')
    # Firma de la versión de publicación (solo si existen las variables de la clave).
    ensure(gradle, 'signingConfigs', '    buildTypes {\n', '')
    s = read(gradle)
    if 'signingConfigs {' not in s:
        s = s.replace('    buildTypes {\n', '''    signingConfigs {
        release {
            // Se rellenan en GitHub con los secretos ANDROID_KEYSTORE_* (ver docs/APPS_MOVILES.md).
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
    }
    buildTypes {
''', 1)
        s = s.replace("        release {\n            minifyEnabled false",
                      "        release {\n            if (System.getenv('ANDROID_KEYSTORE_PATH')) signingConfig signingConfigs.release\n            minifyEnabled false", 1)
        write(gradle, s)

    ensure('android/app/src/main/AndroidManifest.xml', 'com.google.android.gms.ads.APPLICATION_ID',
           '        android:theme="@style/AppTheme">\n',
           '\n        <!-- AdMob: ID de la app (se rellena desde build.gradle) -->\n'
           '        <meta-data\n'
           '            android:name="com.google.android.gms.ads.APPLICATION_ID"\n'
           '            android:value="${admobAppId}" />\n')

    main = 'android/app/src/main/java/es/elpablo/juego/MainActivity.java'
    if 'AppOpenAdPlugin' not in read(main):
        write(main, '''package es.elpablo.juego;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios de la app (deben registrarse antes de super.onCreate).
        registerPlugin(AppOpenAdPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
''')
    print('Android configurado.')

# ------------------------------------------------------------------ iOS
if os.path.isdir('ios'):
    ensure('ios/App/Podfile', "CapacitorFirebaseAuthentication/Google", "  capacitor_pods\n",
           "  # Inicio de sesión con Google (Apple viene incluido en el plugin)\n"
           "  pod 'CapacitorFirebaseAuthentication/Google', :path => '../../node_modules/@capacitor-firebase/authentication'\n")

    sb = 'ios/App/App/Base.lproj/Main.storyboard'
    s = read(sb)
    s = s.replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="MainViewController" customModule="App"')
    write(sb, s)

    plist = 'ios/App/App/Info.plist'
    s = read(plist)
    extra = ''
    if 'GADApplicationIdentifier' not in s:
        extra += f'\t<key>GADApplicationIdentifier</key>\n\t<string>{APP_ID_IOS}</string>\n'
    else:
        s = re.sub(r'(<key>GADApplicationIdentifier</key>\s*<string>)[^<]*(</string>)', rf'\g<1>{APP_ID_IOS}\g<2>', s)
    if 'NSUserTrackingUsageDescription' not in s:
        extra += ('\t<key>NSUserTrackingUsageDescription</key>\n'
                  '\t<string>Solo se usa para mostrarte anuncios más relevantes. El juego funciona igual si no lo permites.</string>\n')
    if 'SKAdNetworkItems' not in s:
        # Identificador de la red de Google (lista completa: https://developers.google.com/admob/ios/3p-skadnetworks)
        extra += ('\t<key>SKAdNetworkItems</key>\n\t<array>\n'
                  '\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n'
                  '\t</array>\n')
    if 'ITSAppUsesNonExemptEncryption' not in s:
        # Solo usa el cifrado estándar (https): evita el trámite de exportación en cada versión.
        extra += '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n'
    if extra:
        s = s.replace('<dict>\n', '<dict>\n' + extra, 1)
    # Inicio de sesión con Google: esquema de URL a partir de GoogleService-Info.plist, si ya existe.
    gsi = 'ios/App/App/GoogleService-Info.plist'
    if os.path.exists(gsi) and 'CFBundleURLTypes' not in s:
        m = re.search(r'<key>REVERSED_CLIENT_ID</key>\s*<string>([^<]+)</string>', read(gsi))
        if m:
            s = s.replace('<dict>\n', '<dict>\n'
                          '\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n'
                          '\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n'
                          f'\t\t\t\t<string>{m.group(1)}</string>\n'
                          '\t\t\t</array>\n\t\t</dict>\n\t</array>\n', 1)
    write(plist, s)

    # Capacidad «Iniciar sesión con Apple»
    ent = 'ios/App/App/App.entitlements'
    if not os.path.exists(ent):
        write(ent, '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyLists-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
''')
    pbx = 'ios/App/App.xcodeproj/project.pbxproj'
    s = read(pbx)
    if 'CODE_SIGN_ENTITLEMENTS' not in s:
        s = s.replace('\t\t\t\tCODE_SIGN_STYLE = Automatic;\n',
                      '\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;\n')
        write(pbx, s)
    print('iOS configurado.')
