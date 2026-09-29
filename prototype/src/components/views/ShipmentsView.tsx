import React, { useState } from 'react';
import {
  Ship,
  Plane,
  Truck,
  Filter,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Shipment, TransportMode, RoleType } from '../../types';

interface ShipmentsViewProps {
  shipments: Shipment[];
  onSelectShipment: (shipment: Shipment) => void;
  onOpenNewModal: () => void;
  currentRole: RoleType;
  onOpenAutomatedDocs?: (shipment: Shipment) => void;
}

export const ShipmentsView: React.FC<ShipmentsViewProps> = ({
  shipments,
  onSelectShipment,
  onOpenNewModal,
  currentRole,
  onOpenAutomatedDocs,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const canSeeBuyCost = currentRole === 'owner' || currentRole === 'finance' || currentRole === 'manager';

  const filtered = shipments.filter((s) => {
    const matchesFilter =
      selectedFilter === 'all'
        ? true
        : selectedFilter === 'risk'
        ? s.health === 'risk' || s.status === 'customs_hold'
        : selectedFilter === 'billing_ready'
        ? s.status === 'billing_ready'
        : s.mode.toLowerCase().includes(selectedFilter);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      s.jobNo.toLowerCase().includes(q) ||
      s.customer.toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      s.containerOrAwb.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Control Tower</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              Multi-Modal Execution
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Multi-Modal Shipments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time milestone tracking, terminal demurrage countdown, mode-specific fields, and predictive SLA alerts.
          </p>
        </div>

        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Shipment Booking</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: 'all', label: `All (${shipments.length})` },
            { id: 'risk', label: 'At-Risk & Holds (2)' },
            { id: 'billing_ready', label: 'Ready to Bill (1)' },
            { id: 'sea', label: 'Sea FCL / LCL' },
            { id: 'air', label: 'Airfreight' },
            { id: 'road', label: 'GCC Road Fleet' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 transition ${
                selectedFilter === tab.id
                  ? 'bg-[#09192D] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search job, container, customer..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-[#E8472B] focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Shipments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3.5">Job / Mode</th>
              <th className="p-3.5">Customer & Shipper</th>
              <th className="p-3.5">Lane & Ports</th>
              <th className="p-3.5">ETA / Free Time</th>
              <th className="p-3.5">Progress / Status</th>
              <th className="p-3.5 text-right">Revenue</th>
              {canSeeBuyCost && <th className="p-3.5 text-right">Margin %</th>}
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => onSelectShipment(s)}
                className="hover:bg-slate-50/80 transition cursor-pointer"
              >
                {/* Job & Mode */}
                <td className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        s.mode.includes('Sea')
                          ? 'bg-blue-50 text-blue-700'
                          : s.mode === 'Air'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {s.mode.includes('Sea') ? <Ship className="h-4 w-4" /> : s.mode === 'Air' ? <Plane className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-mono font-bold text-slate-900">{s.jobNo}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{s.mode}</div>
                    </div>
                  </div>
                </td>

                {/* Customer */}
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">{s.customer}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{s.containerOrAwb}</div>
                </td>

                {/* Lane */}
                <td className="p-3.5">
                  <div className="font-semibold text-slate-800">{s.originPortCode} → {s.destPortCode}</div>
                  <div className="text-[10px] text-slate-500">{s.service}</div>
                </td>

                {/* ETA / Free Time */}
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">{s.eta}</div>
                  <div className={`text-[10px] font-medium ${s.freeTimeEnds.includes('left') || s.freeTimeEnds.includes('Exceeded') ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                    {s.freeTimeEnds}
                  </div>
                </td>

                {/* Status & Health */}
                <td className="p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        s.status === 'customs_hold'
                          ? 'bg-rose-100 text-rose-800'
                          : s.status === 'billing_ready'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        s.health === 'risk' ? 'bg-rose-500' : s.health === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    ></span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.health === 'risk' ? 'bg-rose-500' : 'bg-[#E8472B]'}`}
                      style={{ width: `${s.progressPercent}%` }}
                    ></div>
                  </div>
                </td>

                {/* Revenue */}
                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                  AED {s.revenue.toLocaleString()}
                </td>

                {/* Margin % (Protected) */}
                {canSeeBuyCost && (
                  <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                    {s.margin}%
                  </td>
                )}

                {/* Action */}
                <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                  {onOpenAutomatedDocs && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAutomatedDocs(s);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-bold text-[#E8472B] hover:bg-[#E8472B] hover:text-white transition shadow-2xs"
                      title="View Automated HBL, Packing List & Commercial Invoice"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Docs</span>
                    </button>
                  )}
                  <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-[#E8472B] hover:text-white transition">
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
