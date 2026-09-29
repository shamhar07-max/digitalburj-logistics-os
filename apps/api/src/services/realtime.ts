import type http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccess } from '../auth/middleware';
import { one, query } from '../db';
import { logger } from '../logger';
import { bus, type DomainEvent } from './events';

interface Client {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  role: string;
  customerId: string | null;
  alive: boolean;
}

const clients = new Set<Client>();

/** WebSocket hub at /ws?token=<access token>. Tenant-scoped fan-out; portal users only receive events for their own customer. */
export function attachRealtime(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

  wss.on('connection', async (ws, req) => {
    try {
      const token = new URL(req.url || '', 'http://x').searchParams.get('token') || '';
      const claims = verifyAccess(token);
      const u = await one<any>({ query }, 'SELECT id, tenant_id, role, customer_id, is_active FROM users WHERE id=$1 AND tenant_id=$2', [claims.sub, claims.tid]);
      if (!u || !u.is_active) return ws.close(4401, 'unauthorized');
      const c: Client = { ws, tenantId: u.tenant_id, userId: u.id, role: u.role, customerId: u.customer_id, alive: true };
      clients.add(c);
      ws.on('pong', () => (c.alive = true));
      ws.on('close', () => clients.delete(c));
      ws.on('error', () => clients.delete(c));
      ws.send(JSON.stringify({ type: 'hello' }));
    } catch {
      ws.close(4401, 'unauthorized');
    }
  });

  bus.on('event', (e: DomainEvent) => {
    const msg = JSON.stringify({ type: e.type, entityType: e.entityType, entityId: e.entityId, payload: e.payload && { ...e.payload, hold_reason: undefined }, at: new Date().toISOString() });
    for (const c of clients) {
      if (c.tenantId !== e.tenantId || c.ws.readyState !== WebSocket.OPEN) continue;
      if (c.role === 'customer' && !(e.payload?.customer_id && e.payload.customer_id === c.customerId)) continue;
      if (c.role === 'driver' && !e.type.startsWith('trip.')) continue;
      if (e.type === 'notification.created' && e.payload?.user_id && e.payload.user_id !== c.userId) continue;
      c.ws.send(msg);
    }
  });

  // heartbeat: drop dead sockets
  const iv = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.ws.terminate();
        clients.delete(c);
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(iv));
  logger.info('realtime hub attached at /ws');
  return wss;
}
