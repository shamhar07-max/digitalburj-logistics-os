# DigitalBurj Logistics OS

🚛 UAE logistics & freight operating system for 5–30 person forwarders.

**Core Flow:** Quote → Shipment → Delivery → Invoice → Cash

## Project Structure

```
├── apps/
│   ├── api/                 # Node.js + Express backend
│   └── web/                 # React + TypeScript frontend
├── packages/
│   ├── shared/              # Shared types, utilities, constants
│   └── design-system/       # Design tokens, components, icons
├── docker-compose.yml       # Development environment
└── docs/                    # Architecture & specifications
```

## Quick Start

### Prerequisites
- Node.js 18+
- Yarn 3.x
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Development

```bash
# Install dependencies
yarn install

# Start development server (all apps)
yarn dev

# Run API only
cd apps/api && yarn dev

# Run Web only
cd apps/web && yarn dev
```

### With Docker

```bash
docker-compose up -d
```

## User Roles

- **Owner** – Full system control, approval authority, KPIs
- **Sales** – Lead/RFQ management, quote building, customer rates
- **Operations** – Job execution, milestone tracking, exception handling
- **Customs** – Declaration management, compliance, mismatch resolution
- **Transport** – Dispatch, driver assignment, POD collection
- **Warehouse** – Inbound, stock, picking, counting
- **Finance** – Costing, invoicing, AP/AR, reconciliation
- **Customer** – Portal: quote acceptance, shipment tracking, documents, invoices
- **Partner** – Portal: assigned tasks, document upload, response tracking
- **Admin** – Users, roles, policies, automations, audit trail

## Core Workflows

1. **Sales**: Lead inbox → RFQ → Rate search → Quote builder → Quote sent → History
2. **Operations**: Job detail (Timeline, Cargo, Legs, Documents, Customs, Transport, Charges, Conversations)
3. **Customs**: Case list → Checklist → Mismatch review → Submission/Status
4. **Transport**: Dispatch board → Trip detail → Driver mobile → POD review
5. **Warehouse**: Inbound → Stock → Pick → Count → Discrepancy
6. **Finance**: Job cost sheet → Unbilled queue → AP match → Invoice draft → AR ageing
7. **Customer Portal**: Home → Quote acceptance → Shipment timeline → Documents → Invoices
8. **Owner Desk**: Today card → At Risk → Money → Customers → Decisions

## Architecture

### Backend
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL (multi-tenant schemas)
- **Auth**: JWT + role-based access control (RBAC)
- **Real-time**: WebSocket for notifications & live updates
- **File Storage**: AWS S3 / Local filesystem
- **Queue**: Bull for async job processing

### Frontend
- **Framework**: React 18 + TypeScript
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS + custom design tokens
- **UI Components**: Custom library with variants
- **i18n**: Arabic (RTL) + English
- **Maps**: Leaflet or Mapbox for route visualization

### Design System
- **Colors**: Navy/Blue primary, grey neutrals, semantic status (green/amber/red)
- **Typography**: Inter + IBM Plex Sans (English); Cairo or Noto Sans Arabic
- **Spacing**: 4px base unit
- **Icons**: Custom SVG library
- **Responsive**: Mobile-first, desktop optimized

## Features

✅ Multi-tenant architecture
✅ Role-based permissions
✅ Quote → Job → Invoice workflow
✅ Real-time dashboard
✅ Customer portal
✅ Driver mobile app
✅ Owner approval queue
✅ Audit trail
✅ Arabic RTL support
✅ Dark mode
✅ Offline sync
✅ Document management
✅ Notification system
✅ API integrations (carriers, customs, payment)

## Environment Variables

See `.env.example` files in each app directory.

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Specification](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Design System](./packages/design-system/README.md)
- [Accessibility](./docs/ACCESSIBILITY.md)

## License

MIT
