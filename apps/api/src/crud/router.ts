import { Router } from 'express';
import type { Request } from 'express';
import { many, nextRef, one, query, tx } from '../db';
import { can, requirePerm } from '../auth/middleware';
import { HttpError, notFound, wrap } from '../lib/errors';
import { auditFromReq } from '../services/audit';
import { publish } from '../services/events';
import type { Resource } from './types';
import { isUuid, validateBody } from './validate';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

/** Strip cost-sensitive fields unless the user holds costs:r */
export function stripSensitive<T extends Record<string, any>>(r: Resource, req: Request, row: T): T {
  if (!r.sensitive?.length || can(req, 'costs', 'r')) return row;
  const copy: any = { ...row };
  for (const k of r.sensitive) delete copy[k];
  return copy;
}

export function buildListQuery(r: Resource, req: Request) {
  const params: any[] = [req.user!.tenantId];
  const push = (v: any) => {
    params.push(v);
    return '$' + params.length;
  };
  const where: string[] = ['t.tenant_id = $1'];
  const q = req.query as Record<string, any>;

  if (r.entityScoped && req.entityId) where.push(`(t.entity_id = ${push(req.entityId)} OR t.entity_id IS NULL)`);
  const portal = r.portal?.(req, push);
  if (portal) where.push(portal);

  if (typeof q.search === 'string' && q.search.trim() && r.search?.length) {
    const p = push('%' + escapeLike(q.search.trim()) + '%');
    where.push('(' + r.search.map((c) => `t.${c}::text ILIKE ${p}`).join(' OR ') + ')');
  }
  for (const f of r.filters || []) {
    const raw = q[f];
    if (raw === undefined || raw === '') continue;
    const vals = String(raw).split(',').filter(Boolean);
    if (vals.length > 1) where.push(`t.${f}::text = ANY(${push(vals)}::text[])`);
    else if (vals.length === 1) where.push(`t.${f}::text = ${push(vals[0])}`);
  }
  const dateCol = r.dateCol || 'created_at';
  if (q.from && /^\d{4}-\d{2}-\d{2}/.test(String(q.from))) where.push(`t.${dateCol} >= ${push(String(q.from).slice(0, 10))}`);
  if (q.to && /^\d{4}-\d{2}-\d{2}/.test(String(q.to))) where.push(`t.${dateCol} < (${push(String(q.to).slice(0, 10))}::date + 1)`);

  let orderBy = r.sort || 't.created_at DESC';
  if (typeof q.sort === 'string') {
    const [col, dir] = q.sort.split(':');
    const allowed = new Set([...r.cols.map((c) => c.n), 'id', 'created_at', 'updated_at']);
    if (allowed.has(col)) orderBy = `t.${col} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, t.id`;
  }
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(q.pageSize, 10) || 50));
  return { where: where.join(' AND '), params, orderBy, page, pageSize };
}

export function buildResourceRouter(r: Resource): Router {
  const router = Router();
  const sel = `SELECT t.*${r.select ? ', ' + r.select : ''} FROM ${r.table} t`;
  const evt = r.event || r.key;
  const dis = new Set(r.disable || []);

  router.get(
    '/',
    requirePerm(r.module, 'r'),
    wrap(async (req, res) => {
      const { where, params, orderBy, page, pageSize } = buildListQuery(r, req);
      const [rows, cnt] = await Promise.all([
        many({ query }, `${sel} WHERE ${where} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params),
        one<{ n: number }>({ query }, `SELECT count(*)::int AS n FROM ${r.table} t WHERE ${where}`, params),
      ]);
      res.json({ data: rows.map((x) => stripSensitive(r, req, x)), total: cnt?.n ?? 0, page, pageSize });
    }),
  );

  router.get(
    '/:id',
    requirePerm(r.module, 'r'),
    wrap(async (req, res) => {
      if (!isUuid(req.params.id)) throw notFound();
      const params: any[] = [req.user!.tenantId, req.params.id];
      const push = (v: any) => (params.push(v), '$' + params.length);
      const portal = r.portal?.(req, push);
      const row = await one({ query }, `${sel} WHERE t.tenant_id=$1 AND t.id=$2${portal ? ' AND ' + portal : ''}`, params);
      if (!row) throw notFound();
      res.json(stripSensitive(r, req, row));
    }),
  );

  if (!dis.has('create')) {
    router.post(
      '/',
      requirePerm(r.module, 'c'),
      wrap(async (req, res) => {
        const data = validateBody(r.cols, req.body, false);
        const row = await tx(async (db) => {
          const ctx = { req, db, tenantId: req.user!.tenantId, userId: req.user!.id };
          if (r.ref) data[r.ref.col] = data[r.ref.col] || (await nextRef(db, ctx.tenantId, r.table + ':' + r.ref.col, r.ref.prefix, r.ref.pad ?? 0, r.ref.start ?? 0));
          await r.beforeSave?.(ctx, data, null);
          data.tenant_id = ctx.tenantId;
          if (r.entityScoped) data.entity_id = req.entityId || req.user!.entityIds[0] || (await one<any>(db, 'SELECT id FROM entities WHERE tenant_id=$1 ORDER BY is_default DESC LIMIT 1', [ctx.tenantId]))?.id || null;
          if (r.createdBy) data.created_by = ctx.userId;
          const keys = Object.keys(data);
          const created = (await db.query(`INSERT INTO ${r.table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, keys.map((k) => data[k]))).rows[0];
          await r.afterSave?.(ctx, created, null);
          await auditFromReq(req, 'create', r.key, created.id, data, db);
          return created;
        });
        publish({ tenantId: req.user!.tenantId, type: `${evt}.created`, entityType: r.key, entityId: row.id, payload: { id: row.id }, userId: req.user!.id });
        const full = await one({ query }, `${sel} WHERE t.id=$1`, [row.id]);
        res.status(201).json(stripSensitive(r, req, full));
      }),
    );
  }

  if (!dis.has('update')) {
    router.patch(
      '/:id',
      requirePerm(r.module, 'u'),
      wrap(async (req, res) => {
        if (!isUuid(req.params.id)) throw notFound();
        const data = validateBody(r.cols, req.body, true);
        if (!Object.keys(data).length) throw new HttpError(400, 'Nothing to update', 'bad_request');
        const updated = await tx(async (db) => {
          const existing = await one<any>(db, `SELECT * FROM ${r.table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [req.user!.tenantId, req.params.id]);
          if (!existing) throw notFound();
          const ctx = { req, db, tenantId: req.user!.tenantId, userId: req.user!.id };
          await r.beforeSave?.(ctx, data, existing);
          const keys = Object.keys(data);
          const row = (await db.query(`UPDATE ${r.table} SET ${keys.map((k, i) => `${k}=$${i + 3}`).join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`, [ctx.tenantId, req.params.id, ...keys.map((k) => data[k])])).rows[0];
          await r.afterSave?.(ctx, row, existing);
          const diff: Record<string, any> = {};
          for (const k of keys) if (JSON.stringify(existing[k]) !== JSON.stringify(row[k])) diff[k] = { from: existing[k], to: row[k] };
          await auditFromReq(req, 'update', r.key, row.id, diff, db);
          return { row, existing };
        });
        publish({ tenantId: req.user!.tenantId, type: `${evt}.updated`, entityType: r.key, entityId: updated.row.id, payload: { id: updated.row.id }, userId: req.user!.id });
        const full = await one({ query }, `${sel} WHERE t.id=$1`, [updated.row.id]);
        res.json(stripSensitive(r, req, full));
      }),
    );
  }

  if (!dis.has('delete')) {
    router.delete(
      '/:id',
      requirePerm(r.module, 'd'),
      wrap(async (req, res) => {
        if (!isUuid(req.params.id)) throw notFound();
        await tx(async (db) => {
          const existing = await one<any>(db, `SELECT * FROM ${r.table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [req.user!.tenantId, req.params.id]);
          if (!existing) throw notFound();
          await r.beforeDelete?.({ req, db, tenantId: req.user!.tenantId, userId: req.user!.id }, existing);
          await db.query(`DELETE FROM ${r.table} WHERE tenant_id=$1 AND id=$2`, [req.user!.tenantId, req.params.id]);
          await auditFromReq(req, 'delete', r.key, existing.id, existing, db);
        });
        publish({ tenantId: req.user!.tenantId, type: `${evt}.deleted`, entityType: r.key, entityId: req.params.id, userId: req.user!.id });
        res.status(204).end();
      }),
    );
  }

  return router;
}
