/**
 * DEC-08 suggested actions: a priority prefix plus a template per parameter kind.
 */

// PUBLIC_INTERFACE
export const PRIORITY_PREFIX = {
  critical: 'Immediate action: ',
  high: 'Plan within 3 days: ',
  medium: 'Plan within 7 days: ',
};

// PUBLIC_INTERFACE
export const KIND_TEMPLATES = {
  temperature: 'Check cooling, lubrication and load; inspect bearings and verify the temperature sensor.',
  vibration: 'Inspect for imbalance, misalignment, loose mounts and bearing wear; verify the vibration sensor.',
  pressure: 'Check for blockages, leaks and regulator or valve faults; verify the pressure gauge.',
  runtime_hours:
    'Service interval exceeded: perform scheduled preventive maintenance and reset the runtime counter.',
  cycle_count:
    'Cycle limit exceeded: inspect wear components (tooling, dies, belts) and perform scheduled service.',
  other: 'Inspect the machine against the breached parameter and its maintenance manual.',
};

// PUBLIC_INTERFACE
export function buildSuggestedAction(kind, priority) {
  /** Build the suggested action text for an alert. */
  const prefix = PRIORITY_PREFIX[priority] || PRIORITY_PREFIX.medium;
  const template = KIND_TEMPLATES[kind] || KIND_TEMPLATES.other;
  return `${prefix}${template}`;
}
