# Prototype vs production — and what the merged version keeps

Two artefacts were compared feature by feature:

* **Prototype** — the uploaded AI Studio export (`src/` React 19 + Tailwind 4, ~14k lines, 40 views, all data in `mockData.ts`, state in memory, no server).
* **Production** — this monorepo, deployed on Vercel + Neon (Express/Postgres API, JWT auth, multi-tenant RBAC, ledger, VAT, e-invoice XML, WPS, offline driver app, automation, tests, CI).

**Decision:** production is the base, because everything the prototype shows still needs a backend, auth, tenancy and money integrity to be usable by a real forwarder. From the prototype we port what is *functional and missing*, rebuilt on real data. Showcase-only content is dropped or reduced to what can be verified.

## Where each one is stronger

| Area | Prototype | Production | Merged version |
|---|---|---|---|
| Persistence, auth, multi-tenancy, audit | none (in-memory, role dropdown) | JWT + rotating refresh, row-level tenancy, audit log | production |
| RBAC | role atlas screen | 12 roles × 34 modules, field-level cost hiding, enforced server-side | production |
| Accounting, VAT, e-invoice XML, WPS SIF | UI mock-ups | double-entry ledger, VAT codes, PINT-AE-style XML, SIF builder, tests | production |
| Offline driver app / POD | screen | idempotent offline sync | production |
| Automation, WhatsApp, doc extraction | screens | engine + webhook + extractor | production |
| **Automated document generation** (HBL, Packing List, Commercial Invoice) | ✔ (client-side only, not saved) | ✘ | **ported, persisted, mode-aware (HBL / HAWB / CMR)** |
| **Quote → docs velocity, by mode** | ✔ hard-coded numbers | ✘ | **rebuilt from real timestamps** |
| **Sea / Air / Road swimlanes with capacity** | ✘ (generic shipment list) | ✘ | **new: Modal Hub on live data** |
| **"Explain this number" drill-downs** on KPIs | ✔ | ✘ | **ported (API returns contributing records)** |
| Fleet register depth (fuel, Salik, service km, chassis, gensets) | ✔ mock | basic vehicles | **ported into the schema** |
| Calculators (CBM / volumetric weight, demurrage, duty) | ✔ | ✘ | **ported, unit-tested** |
| Mandatory-document scorecard per shipment | ✔ | partial (doc vault) | **ported as computed compliance view** |
| Branch sticky notes | ✔ | ✘ | **ported (table + widget)** |
| Design | dense Tailwind, navy/orange | teal/orange brand tokens, RTL, dark mode | production tokens, prototype's information density |

## Ported, and how

1. **Document generator** — prototype `utils/documentGenerator.ts` created three documents in memory the instant a quote converted. In the merged version documents are generated once the carrier **booking is confirmed** (the B/L, AWB or CMR needs carrier, vessel/flight and container data), stored in the database with a version number, re-generatable, and viewable / printable. Sea gets HBL, Air gets HAWB, Road gets CMR; all get Packing List and Commercial Invoice.
2. **Operational Velocity** — the prototype report was static text (its headline "42 min" did not even equal the sum of the stages it listed, because it included a post-document customs step). The merged report measures exactly *Quote Accepted → Document Generation* from four timestamps (quote accepted, job created, booking confirmed, documents generated), excludes the customs step, rejects out-of-order records instead of showing negative times, and can be filtered or compared by Sea / Air / Road.
3. **Modal Hub** — Sea: vessel slot allocation vs booked TEU, container pool, yard, free-time exposure. Air: flight uplift vs allotment, ULD pool, cold-chain positions, cut-off countdowns. Road: fleet utilisation, trips, chassis/genset pool, expiry / fuel / service alerts. Every figure is tagged *live* (computed from job records), *register* (fleet tables) or *sample* (illustrative until a terminal / airline / GPS feed is connected).
4. **Explain this number**, **fleet depth**, **calculators**, **document scorecard**, **notes** — as above.

## Deliberately not ported

* **Competitor pricing and market-share figures.** The prototype states specific competitor prices ("$100–$400/user/mo"), pricing-change percentages, and invented DigitalBurj numbers (monthly TEU, "22.4% SME share", "100% UAE compliance score"). None of it is sourced, so it does not belong in a production product. The merged version keeps a qualitative competitor summary ([COMPETITORS.md](COMPETITORS.md)) and a feature-coverage view generated from what this codebase really implements.
* **Pricing calculator for the DigitalBurj SaaS itself** — a sales tool for the vendor, not a feature for a forwarder using the OS.
* **Role-switcher dropdown** — replaced by real accounts and enforced permissions.

## Known gaps in both

No live customs filing (Dubai Trade / Mirsal), no carrier EDI / booking APIs, no bank-validated WPS file, no accredited e-invoicing provider connection, no MFA. See [UAE-READINESS.md](UAE-READINESS.md).
