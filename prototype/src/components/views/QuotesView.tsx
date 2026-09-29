import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Send,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Download,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Quote, Shipment } from '../../types';

interface QuotesViewProps {
  quotes: Quote[];
  onOpenNewQuote: () => void;
  onConvertQuoteToShipment: (quote: Quote) => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quotes,
  onOpenNewQuote,
  onConvertQuoteToShipment,
}) => {
  const [selectedQuote, setSelectedQuote] = useState<Quote>(quotes[0]);

  const handleConvert = (quote: Quote) => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    onConvertQuoteToShipment(quote);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Commercial Pricing</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Margin Coach Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Quotations & Margin Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-modal rate calculation with automated margin floor compliance, WhatsApp templates, and one-click execution conversion.
          </p>
        </div>

        <button
          onClick={onOpenNewQuote}
          className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Multi-Modal Quote</span>
        </button>
      </div>

      {/* Margin Coach Feature Spotlight Banner */}
      <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50/50 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-700" />
              <span className="font-extrabold text-xs uppercase tracking-wider text-amber-900">
                DigitalBurj Proprietary Feature: Margin Coach
              </span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed max-w-2xl">
              Unlike legacy ERPs that simply refuse below-floor quotes, DigitalBurj analyzes 20+ comparable past bids on the exact lane, compares win rates, and proposes optimal sell pricing to protect owner profitability while closing the deal.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl bg-white px-3 py-2 border border-amber-200 text-center shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Company Floor</span>
              <span className="text-base font-black text-amber-700 font-mono">18.0%</span>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 border border-amber-200 text-center shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Win Margin</span>
              <span className="text-base font-black text-emerald-700 font-mono">22.4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Quotations Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-bold text-slate-800">
          Recent Quotations ({quotes.length})
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3.5">Quote / Rev</th>
              <th className="p-3.5">Customer & Lane</th>
              <th className="p-3.5">Mode / Equipment</th>
              <th className="p-3.5 text-right">Carrier Buy (AED)</th>
              <th className="p-3.5 text-right">Customer Sell (AED)</th>
              <th className="p-3.5 text-right">Margin %</th>
              <th className="p-3.5">Status / Channel</th>
              <th className="p-3.5 text-right">One-Click Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50 transition">
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  <div>{q.quoteNo}</div>
                  <span className="text-[10px] text-slate-400 font-medium">{q.version}</span>
                </td>
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">{q.customer}</div>
                  <div className="text-[11px] text-slate-500">{q.lane}</div>
                </td>
                <td className="p-3.5">
                  <span className="font-semibold text-slate-800">{q.mode}</span>
                  <div className="text-[10px] text-slate-400">{q.equipment}</div>
                </td>
                <td className="p-3.5 text-right font-mono font-medium text-slate-600">
                  {q.buyCost.toLocaleString()}
                </td>
                <td className="p-3.5 text-right font-mono font-extrabold text-slate-950">
                  {q.sellPrice.toLocaleString()}
                </td>
                <td className="p-3.5 text-right font-mono font-bold">
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      q.marginPercent < q.marginFloorPercent
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {q.marginPercent}%
                  </span>
                </td>
                <td className="p-3.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        q.status === 'accepted' || q.status === 'won'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'needs_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {q.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">via {q.sourceChannel}</span>
                  </div>
                </td>
                <td className="p-3.5 text-right space-x-1.5">
                  {q.status === 'needs_approval' ? (
                    <button
                      onClick={() => alert(`One-click approval requested for Quote ${q.quoteNo} with Margin Coach justification.`)}
                      className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition"
                    >
                      Request Approval
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConvert(q)}
                      className="rounded-lg bg-[#E8472B] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#D13B20] transition active:scale-95 shadow-2xs"
                    >
                      Convert to Shipment →
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
