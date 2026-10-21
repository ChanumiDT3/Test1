# Predictive Maintenance Alert & Work Order System

Phase 1 provides a clickable predictive-maintenance frontend using hardcoded, in-memory demo data. It supports the equipment, reading, alert, work-order, parts, closure, and role-based workflows without requiring a backend service.

## Repository layout

- [`FrontEnd/`](FrontEnd/README.md) contains the runnable React application.
- `BackEnd/` is reserved for a future approved backend API and database integration. It intentionally contains only a deferred-scope notice in phase 1.

## Run the phase-1 frontend

```bash
cd FrontEnd
npm install
PORT=3000 HOST=0.0.0.0 BROWSER=none npm start
```

Open the frontend at `http://localhost:3000`.

## Validate the frontend

```bash
cd FrontEnd
CI=true npm test -- --watchAll=false
CI=true npm run build
npx eslint --max-warnings=0 src
```

## Phase-1 scope

All application data is reset when the page reloads or when the in-app **Reset demo data** action is used. Backend APIs, persistence, database schema work, authentication, live sensor integrations, and inventory integrations are deferred.
