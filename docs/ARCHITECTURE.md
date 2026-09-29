# Architecture Overview

## System Design

DigitalBurj Logistics OS is a **multi-tenant, role-based SaaS platform** designed for UAE-based freight forwarders.

### Core Principles

1. **Multi-Tenant Isolation** – Each company/organization has isolated data via PostgreSQL schemas
2. **Role-Based Access Control** – 10 user roles with granular permission matrices
3. **Audit Trail** – Every action logged for compliance and troubleshooting
4. **Real-Time Updates** – WebSocket for dashboard, notifications, driver tracking
5. **Offline-First Mobile** – Driver app works offline, syncs when connected
6. **Document-Centric** – All jobs linked to source documents (BOLs, invoices, PODs)
7. **Workflow Engines** – Customizable approval & automation rules per tenant
8. **Integration-Ready** – Hooks for carriers (DHL, FedEx), customs (GDECD), banks

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Web App (React)  │  Mobile Driver  │  Customer Portal      │
│  (Dashboard,      │  (Trip mgmt,    │  (Tracking, docs,    │
│   Operations)     │   POD, offline) │   invoices)           │
└─────────────────────────────────────────────────────────────┘
              ↓ (REST API + WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  (Auth, Rate Limiting, Request Validation)                 │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Sales Service    │  Ops Service      │  Finance Service    │
│  (Leads, Quotes)  │  (Jobs, Milestones│  (Invoices, AP/AR) │
│                   │   Dispatch)       │                      │
│  Customs Service  │  Transport Service│  Warehouse Service   │
│  (Cases, Rules)   │  (Trips, Drivers) │  (Stock, Picking)   │
└─────────────────────────────────────────────────────────────┘
              ↓ (SQL + Cache)
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL          │  Redis            │  File Storage     │
│  (Multi-schema)      │  (Cache, Queue)   │  (S3/Local)       │
└─────────────────────────────────────────────────────────────┘
```

## Database Strategy

### Multi-Tenancy

- **Schema-per-tenant** approach for security & compliance
- Shared auth/identity schema
- Automatic schema selection via tenant middleware

### Entity Relationships

```
Company
  ├── Users (Roles: Owner, Sales, Ops, Customs, Transport, Warehouse, Finance, Admin, Customer, Partner)
  ├── Leads (RFQ, Status: Draft, Quoted, Won, Lost)
  ├── Quotes (Status: Draft, Sent, Accepted, Rejected, Expired)
  ├── Jobs (Status: Quote, Booked, Confirmed, In Transit, Delivered, Invoiced)
  │   ├── Shipments (FCL, LCL, Air, Road)
  │   ├── Legs (Ocean, Rail, Road, Air segments)
  │   ├── Milestones (Pick, Consolidation, CFS, Customs, Departure, Arrival, Delivery)
  │   ├── Documents (BOL, Invoice, POD, Insurance, Customs)
  │   ├── Containers (Tracking, Status)
  │   ├── Charges (Freight, Customs, Storage, Handling, Commission)
  │   └── Conversations (Internal notes, Customer messages)
  ├── Customs Cases (Declarations, Checklists, Mismatches, Submissions)
  ├── Trips (Driver assignments, Status, Route)
  ├── PODs (Proof of Delivery, Photos, Signature)
  ├── Invoices (Customer, AP, AR, Status: Draft, Sent, Partial, Paid)
  ├── Payments (Incoming, Outgoing, Reconciliation)
  └── AuditLog (All changes, who, when, what)
```

## Authentication & Authorization

### JWT-Based Auth

```
Login → JWT Token (user_id, tenant_id, roles, permissions)
  ↓
Every Request → Verify Token → Extract Tenant → Load Tenant Schema
  ↓
Row-Level Security → Check Role Permissions → Filter Data
```

### Permission Levels

- **Tenant Admin** – All users, settings, integrations
- **Owner** – Financial decisions, approvals, KPIs
- **Sales** – Lead/quote management (hide buy rates)
- **Ops** – Job lifecycle, milestone tracking
- **Customs** – Declaration compliance, mismatch resolution
- **Transport** – Dispatch, driver tracking, POD
- **Warehouse** – Inventory, picking, counting
- **Finance** – Costing, invoicing, AR/AP, reconciliation
- **Customer** – Own jobs only, docs, invoices
- **Partner** – Assigned tasks only, document upload

## API Design

### RESTful Endpoints

```
# Sales
GET    /api/leads              – List leads (paginated, filtered)
GET    /api/leads/:id           – Lead detail + conversation
POST   /api/leads               – Create lead
POST   /api/quotes              – Build quote
GET    /api/quotes/:id/compare  – Compare rates/terms
POST   /api/quotes/:id/send     – Send to customer

# Operations
GET    /api/jobs               – Job list with status
GET    /api/jobs/:id           – Job detail (all sections)
POST   /api/jobs/:id/milestones/:milestone/update – Update milestone
GET    /api/jobs/:id/timeline  – Gantt/timeline view
GET    /api/exceptions         – Queue of at-risk jobs

# Transport
GET    /api/dispatch/board     – Kanban: Unassigned, Assigned, Picked, Delivered
GET    /api/trips/:id          – Trip detail + route map
POST   /api/pods/:id           – Upload POD (photo, signature)

# Finance
GET    /api/jobs/:id/costs     – Cost sheet (freight, customs, internal)
GET    /api/invoices/unbilled  – Queue of jobs ready to invoice
POST   /api/invoices           – Draft & send invoice
GET    /api/cash/ageing        – AR ageing report

# Customers
GET    /api/portal/shipments   – Customer's active jobs
GET    /api/portal/quotes      – Pending quote acceptances
POST   /api/portal/quotes/:id/accept – Accept quote
GET    /api/portal/invoices    – Customer invoices

# Owner
GET    /api/owner/today        – Dashboard: needs my action, at risk, waiting, changes
GET    /api/owner/approvals    – Approval queue with drill-down
POST   /api/owner/approve      – Approve quote, override, etc.
```

### WebSocket Events

```
# Real-time subscriptions
subscribe:job:DB-1048
subscribe:dispatch
subscribe:notifications

# Events emitted
event:milestone:updated       – Ops team updated pickup time
event:pod:received            – Driver uploaded POD
event:customs:mismatch        – Customs flagged mismatch
event:payment:received        – Customer payment posted
event:approval:needed         – Quote needs owner signature
```

## Security & Compliance

- **Multi-Tenant Isolation**: Schema-level separation, tenant context on every request
- **Data Encryption**: PII at rest (AES-256), in transit (TLS 1.3)
- **Audit Trail**: All create/update/delete logged with user, timestamp, delta
- **RBAC**: Fine-grained permissions per role, tenant-configurable
- **Rate Limiting**: Per-tenant, per-user API quotas
- **Secrets Management**: Environment variables, no hardcoding
- **Compliance**: GDPR-ready (data export, deletion), ADIB/UAEPAY integration ready

## Deployment

### Development
- Docker Compose (PostgreSQL, Redis, API, Web)
- Hot reload on file changes

### Staging
- Kubernetes cluster
- Automated database migrations
- Smoke tests post-deploy

### Production
- Multi-region PostgreSQL
- Redis cluster for cache/queue
- CDN for static assets
- API behind load balancer
- Zero-downtime deployments

## Monitoring & Observability

- **Logs**: Structured JSON logs (Winston) → CloudWatch / ELK
- **Metrics**: Prometheus (response time, DB queries, queue depth)
- **Tracing**: OpenTelemetry for distributed tracing
- **Alerts**: PagerDuty for critical issues
- **Dashboards**: Grafana for ops visibility
