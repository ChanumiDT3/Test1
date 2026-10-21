import React from 'react';
import { titleCase } from '../utils/format';

// PUBLIC_INTERFACE
export function StatusBadge({ status }) {
  /** Render a color-coded status badge for equipment, alerts or work orders. */
  return <span className={`badge badge-status-${status}`}>{titleCase(status)}</span>;
}
