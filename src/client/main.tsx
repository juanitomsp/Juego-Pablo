import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FaccionesDefs } from './components/decks/Facciones';
import './styles.css';
import { startNativeApp } from './native/startup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FaccionesDefs />
    <App />
  </StrictMode>,
);

// Apps de iPhone y Android: pantalla de carga y botón atrás.
void startNativeApp();
