import { dutyOnCif, round2 } from '@digitalburj/shared';
import { badRequest } from '../lib/errors';
import type { Col, Resource } from './types';

const t = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'text', ...extra });
const num = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'num', ...extra });
const int = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'int', ...extra });
const date = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'date', ...extra });
const ts = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'ts', ...extra });
const uuid = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'uuid', ...extra });
const bool = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'bool', ...extra });
const json = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'json', ...extra });
const arr = (n: string, extra: Partial<Col> = {}): Col => ({ n, t: 'textarr', ...extra });

const customerPortal = (col: string | string[]) => (req: any, push: (v: any) => string) => {
  if (req.user?.baseRole !== 'customer') return null;
  const p = push(req.user.customerId || '00000000-0000-0000-0000-000000000000');
  const cols = Array.isArray(col) ? col : [col];
  return '(' + cols.map((c) => `t.${c} = ${p}`).join(' OR ') + ')';
};

export const resources: Resource[] = [
  // ── CRM ──
  {
    key: 'customers',
    table: 'customers',
    module: 'customers',
    cols: [
      t('code', { ro: true }),
      t('name', { req: true, max: 200 }),
      t('type', { enum: ['shipper', 'consignee', 'agent', 'broker', 'carrier', 'other'] }),
      t('trn', { max: 20 }),
      t('email', { max: 200 }), t('phone', { max: 40 }), t('address'), t('city', { max: 80 }), t('country', { max: 2 }), t('main_lane', { max: 120 }),
      num('credit_limit', { min: 0 }), int('credit_days', { min: 0, max: 365 }),
      t('status', { enum: ['active', 'hold', 'blocked'] }),
      uuid('owner_id'), arr('tags'), t('notes'),
    ],
    search: ['name', 'code', 'trn', 'email'],
    filters: ['type', 'status'],
    sort: 't.name ASC',
    ref: { col: 'code', prefix: 'CUS-', pad: 4, start: 1000 },
    select: `(SELECT COALESCE(SUM(i.total - i.paid),0) FROM invoices i WHERE i.customer_id=t.id AND i.status IN ('sent','partial','overdue')) AS outstanding,
             (SELECT count(*)::int FROM shipments s WHERE s.customer_id=t.id AND s.status NOT IN ('closed','cancelled','invoiced')) AS active_shipments`,
  },
  {
    key: 'contacts',
    table: 'contacts',
    module: 'customers',
    cols: [uuid('customer_id', { req: true }), t('name', { req: true }), t('email'), t('phone'), t('whatsapp'), t('role')],
    filters: ['customer_id'],
    search: ['name', 'email', 'phone'],
    sort: 't.name ASC',
  },
  {
    key: 'suppliers',
    table: 'suppliers',
    module: 'procurement',
    cols: [
      t('name', { req: true }), t('type', { enum: ['carrier', 'agent', 'trucker', 'customs_broker', 'warehouse', 'vendor'] }), t('trn'), t('email'), t('phone'), t('iban'),
      int('payment_days', { min: 0 }), num('rating', { min: 0, max: 5 }), t('status', { enum: ['active', 'inactive', 'blocked'] }),
    ],
    search: ['name', 'trn', 'email'],
    filters: ['type', 'status'],
    sort: 't.name ASC',
  },
  {
    key: 'deals',
    table: 'deals',
    module: 'pipeline',
    cols: [
      uuid('customer_id'), t('title', { req: true }), t('stage', { enum: ['lead', 'qualified', 'quoted', 'negotiation', 'won', 'lost'] }),
      num('value', { min: 0 }), t('currency', { max: 3 }), int('probability', { min: 0, max: 100 }), date('expected_close'), uuid('owner_id'),
      t('source'), t('lane'), t('mode'), t('lost_reason'), t('notes'), int('position'),
    ],
    search: ['title', 'lane'],
    filters: ['stage', 'owner_id', 'customer_id', 'source'],
    sort: 't.position ASC, t.created_at DESC',
    select: '(SELECT name FROM customers c WHERE c.id=t.customer_id) AS customer_name',
    beforeSave: (_c, d) => {
      const P: Record<string, number> = { lead: 10, qualified: 30, quoted: 50, negotiation: 75, won: 100, lost: 0 };
      if (d.stage && d.probability === undefined) d.probability = P[d.stage];
    },
  },
  {
    key: 'rates',
    table: 'rates',
    module: 'rates',
    cols: [
      uuid('supplier_id'), t('origin', { req: true }), t('destination', { req: true }), t('mode', { enum: ['sea_fcl', 'sea_lcl', 'air', 'road', 'multimodal'] }), t('container_type'),
      t('unit', { enum: ['container', 'kg', 'cbm', 'shipment', 'trip'] }), num('buy_rate', { min: 0 }), num('sell_rate', { min: 0 }), t('currency', { max: 3 }),
      json('surcharges'), int('transit_days', { min: 0 }), date('valid_from'), date('valid_to'), t('status', { enum: ['active', 'expired', 'draft'] }), t('notes'),
    ],
    search: ['origin', 'destination', 'container_type'],
    filters: ['mode', 'status', 'supplier_id', 'origin', 'destination'],
    sort: 't.origin ASC, t.destination ASC',
    select: `(SELECT name FROM suppliers s WHERE s.id=t.supplier_id) AS supplier_name,
             CASE WHEN t.sell_rate > 0 THEN round(((t.sell_rate - t.buy_rate) / t.sell_rate * 100)::numeric, 1) END AS margin_pct`,
    sensitive: ['buy_rate', 'margin_pct'],
  },

  // ── Shipments (create/status handled in routes/shipments.ts) ──
  {
    key: 'shipments',
    table: 'shipments',
    module: 'shipments',
    cols: [
      uuid('customer_id'), uuid('consignee_id'), t('carrier'), t('vessel'), t('voyage'), t('pol'), t('pod'), t('bl_number'), t('awb_number'), t('container_no'), t('container_type'), int('containers', { min: 0, max: 999 }),
      t('incoterm'), t('cargo_description'), t('hs_code'), int('pieces', { min: 0 }), num('weight_kg', { min: 0 }), num('volume_cbm', { min: 0 }), num('cargo_value', { min: 0 }),
      date('etd'), date('eta'), date('atd'), date('ata'), ts('free_days_end'), t('priority', { enum: ['low', 'normal', 'high', 'urgent'] }), uuid('ops_owner_id'),
      { n: 'status', t: 'text', ro: true }, { n: 'mode', t: 'text', ro: true }, { n: 'number', t: 'text', ro: true },
    ],
    search: ['number', 'container_no', 'bl_number', 'awb_number', 'cargo_description'],
    filters: ['status', 'mode', 'customer_id', 'priority', 'risk_level', 'ops_owner_id'],
    sort: 't.created_at DESC',
    entityScoped: true,
    disable: ['create', 'delete'],
    portal: customerPortal(['customer_id', 'consignee_id']),
    select: `(SELECT name FROM customers c WHERE c.id=t.customer_id) AS customer_name,
             (SELECT COALESCE(SUM(amount_aed),0) FROM charges ch WHERE ch.shipment_id=t.id AND ch.kind='revenue') AS revenue,
             (SELECT COALESCE(SUM(amount_aed),0) FROM charges ch WHERE ch.shipment_id=t.id AND ch.kind='cost') AS cost`,
    sensitive: ['cost'],
    event: 'shipment',
  },
  {
    key: 'documents',
    table: 'documents',
    module: 'documents',
    cols: [uuid('shipment_id'), uuid('customer_id'), t('type'), t('name', { req: true }), bool('is_public')],
    filters: ['shipment_id', 'customer_id', 'type', 'is_public', 'origin'],
    hidden: ['body_html', 'generated_data'],
    search: ['name', 'type', 'doc_no'],
    sort: 't.created_at DESC',
    disable: ['create'], // uploads handled by routes/documents.ts
    select: `(SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number`,
    portal: (req, push) => {
      if (req.user?.baseRole !== 'customer') return null;
      const p = push(req.user.customerId || '00000000-0000-0000-0000-000000000000');
      return `(t.is_public AND (t.customer_id = ${p} OR t.shipment_id IN (SELECT id FROM shipments WHERE customer_id = ${p} OR consignee_id = ${p})))`;
    },
  },
  {
    key: 'customs',
    table: 'customs_declarations',
    module: 'customs',
    cols: [
      uuid('shipment_id'), t('number', { req: true }), t('type', { enum: ['import', 'export', 'transit', 're_export'] }), t('hs_code'), t('description'),
      t('origin_country', { max: 2 }), num('cif_value', { min: 0 }), num('duty_rate', { min: 0, max: 100 }), num('duty_amount', { ro: true }),
      { n: 'status', t: 'text', ro: true }, uuid('broker_id'), t('hold_reason'), json('checklist'),
    ],
    search: ['number', 'hs_code', 'description'],
    filters: ['status', 'type', 'shipment_id'],
    sort: 't.created_at DESC',
    select: `(SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number`,
    beforeSave: (_c, d, existing) => {
      const cif = d.cif_value ?? existing?.cif_value;
      const rate = d.duty_rate ?? existing?.duty_rate ?? 5;
      if (cif !== undefined && cif !== null) d.duty_amount = dutyOnCif(Number(cif), Number(rate) / 100);
    },
    event: 'customs',
  },

  // ── Transport ──
  {
    key: 'vehicles',
    table: 'vehicles',
    module: 'drivers',
    cols: [t('plate', { req: true }), t('type'), int('capacity_kg', { min: 0 }), date('mulkiya_expiry'), date('insurance_expiry'), t('gps_device'), t('status', { enum: ['available', 'on_trip', 'at_gate', 'maintenance', 'retired'] }),
      t('make_model', { max: 120 }), int('year', { min: 1990, max: 2100 }), t('emirate', { max: 40 }), int('odometer_km', { min: 0 }), int('next_service_km', { min: 0 }), int('fuel_pct', { min: 0, max: 100 }), num('salik_balance', { min: 0 }), bool('civil_defense_permit'), t('current_location', { max: 200 })],
    search: ['plate', 'type'],
    filters: ['status', 'type'],
    sort: 't.plate ASC',
  },
  {
    key: 'drivers',
    table: 'drivers',
    module: 'drivers',
    cols: [uuid('user_id'), t('name', { req: true }), t('phone'), t('license_no'), date('license_expiry'), date('visa_expiry'), uuid('vehicle_id'), t('status', { enum: ['available', 'on_trip', 'off_duty', 'inactive'] }), num('rating', { min: 0, max: 5 })],
    search: ['name', 'phone', 'license_no'],
    filters: ['status'],
    sort: 't.name ASC',
    select: `(SELECT plate FROM vehicles v WHERE v.id=t.vehicle_id) AS vehicle_plate,
             (SELECT count(*)::int FROM trips tr WHERE tr.driver_id=t.id AND tr.status IN ('assigned','in_progress')) AS open_trips,
             (SELECT count(*)::int FROM pods p JOIN trip_stops ts ON ts.id=p.trip_stop_id JOIN trips tr ON tr.id=ts.trip_id WHERE tr.driver_id=t.id AND p.status='submitted') AS pods_pending`,
  },
  {
    key: 'trips',
    table: 'trips',
    module: 'dispatch',
    cols: [t('number', { ro: true }), uuid('driver_id'), uuid('vehicle_id'), t('status', { enum: ['unassigned', 'assigned', 'in_progress', 'completed', 'cancelled'] }), date('planned_date'), t('notes')],
    filters: ['status', 'driver_id', 'planned_date'],
    search: ['number'],
    sort: 't.planned_date DESC NULLS LAST, t.created_at DESC',
    entityScoped: true,
    ref: { col: 'number', prefix: 'TRP-', pad: 5, start: 0 },
    select: `(SELECT name FROM drivers d WHERE d.id=t.driver_id) AS driver_name,
             (SELECT plate FROM vehicles v WHERE v.id=t.vehicle_id) AS vehicle_plate,
             (SELECT count(*)::int FROM trip_stops s WHERE s.trip_id=t.id) AS stops,
             (SELECT count(*)::int FROM trip_stops s WHERE s.trip_id=t.id AND s.status='done') AS stops_done`,
    event: 'trip',
  },
  {
    key: 'trip-stops',
    table: 'trip_stops',
    module: 'dispatch',
    cols: [
      uuid('trip_id', { req: true }), uuid('shipment_id'), int('seq', { min: 1 }), t('kind', { enum: ['pickup', 'delivery'] }), t('address'), num('lat', { min: -90, max: 90 }), num('lng', { min: -180, max: 180 }),
      t('contact_name'), t('contact_phone'), ts('window_from'), ts('window_to'), t('notes'),
    ],
    filters: ['trip_id', 'shipment_id', 'status'],
    sort: 't.trip_id, t.seq ASC',
    dateCol: 'window_from',
    select: `(SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number`,
  },
  {
    key: 'pods',
    table: 'pods',
    module: 'dispatch',
    cols: [t('status', { enum: ['submitted', 'verified', 'rejected'] }), t('notes')],
    filters: ['status', 'shipment_id'],
    sort: 't.captured_at DESC',
    disable: ['create', 'delete'],
    select: `(SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number`,
  },
  {
    key: 'driver-expenses',
    table: 'driver_expenses',
    module: 'dispatch',
    cols: [t('status', { enum: ['pending', 'approved', 'rejected'] })],
    filters: ['status', 'driver_id', 'trip_id'],
    sort: 't.created_at DESC',
    disable: ['create', 'delete'],
    select: `(SELECT name FROM drivers d WHERE d.id=t.driver_id) AS driver_name`,
  },

  // ── Warehouse ──
  {
    key: 'warehouse/bins',
    table: 'warehouse_bins',
    module: 'warehouse',
    cols: [t('code', { req: true }), t('zone'), int('capacity_kg', { min: 0 }), t('status', { enum: ['active', 'blocked'] })],
    filters: ['zone', 'status'],
    search: ['code', 'zone'],
    sort: 't.code ASC',
    select: `(SELECT COALESCE(SUM(weight_kg),0) FROM warehouse_stock w WHERE w.bin_id=t.id AND w.status='stored') AS used_kg`,
  },
  {
    key: 'warehouse/stock',
    table: 'warehouse_stock',
    module: 'warehouse',
    cols: [uuid('bin_id'), uuid('shipment_id'), uuid('customer_id'), t('description', { req: true }), int('pieces', { min: 0 }), num('weight_kg', { min: 0 }), num('volume_cbm', { min: 0 }), t('status', { enum: ['stored', 'picked', 'released', 'discrepancy'] }), t('notes')],
    filters: ['status', 'bin_id', 'shipment_id', 'customer_id'],
    search: ['description'],
    sort: 't.received_at DESC',
    dateCol: 'received_at',
    select: `(SELECT code FROM warehouse_bins b WHERE b.id=t.bin_id) AS bin_code,
             (SELECT zone FROM warehouse_bins b WHERE b.id=t.bin_id) AS zone,
             (SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number,
             GREATEST(0, floor(extract(epoch FROM (COALESCE(t.released_at, now()) - t.received_at)) / 86400))::int AS days_stored`,
  },

  // ── Procurement ──
  {
    key: 'purchases',
    table: 'purchases',
    module: 'procurement',
    cols: [
      t('number', { ro: true }), t('kind', { enum: ['PR', 'PO'] }), uuid('supplier_id'), uuid('shipment_id'), t('description', { req: true }), t('category'), num('amount', { min: 0 }),
      t('currency', { max: 3 }), { n: 'status', t: 'text', ro: true }, date('needed_by'),
    ],
    filters: ['kind', 'status', 'supplier_id'],
    search: ['number', 'description'],
    sort: 't.created_at DESC',
    createdBy: false,
    ref: { col: 'number', prefix: 'PR-', pad: 4, start: 0 },
    select: `(SELECT name FROM suppliers s WHERE s.id=t.supplier_id) AS supplier_name`,
    beforeSave: (ctx, d, existing) => {
      if (existing && ['approved', 'ordered', 'received', 'billed'].includes(existing.status) && (d.amount !== undefined || d.supplier_id !== undefined)) {
        throw badRequest('Approved purchases cannot change amount or supplier');
      }
      if (!existing) d.requested_by = ctx.userId;
    },
  },

  // ── Accounting ──
  {
    key: 'accounts',
    table: 'accounts',
    module: 'accounting',
    cols: [t('code', { req: true, max: 10 }), t('name', { req: true }), t('type', { req: true, enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] }), t('subtype'), bool('is_bank'), bool('active')],
    filters: ['type', 'is_bank', 'active'],
    search: ['code', 'name'],
    sort: 't.code ASC',
    select: `(SELECT COALESCE(SUM(l.debit - l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE l.account_id=t.id AND e.status='posted') AS balance`,
    beforeDelete: async (ctx) => {
      // FK from journal_lines protects used accounts; nothing else needed
      void ctx;
    },
  },
  {
    key: 'invoices',
    table: 'invoices',
    module: 'invoices',
    cols: [t('notes'), date('due_date')],
    filters: ['status', 'customer_id', 'shipment_id', 'kind', 'asp_status'],
    search: ['number'],
    sort: 't.issue_date DESC, t.number DESC',
    dateCol: 'issue_date',
    entityScoped: true,
    disable: ['create', 'delete'],
    portal: customerPortal('customer_id'),
    select: `(SELECT name FROM customers c WHERE c.id=t.customer_id) AS customer_name,
             (SELECT number FROM shipments s WHERE s.id=t.shipment_id) AS shipment_number,
             (t.total - t.paid) AS outstanding,
             GREATEST(0, (current_date - t.due_date))::int AS days_overdue`,
    event: 'invoice',
  },
  {
    key: 'bills',
    table: 'bills',
    module: 'accounting',
    cols: [],
    filters: ['status', 'supplier_id', 'shipment_id'],
    search: ['number', 'supplier_ref'],
    sort: 't.bill_date DESC',
    dateCol: 'bill_date',
    entityScoped: true,
    disable: ['create', 'update', 'delete'],
    select: `(SELECT name FROM suppliers s WHERE s.id=t.supplier_id) AS supplier_name, (t.total - t.paid) AS outstanding`,
  },
  {
    key: 'payments',
    table: 'payments',
    module: 'accounting',
    cols: [],
    filters: ['kind', 'invoice_id', 'bill_id'],
    search: ['number', 'reference'],
    sort: 't.paid_at DESC, t.created_at DESC',
    dateCol: 'paid_at',
    entityScoped: true,
    disable: ['create', 'update', 'delete'],
    select: `(SELECT number FROM invoices i WHERE i.id=t.invoice_id) AS invoice_number`,
  },
  {
    key: 'journal-entries',
    table: 'journal_entries',
    module: 'accounting',
    cols: [],
    filters: ['source', 'status'],
    search: ['number', 'memo'],
    sort: 't.entry_date DESC, t.number DESC',
    dateCol: 'entry_date',
    entityScoped: true,
    disable: ['create', 'update', 'delete'],
    select: `(SELECT COALESCE(SUM(debit),0) FROM journal_lines l WHERE l.entry_id=t.id) AS total_debit`,
  },
  {
    key: 'bank-transactions',
    table: 'bank_transactions',
    module: 'accounting',
    cols: [uuid('account_id', { req: true }), date('txn_date', { req: true }), t('description'), num('amount', { req: true }), t('reference')],
    filters: ['account_id', 'status'],
    search: ['description', 'reference'],
    sort: 't.txn_date DESC, t.created_at DESC',
    dateCol: 'txn_date',
    select: `(SELECT name FROM accounts a WHERE a.id=t.account_id) AS account_name`,
  },

  // ── People ──
  {
    key: 'employees',
    table: 'employees',
    module: 'hrms',
    cols: [
      t('code', { ro: true }), t('name', { req: true }), t('department'), t('position'), t('nationality'), date('joined_on'),
      num('basic', { min: 0 }), num('housing', { min: 0 }), num('transport', { min: 0 }), num('other_allowance', { min: 0 }),
      t('person_id', { max: 14 }), t('labour_card_no'), t('bank_name'), t('routing_code', { max: 9 }), t('iban', { max: 23 }),
      date('visa_expiry'), date('passport_expiry'), date('eid_expiry'), t('status', { enum: ['active', 'on_leave', 'terminated'] }), uuid('user_id'),
    ],
    search: ['name', 'code', 'department', 'position'],
    filters: ['department', 'status'],
    sort: 't.name ASC',
    entityScoped: true,
    ref: { col: 'code', prefix: 'EMP-', pad: 3, start: 0 },
    select: `(t.basic + t.housing + t.transport + t.other_allowance) AS gross`,
  },
  {
    key: 'leave-requests',
    table: 'leave_requests',
    module: 'hrms',
    cols: [uuid('employee_id', { req: true }), t('kind', { enum: ['annual', 'sick', 'unpaid', 'maternity', 'compassionate', 'hajj'] }), date('from_date', { req: true }), date('to_date', { req: true }), num('days', { min: 0.5 }), t('reason')],
    filters: ['employee_id', 'status', 'kind'],
    sort: 't.from_date DESC',
    dateCol: 'from_date',
    select: `(SELECT name FROM employees e WHERE e.id=t.employee_id) AS employee_name`,
    beforeSave: (_c, d) => {
      if (d.from_date && d.to_date && d.to_date < d.from_date) throw badRequest('End date must be after start date');
      if (d.from_date && d.to_date && d.days === undefined) d.days = Math.round((Date.parse(d.to_date) - Date.parse(d.from_date)) / 86400000) + 1;
    },
  },
  {
    key: 'attendance',
    table: 'attendance',
    module: 'hrms',
    cols: [uuid('employee_id', { req: true }), date('work_date', { req: true }), t('check_in'), t('check_out'), t('status', { enum: ['present', 'absent', 'late', 'leave', 'holiday'] })],
    filters: ['employee_id', 'status', 'work_date'],
    sort: 't.work_date DESC',
    dateCol: 'work_date',
    select: `(SELECT name FROM employees e WHERE e.id=t.employee_id) AS employee_name`,
  },
  {
    key: 'projects',
    table: 'projects',
    module: 'projects',
    cols: [t('code', { ro: true }), t('name', { req: true }), uuid('customer_id'), uuid('owner_id'), t('status', { enum: ['planned', 'active', 'on_hold', 'completed', 'cancelled'] }), date('start_date'), date('end_date'), num('budget', { min: 0 }), int('progress', { min: 0, max: 100 }), t('description')],
    filters: ['status', 'customer_id'],
    search: ['name', 'code'],
    sort: 't.created_at DESC',
    ref: { col: 'code', prefix: 'PRJ-', pad: 3, start: 0 },
    select: `(SELECT name FROM customers c WHERE c.id=t.customer_id) AS customer_name,
             (SELECT count(*)::int FROM project_tasks x WHERE x.project_id=t.id) AS tasks,
             (SELECT count(*)::int FROM project_tasks x WHERE x.project_id=t.id AND x.status='done') AS tasks_done,
             (SELECT COALESCE(SUM(hours),0) FROM timesheets x WHERE x.project_id=t.id) AS hours_logged`,
  },
  {
    key: 'project-tasks',
    table: 'project_tasks',
    module: 'projects',
    cols: [uuid('project_id', { req: true }), t('title', { req: true }), uuid('assignee_id'), t('status', { enum: ['todo', 'doing', 'done'] }), date('due_date'), num('hours_est', { min: 0 }), num('hours_logged', { min: 0 }), bool('is_milestone')],
    filters: ['project_id', 'status', 'assignee_id'],
    sort: 't.created_at ASC',
  },
  {
    key: 'timesheets',
    table: 'timesheets',
    module: 'projects',
    cols: [uuid('project_id'), uuid('task_id'), uuid('user_id'), date('work_date'), num('hours', { req: true, min: 0.1, max: 24 }), t('note')],
    filters: ['project_id', 'user_id'],
    sort: 't.work_date DESC',
    dateCol: 'work_date',
    beforeSave: (ctx, d, existing) => {
      if (!existing && !d.user_id) d.user_id = ctx.userId;
    },
  },

  // ── Intelligence / growth ──
  {
    key: 'workflows',
    table: 'workflows',
    module: 'automation',
    cols: [t('name', { req: true }), t('trigger_event', { req: true }), json('conditions'), json('actions'), bool('enabled')],
    filters: ['enabled', 'trigger_event'],
    sort: 't.created_at DESC',
  },
  {
    key: 'courses',
    table: 'courses',
    module: 'academy',
    cols: [t('title', { req: true }), t('category'), t('level', { enum: ['beginner', 'intermediate', 'advanced'] }), num('duration_hrs', { min: 0 }), t('description'), bool('certificate')],
    filters: ['category', 'level'],
    search: ['title', 'category'],
    sort: 't.created_at DESC',
    select: `(SELECT count(*)::int FROM enrollments e WHERE e.course_id=t.id) AS enrolled`,
  },
  {
    key: 'talent',
    table: 'talent',
    module: 'talent',
    cols: [t('name', { req: true }), t('headline'), arr('skills'), bool('verified'), num('rating', { min: 0, max: 5 }), num('rate_per_day', { min: 0 }), t('availability', { enum: ['available', 'busy', 'unavailable'] }), t('contact'), t('notes')],
    filters: ['verified', 'availability'],
    search: ['name', 'headline'],
    sort: 't.rating DESC NULLS LAST',
  },
  {
    key: 'growth-metrics',
    table: 'growth_metrics',
    module: 'growth',
    cols: [t('metric', { req: true }), num('score', { req: true, min: 0, max: 100 }), date('period'), t('notes')],
    filters: ['metric'],
    sort: 't.period DESC, t.created_at DESC',
    dateCol: 'period',
  },
  // ── Fleet equipment, carrier capacity and pools (Modal Hub inputs) ──
  {
    key: 'equipment',
    table: 'equipment',
    module: 'dispatch',
    cols: [
      t('code', { req: true, max: 40 }),
      t('category', { req: true, enum: ['road_chassis', 'reefer_genset', 'sea_container', 'air_uld'] }),
      t('type', { req: true, max: 160 }), t('specs'), int('tare_kg', { min: 0 }), int('max_payload_kg', { min: 0 }), t('location', { max: 200 }),
      t('status', { enum: ['operational', 'attached', 'maintenance', 'depot'] }), t('assigned_to', { max: 200 }), date('last_inspection'),
    ],
    filters: ['category', 'status'],
    search: ['code', 'type', 'location'],
    sort: 't.category, t.code',
  },
  {
    key: 'capacity-allocations',
    table: 'capacity_allocations',
    module: 'shipments',
    cols: [
      t('mode', { req: true, enum: ['sea', 'air'] }), t('carrier', { req: true, max: 120 }), t('vessel', { max: 120 }), t('voyage', { req: true, max: 40 }), t('route', { max: 160 }),
      ts('cutoff_at', { req: true }), num('allocated', { req: true, min: 0 }), num('other_booked', { min: 0 }), t('unit', { req: true, enum: ['TEU', 'kg'] }), t('notes'),
    ],
    filters: ['mode', 'unit'],
    search: ['carrier', 'vessel', 'voyage', 'route'],
    sort: 't.cutoff_at ASC',
  },
  {
    key: 'equipment-pools',
    table: 'equipment_pools',
    module: 'shipments',
    cols: [
      t('mode', { req: true, enum: ['sea', 'air'] }), t('kind', { enum: ['equipment', 'yard', 'cold_chain'] }), t('code', { req: true, max: 40 }), t('label', { req: true, max: 160 }),
      int('total', { req: true, min: 0 }), int('in_use', { min: 0 }), int('damaged', { min: 0 }), t('unit', { max: 20 }), int('sort'),
    ],
    filters: ['mode', 'kind'],
    search: ['code', 'label'],
    sort: 't.mode, t.sort, t.code',
  },
];

// resource keys with '/' are mounted as-is (e.g. /api/warehouse/bins)
export const resourceByKey = new Map(resources.map((r) => [r.key, r]));
export { round2 };
