import React, { useState } from 'react';
import { Layers, Download, Check, X, Minus, Filter, Sparkles } from 'lucide-react';
import { FEATURE_MATRIX_DATA } from '../../data/mockData';
import { MatrixRow } from '../../types';

export const FeatureMatrixView: React.FC = () => {
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const categories = Array.from(new Set(FEATURE_MATRIX_DATA.map((r) => r.category)));

  const filteredRows = FEATURE_MATRIX_DATA.filter((r) => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (showOnlyGaps) {
      // A gap means at least one competitor lacks the feature
      const hasGaps = [
        r.cargoWise,
        r.goFreight,
        r.logitude,
        r.magaya,
        r.shipsy,
        r.newage,
        r.syntrack,
        r.zealit,
        r.logiSys,
        r.fresa,
      ].some((v) => v === 'no' || v === 'partial');
      if (!hasGaps) return false;
    }
    if (searchFilter && !r.feature.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [
      'Category',
      'Feature',
      'CargoWise',
      'GoFreight',
      'Logitude',
      'Magaya',
      'Shipsy',
      'NewageNXT',
      'SynTrack',
      'ZEALIT',
      'Logi-Sys',
      'Fresa Gold',
      'DigitalBurj',
    ];
    const rows = filteredRows.map((r) => [
      `"${r.category}"`,
      `"${r.feature}"`,
      r.cargoWise,
      r.goFreight,
      r.logitude,
      r.magaya,
      r.shipsy,
      r.newage,
      r.syntrack,
      r.zealit,
      r.logiSys,
      r.fresa,
      r.digitalBurj,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'digitalburj_feature_matrix_benchmark.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderBadge = (val: 'yes' | 'partial' | 'no') => {
    if (val === 'yes') {
      return <span className="text-emerald-700 font-extrabold text-sm">✓</span>;
    }
    if (val === 'partial') {
      return <span className="text-amber-700 font-bold text-xs bg-amber-100 px-1 py-0.2 rounded">Partial</span>;
    }
    return <span className="text-rose-600 font-bold text-xs">✕</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Feature Benchmark</span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              60+ Features Mapped
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Universal Feature Matrix</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every operational, regulatory, and intelligence feature compared across 11 market solutions.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
        >
          <Download className="h-4 w-4 text-[#E8472B]" />
          <span>Export Matrix as CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none bg-slate-100 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={showOnlyGaps}
              onChange={(e) => setShowOnlyGaps(e.target.checked)}
              className="accent-[#E8472B] h-4 w-4 rounded"
            />
            <span>Show Only Competitor Gaps</span>
          </label>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 p-1.5 text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter features..."
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-[#E8472B] focus:bg-white focus:outline-hidden w-full md:w-56"
        />
      </div>

      {/* Feature Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs min-w-[950px]">
          <thead className="border-b border-slate-200 bg-[#09192D] text-white text-[10px] font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3 sticky left-0 bg-[#09192D] z-10 min-w-[280px]">Feature & Capability</th>
              <th className="p-3 text-center">CargoWise</th>
              <th className="p-3 text-center">GoFreight</th>
              <th className="p-3 text-center">Logitude</th>
              <th className="p-3 text-center">Magaya</th>
              <th className="p-3 text-center">Shipsy</th>
              <th className="p-3 text-center">NewageNXT</th>
              <th className="p-3 text-center">SynTrack</th>
              <th className="p-3 text-center">ZEALIT</th>
              <th className="p-3 text-center">Logi-Sys</th>
              <th className="p-3 text-center">Fresa</th>
              <th className="p-3 text-center bg-[#E8472B] text-white font-extrabold min-w-[120px]">DigitalBurj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredRows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 transition">
                <td className="p-3 sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {r.isKeyDifferentiator && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E8472B] shrink-0" title="Key Differentiator" />
                    )}
                    <span>{r.feature}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-normal">{r.category}</span>
                </td>
                <td className="p-3 text-center">{renderBadge(r.cargoWise)}</td>
                <td className="p-3 text-center">{renderBadge(r.goFreight)}</td>
                <td className="p-3 text-center">{renderBadge(r.logitude)}</td>
                <td className="p-3 text-center">{renderBadge(r.magaya)}</td>
                <td className="p-3 text-center">{renderBadge(r.shipsy)}</td>
                <td className="p-3 text-center">{renderBadge(r.newage)}</td>
                <td className="p-3 text-center">{renderBadge(r.syntrack)}</td>
                <td className="p-3 text-center">{renderBadge(r.zealit)}</td>
                <td className="p-3 text-center">{renderBadge(r.logiSys)}</td>
                <td className="p-3 text-center">{renderBadge(r.fresa)}</td>
                <td className="p-3 text-center bg-[#E8472B]/10 font-black text-emerald-700 border-l border-[#E8472B]/20">
                  ✓ Full Native
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
