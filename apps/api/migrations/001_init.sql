-- DigitalBurj Logistics OS — core schema (row-level multi-tenancy: every table carries tenant_id)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ───────────────────────── Platform / identity ─────────────────────────
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  trn text,
  trade_license text,
  country char(2) NOT NULL DEFAULT 'AE',
  currency char(3) NOT NULL DEFAULT 'AED',
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan text NOT NULL DEFAULT 'growth',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  branch text,
  trn text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  base_role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  phone text,
  role text NOT NULL,
  customer_id uuid,
  supplier_id uuid,
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login timestamptz,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_tenant_idx ON users (tenant_id);
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  changes jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_entity_idx ON audit_log (tenant_id, entity_type, entity_id);

CREATE TABLE counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  body text,
  level text NOT NULL DEFAULT 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_idx ON notifications (tenant_id, user_id, created_at DESC);

CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- ───────────────────────── CRM / Sales ─────────────────────────
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'shipper',
  trn text,
  email text,
  phone text,
  address text,
  city text,
  country char(2) DEFAULT 'AE',
  main_lane text,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  credit_days int NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  owner_id uuid,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX customers_tenant_idx ON customers (tenant_id, name);
CREATE TRIGGER customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  whatsapp text,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_customer_idx ON contacts (tenant_id, customer_id);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'carrier',
  trn text,
  email text,
  phone text,
  iban text,
  payment_days int NOT NULL DEFAULT 30,
  rating numeric(3,1),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX suppliers_tenant_idx ON suppliers (tenant_id, name);
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'lead',
  value numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'AED',
  probability int NOT NULL DEFAULT 10,
  expected_close date,
  owner_id uuid,
  source text,
  lane text,
  mode text,
  lost_reason text,
  quote_id uuid,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deals_stage_idx ON deals (tenant_id, stage);
CREATE TRIGGER deals_updated BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  mode text NOT NULL DEFAULT 'sea_fcl',
  container_type text,
  unit text NOT NULL DEFAULT 'container',
  buy_rate numeric(14,2) NOT NULL DEFAULT 0,
  sell_rate numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'AED',
  surcharges jsonb NOT NULL DEFAULT '[]'::jsonb,
  transit_days int,
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rates_lane_idx ON rates (tenant_id, origin, destination, mode);
CREATE TRIGGER rates_updated BEFORE UPDATE ON rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'sea_fcl',
  origin text,
  destination text,
  incoterm text,
  cargo_description text,
  weight_kg numeric(12,2),
  volume_cbm numeric(12,3),
  containers text,
  currency char(3) NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  cost_total numeric(14,2) NOT NULL DEFAULT 0,
  margin_pct numeric(6,2) NOT NULL DEFAULT 0,
  valid_until date,
  status text NOT NULL DEFAULT 'draft',
  terms text,
  notes text,
  approval_id uuid,
  shipment_id uuid,
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX quotes_status_idx ON quotes (tenant_id, status);
CREATE TRIGGER quotes_updated BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  charge_type text NOT NULL DEFAULT 'freight',
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  tax_code char(1) NOT NULL DEFAULT 'S',
  supplier_id uuid,
  sort int NOT NULL DEFAULT 0
);
CREATE INDEX quote_items_idx ON quote_items (quote_id);

-- ───────────────────────── Operations ─────────────────────────
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id),
  consignee_id uuid REFERENCES customers(id),
  mode text NOT NULL DEFAULT 'sea_fcl',
  status text NOT NULL DEFAULT 'booked',
  origin text,
  destination text,
  pol text,
  pod text,
  carrier text,
  vessel text,
  voyage text,
  bl_number text,
  awb_number text,
  container_no text,
  container_type text,
  incoterm text,
  cargo_description text,
  hs_code text,
  pieces int,
  weight_kg numeric(12,2),
  volume_cbm numeric(12,3),
  cargo_value numeric(14,2),
  currency char(3) NOT NULL DEFAULT 'AED',
  etd date,
  eta date,
  atd date,
  ata date,
  free_days_end timestamptz,
  priority text NOT NULL DEFAULT 'normal',
  ops_owner_id uuid,
  risk_level text NOT NULL DEFAULT 'low',
  risk_reason text,
  tracking_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number),
  UNIQUE (tracking_token)
);
CREATE INDEX shipments_status_idx ON shipments (tenant_id, status);
CREATE INDEX shipments_customer_idx ON shipments (tenant_id, customer_id);
CREATE INDEX shipments_container_idx ON shipments (tenant_id, container_no);
CREATE TRIGGER shipments_updated BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE quotes ADD CONSTRAINT quotes_shipment_fk FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL;

CREATE TABLE milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  due_at timestamptz,
  done_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  assignee_id uuid,
  notes text,
  sort int NOT NULL DEFAULT 0
);
CREATE INDEX milestones_idx ON milestones (shipment_id, sort);

CREATE TABLE charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('revenue','cost')),
  charge_type text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  supplier_id uuid,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'AED',
  fx_rate numeric(12,6) NOT NULL DEFAULT 1,
  amount_aed numeric(14,2) NOT NULL DEFAULT 0,
  tax_code char(1) NOT NULL DEFAULT 'S',
  invoice_id uuid,
  bill_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX charges_shipment_idx ON charges (tenant_id, shipment_id);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'OTHER',
  name text NOT NULL,
  mime text,
  size int,
  storage_key text,
  is_public boolean NOT NULL DEFAULT false,
  extracted jsonb,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_shipment_idx ON documents (tenant_id, shipment_id);

CREATE TABLE customs_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  number text NOT NULL,
  type text NOT NULL DEFAULT 'import',
  hs_code text,
  description text,
  origin_country char(2),
  cif_value numeric(14,2) NOT NULL DEFAULT 0,
  duty_rate numeric(5,2) NOT NULL DEFAULT 5,
  duty_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  broker_id uuid,
  hold_reason text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX customs_status_idx ON customs_declarations (tenant_id, status);
CREATE TRIGGER customs_updated BEFORE UPDATE ON customs_declarations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Transport
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plate text NOT NULL,
  type text NOT NULL DEFAULT 'truck',
  capacity_kg int,
  mulkiya_expiry date,
  insurance_expiry date,
  gps_device text,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, plate)
);

CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  license_no text,
  license_expiry date,
  visa_expiry date,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available',
  rating numeric(3,1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  driver_id uuid REFERENCES drivers(id),
  vehicle_id uuid REFERENCES vehicles(id),
  status text NOT NULL DEFAULT 'unassigned',
  planned_date date,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX trips_driver_idx ON trips (tenant_id, driver_id, planned_date);

CREATE TABLE trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  seq int NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'delivery',
  address text,
  lat numeric(10,7),
  lng numeric(10,7),
  contact_name text,
  contact_phone text,
  window_from timestamptz,
  window_to timestamptz,
  status text NOT NULL DEFAULT 'pending',
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text
);
CREATE INDEX trip_stops_trip_idx ON trip_stops (trip_id, seq);

CREATE TABLE pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_stop_id uuid REFERENCES trip_stops(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  signed_by text,
  signature_key text,
  photo_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  lat numeric(10,7),
  lng numeric(10,7),
  captured_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted',
  verified_by uuid,
  client_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pods_client_uq ON pods (tenant_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE driver_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'fuel',
  amount numeric(12,2) NOT NULL,
  note text,
  receipt_key text,
  status text NOT NULL DEFAULT 'pending',
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX driver_expenses_client_uq ON driver_expenses (tenant_id, client_id) WHERE client_id IS NOT NULL;

-- Warehouse
CREATE TABLE warehouse_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  zone text,
  capacity_kg int,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, code)
);

CREATE TABLE warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bin_id uuid REFERENCES warehouse_bins(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  description text NOT NULL,
  pieces int NOT NULL DEFAULT 0,
  weight_kg numeric(12,2),
  volume_cbm numeric(12,3),
  received_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  status text NOT NULL DEFAULT 'stored',
  notes text
);
CREATE INDEX warehouse_stock_idx ON warehouse_stock (tenant_id, status);

CREATE TABLE warehouse_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES warehouse_stock(id) ON DELETE CASCADE,
  kind text NOT NULL,
  qty int,
  from_bin uuid,
  to_bin uuid,
  note text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Procurement / Finance ─────────────────────────
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number text NOT NULL,
  kind text NOT NULL DEFAULT 'PR' CHECK (kind IN ('PR','PO')),
  supplier_id uuid REFERENCES suppliers(id),
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  description text NOT NULL,
  category text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'AED',
  status text NOT NULL DEFAULT 'draft',
  approval_id uuid,
  requested_by uuid,
  needed_by date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE TRIGGER purchases_updated BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  subtype text,
  is_bank boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  kind text NOT NULL DEFAULT 'tax_invoice' CHECK (kind IN ('tax_invoice','credit_note')),
  original_invoice_id uuid,
  customer_id uuid NOT NULL REFERENCES customers(id),
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT current_date,
  currency char(3) NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  asp_status text NOT NULL DEFAULT 'not_submitted',
  asp_ref text,
  asp_submitted_at timestamptz,
  xml text,
  notes text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX invoices_status_idx ON invoices (tenant_id, status, due_date);
CREATE INDEX invoices_customer_idx ON invoices (tenant_id, customer_id);
CREATE TRIGGER invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  charge_id uuid,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  tax_code char(1) NOT NULL DEFAULT 'S',
  net numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX invoice_items_idx ON invoice_items (invoice_id);

CREATE TABLE bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  supplier_ref text,
  bill_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT current_date,
  currency char(3) NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('receipt','payment')),
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  customer_id uuid,
  supplier_id uuid,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  paid_at date NOT NULL DEFAULT current_date,
  bank_account_id uuid REFERENCES accounts(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  number text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  memo text,
  source text NOT NULL DEFAULT 'manual',
  source_id uuid,
  status text NOT NULL DEFAULT 'posted',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX journal_date_idx ON journal_entries (tenant_id, entry_date);
CREATE INDEX journal_source_idx ON journal_entries (tenant_id, source, source_id);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id),
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  customer_id uuid,
  supplier_id uuid,
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX journal_lines_entry_idx ON journal_lines (entry_id);
CREATE INDEX journal_lines_acct_idx ON journal_lines (tenant_id, account_id);

CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id),
  txn_date date NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  reference text,
  matched_payment_id uuid,
  status text NOT NULL DEFAULT 'unmatched',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_txn_idx ON bank_transactions (tenant_id, account_id, status);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  amount numeric(14,2),
  priority text NOT NULL DEFAULT 'normal',
  required_permission text NOT NULL DEFAULT 'approvals',
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approvals_status_idx ON approvals (tenant_id, status);

-- ───────────────────────── People ─────────────────────────
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  code text NOT NULL,
  name text NOT NULL,
  department text,
  position text,
  nationality text,
  joined_on date,
  basic numeric(12,2) NOT NULL DEFAULT 0,
  housing numeric(12,2) NOT NULL DEFAULT 0,
  transport numeric(12,2) NOT NULL DEFAULT 0,
  other_allowance numeric(12,2) NOT NULL DEFAULT 0,
  person_id text,
  labour_card_no text,
  bank_name text,
  routing_code text,
  iban text,
  visa_expiry date,
  passport_expiry date,
  eid_expiry date,
  status text NOT NULL DEFAULT 'active',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'annual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric(5,1) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  approval_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in time,
  check_out time,
  status text NOT NULL DEFAULT 'present',
  UNIQUE (employee_id, work_date)
);

CREATE TABLE payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id),
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  approval_id uuid,
  approved_by uuid,
  sif_generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_id, period)
);

CREATE TABLE payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  basic numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) NOT NULL DEFAULT 0,
  overtime numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net numeric(12,2) NOT NULL DEFAULT 0,
  days_worked int NOT NULL DEFAULT 30,
  leave_days int NOT NULL DEFAULT 0,
  notes text
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  budget numeric(14,2) NOT NULL DEFAULT 0,
  progress int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid,
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  hours_est numeric(6,1) NOT NULL DEFAULT 0,
  hours_logged numeric(6,1) NOT NULL DEFAULT 0,
  is_milestone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES project_tasks(id) ON DELETE SET NULL,
  user_id uuid,
  work_date date NOT NULL DEFAULT current_date,
  hours numeric(5,2) NOT NULL,
  note text
);

-- ───────────────────────── Intelligence / comms / growth ─────────────────────────
CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  run_count int NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  result jsonb,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  contact_name text,
  channel text NOT NULL DEFAULT 'whatsapp',
  external_id text,
  subject text,
  status text NOT NULL DEFAULT 'open',
  unread int NOT NULL DEFAULT 0,
  assigned_to uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX threads_idx ON threads (tenant_id, last_message_at DESC);
CREATE INDEX threads_ext_idx ON threads (tenant_id, channel, external_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out','note')),
  sender text,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel text,
  status text NOT NULL DEFAULT 'sent',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON messages (thread_id, created_at);
CREATE UNIQUE INDEX messages_ext_uq ON messages (tenant_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  level text NOT NULL DEFAULT 'beginner',
  duration_hrs numeric(5,1),
  description text,
  certificate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  progress int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'enrolled',
  completed_at timestamptz,
  UNIQUE (course_id, user_id)
);

CREATE TABLE talent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  headline text,
  skills text[] NOT NULL DEFAULT '{}',
  verified boolean NOT NULL DEFAULT false,
  rating numeric(3,1),
  rate_per_day numeric(10,2),
  availability text NOT NULL DEFAULT 'available',
  contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  score numeric(6,2) NOT NULL,
  period date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE doc_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  doc_type text,
  filename text,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(4,2),
  engine text NOT NULL DEFAULT 'rules',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
