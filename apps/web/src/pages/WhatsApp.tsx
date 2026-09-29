import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { Banner, Card, PageHead, Badge } from '../ui/kit';

export default function WhatsApp() {
  const nav = useNavigate();
  const integ = useQuery({ queryKey: ['res', 'integrations'], queryFn: () => api.get('/admin/integrations'), retry: false });
  const wa = integ.data?.data?.find((i: any) => i.provider === 'whatsapp');
  const url = `${location.origin}/api/webhooks/whatsapp`;
  return (
    <>
      <PageHead title="WhatsApp Business" sub="Official Meta Cloud API: inbound messages thread automatically to the right customer; outbound updates and quote follow-ups go from the inbox or from automations." actions={<button className="btn primary" onClick={() => nav('/inbox')}><MessageCircle /> Open inbox</button>} />
      <div className="grid g2">
        <Card title="Connection">
          <p>Status: {wa?.enabled ? <Badge tone="ok">connected</Badge> : <Badge tone="warn">not connected</Badge>}</p>
          <p className="muted" style={{ marginTop: 8 }}>Add your access token and phone number ID under <b>Settings → Integrations → WhatsApp</b>. Until then, outbound messages stay <i>queued</i> — the system never reports them as delivered.</p>
          <div className="field" style={{ marginTop: 12 }}><label>Webhook URL (paste into Meta App → WhatsApp → Configuration)</label><input className="input mono" readOnly value={url} onFocus={(e) => e.target.select()} /></div>
          <p className="hint">Verify token = <code className="mono">WHATSAPP_VERIFY_TOKEN</code>; payloads are authenticated with <code className="mono">WHATSAPP_APP_SECRET</code> (X-Hub-Signature-256).</p>
          <button className="btn outline" style={{ marginTop: 8 }} onClick={() => nav('/settings')}>Open integration settings</button>
        </Card>
        <Card title="How it works">
          <ul style={{ paddingInlineStart: 18, display: 'grid', gap: 8 }}>
            <li>Inbound numbers are matched to customer contacts (WhatsApp/phone). Unknown senders land in the inbox marked <b>needs triage</b> — never auto-linked.</li>
            <li>Starter automations message the customer when a shipment departs and when it is delivered (Automation → enable/edit).</li>
            <li>Delivery receipts (sent / delivered / read / failed) update each message.</li>
            <li>Business-initiated messages outside the 24-hour window require approved templates in Meta Business Manager.</li>
          </ul>
        </Card>
      </div>
      {integ.error && <Banner>Integration status is visible to users with Settings access.</Banner>}
    </>
  );
}
