/**
 * Date helpers. Calendar dates (lastServiceDate, dueDate) are local
 * `YYYY-MM-DD` strings; timestamps are ISO strings. All helpers are pure and
 * take an explicit `now` so tests can pin time.
 */

const pad2 = (n) => String(n).padStart(2, '0');

// PUBLIC_INTERFACE
export function toYmd(date) {
  /** Format a Date as a local calendar date string `YYYY-MM-DD`. */
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// PUBLIC_INTERFACE
export function addDays(date, n) {
  /** Return a new Date that is `n` calendar days after `date` (negative allowed). */
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

// PUBLIC_INTERFACE
export function daysAgo(now, n) {
  /** Return a Date `n` days before `now`. */
  return addDays(now, -n);
}

// PUBLIC_INTERFACE
export function daysFromNow(now, n) {
  /** Return a Date `n` days after `now`. */
  return addDays(now, n);
}

// PUBLIC_INTERFACE
export function hoursAgo(now, n) {
  /** Return a Date `n` hours before `now`. */
  return new Date(now.getTime() - n * 60 * 60 * 1000);
}

// PUBLIC_INTERFACE
export function isValidYmd(value) {
  /** True when `value` is a well-formed `YYYY-MM-DD` string for a real date. */
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// PUBLIC_INTERFACE
export function isOverdue(dueDate, status, now) {
  /** A work order is overdue when it is not closed and its due date is before today. */
  if (!dueDate || status === 'closed') return false;
  return dueDate < toYmd(now);
}
