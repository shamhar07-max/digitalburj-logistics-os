import { many, pool } from '../db';
import { logger } from '../logger';
import { publish } from './events';
import { notifyPermitted } from './notify';
import { refreshRisk } from './shipments';

const LOCK_KEY = 727_001; // pg advisory lock so only one API instance runs the sweep

async function sweep() {
  const client = await pool.connect();
  try {
    const got = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!got.rows[0].ok) return;
    try {
      const tenants = await many<{ id: string }>(client, 'SELECT id FROM tenants');
      for (const { id: tenantId } of tenants) {
        await refreshRisk(client, tenantId);

        // invoices that just became overdue
        const overdue = await many<any>(client, `UPDATE invoices SET status='overdue' WHERE tenant_id=$1 AND kind='tax_invoice' AND status IN ('sent','partial') AND due_date < current_date RETURNING id, number, customer_id, total - paid AS outstanding`, [tenantId]);
        for (const i of overdue) publish({ tenantId, type: 'invoice.overdue', entityType: 'invoice', entityId: i.id, payload: { number: i.number, customer_id: i.customer_id, outstanding: i.outstanding } });

        // quotes past validity
        await client.query(`UPDATE quotes SET status='expired' WHERE tenant_id=$1 AND status='sent' AND valid_until < current_date`, [tenantId]);

        // expiring documents: notify once per day
        const already = await client.query(`SELECT 1 FROM notifications WHERE tenant_id=$1 AND title LIKE 'Documents expiring%' AND created_at >= current_date LIMIT 1`, [tenantId]);
        if (!already.rowCount) {
          const exp = await client.query(
            `SELECT count(*)::int AS n FROM (
               SELECT visa_expiry AS d FROM employees WHERE tenant_id=$1 AND status<>'terminated' UNION ALL SELECT eid_expiry FROM employees WHERE tenant_id=$1 AND status<>'terminated'
               UNION ALL SELECT license_expiry FROM drivers WHERE tenant_id=$1 UNION ALL SELECT mulkiya_expiry FROM vehicles WHERE tenant_id=$1 UNION ALL SELECT insurance_expiry FROM vehicles WHERE tenant_id=$1) x
             WHERE d IS NOT NULL AND d <= current_date + 30`, [tenantId]);
          if (exp.rows[0].n > 0) await notifyPermitted(tenantId, 'hrms', 'r', { title: `Documents expiring soon (${exp.rows[0].n})`, body: 'Visas, licences or vehicle registrations expire within 30 days.', level: 'warning', link: '/hrms' }, client);
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } catch (err) {
    logger.error({ err }, 'scheduler sweep failed');
  } finally {
    client.release();
  }
}

export function startScheduler(everyMs = 5 * 60_000) {
  const t = setInterval(sweep, everyMs);
  t.unref();
  setTimeout(sweep, 15_000).unref();
  logger.info({ everyMs }, 'scheduler started');
  return () => clearInterval(t);
}
export { sweep as runSweepOnce };
