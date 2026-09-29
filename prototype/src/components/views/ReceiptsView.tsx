import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  ArrowUpRight,
  ShieldCheck,
  Check,
  X,
  FileText,
  User,
} from 'lucide-react';
import { ReceiptVoucher } from '../../types';
import { INITIAL_RECEIPTS, INITIAL_INVOICES } from '../../data/mockData';

export const ReceiptsView: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>(INITIAL_RECEIPTS);
  const [activeTab, setActiveTab] = useState<'all' | 'customer_receipt' | 'payment_voucher' | 'petty_cash'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewReceiptModal, setShowNewReceiptModal] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<ReceiptVoucher | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Receipt Form
  const [partyName, setPartyName] = useState('Al Faris Trading LLC');
  const [type, setType] = useState<'customer_receipt' | 'payment_voucher' | 'petty_cash'>('customer_receipt');
  const [amount, setAmount] = useState<number>(25000);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Wire (IBAN)' | 'Cheque' | 'Credit Card' | 'Cash'>('Bank Wire (IBAN)');
  const [referenceNo, setReferenceNo] = useState('FT-ENBD-884102');
  const [invoiceNo, setInvoiceNo] = useState('INV-2026-3389');
  const [notes, setNotes] = useState('Part settlement of Sea FCL shipment Jebel Ali.');

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referenceNo.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    return r.type === activeTab;
  });

  const totalCollected = receipts
    .filter((r) => r.type === 'customer_receipt')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalDisbursed = receipts
    .filter((r) => r.type === 'payment_voucher' || r.type === 'petty_cash')
    .reduce((sum, r) => sum + r.amount, 0);

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();

    const prefix = type === 'customer_receipt' ? 'REC' : type === 'payment_voucher' ? 'PV' : 'PC';
    const newReceipt: ReceiptVoucher = {
      id: `rec-${Date.now()}`,
      receiptNo: `${prefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      type,
      partyName,
      amount: Number(amount),
      currency: 'AED',
      paymentMethod,
      referenceNo,
      allocatedInvoices: invoiceNo ? [{ invoiceNo, amount: Number(amount) }] : [],
      bankAccount: 'Emirates NBD (Primary AED - 010244991001)',
      date: 'Today',
      status: paymentMethod === 'Cheque' ? 'pending_clearance' : 'cleared',
      notes,
      receivedBy: 'Fatima Zayed (Cashier)',
    };

    setReceipts([newReceipt, ...receipts]);
    setShowNewReceiptModal(false);
    setSuccessToast(`Official Receipt ${newReceipt.receiptNo} generated successfully!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Accounting & Cashier · Treasury Controls
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              Receipts & Vouchers
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Official Receipts & Payment Vouchers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer money collections, issue official payment receipts, authorize vendor port disbursements, and manage driver petty cash.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewReceiptModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Issue New Receipt / Voucher</span>
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

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Customer Money Collected (Inflow)
            </span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-700 font-mono">
            AED {totalCollected.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cleared via corporate bank wire & authorized cheques
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Vendor & Port Vouchers (Outflow)
            </span>
            <Receipt className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-purple-900 font-mono">
            AED {totalDisbursed.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Paid to DP World port, customs deposits, and line terminal handling
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Petty Cash Safe Balance
            </span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900 font-mono">
            AED 14,550
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dubai HQ Safe Float for driver tolls & spot terminal gates
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt #, customer, reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `All Vouchers (${receipts.length})` },
            { id: 'customer_receipt', label: 'Customer Receipts (Money In)' },
            { id: 'payment_voucher', label: 'Payment Vouchers (Money Out)' },
            { id: 'petty_cash', label: 'Petty Cash' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                activeTab === tab.id
                  ? 'bg-[#E8472B] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Receipts */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Receipt #</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5">Customer / Payee</th>
              <th className="p-3.5">Amount (AED)</th>
              <th className="p-3.5">Payment Method</th>
              <th className="p-3.5">Ref / Cheque #</th>
              <th className="p-3.5">Allocated Invoice</th>
              <th className="p-3.5">Clearance Status</th>
              <th className="p-3.5 text-right">Receipt Voucher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReceipts.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80 transition">
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  {r.receiptNo}
                  <div className="text-[10px] text-slate-400 font-sans">{r.date}</div>
                </td>
                <td className="p-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      r.type === 'customer_receipt'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.type === 'payment_voucher'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {r.type === 'customer_receipt' ? 'MONEY IN' : r.type === 'payment_voucher' ? 'MONEY OUT' : 'PETTY CASH'}
                  </span>
                </td>
                <td className="p-3.5">
                  <div className="font-bold text-slate-800">{r.partyName}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-xs">{r.notes}</div>
                </td>
                <td className="p-3.5 font-mono font-black text-sm text-slate-900">
                  AED {r.amount.toLocaleString()}
                </td>
                <td className="p-3.5 text-slate-700 font-medium">
                  {r.paymentMethod}
                </td>
                <td className="p-3.5 font-mono text-slate-600">
                  {r.referenceNo}
                </td>
                <td className="p-3.5 font-mono text-blue-700 font-semibold">
                  {r.allocatedInvoices.length > 0 ? r.allocatedInvoices.map((inv) => inv.invoiceNo).join(', ') : 'Unallocated Float'}
                </td>
                <td className="p-3.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      r.status === 'cleared'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.status === 'cleared' ? 'CLEARED' : 'PENDING CHEQUE'}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => setSelectedReceiptForPrint(r)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition ml-auto"
                  >
                    <Printer className="h-3 w-3 text-slate-400" />
                    <span>Print Slip</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Receipt Modal */}
      {showNewReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[#E8472B]" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Issue Official Receipt / Payment Voucher
                </h3>
              </div>
              <button onClick={() => setShowNewReceiptModal(false)} className="text-xs font-bold text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Voucher Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'customer_receipt', label: 'Customer Receipt' },
                    { id: 'payment_voucher', label: 'Payment Voucher' },
                    { id: 'petty_cash', label: 'Petty Cash' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setType(t.id as any)}
                      className={`rounded-xl border p-2 text-center font-bold ${
                        type === t.id
                          ? 'border-[#E8472B] bg-[#E8472B]/10 text-[#E8472B]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer / Payee Name</label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-900 font-bold focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (AED)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono font-bold text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-medium focus:outline-hidden"
                  >
                    <option value="Bank Wire (IBAN)">Bank Wire (IBAN Transfer)</option>
                    <option value="Cheque">Cheque (CDC/PDC)</option>
                    <option value="Credit Card">Corporate Card / POS</option>
                    <option value="Cash">Cash / Counter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Reference / Cheque #</label>
                  <input
                    type="text"
                    required
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Allocate Against Invoice</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-2026-3389"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewReceiptModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2 text-xs font-bold text-white hover:bg-[#D13B20] transition"
                >
                  <Check className="h-4 w-4" />
                  <span>Issue & Print Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Receipt Printable Preview Modal */}
      {selectedReceiptForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase text-slate-400">Official Receipt Slip</span>
              <button onClick={() => setSelectedReceiptForPrint(null)} className="text-xs font-bold text-slate-400">✕</button>
            </div>

            <div className="rounded-2xl border-2 border-slate-900 bg-slate-50/50 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-sm font-black text-slate-950">DigitalBurj Logistics FZ-LLC</div>
                  <div className="text-[10px] text-slate-500">TRN: 100234567800003 · JAFZA Dubai</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-black text-[#E8472B]">{selectedReceiptForPrint.receiptNo}</div>
                  <div className="text-[10px] text-slate-400">{selectedReceiptForPrint.date}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Received From:</span>
                  <strong className="text-slate-900">{selectedReceiptForPrint.partyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Received:</span>
                  <strong className="font-mono text-base text-emerald-800">
                    AED {selectedReceiptForPrint.amount.toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Channel:</span>
                  <span>{selectedReceiptForPrint.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-mono">{selectedReceiptForPrint.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Account:</span>
                  <span className="truncate max-w-[200px]">{selectedReceiptForPrint.bankAccount}</span>
                </div>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-slate-200 text-[11px] text-slate-600">
                <span className="font-bold">Purpose: </span>{selectedReceiptForPrint.notes}
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Authorized Cashier: {selectedReceiptForPrint.receivedBy}</span>
                <span className="font-bold text-emerald-700">✓ VALID STAMP</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedReceiptForPrint(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert('Receipt voucher printed / sent to customer email.');
                  setSelectedReceiptForPrint(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
              >
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
