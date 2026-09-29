import { Router } from 'express';
import { z } from 'zod';
import { round2 } from '@digitalburj/shared';
import { many, one, query, tx } from '../db';
import { requirePerm } from '../auth/middleware';
import { badRequest, conflict, notFound, wrap } from '../lib/errors';
import { auditFromReq } from '../services/audit';
import { requestApproval } from '../services/approvals';
import { postEntry } from '../services/ledger';
import { decryptConfig } from '../lib/crypto';
import { buildSif, dailyRate, overlapDays, validateSif } from '../services/wps';

export const peopleRouter = Router();

peopleRouter.post(
  '/leave-requests/:id/submit',
  requirePerm('hrms', 'u'),
  wrap(async (req, res) => {
    const out = await tx(async (db) => {
      const l = await one<any>(db, `SELECT l.*, e.name FROM leave_requests l JOIN employees e ON e.id=l.employee_id WHERE l.id=$1 AND l.tenant_id=$2 FOR UPDATE OF l`, [req.params.id, req.user!.tenantId]);
      if (!l) throw notFound();
      if (l.status !== 'pending') throw conflict(`Request is ${l.status}`);
      const overlap = await one(db, `SELECT 1 FROM leave_requests WHERE employee_id=$1 AND id<>$2 AND status='approved' AND daterange(from_date,to_date,'[]') && daterange($3::date,$4::date,'[]')`, [l.employee_id, l.id, l.from_date, l.to_date]);
      if (overlap) throw conflict('Overlaps an approved leave for this employee');
      return requestApproval(db, { tenantId: req.user!.tenantId, entityType: 'leave', entityId: l.id, title: `Leave — ${l.name} (${l.days}d ${l.kind})`, summary: `${l.from_date} → ${l.to_date}`, requestedBy: req.user!.id });
    });
    res.json(out);
  }),
);

// ─────────────────────────── Payroll ───────────────────────────
export const payrollRouter = Router();
payrollRouter.use(requirePerm('payroll', 'r'));

payrollRouter.get(
  '/runs',
  wrap(async (req, res) => {
    res.json({ data: await many({ query }, `SELECT r.*, (SELECT count(*)::int FROM payslips p WHERE p.run_id=r.id) AS employees FROM payroll_runs r WHERE r.tenant_id=$1 ORDER BY r.period DESC`, [req.user!.tenantId]) });
  }),
);

payrollRouter.get(
  '/runs/:id',
  wrap(async (req, res) => {
    const run = await one({ query }, 'SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user!.tenantId]);
    if (!run) throw notFound();
    const slips = await many({ query }, `SELECT p.*, e.name, e.code, e.department FROM payslips p JOIN employees e ON e.id=p.employee_id WHERE p.run_id=$1 ORDER BY e.name`, [req.params.id]);
    res.json({ run, payslips: slips });
  }),
);

payrollRouter.post(
  '/runs',
  requirePerm('payroll', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(req.body);
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const ent = req.entityId || null;
      const exists = await one(db, `SELECT 1 FROM payroll_runs WHERE tenant_id=$1 AND period=$2 AND COALESCE(entity_id::text,'')=COALESCE($3::text,'') AND status <> 'cancelled'`, [t, b.period, ent]);
      if (exists) throw conflict(`A payroll run for ${b.period} already exists`);
      const emps = await many<any>(db, `SELECT * FROM employees WHERE tenant_id=$1 AND status IN ('active','on_leave') ${ent ? 'AND entity_id=$2' : ''} ORDER BY name`, ent ? [t, ent] : [t]);
      if (!emps.length) throw badRequest('No active employees');
      const run = (await db.query(`INSERT INTO payroll_runs (tenant_id, entity_id, period, created_by) VALUES ($1,$2,$3,$4) RETURNING *`, [t, ent, b.period, req.user!.id])).rows[0];
      let gross = 0, ded = 0, net = 0;
      for (const e of emps) {
        const g = round2(Number(e.basic) + Number(e.housing) + Number(e.transport) + Number(e.other_allowance));
        const unpaid = await many<any>(db, `SELECT from_date, to_date FROM leave_requests WHERE employee_id=$1 AND kind='unpaid' AND status='approved'`, [e.id]);
        const unpaidDays = unpaid.reduce((s, l) => s + overlapDays(l.from_date, l.to_date, b.period), 0);
        const deductions = round2(dailyRate(g) * unpaidDays);
        const n = round2(g - deductions);
        await db.query(`INSERT INTO payslips (tenant_id, run_id, employee_id, basic, allowances, deductions, net, days_worked, leave_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [t, run.id, e.id, e.basic, round2(g - Number(e.basic)), deductions, n, 30 - unpaidDays, unpaidDays]);
        gross += g; ded += deductions; net += n;
      }
      const r = (await db.query(`UPDATE payroll_runs SET total_gross=$2, total_deductions=$3, total_net=$4 WHERE id=$1 RETURNING *`, [run.id, round2(gross), round2(ded), round2(net)])).rows[0];
      await auditFromReq(req, 'create', 'payroll_run', run.id, { period: b.period, employees: emps.length }, db);
      return r;
    });
    res.status(201).json(out);
  }),
);

payrollRouter.patch(
  '/runs/:id/payslips/:pid',
  requirePerm('payroll', 'u'),
  wrap(async (req, res) => {
    const b = z.object({ overtime: z.coerce.number().min(0).optional(), deductions: z.coerce.number().min(0).optional(), notes: z.string().max(300).optional() }).parse(req.body);
    const row = await tx(async (db) => {
      const run = await one<any>(db, 'SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, req.user!.tenantId]);
      if (!run) throw notFound();
      if (run.status !== 'draft') throw conflict('Only draft runs can be edited');
      const p = await one<any>(db, 'SELECT * FROM payslips WHERE id=$1 AND run_id=$2', [req.params.pid, run.id]);
      if (!p) throw notFound();
      const overtime = b.overtime ?? p.overtime;
      const deductions = b.deductions ?? p.deductions;
      const net = round2(Number(p.basic) + Number(p.allowances) + overtime - deductions);
      const r = (await db.query(`UPDATE payslips SET overtime=$2, deductions=$3, net=$4, notes=COALESCE($5, notes) WHERE id=$1 RETURNING *`, [p.id, overtime, deductions, net, b.notes ?? null])).rows[0];
      const tot = await one<any>(db, `SELECT SUM(basic+allowances+overtime) AS gross, SUM(deductions) AS ded, SUM(net) AS net FROM payslips WHERE run_id=$1`, [run.id]);
      await db.query(`UPDATE payroll_runs SET total_gross=$2, total_deductions=$3, total_net=$4 WHERE id=$1`, [run.id, round2(tot!.gross), round2(tot!.ded), round2(tot!.net)]);
      return r;
    });
    res.json(row);
  }),
);

payrollRouter.post(
  '/runs/:id/submit',
  requirePerm('payroll', 'u'),
  wrap(async (req, res) => {
    const out = await tx(async (db) => {
      const run = await one<any>(db, 'SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, req.user!.tenantId]);
      if (!run) throw notFound();
      if (run.status !== 'draft') throw conflict(`Run is ${run.status}`);
      const a = await requestApproval(db, { tenantId: req.user!.tenantId, entityType: 'payroll', entityId: run.id, title: `Payroll ${run.period}`, summary: `Net AED ${Number(run.total_net).toLocaleString()}`, amount: run.total_net, priority: 'high', requestedBy: req.user!.id });
      await db.query(`UPDATE payroll_runs SET status='pending_approval', approval_id=$2 WHERE id=$1`, [run.id, a.id]);
      return a;
    });
    res.json(out);
  }),
);

payrollRouter.get(
  '/runs/:id/sif',
  requirePerm('payroll', 'x'),
  wrap(async (req, res) => {
    const t = req.user!.tenantId;
    const run = await one<any>({ query }, 'SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2', [req.params.id, t]);
    if (!run) throw notFound();
    if (!['approved', 'paid'].includes(run.status)) throw conflict('Payroll must be approved before generating the SIF');
    const rows = await many<any>({ query }, `SELECT p.*, e.name, e.person_id, e.routing_code, e.iban FROM payslips p JOIN employees e ON e.id=p.employee_id WHERE p.run_id=$1 AND p.net > 0 ORDER BY e.name`, [run.id]);
    const integ = await one<any>({ query }, `SELECT config FROM integrations WHERE tenant_id=$1 AND provider='wps'`, [t]);
    const cfg = decryptConfig(integ?.config || {});
    const employer = { establishment_id: String(cfg.establishment_id || ''), routing_code: String(cfg.routing_code || '') };
    const sifRows = rows.map((r) => ({ name: r.name, person_id: r.person_id, routing_code: r.routing_code, iban: r.iban, days: r.days_worked, fixed: round2(Number(r.basic) + Number(r.allowances) - Number(r.deductions)), variable: Number(r.overtime), leave_days: r.leave_days }));
    const errs = validateSif(employer, sifRows);
    if (errs.length) throw badRequest('SIF cannot be generated until these are fixed', errs);
    const sif = buildSif(employer as any, run.period, sifRows);
    await query('UPDATE payroll_runs SET sif_generated_at=now() WHERE id=$1', [run.id]);
    await auditFromReq(req, 'sif', 'payroll_run', run.id, { file: sif.filename, total: sif.total });
    res.type('text/plain').set('Content-Disposition', `attachment; filename="${sif.filename}"`).send(sif.content);
  }),
);

payrollRouter.post(
  '/runs/:id/pay',
  requirePerm('payroll', 'a'),
  requirePerm('accounting', 'c'),
  wrap(async (req, res) => {
    const b = z.object({ bank_account_id: z.string().uuid() }).parse(req.body);
    const out = await tx(async (db) => {
      const t = req.user!.tenantId;
      const run = await one<any>(db, 'SELECT * FROM payroll_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.id, t]);
      if (!run) throw notFound();
      if (run.status !== 'approved') throw conflict('Payroll must be approved before payment');
      const bank = await one<any>(db, 'SELECT code FROM accounts WHERE id=$1 AND tenant_id=$2 AND is_bank', [b.bank_account_id, t]);
      if (!bank) throw badRequest('Unknown bank account');
      await postEntry(db, { tenantId: t, entityId: run.entity_id, memo: `Payroll ${run.period}`, source: 'payroll', sourceId: run.id, userId: req.user!.id, lines: [{ account: '6000', debit: Number(run.total_net) }, { account: bank.code, credit: Number(run.total_net) }] });
      await auditFromReq(req, 'pay', 'payroll_run', run.id, { net: run.total_net }, db);
      return (await db.query(`UPDATE payroll_runs SET status='paid' WHERE id=$1 RETURNING *`, [run.id])).rows[0];
    });
    res.json(out);
  }),
);

/** Expiring documents across staff, drivers, vehicles (visa, EID, passport, licence, Mulkiya, insurance). */
export const complianceRouter = Router();
complianceRouter.get(
  '/expiries',
  wrap(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(String(req.query.days || '60'), 10) || 60));
    const t = req.user!.tenantId;
    const rows = await many({ query }, `
      SELECT * FROM (
        SELECT 'Employee' AS kind, name AS subject, 'Visa' AS doc, visa_expiry AS expires FROM employees WHERE tenant_id=$1 AND status <> 'terminated'
        UNION ALL SELECT 'Employee', name, 'Emirates ID', eid_expiry FROM employees WHERE tenant_id=$1 AND status <> 'terminated'
        UNION ALL SELECT 'Employee', name, 'Passport', passport_expiry FROM employees WHERE tenant_id=$1 AND status <> 'terminated'
        UNION ALL SELECT 'Driver', name, 'Licence', license_expiry FROM drivers WHERE tenant_id=$1 AND status <> 'inactive'
        UNION ALL SELECT 'Driver', name, 'Visa', visa_expiry FROM drivers WHERE tenant_id=$1 AND status <> 'inactive'
        UNION ALL SELECT 'Vehicle', plate, 'Mulkiya', mulkiya_expiry FROM vehicles WHERE tenant_id=$1 AND status <> 'retired'
        UNION ALL SELECT 'Vehicle', plate, 'Insurance', insurance_expiry FROM vehicles WHERE tenant_id=$1 AND status <> 'retired'
      ) x WHERE expires IS NOT NULL AND expires <= current_date + $2::int ORDER BY expires`, [t, days]);
    res.json({ data: (rows as any[]).map((r) => ({ ...r, days_left: Math.floor((Date.parse(r.expires) - Date.now()) / 86_400_000) })) });
  }),
);
