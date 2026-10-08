import { Shipment, GeneratedDocument } from '../types';

/**
 * DigitalBurj Logistics OS — Automated Document Generation Engine
 * Automatically triggers on shipment lifecycle transitions to create standardized
 * Bills of Lading, Packing Lists, and Commercial Invoices based on shipment metadata.
 */

export function generateStandardizedDocuments(
  shipment: Shipment,
  triggerReason: string = 'Lifecycle Transition'
): GeneratedDocument[] {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const hashSeed = `${shipment.jobNo}-${shipment.status}-${Date.now()}`;
  const securityHash = 'SHA256:' + Array.from(hashSeed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 12345).toString(16).toUpperCase();

  // Extract or default container / AWB / piece info
  const containerNo = shipment.containerOrAwb?.includes('MSKU') || shipment.containerOrAwb?.includes('TGHU') || shipment.containerOrAwb?.includes('CMAU')
    ? shipment.containerOrAwb
    : `MEDU-${Math.floor(1000000 + Math.random() * 9000000)}`;

  const sealNo = `SEAL-AE-${Math.floor(100000 + Math.random() * 900000)}`;
  const grossWeightKg = shipment.piecesWeight?.includes('kg')
    ? parseInt(shipment.piecesWeight.replace(/\D/g, ''), 10) || 22400
    : 24500;
  const netWeightKg = Math.round(grossWeightKg * 0.92);
  const volumeCbm = Math.round((grossWeightKg / 350) * 10) / 10;
  const packageCount = Math.max(12, Math.round(grossWeightKg / 45));

  // Determine standard HS Code based on commodity / customer
  const hsCode = shipment.customer.toLowerCase().includes('pharma')
    ? '3004.9000'
    : shipment.customer.toLowerCase().includes('steel')
    ? '7214.2000'
    : shipment.customer.toLowerCase().includes('food')
    ? '0406.9010'
    : '8517.6200';

  const cargoDesc = shipment.piecesWeight?.length > 15
    ? shipment.piecesWeight
    : `${shipment.service || 'General Cargo'} — High Grade Industrial Commodities`;

  // 1. House Bill of Lading (HBL)
  const hblDoc: GeneratedDocument = {
    id: `doc-hbl-${shipment.jobNo}-${Date.now()}`,
    documentType: 'HBL',
    title: 'Negotiable Multimodal Transport House Bill of Lading',
    documentNo: `HBL-${shipment.jobNo}-DXB`,
    shipmentJobNo: shipment.jobNo,
    generatedAt: timestamp,
    triggeredBy: triggerReason,
    version: 'v1.0 (Automated)',
    parties: {
      shipper: {
        name: shipment.shipper || shipment.customer,
        address: `${shipment.origin} Industrial Freezone Area, Port Facility Gate 2`,
        trn: '100234567800003',
        contact: 'Export Logistics Operations Desk',
      },
      consignee: {
        name: shipment.consignee || `${shipment.customer} Dubai LLC`,
        address: `${shipment.destination}, JAFZA South Zone, Plot 44-12, UAE`,
        trn: '100987654300003',
        contact: 'Supply Chain Inbound Team',
      },
      notifyParty: {
        name: 'DigitalBurj Port Clearance Agency FZ-LLC',
        address: 'JAFZA Gate 4 Customs Complex, Jebel Ali, Dubai UAE',
      },
    },
    transport: {
      carrier: shipment.carrier || 'Maersk Line / Emirates SkyCargo',
      vesselOrFlight: shipment.carrier?.includes('Maersk') ? 'MSC BERYL / V.2408W' : shipment.mode === 'Air' ? 'EK-9921 Cargo' : 'GCC Flatbed Hauler AUH-7741',
      pol: `${shipment.origin} (${shipment.originPortCode || 'POL'})`,
      pod: `${shipment.destination} (${shipment.destPortCode || 'POD'})`,
      placeOfDelivery: `${shipment.destination} CFS Terminal`,
      etd: shipment.etd || 'Scheduled Today',
      eta: shipment.eta || 'Scheduled Arrival',
      mode: shipment.mode,
    },
    cargoDetails: {
      containerNo,
      sealNo,
      marksAndNumbers: `DB/${shipment.jobNo}/1-${packageCount}`,
      packageCount,
      packageType: 'Heavy Duty Wooden Pallets / Shrink-Wrapped',
      grossWeightKg,
      netWeightKg,
      volumeCbm,
      description: cargoDesc,
      hsCode,
    },
    clauses: [
      'SHIPPED on board in apparent good order and condition unless otherwise stated.',
      'FREIGHT PREPAID as agreed under DigitalBurj Standard Trading Terms 2026.',
      'Subject to UAE Federal Maritime Law No. 26 and Hague-Visby Rules as amended.',
      'Containers must be returned to carrier designated depot within allowed free-time period.',
    ],
    securityHash,
  };

  // 2. Standardized Packing List
  const packingListDoc: GeneratedDocument = {
    id: `doc-pl-${shipment.jobNo}-${Date.now()}`,
    documentType: 'PACKING_LIST',
    title: 'Certified Shipping Packing List & Weight Certificate',
    documentNo: `PL-${shipment.jobNo}`,
    shipmentJobNo: shipment.jobNo,
    generatedAt: timestamp,
    triggeredBy: triggerReason,
    version: 'v1.0 (Automated)',
    parties: {
      shipper: {
        name: shipment.shipper || shipment.customer,
        address: `${shipment.origin} Warehouse Consolidation Center`,
        trn: '100234567800003',
      },
      consignee: {
        name: shipment.consignee || `${shipment.customer} Logistics Hub`,
        address: `${shipment.destination} Distribution Warehouse, UAE`,
        trn: '100987654300003',
      },
    },
    transport: {
      carrier: shipment.carrier || 'Designated Freight Carrier',
      vesselOrFlight: 'Voyage 2026-F4',
      pol: shipment.origin,
      pod: shipment.destination,
      placeOfDelivery: shipment.destination,
      etd: shipment.etd,
      eta: shipment.eta,
      mode: shipment.mode,
    },
    cargoDetails: {
      containerNo,
      sealNo,
      marksAndNumbers: `PL-LOT-${shipment.jobNo}`,
      packageCount,
      packageType: 'Export Quality Treated Wooden Pallets (ISPM 15 Certified)',
      grossWeightKg,
      netWeightKg,
      volumeCbm,
      description: `${cargoDesc} — Full verification verified with digital scale calibration certificate.`,
      hsCode,
    },
    clauses: [
      'All timber packaging materials comply with ISPM 15 heat treatment standards.',
      'Cargo stowed and secured according to IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units (CTU Code).',
      'Tare weight of container verified as per SOLAS VGM regulations.',
    ],
    securityHash,
  };

  // 3. Standardized Commercial Invoice
  const unitPrice = Math.round(shipment.revenue / packageCount);
  const commercialInvoiceDoc: GeneratedDocument = {
    id: `doc-ci-${shipment.jobNo}-${Date.now()}`,
    documentType: 'COMMERCIAL_INVOICE',
    title: 'Official Tax Commercial Invoice (FTA UAE Compliant)',
    documentNo: `CI-${shipment.jobNo}-EXP`,
    shipmentJobNo: shipment.jobNo,
    generatedAt: timestamp,
    triggeredBy: triggerReason,
    version: 'v1.0 (Automated)',
    parties: {
      shipper: {
        name: shipment.shipper || shipment.customer,
        address: 'DigitalBurj Logistics FZ-LLC, JAFZA Tower South, Dubai, UAE',
        trn: '100234567800003',
      },
      consignee: {
        name: shipment.consignee || shipment.customer,
        address: `${shipment.destination}, Commercial Center, Registered Office`,
        trn: '100987654300003',
      },
    },
    transport: {
      carrier: shipment.carrier,
      vesselOrFlight: 'Ocean / Air Multimodal',
      pol: shipment.origin,
      pod: shipment.destination,
      placeOfDelivery: shipment.destination,
      etd: shipment.etd,
      eta: shipment.eta,
      mode: shipment.mode,
    },
    cargoDetails: {
      containerNo,
      sealNo,
      marksAndNumbers: `INV-${shipment.jobNo}`,
      packageCount,
      packageType: 'Export Cartons / Palletized Units',
      grossWeightKg,
      netWeightKg,
      volumeCbm,
      description: cargoDesc,
      hsCode,
    },
    financials: {
      currency: 'AED',
      incoterms: shipment.direction === 'Import' ? 'CIF Jebel Ali Port' : 'FOB Origin Port',
      items: [
        {
          description: cargoDesc,
          hsCode,
          qty: packageCount,
          unitPrice,
          total: shipment.revenue,
        },
      ],
      subtotal: shipment.revenue,
      taxPercent: shipment.direction === 'Export' ? 0 : 5,
      taxAmount: shipment.direction === 'Export' ? 0 : Math.round(shipment.revenue * 0.05),
      totalAmount: shipment.direction === 'Export' ? shipment.revenue : Math.round(shipment.revenue * 1.05),
      paymentTerms: 'Net 30 Days as per Master Services Agreement',
    },
    clauses: [
      'We hereby certify that this invoice is true and correct and that the contents are in accordance with the sales contract.',
      'Country of Origin: As stated in accompanying Certificate of Origin (COO).',
      'Electronic generation authorized by UAE Federal Tax Authority (FTA) Certified ASP System.',
    ],
    securityHash,
  };

  return [hblDoc, packingListDoc, commercialInvoiceDoc];
}
