package com.trujillomingorance.nutrifit;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView vista = getBridge().getWebView();
        // El layout de Capacitor no es activity_main.xml. La aceleración de
        // ventana está en el manifest; aquí se fija la capa de la WebView.
        vista.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings ajustes = vista.getSettings();
        ajustes.setDomStorageEnabled(true);
        ajustes.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ajustes.setOffscreenPreRaster(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vista.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
    }
}
