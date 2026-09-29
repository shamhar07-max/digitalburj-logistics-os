import React, { useState } from 'react';
import { Building2, Ship, Download, FileText, Share2, CheckCircle2, Clock, Send, Eye } from 'lucide-react';
import { INITIAL_SHIPMENTS } from '../../data/mockData';

export const CustomerPortalView: React.FC = () => {
  const [copiedLink, setCopiedLink] = useState(false);
  const sampleTrackingUrl = 'https://db-track.ae/s/DB-1048?token=ae9481b7a2';
  const customerShipments = INITIAL_SHIPMENTS.filter((s) => s.customer.includes('Al Faris'));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sampleTrackingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Client Experience</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              White-Label Customer Portal
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">External Shipper Portal Preview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            This is the branded self-service portal your customers access to track containers, download verified documents, and view VAT invoices without calling dispatch.
          </p>
        </div>

        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
        >
          <Share2 className="h-4 w-4 text-[#E8472B]" />
          <span>{copiedLink ? '✓ Tracking Link Copied!' : 'Copy Public Tracking Link'}</span>
        </button>
      </div>

      {/* Customer Portal Simulated Frame */}
      <div className="rounded-3xl border border-slate-300 bg-white shadow-xl overflow-hidden">
        {/* Portal Top Bar */}
        <div className="bg-[#09192D] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8472B] font-bold text-white text-sm">
              AF
            </div>
            <div>
              <div className="font-extrabold text-base">Al Faris Trading LLC — Shipper Hub</div>
              <div className="text-[11px] text-slate-400">Account Ref: AF-DUBAI-88 · TRN: 100234567800003</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold">
              Account in Good Standing
            </span>
          </div>
        </div>

        {/* Portal Body Content */}
        <div className="p-6 space-y-6 bg-slate-50/50">
          {/* Active Shipments Cards */}
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 mb-3">Your In-Transit Shipments</h3>
            <div className="space-y-3">
              {customerShipments.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                        <Ship className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-xs text-slate-900">{s.jobNo} · {s.containerOrAwb}</div>
                        <div className="text-[11px] text-slate-400">{s.origin} → {s.destination}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          s.status === 'customs_hold' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold text-slate-700">ETA: {s.eta}</span>
                    </div>
                  </div>

                  {/* Public Milestone Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-1">
                    {s.milestones.slice(0, 4).map((m, i) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 space-y-0.5">
                        <div className="flex items-center gap-1 font-bold text-[11px] text-slate-800">
                          {m.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                          <span>{m.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{m.timestamp} · {m.location}</div>
                      </div>
                    ))}
                  </div>

                  {/* Document Download Strip */}
                  <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Verified Commercial Documents Available:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => alert('Downloading verified Bill of Lading MAEU2291847.pdf')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        <span>B/L Copy</span>
                      </button>
                      <button
                        onClick={() => alert('Downloading verified Tax Invoice INV-2026-3389.pdf with FTA QR Code')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        <span>Tax Invoice (VAT)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Differentiator Callout Box */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-950">
            <strong>Security & Privacy Guardrail:</strong> External customers authenticated into this portal can only see their own company records. Internal carrier buy rates, gross margins, supplier costs, and other customer data are strictly quarantined and never enter the API payload.
          </div>
        </div>
      </div>
    </div>
  );
};
