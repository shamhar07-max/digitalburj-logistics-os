/**
 * DigitalBurj Logistics OS — TypeScript Definitions
 */

export type RoleType =
  | 'owner'
  | 'manager'
  | 'sales'
  | 'ops'
  | 'customs'
  | 'finance'
  | 'dispatch'
  | 'driver'
  | 'warehouse'
  | 'hr'
  | 'customer'
  | 'partner'
  | 'admin';

export type TransportMode = 'Sea FCL' | 'Sea LCL' | 'Air' | 'Road GCC' | 'Rail';
export type ShipmentStatus = 'booked' | 'in_transit' | 'customs_hold' | 'cleared' | 'out_for_delivery' | 'delivered' | 'billing_ready' | 'closed';
export type HealthStatus = 'ok' | 'warn' | 'risk';

export interface Milestone {
  id: string;
  title: string;
  location: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'pending' | 'warning';
  notes?: string;
  verifiedBy?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: 'BL' | 'AWB' | 'Commercial Invoice' | 'Packing List' | 'COO' | 'Delivery Order' | 'POD' | 'Customs Declaration';
  status: 'verified' | 'pending' | 'missing' | 'mismatch';
  version: string;
  uploadedAt: string;
  confidenceScore?: number; // 0 to 1
  fileUrl?: string;
  source: 'customer' | 'ai_extraction' | 'broker' | 'driver' | 'staff';
}

export interface Shipment {
  id: string;
  jobNo: string;
  customer: string;
  shipper: string;
  consignee: string;
  service: string;
  mode: TransportMode;
  direction: 'Import' | 'Export' | 'Cross-trade' | 'Domestic';
  origin: string;
  originPortCode: string;
  destination: string;
  destPortCode: string;
  status: ShipmentStatus;
  health: HealthStatus;
  eta: string;
  etd: string;
  freeTimeEnds: string;
  carrier: string;
  vesselFlight?: string;
  containerOrAwb: string;
  sealNo?: string;
  piecesWeight: string;
  revenue: number;
  cost: number;
  margin: number;
  owner: string;
  exceptionNotice?: string;
  predictiveRisk?: string;
  progressPercent: number;
  milestones: Milestone[];
  documents: DocumentItem[];
  branch: string;
}

export interface Quote {
  id: string;
  quoteNo: string;
  customer: string;
  lane: string;
  mode: TransportMode;
  validUntil: string;
  equipment: string;
  buyCost: number;
  sellPrice: number;
  marginPercent: number;
  marginFloorPercent: number;
  status: 'draft' | 'needs_approval' | 'approved' | 'sent' | 'accepted' | 'rejected' | 'won';
  owner: string;
  version: string;
  sourceChannel: 'WhatsApp' | 'Email' | 'Portal' | 'Direct Call';
  comparableHistory?: {
    avgMarginOnLane: number;
    similarQuotesCount: number;
    winRatePercent: number;
  };
}

export interface Deal {
  id: string;
  title: string;
  customer: string;
  value: number;
  stage: 'lead' | 'qualified' | 'rfq' | 'proposal' | 'negotiation' | 'won' | 'lost';
  priority: 'hot' | 'warm' | 'cold';
  owner: string;
  closesDate: string;
  lane: string;
  mode: TransportMode;
}

export interface CustomsDeclaration {
  id: string;
  caseNo: string;
  shipmentId: string;
  regime: 'Import' | 'Export' | 'Import for Re-Export' | 'Transit';
  port: string;
  emirate: 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Jebel Ali Freezone';
  brokerName: string;
  hsCode: string;
  hsDescription: string;
  declarationRef: string;
  status: 'submitted' | 'under_review' | 'hold' | 'cleared' | 'rejected';
  holdReason?: string;
  managerSignoffRequired: boolean;
  managerSignedBy?: string;
  checklist: { name: string; complete: boolean }[];
  dutyAmount: number;
  vatAmount: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  shipmentId?: string;
  customer: string;
  customerTrn: string;
  branch: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vatRate: number; // 0.05 or 0 for zero-rated export
  vatAmount: number;
  total: number;
  paidAmount: number;
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';
  aspStatus: 'pending' | 'submitted' | 'cleared' | 'rejected';
  aspUuid?: string;
  qrPayload?: string;
  lineItems: {
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    isVatExempt?: boolean;
  }[];
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  role: string;
  department: 'Operations' | 'Sales' | 'Finance' | 'Transport' | 'Customs' | 'Warehouse' | 'Management';
  basicSalary: number;
  allowances: number;
  totalSalary: number;
  iban: string;
  wpsStatus: 'registered' | 'pending' | 'exempt';
  visaExpiry: string;
  emiratesIdExpiry: string;
  passportExpiry: string;
  joinedDate: string;
  status: 'active' | 'on_leave' | 'terminated';
}

export interface DriverTrip {
  id: string;
  tripNo: string;
  shipmentId: string;
  driverName: string;
  vehiclePlate: string;
  pickupLocation: string;
  pickupTime: string;
  deliveryLocation: string;
  deliveryTime: string;
  cargoDetails: string;
  status: 'assigned' | 'en_route_pickup' | 'picked_up' | 'in_transit' | 'waiting' | 'delivered';
  waitingHours: number;
  proposedWaitingCharge?: number;
  podCaptured: boolean;
  podSignatureUrl?: string;
  podPhotoUrl?: string;
  podGpsCoords?: { lat: number; lng: number };
  podTimestamp?: string;
  recipientName?: string;
  notes?: string;
}

export interface CompetitorProfile {
  id: string;
  name: string;
  tier: 'enterprise' | 'midmarket' | 'uae' | 'india';
  tierLabel: string;
  hq: string;
  pricingModel: string;
  pricingSummary: string;
  description: string;
  criticalGap: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
  threatLevel: 'High' | 'Medium' | 'Low' | 'None';
  riskNote: string;
}

export interface MatrixRow {
  category: string;
  feature: string;
  cargoWise: 'yes' | 'partial' | 'no';
  goFreight: 'yes' | 'partial' | 'no';
  logitude: 'yes' | 'partial' | 'no';
  magaya: 'yes' | 'partial' | 'no';
  shipsy: 'yes' | 'partial' | 'no';
  newage: 'yes' | 'partial' | 'no';
  syntrack: 'yes' | 'partial' | 'no';
  zealit: 'yes' | 'partial' | 'no';
  logiSys: 'yes' | 'partial' | 'no';
  fresa: 'yes' | 'partial' | 'no';
  digitalBurj: 'yes';
  isKeyDifferentiator?: boolean;
}

export interface CriticalGap {
  number: string;
  title: string;
  description: string;
  verdict: string;
  isHighOpportunity: boolean;
  timeToCopyMonths: number;
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  iconName: string;
  description: string;
  capabilities: string[];
  sampleQuestions: string[];
  sampleResponses: Record<string, string>;
}

export interface ApprovalItem {
  id: string;
  type: 'Margin Override' | 'Credit Limit Increase' | 'Customs Hold Release' | 'Vendor Bill Variance' | 'High Value Invoice';
  referenceId: string;
  requestedBy: string;
  amountOrMargin: string;
  reason: string;
  revision: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface UnifiedMessage {
  id: string;
  contactName: string;
  contactAvatar: string;
  channel: 'whatsapp' | 'email' | 'portal' | 'phone';
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  shipmentRef?: string;
  thread: {
    id: string;
    sender: 'user' | 'contact' | 'system';
    text: string;
    timestamp: string;
    channel: string;
    aiDrafted?: boolean;
  }[];
}

export interface ComplianceAuditRecord {
  id: string;
  shipmentId: string;
  jobNo: string;
  customer: string;
  mode: TransportMode;
  lane: string;
  complianceScore: number; // 0 to 100
  complianceGrade: 'A+' | 'A' | 'B' | 'C' | 'F';
  status: 'Fully Compliant' | 'Action Needed' | 'Critical Risk';
  verifiedDocsCount: number;
  mandatoryDocsTotal: number;
  checklist: {
    name: string;
    description: string;
    isPresent: boolean;
    isStampedOrVerified: boolean;
    status: 'Verified' | 'Missing' | 'Mismatch' | 'Pending Review';
    penaltyRisk?: string;
  }[];
  customsStatus: 'Cleared' | 'Hold (Action Required)' | 'Inspection Scheduled' | 'Pending Manifest Submission';
  declarationRef: string;
  portAuthority: string;
  dutyPaidStatus: 'Paid / Exempt' | 'Pending Payment' | 'Under Review';
  lastAuditCheck: string;
  fixRecommendation: string;
}

export interface CompetitorCargoMetric {
  id: string;
  competitorName: string;
  monthlyTeuVolume: number; // TEUs per month handled in UAE
  smeMarketSharePct: number; // % of UAE SME Forwarders
  avgDeploymentDays: number; // Days to go live
  monthlyCostAed: number; // 10 users software cost
  uaeComplianceScore: number; // 0 to 100%
  color: string;
  highlight?: boolean;
}

export interface Partner {
  id: string;
  name: string;
  category: 'customer' | 'carrier' | 'broker' | 'warehouse';
  typeLabel: string;
  trn: string;
  tradeLicenseNo: string;
  licenseExpiry: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  paymentTerms: 'Net 15' | 'Net 30' | 'Net 60' | 'COD' | 'Letter of Credit';
  creditLimit: number;
  outstandingBalance: number;
  kycStatus: 'verified' | 'pending' | 'expired';
  accountManager: string;
  rating: number; // 1 to 5
}

export interface VendorBill {
  id: string;
  billNo: string;
  vendorName: string;
  vendorTrn: string;
  shipmentJobNo: string;
  category: 'Ocean Freight' | 'Air Freight' | 'Terminal Handling' | 'Customs Duty' | 'Trucking' | 'Storage';
  billDate: string;
  dueDate: string;
  estimatedCost: number;
  billedAmount: number;
  varianceAmount: number;
  varianceStatus: 'matched' | 'variance_flag' | 'approved';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  vatAmount: number;
}

export interface WarehouseBin {
  id: string;
  binCode: string;
  zone: 'Ambient Dry' | 'Cold Storage (2-8°C)' | 'Dangerous Goods (DG)' | 'Cross-Dock Staging';
  capacityPallets: number;
  occupiedPallets: number;
  currentJobNo?: string;
  customerName?: string;
  cargoDescription?: string;
  intakeDate?: string;
  gatePassNo?: string;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance';
}

export interface OperationalDocumentRecord {
  id: string;
  documentCode: 'HBL' | 'MBL' | 'COMM_INV' | 'PACKING_LIST' | 'COO' | 'CUSTOMS_BILL' | 'DELIVERY_ORDER' | 'GATE_PASS' | 'POD';
  documentName: string;
  shipmentJobNo: string;
  customerName: string;
  issuer: string;
  issuedAt: string;
  validUntil?: string;
  status: 'draft' | 'issued' | 'verified' | 'missing' | 'stamped' | 'rejected';
  referenceNo: string;
  mandatory: boolean;
  pinCode?: string;
  verifiedBy?: string;
  notes?: string;
}

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE_STATUS'
  | 'UPDATE_DATA'
  | 'DELETE'
  | 'AUTO_GENERATE'
  | 'APPROVE'
  | 'REJECT'
  | 'OVERRIDE';

export interface AuditDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  module: 'Shipments' | 'Sales RFQ' | 'Booking' | 'Customs' | 'WMS' | 'Finance' | 'Compliance' | 'Admin' | 'Partners' | 'Documents';
  action: string;
  actionType: AuditActionType;
  user: string;
  recordRef: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  diffs?: AuditDiff[];
  ipAddress?: string;
  branch?: string;
  complianceReason?: string;
}

export interface GeneratedDocument {
  id: string;
  documentType: 'HBL' | 'PACKING_LIST' | 'COMMERCIAL_INVOICE';
  title: string;
  documentNo: string;
  shipmentJobNo: string;
  generatedAt: string;
  triggeredBy: string;
  version: string;
  parties: {
    shipper: { name: string; address: string; trn?: string; contact?: string };
    consignee: { name: string; address: string; trn?: string; contact?: string };
    notifyParty?: { name: string; address: string };
  };
  transport: {
    carrier: string;
    vesselOrFlight: string;
    pol: string;
    pod: string;
    placeOfDelivery: string;
    etd: string;
    eta: string;
    mode: TransportMode;
  };
  cargoDetails: {
    containerNo: string;
    sealNo: string;
    marksAndNumbers: string;
    packageCount: number;
    packageType: string;
    grossWeightKg: number;
    netWeightKg: number;
    volumeCbm: number;
    description: string;
    hsCode?: string;
  };
  financials?: {
    currency: string;
    incoterms: string;
    items: { description: string; hsCode: string; qty: number; unitPrice: number; total: number }[];
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    paymentTerms: string;
  };
  clauses: string[];
  securityHash: string;
}

export interface FleetVehicle {
  id: string;
  plateNo: string;
  emirate: 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ras Al Khaimah';
  vehicleType: '40ft Heavy Tractor Head' | '3-Ton Pickup' | '7-Ton Box Truck' | 'Reefer Chiller Truck' | 'Flatbed 50T Trailer';
  makeModel: string;
  year: number;
  assignedDriver: string;
  driverPhone: string;
  driverLicenseNo: string;
  odometerKm: number;
  fuelLevelPercent: number;
  salikBalanceAed: number;
  status: 'in_transit' | 'available' | 'at_port_gate' | 'maintenance' | 'idling';
  currentLocation: string;
  destination?: string;
  mulkiyaExpiry: string;
  insuranceExpiry: string;
  civilDefensePermit: boolean;
  nextServiceKm: number;
}

export interface FleetEquipment {
  id: string;
  equipmentCode: string;
  category: 'road_chassis' | 'reefer_genset' | 'sea_container' | 'air_uld';
  type: string;
  specifications: string;
  tareWeightKg: number;
  maxPayloadKg: number;
  location: string;
  status: 'operational' | 'attached_to_truck' | 'maintenance' | 'depot_storage';
  assignedVehicleOrJob?: string;
  lastInspectionDate: string;
}

export interface RoadTripDispatch {
  id: string;
  tripNo: string;
  jobNo: string;
  vehiclePlate: string;
  driverName: string;
  chassisCode: string;
  containerNo?: string;
  origin: string;
  destination: string;
  cargoWeightKg: number;
  estimatedDieselAed: number;
  salikBudgetAed: number;
  tripStatus: 'scheduled' | 'dispatched' | 'gate_in_completed' | 'delivered' | 'empty_returned';
  departureTime: string;
  eta: string;
}



export interface InternalQuotation {
  id: string;
  internalRef: string;
  customerName: string;
  lane: string;
  mode: TransportMode;
  commodity: string;
  equipmentOrWeight: string;
  carrierOptions: {
    carrierName: string;
    transitDays: number;
    freeDaysAtPort: number;
    buyRate: number;
    sellRate: number;
    marginPct: number;
    selected: boolean;
  }[];
  costBreakdown: {
    itemCode: string;
    description: string;
    vendorOrAuthority: string;
    unitBuy: number;
    unitSell: number;
    quantity: number;
    totalBuy: number;
    totalSell: number;
    profit: number;
  }[];
  totalBuyCost: number;
  totalSellPrice: number;
  grossProfit: number;
  marginPercent: number;
  belowFloor: boolean;
  approvalStatus: 'approved' | 'pending_approval' | 'draft';
  preparedBy: string;
  validUntil: string;
  convertedToQuoteNo?: string;
}

export interface ReceiptVoucher {
  id: string;
  receiptNo: string;
  type: 'customer_receipt' | 'payment_voucher' | 'petty_cash';
  partyName: string;
  amount: number;
  currency: string;
  paymentMethod: 'Bank Wire (IBAN)' | 'Cheque' | 'Credit Card' | 'Cash';
  referenceNo: string;
  allocatedInvoices: { invoiceNo: string; amount: number }[];
  bankAccount: string;
  date: string;
  status: 'cleared' | 'pending_clearance' | 'cancelled';
  notes: string;
  receivedBy: string;
}

export interface CustomsDepositRefund {
  id: string;
  declarationRef: string;
  jobNo: string;
  depositType: 'Transit Guarantee' | 'Import for Re-Export 5%' | 'Inspection Deposit';
  amount: number;
  paidDate: string;
  proofSubmitted: boolean;
  exitBillNo?: string;
  refundStatus: 'pending_exit_proof' | 'submitted_to_customs' | 'refund_approved' | 'refunded';
  claimDeadline: string;
}




// ─────────────────────────────────────────────────────────────────────────────
// Operational Velocity (Quote Accepted → Document Generation) & Modal Hub
// ─────────────────────────────────────────────────────────────────────────────

/** Sea / Air / Road grouping used by mode-level analytics. Rail is tracked but has no lane of its own. */
export type ModeGroup = 'Sea' | 'Air' | 'Road';

export type VelocityHoldReason = 'missing_trn' | 'carrier_portal' | 'terminal_slot';

/**
 * One converted order with the timestamps needed to measure Quote Accepted → Document Generation.
 * All timestamps are ISO-8601 and must be non-decreasing in the order listed; records that violate this are
 * excluded from analytics (and counted) instead of producing negative durations.
 */
export interface VelocityRecord {
  id: string;
  jobNo: string;
  quoteNo: string;
  customer: string;
  mode: TransportMode;
  lane: string;
  acceptedAt: string;
  jobCreatedAt: string;
  carrierConfirmedAt: string;
  docsGeneratedAt: string;
  /** Downstream of document generation; shown for context, never counted in the metric. */
  customsValidatedAt?: string;
  holdReason?: VelocityHoldReason;
}
