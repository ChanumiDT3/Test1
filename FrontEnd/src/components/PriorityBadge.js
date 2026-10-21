import React from 'react';
import { titleCase } from '../utils/format';

// PUBLIC_INTERFACE
export function PriorityBadge({ priority }) {
  /** Render a color-coded priority badge. */
  return <span className={`badge badge-priority-${priority}`}>{titleCase(priority)}</span>;
}
