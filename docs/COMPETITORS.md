# Competitive landscape

Qualitative positioning based on public product positioning; no pricing or unverifiable claims. Re-check vendors' current offerings before using this in sales material.

| Vendor (segment) | What they are known for | What we take from it | Where DigitalBurj differs |
|---|---|---|---|
| CargoWise (WiseTech) – global forwarders | Very deep customs, accounting and multi-branch in one platform | Single job record driving costs, revenue, customs and invoicing; multi-entity | Far lighter to adopt for 5–100 staff; UAE VAT/WPS/e-invoice first-class; no multi-month implementation |
| Magaya – mid-size forwarders/NVOCC | Warehouse + forwarding + customer portal | Bin-level warehouse, portal, document vault | Built-in dispatch/driver app, CRM pipeline and HR/payroll |
| Freightos / Flexport / Xeneta-style platforms | Instant quoting, rate transparency, shipment visibility | Rate cards → one-click quote → job; live tracking; public tracking links | Works with *your* negotiated buy rates and hides them from sales by role |
| Cargoo, Shipsy, Descartes-style TMS | Dispatch, route and driver workflows, POD | Trip board, POD capture, driver expenses | Offline-first driver PWA with idempotent sync tied straight to invoicing |
| Odoo / Zoho / Tally – general ERP/accounting | Broad back office, cheap | Double-entry ledger, bank reconciliation, VAT | Logistics-native job costing, lane profitability and freight workflows |
| Navo24 / project44-style visibility | Container and vessel tracking | Tracking adapter (`NAVO24_API_KEY`) | Tracking is one input to a workflow, not the product |

## Deliberate differentiators

1. **UAE-native**: VAT S/Z/E/O with international freight zero-rating, TRN/IBAN/ISO 6346 validation, WPS SIF, PINT-AE-style e-invoice, Arabic/RTL.
2. **Margin privacy by role**: field-level `costs` permission across API, reports and UI.
3. **Ops-to-cash spine**: quote → job → milestones → POD → charges → invoice → ledger, with approvals and audit at each step.
4. **Document intelligence** with validation (ISO 6346 check digits, B/L vs container disambiguation) and a no-AI fallback.
5. **Automation + WhatsApp** for the channels UAE customers actually use.

## Honest gaps versus incumbents

* No live customs-system filing, ocean carrier booking/EDI, or IATA CargoXML/e-AWB.
* No consolidation/groupage (LCL) rating engine or advanced NVOCC features (house/master B/L issuing).
* Reporting is curated, not a BI layer; no multi-currency revaluation beyond FX on documents.
* Smaller integration ecosystem; adapters listed in [UAE-READINESS](UAE-READINESS.md) need credentials.
