import React, { useState } from 'react';
import {
  FileText,
  X,
  Printer,
  Download,
  ShieldCheck,
  CheckCircle2,
  Ship,
  Plane,
  Truck,
  QrCode,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { GeneratedDocument } from '../../types';

interface AutomatedDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: GeneratedDocument[];
  currentJobNo: string;
}

export const AutomatedDocumentModal: React.FC<AutomatedDocumentModalProps> = ({
  isOpen,
  onClose,
  documents,
  currentJobNo,
}) => {
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  if (!isOpen || documents.length === 0) return null;

  const currentDoc = documents[activeDocIndex] || documents[0];

  const handlePrint = () => {
    alert(`Sending official ${currentDoc.title} (${currentDoc.documentNo}) to printer.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-[#E8472B]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-950">
                  Automated Document Generator
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  Job {currentJobNo}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Triggered automatically on shipment lifecycle update: {currentDoc.triggeredBy}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-2 pt-2 shrink-0">
          {documents.map((doc, idx) => (
            <button
              key={doc.id}
              onClick={() => setActiveDocIndex(idx)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeDocIndex === idx
                  ? 'border-[#E8472B] text-[#E8472B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-mono">
                {doc.documentType}
              </span>
              <span>{doc.documentType === 'HBL' ? 'House Bill of Lading' : doc.documentType === 'PACKING_LIST' ? 'Packing List' : 'Commercial Invoice'}</span>
            </button>
          ))}
        </div>

        {/* Document Printable View Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div className="mx-auto max-w-3xl rounded-2xl border-2 border-slate-900 bg-white p-8 shadow-md space-y-6 text-xs text-slate-800 font-sans">
            {/* Document Official Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8472B] font-black text-white text-xs">
                    DB
                  </div>
                  <h1 className="text-base font-black uppercase tracking-tight text-slate-950">
                    DigitalBurj Logistics FZ-LLC
                  </h1>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Dubai Customs Code: DXB-88219 · UAE FTA TRN: 100234567800003<br />
                  JAFZA South Zone, Gate 4 Customs Complex, Jebel Ali, Dubai UAE
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                  Document Reference #
                </span>
                <span className="font-mono text-sm font-black text-[#E8472B]">
                  {currentDoc.documentNo}
                </span>
                <div className="text-[10px] text-slate-400 font-mono">
                  Issued: {currentDoc.generatedAt}
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="rounded-xl bg-slate-900 p-2 text-center text-white font-black uppercase tracking-wider text-xs">
              {currentDoc.title}
            </div>

            {/* Parties Box */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-1">
                <span className="text-[9.5px] uppercase font-black text-slate-400 block">
                  Shipper / Consignor:
                </span>
                <div className="font-bold text-slate-900">{currentDoc.parties.shipper.name}</div>
                <div className="text-[11px] text-slate-600 leading-snug">{currentDoc.parties.shipper.address}</div>
                {currentDoc.parties.shipper.trn && (
                  <div className="text-[10.5px] font-mono text-slate-500">TRN: {currentDoc.parties.shipper.trn}</div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[9.5px] uppercase font-black text-slate-400 block">
                  Consignee / Consignor To Order Of:
                </span>
                <div className="font-bold text-slate-900">{currentDoc.parties.consignee.name}</div>
                <div className="text-[11px] text-slate-600 leading-snug">{currentDoc.parties.consignee.address}</div>
                {currentDoc.parties.consignee.trn && (
                  <div className="text-[10.5px] font-mono text-slate-500">TRN: {currentDoc.parties.consignee.trn}</div>
                )}
              </div>
            </div>

            {/* Routing and Transport Details */}
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Carrier</span>
                <strong className="text-slate-800">{currentDoc.transport.carrier}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Vessel / Flight</span>
                <strong className="text-slate-800">{currentDoc.transport.vesselOrFlight}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Port of Loading</span>
                <strong className="text-slate-800">{currentDoc.transport.pol}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Port of Discharge</span>
                <strong className="text-slate-800">{currentDoc.transport.pod}</strong>
              </div>
            </div>

            {/* Cargo / Items Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                  <tr>
                    <th className="p-2.5">Marks & Container / Seal</th>
                    <th className="p-2.5">Package Details</th>
                    <th className="p-2.5">Cargo Description</th>
                    <th className="p-2.5">Gross Wt (kg)</th>
                    <th className="p-2.5 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="p-2.5 font-mono text-[11px]">
                      <div>{currentDoc.cargoDetails.containerNo}</div>
                      <div className="text-slate-400">Seal: {currentDoc.cargoDetails.sealNo}</div>
                    </td>
                    <td className="p-2.5">
                      <strong>{currentDoc.cargoDetails.packageCount} Units</strong>
                      <div className="text-slate-500 text-[10.5px]">{currentDoc.cargoDetails.packageType}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="text-slate-900 font-semibold">{currentDoc.cargoDetails.description}</div>
                      {currentDoc.cargoDetails.hsCode && (
                        <span className="text-[10px] text-blue-700 font-mono">
                          HS Code: {currentDoc.cargoDetails.hsCode}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">
                      {currentDoc.cargoDetails.grossWeightKg.toLocaleString()} kg
                    </td>
                    <td className="p-2.5 font-mono text-right text-slate-900">
                      {currentDoc.cargoDetails.volumeCbm} CBM
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Financials for Commercial Invoice */}
            {currentDoc.financials && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-600">Subtotal Value:</span>
                  <span className="font-mono font-bold">AED {currentDoc.financials.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-600">UAE VAT ({currentDoc.financials.taxPercent}%):</span>
                  <span className="font-mono font-bold">AED {currentDoc.financials.taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-200 pt-2 text-slate-950">
                  <span>Total Payable:</span>
                  <span className="font-mono text-base text-[#E8472B]">
                    AED {currentDoc.financials.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Standard Legal Clauses */}
            <div className="space-y-1 text-[9.5px] text-slate-500 leading-tight border-t border-slate-200 pt-3">
              <span className="font-bold uppercase tracking-wider text-slate-400 block">
                Standard Regulatory Terms & Declarations:
              </span>
              {currentDoc.clauses.map((clause, idx) => (
                <p key={idx}>• {clause}</p>
              ))}
            </div>

            {/* Signatures & Security Stamp */}
            <div className="flex items-end justify-between border-t-2 border-slate-900 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 border border-slate-300">
                  <QrCode className="h-8 w-8 text-slate-800" />
                </div>
                <div className="text-[9.5px] font-mono text-slate-500">
                  <span className="font-bold text-slate-800">AUTOMATED AUDIT CERTIFIED</span>
                  <div className="truncate max-w-[240px]">{currentDoc.securityHash}</div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  ✓ VERIFIED & DIGITALLY STAMPED
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  DigitalBurj Central Operating Desk
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
