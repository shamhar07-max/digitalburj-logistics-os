import React, { useState } from 'react';
import { Search, X, Ship, FileText, FileCheck2, AlertCircle, ArrowRight, CornerDownLeft } from 'lucide-react';
import { INITIAL_SHIPMENTS, INITIAL_QUOTES, INITIAL_CUSTOMS } from '../../data/mockData';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShipment: (jobNo: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectShipment,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredShipments = INITIAL_SHIPMENTS.filter((s) => {
    const q = query.toLowerCase();
    if (!q) return true;
    if (q.includes('customs') || q.includes('hold') || q.includes('stuck')) {
      return s.status === 'customs_hold' || s.health === 'risk';
    }
    return (
      s.jobNo.toLowerCase().includes(q) ||
      s.customer.toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      s.mode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-16 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 bg-white">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or ask: 'FCL shipments to Jebel Ali stuck in customs'..."
            className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            ESC
          </button>
        </div>

        {/* Query Hints & Natural Language Parser Output */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-purple-700">AI Intent:</span>
            {query.toLowerCase().includes('customs') || query.toLowerCase().includes('hold') ? (
              <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.2 font-mono">mode: Sea FCL · status: customs_hold</span>
            ) : query.length > 0 ? (
              <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.2 font-mono">filter: "{query}" across shipments & parties</span>
            ) : (
              <span>Try natural language queries across the entire UAE forwarding ledger</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">Search shortcuts: Tab to select</span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Matching Active Shipments ({filteredShipments.length})
          </div>
          {filteredShipments.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelectShipment(s.jobNo);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Ship className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{s.jobNo}</span>
                    <span className="font-semibold text-xs text-slate-700">{s.customer}</span>
                    {s.status === 'customs_hold' && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800">Customs Hold</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">{s.origin} → {s.destination} · ETA: {s.eta} · Value: AED {s.revenue.toLocaleString()}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Preset quick queries */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Try asking:</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'FCL shipments to Jebel Ali stuck in customs',
              'Al Faris Trading overdue invoices',
              'Quotes needing margin approval',
              'Driver trips with waiting time',
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setQuery(p)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#E8472B] hover:text-[#E8472B] transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
