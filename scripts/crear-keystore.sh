#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# NutriFit · crea el keystore de FIRMA DE RELEASE del APK (una sola vez).
#
#   bash scripts/crear-keystore.sh [ruta.jks] [alias]
#   (no interactivo: NUTRIFIT_KS_PASS=… [NUTRIFIT_KS_DN=…] bash scripts/crear-keystore.sh …)
#
# ⚠️  Guarda el .jks y las contraseñas en un gestor de contraseñas y haz copia de
#     seguridad: si los pierdes, no podrás publicar actualizaciones que se
#     instalen encima de la app existente (habría que desinstalar).
#     NUNCA lo subas al repositorio (.gitignore ya excluye *.jks / *.keystore).
#
# Al terminar imprime:
#   · el valor para el secreto ANDROID_KEYSTORE_BASE64 (archivo .b64 al lado);
#   · la huella SHA-256 para public/.well-known/assetlinks.json.
# Requiere keytool (incluido en cualquier JDK 17+).
# -----------------------------------------------------------------------------
set -euo pipefail
KS="${1:-$HOME/nutrifit-release.jks}"
ALIAS="${2:-nutrifit}"
command -v keytool >/dev/null || { echo "Falta keytool: instala un JDK (p. ej. Temurin 21)." >&2; exit 1; }
[[ -e "$KS" ]] && { echo "Ya existe $KS — no lo sobrescribo." >&2; exit 1; }

if [[ -n "${NUTRIFIT_KS_PASS:-}" ]]; then
  # Modo no interactivo (la contraseña llega por entorno; no se imprime nunca).
  PASS="$NUTRIFIT_KS_PASS"
  [[ ${#PASS} -ge 6 ]] || { echo "NUTRIFIT_KS_PASS demasiado corta." >&2; exit 1; }
else
  read -r -s -p "Contraseña del keystore (mín. 6 caracteres): " PASS; echo
  read -r -s -p "Repite la contraseña: " PASS2; echo
  [[ "$PASS" == "$PASS2" && ${#PASS} -ge 6 ]] || { echo "Las contraseñas no coinciden o son demasiado cortas." >&2; exit 1; }
fi
DN="${NUTRIFIT_KS_DN:-CN=Alberto Trujillo Mingorance, O=NutriFit, L=Barcelona, C=ES}"

# PKCS12: la contraseña de la clave es la misma que la del almacén.
keytool -genkeypair -v \
  -keystore "$KS" -storetype PKCS12 \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "$DN"

base64 -w0 "$KS" > "$KS.b64" 2>/dev/null || base64 -i "$KS" -o "$KS.b64"   # Linux / macOS
chmod 600 "$KS" "$KS.b64"

SHA=$(keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | sed -nE 's/^[[:space:]]*SHA256: (.*)$/\1/p')
cat <<FIN

✔ Keystore creado: $KS   (alias: $ALIAS)

Secretos de GitHub (Settings → Secrets and variables → Actions → New repository secret):
  ANDROID_KEYSTORE_BASE64 = contenido de $KS.b64
  KEYSTORE_PASSWORD       = la contraseña que acabas de escribir
  KEY_ALIAS               = $ALIAS
  KEY_PASSWORD            = la misma contraseña (PKCS12)

Con gh CLI:
  gh secret set ANDROID_KEYSTORE_BASE64 < "$KS.b64"
  gh secret set KEYSTORE_PASSWORD
  gh secret set KEY_ALIAS --body "$ALIAS"
  gh secret set KEY_PASSWORD

Huella SHA-256 para public/.well-known/assetlinks.json:
  $SHA

Después borra $KS.b64 (ya está en GitHub) y guarda $KS en lugar seguro.
FIN
