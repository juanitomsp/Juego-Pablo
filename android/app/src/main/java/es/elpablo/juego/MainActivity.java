package es.elpablo.juego;

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
