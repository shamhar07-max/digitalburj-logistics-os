import React, { useState } from 'react';
import {
  Receipt,
  FileCheck2,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  Building2,
} from 'lucide-react';
import { VendorBill } from '../../types';
import { INITIAL_VENDOR_BILLS } from '../../data/mockData';

export const VendorBillsView: React.FC = () => {
  const [bills, setBills] = useState<VendorBill[]>(INITIAL_VENDOR_BILLS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'variance'>('all');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.shipmentJobNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'unpaid') return b.paymentStatus === 'unpaid';
    if (statusFilter === 'paid') return b.paymentStatus === 'paid';
    if (statusFilter === 'variance') return b.varianceStatus === 'variance_flag';
    return true;
  });

  const handleApproveVariance = (id: string) => {
    setBills((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, varianceStatus: 'approved', varianceAmount: 0 } : b
      )
    );
    setSuccessToast(`Variance approved for bill ${bills.find((b) => b.id === id)?.billNo}`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleMarkPaid = (id: string) => {
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, paymentStatus: 'paid' } : b))
    );
    setSuccessToast(`Payment recorded for bill ${bills.find((b) => b.id === id)?.billNo}`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const totalPayables = bills
    .filter((b) => b.paymentStatus === 'unpaid')
    .reduce((sum, b) => sum + b.billedAmount, 0);

  const varianceCount = bills.filter((b) => b.varianceStatus === 'variance_flag').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Accounting · Carrier Accounts Payable
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              3-Way Matching Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Vendor Bills & Purchase Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Reconcile carrier bills (Maersk, MSC, Emirates SkyCargo, Road Hauliers) directly against shipment job buy costs.
          </p>
        </div>

        {/* Total Outstanding Payables */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Unpaid Carrier Payables
            </div>
            <div className="text-lg font-black font-mono text-slate-950">
              AED {totalPayables.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 3 Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Matched Carrier Bills
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">
            {bills.filter((b) => b.varianceStatus === 'matched').length} Bills
          </div>
          <p className="text-xs text-slate-500 mt-1">
            100% matched to quoted buy cost with zero variance
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-rose-700">
              Over-Billed Variance Alerts
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-rose-700">
            {varianceCount} Over Budget
          </div>
          <p className="text-xs text-rose-800 mt-1">
            Requires supervisor approval or dispute credit note
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-purple-700">
              Total Input VAT Recoverable
            </span>
            <Receipt className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-purple-900 font-mono">
            AED {bills.reduce((sum, b) => sum + b.vatAmount, 0).toLocaleString()}
          </div>
          <p className="text-xs text-purple-800 mt-1">
            Claimable on UAE FTA VAT Return Box 9
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by bill #, carrier, job #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `All Bills (${bills.length})` },
            { id: 'unpaid', label: `Unpaid (${bills.filter((b) => b.paymentStatus === 'unpaid').length})` },
            { id: 'variance', label: `Variances (${varianceCount})` },
            { id: 'paid', label: `Paid (${bills.filter((b) => b.paymentStatus === 'paid').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
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

      {/* Table of Bills */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Bill Number</th>
              <th className="p-3.5">Carrier / Vendor</th>
              <th className="p-3.5">Shipment Job</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Estimated Cost</th>
              <th className="p-3.5">Billed Amount</th>
              <th className="p-3.5">3-Way Match Status</th>
              <th className="p-3.5">Payment</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBills.map((bill) => (
              <tr key={bill.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  {bill.billNo}
                  <div className="text-[10px] text-slate-400 font-sans">
                    Due: {bill.dueDate}
                  </div>
                </td>
                <td className="p-3.5">
                  <div className="font-bold text-slate-800">{bill.vendorName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    TRN: {bill.vendorTrn}
                  </div>
                </td>
                <td className="p-3.5 font-mono font-bold text-blue-700">
                  {bill.shipmentJobNo}
                </td>
                <td className="p-3.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                    {bill.category}
                  </span>
                </td>
                <td className="p-3.5 font-mono text-slate-600">
                  AED {bill.estimatedCost.toLocaleString()}
                </td>
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  AED {bill.billedAmount.toLocaleString()}
                  {bill.vatAmount > 0 && (
                    <div className="text-[10px] text-purple-700 font-medium">
                      +AED {bill.vatAmount} VAT
                    </div>
                  )}
                </td>
                <td className="p-3.5">
                  {bill.varianceStatus === 'matched' ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Matched</span>
                    </span>
                  ) : bill.varianceStatus === 'variance_flag' ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>+AED {bill.varianceAmount} Variance</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                      Variance Approved
                    </span>
                  )}
                </td>
                <td className="p-3.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      bill.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {bill.paymentStatus.toUpperCase()}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-1.5">
                  {bill.varianceStatus === 'variance_flag' && (
                    <button
                      onClick={() => handleApproveVariance(bill.id)}
                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition"
                    >
                      Approve Variance
                    </button>
                  )}
                  {bill.paymentStatus === 'unpaid' && (
                    <button
                      onClick={() => handleMarkPaid(bill.id)}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                    >
                      Pay Bill
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
