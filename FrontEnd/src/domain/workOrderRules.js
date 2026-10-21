/**
 * DEC-09 (one-click conversion) and DEC-10 (closure) pure rules.
 */
import { addDays, toYmd } from '../utils/dates';

// PUBLIC_INTERFACE
export const DUE_DAYS_BY_PRIORITY = { critical: 1, high: 3, medium: 7 };

// PUBLIC_INTERFACE
export const CLOSURE_ERRORS = {
  note: 'A resolution note is required',
  parts: 'Record quantity used on at least one part or tick "No parts used"',
  meter: 'Meter reading at service cannot be below the current baseline',
};

// PUBLIC_INTERFACE
export function dueDateForPriority(priority, now) {
  /** Default due date: today +1 (critical), +3 (high) or +7 (medium) days. */
  const days = DUE_DAYS_BY_PRIORITY[priority] || DUE_DAYS_BY_PRIORITY.medium;
  return toYmd(addDays(now, days));
}

// PUBLIC_INTERFACE
export function formatWoNumber(id) {
  /** Work order number: `WO-` followed by the id padded to 6 digits. */
  return `WO-${String(id).padStart(6, '0')}`;
}

// PUBLIC_INTERFACE
export function buildFaultDescription({ parameter, alert, equipment }) {
  /** Fault description inherited by a work order created from an alert. */
  const limitWord = parameter.limitType === 'max_limit' ? 'limit' : 'service interval';
  const unit = parameter.unit || '';
  return (
    `${parameter.name} reading ${alert.currentValue} ${unit} exceeds safe ${limitWord} ` +
    `${alert.safeValue} ${unit} on ${equipment.assetCode} (${equipment.name}, ${equipment.location}). ` +
    `Breaches recorded: ${alert.breachCount}. Suggested action: ${alert.suggestedAction}`
  );
}

// PUBLIC_INTERFACE
export function validateClosure(workOrder, parts, payload, parameter) {
  /**
   * Validate a close request. Returns null when valid, otherwise
   * { message, field }. `parts` are the work order's existing parts.
   */
  const { resolutionNote, partsUsed = [], additionalParts = [], noPartsUsed, meterReadingAtService } =
    payload || {};
  if (!resolutionNote || !String(resolutionNote).trim()) {
    return { message: CLOSURE_ERRORS.note, field: 'resolutionNote' };
  }
  const existingIds = new Set(parts.map((p) => p.id));
  const usedExisting = partsUsed.some((u) => existingIds.has(u.partId) && Number(u.quantityUsed) > 0);
  const usedAdditional = additionalParts.some(
    (p) => p && String(p.partName || '').trim() && Number(p.quantityUsed) > 0
  );
  if (!usedExisting && !usedAdditional && noPartsUsed !== true) {
    return { message: CLOSURE_ERRORS.parts, field: 'parts' };
  }
  if (
    parameter &&
    parameter.limitType === 'service_interval' &&
    meterReadingAtService !== undefined &&
    meterReadingAtService !== null &&
    meterReadingAtService !== '' &&
    Number(meterReadingAtService) < Number(parameter.baselineValue || 0)
  ) {
    return { message: CLOSURE_ERRORS.meter, field: 'meterReadingAtService' };
  }
  return null;
}
