import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../lib/api';
import { ModalHub } from '../components/ModalHub';
import Velocity from '../pages/Velocity';
import Tools from '../pages/Tools';

const NOW = Date.parse('2026-09-29T08:00:00Z');
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();
const hubInput = {
  shipments: [
    { id: 's1', number: 'DXB-1001', customer: 'Acme', mode: 'sea_fcl', status: 'confirmed', vessel: 'MSC ORCHESTRA', voyage: '2618E', container_type: '40HC', containers: 3 },
    { id: 's2', number: 'DXB-1002', customer: 'Beta', mode: 'air', status: 'confirmed', voyage: 'EK 047', weight_kg: 1200, volume_cbm: 2 },
    { id: 's3', number: 'DXB-1003', customer: 'Gamma', mode: 'road', status: 'booked' },
  ],
  vehicles: [{ id: 'v1', plate: 'DXB A 12345', status: 'on_trip', driver_name: 'Ravi', fuel_pct: 12, mulkiya_expiry: '2030-01-01' }],
  equipment: [], trips: [{ status: 'in_progress' }],
  allocations: [
    { id: 'a1', mode: 'sea', carrier: 'MSC', vessel: 'MSC ORCHESTRA', voyage: '2618E', route: 'Shanghai → Jebel Ali', cutoff_at: h(26), allocated: 60, other_booked: 44, unit: 'TEU' },
    { id: 'a2', mode: 'air', carrier: 'Emirates', voyage: 'EK 047', cutoff_at: h(5), allocated: 10000, other_booked: 9500, unit: 'kg' },
  ],
  pools: [],
};

const renderWith = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe('Modal Hub', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(api, 'get').mockResolvedValue({ now: NOW, input: hubInput } as any); });
  it('renders one swimlane each for Sea, Air and Road with capacity computed from live jobs', async () => {
    renderWith(<ModalHub />);
    const sea = await screen.findByRole('region', { name: 'Sea lane' });
    expect(screen.getByRole('region', { name: 'Air lane' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Road lane' })).toBeInTheDocument();
    // 44 held by others + 3 × 40HC (6 TEU) = 50 of 60 TEU
    expect(within(sea).getByText(/50\/60 TEU/)).toBeInTheDocument();
  });
  it('flags an over-allotted flight and shows a cut-off countdown', async () => {
    renderWith(<ModalHub />);
    const air = await screen.findByRole('region', { name: 'Air lane' });
    // 9500 held + chargeable 1200 kg > 10000 allotment
    expect(within(air).getAllByText(/over allotment/i).length).toBeGreaterThan(0);
    expect(within(air).getByText(/Cut-off in/)).toBeInTheDocument();
  });
  it('labels every figure with where it comes from', async () => {
    renderWith(<ModalHub />);
    await screen.findByRole('region', { name: 'Sea lane' });
    expect(screen.getAllByText('live').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sample').length).toBeGreaterThan(0);
    expect(screen.getAllByText('register').length).toBeGreaterThan(0);
  });
  it('focuses a single lane', async () => {
    renderWith(<ModalHub />);
    await screen.findByRole('region', { name: 'Sea lane' });
    fireEvent.click(screen.getByRole('tab', { name: 'Road' }));
    expect(screen.queryByRole('region', { name: 'Sea lane' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Road lane' })).toBeInTheDocument();
  });
});

const rec = (id: string, mode: string, a: number, b: number, c: number, hold: string | null = null) => {
  const t0 = Date.parse('2026-09-01T06:00:00Z');
  const at = (m: number) => new Date(t0 + m * 60_000).toISOString();
  return { id, shipmentId: id, jobNo: `DXB-${id}`, quoteNo: `Q-${id}`, customer: `Cust ${id}`, mode, lane: 'A → B', acceptedAt: at(0), jobCreatedAt: at(a), carrierConfirmedAt: at(a + b), docsGeneratedAt: at(a + b + c), holdReason: hold };
};

describe('Operational velocity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({
      days: 90, coverage: { acceptedQuotes: 5, measured: 4, pending: 1 },
      records: [rec('1', 'sea_fcl', 4, 40, 6), rec('2', 'sea_lcl', 5, 30, 5), rec('3', 'air', 2, 6, 3), rec('4', 'road', 3, 12, 4, 'missing_trn')],
    } as any);
  });
  it('compares Sea, Air and Road and reports what is not yet measurable', async () => {
    renderWith(<Velocity />);
    expect(await screen.findByText(/Where the time goes, by mode/)).toBeInTheDocument();
    expect(screen.getByText(/1 accepted order\(s\).*not measured yet/)).toBeInTheDocument();
    // Sea averages (50 + 40) / 2 = 45 min
    expect(screen.getByText(/^45 min avg/)).toBeInTheDocument();
    expect(screen.getByText(/^11 min avg/)).toBeInTheDocument(); // air
  });
  it('filters the orders table to one mode', async () => {
    renderWith(<Velocity />);
    await screen.findByText(/Where the time goes/);
    expect(screen.getAllByText(/^DXB-/)).toHaveLength(4);
    fireEvent.click(screen.getByRole('tab', { name: 'Air' }));
    await waitFor(() => expect(screen.getAllByText(/^DXB-/)).toHaveLength(1));
    expect(screen.getByText('DXB-3')).toBeInTheDocument();
  });
  it('shows the missing-TRN hold reason', async () => {
    renderWith(<Velocity />);
    await screen.findByText(/Where the time goes/);
    expect(screen.getAllByText('no TRN').length).toBeGreaterThan(0);
  });
});

describe('Calculators', () => {
  it('computes chargeable weight from dimensions (volumetric beats gross)', () => {
    renderWith(<Tools />);
    // 120×80×100 cm × 4 pcs = 3.84 CBM → 640 kg volumetric (1:6000) vs 350 kg gross
    expect(screen.getByText('3.84 CBM')).toBeInTheDocument();
    expect(screen.getAllByText('640 kg').length).toBeGreaterThan(0); // volumetric and chargeable
    expect(screen.getByText(/Chargeable \(volumetric\)/)).toBeInTheDocument();
  });
  it('shows import duty and VAT on CIF + duty', () => {
    renderWith(<Tools />);
    expect(screen.getByText('AED 5,000.00')).toBeInTheDocument(); // 5% duty on 100,000
    expect(screen.getByText('AED 5,250.00')).toBeInTheDocument(); // 5% VAT on 105,000
  });
});
