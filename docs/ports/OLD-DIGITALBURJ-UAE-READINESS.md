# UAE readiness — what is real, what is an adapter

Honest status of each UAE-specific capability. "Built" means implemented and covered by tests; "Adapter" means the integration point exists but needs credentials/certification you must obtain.

| Capability | Status | Detail |
|---|---|---|
| VAT codes S 5% / Z / E / O; international freight zero-rated by default | Built | `packages/shared/money.ts`; VAT return workings page (Box-style summary from posted invoices/bills) |
| TRN validation (15 digits), UAE IBAN (mod-97), ISO 6346 container check digit, +971 MSISDN normalisation, working-day calendar (Sat–Sun weekend plus a **hard-coded 2026–2027 public-holiday table; Islamic dates are approximate and must be reviewed each year**), amount-in-words AED | Built | `packages/shared/uae.ts`, unit-tested |
| Tax invoice / credit note with TRN, AED totals, Arabic-capable layout | Built | Print-to-PDF invoice view with amount in words |
| E-invoice XML (UBL 2.1, PINT-AE-style: type 380/381, per-category tax subtotals, escaping) | Built (format) | Generated and structurally tested. **Not validated against the official FTA/Peppol schematron.** |
| E-invoice submission via an Accredited Service Provider | Adapter | `ASP_ENDPOINT` / `ASP_API_KEY`. With none set the invoice is marked `sandbox` – **nothing is transmitted to the FTA**. You must contract an ASP and complete their onboarding/certification. |
| WPS SIF (EDR + SCR records, totals, identifier validation) | Built (format) | Follows the commonly used SIF layout. **Each bank/exchange house has its own acceptance rules — validate a test file with your bank before payroll.** No bank submission is automated. |
| Customs declarations (register, HS code, duty on CIF, status flow) | Built (record-keeping) | No live filing to Dubai Trade / Mirsal 2 / Dubai Customs. Those integrations require licensed access and are not implemented. |
| Container tracking | Adapter | `NAVO24_API_KEY`; without it, milestones are manual/demo. |
| WhatsApp customer channel | Adapter | Meta WhatsApp Cloud API (token, phone id, app secret); inbound webhook HMAC-verified. |
| Email | Adapter | Resend (`RESEND_API_KEY`); otherwise queued in `outbox`. |
| AI extraction / assistant | Adapter + fallback | `ANTHROPIC_API_KEY`; deterministic rules extraction works without it. |
| Bilingual UI | Built (partial) | EN/AR with RTL for navigation and core screens; long-tail strings fall back to English. |
| Data residency | Operator | Choose an in-region Postgres/S3 (e.g. AWS me-central-1) if required by your policy. |

Before go-live: confirm VAT treatment with your tax advisor, validate SIF with your bank, complete ASP onboarding, and review the [security checklist](SECURITY.md).
