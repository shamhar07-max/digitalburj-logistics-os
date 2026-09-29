import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config';
import { one, query, tx } from '../db';
import { badRequest, unauthorized, wrap } from '../lib/errors';
import { randomToken, sha256 } from '../lib/crypto';
import { authenticate, signAccess } from '../auth/middleware';
import { audit, auditFromReq } from '../services/audit';
import { sendEmail } from '../services/channels';
import { provisionTenant, slugify } from '../services/tenant';

export const authRouter = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

async function issueTokens(user: any, req: any) {
  const refresh = randomToken(48);
  await query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`, [
    user.id,
    sha256(refresh),
    String(config.REFRESH_TOKEN_DAYS),
    String(req.headers['user-agent'] || '').slice(0, 200),
    req.ip,
  ]);
  return { accessToken: signAccess(user.id, user.tenant_id), refreshToken: refresh };
}

/** Create a one-time set/reset-password link and email it (queued in the outbox if email is not configured). */
export async function sendPasswordLink(u: { id: string; tenant_id: string; email: string; name: string }, purpose: 'reset' | 'invite') {
  const token = randomToken(32);
  await query(`INSERT INTO password_resets (user_id, token_hash, purpose, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)`, [u.id, sha256(token), purpose, purpose === 'invite' ? '72' : '2']);
  const link = `${config.PUBLIC_WEB_URL}/reset-password?token=${token}`;
  const subject = purpose === 'invite' ? 'You have been invited to DigitalBurj Logistics OS' : 'Reset your password';
  const html = `<p>Hello ${u.name.replace(/[<>&]/g, '')},</p><p>${purpose === 'invite' ? 'Set your password to get started' : 'Use this link to choose a new password'}:</p><p><a href="${link}">${link}</a></p><p>The link expires in ${purpose === 'invite' ? '72 hours' : '2 hours'}.</p>`;
  const r = await sendEmail(u.tenant_id, u.email, subject, html);
  if (r.status !== 'sent') {
    await query(`INSERT INTO outbox (tenant_id, channel, recipient, subject, body, status, error) VALUES ($1,'email',$2,$3,$4,$5,$6)`, [u.tenant_id, u.email, subject, html, r.status === 'failed' ? 'failed' : 'queued', r.note ?? null]);
  }
  return { sent: r.status === 'sent', link: config.NODE_ENV === 'production' ? undefined : link };
}

const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, tenantId: u.tenant_id, customerId: u.customer_id, locale: u.locale });

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE lower(email)=lower($1)', [email]);
    // Constant-ish work regardless of user existence
    const hash = u?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    if (u?.locked_until && new Date(u.locked_until) > new Date()) throw unauthorized('Account temporarily locked. Try again later.');
    const ok = await bcrypt.compare(password, hash);
    if (!u || !ok || !u.is_active) {
      if (u) {
        const attempts = u.failed_attempts + 1;
        await query('UPDATE users SET failed_attempts=$2::int, locked_until=CASE WHEN $2::int >= $3::int THEN now() + ($4::text || \' minutes\')::interval ELSE locked_until END WHERE id=$1', [u.id, attempts, MAX_ATTEMPTS, String(LOCK_MINUTES)]);
        await audit({ tenantId: u.tenant_id, userId: u.id, userName: u.name, action: 'login_failed', entityType: 'user', entityId: u.id, ip: req.ip });
      }
      throw unauthorized('Invalid email or password');
    }
    await query('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login=now() WHERE id=$1', [u.id]);
    await audit({ tenantId: u.tenant_id, userId: u.id, userName: u.name, action: 'login', entityType: 'user', entityId: u.id, ip: req.ip });
    res.json({ user: publicUser(u), ...(await issueTokens(u, req)) });
  }),
);

/** Self-serve company sign-up (creates tenant, HQ entity, chart of accounts, roles, owner). */
authRouter.post(
  '/register',
  wrap(async (req, res) => {
    const b = z
      .object({
        companyName: z.string().min(2).max(120),
        name: z.string().min(2).max(120),
        email: z.string().email(),
        password: z.string().min(10, 'Password must be at least 10 characters').max(128),
        trn: z.string().regex(/^\d{15}$/, 'TRN must be 15 digits').optional().or(z.literal('')),
      })
      .parse(req.body);
    const exists = await one({ query }, 'SELECT 1 FROM users WHERE lower(email)=lower($1)', [b.email]);
    if (exists) throw badRequest('An account with this email already exists');
    const out = await tx(async (db) => {
      let slug = slugify(b.companyName);
      const clash = await one(db, 'SELECT 1 FROM tenants WHERE slug=$1', [slug]);
      if (clash) slug = `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
      return provisionTenant(db, { name: b.companyName, slug, ownerName: b.name, ownerEmail: b.email, ownerPassword: b.password, trn: b.trn || undefined });
    });
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1', [out.owner.id]);
    res.status(201).json({ user: publicUser(u), ...(await issueTokens(u, req)) });
  }),
);

authRouter.post(
  '/refresh',
  wrap(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const row = await one<any>({ query }, 'SELECT * FROM refresh_tokens WHERE token_hash=$1', [sha256(refreshToken)]);
    if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) throw unauthorized('Session expired');
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1', [row.user_id]);
    if (!u || !u.is_active) throw unauthorized('Account disabled');
    // rotate
    await query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1', [row.id]);
    res.json({ user: publicUser(u), ...(await issueTokens(u, req)) });
  }),
);

authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body || {});
    if (refreshToken) await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [sha256(refreshToken)]);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    const u = req.user!;
    const tenant = await one<any>({ query }, 'SELECT id, name, slug, trn, trade_license, currency, timezone, plan FROM tenants WHERE id=$1', [u.tenantId]);
    const restricted = u.entityIds.length > 0 && !['owner', 'admin'].includes(u.baseRole);
    const entities = restricted
      ? await query('SELECT id, code, name, branch FROM entities WHERE tenant_id=$1 AND id = ANY($2::uuid[]) ORDER BY is_default DESC, name', [u.tenantId, u.entityIds])
      : await query('SELECT id, code, name, branch FROM entities WHERE tenant_id=$1 ORDER BY is_default DESC, name', [u.tenantId]);
    res.json({
      user: { id: u.id, name: u.name, email: u.email, role: u.role, baseRole: u.baseRole, customerId: u.customerId, locale: u.locale },
      permissions: u.permissions,
      tenant,
      entities: entities.rows,
    });
  }),
);

/** Forgot password. Always answers 200 so accounts cannot be enumerated. */
authRouter.post(
  '/forgot',
  wrap(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE lower(email)=lower($1) AND is_active', [email]);
    if (u) await sendPasswordLink(u, 'reset');
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/reset',
  wrap(async (req, res) => {
    const b = z.object({ token: z.string().min(20), password: z.string().min(10).max(128) }).parse(req.body);
    const row = await one<any>({ query }, 'SELECT * FROM password_resets WHERE token_hash=$1', [sha256(b.token)]);
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) throw badRequest('This link is invalid or has expired');
    await tx(async (db) => {
      await db.query('UPDATE users SET password_hash=$2, failed_attempts=0, locked_until=NULL WHERE id=$1', [row.user_id, await bcrypt.hash(b.password, 12)]);
      await db.query('UPDATE password_resets SET used_at=now() WHERE id=$1', [row.id]);
      await db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [row.user_id]);
    });
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  wrap(async (req, res) => {
    const b = z.object({ currentPassword: z.string(), newPassword: z.string().min(10).max(128) }).parse(req.body);
    const u = await one<any>({ query }, 'SELECT * FROM users WHERE id=$1', [req.user!.id]);
    if (!(await bcrypt.compare(b.currentPassword, u.password_hash))) throw badRequest('Current password is incorrect');
    await query('UPDATE users SET password_hash=$2 WHERE id=$1', [u.id, await bcrypt.hash(b.newPassword, 12)]);
    await query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [u.id]);
    await auditFromReq(req, 'change_password', 'user', u.id);
    res.json({ ok: true });
  }),
);

authRouter.patch(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    const b = z.object({ name: z.string().min(2).optional(), phone: z.string().optional(), locale: z.enum(['en', 'ar']).optional() }).parse(req.body);
    await query('UPDATE users SET name=COALESCE($2,name), phone=COALESCE($3,phone), locale=COALESCE($4,locale) WHERE id=$1', [req.user!.id, b.name ?? null, b.phone ?? null, b.locale ?? null]);
    res.json({ ok: true });
  }),
);
