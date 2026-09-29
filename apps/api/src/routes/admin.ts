import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { MODULES, PERMISSION_MATRIX, ROLES, ROLE_LABELS, validTRN } from '@digitalburj/shared';
import { many, one, query, tx } from '../db';
import { clearRoleCache, requirePerm } from '../auth/middleware';
import { badRequest, conflict, forbidden, notFound, wrap } from '../lib/errors';
import { isUuid } from '../crud/validate';
import { auditFromReq } from '../services/audit';
import { randomToken, encryptConfig, maskConfig } from '../lib/crypto';
import { DEFAULT_SETTINGS } from '../services/settings';
import { sendPasswordLink } from './auth';

export const adminRouter = Router();

// ───────── Users ─────────
adminRouter.get(
  '/users',
  requirePerm('permissions', 'r'),
  wrap(async (req, res) => {
    res.json({ data: await many({ query }, `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.last_login, u.customer_id, u.entity_ids, u.locale, (SELECT name FROM customers c WHERE c.id=u.customer_id) AS customer_name FROM users u WHERE u.tenant_id=$1 ORDER BY u.name`, [req.user!.tenantId]) });
  }),
);

async function assertRoleExists(tenantId: string, role: string) {
  const r = await one({ query }, 'SELECT 1 FROM roles WHERE tenant_id=$1 AND key=$2', [tenantId, role]);
  if (!r) throw badRequest(`Unknown role: ${role}`);
}

adminRouter.post(
  '/users',
  requirePerm('permissions', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ name: z.string().min(2).max(120), email: z.string().email(), phone: z.string().max(40).optional(), role: z.string().min(2).max(40), customer_id: z.string().uuid().nullish(), entity_ids: z.array(z.string().uuid()).optional(), password: z.string().min(10).max(128).optional() }).parse(req.body);
    await assertRoleExists(req.user!.tenantId, b.role);
    if (b.role === 'owner' && req.user!.baseRole !== 'owner') throw forbidden('Only an owner can create another owner');
    if (b.role === 'customer' && !b.customer_id) throw badRequest('Portal users must be linked to a customer');
    if (await one({ query }, 'SELECT 1 FROM users WHERE lower(email)=lower($1)', [b.email])) throw conflict('That email is already registered');
    const row = await one<any>({ query }, `INSERT INTO users (tenant_id, email, password_hash, name, phone, role, customer_id, entity_ids) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, email, role`,
      [req.user!.tenantId, b.email.toLowerCase(), await bcrypt.hash(b.password || randomToken(24), 12), b.name, b.phone ?? null, b.role, b.customer_id ?? null, b.entity_ids ?? []]);
    const invite = b.password ? null : await sendPasswordLink({ id: row.id, tenant_id: req.user!.tenantId, email: row.email, name: row.name }, 'invite');
    await auditFromReq(req, 'create', 'user', row.id, { email: b.email, role: b.role });
    res.status(201).json({ user: row, invite });
  }),
);

adminRouter.patch(
  '/users/:id',
  requirePerm('permissions', 'u'),
  wrap(async (req, res) => {
    if (!isUuid(req.params.id)) throw notFound();
    const b = z.object({ name: z.string().min(2).optional(), phone: z.string().max(40).nullish(), role: z.string().optional(), is_active: z.boolean().optional(), entity_ids: z.array(z.string().uuid()).optional(), customer_id: z.string().uuid().nullish() }).parse(req.body);
    const t = req.user!.tenantId;
    const target = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1 AND tenant_id=$2', [req.params.id, t]);
    if (!target) throw notFound();
    if (b.role) {
      await assertRoleExists(t, b.role);
      if ((b.role === 'owner' || target.role === 'owner') && req.user!.baseRole !== 'owner') throw forbidden('Only an owner can change owner roles');
    }
    if ((b.role && b.role !== 'owner') || b.is_active === false) {
      if (target.role === 'owner') {
        const owners = await one<any>({ query }, `SELECT count(*)::int AS n FROM users WHERE tenant_id=$1 AND role='owner' AND is_active AND id<>$2`, [t, target.id]);
        if (owners!.n === 0) throw conflict('The last active owner cannot be demoted or disabled');
      }
    }
    if (target.id === req.user!.id && b.is_active === false) throw conflict('You cannot disable your own account');
    const row = await one({ query }, `UPDATE users SET name=COALESCE($3,name), phone=COALESCE($4,phone), role=COALESCE($5,role), is_active=COALESCE($6,is_active), entity_ids=COALESCE($7,entity_ids), customer_id=COALESCE($8,customer_id) WHERE id=$1 AND tenant_id=$2 RETURNING id, name, email, role, is_active`,
      [target.id, t, b.name ?? null, b.phone ?? null, b.role ?? null, b.is_active ?? null, b.entity_ids ?? null, b.customer_id ?? null]);
    if (b.role || b.is_active === false) await query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [target.id]);
    await auditFromReq(req, 'update', 'user', target.id, b);
    res.json(row);
  }),
);

adminRouter.post(
  '/users/:id/reset-password',
  requirePerm('permissions', 'u'),
  wrap(async (req, res) => {
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!u) throw notFound();
    const r = await sendPasswordLink(u, 'reset');
    await auditFromReq(req, 'reset_password', 'user', u.id);
    res.json(r);
  }),
);

// ───────── Roles & permission matrix ─────────
adminRouter.get(
  '/roles',
  requirePerm('permissions', 'r'),
  wrap(async (req, res) => {
    const rows = await many({ query }, `SELECT r.*, (SELECT count(*)::int FROM users u WHERE u.tenant_id=r.tenant_id AND u.role=r.key) AS users FROM roles r WHERE r.tenant_id=$1 ORDER BY r.is_system DESC, r.label`, [req.user!.tenantId]);
    res.json({ data: rows, modules: MODULES, defaults: PERMISSION_MATRIX, roleLabels: ROLE_LABELS });
  }),
);

const permSchema = z.record(z.string(), z.string().regex(/^[crudax ]*$/)).refine((p) => Object.keys(p).every((k) => (MODULES as readonly string[]).includes(k)), 'Unknown module');

adminRouter.post(
  '/roles',
  requirePerm('permissions', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ label: z.string().min(2).max(60), base_role: z.enum(ROLES as any), permissions: permSchema }).parse(req.body);
    const key = 'custom_' + b.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    if (await one({ query }, 'SELECT 1 FROM roles WHERE tenant_id=$1 AND key=$2', [req.user!.tenantId, key])) throw conflict('A role with that name already exists');
    if (b.base_role === 'owner' && req.user!.baseRole !== 'owner') throw forbidden();
    const row = await one<any>({ query }, `INSERT INTO roles (tenant_id, key, label, base_role, permissions, is_system) VALUES ($1,$2,$3,$4,$5,false) RETURNING *`, [req.user!.tenantId, key, b.label, b.base_role, JSON.stringify(b.permissions)]);
    await auditFromReq(req, 'create', 'role', row.id, b);
    res.status(201).json(row);
  }),
);

adminRouter.patch(
  '/roles/:id',
  requirePerm('permissions', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ label: z.string().min(2).max(60).optional(), permissions: permSchema.optional(), reset: z.boolean().optional() }).parse(req.body);
    const role = await one<any>({ query }, 'SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!role) throw notFound();
    if (role.key === 'owner') throw forbidden('The owner role always has full access');
    let perms = b.permissions;
    if (b.reset) {
      if (!role.is_system) throw badRequest('Only built-in roles can be reset');
      perms = PERMISSION_MATRIX[role.key as keyof typeof PERMISSION_MATRIX] as any;
    }
    const row = await one({ query }, `UPDATE roles SET label=COALESCE($3,label), permissions=COALESCE($4::jsonb,permissions) WHERE id=$1 AND tenant_id=$2 RETURNING *`, [role.id, req.user!.tenantId, b.label ?? null, perms ? JSON.stringify(perms) : null]);
    clearRoleCache();
    await auditFromReq(req, 'update', 'role', role.id, { label: b.label, permissions: perms });
    res.json(row);
  }),
);

adminRouter.delete(
  '/roles/:id',
  requirePerm('permissions', 'd'),
  wrap(async (req, res) => {
    const role = await one<any>({ query }, 'SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!role) throw notFound();
    if (role.is_system) throw forbidden('Built-in roles cannot be deleted');
    const used = await one<any>({ query }, 'SELECT count(*)::int AS n FROM users WHERE tenant_id=$1 AND role=$2', [req.user!.tenantId, role.key]);
    if (used!.n) throw conflict(`${used!.n} user(s) still have this role`);
    await query('DELETE FROM roles WHERE id=$1', [role.id]);
    clearRoleCache();
    await auditFromReq(req, 'delete', 'role', role.id, { key: role.key });
    res.status(204).end();
  }),
);

// ───────── Company settings ─────────
adminRouter.get(
  '/settings',
  requirePerm('settings', 'r'),
  wrap(async (req, res) => {
    const t = await one<any>({ query }, 'SELECT id, name, slug, trn, trade_license, currency, timezone, plan, settings FROM tenants WHERE id=$1', [req.user!.tenantId]);
    const entities = await many({ query }, 'SELECT * FROM entities WHERE tenant_id=$1 ORDER BY is_default DESC, name', [req.user!.tenantId]);
    res.json({ tenant: { ...t, settings: { ...DEFAULT_SETTINGS, ...t.settings } }, entities });
  }),
);

adminRouter.patch(
  '/settings',
  requirePerm('settings', 'u'),
  wrap(async (req, res) => {
    const b = z.object({
      name: z.string().min(2).max(150).optional(),
      trn: z.string().refine((v) => v === '' || validTRN(v), 'TRN must be 15 digits').optional(),
      trade_license: z.string().max(60).optional(),
      settings: z.object({
        min_margin_pct: z.coerce.number().min(-100).max(100).optional(), quote_approval_threshold: z.coerce.number().min(0).optional(), po_approval_threshold: z.coerce.number().min(0).optional(),
        expense_approval_threshold: z.coerce.number().min(0).optional(), invoice_terms_days: z.coerce.number().int().min(0).max(365).optional(), ai_enabled: z.boolean().optional(),
      }).optional(),
    }).parse(req.body);
    const row = await one<any>({ query }, `UPDATE tenants SET name=COALESCE($2,name), trn=COALESCE(NULLIF($3,''),trn), trade_license=COALESCE($4,trade_license), settings=settings || COALESCE($5::jsonb,'{}'::jsonb) WHERE id=$1 RETURNING id, name, trn, trade_license, settings`,
      [req.user!.tenantId, b.name ?? null, b.trn ?? null, b.trade_license ?? null, b.settings ? JSON.stringify(b.settings) : null]);
    await auditFromReq(req, 'update', 'settings', req.user!.tenantId, b);
    res.json(row);
  }),
);

adminRouter.post(
  '/entities',
  requirePerm('settings', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ code: z.string().min(2).max(10).transform((s) => s.toUpperCase()), name: z.string().min(2).max(150), branch: z.string().max(100).optional(), trn: z.string().refine((v) => v === '' || validTRN(v), 'TRN must be 15 digits').optional() }).parse(req.body);
    const row = await one({ query }, `INSERT INTO entities (tenant_id, code, name, branch, trn) VALUES ($1,$2,$3,$4,NULLIF($5,'')) RETURNING *`, [req.user!.tenantId, b.code, b.name, b.branch ?? null, b.trn ?? '']);
    await auditFromReq(req, 'create', 'entity', (row as any).id, b);
    res.status(201).json(row);
  }),
);

// ───────── Integrations (secrets encrypted at rest, masked on read) ─────────
const PROVIDERS: Record<string, { label: string; fields: string[] }> = {
  whatsapp: { label: 'WhatsApp Business (Meta Cloud API)', fields: ['token', 'phone_id', 'waba_id'] },
  email: { label: 'Email (Resend)', fields: ['api_key', 'from'] },
  wps: { label: 'WPS payroll (MOHRE)', fields: ['establishment_id', 'routing_code'] },
  asp: { label: 'FTA e-invoicing ASP', fields: ['endpoint', 'api_key'] },
  tracking: { label: 'Container tracking', fields: ['api_key', 'provider'] },
};

adminRouter.get(
  '/integrations',
  requirePerm('settings', 'r'),
  wrap(async (req, res) => {
    const rows = await many<any>({ query }, 'SELECT provider, enabled, config, updated_at FROM integrations WHERE tenant_id=$1', [req.user!.tenantId]);
    res.json({ data: Object.entries(PROVIDERS).map(([provider, meta]) => { const r = rows.find((x) => x.provider === provider); return { provider, ...meta, enabled: !!r?.enabled, config: maskConfig(r?.config || {}), updated_at: r?.updated_at ?? null }; }) });
  }),
);

adminRouter.put(
  '/integrations/:provider',
  requirePerm('settings', 'u'),
  wrap(async (req, res) => {
    const meta = PROVIDERS[req.params.provider];
    if (!meta) throw notFound('Unknown integration');
    const b = z.object({ enabled: z.boolean(), config: z.record(z.string(), z.string().max(2000)) }).parse(req.body);
    const clean = Object.fromEntries(Object.entries(b.config).filter(([k]) => meta.fields.includes(k)));
    const prev = await one<any>({ query }, 'SELECT config FROM integrations WHERE tenant_id=$1 AND provider=$2', [req.user!.tenantId, req.params.provider]);
    const enc = encryptConfig(clean, prev?.config || {});
    await tx(async (db) => {
      await db.query(`INSERT INTO integrations (tenant_id, provider, enabled, config) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, provider) DO UPDATE SET enabled=$3, config=$4, updated_at=now()`, [req.user!.tenantId, req.params.provider, b.enabled, JSON.stringify(enc)]);
      await auditFromReq(req, 'configure', 'integration', req.params.provider, { enabled: b.enabled, fields: Object.keys(clean) }, db);
    });
    res.json({ ok: true });
  }),
);

// ───────── Audit trail ─────────
adminRouter.get(
  '/audit',
  requirePerm('audit', 'r'),
  wrap(async (req, res) => {
    const q = req.query as Record<string, string>;
    const params: any[] = [req.user!.tenantId];
    const where = ['tenant_id=$1'];
    const push = (v: any) => (params.push(v), '$' + params.length);
    if (q.entity_type) where.push(`entity_type=${push(q.entity_type)}`);
    if (q.entity_id) where.push(`entity_id=${push(q.entity_id)}`);
    if (q.user_id && isUuid(q.user_id)) where.push(`user_id=${push(q.user_id)}`);
    if (q.action) where.push(`action=${push(q.action)}`);
    if (q.from) where.push(`created_at >= ${push(q.from.slice(0, 10))}`);
    if (q.to) where.push(`created_at < (${push(q.to.slice(0, 10))}::date + 1)`);
    const pageSize = Math.min(200, parseInt(q.pageSize, 10) || 50);
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const [rows, total] = await Promise.all([
      many({ query }, `SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params),
      one<any>({ query }, `SELECT count(*)::int AS n FROM audit_log WHERE ${where.join(' AND ')}`, params),
    ]);
    res.json({ data: rows, total: total!.n, page, pageSize });
  }),
);
