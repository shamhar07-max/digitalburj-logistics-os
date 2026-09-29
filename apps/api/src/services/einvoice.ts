import { TAX_CODES, type TaxCode } from '@digitalburj/shared';
import { config } from '../config';
import { logger } from '../logger';

const esc = (s: any) =>
  String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);
const n2 = (n: any) => Number(n || 0).toFixed(2);

export interface XmlParty {
  name: string;
  trn?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
}

/**
 * UBL 2.1 invoice following the structure of the UAE PINT-AE (Peppol) e-invoicing data model.
 * NOTE: the final XSD/Schematron validation is performed by the Accredited Service Provider (ASP).
 */
export function buildInvoiceXml(inv: any, items: any[], seller: XmlParty, buyer: XmlParty): string {
  const isCredit = inv.kind === 'credit_note';
  const root = isCredit ? 'CreditNote' : 'Invoice';
  const ns = isCredit ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2' : 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
  const byCode = new Map<TaxCode, { taxable: number; tax: number }>();
  for (const it of items) {
    const c = (it.tax_code || 'S') as TaxCode;
    const cur = byCode.get(c) || { taxable: 0, tax: 0 };
    cur.taxable += Number(it.net);
    cur.tax += Number(it.vat);
    byCode.set(c, cur);
  }
  const party = (p: XmlParty) => `
      <cac:Party>
        <cac:PartyName><cbc:Name>${esc(p.name)}</cbc:Name></cac:PartyName>
        <cac:PostalAddress><cbc:StreetName>${esc(p.address || '')}</cbc:StreetName><cbc:CityName>${esc(p.city || '')}</cbc:CityName><cac:Country><cbc:IdentificationCode>${esc(p.country || 'AE')}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
        <cac:PartyTaxScheme><cbc:CompanyID>${esc(p.trn || '')}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
        <cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
        ${p.email ? `<cac:Contact><cbc:ElectronicMail>${esc(p.email)}</cbc:ElectronicMail></cac:Contact>` : ''}
      </cac:Party>`;
  const taxSubtotals = [...byCode.entries()]
    .map(
      ([code, v]) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${esc(inv.currency)}">${n2(v.taxable)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${esc(inv.currency)}">${n2(v.tax)}</cbc:TaxAmount>
        <cac:TaxCategory><cbc:ID>${code}</cbc:ID><cbc:Percent>${(TAX_CODES[code].rate * 100).toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
      </cac:TaxSubtotal>`,
    )
    .join('');
  const lines = items
    .map(
      (it, i) => `
    <cac:${isCredit ? 'CreditNoteLine' : 'InvoiceLine'}>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:${isCredit ? 'CreditedQuantity' : 'InvoicedQuantity'} unitCode="C62">${Number(it.quantity)}</cbc:${isCredit ? 'CreditedQuantity' : 'InvoicedQuantity'}>
      <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${n2(it.net)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Description>${esc(it.description)}</cbc:Description><cbc:Name>${esc(it.description).slice(0, 100)}</cbc:Name>
        <cac:ClassifiedTaxCategory><cbc:ID>${esc(it.tax_code)}</cbc:ID><cbc:Percent>${(TAX_CODES[(it.tax_code || 'S') as TaxCode].rate * 100).toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${esc(inv.currency)}">${n2(it.unit_price)}</cbc:PriceAmount></cac:Price>
    </cac:${isCredit ? 'CreditNoteLine' : 'InvoiceLine'}>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="${ns}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>
  <cbc:ID>${esc(inv.number)}</cbc:ID>
  <cbc:IssueDate>${esc(String(inv.issue_date).slice(0, 10))}</cbc:IssueDate>
  ${isCredit ? '' : `<cbc:DueDate>${esc(String(inv.due_date).slice(0, 10))}</cbc:DueDate>`}
  <cbc:${isCredit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${isCredit ? '381' : '380'}</cbc:${isCredit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>
  <cbc:DocumentCurrencyCode>${esc(inv.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>${party(seller)}</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${party(buyer)}</cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="${esc(inv.currency)}">${n2(inv.vat)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${n2(inv.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(inv.currency)}">${n2(inv.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(inv.currency)}">${n2(inv.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(inv.currency)}">${n2(inv.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</${root}>`;
}

export interface AspResult {
  status: 'submitted' | 'accepted' | 'rejected';
  ref: string;
  sandbox: boolean;
  message?: string;
}

/** Transmit to the tenant's Accredited Service Provider. Without ASP_ENDPOINT this runs in sandbox mode and says so. */
export async function submitToAsp(invoice: { id: string; number: string }, xml: string): Promise<AspResult> {
  if (!config.ASP_ENDPOINT) {
    return { status: 'submitted', ref: `SBX-${invoice.number}-${Date.now().toString(36)}`, sandbox: true, message: 'ASP not configured — recorded in sandbox mode (not transmitted to FTA).' };
  }
  try {
    const r = await fetch(config.ASP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', ...(config.ASP_API_KEY ? { Authorization: `Bearer ${config.ASP_API_KEY}` } : {}) },
      body: xml,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await r.text();
    if (!r.ok) return { status: 'rejected', ref: '', sandbox: false, message: `ASP responded ${r.status}: ${text.slice(0, 300)}` };
    let ref = invoice.number;
    try {
      ref = JSON.parse(text).id || JSON.parse(text).reference || ref;
    } catch {
      /* non-JSON response */
    }
    return { status: 'submitted', ref: String(ref), sandbox: false };
  } catch (err: any) {
    logger.error({ err }, 'ASP submission failed');
    return { status: 'rejected', ref: '', sandbox: false, message: err?.message || 'ASP unreachable' };
  }
}
