import React, { useState } from 'react';
import {
  X,
  Ship,
  Plane,
  Truck,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Search,
  Check,
  DollarSign,
  TrendingUp,
  FileText,
  User,
  ExternalLink,
} from 'lucide-react';
import { Shipment, ApprovalItem, TransportMode } from '../../types';

export type DrilldownMetricType = 'shipments' | 'approvals' | 'unbilled' | 'margin';

interface OperationalDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: DrilldownMetricType;
  shipments: Shipment[];
  approvals: ApprovalItem[];
  onSelectShipment: (shipment: Shipment) => void;
  onApproveItem?: (id: string) => void;
  onNavigateView: (view: any) => void;
}

export const OperationalDrilldownModal: React.FC<OperationalDrilldownModalProps> = ({
  isOpen,
  onClose,
  metricType,
  shipments,
  approvals,
  onSelectShipment,
  onApproveItem,
  onNavigateView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [approvedIds, setApprovedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleQuickApprove = (id: string) => {
    setApprovedIds((prev) => [...prev, id]);
    if (onApproveItem) {
      onApproveItem(id);
    }
  };

  const getModeIcon = (mode: TransportMode) => {
    switch (mode) {
      case 'Sea FCL':
      case 'Sea LCL':
        return <Ship className="h-4 w-4 text-blue-500" />;
      case 'Air':
        return <Plane className="h-4 w-4 text-sky-500" />;
      case 'Road GCC':
        return <Truck className="h-4 w-4 text-emerald-500" />;
      default:
        return <Ship className="h-4 w-4 text-blue-500" />;
    }
  };

  // Filter shipments
  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      s.jobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.containerOrAwb && s.containerOrAwb.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (modeFilter === 'all') return true;
    if (modeFilter === 'fcl') return s.mode === 'Sea FCL';
    if (modeFilter === 'lcl') return s.mode === 'Sea LCL';
    if (modeFilter === 'air') return s.mode === 'Air';
    if (modeFilter === 'road') return s.mode === 'Road GCC';
    if (modeFilter === 'risk') return s.health === 'risk' || s.status === 'customs_hold';

    return true;
  });

  // Filter approvals
  const activeApprovals = approvals.filter((a) => !approvedIds.includes(a.id));
  const filteredApprovals = activeApprovals.filter((a) => {
    const matchesSearch =
      a.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.reason.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (modeFilter === 'all') return true;
    if (modeFilter === 'margin') return a.type === 'Margin Override';
    if (modeFilter === 'customs') return a.type === 'Customs Hold Release';
    if (modeFilter === 'variance') return a.type === 'Vendor Bill Variance';
    if (modeFilter === 'credit') return a.type === 'Credit Limit Increase';

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-[#E8472B]">
              {metricType === 'shipments' && <Ship className="h-5 w-5" />}
              {metricType === 'approvals' && <Clock className="h-5 w-5" />}
              {metricType === 'unbilled' && <DollarSign className="h-5 w-5 text-purple-600" />}
              {metricType === 'margin' && <TrendingUp className="h-5 w-5 text-emerald-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">
                  {metricType === 'shipments' && 'Contributing Records: Active Shipments'}
                  {metricType === 'approvals' && 'Contributing Records: Pending Approvals Queue'}
                  {metricType === 'unbilled' && 'Contributing Records: Completed Unbilled Shipments'}
                  {metricType === 'margin' && 'Contributing Records: Profit Margin by Shipment'}
                </h2>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-extrabold text-slate-700 font-mono">
                  {metricType === 'shipments' && `${filteredShipments.length} Records`}
                  {metricType === 'approvals' && `${filteredApprovals.length} Waiting`}
                  {metricType === 'unbilled' && '1 Shipment (AED 92k)'}
                  {metricType === 'margin' && `${shipments.length} Jobs Evaluated`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Operational transparency view — inspect exactly which live records build up this metric.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="border-b border-slate-100 bg-white p-4 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by job #, customer, city, carrier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8472B]/30"
              />
            </div>

            {/* Quick Filter Tabs */}
            {metricType === 'shipments' && (
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto text-xs">
                {[
                  { id: 'all', label: `All (${shipments.length})` },
                  { id: 'fcl', label: 'Sea FCL' },
                  { id: 'lcl', label: 'Sea LCL' },
                  { id: 'air', label: 'Air' },
                  { id: 'road', label: 'Road GCC' },
                  {
                    id: 'risk',
                    label: `At Risk (${shipments.filter((s) => s.health === 'risk' || s.status === 'customs_hold').length})`,
                    color: 'text-rose-700 border-rose-200 bg-rose-50',
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setModeFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                      modeFilter === f.id
                        ? 'bg-[#E8472B] text-white shadow-2xs'
                        : f.color || 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {metricType === 'approvals' && (
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto text-xs">
                {[
                  { id: 'all', label: `All (${activeApprovals.length})` },
                  { id: 'margin', label: 'Margin' },
                  { id: 'customs', label: 'Customs' },
                  { id: 'variance', label: 'Variance' },
                  { id: 'credit', label: 'Credit' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setModeFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                      modeFilter === f.id
                        ? 'bg-[#E8472B] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body / Records List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* SHIPMENTS DRILLDOWN */}
          {metricType === 'shipments' && (
            <div className="space-y-3">
              {filteredShipments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Ship className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">No shipments matched your search criteria.</p>
                </div>
              ) : (
                filteredShipments.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-[#E8472B]/40 hover:shadow-xs transition"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {s.jobNo}
                        </span>
                        <div className="flex items-center gap-1 font-semibold text-xs text-slate-700">
                          {getModeIcon(s.mode)}
                          <span>{s.mode}</span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.status === 'customs_hold'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : s.status === 'in_transit'
                              ? 'bg-blue-100 text-blue-800'
                              : s.status === 'billing_ready'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {s.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {s.health === 'risk' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Action Required</span>
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-slate-900 text-sm">{s.customer}</div>

                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>
                          {s.origin} → {s.destination}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{s.containerOrAwb || s.piecesWeight}</span>
                        <span>•</span>
                        <span className="text-slate-700 font-medium">ETA: {s.eta}</span>
                      </div>

                      {s.exceptionNotice && (
                        <div className="text-[11px] font-semibold text-rose-700 bg-rose-50/80 p-1.5 rounded-lg border border-rose-100">
                          ⚠️ {s.exceptionNotice}
                        </div>
                      )}
                    </div>

                    {/* Financials & Quick Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-2 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-black font-mono text-slate-900">
                          AED {s.revenue.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          {s.margin}% Gross Profit
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onSelectShipment(s);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#E8472B] transition"
                      >
                        <span>8-Tab Details</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* APPROVALS DRILLDOWN */}
          {metricType === 'approvals' && (
            <div className="space-y-3">
              {filteredApprovals.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  <p className="font-semibold text-sm text-slate-700">All pending items are approved!</p>
                  <p className="text-xs text-slate-400">No requests currently blocking operations.</p>
                </div>
              ) : (
                filteredApprovals.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              item.type === 'Margin Override'
                                ? 'bg-amber-200 text-amber-900'
                                : item.type === 'Customs Hold Release'
                                ? 'bg-rose-200 text-rose-900'
                                : item.type === 'Credit Limit Increase'
                                ? 'bg-blue-200 text-blue-900'
                                : 'bg-purple-200 text-purple-900'
                            }`}
                          >
                            {item.type}
                          </span>
                          <span className="font-mono text-xs font-black text-slate-900">
                            {item.referenceId}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Revision {item.revision}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 text-sm mt-1">
                          {item.amountOrMargin}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.timestamp}
                      </span>
                    </div>

                    <div className="rounded-xl bg-white p-3 border border-amber-100 text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-900">Justification: </span>
                      {item.reason}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-500">
                        Requested by <strong className="text-slate-800">{item.requestedBy}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuickApprove(item.id)}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve Now</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* UNBILLED DRILLDOWN */}
          {metricType === 'unbilled' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded text-xs">
                      DB-1050
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      Emirates Steel Industries PJSC
                    </span>
                  </div>
                  <span className="text-base font-black font-mono text-slate-950">AED 92,000</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  2 × 20GP containers delivered to Nhava Sheva, Mumbai. Digital signed Proof of Delivery (POD) confirmed by dock supervisor Suresh Patil. Zero operational variances reported. Ready to generate UAE VAT compliant eInvoice immediately.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-purple-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Service:</span>
                    <strong className="text-slate-800">Sea FCL Export</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Carrier:</span>
                    <strong className="text-slate-800">MSC ARIES / 122E</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">VAT Treatment:</span>
                    <strong className="text-emerald-700">0% (Export of Services)</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Signed POD:</span>
                    <strong className="text-emerald-700">✓ On File</strong>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateView('invoices');
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition"
                  >
                    <span>Generate Invoice (INV-3391)</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MARGIN DRILLDOWN */}
          {metricType === 'margin' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Job #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Sell (AED)</th>
                      <th className="p-3">Buy Cost (AED)</th>
                      <th className="p-3">Profit (AED)</th>
                      <th className="p-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shipments.map((s) => {
                      const profit = s.revenue - s.cost;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-slate-900">{s.jobNo}</td>
                          <td className="p-3 font-semibold text-slate-800">{s.customer}</td>
                          <td className="p-3 font-mono">{s.revenue.toLocaleString()}</td>
                          <td className="p-3 font-mono text-slate-500">{s.cost.toLocaleString()}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700">
                            +{profit.toLocaleString()}
                          </td>
                          <td className="p-3 font-mono font-black text-right text-emerald-700">
                            {s.margin}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-emerald-50/60 font-bold text-xs border-t border-emerald-100">
                    <tr>
                      <td colSpan={2} className="p-3 text-emerald-950 font-black">
                        Average Portfolio Margin:
                      </td>
                      <td className="p-3 font-mono font-black">
                        AED {shipments.reduce((sum, s) => sum + s.revenue, 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        AED {shipments.reduce((sum, s) => sum + s.cost, 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-emerald-800 font-black">
                        +AED{' '}
                        {shipments.reduce((sum, s) => sum + (s.revenue - s.cost), 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-black text-right text-emerald-800 text-sm">
                        26.4%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 shrink-0 text-xs">
          <div className="text-slate-500">
            {metricType === 'shipments' && 'Need to create a new booking?'}
            {metricType === 'approvals' && 'Supervisor override history is logged for compliance audit.'}
            {metricType === 'unbilled' && 'Invoices sync automatically to FTA eInvoicing ASP.'}
            {metricType === 'margin' && 'Protected by DigitalBurj 18% margin floor guardrail.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                if (metricType === 'shipments') onNavigateView('shipments');
                if (metricType === 'approvals') onNavigateView('approvals');
                if (metricType === 'unbilled') onNavigateView('invoices');
                if (metricType === 'margin') onNavigateView('jobcosting');
              }}
              className="flex items-center gap-1 font-bold text-[#E8472B] hover:underline"
            >
              <span>
                {metricType === 'shipments' && 'Go to Shipments Tower'}
                {metricType === 'approvals' && 'Go to Approvals View'}
                {metricType === 'unbilled' && 'Go to Invoices'}
                {metricType === 'margin' && 'Go to Job Costing'}
              </span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
