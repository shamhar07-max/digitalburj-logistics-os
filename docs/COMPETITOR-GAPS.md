# Competitor gaps — what to add next (Fresa / Zoho / Odoo)

Elvora base already covers: master jobs + sub-jobs, quotations→jobs, rate cards,
containers/cargo/milestones, public tracking, carrier bookings, delivery orders,
customs register, transport + warehouse (GRN/FEFO/ledger/barcode), double-entry
ledger + VAT + bank import/matching + year-end, WPS SIF, UBL PINT-AE e-invoice,
projects/tasks, tickets/claims, AI team (Jarvis + 7 employees), WhatsApp bots +
inbox, PDF + bilingual EN/AR, 60+ corporate templates.

## Where competitors are still ahead

### Fresa Gold (freight-native ERP)
1. **Wizard processing + bulk upload + duplicate job/voucher** — guided job creation,
   CSV bulk shipments, one-click duplicate. Elvora has CSV import/export per entity
   but no bulk-shipment wizard.
2. **Tariff management (LCL/FCL/Air/Land) + proration** — lane/tier/validity rate
   engine with LCL proration across HBLs. Elvora has rate cards; add validity windows
   + LCL CBM proration.
3. **Agent-wise / tradeline-wise profitability, Top-10 customers/salesmen,
   weekly one-page performance** — Elvora has sales-by-branch + KPI; add canned MIS.
4. **My Reports (user-defined columns, pivot, favourites)** — Elvora reports are
   curated; add column-chooser + saved views per role.
5. **Customer credit portal + vendor payment portal** — Elvora has a customer portal
   role + statements; add agent/CFS credit views + vendor bill upload/pay status.
6. **Sales mobile + call location, video call, likes/links/tags/follow-ups on every
   record, exception monitor** — Elvora has comments/follow-ups/attachments on jobs;
   extend the rail pattern to all entities + exception inbox.
7. **Login hardening (IP/MAC/office-time, multi-login toggle)** — Elvora has lockout
   + TOTP; add IP allow-list + session list.
8. **Legacy Job Center (read-only historical import)** — Excel templates for old jobs
   kept searchable but isolated from ledger. Valuable for migrations.
9. **AI vendor-quotation analyzer** — compare multiple vendor PDFs side-by-side,
   rank by price/service. Elvora AI employees can grow this tool.
10. **Courier + Air consol (MAWB + back-to-back HAWBs)** — Elvora handles direct
    jobs; add consol open/close + manifest split.

### Zoho stack (modular ecosystem)
11. **Price books as rate cards + margin guardrails** — CRM Quotes with lane/carrier/
    validity price books, live margin % + minimum-margin approval (e.g. 8% FCL,
    12% air). Elvora has margin approval; surface it live in the quote form.
12. **Landed-cost allocation + e-commerce shipping adapters** — freight/duty split
    across SKUs; Shopify/Etsy/XpressBees-style rate+label inside inventory.
    Elvora has stock ledger; add landed-cost wizard.
13. **Desk-style SLAs + customer-facing POD/ledger portal** — support tickets with
    SLA timers + portal showing live status, POD download, account ledger.
    Elvora has tickets + portal role; add SLA clocks.

### Odoo (inventory/accounting depth)
14. **Perpetual valuation (FIFO/AVCO/standard, Anglo-Saxon vs Continental, SVL layers,
    revaluation, interim accounts)** — Elvora posts ledger on invoice/payment;
    add stock-valuation postings on GRN/dispatch.
15. **Replenishment + routes + forecasted stock/out-of-stock dates** — min/max,
    lead-time, inter-warehouse transit locations, cycle counts, dead/stranded reports.
16. **Barcode/RFID discipline (GS1/EAN) + dispatch rounds (own fleet/third-party)**
    — Elvora has barcode scan + trips; add round planning + EAN validation.

## Recommended build order (smallest effort → biggest win)

1. Margin guardrails in quotes (#11) + canned MIS (#3) — sales-facing, days.
2. My Reports saved views (#4) + exception inbox (#6) — adoption multiplier.
3. Credit/vendor portals (#5) + SLA clocks (#13) — closes deals vs Fresa/Zoho.
4. Tariff validity + LCL proration (#2) + landed costs (#12) — costing correctness.
5. Consol (#10) + Legacy Center (#8) — NVOCC + migration moat.
6. Valuation postings (#14) + replenishment/routes (#15) + dispatch rounds (#16).
7. Login hardening (#7) + vendor-quote AI (#9) — hardening + differentiator.

None of the above needs live customs/carrier filing (Dubai Trade/Mirsal, carrier
EDI, IATA e-AWB) — those remain credential-gated adapters, same as in Elvora
`docs/INTEGRATIONS.md` and old `docs/ports/OLD-DIGITALBURJ-UAE-READINESS.md`.
