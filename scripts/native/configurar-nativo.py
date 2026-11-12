"""
Aplica la configuración nativa del juego a los proyectos generados por Capacitor (android/ e ios/).
Es idempotente: se puede ejecutar varias veces. Lo usa también la compilación de GitHub.

  python scripts/native/configurar-nativo.py

El juego no tiene anuncios ni cuentas: solo se configura la firma de Android, el número de versión
y la declaración de cifrado de iPhone.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)


def read(p):
    with open(p, encoding='utf8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf8', newline='\n') as f:
        f.write(s)


# ------------------------------------------------------------------ Android
if os.path.isdir('android'):
    gradle = 'android/app/build.gradle'
    s = read(gradle)
    if "findProperty('versionCode')" not in s:
        # Google Play exige que el número de versión suba en cada subida: lo pone la compilación de GitHub.
        s = s.replace('        versionCode 1\n', "        versionCode ((project.findProperty('versionCode') ?: '1') as Integer)\n", 1)
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
    print('Android configurado.')

# ------------------------------------------------------------------ iOS
if os.path.isdir('ios'):
    plist = 'ios/App/App/Info.plist'
    s = read(plist)
    if 'ITSAppUsesNonExemptEncryption' not in s:
        # Solo usa el cifrado estándar (https): evita el trámite de exportación en cada versión.
        s = s.replace('<dict>\n', '<dict>\n\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n', 1)
        write(plist, s)
    print('iOS configurado.')
