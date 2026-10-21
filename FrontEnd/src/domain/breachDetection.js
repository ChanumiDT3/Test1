/**
 * DEC-05 breach detection. Pure functions, no state.
 */
import { LIMIT_TYPE_BY_KIND } from './constants';

// PUBLIC_INTERFACE
export const BELOW_BASELINE_ERROR = 'Reading is below the last service meter value';

/** Round to 6 decimals to avoid floating-point noise at band edges (R-05). */
const round6 = (n) => Math.round(n * 1e6) / 1e6;

// PUBLIC_INTERFACE
export function limitTypeForKind(kind) {
  /** Derive the limit type from a parameter kind; unknown kinds are max limits. */
  return LIMIT_TYPE_BY_KIND[kind] || 'max_limit';
}

// PUBLIC_INTERFACE
export function evaluateReading({ limitType, threshold, baselineValue, value }) {
  /**
   * Evaluate a reading against its threshold.
   * Returns { effectiveValue, isBreach, exceedanceRatio } or { error } when a
   * service-interval meter value is below its baseline. Equality never breaches.
   */
  const numericValue = Number(value);
  const limit = Number(threshold);
  let effectiveValue = numericValue;
  if (limitType === 'service_interval') {
    const baseline = Number(baselineValue) || 0;
    if (numericValue < baseline) {
      return { error: BELOW_BASELINE_ERROR };
    }
    effectiveValue = round6(numericValue - baseline);
  }
  const isBreach = effectiveValue > limit;
  const exceedanceRatio = isBreach ? round6((effectiveValue - limit) / limit) : 0;
  return { effectiveValue, isBreach, exceedanceRatio };
}
