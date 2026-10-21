import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MaintenanceDataProvider } from '../data/MaintenanceDataContext';
import { SessionProvider } from '../session/SessionContext';

/**
 * Render an application fragment with the production routing, session, and
 * in-memory data providers. Tests can supply a deterministic route, user, or
 * state without mocking application behavior.
 */
// PUBLIC_INTERFACE
export function renderWithProviders(ui, { route = '/', userId = 1, state } = {}) {
  /** Render `ui` inside the production providers with optional test overrides. */
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SessionProvider initialUserId={userId}>
        <MaintenanceDataProvider initialState={state}>{ui}</MaintenanceDataProvider>
      </SessionProvider>
    </MemoryRouter>
  );
}
