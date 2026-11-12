import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FaccionesDefs } from './components/decks/Facciones';
import '@fontsource-variable/inter';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/900.css';
import './styles.css';
import './theme.css';
import { startNativeApp } from './native/startup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FaccionesDefs />
    <App />
  </StrictMode>,
);

// Apps de iPhone y Android: pantalla de carga y botón atrás.
void startNativeApp();
