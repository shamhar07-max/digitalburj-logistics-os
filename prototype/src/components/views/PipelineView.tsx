import React, { useState } from 'react';
import { TrendingUp, Plus, DollarSign, Calendar, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Deal } from '../../types';
import { INITIAL_DEALS } from '../../data/mockData';

interface PipelineViewProps {
  onOpenNewQuote: () => void;
  onOpenNewLead?: () => void;
}

const STAGES = [
  { id: 'lead', label: 'Inbound Lead', color: 'border-slate-300' },
  { id: 'qualified', label: 'Qualified', color: 'border-blue-400' },
  { id: 'rfq', label: 'RFQ Received', color: 'border-purple-400' },
  { id: 'proposal', label: 'Quote Proposal', color: 'border-amber-400' },
  { id: 'negotiation', label: 'Negotiation', color: 'border-orange-400' },
  { id: 'won', label: 'Won & Booked', color: 'border-emerald-500' },
];

export const PipelineView: React.FC<PipelineViewProps> = ({ onOpenNewQuote, onOpenNewLead }) => {
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);

  const totalPipelineValue = deals.filter((d) => d.stage !== 'lost').reduce((acc, d) => acc + d.value, 0);

  const moveDeal = (dealId: string, direction: 'next' | 'prev') => {
    const stageOrder: Deal['stage'][] = ['lead', 'qualified', 'rfq', 'proposal', 'negotiation', 'won'];
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const currentIndex = stageOrder.indexOf(d.stage);
        const newIndex = direction === 'next' ? Math.min(currentIndex + 1, stageOrder.length - 1) : Math.max(currentIndex - 1, 0);
        return { ...d, stage: stageOrder[newIndex] };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Commercial Workspace</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              Interactive Kanban
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Sales Pipeline & RFQs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Click to advance opportunities through freight qualification stages. Real-time weighted value and stage tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-2xs text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Pipeline</span>
            <span className="font-mono text-base font-extrabold text-slate-950">AED {totalPipelineValue.toLocaleString()}</span>
          </div>
          {onOpenNewLead && (
            <button
              onClick={onOpenNewLead}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Plus className="h-4 w-4 text-emerald-600" />
              <span>Log Inbound Lead</span>
            </button>
          )}
          <button
            onClick={onOpenNewQuote}
            className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Quote</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
        {STAGES.map((st) => {
          const stageDeals = deals.filter((d) => d.stage === st.id);
          const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div
              key={st.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-slate-100/70 p-3 min-w-[210px] min-h-[500px]"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-xs">
                <div>
                  <h4 className="font-extrabold text-slate-900">{st.label}</h4>
                  <span className="font-mono text-[10.5px] font-bold text-slate-500">AED {(stageTotal / 1000).toFixed(0)}K</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[10.5px] text-slate-700 shadow-2xs">
                  {stageDeals.length}
                </span>
              </div>

              {/* Cards in Column */}
              <div className="space-y-2.5 flex-1">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-[#E8472B] hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-[#E8472B] uppercase">{deal.mode}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 font-bold ${
                          deal.priority === 'hot'
                            ? 'bg-rose-100 text-rose-800'
                            : deal.priority === 'warm'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {deal.priority.toUpperCase()}
                      </span>
                    </div>

                    <h5 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">{deal.title}</h5>
                    <div className="text-[11px] text-slate-500 mt-1">{deal.customer}</div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="font-mono font-extrabold text-slate-950">AED {deal.value.toLocaleString()}</span>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Calendar className="h-3 w-3" />
                        <span>{deal.closesDate.slice(0, 6)}</span>
                      </div>
                    </div>

                    {/* Quick Move Trigger buttons */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                      {deal.stage !== 'lead' ? (
                        <button
                          onClick={() => moveDeal(deal.id, 'prev')}
                          className="font-bold text-slate-500 hover:text-slate-800"
                        >
                          ← Prev
                        </button>
                      ) : (
                        <span></span>
                      )}

                      {deal.stage !== 'won' ? (
                        <button
                          onClick={() => moveDeal(deal.id, 'next')}
                          className="font-bold text-[#E8472B] hover:underline flex items-center gap-0.5"
                        >
                          <span>Advance</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      ) : (
                        <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Won
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No active deals in stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
