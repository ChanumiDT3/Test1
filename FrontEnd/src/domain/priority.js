/**
 * DEC-06 priority scoring: severity band (from exceedance ratio) x criticality weight.
 */

/** Ordered from highest band; a ratio at or above `min` gets that severity. */
// PUBLIC_INTERFACE
export const SEVERITY_BANDS = [
  { min: 0.25, severity: 3 },
  { min: 0.1, severity: 2 },
  { min: 0, severity: 1 },
];

// PUBLIC_INTERFACE
export const CRITICALITY_WEIGHT = { low: 1, medium: 2, high: 3 };

/** Higher rank = more urgent; used for sorting and "never downgrade" checks. */
// PUBLIC_INTERFACE
export const PRIORITY_RANK = { medium: 1, high: 2, critical: 3 };

// PUBLIC_INTERFACE
export function severityForRatio(ratio) {
  /** Map an exceedance ratio to a severity of 1, 2 or 3 (ratio rounded to 6 dp). */
  const r = Math.round(Number(ratio) * 1e6) / 1e6;
  const band = SEVERITY_BANDS.find((b) => r >= b.min);
  return band ? band.severity : 1;
}

// PUBLIC_INTERFACE
export function priorityFromScore(score) {
  /** Score >= 6 is critical, >= 3 is high, otherwise medium. */
  if (score >= 6) return 'critical';
  if (score >= 3) return 'high';
  return 'medium';
}

// PUBLIC_INTERFACE
export function scoreBreach(ratio, criticality) {
  /** Return { priority, score } for a breach ratio on a machine of the given criticality. */
  const weight = CRITICALITY_WEIGHT[criticality] || 1;
  const score = severityForRatio(ratio) * weight;
  return { priority: priorityFromScore(score), score };
}
