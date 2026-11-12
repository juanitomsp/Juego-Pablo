import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { LiveScore } from './screens/LiveScore';
import { Practice } from './screens/Practice';
import { DocPage } from './screens/DocPage';
import { DeckScreen } from './screens/DeckScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { RoomScreen } from './screens/RoomScreen';
import { StatsScreen } from './screens/StatsScreen';
import { PublicRooms } from './screens/PublicRooms';
import reglas from '../../docs/REGLAS.md?raw';
import privacidad from '../../docs/PRIVACIDAD.md?raw';
import rulesEn from '../../docs/RULES.en.md?raw';
import privacyEn from '../../docs/PRIVACY.en.md?raw';
import { isEn, t } from './i18n';

/** Router mínimo por hash: #/ , #/sala/CODIGO , #/ver/CODIGO (mirar) , #/publicas , #/practica , #/vivo , #/reglas , #/estadisticas , #/privacidad */
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
    case 'ver':
      return <RoomScreen key={`ver-${arg}`} code={arg ?? ''} watch />;
    case 'publicas':
      return <PublicRooms />;
    case 'practica':
      return <Practice />;
    case 'vivo':
      return <LiveScore />;
    case 'reglas':
      return <DocPage title={t('Reglas del Pablo')} source={isEn() ? rulesEn : reglas} />;
    case 'privacidad':
      return <DocPage title={t('Privacidad')} source={isEn() ? privacyEn : privacidad} />;
    case 'tutorial':
      return <TutorialScreen />;
    case 'baraja':
      return <DeckScreen />;
    case 'estadisticas':
      return <StatsScreen />;
    default:
      return <Home />;
  }
}
