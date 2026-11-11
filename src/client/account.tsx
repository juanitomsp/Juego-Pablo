import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AccountUser, firebaseEnabled, onUserChanged } from './services/firebase';
import { setStatsUser } from './services/stats';

interface AccountCtx {
  enabled: boolean;
  user: AccountUser | null;
  ready: boolean;
}

const Ctx = createContext<AccountCtx>({ enabled: false, user: null, ready: true });

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(!firebaseEnabled);
  useEffect(
    () =>
      onUserChanged((u) => {
        setStatsUser(u);
        setUser(u);
        setReady(true);
      }),
    [],
  );
  return <Ctx.Provider value={{ enabled: firebaseEnabled, user, ready }}>{children}</Ctx.Provider>;
}

export const useAccount = () => useContext(Ctx);
