import React from 'react';
import { Compass, ShieldCheck, Zap, Lock, Clock, ArrowRight } from 'lucide-react';
import { CRITICAL_GAPS } from '../../data/mockData';

export const NineGapsView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Strategic Moat</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Unmet Market Opportunities
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">The 9 Critical Market Gaps</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            What every incumbent misses — and why each represents an unfair, defensible structural advantage for DigitalBurj.
          </p>
        </div>
      </div>

      {/* Grid of the 9 Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CRITICAL_GAPS.map((gap) => (
          <div
            key={gap.number}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#E8472B] hover:shadow-md transition"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#09192D] text-white font-mono font-black text-xs">
                  {gap.number}
                </span>
                <span className="rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-bold border border-purple-200">
                  {gap.timeToCopyMonths} Mo. Replication Time
                </span>
              </div>

              <h3 className="font-extrabold text-sm text-slate-950 leading-snug">{gap.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{gap.description}</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Strategic Verdict</span>
              </div>
              <p className="text-[11px] leading-relaxed">{gap.verdict}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
