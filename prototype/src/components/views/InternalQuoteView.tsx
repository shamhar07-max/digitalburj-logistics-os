import React, { useState } from 'react';
import {
  FileText,
  Calculator,
  Plus,
  Ship,
  Plane,
  Truck,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Check,
  DollarSign,
  TrendingUp,
  Percent,
  Trash2,
  Share2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { InternalQuotation, TransportMode } from '../../types';
import { INITIAL_INTERNAL_QUOTES } from '../../data/mockData';

interface InternalQuoteViewProps {
  onConvertToCustomerQuote?: (internalQuote: InternalQuotation) => void;
}

export const InternalQuoteView: React.FC<InternalQuoteViewProps> = ({
  onConvertToCustomerQuote,
}) => {
  const [internalQuotes, setInternalQuotes] = useState<InternalQuotation[]>(INITIAL_INTERNAL_QUOTES);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedQuoteDetail, setSelectedQuoteDetail] = useState<InternalQuotation | null>(INITIAL_INTERNAL_QUOTES[0]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Builder Form State
  const [customerName, setCustomerName] = useState('Al Habtoor Motors LLC');
  const [lane, setLane] = useState('Ningbo (CNNBO) → Jebel Ali (AEJEA)');
  const [mode, setMode] = useState<TransportMode>('Sea FCL');
  const [commodity, setCommodity] = useState('Commercial Vehicle Spare Parts');
  const [equipment, setEquipment] = useState('2 × 40HC Containers');

  // Carrier Options
  const [carrierA, setCarrierA] = useState('Maersk Line A/S');
  const [carrierABuy, setCarrierABuy] = useState(19500);
  const [carrierASell, setCarrierASell] = useState(25400);
  const [carrierATransit, setCarrierATransit] = useState(18);
  const [carrierAFreeDays, setCarrierAFreeDays] = useState(14);

  // Cost items state
  const [costItems, setCostItems] = useState([
    { itemCode: 'OCN-BASE', description: 'Ocean Base Freight (2 x 40HC)', vendorOrAuthority: 'Maersk Line', unitBuy: 9750, unitSell: 12700, quantity: 2 },
    { itemCode: 'THC-DEST', description: 'Destination Terminal Handling (JEA)', vendorOrAuthority: 'DP World', unitBuy: 1250, unitSell: 1650, quantity: 2 },
    { itemCode: 'MIRSAL-DEC', description: 'Mirsal II Customs Declaration Filing', vendorOrAuthority: 'Broker Desk', unitBuy: 400, unitSell: 850, quantity: 1 },
    { itemCode: 'CARTAGE', description: 'Local Haulage to DIP Facility', vendorOrAuthority: 'GCC Falcon Haulage', unitBuy: 1100, unitSell: 1600, quantity: 2 },
  ]);

  const totalBuy = costItems.reduce((sum, item) => sum + item.unitBuy * item.quantity, 0);
  const totalSell = costItems.reduce((sum, item) => sum + item.unitSell * item.quantity, 0);
  const grossProfit = totalSell - totalBuy;
  const marginPct = totalSell > 0 ? Math.round((grossProfit / totalSell) * 1000) / 10 : 0;
  const isBelowFloor = marginPct < 18.0;

  const handleCreateInternalQuote = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedCostBreakdown = costItems.map((item) => {
      const tb = item.unitBuy * item.quantity;
      const ts = item.unitSell * item.quantity;
      return {
        ...item,
        totalBuy: tb,
        totalSell: ts,
        profit: ts - tb,
      };
    });

    const newInternalQuote: InternalQuotation = {
      id: `int-q-${Date.now()}`,
      internalRef: `INT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName,
      lane,
      mode,
      commodity,
      equipmentOrWeight: equipment,
      carrierOptions: [
        {
          carrierName: carrierA,
          transitDays: Number(carrierATransit),
          freeDaysAtPort: Number(carrierAFreeDays),
          buyRate: totalBuy,
          sellRate: totalSell,
          marginPct: marginPct,
          selected: true,
        },
      ],
      costBreakdown: formattedCostBreakdown,
      totalBuyCost: totalBuy,
      totalSellPrice: totalSell,
      grossProfit,
      marginPercent: marginPct,
      belowFloor: isBelowFloor,
      approvalStatus: isBelowFloor ? 'pending_approval' : 'approved',
      preparedBy: 'Sara Menon (Commercial Pricing)',
      validUntil: '14 days from today',
    };

    setInternalQuotes([newInternalQuote, ...internalQuotes]);
    setSelectedQuoteDetail(newInternalQuote);
    setShowBuilder(false);
    setSuccessToast(`Internal Tariff Cost Sheet ${newInternalQuote.internalRef} created successfully!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleAddItem = () => {
    setCostItems([
      ...costItems,
      {
        itemCode: 'MISC-SUR',
        description: 'Bunker / Surcharge Line',
        vendorOrAuthority: 'Carrier Line',
        unitBuy: 350,
        unitSell: 550,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setCostItems(costItems.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Commercial Pricing Desk · Internal Tariff Costing
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              Carrier Spot Breakdown
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Internal Quotation & Carrier Cost Sheets
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Build carrier spot tariffs, itemize buy rates vs sell rates, calculate gross profit margins, and lock internal approvals before issuing customer quotes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>{showBuilder ? 'Cancel Builder' : 'New Internal Quotation'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Interactive Builder Form */}
      {showBuilder && (
        <form onSubmit={handleCreateInternalQuote} className="rounded-3xl border-2 border-[#E8472B]/30 bg-white p-6 shadow-xl space-y-6 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#E8472B]" />
              <h3 className="font-black text-sm text-slate-900">
                Internal Freight Costing & Margin Sheet Builder
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              DigitalBurj Margin Floor: 18.0%
            </span>
          </div>

          {/* Customer & Route Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Customer / Shipper Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-900 font-bold focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Trade Lane (Port of Loading → Discharge)</label>
              <input
                type="text"
                required
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Equipment / Volume</label>
              <input
                type="text"
                required
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Carrier benchmark & Port Free Days */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <div className="font-extrabold text-slate-900 flex items-center justify-between">
              <span>Primary Shipping Line / Carrier Benchmark</span>
              <span className="text-[11px] text-slate-500 font-normal">Free port storage days prevent demurrage</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Carrier Name</label>
                <input
                  type="text"
                  value={carrierA}
                  onChange={(e) => setCarrierA(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 font-semibold text-slate-800 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Transit Time (Days)</label>
                <input
                  type="number"
                  value={carrierATransit}
                  onChange={(e) => setCarrierATransit(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 font-bold font-mono text-slate-800 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Free Days at Destination Port</label>
                <input
                  type="number"
                  value={carrierAFreeDays}
                  onChange={(e) => setCarrierAFreeDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 font-bold font-mono text-slate-800 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Commodity Classification</label>
                <input
                  type="text"
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Itemized Cost Sheet Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Itemized Cost & Revenue Lines</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                <Plus className="h-3 w-3" />
                <span>Add Charge Line</span>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                  <tr>
                    <th className="p-3">Charge Description</th>
                    <th className="p-3">Vendor / Authority</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Unit Buy (AED)</th>
                    <th className="p-3">Unit Sell (AED)</th>
                    <th className="p-3">Total Buy</th>
                    <th className="p-3">Total Sell</th>
                    <th className="p-3">Profit</th>
                    <th className="p-3 text-right">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costItems.map((item, idx) => {
                    const rowBuy = item.unitBuy * item.quantity;
                    const rowSell = item.unitSell * item.quantity;
                    const rowProfit = rowSell - rowBuy;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...costItems];
                              updated[idx].description = e.target.value;
                              setCostItems(updated);
                            }}
                            className="w-full bg-transparent font-medium text-slate-800 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.vendorOrAuthority}
                            onChange={(e) => {
                              const updated = [...costItems];
                              updated[idx].vendorOrAuthority = e.target.value;
                              setCostItems(updated);
                            }}
                            className="w-full bg-transparent text-slate-600 focus:outline-hidden"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...costItems];
                              updated[idx].quantity = Math.max(1, Number(e.target.value));
                              setCostItems(updated);
                            }}
                            className="w-12 rounded border border-slate-200 p-1 text-center font-mono"
                          />
                        </td>
                        <td className="p-3 font-mono">
                          <input
                            type="number"
                            value={item.unitBuy}
                            onChange={(e) => {
                              const updated = [...costItems];
                              updated[idx].unitBuy = Number(e.target.value);
                              setCostItems(updated);
                            }}
                            className="w-20 rounded border border-slate-200 p-1 font-mono text-slate-700"
                          />
                        </td>
                        <td className="p-3 font-mono">
                          <input
                            type="number"
                            value={item.unitSell}
                            onChange={(e) => {
                              const updated = [...costItems];
                              updated[idx].unitSell = Number(e.target.value);
                              setCostItems(updated);
                            }}
                            className="w-20 rounded border border-slate-200 p-1 font-mono font-bold text-slate-900"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-500">AED {rowBuy.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">AED {rowSell.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">+AED {rowProfit.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                  <tr>
                    <td colSpan={5} className="p-3 font-black text-slate-900">
                      Total Internal Tariff Calculation:
                    </td>
                    <td className="p-3 font-mono text-slate-600">AED {totalBuy.toLocaleString()}</td>
                    <td className="p-3 font-mono font-black text-slate-950">AED {totalSell.toLocaleString()}</td>
                    <td colSpan={2} className="p-3 font-mono font-black text-emerald-700">
                      +AED {grossProfit.toLocaleString()} ({marginPct}%)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Live Margin Guardrail Feedback */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                isBelowFloor ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {isBelowFloor ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  Target Profit Margin: <span className="font-mono text-base">{marginPct}%</span>
                </div>
                <div className="text-slate-500">
                  {isBelowFloor
                    ? '⚠️ Below 18.0% floor — saving will trigger supervisor approval in manager queue.'
                    : '✓ Within authorized commercial corridor. Can be converted to customer quote immediately.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Save Internal Quotation</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Internal Quotes List & Cost Sheet Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Saved Internal Cost Sheets ({internalQuotes.length})
          </div>

          {internalQuotes.map((q) => {
            const isSelected = selectedQuoteDetail?.id === q.id;

            return (
              <div
                key={q.id}
                onClick={() => setSelectedQuoteDetail(q)}
                className={`rounded-2xl border p-4 shadow-2xs transition cursor-pointer space-y-2 ${
                  isSelected
                    ? 'border-[#E8472B] bg-orange-50/20 ring-2 ring-[#E8472B]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {q.internalRef}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      q.approvalStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {q.approvalStatus === 'approved' ? 'APPROVED' : 'NEEDS SIGN-OFF'}
                  </span>
                </div>

                <div className="font-bold text-sm text-slate-900">{q.customerName}</div>
                <div className="text-xs text-slate-500">{q.lane}</div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-mono">
                  <span className="text-slate-500">Sell: AED {q.totalSellPrice.toLocaleString()}</span>
                  <span className="font-bold text-emerald-700">Margin: {q.marginPercent}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail Sheet */}
        {selectedQuoteDetail && (
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                    {selectedQuoteDetail.internalRef}
                  </span>
                  <span className="text-xs font-bold text-slate-400">· Prepared by: {selectedQuoteDetail.preparedBy}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {selectedQuoteDetail.customerName}
                </h2>
                <div className="text-xs text-slate-600 mt-0.5">
                  {selectedQuoteDetail.lane} · {selectedQuoteDetail.equipmentOrWeight}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedQuoteDetail.convertedToQuoteNo ? (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl">
                    Issued as {selectedQuoteDetail.convertedToQuoteNo}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      alert(`Converted ${selectedQuoteDetail.internalRef} to official customer quotation QT-2026-9912. Available in Quotes module!`);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-[#E8472B] transition"
                  >
                    <span>Generate Customer Quote</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Carrier Options Evaluated */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Carrier Quotation Comparison
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {selectedQuoteDetail.carrierOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-3.5 space-y-1.5 ${
                      opt.selected
                        ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-300'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{opt.carrierName}</span>
                      {opt.selected && (
                        <span className="text-[9.5px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Transit: {opt.transitDays} Days · Free Port Days: {opt.freeDaysAtPort}
                    </div>
                    <div className="flex items-center justify-between font-mono pt-1 text-[11px]">
                      <span>Buy: AED {opt.buyRate.toLocaleString()}</span>
                      <span className="font-bold text-emerald-700">Profit: {opt.marginPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Itemized Charges Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Itemized Tariffs & Internal Direct Costs
              </span>
              <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                    <tr>
                      <th className="p-3">Cost Item</th>
                      <th className="p-3">Vendor / Authority</th>
                      <th className="p-3">Buy Cost</th>
                      <th className="p-3">Sell Price</th>
                      <th className="p-3 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedQuoteDetail.costBreakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">{item.description}</td>
                        <td className="p-3 text-slate-500">{item.vendorOrAuthority}</td>
                        <td className="p-3 font-mono text-slate-600">AED {item.totalBuy.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">AED {item.totalSell.toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 text-right">
                          +AED {item.profit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={2} className="p-3 font-black text-slate-900">Total Calculation:</td>
                      <td className="p-3 font-mono text-slate-600">AED {selectedQuoteDetail.totalBuyCost.toLocaleString()}</td>
                      <td className="p-3 font-mono font-black text-slate-950">AED {selectedQuoteDetail.totalSellPrice.toLocaleString()}</td>
                      <td className="p-3 font-mono font-black text-emerald-700 text-right">
                        +AED {selectedQuoteDetail.grossProfit.toLocaleString()} ({selectedQuoteDetail.marginPercent}%)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
