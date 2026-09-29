import { Router } from 'express';
import { z } from 'zod';
import { Db, many, nextRef, one, query, tx } from '../db';
import { requirePerm } from '../auth/middleware';
import { badRequest, conflict, forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { publish } from '../services/events';
import { getSettings } from '../services/settings';
import { changeShipmentStatus, refreshRisk } from '../services/shipments';
import { notifyPermitted } from '../services/notify';
import { requestApproval } from '../services/approvals';
import { decodeDataUrl, newKey, storage } from '../lib/storage';

export const dispatchRouter = Router();

/** Dispatch board: trips grouped by status with stops. */
dispatchRouter.get(
  '/board',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date.slice(0, 10) : null;
    const trips = await many<any>({ query }, `
      SELECT t.*, (SELECT name FROM drivers d WHERE d.id=t.driver_id) AS driver_name, (SELECT plate FROM vehicles v WHERE v.id=t.vehicle_id) AS vehicle_plate
        FROM trips t WHERE t.tenant_id=$1 ${date ? 'AND t.planned_date=$2' : "AND t.status <> 'cancelled' AND (t.status <> 'completed' OR t.completed_at > now() - interval '2 days')"}
       ORDER BY t.planned_date NULLS LAST, t.number`, date ? [req.user!.tenantId, date] : [req.user!.tenantId]);
    const ids = trips.map((t) => t.id);
    const stops = ids.length ? await many<any>({ query }, `SELECT s.*, (SELECT number FROM shipments x WHERE x.id=s.shipment_id) AS shipment_number FROM trip_stops s WHERE s.trip_id = ANY($1) ORDER BY s.seq`, [ids]) : [];
    const unassignedShipments = await many({ query }, `
      SELECT s.id, s.number, s.status, s.destination, s.cargo_description, (SELECT name FROM customers c WHERE c.id=s.customer_id) AS customer_name
        FROM shipments s WHERE s.tenant_id=$1 AND s.status IN ('arrived','cleared','out_for_delivery')
         AND NOT EXISTS (SELECT 1 FROM trip_stops ts JOIN trips tr ON tr.id=ts.trip_id WHERE ts.shipment_id=s.id AND ts.kind='delivery' AND tr.status <> 'cancelled') LIMIT 100`, [req.user!.tenantId]);
    res.json({ trips: trips.map((t) => ({ ...t, stops: stops.filter((s) => s.trip_id === t.id) })), unassignedShipments });
  }),
);

const stopSchema = z.object({
  shipment_id: z.string().uuid().nullish(),
  kind: z.enum(['pickup', 'delivery']).default('delivery'),
  address: z.string().max(400).nullish(),
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lng: z.coerce.number().min(-180).max(180).nullish(),
  contact_name: z.string().max(120).nullish(),
  contact_phone: z.string().max(40).nullish(),
  window_from: z.string().nullish(),
  window_to: z.string().nullish(),
  notes: z.string().max(500).nullish(),
});

dispatchRouter.post(
  '/trips',
  requirePerm('dispatch', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ driver_id: z.string().uuid().nullish(), vehicle_id: z.string().uuid().nullish(), planned_date: z.string().optional(), notes: z.string().max(500).optional(), stops: z.array(stopSchema).min(1) }).parse(req.body);
    const trip = await tx(async (db) => {
      const t = req.user!.tenantId;
      const number = await nextRef(db, t, 'trips:number', 'TRP-', 5, 0);
      const drv = b.driver_id ? await one<any>(db, 'SELECT id, vehicle_id FROM drivers WHERE id=$1 AND tenant_id=$2', [b.driver_id, t]) : null;
      if (b.driver_id && !drv) throw badRequest('Unknown driver');
      const row = (await db.query(`INSERT INTO trips (tenant_id, entity_id, number, driver_id, vehicle_id, status, planned_date, notes) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, current_date),$8) RETURNING *`,
        [t, req.entityId || req.user!.entityIds[0] || null, number, b.driver_id ?? null, b.vehicle_id ?? drv?.vehicle_id ?? null, b.driver_id ? 'assigned' : 'unassigned', b.planned_date?.slice(0, 10) ?? null, b.notes ?? null])).rows[0];
      let seq = 1;
      for (const s of b.stops) {
        if (s.shipment_id && !(await one(db, 'SELECT 1 FROM shipments WHERE id=$1 AND tenant_id=$2', [s.shipment_id, t]))) throw badRequest('Unknown shipment on stop');
        await db.query(`INSERT INTO trip_stops (tenant_id, trip_id, shipment_id, seq, kind, address, lat, lng, contact_name, contact_phone, window_from, window_to, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [t, row.id, s.shipment_id ?? null, seq++, s.kind, s.address ?? null, s.lat ?? null, s.lng ?? null, s.contact_name ?? null, s.contact_phone ?? null, s.window_from ?? null, s.window_to ?? null, s.notes ?? null]);
      }
      await auditFromReq(req, 'create', 'trip', row.id, { number, stops: b.stops.length }, db);
      return row;
    });
    publish({ tenantId: req.user!.tenantId, type: 'trip.created', entityType: 'trip', entityId: trip.id, payload: { number: trip.number }, userId: req.user!.id });
    res.status(201).json(trip);
  }),
);

dispatchRouter.post(
  '/trips/:id/assign',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ driver_id: z.string().uuid(), vehicle_id: z.string().uuid().nullish() }).parse(req.body);
    const t = req.user!.tenantId;
    const drv = await one<any>({ query }, 'SELECT * FROM drivers WHERE id=$1 AND tenant_id=$2', [b.driver_id, t]);
    if (!drv) throw badRequest('Unknown driver');
    if (drv.license_expiry && drv.license_expiry < new Date().toISOString().slice(0, 10)) throw conflict(`${drv.name}'s licence has expired`);
    const veh = await one<any>({ query }, 'SELECT * FROM vehicles WHERE id=$1 AND tenant_id=$2', [b.vehicle_id ?? drv.vehicle_id, t]);
    if (veh?.mulkiya_expiry && veh.mulkiya_expiry < new Date().toISOString().slice(0, 10)) throw conflict(`Vehicle ${veh.plate} registration (Mulkiya) has expired`);
    const row = await one<any>({ query }, `UPDATE trips SET driver_id=$3, vehicle_id=$4, status=CASE WHEN status='unassigned' THEN 'assigned' ELSE status END WHERE id=$1 AND tenant_id=$2 AND status NOT IN ('completed','cancelled') RETURNING *`, [req.params.id, t, b.driver_id, veh?.id ?? null]);
    if (!row) throw notFound('Trip not found or already closed');
    await auditFromReq(req, 'assign', 'trip', row.id, b);
    publish({ tenantId: t, type: 'trip.assigned', entityType: 'trip', entityId: row.id, payload: { number: row.number, driver: drv.name } });
    res.json(row);
  }),
);

dispatchRouter.post(
  '/trips/:id/cancel',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const row = await one<any>({ query }, `UPDATE trips SET status='cancelled' WHERE id=$1 AND tenant_id=$2 AND status IN ('unassigned','assigned') RETURNING *`, [req.params.id, req.user!.tenantId]);
    if (!row) throw conflict('Only trips that have not started can be cancelled');
    res.json(row);
  }),
);

// ─────────────────────────── Driver mobile API ───────────────────────────
export const driverRouter = Router();

async function myDriver(req: any) {
  const d = await one<any>({ query }, 'SELECT * FROM drivers WHERE tenant_id=$1 AND user_id=$2', [req.user.tenantId, req.user.id]);
  if (!d) throw forbidden('No driver profile is linked to this account');
  return d;
}

driverRouter.get(
  '/me',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const d = await myDriver(req);
    const stats = await one({ query }, `SELECT count(*) FILTER (WHERE t.planned_date = current_date)::int AS today, count(*) FILTER (WHERE t.planned_date = current_date AND t.status='completed')::int AS done FROM trips t WHERE t.driver_id=$1`, [d.id]);
    res.json({ driver: d, stats });
  }),
);

driverRouter.get(
  '/trips',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const d = await myDriver(req);
    const trips = await many<any>({ query }, `SELECT * FROM trips WHERE tenant_id=$1 AND driver_id=$2 AND status IN ('assigned','in_progress','completed') AND planned_date >= current_date - 1 ORDER BY planned_date, number`, [req.user!.tenantId, d.id]);
    const ids = trips.map((t) => t.id);
    const stops = ids.length ? await many<any>({ query }, `
      SELECT s.*, sh.number AS shipment_number, sh.cargo_description, sh.pieces, sh.weight_kg, (SELECT name FROM customers c WHERE c.id=sh.customer_id) AS customer_name,
             EXISTS (SELECT 1 FROM pods p WHERE p.trip_stop_id=s.id) AS has_pod
        FROM trip_stops s LEFT JOIN shipments sh ON sh.id=s.shipment_id WHERE s.trip_id = ANY($1) ORDER BY s.seq`, [ids]) : [];
    res.json({ data: trips.map((t) => ({ ...t, stops: stops.filter((s) => s.trip_id === t.id) })) });
  }),
);

driverRouter.post(
  '/trips/:id/start',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const d = await myDriver(req);
    const row = await tx(async (db) => {
      const r = await one<any>(db, `UPDATE trips SET status='in_progress', started_at=COALESCE(started_at, now()) WHERE id=$1 AND tenant_id=$2 AND driver_id=$3 AND status IN ('assigned','in_progress') RETURNING *`, [req.params.id, req.user!.tenantId, d.id]);
      if (!r) throw notFound('Trip not found');
      await db.query(`UPDATE drivers SET status='on_trip' WHERE id=$1`, [d.id]);
      // shipments on this trip are now out for delivery
      const ships = await many<any>(db, `SELECT DISTINCT s.shipment_id FROM trip_stops s WHERE s.trip_id=$1 AND s.kind='delivery' AND s.shipment_id IS NOT NULL`, [r.id]);
      for (const s of ships) {
        const cur = await one<any>(db, 'SELECT status FROM shipments WHERE id=$1', [s.shipment_id]);
        if (cur && ['arrived', 'cleared'].includes(cur.status)) await changeShipmentStatus(db, req.user!.tenantId, req.user!.id, s.shipment_id, 'out_for_delivery');
      }
      return r;
    });
    res.json(row);
  }),
);

driverRouter.post(
  '/stops/:id/arrive',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const d = await myDriver(req);
    const row = await one({ query }, `UPDATE trip_stops s SET status='arrived', arrived_at=COALESCE(arrived_at, now()) FROM trips t WHERE s.id=$1 AND s.trip_id=t.id AND t.driver_id=$2 AND s.tenant_id=$3 AND s.status='pending' RETURNING s.*`, [req.params.id, d.id, req.user!.tenantId]);
    if (!row) throw notFound('Stop not found');
    res.json(row);
  }),
);

const podSchema = z.object({
  client_id: z.string().min(8).max(64), // idempotency key generated on the device (offline safe)
  signed_by: z.string().min(2).max(120),
  signature: z.string().max(400_000).optional(), // data URL
  photos: z.array(z.string().max(2_500_000)).max(6).optional(), // data URLs
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lng: z.coerce.number().min(-180).max(180).nullish(),
  captured_at: z.string().optional(),
  notes: z.string().max(500).optional(),
  failed: z.boolean().optional(), // delivery attempt failed
});

/** Capture proof of delivery: signature + photos + GPS. Idempotent on client_id. Releases the shipment for invoicing. */
async function submitPod(req: any, stopId: string, b: z.infer<typeof podSchema>) {
  const d = await myDriver(req);
  const t = req.user.tenantId;
  const dup = await one<any>({ query }, 'SELECT * FROM pods WHERE tenant_id=$1 AND client_id=$2', [t, b.client_id]);
  if (dup) return { pod: dup, duplicate: true };
  return tx(async (db) => {
    const stop = await one<any>(db, `SELECT s.*, t.driver_id, t.id AS trip_id FROM trip_stops s JOIN trips t ON t.id=s.trip_id WHERE s.id=$1 AND s.tenant_id=$2 FOR UPDATE OF s`, [stopId, t]);
    if (!stop || stop.driver_id !== d.id) throw notFound('Stop not found');
    if (stop.status === 'done') throw conflict('Stop already completed');
    if (b.failed) {
      await db.query(`UPDATE trip_stops SET status='failed', notes=COALESCE($2, notes) WHERE id=$1`, [stopId, b.notes ?? null]);
      await notifyPermitted(t, 'dispatch', 'u', { title: 'Delivery attempt failed', body: b.notes || `Stop ${stop.seq}`, level: 'error', link: '/dispatch' }, db);
      return { pod: null, failed: true };
    }
    let sigKey: string | null = null;
    if (b.signature) {
      const dec = decodeDataUrl(b.signature);
      if (!dec || !/^image\/(png|jpeg)$/.test(dec.mime)) throw badRequest('Invalid signature image');
      sigKey = newKey(t, 'pod', 'signature.png');
      await storage.put(sigKey, dec.buf, dec.mime);
    }
    const photoKeys: string[] = [];
    for (const p of b.photos || []) {
      const dec = decodeDataUrl(p);
      if (!dec || !/^image\/(png|jpeg|webp)$/.test(dec.mime)) throw badRequest('Invalid photo');
      const k = newKey(t, 'pod', 'photo.jpg');
      await storage.put(k, dec.buf, dec.mime);
      photoKeys.push(k);
    }
    const pod = (await db.query(
      `INSERT INTO pods (tenant_id, trip_stop_id, shipment_id, signed_by, signature_key, photo_keys, lat, lng, captured_at, client_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, now()),$10,$11) RETURNING *`,
      [t, stopId, stop.shipment_id, b.signed_by, sigKey, JSON.stringify(photoKeys), b.lat ?? null, b.lng ?? null, b.captured_at ?? null, b.client_id, b.notes ?? null],
    )).rows[0];
    await db.query(`UPDATE trip_stops SET status='done', completed_at=COALESCE($2::timestamptz, now()), arrived_at=COALESCE(arrived_at, now()) WHERE id=$1`, [stopId, b.captured_at ?? null]);
    // attach to shipment documents so customers/finance see it immediately
    if (stop.shipment_id) {
      await db.query(`INSERT INTO documents (tenant_id, shipment_id, type, name, mime, storage_key, is_public, uploaded_by) VALUES ($1,$2,'POD',$3,'image/png',$4,true,$5)`, [t, stop.shipment_id, `POD — signed by ${b.signed_by}`, sigKey || photoKeys[0] || null, req.user.id]);
      if (stop.kind === 'delivery') {
        const sh = await one<any>(db, 'SELECT status, number FROM shipments WHERE id=$1', [stop.shipment_id]);
        if (sh && ['arrived', 'cleared', 'out_for_delivery'].includes(sh.status)) {
          if (sh.status !== 'out_for_delivery') await changeShipmentStatus(db, t, req.user.id, stop.shipment_id, 'out_for_delivery');
          await changeShipmentStatus(db, t, req.user.id, stop.shipment_id, 'delivered');
        }
        await db.query(`UPDATE milestones SET status='done', done_at=COALESCE(done_at, now()) WHERE shipment_id=$1 AND code='pod'`, [stop.shipment_id]);
        await refreshRisk(db, t, stop.shipment_id);
      }
    }
    // complete the trip when all stops are terminal
    const open = await one<any>(db, `SELECT count(*)::int AS n FROM trip_stops WHERE trip_id=$1 AND status IN ('pending','arrived')`, [stop.trip_id]);
    if (open!.n === 0) {
      await db.query(`UPDATE trips SET status='completed', completed_at=now() WHERE id=$1`, [stop.trip_id]);
      await db.query(`UPDATE drivers SET status='available' WHERE id=$1`, [d.id]);
    }
    publish({ tenantId: t, type: 'pod.received', entityType: 'shipment', entityId: stop.shipment_id ?? undefined, payload: { shipment_id: stop.shipment_id, signed_by: b.signed_by }, userId: req.user.id });
    return { pod, duplicate: false };
  });
}

driverRouter.post(
  '/stops/:id/pod',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    if (!isUuid(req.params.id)) throw notFound();
    const out = await submitPod(req, req.params.id, podSchema.parse(req.body));
    res.status(out.duplicate ? 200 : 201).json(out);
  }),
);

const expenseSchema = z.object({ client_id: z.string().min(8).max(64), trip_id: z.string().uuid().nullish(), category: z.enum(['fuel', 'toll', 'parking', 'fine', 'repair', 'other']), amount: z.coerce.number().positive().max(50_000), note: z.string().max(300).optional() });

async function submitExpense(req: any, b: z.infer<typeof expenseSchema>) {
  const d = await myDriver(req);
  const t = req.user.tenantId;
  const dup = await one<any>({ query }, 'SELECT * FROM driver_expenses WHERE tenant_id=$1 AND client_id=$2', [t, b.client_id]);
  if (dup) return dup;
  return tx(async (db) => {
    const settings = await getSettings(db, t);
    const status = b.amount > settings.expense_approval_threshold || b.category === 'fine' ? 'pending' : 'approved';
    const row = (await db.query(`INSERT INTO driver_expenses (tenant_id, driver_id, trip_id, category, amount, note, status, client_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [t, d.id, b.trip_id ?? null, b.category, b.amount, b.note ?? null, status, b.client_id])).rows[0];
    if (status === 'pending') await requestApproval(db, { tenantId: t, entityType: 'expense', entityId: row.id, title: `${d.name} — ${b.category} AED ${b.amount}`, summary: b.note, amount: b.amount, requestedBy: req.user.id });
    return row;
  });
}

driverRouter.post('/expenses', requirePerm('dispatch', 'u'), wrap(async (req, res) => res.status(201).json(await submitExpense(req, expenseSchema.parse(req.body)))));

driverRouter.get(
  '/expenses',
  requirePerm('dispatch', 'r'),
  wrap(async (req, res) => {
    const d = await myDriver(req);
    res.json({ data: await many({ query }, `SELECT * FROM driver_expenses WHERE tenant_id=$1 AND driver_id=$2 ORDER BY created_at DESC LIMIT 50`, [req.user!.tenantId, d.id]) });
  }),
);

/** Offline sync: apply a queue of operations recorded on the device. Each op is idempotent (client_id). */
driverRouter.post(
  '/sync',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ ops: z.array(z.object({ type: z.enum(['pod', 'expense', 'arrive']), stop_id: z.string().uuid().optional(), payload: z.any() })).max(100) }).parse(req.body);
    const results: any[] = [];
    for (const op of b.ops) {
      try {
        if (op.type === 'pod') {
          const r = await submitPod(req, op.stop_id!, podSchema.parse(op.payload));
          results.push({ ok: true, type: op.type, duplicate: r.duplicate });
        } else if (op.type === 'expense') {
          await submitExpense(req, expenseSchema.parse(op.payload));
          results.push({ ok: true, type: op.type });
        } else {
          const d = await myDriver(req);
          await query(`UPDATE trip_stops s SET status='arrived', arrived_at=COALESCE(arrived_at, now()) FROM trips t WHERE s.id=$1 AND s.trip_id=t.id AND t.driver_id=$2 AND s.status='pending'`, [op.stop_id, d.id]);
          results.push({ ok: true, type: op.type });
        }
      } catch (e: any) {
        results.push({ ok: false, type: op.type, error: e?.message || 'failed', permanent: e?.status >= 400 && e?.status < 500 });
      }
    }
    res.json({ results });
  }),
);

/** Ops verify PODs. */
dispatchRouter.post(
  '/pods/:id/verify',
  requirePerm('dispatch', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ approve: z.boolean(), notes: z.string().max(300).optional() }).parse(req.body);
    const row = await one({ query }, `UPDATE pods SET status=$3, verified_by=$4, notes=COALESCE($5, notes) WHERE id=$1 AND tenant_id=$2 RETURNING *`, [req.params.id, req.user!.tenantId, b.approve ? 'verified' : 'rejected', req.user!.id, b.notes ?? null]);
    if (!row) throw notFound();
    res.json(row);
  }),
);

export type { Db };
