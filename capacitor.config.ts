import type { CapacitorConfig } from '@capacitor/cli'

/**
 * NutriFit · configuración de Capacitor (APK Android).
 * La web compilada (dist/) se sirve dentro de la app en https://localhost; las
 * llamadas a la API van a https://nutri.trujillomingorance.com con token Bearer
 * (ver src/lib/plataforma.ts y docs/ANDROID.md).
 */
const config: CapacitorConfig = {
  appId: 'com.trujillomingorance.nutrifit',
  appName: 'NutriFit',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  android: {
    // Nunca HTTP en claro ni contenido mixto dentro del WebView.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT', // iconos oscuros sobre fondo claro
      backgroundColor: '#FFFFFF',
      overlaysWebView: false,
    },
  },
}

export default config
