import React, { useState } from 'react';
import {
  DollarSign,
  Receipt,
  Scale,
  TrendingUp,
  FileCode,
  QrCode,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Building,
} from 'lucide-react';
import { INITIAL_INVOICES } from '../../data/mockData';
import { Invoice } from '../../types';
import { VelocityReport } from './VelocityReport';

interface FinanceViewProps {
  defaultTab?: 'invoices' | 'costing' | 'vat' | 'einvoice' | 'cashflow' | 'velocity';
}

export const FinanceView: React.FC<FinanceViewProps> = ({ defaultTab = 'invoices' }) => {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [activeTab, setActiveTab] = useState<'invoices' | 'costing' | 'vat' | 'einvoice' | 'cashflow' | 'velocity'>(defaultTab);
  const [selectedInvoiceForXml, setSelectedInvoiceForXml] = useState<Invoice>(INITIAL_INVOICES[0]);

  React.useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const handleIssueInvoice = (invId: string) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === invId
          ? {
              ...i,
              status: 'issued',
              aspStatus: 'cleared',
              aspUuid: `urn:uuid:${Math.random().toString(36).substring(2, 10)}-8841-4c02-ae00`,
              qrPayload: `https://verify.tax.gov.ae/e-invoicing/${i.invoiceNo}`,
            }
          : i
      )
    );
    alert('Invoice issued, UAE VAT tax calculated, and accredited ASP Peppol XML transmission cleared with UAE Federal Tax Authority.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Finance & Compliance</span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              UAE VAT & eInvoicing ASP Native
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Financial Suite & Job Costing</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full General Ledger, AR/AP aging, multi-currency accounting, and accredited FTA eInvoicing submission engine.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white rounded-2xl px-4 p-1 gap-2 shadow-xs">
        {[
          { id: 'invoices', label: 'Customer Invoices & Billing' },
          { id: 'costing', label: 'Per-Shipment Job Costing' },
          { id: 'vat', label: 'UAE VAT 5% Compliance' },
          { id: 'einvoice', label: 'Accredited ASP eInvoicing (PINT-AE)' },
          { id: 'cashflow', label: '30-Day Cash Flow Forecast' },
          { id: 'velocity', label: 'Operational Velocity & Bottlenecks' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === t.id
                ? 'bg-[#09192D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="border-b border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm">Tax Invoices ({invoices.length})</h3>
            <span className="text-xs text-slate-500">TRN: 100234567800003 (Gulf Star Logistics)</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Customer & TRN</th>
                <th className="p-3.5">Issue / Due Date</th>
                <th className="p-3.5 text-right">Subtotal</th>
                <th className="p-3.5 text-right">VAT (5%)</th>
                <th className="p-3.5 text-right">Total (AED)</th>
                <th className="p-3.5">ASP Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5 font-mono font-bold text-slate-900">{inv.invoiceNo}</td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{inv.customer}</div>
                    <div className="text-[10px] font-mono text-slate-400">TRN: {inv.customerTrn}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="text-slate-800">{inv.issueDate}</div>
                    <div className="text-[10px] text-slate-400">Due: {inv.dueDate}</div>
                  </td>
                  <td className="p-3.5 text-right font-mono font-medium">AED {inv.subtotal.toLocaleString()}</td>
                  <td className="p-3.5 text-right font-mono font-medium text-slate-500">
                    {inv.vatAmount > 0 ? `AED ${inv.vatAmount.toLocaleString()}` : '0% (Export)'}
                  </td>
                  <td className="p-3.5 text-right font-mono font-black text-slate-950">
                    AED {inv.total.toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        inv.aspStatus === 'cleared'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inv.aspStatus === 'cleared' ? '✓ ASP Cleared' : 'Pending ASP'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-1.5">
                    {inv.status === 'draft' ? (
                      <button
                        onClick={() => handleIssueInvoice(inv.id)}
                        className="rounded-lg bg-[#E8472B] px-3 py-1 text-xs font-bold text-white hover:bg-[#D13B20] transition"
                      >
                        Issue & Clear ASP
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedInvoiceForXml(inv);
                          setActiveTab('einvoice');
                        }}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                      >
                        Inspect XML
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* UAE VAT 5% Compliance Tab */}
      {activeTab === 'vat' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Taxable Sales (Sep)</span>
              <div className="text-2xl font-black text-slate-950 mt-1">AED 229,550</div>
              <span className="text-[10px] text-slate-500">Standard 5% Rate applies</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Output VAT Collected</span>
              <div className="text-2xl font-black text-amber-800 mt-1">AED 11,478</div>
              <span className="text-[10px] text-slate-500">Due to FTA by 28 Oct</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Input VAT Deductible</span>
              <div className="text-2xl font-black text-blue-800 mt-1">AED 8,570</div>
              <span className="text-[10px] text-slate-500">From carrier & terminal bills</span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Net VAT Payable</span>
              <div className="text-2xl font-black text-emerald-900 mt-1">AED 2,908</div>
              <span className="text-[10px] text-emerald-700 font-bold">100% Reconciled to GL</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">FTA Return 201 Generation Engine</h4>
                <p className="text-xs text-slate-500">Auto-populates Box 1a (Standard rated supplies in Dubai) & Box 9 (Standard rated expenses)</p>
              </div>
              <button
                onClick={() => alert('FTA Return 201 XML & PDF summary generated for submission.')}
                className="rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
              >
                Generate FTA 201 XML
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-mono leading-relaxed">
              Box 1a (Standard Rated Supplies): AED 229,550.00 | VAT: AED 11,477.50<br />
              Box 2 (Zero-Rated Export Supplies): AED 92,000.00 | VAT: AED 0.00<br />
              Box 9 (Standard Rated Expenses): AED 171,400.00 | Recoverable VAT: AED 8,570.00<br />
              Net VAT Due for Tax Period: AED 2,907.50
            </div>
          </div>
        </div>
      )}

      {/* Accredited ASP eInvoicing Tab */}
      {activeTab === 'einvoice' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-purple-600" />
                <h4 className="font-bold text-sm text-slate-900">PINT-AE Peppol XML Payload</h4>
              </div>
              <span className="font-mono text-xs font-bold text-purple-700">{selectedInvoiceForXml.invoiceNo}</span>
            </div>
            <div className="rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300 max-h-96 overflow-y-auto">
              <pre>{`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:peppol:pint:billing-1@ae-1</cbc:CustomizationID>
  <cbc:ProfileID>urn:peppol:bis:billing</cbc:ProfileID>
  <cbc:ID>${selectedInvoiceForXml.invoiceNo}</cbc:ID>
  <cbc:IssueDate>2026-09-29</cbc:IssueDate>
  <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>
  
  <!-- Accounting Supplier Party -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="TRN">100234567800003</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Gulf Star Logistics LLC</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Accounting Customer Party -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="TRN">${selectedInvoiceForXml.customerTrn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${selectedInvoiceForXml.customer}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Tax Total -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="AED">${selectedInvoiceForXml.vatAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="AED">${selectedInvoiceForXml.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="AED">${selectedInvoiceForXml.vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>5.00</cbc:Percent>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Legal Monetary Total -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="AED">${selectedInvoiceForXml.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="AED">${selectedInvoiceForXml.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="AED">${selectedInvoiceForXml.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="AED">${selectedInvoiceForXml.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`}</pre>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <QrCode className="h-5 w-5 text-emerald-600" />
              <h4 className="font-bold text-sm text-slate-900">Accredited ASP Transmission Status</h4>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span>ASP Status: Cleared & Registered</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-[11px] text-emerald-800 space-y-1">
                <div><strong>UUID:</strong> urn:uuid:7f3a9e12-8841-4c02-9912-ae00348f9821</div>
                <div><strong>Hash:</strong> e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
                <div><strong>Timestamp:</strong> 29 Sep 2026, 11:32:04 GST</div>
              </div>
            </div>

            <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
              <div className="flex justify-center">
                <div className="h-28 w-28 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-mono p-2 text-center">
                  [FTA E-INVOICE QR CODE]
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Cryptographically signed QR embedded into customer PDF invoice per UAE Federal Tax Authority standard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Forecast Tab */}
      {activeTab === 'cashflow' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900">30-Day Forward Cash Position Forecast (AED)</h4>
              <p className="text-xs text-slate-500">Directly calculated from AR invoices due + committed carrier payables</p>
            </div>
            <span className="font-mono text-sm font-black text-emerald-700">Projected 31 Oct: AED 264,550</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Timeline Date</th>
                  <th className="p-3">Inflow (AR Collections)</th>
                  <th className="p-3">Outflow (Carrier Bills)</th>
                  <th className="p-3">Net Daily Movement</th>
                  <th className="p-3 text-right">Projected Cash Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {[
                  { d: '01 Oct 2026', in: 'AED 48,500 (Al Faris)', out: 'AED 1,200', net: '+AED 47,300', bal: 'AED 268,700' },
                  { d: '05 Oct 2026', in: '—', out: 'AED 51,600 (Maersk Line)', net: '-AED 51,600', bal: 'AED 217,100' },
                  { d: '10 Oct 2026', in: 'AED 12,750 (Zayed Foods)', out: '—', net: '+AED 12,750', bal: 'AED 229,850' },
                  { d: '15 Oct 2026', in: 'AED 28,500 (Al Faris partial)', out: 'AED 8,200 (Customs duty)', net: '+AED 20,300', bal: 'AED 250,150' },
                  { d: '31 Oct 2026', in: 'AED 92,000 (Emirates Steel)', out: 'AED 58,200 (WPS Payroll)', net: '+AED 33,800', bal: 'AED 264,550' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-sans font-bold text-slate-900">{row.d}</td>
                    <td className="p-3 text-emerald-700 font-semibold">{row.in}</td>
                    <td className="p-3 text-rose-700 font-semibold">{row.out}</td>
                    <td className="p-3 text-slate-700 font-bold">{row.net}</td>
                    <td className="p-3 text-right font-black text-slate-950">{row.bal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-Shipment Job Costing Tab */}
      {activeTab === 'costing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Per-Shipment Job Profitability Ledger</h4>
              <p className="text-xs text-slate-500">Reconciled to whole-company GL rather than an isolated ops silo</p>
            </div>
            <span className="text-xs text-emerald-700 font-bold">Average Profitability: 26.4%</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Shipment Ref</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Service / Lane</th>
                  <th className="p-3 text-right">Revenue (AED)</th>
                  <th className="p-3 text-right">Carrier Buy (AED)</th>
                  <th className="p-3 text-right">Net Margin</th>
                  <th className="p-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {[
                  { ref: 'DB-1048', cust: 'Al Faris Trading', lane: 'Sea FCL · Shenzhen → JEA', rev: 48500, cost: 36200, profit: 12300, m: 25.4 },
                  { ref: 'DB-1049', cust: 'Nexa Pharma FZE', lane: 'Air Express · DXB → FRA', rev: 21400, cost: 15600, profit: 5800, m: 27.1 },
                  { ref: 'DB-1050', cust: 'Emirates Steel', lane: 'Sea FCL · JEA → Mumbai', rev: 92000, cost: 64100, profit: 27900, m: 30.3 },
                  { ref: 'DB-1051', cust: 'Zayed Foods LLC', lane: 'Sea LCL · Bangkok → JEA', rev: 12750, cost: 9100, profit: 3650, m: 28.6 },
                  { ref: 'DB-1052', cust: 'Al Faris Trading', lane: 'Road GCC · JEA → Al Ain', rev: 3400, cost: 2600, profit: 800, m: 23.5 },
                ].map((row) => (
                  <tr key={row.ref} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{row.ref}</td>
                    <td className="p-3 font-sans font-bold text-slate-800">{row.cust}</td>
                    <td className="p-3 font-sans text-slate-500">{row.lane}</td>
                    <td className="p-3 text-right font-black">{row.rev.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-600">{row.cost.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-700 font-bold">{row.profit.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-700 font-black">{row.m}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operational Velocity Report Tab — data-driven, filterable by mode */}
      {activeTab === 'velocity' && <VelocityReport />}
    </div>
  );
};
