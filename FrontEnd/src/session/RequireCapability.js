import React from 'react';
import { useSession } from './SessionContext';
import { NotAuthorized } from '../components/NotAuthorized';

// PUBLIC_INTERFACE
export function RequireCapability({ capability, children }) {
  /** Render children only when the acting user holds the required capability. */
  const { can } = useSession();
  return can(capability) ? children : <NotAuthorized />;
}
