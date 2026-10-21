/**
 * Presentation helpers for values, timestamps and calendar dates.
 */

// PUBLIC_INTERFACE
export function formatNumber(value) {
  /** Format a number with up to 2 decimals and thousands separators. */
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// PUBLIC_INTERFACE
export function formatValue(value, unit) {
  /** Format a measured value followed by its unit, e.g. `5.2 mm/s`. */
  const n = formatNumber(value);
  if (n === '—') return n;
  return unit ? `${n} ${unit}` : n;
}

// PUBLIC_INTERFACE
export function formatDateTime(iso) {
  /** Format an ISO timestamp as a short local date and time. */
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// PUBLIC_INTERFACE
export function formatDate(ymd) {
  /** Format a `YYYY-MM-DD` string as a short local date. */
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

// PUBLIC_INTERFACE
export function titleCase(value) {
  /** Turn an enum value such as `in_progress` into `In progress`. */
  if (!value) return '';
  const text = String(value).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
