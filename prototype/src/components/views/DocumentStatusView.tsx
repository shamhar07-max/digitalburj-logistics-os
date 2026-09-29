import React, { useState } from 'react';
import {
  FileText,
  FileCheck2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  QrCode,
  Key,
  Eye,
  Check,
  Send,
  Building,
} from 'lucide-react';
import { OperationalDocumentRecord } from '../../types';
import { INITIAL_OPERATIONAL_DOCS } from '../../data/mockData';

export const DocumentStatusView: React.FC = () => {
  const [docs, setDocs] = useState<OperationalDocumentRecord[]>(INITIAL_OPERATIONAL_DOCS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDOPinModal, setShowDOPinModal] = useState<OperationalDocumentRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      d.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.shipmentJobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.referenceNo.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return d.status === statusFilter;
  });

  const verifiedCount = docs.filter((d) => d.status === 'verified' || d.status === 'stamped').length;
  const missingCount = docs.filter((d) => d.status === 'missing').length;
  const completenessScore = Math.round((verifiedCount / docs.length) * 100);

  const handleGenerateEDO = (docId: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, status: 'issued', pinCode: '884102', issuedAt: 'Just now' } : d
      )
    );
    setSuccessMessage('Electronic Delivery Order generated with PIN 884102!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Operations · Mandatory Trade Filing
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              Mirsal II & DP World Direct
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Operational Document Status Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every required trade document from Bill of Lading and Certificate of Origin to electronic Delivery Order (e-DO) and signed POD.
          </p>
        </div>

        {/* Completeness Badge */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Global Document Readiness
            </div>
            <div className="text-lg font-black font-mono text-emerald-700">
              {completenessScore}% Ready ({verifiedCount} of {docs.length} verified)
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Verified & Stamped Documents
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">
            {verifiedCount} Verified
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Legally cleared by customs brokers, shipping lines, and banks
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800">
              Electronic Delivery Orders (e-DO)
            </span>
            <Key className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-amber-900">
            {docs.filter((d) => d.documentCode === 'DELIVERY_ORDER').length} Active
          </div>
          <p className="text-xs text-amber-800 mt-1">
            Terminal PIN codes issued for container release at Jebel Ali
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-rose-700">
              Missing Mandatory Documents
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-rose-700">
            {missingCount} Missing
          </div>
          <p className="text-xs text-rose-800 mt-1">
            Blocks customs gate-out if unsubmitted before vessel arrival
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by doc name, job #, reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `All (${docs.length})` },
            { id: 'verified', label: 'Verified' },
            { id: 'issued', label: 'Issued' },
            { id: 'stamped', label: 'Stamped' },
            { id: 'missing', label: 'Missing' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                statusFilter === tab.id
                  ? 'bg-[#E8472B] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Document Name</th>
              <th className="p-3.5">Shipment Job</th>
              <th className="p-3.5">Consignee / Customer</th>
              <th className="p-3.5">Issuing Authority</th>
              <th className="p-3.5">Reference Number</th>
              <th className="p-3.5">Verification Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3.5">
                  <div className="font-extrabold text-slate-900">{doc.documentName}</div>
                  {doc.notes && (
                    <div className="text-[10px] text-slate-500 max-w-xs leading-snug">
                      {doc.notes}
                    </div>
                  )}
                </td>
                <td className="p-3.5 font-mono font-bold text-blue-700">
                  {doc.shipmentJobNo}
                </td>
                <td className="p-3.5 font-semibold text-slate-800">
                  {doc.customerName}
                </td>
                <td className="p-3.5 text-slate-600">
                  {doc.issuer}
                  <div className="text-[10px] text-slate-400">Issued: {doc.issuedAt}</div>
                </td>
                <td className="p-3.5 font-mono font-semibold text-slate-800">
                  {doc.referenceNo}
                  {doc.pinCode && (
                    <div className="text-[10px] font-bold text-amber-700">
                      PIN: {doc.pinCode}
                    </div>
                  )}
                </td>
                <td className="p-3.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                      doc.status === 'verified' || doc.status === 'stamped'
                        ? 'bg-emerald-100 text-emerald-800'
                        : doc.status === 'issued'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {doc.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-1.5">
                  {doc.documentCode === 'DELIVERY_ORDER' && doc.pinCode && (
                    <button
                      onClick={() => setShowDOPinModal(doc)}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition"
                    >
                      View PIN
                    </button>
                  )}
                  {doc.documentCode === 'DELIVERY_ORDER' && !doc.pinCode && (
                    <button
                      onClick={() => handleGenerateEDO(doc.id)}
                      className="rounded-lg bg-[#E8472B] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#D13B20] transition"
                    >
                      Generate e-DO
                    </button>
                  )}
                  <button
                    onClick={() => {
                      alert(`Downloading official PDF copy of ${doc.documentName} (${doc.referenceNo})`);
                    }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Electronic Delivery Order PIN Modal */}
      {showDOPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Electronic Delivery Order (e-DO) PIN
                </h3>
              </div>
              <button
                onClick={() => setShowDOPinModal(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center space-y-2">
              <span className="text-[11px] uppercase font-bold text-amber-800">
                Official JAFZA Port Clearance Security PIN
              </span>
              <div className="text-3xl font-black font-mono tracking-widest text-slate-900">
                {showDOPinModal.pinCode}
              </div>
              <p className="text-xs text-amber-900">
                Authorized for DP World Terminal 2 Gate-Out for container <strong>MSKU-8842190</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDOPinModal(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`e-DO PIN dispatched via WhatsApp to ${showDOPinModal.customerName}.`);
                  setShowDOPinModal(null);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
              >
                <Send className="h-4 w-4" />
                <span>Send via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
