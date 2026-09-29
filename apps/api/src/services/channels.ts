import { waId } from '@digitalburj/shared';
import { config } from '../config';
import { one, query } from '../db';
import { decryptConfig } from '../lib/crypto';
import { logger } from '../logger';

export interface SendResult {
  status: 'sent' | 'queued' | 'failed';
  externalId?: string;
  note?: string;
}

async function integrationConfig(tenantId: string, provider: string) {
  const r = await one<any>({ query }, 'SELECT enabled, config FROM integrations WHERE tenant_id=$1 AND provider=$2', [tenantId, provider]);
  return r?.enabled ? decryptConfig(r.config || {}) : null;
}

/** Outbound WhatsApp via Meta Cloud API. Not configured -> 'queued' (never pretends it was delivered). */
export async function sendWhatsApp(tenantId: string, to: string, text: string): Promise<SendResult> {
  const cfg = (await integrationConfig(tenantId, 'whatsapp')) || (config.WHATSAPP_TOKEN ? { token: config.WHATSAPP_TOKEN, phone_id: config.WHATSAPP_PHONE_ID } : null);
  if (!cfg?.token || !cfg?.phone_id) return { status: 'queued', note: 'WhatsApp is not connected. Configure it in Settings → Integrations.' };
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${cfg.phone_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: waId(to), type: 'text', text: { preview_url: false, body: text.slice(0, 4000) } }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'failed', note: data?.error?.message || `WhatsApp API ${r.status}` };
    return { status: 'sent', externalId: data?.messages?.[0]?.id };
  } catch (err: any) {
    logger.error({ err }, 'whatsapp send failed');
    return { status: 'failed', note: err?.message };
  }
}

export async function sendEmail(tenantId: string, to: string, subject: string, html: string): Promise<SendResult> {
  const cfg = (await integrationConfig(tenantId, 'email')) || (config.RESEND_API_KEY ? { api_key: config.RESEND_API_KEY, from: config.EMAIL_FROM } : null);
  if (!cfg?.api_key) return { status: 'queued', note: 'Email is not connected. Configure it in Settings → Integrations.' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from || config.EMAIL_FROM, to: [to], subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'failed', note: data?.message || `Email API ${r.status}` };
    return { status: 'sent', externalId: data?.id };
  } catch (err: any) {
    logger.error({ err }, 'email send failed');
    return { status: 'failed', note: err?.message };
  }
}

export async function sendOnChannel(tenantId: string, channel: string, to: string | null, body: string, subject?: string): Promise<SendResult> {
  if (channel === 'portal') return { status: 'sent' };
  if (!to) return { status: 'failed', note: 'No recipient address on this thread' };
  if (channel === 'whatsapp') return sendWhatsApp(tenantId, to, body);
  if (channel === 'email') return sendEmail(tenantId, to, subject || 'Update from your freight forwarder', `<p>${body.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string).replace(/\n/g, '<br>')}</p>`);
  return { status: 'queued', note: 'Phone threads are log-only' };
}
