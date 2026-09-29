import React, { useState } from 'react';
import {
  GitCommit,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Ship,
  FileCheck2,
  Truck,
  Smartphone,
  DollarSign,
  Receipt,
  Scale,
  Sparkles,
  ShieldCheck,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Shipment, TransportMode } from '../../types';
import { INITIAL_SHIPMENTS } from '../../data/mockData';

interface LifecycleStep {
  stepNumber: number;
  id: string;
  name: string;
  shortDesc: string;
  responsibleRole: string;
  mandatoryDocs: string[];
  keyControls: string;
  odooGap: string;
  zohoGap: string;
  digitalBurjEdge: string;
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    stepNumber: 1,
    id: 'lead',
    name: 'Lead Ingestion & KYC',
    shortDesc: 'Capture inquiry from WhatsApp/Email, verify UAE Trade License & VAT TRN.',
    responsibleRole: 'Sales Representative',
    mandatoryDocs: ['Trade License Copy', 'VAT Certificate'],
    keyControls: 'Auto-checks FTA TRN validity & credit rating before quoting.',
    odooGap: 'Requires manual 3rd party plugins; no UAE TRN format check out of the box.',
    zohoGap: 'Zoho CRM is disconnected from Zoho Books credit ledger by default.',
    digitalBurjEdge: 'Direct UAE FTA TRN lookup with 1-click KYC verification.',
  },
  {
    stepNumber: 2,
    id: 'quote',
    name: 'Costing & Quote Generation',
    shortDesc: 'Calculate ocean/air freight, local THC, customs duty, and enforce 18% margin floor.',
    responsibleRole: 'Commercial Manager',
    mandatoryDocs: ['Quotation Breakdown PDF'],
    keyControls: 'Built-in Margin Coach alerts if quote dips below company 18% floor.',
    odooGap: 'Odoo Sales has no shipping container equipment pricing or demurrage tiers.',
    zohoGap: 'Zoho cannot calculate dimensional chargeable airfreight weights.',
    digitalBurjEdge: 'Multi-modal instant quote builder with AI Margin Coach guardrail.',
  },
  {
    stepNumber: 3,
    id: 'acceptance',
    name: 'Customer Acceptance & Booking',
    shortDesc: 'Client accepts quote online or via WhatsApp; system auto-spawns Job DB-xxxx.',
    responsibleRole: 'Customer / Sales',
    mandatoryDocs: ['Signed Booking Confirmation'],
    keyControls: 'Immutable version snapshot locked upon acceptance.',
    odooGap: 'Requires manually creating a sales order and manufacturing/delivery order.',
    zohoGap: 'Multi-step handoff between Zoho CRM, Zoho Sign, and Zoho Books.',
    digitalBurjEdge: '1-click quote-to-shipment conversion with celebratory team notification.',
  },
  {
    stepNumber: 4,
    id: 'carrier',
    name: 'Carrier Space Booking & MBL',
    shortDesc: 'Allocate container space on shipping line or flight, assign container & seal #.',
    responsibleRole: 'Operations Controller',
    mandatoryDocs: ['Master Bill of Lading (MBL)', 'House Bill of Lading (HBL)'],
    keyControls: 'Direct vessel voyage tracking & EDI feed update.',
    odooGap: 'Zero shipping line EDI connection or container demurrage tracking.',
    zohoGap: 'No shipping container tracking or terminal cutoff monitors.',
    digitalBurjEdge: 'Real-time carrier milestones with free-time port demurrage countdown.',
  },
  {
    stepNumber: 5,
    id: 'customs',
    name: 'Customs Pre-Filing (Mirsal II)',
    shortDesc: 'Classify 8-digit HS Code, submit declaration bill, calculate 5% customs duty.',
    responsibleRole: 'Customs Broker Desk',
    mandatoryDocs: ['Mirsal II Declaration Bill', 'Attested Invoice', 'Certificate of Origin'],
    keyControls: 'Manager signoff required for any inspection hold.',
    odooGap: 'Zero UAE Dubai Customs Mirsal II integration.',
    zohoGap: 'No customs clearance workflows or duty handling.',
    digitalBurjEdge: 'Native Mirsal II declaration desk with automated HS code lookup.',
  },
  {
    stepNumber: 6,
    id: 'cfs',
    name: 'Warehouse Devanning / Staging',
    shortDesc: 'Container stripped at JAFZA CFS or cross-docked into pallet bins A-01 to D-12.',
    responsibleRole: 'Warehouse Supervisor',
    mandatoryDocs: ['Inbound Tally Sheet', 'Devanning Report'],
    keyControls: 'Cold room temperature logger check (+2°C to +8°C).',
    odooGap: 'Odoo WMS lacks port cross-dock staging bay workflows.',
    zohoGap: 'Zoho Inventory is limited to basic retail SKU tracking.',
    digitalBurjEdge: 'Real-time pallet bin grid with cold chain temperature validation.',
  },
  {
    stepNumber: 7,
    id: 'dispatch',
    name: 'Haulage Dispatch & Gate Pass',
    shortDesc: 'DP World Terminal gate pass generated with secure security PIN for pickup.',
    responsibleRole: 'Fleet Dispatcher',
    mandatoryDocs: ['Terminal Gate Pass (e-Pass)', 'Delivery Order (e-DO)'],
    keyControls: 'Driver vehicle registration (Mulkiya) & driver ID validated.',
    odooGap: 'No electronic delivery order (e-DO) PIN generation.',
    zohoGap: 'No driver dispatch or gate pass generation.',
    digitalBurjEdge: 'Official DP World & JAFZA electronic Delivery Order (e-DO) generator.',
  },
  {
    stepNumber: 8,
    id: 'pod',
    name: 'Mobile Delivery & Signed POD',
    shortDesc: 'Driver delivers cargo to consignee dock, captures customer signature & photo.',
    responsibleRole: 'Haulage Driver',
    mandatoryDocs: ['Electronic Signed Proof of Delivery (e-POD)'],
    keyControls: 'GPS timestamped signature on glass with receiver name.',
    odooGap: 'Requires expensive enterprise barcode scanner hardware.',
    zohoGap: 'No offline mobile driver app with HTML5 canvas signature.',
    digitalBurjEdge: 'Native mobile driver web app with offline signature pad & GPS camera.',
  },
  {
    stepNumber: 9,
    id: 'invoice',
    name: 'UAE VAT Invoicing & eInvoicing',
    shortDesc: 'Generate Tax Invoice with 5% VAT or 0% export, sync to FTA accredited ASP.',
    responsibleRole: 'Finance Officer',
    mandatoryDocs: ['Tax Invoice (PDF)', 'PINT-AE XML Payload'],
    keyControls: 'Cryptographic QR code and FTA clearing UUID generated.',
    odooGap: 'UAE eInvoicing requires expensive third-party partner customization.',
    zohoGap: 'Zoho Books requires separate add-on subscriptions for accredited eInvoicing.',
    digitalBurjEdge: 'Native UAE VAT Return 201 breakdown and FTA ASP eInvoicing XML engine.',
  },
  {
    stepNumber: 10,
    id: 'costing',
    name: '3-Way Match & Job Costing P&L',
    shortDesc: 'Reconcile carrier bills (Maersk, Dnata) against job costs, release net profit.',
    responsibleRole: 'Finance Director / Owner',
    mandatoryDocs: ['Carrier Vendor Bills', 'Job Costing Sheet'],
    keyControls: 'Blocks job closure until all carrier variances are reconciled.',
    odooGap: 'Requires complicated analytic accounting setup.',
    zohoGap: 'Cannot calculate gross profit per container shipment job.',
    digitalBurjEdge: 'Per-shipment automated job costing with live margin variance flags.',
  },
];

export const LifecycleView: React.FC = () => {
  const [shipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
  const [selectedJobNo, setSelectedJobNo] = useState<string>('DB-1048');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(4); // Default to Step 5 (Customs) for DB-1048

  const currentShipment = shipments.find((s) => s.jobNo === selectedJobNo) || shipments[0];
  const activeStep = LIFECYCLE_STEPS[activeStepIndex];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Company Operational Architecture
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              10-Stage Lead-to-Cash Tracer
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Complete Scratch-to-Complete Lifecycle
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trace how DigitalBurj manages every phase of running a freight forwarder: from lead inquiry to customs, driver POD, and accounting settlement.
          </p>
        </div>

        {/* Shipment Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Active Job:</span>
          <select
            value={selectedJobNo}
            onChange={(e) => {
              setSelectedJobNo(e.target.value);
              // Set appropriate active stage
              if (e.target.value === 'DB-1048') setActiveStepIndex(4);
              else if (e.target.value === 'DB-1049') setActiveStepIndex(3);
              else if (e.target.value === 'DB-1050') setActiveStepIndex(8);
              else setActiveStepIndex(5);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden"
          >
            {shipments.map((s) => (
              <option key={s.id} value={s.jobNo}>
                {s.jobNo} — {s.customer} ({s.mode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 10-Step Interactive Horizontal Stepper */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs overflow-x-auto scrollbar-thin">
        <div className="flex items-center min-w-[1000px] justify-between relative">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>

          {LIFECYCLE_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => setActiveStepIndex(idx)}
                className={`relative z-10 flex flex-col items-center gap-1.5 px-2 py-1 transition group text-center focus:outline-hidden ${
                  isCurrent ? 'scale-105' : 'hover:scale-102'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs transition shadow-xs ${
                    isCurrent
                      ? 'bg-[#E8472B] text-white ring-4 ring-orange-100 font-black'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.stepNumber}
                </div>
                <div className="max-w-[85px]">
                  <span
                    className={`block text-[10.5px] leading-tight font-extrabold ${
                      isCurrent
                        ? 'text-[#E8472B]'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Deep Stage Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stage Detail Card */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-black text-[#E8472B] uppercase">
                  Stage 0{activeStep.stepNumber} of 10
                </span>
                <span className="text-xs text-slate-400">Owner:</span>
                <span className="font-bold text-xs text-slate-800">
                  {activeStep.responsibleRole}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {activeStep.name}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeStep.shortDesc}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Active Job Status
              </span>
              <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-1 rounded">
                {currentShipment.jobNo} · {currentShipment.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Operational Controls & Mandatory Trade Documentation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Standard Operating Control:</span>
              </div>
              <p className="text-slate-700 leading-snug">{activeStep.keyControls}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Mandatory Documents Required:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeStep.mandatoryDocs.map((doc, idx) => (
                  <span
                    key={idx}
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 border border-slate-200"
                  >
                    ✓ {doc}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Live Contributing Data for this Shipment at this Stage */}
          <div className="rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50/40 to-white p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#E8472B]" />
                <span>Live Shipment Record Data ({currentShipment.jobNo}):</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                ETA: {currentShipment.eta}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Shipper</div>
                <div className="font-bold text-slate-800 truncate">{currentShipment.customer}</div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Route</div>
                <div className="font-bold text-slate-800 truncate">
                  {currentShipment.origin} → {currentShipment.destination}
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Equipment</div>
                <div className="font-bold text-slate-800 truncate">
                  {currentShipment.containerOrAwb || currentShipment.piecesWeight}
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Revenue & Margin</div>
                <div className="font-bold font-mono text-emerald-700">
                  AED {currentShipment.revenue.toLocaleString()} ({currentShipment.margin}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Why DigitalBurj Beats Odoo & Zoho */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Scale className="h-5 w-5 text-indigo-600" />
            <h3 className="font-black text-sm text-slate-900">
              Competitor Benchmark for Stage {activeStep.stepNumber}
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {/* Odoo Limitation */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>Odoo ERP Limitation:</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  Manual Plugins
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-snug">{activeStep.odooGap}</p>
            </div>

            {/* Zoho Books Limitation */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>Zoho Suite Limitation:</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  Siloed Modules
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-snug">{activeStep.zohoGap}</p>
            </div>

            {/* DigitalBurj Advantage */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1">
              <div className="font-black text-emerald-950 flex items-center justify-between">
                <span>DigitalBurj Enterprise Advantage:</span>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-200 px-1.5 py-0.5 rounded">
                  100% Native
                </span>
              </div>
              <p className="text-emerald-900 text-[11.5px] leading-snug font-medium">
                {activeStep.digitalBurjEdge}
              </p>
            </div>
          </div>

          {/* Next Stage Advance CTA */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (activeStepIndex < LIFECYCLE_STEPS.length - 1) {
                  setActiveStepIndex(activeStepIndex + 1);
                } else {
                  setActiveStepIndex(0);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 p-2.5 text-xs font-bold text-white hover:bg-[#E8472B] transition shadow-xs"
            >
              <span>Advance to Next Lifecycle Stage</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
