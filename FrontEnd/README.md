# Predictive Maintenance Frontend

This React application is the phase-1 frontend for the Predictive Maintenance Alert & Work Order System. It uses hardcoded, in-memory demo data only: no API requests, database, or browser persistence are used.

## Run locally

```bash
npm install
PORT=3000 HOST=0.0.0.0 BROWSER=none npm start
```

## Quality commands

```bash
CI=true npm test -- --watchAll=false
CI=true npm run build
npx eslint --max-warnings=0 src
```

## Demo roles

Use the **Acting as** selector in the top bar to switch between Erin Engineer, Sam Engineer, Olu Operator, and Maya Manager. The reset button restores the original seeded equipment, alerts, work orders, parts, and reading history.
