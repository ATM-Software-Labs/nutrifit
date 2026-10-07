# NutriFit · App Android (Capacitor 8)

La app Android es la misma web (`dist/`) empaquetada con Capacitor. Se sirve
dentro del WebView en `https://localhost` y habla con la API de producción
(`https://nutri.trujillomingorance.com`) con un **token Bearer**.

| | |
|---|---|
| appId | `com.trujillomingorance.nutrifit` |
| Proyecto nativo | `android/` (versionado, como recomienda Capacitor) |
| Plugins | `@capacitor/app` (enlaces, botón atrás), `@capacitor/preferences` (token), `@capacitor/splash-screen`, `@capacitor/status-bar` |
| Requisitos | Node 22, **JDK 21** (Capacitor 8 / AGP 8.13 compilan con Java 21), Android SDK 36 |
| minSdk / target | 24 (Android 7.0) / 36 |

## Compilar en local

```bash
npm ci
npm run build                 # web → dist/
npx cap sync android          # copia dist/ y plugins a android/
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Atajos: `npm run android:sync`, `npm run android:debug`. Para abrir en Android
Studio: `npx cap open android`. `android/local.properties` (ruta del SDK) no se versiona.

### Iconos y splash

Generados desde `resources/` (icon, icon-foreground/background, splash,
splash-dark) con `@capacitor/assets`, que no se deja como dependencia (arrastra
paquetes con avisos de seguridad). Para regenerarlos tras cambiar el logo:

```bash
npm run brand            # regenera resources/*.png desde los SVG
npm run android:assets   # npx @capacitor/assets generate --android …
```

## Inicio de sesión en la app (magic link)

1. La app pide el enlace con `cliente: "app"` → el correo apunta a
   `https://nutri.trujillomingorance.com/app-login?token=…`.
2. **App Link verificado** → Android abre NutriFit directamente
   (`appUrlOpen` / `getLaunchUrl`) → `POST /api/auth/token` → token Bearer (60
   días, revocable) guardado con `@capacitor/preferences`.
3. **Sin verificar** (p. ej. huella aún de ejemplo) → se abre `/app-login` en el
   navegador con «Abrir en la app» (`intent://login?token=…;scheme=com.trujillomingorance.nutrifit`)
   o «Entrar en la web». La página no gasta el token.

Almacenamiento del token: `Preferences` = SharedPreferences privadas de la app
(otras apps no pueden leerlas sin root; `allowBackup="false"` evita que viajen
en copias de seguridad). Si se quiere cifrado respaldado por **Android Keystore**,
cambiar `src/lib/tokenApp.ts` por un plugin como `@aparajita/capacitor-secure-storage`
(misma interfaz get/set/remove).

## Firma de release

### 1. Crear el keystore (una vez)

```bash
bash scripts/crear-keystore.sh ~/nutrifit-release.jks nutrifit
```

Imprime la huella **SHA-256** y genera `~/nutrifit-release.jks.b64`.
**Guarda el `.jks` y la contraseña** (gestor de contraseñas + copia): sin ellos
no se pueden publicar actualizaciones que se instalen encima.

### 2. Secretos de GitHub (Settings → Secrets and variables → Actions)

| Secreto | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contenido de `nutrifit-release.jks.b64` |
| `KEYSTORE_PASSWORD` | contraseña del keystore |
| `KEY_ALIAS` | `nutrifit` |
| `KEY_PASSWORD` | la misma contraseña (PKCS12) |

```bash
gh secret set ANDROID_KEYSTORE_BASE64 < ~/nutrifit-release.jks.b64
gh secret set KEYSTORE_PASSWORD
gh secret set KEY_ALIAS --body nutrifit
gh secret set KEY_PASSWORD
```

Sin estos secretos `.github/workflows/build-apk.yml` **falla**: no publica un
APK de depuración. Un APK de depuración y uno firmado no se actualizan entre sí
(hay que desinstalar), así que la firma tiene que estar antes del primer tag.

### 3. Huella para App Links → `public/.well-known/assetlinks.json`

Ya contiene la SHA-256 del keystore de release (`03:19:65:BF:…:87:EB:32`). Si algún día cambias de keystore, sustitúyela por la nueva:

```bash
keytool -list -v -keystore ~/nutrifit-release.jks -alias nutrifit | grep SHA256
# o, desde un APK ya firmado:
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs NutriFit.apk
```

Se puede añadir también la del keystore de depuración
(`~/.android/debug.keystore`, contraseña `android`) para probar App Links con
builds debug. Despliega la web y comprueba:

```bash
curl -s https://nutri.trujillomingorance.com/.well-known/assetlinks.json
adb shell pm verify-app-links --re-verify com.trujillomingorance.nutrifit
adb shell pm get-app-links com.trujillomingorance.nutrifit   # → verified
```

Firma en local (opcional): define `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (o las
propiedades `nutrifitKeystorePath`… en `~/.gradle/gradle.properties`) y ejecuta
`./gradlew assembleRelease`.

## Publicar una versión

```bash
npm version 1.0.0 --no-git-tag-version   # opcional: sube package.json
git commit -am "chore: v1.0.0" && git tag v1.0.0 && git push --follow-tags
```

`.github/workflows/build-apk.yml` compila y crea la Release con
`NutriFit-v1.0.0.apk`, `NutriFit.apk` (nombre fijo → enlace estable
`https://github.com/ATM-Software-Labs/nutrifit/releases/latest/download/NutriFit.apk`)
y `SHA256SUMS.txt`. La web NO enlaza a GitHub (en muchos móviles abre la app de
GitHub en vez de descargar): ofrece **`https://nutri.trujillomingorance.com/descargar/NutriFit.apk`**
(alias `/descargar/NutriFit-latest.apk`), una Pages Function que resuelve la
release *latest* con ese redirect (sin la API de GitHub), guarda la resolución
10 min en la caché del borde y reenvía el binario en streaming con
`Content-Type: application/vnd.android.package-archive`,
`Content-Disposition: attachment; filename=NutriFit.apk`,
`Cache-Control: public, max-age=3600, must-revalidate` y `Content-Length`.
Una release nueva se sirve como mucho 10 min después de publicarse.
`GET /api/app/version` → `{ version, tamano, url }` para los botones. versionCode = X·1 000 000 + Y·10 000 + Z·100.
También se puede lanzar a mano (Actions → Compilar APK → Run workflow): deja el
APK como artefacto y, si se marca, crea una pre-release `dev-N` (no cambia «latest»).

El repositorio por defecto está en **un solo sitio**: `src/lib/config.ts`
(`VITE_GITHUB_REPO`, por defecto `ATM-Software-Labs/nutrifit`; en CI se usa
automáticamente `github.repository`).
