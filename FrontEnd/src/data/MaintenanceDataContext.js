/**
 * DEC-04 data provider. Holds the in-memory state and exposes actions that
 * wrap the pure commands. A future backend phase replaces these internals
 * with API calls without changing pages.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as commands from './commands';
import * as selectors from './selectors';
import { buildSeedData } from './seedData';
import { useSession } from '../session/SessionContext';

const MaintenanceDataContext = createContext(null);

// PUBLIC_INTERFACE
export function MaintenanceDataProvider({ initialState, children }) {
  /** Provide `{ state, actions, select }`; `initialState` lets tests inject data. */
  const { user } = useSession();
  const [state, setState] = useState(() => initialState || buildSeedData(new Date()));
  // The ref mirrors state so consecutive actions in one handler see the latest value.
  const stateRef = useRef(state);
  const actorRef = useRef(user);
  actorRef.current = user;

  const run = useCallback((command, input) => {
    const out = command(stateRef.current, input, { now: new Date(), actor: actorRef.current });
    if (out.error) return { ok: false, error: out.error };
    if (out.state !== stateRef.current) {
      stateRef.current = out.state;
      setState(out.state);
    }
    return { ok: true, result: out.result };
  }, []);

  const actions = useMemo(
    () => ({
      registerEquipment: (input) => run(commands.registerEquipment, input),
      updateEquipment: (id, patch) => run(commands.updateEquipment, { id, patch }),
      addParameter: (equipmentId, input) => run(commands.addParameter, { equipmentId, input }),
      updateParameter: (id, patch) => run(commands.updateParameter, { id, patch }),
      logReading: (input) => run(commands.logReading, input),
      createWorkOrderFromAlert: (alertId) => run(commands.createWorkOrderFromAlert, { alertId }),
      updateWorkOrder: (id, patch) => run(commands.updateWorkOrder, { id, patch }),
      addPart: (workOrderId, input) => run(commands.addPart, { workOrderId, input }),
      updatePart: (workOrderId, partId, patch) => run(commands.updatePart, { workOrderId, partId, patch }),
      removePart: (workOrderId, partId) => run(commands.removePart, { workOrderId, partId }),
      closeWorkOrder: (id, payload) => run(commands.closeWorkOrder, { id, payload }),
      resetDemoData: () => {
        const fresh = buildSeedData(new Date());
        stateRef.current = fresh;
        setState(fresh);
        return { ok: true, result: null };
      },
    }),
    [run]
  );

  // Selectors bound to the current state, e.g. select.activeAlerts({ priority }).
  const select = useMemo(() => {
    const bound = {};
    Object.keys(selectors).forEach((name) => {
      bound[name] = (...args) => selectors[name](state, ...args);
    });
    return bound;
  }, [state]);

  const value = useMemo(() => ({ state, actions, select }), [state, actions, select]);
  return <MaintenanceDataContext.Provider value={value}>{children}</MaintenanceDataContext.Provider>;
}

// PUBLIC_INTERFACE
export function useMaintenance() {
  /** Access `{ state, actions, select }`; must be used inside MaintenanceDataProvider. */
  const ctx = useContext(MaintenanceDataContext);
  if (!ctx) throw new Error('useMaintenance must be used inside MaintenanceDataProvider');
  return ctx;
}
