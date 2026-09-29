import React from 'react';
import { X, Award, ShieldAlert, CheckCircle2, XCircle, ArrowUpRight, DollarSign } from 'lucide-react';
import { CompetitorProfile } from '../../types';

interface CompetitorDetailModalProps {
  competitor: CompetitorProfile | null;
  onClose: () => void;
}

export const CompetitorDetailModal: React.FC<CompetitorDetailModalProps> = ({ competitor, onClose }) => {
  if (!competitor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#09192D] text-[#C98B53] font-black text-sm">
              {competitor.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg">{competitor.name}</h3>
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                  {competitor.tierLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500">{competitor.hq}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Overview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Architecture & Positioning</h4>
            <p className="text-xs leading-relaxed text-slate-700">{competitor.description}</p>
          </div>

          {/* Pricing Model */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <DollarSign className="h-4 w-4 text-[#E8472B]" />
              <span>Pricing Strategy: {competitor.pricingModel}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{competitor.pricingSummary}</p>
          </div>

          {/* The Critical Gap */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 mb-1">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>The Critical Gap (Why UAE SMEs struggle with them)</span>
            </div>
            <p className="text-xs text-rose-950 leading-relaxed">{competitor.criticalGap}</p>
          </div>

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Their Key Strengths</span>
              </h5>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {competitor.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
              <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-amber-600" />
                <span>Vulnerabilities vs DigitalBurj</span>
              </h5>
              <ul className="space-y-1.5 text-xs text-amber-950">
                {competitor.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Target Profile & Threat Level */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Best Fitted Customer Profile</span>
              <span className="font-semibold text-slate-800">{competitor.bestFor}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Competitive Threat in UAE</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  competitor.threatLevel === 'High'
                    ? 'bg-rose-100 text-rose-800'
                    : competitor.threatLevel === 'Medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {competitor.threatLevel} Threat
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Close Competitive Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
