import React, { useState } from 'react';
import {
  Award,
  Search,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  TrendingDown,
  Building,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { COMPETITORS_LIST } from '../../data/mockData';
import { CompetitorProfile } from '../../types';
import { D3CompetitorVolumeChart } from '../charts/D3CompetitorVolumeChart';

interface CompetitorAtlasViewProps {
  onSelectCompetitor: (competitor: CompetitorProfile) => void;
  onNavigateToMatrix: () => void;
}

export const CompetitorAtlasView: React.FC<CompetitorAtlasViewProps> = ({
  onSelectCompetitor,
  onNavigateToMatrix,
}) => {
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = COMPETITORS_LIST.filter((comp) => {
    const matchesTier = selectedTier === 'all' || comp.tier === selectedTier;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      comp.name.toLowerCase().includes(q) ||
      comp.hq.toLowerCase().includes(q) ||
      comp.description.toLowerCase().includes(q) ||
      comp.criticalGap.toLowerCase().includes(q);

    return matchesTier && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Competitive Intelligence</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              25+ Global & Regional Players Analysed
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Competitor Benchmark Atlas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive audit across global enterprise suites, mid-market SaaS, UAE local ERPs, and India-based platforms.
          </p>
        </div>

        <button
          onClick={onNavigateToMatrix}
          className="flex items-center gap-1.5 rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
        >
          <span>Open 60+ Feature Matrix →</span>
        </button>
      </div>

      {/* D3 Data Visualization Panel: Volume & Efficiency Share */}
      <D3CompetitorVolumeChart />

      {/* Tier Filter Bar & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: 'all', label: `All Players (${COMPETITORS_LIST.length})` },
            { id: 'enterprise', label: 'Tier 1: Global Enterprise' },
            { id: 'midmarket', label: 'Tier 2: Global Mid-Market' },
            { id: 'uae', label: 'Tier 3: UAE Local Incumbents' },
            { id: 'india', label: 'Tier 4: India-Based & GCC' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTier(tab.id)}
              className={`rounded-lg px-3 py-1.5 transition ${
                selectedTier === tab.id
                  ? 'bg-[#E8472B] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search competitor, HQ, feature..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-[#E8472B] focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Competitors Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((comp) => (
          <div
            key={comp.id}
            onClick={() => onSelectCompetitor(comp)}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#E8472B] hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-[#C98B53] font-bold text-xs">
                    {comp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-950 group-hover:text-[#E8472B] transition">
                      {comp.name}
                    </h3>
                    <div className="text-[10.5px] text-slate-400">{comp.hq}</div>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    comp.tier === 'enterprise'
                      ? 'bg-purple-100 text-purple-800'
                      : comp.tier === 'midmarket'
                      ? 'bg-blue-100 text-blue-800'
                      : comp.tier === 'uae'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {comp.tierLabel}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                {comp.description}
              </p>

              {/* The Critical Gap Box */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-950">
                <div className="flex items-center gap-1 font-bold text-[10.5px] text-rose-800 mb-0.5 uppercase tracking-wider">
                  <ShieldAlert className="h-3 w-3 text-rose-600 shrink-0" />
                  <span>The Critical Gap</span>
                </div>
                <p className="text-[11px] line-clamp-3 leading-snug">{comp.criticalGap}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Pricing: {comp.pricingModel}</span>
              <span className="font-bold text-[#E8472B] flex items-center gap-0.5 text-[11px]">
                Dossier <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
