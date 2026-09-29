import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Truck, UserCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { fdate, fdt, label } from '../lib/format';
import { Badge, Banner, Card, DataTable, Empty, Kpi, Modal, PageHead, Skeleton, StatusBadge, Tabs, toast } from '../ui/kit';
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
  { name: 'insurance_expiry', label: 'Insurance expiry', type: 'date' }, { name: 'gps_device', label: 'GPS device ID' }, { name: 'status', label: 'Status', type: 'select', options: ['available', 'on_trip', 'at_gate', 'maintenance', 'retired'] },
  { name: 'make_model', label: 'Make / model' }, { name: 'year', label: 'Year', type: 'number' }, { name: 'emirate', label: 'Plate emirate' }, { name: 'odometer_km', label: 'Odometer (km)', type: 'number' },
  { name: 'next_service_km', label: 'Next service at (km)', type: 'number' }, { name: 'fuel_pct', label: 'Fuel (%)', type: 'number' }, { name: 'salik_balance', label: 'Salik balance (AED)', type: 'number' },
  { name: 'current_location', label: 'Current location' }, { name: 'civil_defense_permit', label: 'Civil Defense permit', type: 'checkbox' },
];
const EQUIPMENT: FieldSpec[] = [
  { name: 'code', label: 'Code', required: true }, { name: 'category', label: 'Category', type: 'select', required: true, options: ['road_chassis', 'reefer_genset', 'sea_container', 'air_uld'] }, { name: 'type', label: 'Type', required: true, placeholder: "40' tri-axle chassis" },
  { name: 'specs', label: 'Specs', span: 2 }, { name: 'tare_kg', label: 'Tare (kg)', type: 'number' }, { name: 'max_payload_kg', label: 'Max payload (kg)', type: 'number' }, { name: 'location', label: 'Location' },
  { name: 'status', label: 'Status', type: 'select', options: ['operational', 'attached', 'maintenance', 'depot'] }, { name: 'assigned_to', label: 'Assigned to' }, { name: 'last_inspection', label: 'Last inspection', type: 'date' },
];
const ALLOCATION: FieldSpec[] = [
  { name: 'mode', label: 'Mode', type: 'select', required: true, options: ['sea', 'air'] }, { name: 'carrier', label: 'Carrier', required: true }, { name: 'vessel', label: 'Vessel', showIf: (v) => v.mode !== 'air' },
  { name: 'voyage', label: 'Voyage / flight', required: true }, { name: 'route', label: 'Route', placeholder: 'Shanghai → Jebel Ali' }, { name: 'cutoff_at', label: 'Cut-off', type: 'datetime', required: true },
  { name: 'allocated', label: 'Allotment', type: 'number', required: true }, { name: 'other_booked', label: 'Held by others', type: 'number', hint: 'Space already used outside this system' }, { name: 'unit', label: 'Unit', type: 'select', required: true, options: ['TEU', 'kg'] },
];
const POOL: FieldSpec[] = [
  { name: 'mode', label: 'Mode', type: 'select', required: true, options: ['sea', 'air'] }, { name: 'kind', label: 'Kind', type: 'select', options: ['equipment', 'yard', 'cold_chain'] }, { name: 'code', label: 'Code', required: true }, { name: 'label', label: 'Label', required: true },
  { name: 'total', label: 'Total', type: 'number', required: true }, { name: 'in_use', label: 'In use', type: 'number' }, { name: 'damaged', label: 'Damaged / out of service', type: 'number' }, { name: 'unit', label: 'Unit', placeholder: 'units' },
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
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'board', label: 'Dispatch board' }, { key: 'drivers', label: 'Drivers' }, { key: 'vehicles', label: 'Vehicles' }, ...(can('dispatch', 'r') ? [{ key: 'equipment', label: 'Equipment' }] : []), ...(can('shipments', 'r') ? [{ key: 'capacity', label: 'Carrier capacity' }] : []), { key: 'pods', label: 'PODs' }, { key: 'expenses', label: 'Driver expenses' }]} />
      {tab === 'board' && <Board />}
      {tab === 'drivers' && <ResourceTable resource="drivers" module="drivers" noun="driver" fields={DRIVER} columns={[
        { key: 'name', label: 'Driver', render: (r) => <b>{r.name}</b> }, { key: 'license_no', label: 'Licence', render: (r) => <span className="mono">{r.license_no || '—'}</span> }, { key: 'license_expiry', label: 'Licence expiry', render: (r) => <ExpiryBadge d={r.license_expiry} /> },
        { key: 'vehicle_plate', label: 'Vehicle' }, { key: 'open_trips', label: 'Open trips', num: true }, { key: 'pods_pending', label: 'PODs pending', num: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]} />}
      {tab === 'vehicles' && <ResourceTable resource="vehicles" module="drivers" noun="vehicle" fields={VEHICLE} columns={[
        { key: 'plate', label: 'Plate', render: (r) => <b className="mono">{r.plate}</b> }, { key: 'type', label: 'Type' }, { key: 'capacity_kg', label: 'Capacity', num: true }, { key: 'mulkiya_expiry', label: 'Mulkiya', render: (r) => <ExpiryBadge d={r.mulkiya_expiry} /> },
        { key: 'insurance_expiry', label: 'Insurance', render: (r) => <ExpiryBadge d={r.insurance_expiry} /> },
        { key: 'fuel_pct', label: 'Fuel', num: true, hideSm: true, render: (r) => (r.fuel_pct == null ? '—' : <span className={r.fuel_pct < 20 ? 'down' : ''}>{r.fuel_pct}%</span>) },
        { key: 'next_service_km', label: 'Service due', hideSm: true, render: (r) => (r.next_service_km == null || r.odometer_km == null ? '—' : <span>{Number(r.next_service_km - r.odometer_km).toLocaleString('en-AE')} km {r.next_service_km - r.odometer_km <= 500 && <Badge tone={r.next_service_km - r.odometer_km <= 0 ? 'bad' : 'warn'}>{r.next_service_km - r.odometer_km <= 0 ? 'overdue' : 'soon'}</Badge>}</span>) },
        { key: 'salik_balance', label: 'Salik', num: true, hideSm: true, render: (r) => (r.salik_balance == null ? '—' : Number(r.salik_balance).toFixed(0)) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]} />}
      {tab === 'equipment' && <ResourceTable resource="equipment" module="dispatch" noun="equipment" fields={EQUIPMENT} filters={[{ key: 'category', label: 'Category', options: ['road_chassis', 'reefer_genset', 'sea_container', 'air_uld'] }, { key: 'status', label: 'Status', options: ['operational', 'attached', 'maintenance', 'depot'] }]} columns={[
        { key: 'code', label: 'Code', render: (r) => <b className="mono">{r.code}</b> }, { key: 'category', label: 'Category', render: (r) => label(r.category) }, { key: 'type', label: 'Type' }, { key: 'location', label: 'Location', hideSm: true },
        { key: 'assigned_to', label: 'Assigned to', hideSm: true }, { key: 'last_inspection', label: 'Inspected', render: (r) => fdate(r.last_inspection) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]} />}
      {tab === 'capacity' && (
        <>
          <Banner>These allotments and pools feed the <b>Modal Hub</b> on the dashboard. They are entered here until a terminal, airline or GPS integration is connected — the hub labels them “sample”.</Banner>
          <h3 className="section-t">Carrier allotments</h3>
          <ResourceTable resource="capacity-allocations" module="shipments" noun="allotment" fields={ALLOCATION} filters={[{ key: 'mode', label: 'Mode', options: ['sea', 'air'] }]} columns={[
            { key: 'mode', label: 'Mode', render: (r) => label(r.mode) }, { key: 'carrier', label: 'Carrier' }, { key: 'voyage', label: 'Voyage', render: (r) => <span className="mono">{[r.vessel, r.voyage].filter(Boolean).join(' ')}</span> }, { key: 'route', label: 'Route', hideSm: true },
            { key: 'cutoff_at', label: 'Cut-off', render: (r) => fdt(r.cutoff_at) }, { key: 'allocated', label: 'Allotment', num: true, render: (r) => `${Number(r.allocated).toLocaleString('en-AE')} ${r.unit}` }, { key: 'other_booked', label: 'Held by others', num: true },
          ]} />
          <h3 className="section-t" style={{ marginTop: 20 }}>Equipment &amp; yard pools</h3>
          <ResourceTable resource="equipment-pools" module="shipments" noun="pool" fields={POOL} filters={[{ key: 'mode', label: 'Mode', options: ['sea', 'air'] }, { key: 'kind', label: 'Kind', options: ['equipment', 'yard', 'cold_chain'] }]} columns={[
            { key: 'mode', label: 'Mode', render: (r) => label(r.mode) }, { key: 'label', label: 'Pool', render: (r) => <span><b>{r.label}</b> <span className="muted mono">{r.code}</span></span> }, { key: 'kind', label: 'Kind', render: (r) => label(r.kind) },
            { key: 'in_use', label: 'In use', num: true }, { key: 'damaged', label: 'Damaged', num: true }, { key: 'total', label: 'Total', num: true },
          ]} />
        </>
      )}
      {tab === 'pods' && <ResourceTable resource="pods" module="dispatch" noun="POD" filters={[{ key: 'status', label: 'Status', options: ['submitted', 'verified', 'rejected'] }]} canDelete={false}
        columns={[{ key: 'shipment_number', label: 'Job', render: (r) => <b className="mono">{r.shipment_number || '—'}</b> }, { key: 'signed_by', label: 'Signed by' }, { key: 'captured_at', label: 'Captured', render: (r) => fdt(r.captured_at) }, { key: 'lat', label: 'GPS', render: (r) => (r.lat ? <span className="mono">{Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}</span> : '—'), hideSm: true }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]}
        rowActions={(r, refresh) => can('dispatch', 'u') && r.status === 'submitted' ? <><button className="btn xs ok" onClick={async () => { await api.post(`/dispatch/pods/${r.id}/verify`, { approve: true }); refresh(); }}>Verify</button><button className="btn xs outline" onClick={async () => { await api.post(`/dispatch/pods/${r.id}/verify`, { approve: false, notes: 'Rejected by dispatcher' }); refresh(); }}>Reject</button></> : null} />}
      {tab === 'expenses' && <ResourceTable resource="driver-expenses" module="dispatch" noun="expense" filters={[{ key: 'status', label: 'Status', options: ['pending', 'approved', 'rejected'] }]} canDelete={false}
        columns={[{ key: 'driver_name', label: 'Driver' }, { key: 'category', label: 'Category', render: (r) => label(r.category) }, { key: 'amount', label: 'Amount (AED)', num: true }, { key: 'note', label: 'Note', hideSm: true }, { key: 'created_at', label: 'Date', render: (r) => fdt(r.created_at) }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />}
    </>
  );
}
