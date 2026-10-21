/**
 * Domain enumerations shared by the data layer and UI.
 */

// PUBLIC_INTERFACE
export const KINDS = ['temperature', 'vibration', 'pressure', 'runtime_hours', 'cycle_count', 'other'];

// PUBLIC_INTERFACE
export const KIND_LABELS = {
  temperature: 'Temperature',
  vibration: 'Vibration',
  pressure: 'Pressure',
  runtime_hours: 'Runtime hours',
  cycle_count: 'Cycle count',
  other: 'Other',
};

/** DEC-05: service-interval kinds are measured against a meter baseline. */
// PUBLIC_INTERFACE
export const LIMIT_TYPE_BY_KIND = {
  temperature: 'max_limit',
  vibration: 'max_limit',
  pressure: 'max_limit',
  runtime_hours: 'service_interval',
  cycle_count: 'service_interval',
  other: 'max_limit',
};

// PUBLIC_INTERFACE
export const LIMIT_TYPE_LABELS = {
  max_limit: 'Maximum limit',
  service_interval: 'Service interval',
};

// PUBLIC_INTERFACE
export const CRITICALITIES = ['low', 'medium', 'high'];

// PUBLIC_INTERFACE
export const PRIORITIES = ['critical', 'high', 'medium'];

// PUBLIC_INTERFACE
export const EQUIPMENT_STATUSES = ['healthy', 'at_risk'];

// PUBLIC_INTERFACE
export const ALERT_STATES = ['open', 'in_progress', 'resolved'];

// PUBLIC_INTERFACE
export const ACTIVE_ALERT_STATES = ['open', 'in_progress'];

// PUBLIC_INTERFACE
export const WORK_ORDER_STATUSES = ['open', 'in_progress', 'closed'];

// PUBLIC_INTERFACE
export const AVAILABILITY = ['yes', 'no', 'ordered'];

// PUBLIC_INTERFACE
export const EQUIPMENT_TYPES = ['CNC machine', 'Conveyor', 'Press', 'Compressor'];
