import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, ClipboardCheck, PackageCheck, PackagePlus } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { num } from '../lib/format';
import { Card, Kpi, PageHead, StatusBadge, Tabs, toast } from '../ui/kit';
import { FormModal, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';

const BIN: FieldSpec[] = [{ name: 'code', label: 'Bin code', required: true, placeholder: 'A1-01' }, { name: 'zone', label: 'Zone' }, { name: 'capacity_kg', label: 'Capacity (kg)', type: 'number', min: 0 }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'blocked'] }];
const RECEIVE: FieldSpec[] = [
  { name: 'description', label: 'Description', required: true, span: 2 }, { name: 'shipment_id', label: 'Shipment', type: 'ref', ref: { resource: 'shipments', label: 'number' } }, { name: 'customer_id', label: 'Customer', type: 'ref', ref: { resource: 'customers' } },
  { name: 'pieces', label: 'Pieces', type: 'number', required: true, min: 1 }, { name: 'weight_kg', label: 'Weight (kg)', type: 'number' }, { name: 'volume_cbm', label: 'Volume (CBM)', type: 'number' },
  { name: 'bin_id', label: 'Putaway bin', type: 'ref', ref: { resource: 'warehouse/bins', label: 'code' } }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

export default function WarehousePage() {
  const can = useCan();
  const qc = useQueryClient();
  const [tab, setTab] = useState('stock');
  const [receive, setReceive] = useState(false);
  const [modal, setModal] = useState<{ kind: 'move' | 'count'; row: any } | null>(null);
  const util = useQuery({ queryKey: ['res', 'wh-util'], queryFn: () => api.get('/warehouse/utilisation') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['res'] });
  const release = useMutation({ mutationFn: (id: string) => api.post(`/warehouse/stock/${id}/release`), onSuccess: () => { refresh(); toast.success('Released'); } });
  const zones: any[] = util.data?.zones || [];
  const cap = zones.reduce((x, z) => x + Number(z.capacity_kg), 0);
  const used = zones.reduce((x, z) => x + Number(z.used_kg), 0);
  return (
    <>
      <PageHead title="Warehouse" sub="Receiving, bin locations, cycle counts and release — with capacity checks and a movement ledger." actions={can('warehouse', 'c') && <button className="btn primary" onClick={() => setReceive(true)}><PackagePlus /> Receive cargo</button>} />
      <div className="kpis">
        <Kpi label="Utilisation" value={cap ? `${Math.round((used / cap) * 100)}%` : '—'} sub={`${num(used)} / ${num(cap)} kg`} />
        {zones.map((z) => <Kpi key={z.zone || 'x'} label={`Zone ${z.zone || '—'}`} value={z.capacity_kg ? `${Math.round((z.used_kg / z.capacity_kg) * 100)}%` : '—'} sub={`${z.bins} bins`} />)}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'stock', label: 'Stock' }, { key: 'bins', label: 'Bins' }]} />
      {tab === 'stock' && (
        <ResourceTable resource="warehouse/stock" module="warehouse" noun="stock item" canDelete={false} canEdit={false} searchPlaceholder="Search description…" filters={[{ key: 'status', label: 'Status', options: ['stored', 'discrepancy', 'released'] }]}
          columns={[
            { key: 'bin_code', label: 'Bin', render: (r) => <b className="mono">{r.bin_code || '—'}</b> }, { key: 'zone', label: 'Zone', hideSm: true }, { key: 'shipment_number', label: 'Job', render: (r) => <span className="mono">{r.shipment_number || '—'}</span> },
            { key: 'description', label: 'Description' }, { key: 'pieces', label: 'Pieces', num: true }, { key: 'weight_kg', label: 'Weight', num: true, hideSm: true }, { key: 'days_stored', label: 'Days', num: true, render: (r) => <span className={r.days_stored > 14 ? 'down' : ''}>{r.days_stored}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          ]}
          rowActions={(r) => can('warehouse', 'u') && ['stored', 'discrepancy'].includes(r.status) ? <>
            <button className="btn xs outline" title="Move to another bin" onClick={() => setModal({ kind: 'move', row: r })}><ArrowRightLeft /></button>
            <button className="btn xs outline" title="Cycle count" onClick={() => setModal({ kind: 'count', row: r })}><ClipboardCheck /></button>
            <button className="btn xs outline" title="Release / dispatch" onClick={() => release.mutate(r.id)}><PackageCheck /></button></> : null} />
      )}
      {tab === 'bins' && <ResourceTable resource="warehouse/bins" module="warehouse" noun="bin" fields={BIN} columns={[{ key: 'code', label: 'Bin', render: (r) => <b className="mono">{r.code}</b> }, { key: 'zone', label: 'Zone' }, { key: 'capacity_kg', label: 'Capacity (kg)', num: true }, { key: 'used_kg', label: 'Used (kg)', num: true, render: (r) => num(r.used_kg) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
      {receive && <FormModal title="Receive cargo" size="lg" fields={RECEIVE} onSubmit={async (v) => { await api.post('/warehouse/receive', v); refresh(); toast.success('Cargo received'); }} onClose={() => setReceive(false)} />}
      {modal?.kind === 'move' && <FormModal title={`Move: ${modal.row.description}`} fields={[{ name: 'bin_id', label: 'Destination bin', type: 'ref', required: true, ref: { resource: 'warehouse/bins', label: 'code' } }]} submitLabel="Move" onSubmit={async (v) => { await api.post(`/warehouse/stock/${modal.row.id}/move`, v); refresh(); toast.success('Moved'); }} onClose={() => setModal(null)} />}
      {modal?.kind === 'count' && <FormModal title={`Count: ${modal.row.description}`} sub={`Expected ${modal.row.pieces} pieces`} fields={[{ name: 'counted', label: 'Counted pieces', type: 'number', required: true, min: 0 }, { name: 'note', label: 'Note' }]} submitLabel="Record count" onSubmit={async (v) => { const r = await api.post(`/warehouse/stock/${modal.row.id}/count`, v); refresh(); r.status === 'discrepancy' ? toast.warning('Discrepancy recorded') : toast.success('Count matches'); }} onClose={() => setModal(null)} />}
      <Card title="Reminder" className="mt"><p className="muted">Storage older than 14 days is highlighted. Set up an automation to bill storage automatically.</p></Card>
    </>
  );
}
