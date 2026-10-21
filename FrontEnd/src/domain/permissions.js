/**
 * DEC-11 role permission matrix (no authentication in phase 1).
 */

// PUBLIC_INTERFACE
export const ROLES = ['engineer', 'operator', 'manager'];

// PUBLIC_INTERFACE
export const CAPABILITIES = {
  viewEquipment: ['engineer', 'operator', 'manager'],
  manageEquipment: ['engineer'],
  logReading: ['engineer', 'operator'],
  viewAlerts: ['engineer', 'manager'],
  viewWorkOrders: ['engineer', 'manager'],
  viewDashboard: ['engineer', 'manager'],
  manageWorkOrders: ['engineer'],
};

// PUBLIC_INTERFACE
export const NOT_AUTHORISED = 'Not authorised';

// PUBLIC_INTERFACE
export function can(role, capability) {
  /** True when `role` holds `capability`. Unknown capabilities are denied. */
  const allowed = CAPABILITIES[capability];
  return Array.isArray(allowed) && allowed.includes(role);
}

// PUBLIC_INTERFACE
export function roleHome(role) {
  /** Return the default landing route for a role. */
  if (role === 'operator') return '/log-reading';
  if (role === 'manager') return '/dashboard';
  return '/alerts';
}
