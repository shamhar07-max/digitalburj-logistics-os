import React, { useState } from 'react';
import {
  Building2,
  Users,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  DollarSign,
  FileText,
  Star,
  Download,
  Filter,
} from 'lucide-react';
import { Partner } from '../../types';
import { INITIAL_PARTNERS } from '../../data/mockData';

interface PartnersViewProps {
  onOpenNewPartnerModal: () => void;
  onOpenNewQuoteForCustomer?: (customerName: string) => void;
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  onOpenNewPartnerModal,
  onOpenNewQuoteForCustomer,
}) => {
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activePartnerDetail, setActivePartnerDetail] = useState<Partner | null>(null);

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.trn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tradeLicenseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const totalReceivables = partners
    .filter((p) => p.category === 'customer')
    .reduce((sum, p) => sum + p.outstandingBalance, 0);

  const totalCreditAllocated = partners
    .filter((p) => p.category === 'customer')
    .reduce((sum, p) => sum + p.creditLimit, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Master Directory · Customers & Carriers
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800">
              {partners.length} Total Partners
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            Partners, Accounts & Vendor Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin master entry for all customer accounts, ocean carriers, air lines, road transporters, and customs brokers.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewPartnerModal}
            className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Partner</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Active Customers (Shippers)
            </span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">
            {partners.filter((p) => p.category === 'customer').length} Accounts
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pre-approved credit terms and KYC clearance verified
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Total Customer Receivables
            </span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-700 font-mono">
            AED {totalReceivables.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across AED {totalCreditAllocated.toLocaleString()} allocated credit pool
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              Approved Carriers & Vendors
            </span>
            <Building2 className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-black text-purple-900">
            {partners.filter((p) => p.category !== 'customer').length} Partners
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ocean shipping lines, Air cargo, GCC hauliers & brokers
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, contact person, TRN, license #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#E8472B]/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto text-xs">
          {[
            { id: 'all', label: `All (${partners.length})` },
            {
              id: 'customer',
              label: `Customers (${partners.filter((p) => p.category === 'customer').length})`,
            },
            {
              id: 'carrier',
              label: `Carriers (${partners.filter((p) => p.category === 'carrier').length})`,
            },
            {
              id: 'broker',
              label: `Brokers (${partners.filter((p) => p.category === 'broker').length})`,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                selectedCategory === cat.id
                  ? 'bg-[#E8472B] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Partners Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map((partner) => {
          const creditUtilization = partner.creditLimit > 0
            ? Math.round((partner.outstandingBalance / partner.creditLimit) * 100)
            : 0;

          return (
            <div
              key={partner.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#E8472B]/50 hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${
                        partner.category === 'customer'
                          ? 'bg-blue-100 text-blue-800'
                          : partner.category === 'carrier'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {partner.category}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900 mt-1 leading-snug">
                      {partner.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {partner.typeLabel}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      partner.kycStatus === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    KYC {partner.kycStatus.toUpperCase()}
                  </span>
                </div>

                {/* Key Legal IDs */}
                <div className="rounded-xl bg-slate-50 p-2.5 space-y-1 text-[11px] font-mono border border-slate-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400">VAT TRN:</span>
                    <span className="font-bold text-slate-800">{partner.trn}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Trade License:</span>
                    <span>{partner.tradeLicenseNo}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Expires:</span>
                    <span className="text-slate-700">{partner.licenseExpiry}</span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>{partner.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{partner.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{partner.city}</span>
                  </div>
                </div>

                {/* Credit Control Gauge (For Customers) */}
                {partner.category === 'customer' && (
                  <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        Terms: <strong className="text-slate-800">{partner.paymentTerms}</strong>
                      </span>
                      <span className="font-bold font-mono text-slate-900">
                        AED {partner.outstandingBalance.toLocaleString()} / {partner.creditLimit.toLocaleString()}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          creditUtilization > 80
                            ? 'bg-rose-500'
                            : creditUtilization > 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, creditUtilization)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Credit Utilized</span>
                      <span className="font-bold font-mono">{creditUtilization}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Rep: <strong className="text-slate-700">{partner.accountManager}</strong>
                </span>

                {partner.category === 'customer' ? (
                  <button
                    onClick={() => {
                      if (onOpenNewQuoteForCustomer) {
                        onOpenNewQuoteForCustomer(partner.name);
                      }
                    }}
                    className="flex items-center gap-1 font-bold text-[#E8472B] hover:underline"
                  >
                    <span>New Quote</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Active Contract
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
