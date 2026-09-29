import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useCan, useSession } from '../store/session';
import { fdate } from '../lib/format';
import { Banner, Card, DataTable, PageHead, StatusBadge, toast } from '../ui/kit';
import { FormModal } from '../ui/forms';

export default function PortalAdmin() {
  const can = useCan();
  const slug = useSession((s) => s.tenant?.slug);
  const [invite, setInvite] = useState(false);
  const ships = useQuery({ queryKey: ['res', 'portal-ships'], queryFn: () => api.get('/shipments?pageSize=50') });
  const rows = (ships.data?.data || []).filter((s: any) => !['closed', 'cancelled'].includes(s.status));
  const reqUrl = `${location.origin}/request/${slug}`;
  return (
    <>
      <PageHead title="Customer portal" sub="Give customers self-service: live tracking, quote acceptance, invoices, documents and chat — so they stop phoning for updates." actions={can('customers', 'u') && <button className="btn primary" onClick={() => setInvite(true)}><UserPlus /> Invite a customer</button>} />
      <div className="grid g2">
        <Card title="What customers see">
          <ul style={{ paddingInlineStart: 18, display: 'grid', gap: 7 }}>
            <li><b>Home</b> — active shipments with progress, quotes waiting for acceptance, unpaid invoices.</li>
            <li><b>Shipments</b> — milestone timeline and public documents (B/L, POD) that you mark “Portal”.</li>
            <li><b>Quotes</b> — accept in one click; accepting creates the job automatically.</li>
            <li><b>Invoices</b> — download tax invoices and see balances. Buy rates, costs and margins are never exposed.</li>
          </ul>
          <Banner>Portal users are scoped to their own customer record by the server on every request — not just hidden in the UI.</Banner>
        </Card>
        <Card title="Public freight-request form">
          <p className="muted">Share this link on your website or WhatsApp status. Requests become leads in the pipeline with the source “website”.</p>
          <div className="field" style={{ marginTop: 10 }}><input className="input mono" readOnly value={reqUrl} onFocus={(e) => e.target.select()} aria-label="Request form URL" /></div>
          <div className="actions"><button className="btn outline" onClick={() => { navigator.clipboard?.writeText(reqUrl); toast.success('Copied'); }}><Copy /> Copy link</button><a className="btn outline" href={reqUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Preview</a></div>
        </Card>
      </div>
      <Card title="Public tracking links" className="mt" pad={false}>
        <DataTable loading={ships.isLoading} rows={rows} columns={[{ key: 'number', label: 'Job', render: (r) => <b className="mono">{r.number}</b> }, { key: 'customer_name', label: 'Customer' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }, { key: 'eta', label: 'ETA', render: (r) => fdate(r.eta) },
          { key: '_', label: '', sortable: false, render: (r) => <button className="btn xs outline" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/track/${r.tracking_token}`); toast.success('Tracking link copied'); }}><Copy /> Copy link</button> }]} />
      </Card>
      {invite && <FormModal title="Invite to customer portal" submitLabel="Send invite" fields={[{ name: 'customer_id', label: 'Customer', type: 'ref', required: true, ref: { resource: 'customers' } }, { name: 'name', label: 'Contact name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }]}
        onSubmit={async (v) => { const r = await api.post('/portal/invite', v); toast.success(r.invite?.sent ? 'Invitation emailed' : 'Invitation queued — email is not configured'); if (r.invite?.link) toast.info('Dev link: ' + r.invite.link); }} onClose={() => setInvite(false)} />}
    </>
  );
}
