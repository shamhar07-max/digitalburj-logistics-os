/** State machines + milestone templates. Shared so UI can show only legal next actions. */

export type Mode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road' | 'multimodal';
export const MODES: { value: Mode; label: string }[] = [
  { value: 'sea_fcl', label: 'Sea FCL' },
  { value: 'sea_lcl', label: 'Sea LCL' },
  { value: 'air', label: 'Air' },
  { value: 'road', label: 'Road' },
  { value: 'multimodal', label: 'Multimodal' },
];

export const SHIPMENT_STATUSES = [
  'booked', 'confirmed', 'in_transit', 'arrived', 'customs', 'cleared', 'out_for_delivery', 'delivered', 'invoiced', 'closed', 'cancelled',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['arrived'],
  arrived: ['customs', 'out_for_delivery'],
  customs: ['cleared'],
  cleared: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['invoiced'],
  invoiced: ['closed'],
  closed: [],
  cancelled: [],
};

export const canTransition = <T extends string>(map: Record<string, T[]>, from: string, to: string) =>
  (map[from] || []).includes(to as T);

export const QUOTE_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired'] as const;
export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'approved', 'sent'],
  pending_approval: ['approved', 'draft', 'rejected'],
  approved: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: [],
  rejected: ['draft'],
  expired: ['draft'],
};

export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'] as const;

export const DEAL_STAGES = ['lead', 'qualified', 'quoted', 'negotiation', 'won', 'lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const DEAL_STAGE_PROB: Record<DealStage, number> = { lead: 10, qualified: 30, quoted: 50, negotiation: 75, won: 100, lost: 0 };

export const CUSTOMS_STATUSES = ['draft', 'submitted', 'under_review', 'hold', 'cleared', 'rejected'] as const;
export const CUSTOMS_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'cleared', 'hold', 'rejected'],
  under_review: ['cleared', 'hold', 'rejected'],
  hold: ['under_review', 'cleared', 'rejected'],
  rejected: ['draft'],
  cleared: [],
};

export const TRIP_STATUSES = ['unassigned', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;

/** Milestone templates keyed by mode: { code, name, offsetDays } */
export const MILESTONE_TEMPLATES: Record<Mode, { code: string; name: string; offsetDays: number }[]> = {
  sea_fcl: [
    { code: 'booking', name: 'Booking confirmed', offsetDays: 0 },
    { code: 'gate_in', name: 'Container gate-in at origin', offsetDays: 3 },
    { code: 'departure', name: 'Vessel departure', offsetDays: 5 },
    { code: 'arrival', name: 'Vessel arrival (Jebel Ali)', offsetDays: 20 },
    { code: 'customs', name: 'Customs clearance', offsetDays: 22 },
    { code: 'delivery', name: 'Delivery to consignee', offsetDays: 24 },
    { code: 'pod', name: 'POD received', offsetDays: 25 },
  ],
  sea_lcl: [
    { code: 'booking', name: 'Booking confirmed', offsetDays: 0 },
    { code: 'cfs_in', name: 'Cargo received at origin CFS', offsetDays: 3 },
    { code: 'departure', name: 'Consol departure', offsetDays: 7 },
    { code: 'arrival', name: 'Consol arrival', offsetDays: 24 },
    { code: 'devanning', name: 'Devanning at destination CFS', offsetDays: 26 },
    { code: 'customs', name: 'Customs clearance', offsetDays: 27 },
    { code: 'delivery', name: 'Delivery to consignee', offsetDays: 29 },
    { code: 'pod', name: 'POD received', offsetDays: 30 },
  ],
  air: [
    { code: 'booking', name: 'Booking confirmed', offsetDays: 0 },
    { code: 'cargo_received', name: 'Cargo received at origin', offsetDays: 1 },
    { code: 'departure', name: 'Flight departure', offsetDays: 2 },
    { code: 'arrival', name: 'Flight arrival (DXB/DWC)', offsetDays: 3 },
    { code: 'customs', name: 'Customs clearance', offsetDays: 4 },
    { code: 'delivery', name: 'Delivery to consignee', offsetDays: 5 },
    { code: 'pod', name: 'POD received', offsetDays: 6 },
  ],
  road: [
    { code: 'booking', name: 'Booking confirmed', offsetDays: 0 },
    { code: 'pickup', name: 'Pickup', offsetDays: 1 },
    { code: 'border', name: 'Border crossing', offsetDays: 2 },
    { code: 'customs', name: 'Customs clearance', offsetDays: 3 },
    { code: 'delivery', name: 'Delivery to consignee', offsetDays: 4 },
    { code: 'pod', name: 'POD received', offsetDays: 5 },
  ],
  multimodal: [
    { code: 'booking', name: 'Booking confirmed', offsetDays: 0 },
    { code: 'origin_pickup', name: 'Origin pickup', offsetDays: 2 },
    { code: 'main_carriage', name: 'Main carriage departure', offsetDays: 5 },
    { code: 'arrival', name: 'Arrival at destination hub', offsetDays: 20 },
    { code: 'customs', name: 'Customs clearance', offsetDays: 22 },
    { code: 'delivery', name: 'Last-mile delivery', offsetDays: 24 },
    { code: 'pod', name: 'POD received', offsetDays: 25 },
  ],
};

/** Map shipment status -> milestone code auto-completed when that status is reached. */
export const STATUS_MILESTONE: Partial<Record<ShipmentStatus, string[]>> = {
  confirmed: ['booking'],
  in_transit: ['departure', 'main_carriage', 'pickup', 'gate_in', 'cfs_in', 'cargo_received', 'origin_pickup'],
  arrived: ['arrival', 'border', 'devanning'],
  cleared: ['customs'],
  delivered: ['delivery'],
};

export const DOC_TYPES = ['BL', 'AWB', 'CMR', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'COO', 'DO', 'CUSTOMS_DECLARATION', 'INSURANCE', 'POD', 'OTHER'] as const;

export const CHARGE_TYPES = [
  'freight', 'thc', 'baf', 'customs_clearance', 'duty', 'disbursement', 'trucking', 'handling', 'storage', 'demurrage', 'detention', 'documentation', 'insurance', 'other',
] as const;
