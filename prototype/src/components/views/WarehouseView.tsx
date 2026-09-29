import React, { useState } from 'react';
import {
  Building2,
  Box,
  Truck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Thermometer,
  Layers,
  ArrowRight,
  Plus,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Check,
  FileText,
} from 'lucide-react';
import { WarehouseBin } from '../../types';
import { INITIAL_WAREHOUSE_BINS } from '../../data/mockData';

export const WarehouseView: React.FC = () => {
  const [bins, setBins] = useState<WarehouseBin[]>(INITIAL_WAREHOUSE_BINS);
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [selectedBin, setSelectedBin] = useState<WarehouseBin | null>(null);
  const [showGatePassModal, setShowGatePassModal] = useState<WarehouseBin | null>(null);

  const filteredBins = bins.filter((b) => {
    if (zoneFilter === 'all') return true;
    return b.zone.toLowerCase().includes(zoneFilter.toLowerCase());
  });

  const totalCapacity = bins.reduce((sum, b) => sum + b.capacityPallets, 0);
  const totalOccupied = bins.reduce((sum, b) => sum + b.occupiedPallets, 0);
  const occupancyPct = Math.round((totalOccupied / totalCapacity) * 100);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Operations · Jebel Ali Freezone Site
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              CFS & Cross-Dock Connected
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Warehouse (WMS) & Cross-Dock Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time pallet bin allocations, cold-chain temperature validation, devanning stations, and terminal gate passes.
          </p>
        </div>

        {/* Occupancy Indicator */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Storage Capacity Occupancy
            </div>
            <div className="text-lg font-black font-mono text-slate-900">
              {totalOccupied} / {totalCapacity} Pallets ({occupancyPct}%)
            </div>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Active Devanned Cargo
            </span>
            <Box className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">
            {bins.filter((b) => b.status === 'occupied').length} Active Bins
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Containers stripped and staged in designated warehouse bays
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-cyan-800">
              Cold Storage Temperature Monitoring
            </span>
            <Thermometer className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-cyan-900 font-mono">
            +3.8°C Steady
          </div>
          <p className="text-xs text-cyan-800 mt-1">
            Zone B Cold Room certified for pharmaceutical & perishable goods
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-purple-700">
              Outbound Cross-Dock Staging
            </span>
            <Truck className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-purple-900">
            Bay 02 Active
          </div>
          <p className="text-xs text-purple-800 mt-1">
            32 Pallets staged for GCC truck departure to Muscat
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        {[
          { id: 'all', label: `All Zones (${bins.length})` },
          { id: 'ambient', label: 'Ambient Dry' },
          { id: 'cold', label: 'Cold Storage (2-8°C)' },
          { id: 'cross-dock', label: 'Cross-Dock Staging' },
          { id: 'dangerous', label: 'Dangerous Goods (DG)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setZoneFilter(tab.id)}
            className={`rounded-xl px-3.5 py-2 font-bold transition ${
              zoneFilter === tab.id
                ? 'bg-[#E8472B] text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBins.map((bin) => {
          const utilPct = Math.round((bin.occupiedPallets / bin.capacityPallets) * 100);

          return (
            <div
              key={bin.id}
              className={`rounded-2xl border p-5 shadow-xs transition flex flex-col justify-between ${
                bin.status === 'occupied'
                  ? 'border-slate-300 bg-white'
                  : 'border-dashed border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {bin.zone}
                    </span>
                    <h3 className="text-lg font-black font-mono text-slate-900">
                      Bin {bin.binCode}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      bin.status === 'occupied'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {bin.status === 'occupied' ? 'OCCUPIED' : 'READY TO STORE'}
                  </span>
                </div>

                {bin.status === 'occupied' ? (
                  <div className="space-y-2 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] uppercase font-bold text-slate-400">
                          Active Job:
                        </span>
                        <span className="font-mono font-bold text-blue-700">
                          {bin.currentJobNo}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900">{bin.customerName}</div>
                      <div className="text-[11px] text-slate-500 leading-snug">
                        {bin.cargoDescription}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Received: <strong>{bin.intakeDate}</strong></span>
                      {bin.gatePassNo && (
                        <span className="font-mono text-slate-700">
                          Pass: {bin.gatePassNo}
                        </span>
                      )}
                    </div>

                    {/* Pallet Utilization */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Pallet Usage:</span>
                        <span className="font-mono">
                          {bin.occupiedPallets} of {bin.capacityPallets} ({utilPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${utilPct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <Box className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                    <p className="font-medium">Capacity: {bin.capacityPallets} standard pallets</p>
                    <p className="text-[11px] text-slate-400">Available for immediate devanning</p>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                {bin.status === 'occupied' ? (
                  <>
                    <button
                      onClick={() => setShowGatePassModal(bin)}
                      className="flex items-center gap-1 font-bold text-[#E8472B] hover:underline"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Print Gate Pass</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">
                      JAFZA Gate 4 Verified
                    </span>
                  </>
                ) : (
                  <button className="flex items-center gap-1 font-bold text-blue-600 hover:underline">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Assign Inbound Pallets</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Electronic Gate Pass Modal */}
      {showGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#E8472B]" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  DP World & JAFZA Electronic Gate Pass (e-Pass)
                </h3>
              </div>
              <button
                onClick={() => setShowGatePassModal(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Official Pass Preview Box */}
            <div className="rounded-2xl border-2 border-slate-900 bg-slate-50 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                    DigitalBurj Terminal Gate Pass
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Pass Reference: {showGatePassModal.gatePassNo || 'GP-JAFZA-88210'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    GATE OUT AUTHORIZED
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shipment Job:</span>
                  <span className="font-mono font-bold text-slate-900">{showGatePassModal.currentJobNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Warehouse Bin:</span>
                  <span className="font-mono font-bold text-slate-900">{showGatePassModal.binCode}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Consignee:</span>
                  <span className="font-bold text-slate-800">{showGatePassModal.customerName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pallets Loaded:</span>
                  <span className="font-mono font-bold text-slate-900">{showGatePassModal.occupiedPallets} Pallets</span>
                </div>
              </div>

              {/* Barcode & Security PIN */}
              <div className="rounded-xl bg-white p-3 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-slate-400">Security Gate PIN:</div>
                  <div className="text-lg font-black font-mono tracking-widest text-[#E8472B]">
                    774-109
                  </div>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-500">
                  ||| | |||| | ||||| |||| |
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGatePassModal(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert('Gate pass sent to driver mobile app and terminal dispatch system.');
                  setShowGatePassModal(null);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
              >
                <Check className="h-4 w-4" />
                <span>Issue & Send to Driver</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
