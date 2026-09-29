import React, { useState } from 'react';
import { X, Building2, ShieldCheck, Check, DollarSign, Mail, Phone, MapPin, User, FileText } from 'lucide-react';
import { Partner } from '../../types';

interface NewPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPartner: (partner: Partner) => void;
}

export const NewPartnerModal: React.FC<NewPartnerModalProps> = ({
  isOpen,
  onClose,
  onAddPartner,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'customer' | 'carrier' | 'broker' | 'warehouse'>('customer');
  const [trn, setTrn] = useState('');
  const [tradeLicenseNo, setTradeLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('2027-12-31');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+971 ');
  const [city, setCity] = useState('Dubai');
  const [paymentTerms, setPaymentTerms] = useState<'Net 15' | 'Net 30' | 'Net 60' | 'COD' | 'Letter of Credit'>('Net 30');
  const [creditLimit, setCreditLimit] = useState(100000);
  const [accountManager, setAccountManager] = useState('Sara Menon');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPartner: Partner = {
      id: `prt-${Date.now()}`,
      name: name.trim(),
      category,
      typeLabel:
        category === 'customer'
          ? 'Corporate Shipper / Trader'
          : category === 'carrier'
          ? 'Logistics Carrier / Shipping Line'
          : category === 'broker'
          ? 'Customs Clearing Agent'
          : 'Third Party Logistics Warehouse',
      trn: trn.trim() || '100' + Math.floor(100000000000 + Math.random() * 900000000000) + '00003',
      tradeLicenseNo: tradeLicenseNo.trim() || `CN-${Math.floor(100000 + Math.random() * 900000)}`,
      licenseExpiry,
      contactPerson: contactPerson.trim() || 'Managing Director',
      email: email.trim() || 'info@company.ae',
      phone: phone.trim() || '+971 4 000 0000',
      city,
      paymentTerms,
      creditLimit: Number(creditLimit),
      outstandingBalance: 0,
      kycStatus: 'verified',
      accountManager,
      rating: 5,
    };

    onAddPartner(newPartner);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-[#E8472B]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Register New Enterprise Partner / Account
              </h2>
              <p className="text-xs text-slate-500">
                Master directory entry for customer billing, carrier bookings, and credit limits.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Partner Category Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Partner Type / Classification:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'customer', label: 'Customer (Shipper)' },
                { id: 'carrier', label: 'Carrier (Line/Air/Road)' },
                { id: 'broker', label: 'Customs Broker' },
                { id: 'warehouse', label: '3PL Warehouse' },
              ].map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  className={`rounded-xl border p-2.5 text-xs font-bold transition text-center ${
                    category === cat.id
                      ? 'border-[#E8472B] bg-[#E8472B]/10 text-[#E8472B] shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legal Company Name & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Company Legal Name (as per Trade License) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Al Habtoor Trading LLC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8472B]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Operating Emirate / Jurisdiction
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 focus:outline-hidden"
              >
                <option value="Dubai (JAFZA & Mainland)">Dubai (JAFZA & Mainland)</option>
                <option value="Abu Dhabi (KIZAD & Mainland)">Abu Dhabi (KIZAD & Mainland)</option>
                <option value="Sharjah (SAIF Zone)">Sharjah (SAIF Zone)</option>
                <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                <option value="Fujairah Port">Fujairah Port</option>
                <option value="International / Overseas">International / Overseas</option>
              </select>
            </div>
          </div>

          {/* UAE TRN & Trade License */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UAE FTA VAT TRN (15-digits)
              </label>
              <input
                type="text"
                placeholder="100234567800003"
                value={trn}
                onChange={(e) => setTrn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trade License Number
              </label>
              <input
                type="text"
                placeholder="CN-884102"
                value={tradeLicenseNo}
                onChange={(e) => setTradeLicenseNo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                License Expiration Date
              </label>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Tariq Mansoor"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Email
              </label>
              <input
                type="email"
                placeholder="logistics@company.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Direct Phone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="+971 4 881 2900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Commercial Terms & Credit Control */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="font-extrabold text-xs text-slate-900">
              Commercial Terms & Credit Guardrail
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
                >
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days (Standard)</option>
                  <option value="Net 60">Net 60 Days (Enterprise)</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="Letter of Credit">Letter of Credit (LC)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Authorized Credit Limit (AED)
                </label>
                <input
                  type="number"
                  step={5000}
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold font-mono text-slate-900 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Assigned Account Manager
                </label>
                <select
                  value={accountManager}
                  onChange={(e) => setAccountManager(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-medium focus:outline-hidden"
                >
                  <option value="Sara Menon">Sara Menon (Key Accounts)</option>
                  <option value="Ravi Nair">Ravi Nair (Commercial)</option>
                  <option value="Maya Al Rashid">Maya Al Rashid (Operations Lead)</option>
                  <option value="Omar Khalifa">Omar Khalifa (Trade Specialist)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>Save & Register Partner</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
