import dns from 'node:dns/promises';
import net from 'node:net';
import { many, one, query } from '../db';
import { logger } from '../logger';
import { bus, type DomainEvent } from './events';
import { notifyPermitted } from './notify';
import { sendOnChannel } from './channels';

/** Safe {{path}} interpolation (no eval). */
export function render(tpl: string, data: Record<string, any>): string {
  return String(tpl ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const v = path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), data);
    return v === undefined || v === null ? '' : String(v);
  });
}

export interface Condition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}
export function matches(conds: Condition[], data: Record<string, any>): boolean {
  return (conds || []).every((c) => {
    const v = c.field.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), data);
    switch (c.op) {
      case 'eq': return String(v) === String(c.value);
      case 'neq': return String(v) !== String(c.value);
      case 'gt': return Number(v) > Number(c.value);
      case 'gte': return Number(v) >= Number(c.value);
      case 'lt': return Number(v) < Number(c.value);
      case 'lte': return Number(v) <= Number(c.value);
      case 'contains': return String(v ?? '').toLowerCase().includes(String(c.value).toLowerCase());
      case 'in': return Array.isArray(c.value) && c.value.map(String).includes(String(v));
      default: return false;
    }
  });
}

/** SSRF guard for outbound webhooks: https only, no private/loopback/link-local targets. */
export async function assertPublicHttps(url: string) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Webhook URL must use https');
  const host = u.hostname;
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  for (const { address } of addrs) {
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(address)) throw new Error('Webhook target is not a public address');
  }
}

async function runAction(tenantId: string, action: any, evt: DomainEvent) {
  const data = { ...(evt.payload || {}), event: evt.type, id: evt.entityId };
  switch (action.type) {
    case 'notify':
      await notifyPermitted(tenantId, action.module || 'dashboard', action.action || 'r', { title: render(action.title, data), body: render(action.body || '', data), level: action.level || 'info', link: action.link });
      return 'notified';
    case 'customer_message': {
      const cid = evt.payload?.customer_id;
      if (!cid) return 'skipped: no customer on event';
      const th = await one<any>({ query }, `SELECT * FROM threads WHERE tenant_id=$1 AND customer_id=$2 AND status='open' AND channel IN ('whatsapp','portal') ORDER BY (channel='whatsapp') DESC, last_message_at DESC LIMIT 1`, [tenantId, cid]);
      const text = render(action.text, data);
      if (!th) {
        // no open thread: post on the customer's portal thread so the update is never lost
        const t2 = (await query(`INSERT INTO threads (tenant_id, customer_id, contact_name, channel, subject) VALUES ($1,$2,'Updates','portal','Shipment updates') RETURNING *`, [tenantId, cid])).rows[0];
        await query(`INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel) VALUES ($1,$2,'out','Automation',$3,'portal')`, [tenantId, t2.id, text]);
        await query(`UPDATE threads SET last_message_preview=$2 WHERE id=$1`, [t2.id, text.slice(0, 120)]);
        return 'posted to portal';
      }
      const r = await sendOnChannel(tenantId, th.channel, th.external_id, text, th.subject);
      await query(`INSERT INTO messages (tenant_id, thread_id, direction, sender, body, channel, status, external_id) VALUES ($1,$2,'out','Automation',$3,$4,$5,$6)`, [tenantId, th.id, text, th.channel, r.status, r.externalId ?? null]);
      await query(`UPDATE threads SET last_message_at=now(), last_message_preview=$2 WHERE id=$1`, [th.id, text.slice(0, 120)]);
      return `message ${r.status}`;
    }
    case 'webhook': {
      await assertPublicHttps(action.url);
      const r = await fetch(action.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: evt.type, data }), signal: AbortSignal.timeout(10_000), redirect: 'error' });
      return `webhook ${r.status}`;
    }
    case 'set_priority':
      if (evt.entityType === 'shipment' && evt.entityId) await query(`UPDATE shipments SET priority=$3 WHERE id=$1 AND tenant_id=$2`, [evt.entityId, tenantId, action.priority || 'high']);
      return 'priority set';
    default:
      return `unknown action ${action.type}`;
  }
}

const SKIP = new Set(['notification.created', 'message.created']);
let started = false;

/** Subscribe to the domain event bus and execute matching, enabled workflows. Failures are logged per run, never thrown. */
export function startAutomation() {
  if (started) return;
  started = true;
  bus.on('event', async (evt: DomainEvent) => {
    if (SKIP.has(evt.type)) return;
    try {
      const wfs = await many<any>({ query }, `SELECT * FROM workflows WHERE tenant_id=$1 AND enabled AND trigger_event=$2`, [evt.tenantId, evt.type]);
      for (const wf of wfs) {
        const data = { ...(evt.payload || {}), event: evt.type };
        if (!matches(wf.conditions, data)) continue;
        const results: string[] = [];
        let ok = true;
        for (const a of wf.actions || []) {
          try {
            results.push(await runAction(evt.tenantId, a, evt));
          } catch (err: any) {
            ok = false;
            results.push(`error: ${err?.message || err}`);
          }
        }
        await query(`INSERT INTO workflow_runs (tenant_id, workflow_id, event, payload, result, ok) VALUES ($1,$2,$3,$4,$5,$6)`, [evt.tenantId, wf.id, evt.type, JSON.stringify(evt.payload || {}), JSON.stringify(results), ok]);
        await query(`UPDATE workflows SET run_count=run_count+1, last_run_at=now() WHERE id=$1`, [wf.id]);
      }
    } catch (err) {
      logger.error({ err, evt: evt.type }, 'automation dispatch failed');
    }
  });
}
