import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountProvider } from './account';
import { App } from './App';
import { FaccionesDefs } from './components/decks/Facciones';
import './styles.css';
import { startNativeApp } from './native/startup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <FaccionesDefs />
      <App />
    </AccountProvider>
  </StrictMode>,
);

// Apps de iPhone y Android: anuncio de apertura, pantalla de carga, botón atrás.
void startNativeApp();
