-- 003: features merged in from the prototype, rebuilt on real data.

-- Generated documents (HBL / HAWB / CMR / Packing List / Commercial Invoice) are stored in the database so they
-- survive on hosts with ephemeral disks. `generated_at` is what the Operational Velocity report measures.
ALTER TABLE documents
  ADD COLUMN origin text NOT NULL DEFAULT 'upload' CHECK (origin IN ('upload','generated')),
  ADD COLUMN doc_no text,
  ADD COLUMN version int NOT NULL DEFAULT 1,
  ADD COLUMN generated_at timestamptz,
  ADD COLUMN body_html text,
  ADD COLUMN generated_data jsonb;
CREATE INDEX documents_generated_idx ON documents (tenant_id, shipment_id) WHERE origin = 'generated';

-- Shipments: container count (for TEU), and a booking-confirmation audit trail.
ALTER TABLE shipments
  ADD COLUMN containers int NOT NULL DEFAULT 1 CHECK (containers >= 0),
  ADD COLUMN booking_confirmed_by uuid;

-- Fleet register depth.
ALTER TABLE vehicles
  ADD COLUMN make_model text,
  ADD COLUMN year int,
  ADD COLUMN emirate text,
  ADD COLUMN odometer_km int NOT NULL DEFAULT 0,
  ADD COLUMN next_service_km int,
  ADD COLUMN fuel_pct int CHECK (fuel_pct BETWEEN 0 AND 100),
  ADD COLUMN salik_balance numeric(12,2),
  ADD COLUMN civil_defense_permit boolean NOT NULL DEFAULT false,
  ADD COLUMN current_location text;

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  category text NOT NULL CHECK (category IN ('road_chassis','reefer_genset','sea_container','air_uld')),
  type text NOT NULL,
  specs text,
  tare_kg int,
  max_payload_kg int,
  location text,
  status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','attached','maintenance','depot')),
  assigned_to text,
  last_inspection date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX equipment_cat_idx ON equipment (tenant_id, category);

-- Space we hold with carriers: vessel slots (TEU) and airline allotments (kg). `other_booked` is what is already
-- committed by bookings that are not job records in this system; live jobs are added on top at read time.
CREATE TABLE capacity_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('sea','air')),
  carrier text NOT NULL,
  vessel text,
  voyage text NOT NULL,           -- voyage number (sea) or flight number (air)
  route text,
  cutoff_at timestamptz NOT NULL,
  allocated numeric(12,2) NOT NULL CHECK (allocated >= 0),
  other_booked numeric(12,2) NOT NULL DEFAULT 0 CHECK (other_booked >= 0),
  unit text NOT NULL CHECK (unit IN ('TEU','kg')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capacity_cutoff_idx ON capacity_allocations (tenant_id, mode, cutoff_at);

-- Equipment / yard / cold-chain pools for the sea and air lanes.
CREATE TABLE equipment_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('sea','air')),
  kind text NOT NULL DEFAULT 'equipment' CHECK (kind IN ('equipment','yard','cold_chain')),
  code text NOT NULL,
  label text NOT NULL,
  total int NOT NULL CHECK (total >= 0),
  in_use int NOT NULL DEFAULT 0 CHECK (in_use >= 0),
  damaged int NOT NULL DEFAULT 0 CHECK (damaged >= 0),
  unit text NOT NULL DEFAULT 'units',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mode, code)
);

-- Branch sticky notes.
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent','info')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_idx ON notes (tenant_id, entity_id, created_at DESC);
