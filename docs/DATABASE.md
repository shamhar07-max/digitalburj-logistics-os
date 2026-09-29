# Database Schema

## Overview

PostgreSQL 15+ with multi-tenant schema-per-tenant isolation.

## Shared Schema (Multi-Tenant)

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  country_code CHAR(2) DEFAULT 'AE',
  timezone VARCHAR(50) DEFAULT 'Asia/Dubai',
  currency VARCHAR(3) DEFAULT 'AED',
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- Custom fields, settings
);

-- Auth
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL, -- owner, sales, ops, customs, transport, warehouse, finance, admin, customer, partner
  avatar_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50), -- create, update, delete, view
  entity_type VARCHAR(50), -- job, quote, invoice, etc.
  entity_id VARCHAR(100),
  changes JSONB, -- Before/after delta
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX (tenant_id, created_at DESC),
  INDEX (entity_type, entity_id)
);
```

## Tenant Schemas (Isolated)

### Companies

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  registration_number VARCHAR(100),
  tax_id VARCHAR(50),
  country VARCHAR(2) DEFAULT 'AE',
  city VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  website VARCHAR(255),
  logo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE branches (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  location POINT, -- Latitude, longitude for Jebel Ali, Sharjah, etc.
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Sales

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE NOT NULL, -- DB-1048
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_name VARCHAR(255),
  customer_email VARCHAR(100),
  customer_phone VARCHAR(20),
  origin VARCHAR(100), -- Shanghai, Hong Kong
  destination VARCHAR(100), -- Dubai, Jebel Ali
  shipment_type VARCHAR(20), -- FCL, LCL, Air, Road
  estimated_weight_kg DECIMAL(12, 2),
  estimated_cbm DECIMAL(12, 4),
  estimated_value_aed DECIMAL(14, 2),
  description TEXT,
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Quoted, Won, Lost, Expired
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  INDEX (status, created_at DESC)
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE NOT NULL, -- DB-Q-1048-001
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id VARCHAR(50), -- External customer ref
  origin VARCHAR(100),
  destination VARCHAR(100),
  shipment_type VARCHAR(20),
  incoterm VARCHAR(20), -- CIF, FOB, etc.
  currency VARCHAR(3) DEFAULT 'AED',
  sell_price DECIMAL(14, 2) NOT NULL, -- AED 1,200–2,000
  buy_price DECIMAL(14, 2), -- Hidden from sales
  margin DECIMAL(14, 2), -- sell_price - buy_price
  margin_percent DECIMAL(5, 2),
  terms_conditions TEXT,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Sent, Accepted, Rejected, Expired
  created_by UUID REFERENCES users(id),
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  accepted_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX (status, created_at DESC)
);

CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  charge_type VARCHAR(50), -- Freight, Customs, Handling, Storage
  description VARCHAR(255),
  quantity DECIMAL(12, 2),
  unit_price DECIMAL(14, 2),
  amount DECIMAL(14, 2)
);
```

### Operations

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE NOT NULL, -- DB-1048
  quote_id UUID REFERENCES quotes(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id VARCHAR(50),
  origin VARCHAR(100),
  destination VARCHAR(100),
  shipment_type VARCHAR(20), -- FCL, LCL, Air, Road
  total_weight_kg DECIMAL(12, 2),
  total_cbm DECIMAL(12, 4),
  total_value_aed DECIMAL(14, 2),
  status VARCHAR(50) DEFAULT 'Booked', -- Booked, Confirmed, In Transit, Delivered, Invoiced
  priority VARCHAR(20) DEFAULT 'Normal', -- Low, Normal, High, Urgent
  assigned_to UUID REFERENCES users(id), -- Operations manager
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX (status, created_at DESC),
  INDEX (assigned_to)
);

CREATE TABLE legs (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  leg_number INT,
  transport_mode VARCHAR(20), -- Ocean, Rail, Road, Air
  origin VARCHAR(100),
  destination VARCHAR(100),
  departure_date TIMESTAMP,
  arrival_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Planned', -- Planned, Confirmed, In Transit, Arrived, Delayed
  carrier_name VARCHAR(100),
  vessel_flight_number VARCHAR(50),
  container_number VARCHAR(50),
  tracking_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name VARCHAR(100), -- "FCL Import Jebel Ali - Customs Hold"
  milestone_type VARCHAR(50), -- Pick, Consolidation, CFS, Customs, Departure, Arrival, Delivery
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Completed, At Risk, Blocked
  scheduled_date TIMESTAMP,
  actual_date TIMESTAMP,
  due_date TIMESTAMP,
  free_days_end TIMESTAMP, -- "Free time ends tomorrow"
  assignee_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX (status, due_date)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_type VARCHAR(50), -- BOL, Invoice, POD, Insurance, Customs Declaration
  file_name VARCHAR(255),
  file_url VARCHAR(255), -- S3 URL
  file_size_bytes INT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  is_public BOOLEAN DEFAULT FALSE, -- Visible to customer portal?
  metadata JSONB -- OCR data, AI insights
);
```

### Customs

```sql
CREATE TABLE customs_cases (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reference_number VARCHAR(50) UNIQUE,
  declaration_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Submitted, Cleared, Mismatch, Hold, Rejected
  risk_level VARCHAR(20), -- Low, Medium, High
  created_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  cleared_at TIMESTAMP
);

CREATE TABLE customs_checklist (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES customs_cases(id) ON DELETE CASCADE,
  item_description VARCHAR(255),
  hs_code VARCHAR(20),
  origin_country VARCHAR(2),
  declared_value_aed DECIMAL(14, 2),
  quantity INT,
  unit VARCHAR(20),
  is_hazmat BOOLEAN DEFAULT FALSE
);

CREATE TABLE customs_mismatches (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES customs_cases(id) ON DELETE CASCADE,
  mismatch_type VARCHAR(50), -- Weight, Description, HS Code, Origin, Value
  declared_value VARCHAR(100),
  customs_assessment VARCHAR(100),
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Transport

```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  driver_id UUID REFERENCES users(id),
  vehicle_id VARCHAR(50), -- License plate
  status VARCHAR(50) DEFAULT 'Unassigned', -- Unassigned, Assigned, In Progress, Completed, Cancelled
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_tasks (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  task_order INT,
  task_type VARCHAR(50), -- Pickup, Delivery, Consolidation
  location_address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Progress, Completed, Failed
  scheduled_time TIMESTAMP,
  actual_time TIMESTAMP,
  notes TEXT
);

CREATE TABLE pods (
  id UUID PRIMARY KEY,
  trip_task_id UUID NOT NULL REFERENCES trip_tasks(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Submitted, Verified, Rejected
  signature_url VARCHAR(255),
  photo_urls TEXT[], -- Array of URLs
  notes TEXT,
  submitted_at TIMESTAMP,
  verified_at TIMESTAMP,
  INDEX (status, submitted_at DESC)
);
```

### Warehouse

```sql
CREATE TABLE warehouse_inbound (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  received_date TIMESTAMP,
  received_by UUID REFERENCES users(id),
  item_count INT,
  weight_kg DECIMAL(12, 2),
  location_code VARCHAR(50), -- Zone A1, B3, etc.
  status VARCHAR(50) DEFAULT 'Received' -- Received, Sorted, Picked, Dispatched
);

CREATE TABLE warehouse_stock (
  id UUID PRIMARY KEY,
  inbound_id UUID REFERENCES warehouse_inbound(id),
  sku VARCHAR(100),
  item_description VARCHAR(255),
  quantity_received INT,
  quantity_available INT,
  quantity_allocated INT,
  location_code VARCHAR(50),
  last_counted TIMESTAMP
);

CREATE TABLE warehouse_picks (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id),
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'Pending' -- Pending, In Progress, Completed
);
```

### Finance

```sql
CREATE TABLE charges (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  charge_type VARCHAR(50), -- Freight, Customs, Handling, Storage, Commission
  description VARCHAR(255),
  charge_amount DECIMAL(14, 2),
  currency VARCHAR(3) DEFAULT 'AED',
  supplier_id VARCHAR(100), -- Vendor reference
  invoice_date TIMESTAMP,
  invoice_number VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Billed, Paid
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE NOT NULL, -- DB-INV-2024-001
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id VARCHAR(50),
  job_id UUID REFERENCES jobs(id),
  invoice_type VARCHAR(20) DEFAULT 'AR', -- AR (customer), AP (supplier)
  invoice_date TIMESTAMP,
  due_date TIMESTAMP,
  currency VARCHAR(3) DEFAULT 'AED',
  subtotal DECIMAL(14, 2),
  tax_amount DECIMAL(14, 2),
  total_amount DECIMAL(14, 2),
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Sent, Partial, Paid, Overdue
  created_by UUID REFERENCES users(id),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX (status, due_date)
);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  charge_id UUID REFERENCES charges(id),
  description VARCHAR(255),
  quantity DECIMAL(12, 2),
  unit_price DECIMAL(14, 2),
  amount DECIMAL(14, 2)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  reference_number VARCHAR(50) UNIQUE,
  invoice_id UUID REFERENCES invoices(id),
  payment_type VARCHAR(20), -- Incoming (from customer), Outgoing (to supplier)
  amount DECIMAL(14, 2),
  currency VARCHAR(3) DEFAULT 'AED',
  payment_date TIMESTAMP,
  payment_method VARCHAR(50), -- Bank transfer, Credit card, Cash
  bank_reference VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Verified, Rejected, Reconciled
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX (status, payment_date DESC)
);

CREATE TABLE bank_reconciliation (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  statement_date TIMESTAMP,
  statement_balance DECIMAL(14, 2),
  reconciled_balance DECIMAL(14, 2),
  variance DECIMAL(14, 2),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Reconciled, Variance
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  conversation_type VARCHAR(50), -- Internal, Customer, Partner
  is_visible_to_customer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_text TEXT,
  attachments TEXT[], -- Document URLs
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes & Performance

```sql
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at DESC);
CREATE INDEX idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX idx_milestones_due_date ON milestones(due_date, status);
CREATE INDEX idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX idx_charges_job_id ON charges(job_id);
CREATE INDEX idx_documents_job_id ON documents(job_id);
CREATE INDEX idx_audit_log_tenant_date ON audit_log(tenant_id, created_at DESC);
```

## Connection String

```
postgresql://user:password@localhost:5432/digitalburj_dev
```
