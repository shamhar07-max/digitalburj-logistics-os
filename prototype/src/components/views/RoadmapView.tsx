import React from 'react';
import { CheckCircle2, Clock, Calendar, ArrowRight, ShieldCheck, Milestone } from 'lucide-react';

const ROADMAP_STAGES = [
  {
    stage: 'Stage 01',
    title: 'Core Business OS Foundation',
    status: 'completed',
    period: 'Q3 2026',
    desc: 'Multi-branch identity, role permissions, master data, CRM pipelines, sales quotation, basic double-entry accounting ledger.',
  },
  {
    stage: 'Stage 02',
    title: 'UAE Finance, VAT & eInvoicing (ASP)',
    status: 'completed',
    period: 'Q4 2026',
    desc: 'UAE 5% VAT engine, TRN master validation, accredited ASP Peppol PINT-AE XML transmission bridge, bank feed reconciliation.',
  },
  {
    stage: 'Stage 03',
    title: 'People & WPS Payroll',
    status: 'completed',
    period: 'Q4 2026',
    desc: 'HRMS employee master, visa/Emirates ID expiration alerts, MOHRE WPS payroll SIF file generation, end-of-service gratuity.',
  },
  {
    stage: 'Stage 04',
    title: 'Operations & Multi-Modal Execution',
    status: 'in_progress',
    period: 'Q1 2027',
    desc: 'Sea FCL/LCL container tracking, terminal demurrage clocks, Air MAWB/HAWB, GCC cross-border road trucking, driver mobile signature app.',
  },
  {
    stage: 'Stage 05',
    title: 'Automation & Omnichannel WhatsApp',
    status: 'in_progress',
    period: 'Q1 2027',
    desc: '18 auditable business rules, dry-run simulation, kill switches, first-class WhatsApp conversational quoting and milestone pushes.',
  },
  {
    stage: 'Stage 06',
    title: '8 Coordinated AI Copilots',
    status: 'in_progress',
    period: 'Q2 2027',
    desc: 'AI Document Intelligence (BL/AWB OCR), AI Executive brief, Margin Coach, Demurrage risk predictor, AI Finance discrepancy hunter.',
  },
  {
    stage: 'Stage 07',
    title: 'Industry Sector Expansions',
    status: 'planned',
    period: 'Q3 2027',
    desc: 'Logistics (live), B2B Trading & Distribution, Travel & Tourism corporate modules sharing identical core data model.',
  },
  {
    stage: 'Stage 08',
    title: 'Growth Platform (Studio & Reach)',
    status: 'planned',
    period: 'Q3 2027',
    desc: 'DigitalBurj Studio website builder, automated SEO/AEO/GEO freight lane landing pages, WhatsApp Business product catalogs.',
  },
  {
    stage: 'Stage 09',
    title: 'Heavy Industry Verticals',
    status: 'planned',
    period: 'Q4 2027',
    desc: 'Real Estate facilities, Construction project billing, Retail franchise distribution.',
  },
  {
    stage: 'Stage 10',
    title: 'GCC Regional Localization',
    status: 'planned',
    period: 'Q1 2028',
    desc: 'Saudi Arabia ZATCA Phase 2 eInvoicing, Oman Tax Authority compliance, Bahrain, Qatar & Kuwait cross-border corridors.',
  },
];

export const RoadmapView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Strategic Execution</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              10-Stage Phased Rollout
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Execution Roadmap & Milestones</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Recommended sequence from core Business OS through UAE compliance, automation, 8 AI agents, to full GCC regional expansion.
          </p>
        </div>
      </div>

      {/* Roadmap Timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {ROADMAP_STAGES.map((s, idx) => (
            <div key={idx} className="relative">
              {/* Dot */}
              <div
                className={`absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  s.status === 'completed'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : s.status === 'in_progress'
                    ? 'border-[#E8472B] bg-[#E8472B] text-white ring-4 ring-[#E8472B]/20'
                    : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {s.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : s.status === 'in_progress' ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </div>

              {/* Stage Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5 transition hover:bg-white hover:border-[#E8472B]/50 hover:shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#E8472B]">{s.stage}</span>
                    <h3 className="font-extrabold text-sm text-slate-900">{s.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">{s.period}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        s.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'in_progress'
                          ? 'bg-[#E8472B]/10 text-[#E8472B]'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
