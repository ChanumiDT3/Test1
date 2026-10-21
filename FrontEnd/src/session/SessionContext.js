/**
 * DEC-11 session: there is no login in phase 1. The acting user is chosen
 * from the four hardcoded users via the role switcher.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { USERS } from '../data/seedData';
import { can as roleCan } from '../domain/permissions';

const SessionContext = createContext(null);

// PUBLIC_INTERFACE
export function SessionProvider({ initialUserId = 1, children }) {
  /** Holds the acting user; defaults to Erin Engineer. */
  const [userId, setUserIdState] = useState(initialUserId);
  const setUserId = useCallback((id) => setUserIdState(Number(id)), []);
  const value = useMemo(() => {
    const user = USERS.find((u) => u.id === userId) || USERS[0];
    return {
      user,
      users: USERS,
      setUserId,
      can: (capability) => roleCan(user.role, capability),
    };
  }, [userId, setUserId]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// PUBLIC_INTERFACE
export function useSession() {
  /** Access `{ user, users, setUserId, can }`; must be used inside SessionProvider. */
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
