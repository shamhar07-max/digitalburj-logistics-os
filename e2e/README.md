# End-to-end browser flows

`flows.mjs` drives a real Chromium (playwright-core) against a running, seeded stack. Ten flows: quote from rate card → send → customer accepts → job created · pipeline drag-and-drop persists · overdue invoice payment · driver trip + signature POD (phone viewport) · offline POD queue then sync · role-matrix edit changes access · command palette · dark mode + Arabic RTL · public tracking hides billing state · customer portal scoping.

```bash
npm run db:migrate && npm run db:seed
LOGIN_RATE_LIMIT=1000 ENABLE_SCHEDULER=false npm run dev -w @digitalburj/api &   # :3001
npm run build -w @digitalburj/web && PORT=3001 NODE_ENV=production node apps/api/dist/index.js   # or use `npm run dev` for Vite
BASE_URL=http://localhost:3001 CHROME=/opt/pw-browsers/chromium SHOTS_DIR=./e2e-shots node e2e/flows.mjs
```

Env: `BASE_URL`, `CHROME` (executable path; exported), `SHOTS_DIR` (screenshots). Google Fonts requests are aborted for speed/offline. Raise `LOGIN_RATE_LIMIT` for repeated runs.
