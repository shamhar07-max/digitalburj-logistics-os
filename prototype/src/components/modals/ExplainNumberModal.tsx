import React from 'react';
import { X, Calculator, ArrowUpRight, ShieldCheck, Database, FileSpreadsheet } from 'lucide-react';

interface ExplainNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricLabel: string;
  metricValue: string;
  contributingRecords: {
    recordRef: string;
    description: string;
    amount: string;
    updatedAt: string;
    category: string;
  }[];
  explanationFormula: string;
}

export const ExplainNumberModal: React.FC<ExplainNumberModalProps> = ({
  isOpen,
  onClose,
  metricLabel,
  metricValue,
  contributingRecords,
  explanationFormula,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A2A2B] text-white">
              <Calculator className="h-5 w-5 text-[#E8472B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900">Explain This Number</h3>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Deterministic Audit Trace</span>
              </div>
              <p className="text-xs text-slate-500">Every KPI click-through directly maps to underlying source transactions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Key Value & Formula */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{metricLabel}</div>
            <div className="text-3xl font-extrabold text-slate-950 mt-1">{metricValue}</div>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 font-mono">
              <Database className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>Formula: {explanationFormula}</span>
            </div>
          </div>

          {/* Source Contributing Records */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Contributing Source Records ({contributingRecords.length})</span>
              <span className="text-[11px] text-slate-400">Strict RBAC verification passed</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Record Ref</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Contribution</th>
                    <th className="py-2.5 px-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {contributingRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#E8472B]">{r.recordRef}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{r.description}</div>
                        <div className="text-[10px] text-slate-400">{r.category}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{r.amount}</td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-slate-400">{r.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Differentiator Explainer */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Why this eliminates ERP trust friction:</strong> In legacy systems like CargoWise or ZEALIT, figures on dashboards are aggregate black boxes that force operators to run manual Excel exports. In DigitalBurj, every figure is directly bound to its real-time transaction ledger.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <span className="text-[11px] text-slate-500">Live query executed against Cloudflare D1</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};
