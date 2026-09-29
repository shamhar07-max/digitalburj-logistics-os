import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Banner } from '../ui/kit';
import { Field } from '../ui/forms';

export default function PublicRequest() {
  const { slug } = useParams();
  const [v, setV] = useState<any>({ mode: 'sea_fcl', website: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (x: any) => setV({ ...v, [k]: x });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr({}); setMsg('');
    try { const r = await api.publicPost(`/public/request/${slug}`, v); setRef(r.reference); } catch (x) {
      const a = x as ApiError; const fe: Record<string, string> = {};
      for (const k of ['name', 'email', 'origin', 'destination']) { const m = a.field?.(k); if (m) fe[k] = m; }
      setErr(fe); if (!Object.keys(fe).length) setMsg(a.status === 404 ? 'This form link is not valid.' : a.message);
    } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}><img src="/brand/business-os.svg" width={28} height={30} alt="" /><b style={{ fontFamily: 'var(--font)', fontSize: 17 }}>Request a freight quote</b></header>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {ref ? (
          <div className="card"><div className="card-b empty"><CheckCircle2 color="var(--ok)" style={{ opacity: 1 }} /><h3>Thank you — we have your request</h3><p>Reference <b className="mono">{ref}</b>. A specialist will reply with a quote shortly.</p></div></div>
        ) : (
          <form className="card" onSubmit={submit} noValidate><div className="card-b">
            <h1 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>Tell us what you are shipping</h1><p className="muted" style={{ marginBottom: 16 }}>We usually reply within one working day.</p>
            {msg && <Banner kind="bad">{msg}</Banner>}
            <div className="row2">
              <Field spec={{ name: 'name', label: 'Your name', required: true }} value={v.name} error={err.name} onChange={set('name')} /><Field spec={{ name: 'company', label: 'Company' }} value={v.company} onChange={set('company')} />
              <Field spec={{ name: 'email', label: 'Email', type: 'email', required: true }} value={v.email} error={err.email} onChange={set('email')} /><Field spec={{ name: 'phone', label: 'Phone / WhatsApp', type: 'tel' }} value={v.phone} onChange={set('phone')} />
              <Field spec={{ name: 'origin', label: 'From (city / port)', required: true }} value={v.origin} error={err.origin} onChange={set('origin')} /><Field spec={{ name: 'destination', label: 'To (city / port)', required: true }} value={v.destination} error={err.destination} onChange={set('destination')} />
              <Field spec={{ name: 'mode', label: 'Mode', type: 'select', options: [{ value: 'sea_fcl', label: 'Sea — full container' }, { value: 'sea_lcl', label: 'Sea — LCL' }, { value: 'air', label: 'Air' }, { value: 'road', label: 'Road' }] }} value={v.mode} onChange={set('mode')} />
              <Field spec={{ name: 'cargo', label: 'Cargo' }} value={v.cargo} onChange={set('cargo')} />
              <Field spec={{ name: 'message', label: 'Anything else?', type: 'textarea', span: 2 }} value={v.message} onChange={set('message')} />
            </div>
            <input tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: '-9999px' }} value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} name="website" />
            <button className="btn primary" style={{ height: 44, width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Request quote'}</button>
          </div></form>
        )}
      </main>
    </div>
  );
}
