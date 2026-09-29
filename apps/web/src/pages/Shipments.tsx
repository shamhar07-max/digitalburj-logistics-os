import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { MODES, SHIPMENT_STATUSES } from '@digitalburj/shared';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { aed, fdate, label } from '../lib/format';
import { Badge, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

export const NEW_SHIPMENT_FIELDS: FieldSpec[] = [
  { name: 'customer_id', label: 'Customer (shipper)', type: 'ref', required: true, ref: { resource: 'customers' } },
  { name: 'consignee_id', label: 'Consignee', type: 'ref', ref: { resource: 'customers' } },
  { name: 'mode', label: 'Mode', type: 'select', required: true, options: MODES.map((m) => ({ value: m.value, label: m.label })) },
  { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'] },
  { name: 'origin', label: 'Origin', placeholder: 'Shanghai' }, { name: 'destination', label: 'Destination', placeholder: 'Jebel Ali' },
  { name: 'pol', label: 'Port of loading' }, { name: 'pod', label: 'Port of discharge' },
  { name: 'carrier', label: 'Carrier / airline' }, { name: 'incoterm', label: 'Incoterm', type: 'select', options: ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'] },
  { name: 'container_type', label: 'Equipment', placeholder: '40HC' }, { name: 'cargo_value', label: 'Cargo value (AED)', type: 'number', min: 0 },
  { name: 'weight_kg', label: 'Weight (kg)', type: 'number', min: 0 }, { name: 'volume_cbm', label: 'Volume (CBM)', type: 'number', min: 0 },
  { name: 'etd', label: 'ETD', type: 'date' }, { name: 'eta', label: 'ETA', type: 'date' },
  { name: 'cargo_description', label: 'Cargo description', type: 'textarea', span: 2 },
];

export default function Shipments() {
  const nav = useNavigate();
  const can = useCan();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (sp.get('new') && can('shipments', 'c')) { setCreating(true); setSp({}, { replace: true }); } }, [sp]);

  return (
    <>
      <PageHead title="Shipments" sub="Every job from booking to cash. Click a row for the full workspace: milestones, documents, charges, customs and transport."
        actions={can('shipments', 'c') && <button className="btn primary" onClick={() => setCreating(true)}><Plus /> New shipment</button>} />
      <ResourceTable
        resource="shipments" module="shipments" noun="shipments" searchPlaceholder="Search number, container, BL/AWB, cargo…"
        filters={[{ key: 'status', label: 'Status', options: SHIPMENT_STATUSES.filter((s) => !['closed', 'cancelled'].includes(s)) as unknown as string[] }]}
        onRowClick={(r) => nav(`/shipments/${r.id}`)}
        canDelete={false}
        columns={[
          { key: 'number', label: 'Job', render: (r) => <b className="mono">{r.number}</b> },
          { key: 'customer_name', label: 'Customer' },
          { key: 'mode', label: 'Mode', render: (r) => label(r.mode), hideSm: true },
          { key: 'origin', label: 'Route', render: (r) => (r.origin || r.destination ? `${r.origin || '?'} → ${r.destination || '?'}` : '—'), hideSm: true },
          { key: 'container_no', label: 'Container / AWB', render: (r) => <span className="mono">{r.container_no || r.awb_number || '—'}</span>, hideSm: true },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'eta', label: 'ETA', render: (r) => fdate(r.eta) },
          { key: 'risk_level', label: 'Risk', render: (r) => (r.risk_level && r.risk_level !== 'low' ? <Badge tone={r.risk_level === 'high' ? 'bad' : 'warn'}>{r.risk_reason?.split(' · ')[0] || label(r.risk_level)}</Badge> : <span className="muted">—</span>) },
          { key: 'revenue', label: 'Revenue', num: true, render: (r) => aed(r.revenue, { noSymbol: true }) },
        ]}
      />
      {creating && (
        <FormModal title="New shipment" sub="Milestones are generated from the mode template." size="lg" fields={NEW_SHIPMENT_FIELDS} initial={{ mode: 'sea_fcl', priority: 'normal' }}
          onSubmit={async (v) => { const s = await api.post('/shipments', v); qc.invalidateQueries({ queryKey: ['res', 'shipments'] }); toast.success(`${s.number} created`); nav(`/shipments/${s.id}`); }}
          onClose={() => setCreating(false)} />
      )}
    </>
  );
}
