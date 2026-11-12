import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { LiveScore } from './screens/LiveScore';
import { Practice } from './screens/Practice';
import { DocPage } from './screens/DocPage';
import { DeckScreen } from './screens/DeckScreen';
import { AdminScreen } from './screens/AdminScreen';
import { RoomScreen } from './screens/RoomScreen';
import { StatsScreen } from './screens/StatsScreen';
import reglas from '../../docs/REGLAS.md?raw';
import privacidad from '../../docs/PRIVACIDAD.md?raw';

/** Router mínimo por hash: #/ , #/sala/CODIGO , #/practica , #/vivo , #/reglas , #/estadisticas , #/privacidad */
function useHashRoute(): string[] {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path;
};

export function App() {
  const [page, arg] = useHashRoute();
  switch (page) {
    case 'sala':
      return <RoomScreen key={arg} code={arg ?? ''} />;
    case 'practica':
      return <Practice />;
    case 'vivo':
      return <LiveScore />;
    case 'reglas':
      return <DocPage title="Reglas del Pablo" source={reglas} />;
    case 'privacidad':
      return <DocPage title="Privacidad" source={privacidad} />;
    case 'admin':
      return <AdminScreen />;
    case 'baraja':
      return <DeckScreen />;
    case 'estadisticas':
      return <StatsScreen />;
    default:
      return <Home />;
  }
}
