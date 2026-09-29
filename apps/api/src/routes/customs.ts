import { Router } from 'express';
import { z } from 'zod';
import { CUSTOMS_TRANSITIONS, canTransition } from '@digitalburj/shared';
import { one, tx } from '../db';
import { requirePerm } from '../auth/middleware';
import { badRequest, notFound, wrap } from '../lib/errors';
import { auditFromReq } from '../services/audit';
import { publish } from '../services/events';
import { notifyPermitted } from '../services/notify';
import { changeShipmentStatus, refreshRisk } from '../services/shipments';

export const customsRouter = Router();

/** Move a declaration through its lifecycle; keeps the shipment status/risk in sync. */
customsRouter.post(
  '/:id/status',
  requirePerm('customs', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ status: z.enum(['submitted', 'under_review', 'hold', 'cleared', 'rejected', 'draft']), hold_reason: z.string().max(300).optional() }).parse(req.body);
    const row = await tx(async (db) => {
      const t = req.user!.tenantId;
      const d = await one<any>(db, 'SELECT * FROM customs_declarations WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!d) throw notFound();
      if (!canTransition(CUSTOMS_TRANSITIONS, d.status, b.status)) throw badRequest(`Cannot move declaration from ${d.status} to ${b.status}`);
      if (b.status === 'hold' && !b.hold_reason) throw badRequest('A hold reason is required');
      if (b.status === 'submitted') {
        const missing: string[] = [];
        if (!d.hs_code) missing.push('HS code');
        if (!d.description) missing.push('goods description');
        if (!Number(d.cif_value)) missing.push('CIF value');
        if (missing.length) throw badRequest(`Cannot submit — missing: ${missing.join(', ')}`);
      }
      const r = (await db.query(
        `UPDATE customs_declarations SET status=$3, hold_reason=CASE WHEN $3='hold' THEN $4 ELSE NULL END,
             submitted_at=CASE WHEN $3='submitted' THEN now() ELSE submitted_at END, cleared_at=CASE WHEN $3='cleared' THEN now() ELSE cleared_at END
          WHERE id=$1 AND tenant_id=$2 RETURNING *`, [d.id, t, b.status, b.hold_reason ?? null])).rows[0];
      if (d.shipment_id) {
        const sh = await one<any>(db, 'SELECT status FROM shipments WHERE id=$1', [d.shipment_id]);
        if (b.status === 'cleared' && sh?.status === 'customs') await changeShipmentStatus(db, t, req.user!.id, d.shipment_id, 'cleared');
        await refreshRisk(db, t, d.shipment_id);
      }
      await auditFromReq(req, 'status', 'customs', d.id, { from: d.status, to: b.status, reason: b.hold_reason }, db);
      if (b.status === 'hold') {
        await notifyPermitted(t, 'shipments', 'u', { title: `Customs hold on ${d.number}`, body: b.hold_reason, level: 'error', link: '/customs' }, db);
      }
      return r;
    });
    publish({ tenantId: req.user!.tenantId, type: `customs.${row.status}`, entityType: 'customs', entityId: row.id, payload: { number: row.number, status: row.status, hold_reason: row.hold_reason }, userId: req.user!.id });
    res.json(row);
  }),
);
