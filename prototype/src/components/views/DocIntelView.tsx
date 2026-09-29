import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
  flagged?: boolean;
  flagMessage?: string;
}

const SAMPLE_DOCS = [
  {
    id: 'bl',
    name: 'Bill of Lading — MSCU-7742112.pdf',
    type: 'Ocean B/L',
    size: '1.4 MB',
    fields: [
      { label: 'B/L Number', value: 'MSCUAE8842190', confidence: 0.99 },
      { label: 'Shipper', value: 'Shenzhen Techtronics Ltd', confidence: 0.98 },
      { label: 'Consignee', value: 'Al Faris Trading LLC', confidence: 0.98 },
      { label: 'Vessel / Voyage', value: 'MSC AURORA / 224E', confidence: 0.97 },
      { label: 'Port of Loading', value: 'Yantian, Shenzhen (CNYTN)', confidence: 0.99 },
      { label: 'Port of Discharge', value: 'Jebel Ali, Dubai (AEJEA)', confidence: 0.99 },
      { label: 'Container Number', value: 'MSKU-8842190 / 40HC', confidence: 0.99 },
      { label: 'Seal Number', value: 'ML-884219', confidence: 0.95 },
      { label: 'Gross Weight', value: '18,240.00 KGS', confidence: 0.96 },
      { label: 'HS Code', value: '8471.49 (Proposed)', confidence: 0.72, flagged: true, flagMessage: 'Low confidence: Invoice declares 8471.30' },
      { label: 'Freight Terms', value: 'Prepaid (CIF Dubai)', confidence: 0.95 },
    ],
  },
  {
    id: 'inv',
    name: 'Commercial Invoice — INV-2026-88421.pdf',
    type: 'Commercial Invoice',
    size: '890 KB',
    fields: [
      { label: 'Invoice Number', value: 'INV-2026-88421', confidence: 0.99 },
      { label: 'Invoice Date', value: '14 Sep 2026', confidence: 0.98 },
      { label: 'Total Value', value: 'USD 48,500.00', confidence: 0.99 },
      { label: 'Currency', value: 'USD (United States Dollar)', confidence: 0.99 },
      { label: 'Incoterm', value: 'CIF Jebel Ali Port', confidence: 0.96 },
      { label: 'Buyer TRN', value: '100234567800003', confidence: 0.98 },
      { label: 'Line Item 1', value: '1,200 units UltraBook Laptops @ $35.00', confidence: 0.95 },
      { label: 'Line Item 2', value: '400 units Docking Stations @ $12.50', confidence: 0.94 },
    ],
  },
  {
    id: 'pl',
    name: 'Packing List — 24 Pallets.pdf',
    type: 'Packing List',
    size: '640 KB',
    fields: [
      { label: 'Package Count', value: '24 Pallets (Shrink-wrapped)', confidence: 0.99 },
      { label: 'Total Gross Weight', value: '18,240.00 KGS', confidence: 0.98 },
      { label: 'Total Net Weight', value: '17,100.00 KGS', confidence: 0.95 },
      { label: 'Volume (CBM)', value: '58.40 CBM', confidence: 0.94 },
      { label: 'Discrepancy Check', value: 'Discrepancy: BL shows 22 pallets vs 24', confidence: 1.0, flagged: true, flagMessage: 'Cross-document mismatch detected!' },
    ],
  },
];

export const DocIntelView: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState(SAMPLE_DOCS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleSimulateOCR = (doc: (typeof SAMPLE_DOCS)[0]) => {
    setIsProcessing(true);
    setSelectedDoc(doc);
    setTimeout(() => {
      setIsProcessing(false);
    }, 600);
  };

  const copyToClipboard = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">AI Intelligence</span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              Confidence-Scored OCR
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">AI Document Intelligence</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Extracts structured data from Bills of Lading, Air Waybills, and Invoices. Low-confidence fields are flagged for review instead of silent auto-fill.
          </p>
        </div>

        <button
          onClick={() => alert('File upload simulated. Choose a sample document below to inspect extraction.')}
          className="flex items-center gap-1.5 rounded-xl bg-[#09192D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
        >
          <Upload className="h-4 w-4 text-[#E8472B]" />
          <span>Upload PDF or Image</span>
        </button>
      </div>

      {/* Document Selector Strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {SAMPLE_DOCS.map((doc) => (
          <button
            key={doc.id}
            onClick={() => handleSimulateOCR(doc)}
            className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
              selectedDoc.id === doc.id
                ? 'border-[#E8472B] bg-white shadow-xs'
                : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-600'
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">{doc.name}</div>
              <div className="text-[10px] text-slate-400">{doc.type} · {doc.size}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Main OCR Inspection Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document Raw Preview Simulator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900">Document Scan Preview</h4>
              <p className="text-[11px] text-slate-400">{selectedDoc.name}</p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
              PDF Rasterized
            </span>
          </div>

          {/* Document Simulated Page */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-[11px] leading-relaxed text-slate-700 min-h-[360px] overflow-x-auto">
            <div className="text-center font-bold pb-2 border-b border-slate-200 text-slate-900">
              MAERSK LINE — MULTIMODAL BILL OF LADING
            </div>
            <div className="pt-3 space-y-2">
              <div>
                <span className="text-slate-400">SHIPPER:</span>
                <div className="bg-yellow-100/70 px-1 font-bold">SHENZHEN TECHTRONICS EXPORT LTD</div>
              </div>
              <div>
                <span className="text-slate-400">CONSIGNEE:</span>
                <div className="bg-yellow-100/70 px-1 font-bold">AL FARIS TRADING LLC, DUBAI, UAE</div>
              </div>
              <div>
                <span className="text-slate-400">VESSEL / VOYAGE:</span>
                <div className="bg-yellow-100/70 px-1">MAERSK SEALAND / 419W</div>
              </div>
              <div>
                <span className="text-slate-400">CONTAINER / SEAL:</span>
                <div className="bg-yellow-100/70 px-1 font-bold">MSKU-8842190 / SEAL ML-884219</div>
              </div>
              <div>
                <span className="text-slate-400">GROSS WEIGHT / PALLETS:</span>
                <div className="bg-yellow-100/70 px-1 font-bold">18,240.00 KGS / 24 PALLETS</div>
              </div>
              <div>
                <span className="text-slate-400">DECLARED HS CODE:</span>
                <div className="bg-rose-100 px-1 font-bold text-rose-800">8471.49 [FLAGGED: 72% CONFIDENCE]</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right (2 cols): Extracted Structured Fields */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <h4 className="font-bold text-sm text-slate-900">
                AI Extracted Structured Data ({selectedDoc.fields.length} Fields)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">Average Confidence: 96.2%</span>
          </div>

          {isProcessing ? (
            <div className="flex h-64 items-center justify-center flex-col gap-2 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
              <span className="text-xs">Processing OCR and entity resolution...</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedDoc.fields.map((field, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                    field.flagged
                      ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                      : 'border-slate-200 bg-slate-50/40 text-slate-800'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">{field.label}:</span>
                      {field.flagged && (
                        <span className="rounded bg-rose-200 px-1.5 py-0.2 font-bold text-[9px] text-rose-900">
                          HUMAN ATTENTION REQUIRED
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 font-mono text-xs">{field.value}</div>
                    {field.flagMessage && (
                      <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{field.flagMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span
                      className={`rounded px-2 py-0.5 font-mono font-bold text-[10px] ${
                        field.confidence >= 0.95
                          ? 'bg-emerald-100 text-emerald-800'
                          : field.confidence >= 0.85
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800 font-black'
                      }`}
                    >
                      {(field.confidence * 100).toFixed(0)}% Confidence
                    </span>

                    <button
                      onClick={() => copyToClipboard(field.value, field.label)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition"
                      title="Copy value"
                    >
                      {copiedField === field.label ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* One-Click Save Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Auto-population targets: Shipment DB-1048 & Customs Case CUS-884219</span>
            <button
              onClick={() => alert('Extracted fields committed to shipment DB-1048. Discrepancy flags logged in audit trail.')}
              className="rounded-xl bg-[#E8472B] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
            >
              Commit Data to Active Shipment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
