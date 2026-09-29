import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Truck, UserCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { fdate, fdt, label } from '../lib/format';
import { Badge, Card, DataTable, Empty, Kpi, Modal, PageHead, Skeleton, StatusBadge, Tabs, toast } from '../ui/kit';
import { FormModal, useRefOptions, type FieldSpec } from '../ui/forms';
import { ResourceTable } from '../ui/ResourceTable';
import { Field as F } from '../ui/forms';

const DRIVER: FieldSpec[] = [
  { name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'license_no', label: 'Licence no.' }, { name: 'license_expiry', label: 'Licence expiry', type: 'date' },
  { name: 'visa_expiry', label: 'Visa expiry', type: 'date' }, { name: 'vehicle_id', label: 'Default vehicle', type: 'ref', ref: { resource: 'vehicles', label: 'plate' } },
  { name: 'user_id', label: 'App login', type: 'ref', ref: { resource: 'lookup/users' }, hint: 'Link a user with the Driver role to enable the mobile app' }, { name: 'status', label: 'Status', type: 'select', options: ['available', 'on_trip', 'off_duty', 'inactive'] },
];
const VEHICLE: FieldSpec[] = [
  { name: 'plate', label: 'Plate', required: true }, { name: 'type', label: 'Type' }, { name: 'capacity_kg', label: 'Capacity (kg)', type: 'number' }, { name: 'mulkiya_expiry', label: 'Mulkiya expiry', type: 'date' },
  { name: 'insurance_expiry', label: 'Insurance expiry', type: 'date' }, { name: 'gps_device', label: 'GPS device ID' }, { name: 'status', label: 'Status', type: 'select', options: ['available', 'on_trip', 'maintenance', 'retired'] },
];
const soon = (d?: string, days = 30) => d && (new Date(d).getTime() - Date.now()) / 86_400_000 < days;
const ExpiryBadge = ({ d }: { d?: string }) => (d ? <span>{fdate(d)} {soon(d, 0) ? <Badge tone="bad">expired</Badge> : soon(d) ? <Badge tone="warn">soon</Badge> : null}</span> : <span className="muted">—</span>);

function TripForm({ shipments, onClose }: { shipments: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const drivers = useRefOptions({ resource: 'drivers', params: { status: 'available' } });
  const [driver, setDriver] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stops, setStops] = useState<any[]>([{ kind: 'delivery', shipment_id: '', address: '' }]);
  const save = useMutation({
    mutationFn: () => api.post('/dispatch/trips', { driver_id: driver || null, planned_date: date, stops: stops.map((s) => ({ ...s, shipment_id: s.shipment_id || null })) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dispatch'] }); qc.invalidateQueries({ queryKey: ['res'] }); toast.success('Trip created'); onClose(); },
  });
  return (
    <Modal title="New trip" size="lg" onClose={onClose} footer={<><button className="btn outline" onClick={onClose}>Cancel</button><button className="btn primary" disabled={save.isPending || stops.some((s) => !s.address && !s.shipment_id)} onClick={() => save.mutate()}>Create trip</button></>}>
      <div className="row2">
        <F spec={{ name: 'd', label: 'Driver (optional)', type: 'select', options: drivers.options }} value={driver} onChange={(v) => setDriver(v || '')} />
        <F spec={{ name: 'date', label: 'Planned date', type: 'date' }} value={date} onChange={(v) => setDate(v)} />
      </div>
      {stops.map((s, i) => (
        <div key={i} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div className="row3">
            <F spec={{ name: 'k', label: `Stop ${i + 1}`, type: 'select', options: ['pickup', 'delivery'], required: true }} value={s.kind} onChange={(v) => setStops(stops.map((x, j) => (j === i ? { ...x, kind: v } : x)))} />
            <F spec={{ name: 's', label: 'Shipment', type: 'select', options: shipments.map((x) => ({ value: x.id, label: `${x.number} — ${x.customer_name || ''}` })) }} value={s.shipment_id} onChange={(v) => setStops(stops.map((x, j) => (j === i ? { ...x, shipment_id: v || '' } : x)))} />
            <F spec={{ name: 'a', label: 'Address', required: true }} value={s.address} onChange={(v) => setStops(stops.map((x, j) => (j === i ? { ...x, address: v } : x)))} />
          </div>
        </div>
      ))}
      <button className="btn sm outline" onClick={() => setStops([...stops, { kind: 'delivery', shipment_id: '', address: '' }])}><Plus /> Add stop</button>
    </Modal>
  );
}

function Board() {
  const can = useCan();
  const qc = useQueryClient();
  const [trip, setTrip] = useState(false);
  const [assign, setAssign] = useState<any>(null);
  const [driverId, setDriverId] = useState('');
  const drivers = useRefOptions({ resource: 'drivers' });
  const q = useQuery({ queryKey: ['dispatch', 'board'], queryFn: () => api.get('/dispatch/board'), refetchInterval: 30_000 });
  const doAssign = useMutation({ mutationFn: () => api.post(`/dispatch/trips/${assign.id}/assign`, { driver_id: driverId }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['dispatch'] }); toast.success('Driver assigned'); setAssign(null); } });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/dispatch/trips/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch'] }) });
  if (q.isLoading) return <Skeleton rows={6} />;
  const trips: any[] = q.data?.trips || [];
  const cols = [['unassigned', 'Unassigned'], ['assigned', 'Assigned'], ['in_progress', 'On the road'], ['completed', 'Delivered']];
  return (
    <>
      <div className="kpis">
        <Kpi label="Trips today" value={trips.filter((t) => t.planned_date === new Date().toISOString().slice(0, 10)).length} icon={<Truck />} />
        <Kpi label="Unassigned" value={trips.filter((t) => t.status === 'unassigned').length} tone={trips.some((t) => t.status === 'unassigned') ? 'down' : 'up'} />
        <Kpi label="Ready for dispatch" value={q.data?.unassignedShipments?.length || 0} sub="Arrived / cleared, no trip yet" />
      </div>
      <div className="toolbar"><div className="spacer" />{can('dispatch', 'c') && <button className="btn primary" onClick={() => setTrip(true)}><Plus /> New trip</button>}</div>
      <div className="board" style={{ gridAutoColumns: 'minmax(260px,1fr)' }}>
        {cols.map(([key, title]) => (
          <div className="col" key={key}>
            <div className="col-h"><span>{title}</span><small>{trips.filter((t) => t.status === key).length}</small></div>
            <div className="col-b">
              {trips.filter((t) => t.status === key).map((t) => (
                <div className="kcard" key={t.id} style={{ cursor: 'default' }}>
                  <b className="mono">{t.number}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{fdate(t.planned_date)} · {t.driver_name || 'no driver'}{t.vehicle_plate ? ` · ${t.vehicle_plate}` : ''}</div>
                  {t.stops.map((s: any) => (
                    <div key={s.id} style={{ fontSize: 12.5, marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={13} /><span style={{ flex: 1 }}>{label(s.kind)}: {s.shipment_number || s.address}</span><StatusBadge value={s.status} /></div>
                  ))}
                  {can('dispatch', 'u') && ['unassigned', 'assigned'].includes(t.status) && (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="btn xs outline" onClick={() => { setAssign(t); setDriverId(''); }}><UserCheck /> {t.driver_id ? 'Reassign' : 'Assign'}</button>
                      <button className="btn xs outline" onClick={() => cancel.mutate(t.id)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!!q.data?.unassignedShipments?.length && (
        <Card title="Ready for dispatch" className="mt" pad={false}>
          <DataTable rows={q.data.unassignedShipments} columns={[{ key: 'number', label: 'Job', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer_name', label: 'Customer' }, { key: 'destination', label: 'Destination' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />
        </Card>
      )}
      {trip && <TripForm shipments={q.data?.unassignedShipments || []} onClose={() => setTrip(false)} />}
      {assign && (
        <Modal title={`Assign ${assign.number}`} onClose={() => setAssign(null)} footer={<><button className="btn outline" onClick={() => setAssign(null)}>Cancel</button><button className="btn primary" disabled={!driverId || doAssign.isPending} onClick={() => doAssign.mutate()}>Assign</button></>}>
          <F spec={{ name: 'driver', label: 'Driver', type: 'select', options: drivers.options, required: true }} value={driverId} onChange={(v) => setDriverId(v || '')} />
          <p className="hint">Expired licences or vehicle registrations block assignment.</p>
        </Modal>
      )}
    </>
  );
}

export default function Dispatch() {
  const [tab, setTab] = useState('board');
  const can = useCan();
  return (
    <>
      <PageHead title="Dispatch & fleet" sub="Assign trips, track drivers and keep licences and registrations current." />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'board', label: 'Dispatch board' }, { key: 'drivers', label: 'Drivers' }, { key: 'vehicles', label: 'Vehicles' }, { key: 'pods', label: 'PODs' }, { key: 'expenses', label: 'Driver expenses' }]} />
      {tab === 'board' && <Board />}
      {tab === 'drivers' && <ResourceTable resource="drivers" module="drivers" noun="driver" fields={DRIVER} columns={[
        { key: 'name', label: 'Driver', render: (r) => <b>{r.name}</b> }, { key: 'license_no', label: 'Licence', render: (r) => <span className="mono">{r.license_no || '—'}</span> }, { key: 'license_expiry', label: 'Licence expiry', render: (r) => <ExpiryBadge d={r.license_expiry} /> },
        { key: 'vehicle_plate', label: 'Vehicle' }, { key: 'open_trips', label: 'Open trips', num: true }, { key: 'pods_pending', label: 'PODs pending', num: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]} />}
      {tab === 'vehicles' && <ResourceTable resource="vehicles" module="drivers" noun="vehicle" fields={VEHICLE} columns={[
        { key: 'plate', label: 'Plate', render: (r) => <b className="mono">{r.plate}</b> }, { key: 'type', label: 'Type' }, { key: 'capacity_kg', label: 'Capacity', num: true }, { key: 'mulkiya_expiry', label: 'Mulkiya', render: (r) => <ExpiryBadge d={r.mulkiya_expiry} /> },
        { key: 'insurance_expiry', label: 'Insurance', render: (r) => <ExpiryBadge d={r.insurance_expiry} /> }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]} />}
      {tab === 'pods' && <ResourceTable resource="pods" module="dispatch" noun="POD" filters={[{ key: 'status', label: 'Status', options: ['submitted', 'verified', 'rejected'] }]} canDelete={false}
        columns={[{ key: 'shipment_number', label: 'Job', render: (r) => <b className="mono">{r.shipment_number || '—'}</b> }, { key: 'signed_by', label: 'Signed by' }, { key: 'captured_at', label: 'Captured', render: (r) => fdt(r.captured_at) }, { key: 'lat', label: 'GPS', render: (r) => (r.lat ? <span className="mono">{Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}</span> : '—'), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]}
        rowActions={(r, refresh) => can('dispatch', 'u') && r.status === 'submitted' ? <><button className="btn xs ok" onClick={async () => { await api.post(`/dispatch/pods/${r.id}/verify`, { approve: true }); refresh(); }}>Verify</button><button className="btn xs outline" onClick={async () => { await api.post(`/dispatch/pods/${r.id}/verify`, { approve: false, notes: 'Rejected by dispatcher' }); refresh(); }}>Reject</button></> : null} />}
      {tab === 'expenses' && <ResourceTable resource="driver-expenses" module="dispatch" noun="expense" filters={[{ key: 'status', label: 'Status', options: ['pending', 'approved', 'rejected'] }]} canDelete={false}
        columns={[{ key: 'driver_name', label: 'Driver' }, { key: 'category', label: 'Category', render: (r) => label(r.category) }, { key: 'amount', label: 'Amount (AED)', num: true }, { key: 'note', label: 'Note', hideSm: true }, { key: 'created_at', label: 'Date', render: (r) => fdt(r.created_at) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
    </>
  );
}
