import React from 'react';
import { Link } from 'react-router-dom';

// PUBLIC_INTERFACE
export function NotAuthorized() {
  /** Explain that the current role may not access a guarded route. */
  return (
    <section className="empty-state" aria-labelledby="not-authorised-title">
      <h1 id="not-authorised-title">Not authorised for this role</h1>
      <p>Switch to a role with the required capability, or return to your home page.</p>
      <Link className="button button-secondary" to="/">Go to home</Link>
    </section>
  );
}
