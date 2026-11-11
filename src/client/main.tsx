import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountProvider } from './account';
import { App } from './App';
import { FaccionesDefs } from './components/decks/Facciones';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <FaccionesDefs />
      <App />
    </AccountProvider>
  </StrictMode>,
);
