import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useSession } from '../store/session';
import { homeFor } from '../nav';
import { Banner, toast } from '../ui/kit';

const DEMO = [
  ['Owner', 'owner@alnoor.ae'], ['Sales', 'sales@alnoor.ae'], ['Operations', 'ops@alnoor.ae'], ['Customs', 'customs@alnoor.ae'], ['Dispatch', 'dispatch@alnoor.ae'],
  ['Finance', 'finance@alnoor.ae'], ['Warehouse', 'warehouse@alnoor.ae'], ['HR', 'hr@alnoor.ae'], ['Driver', 'driver@alnoor.ae'], ['Customer portal', 'portal@noon-demo.ae'],
];

export default function Login({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const s = useSession();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '', name: '', companyName: '', trn: '' });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (s.accessToken && s.user && mode !== 'reset') return <Navigate to={homeFor(s.user.baseRole || s.user.role)} replace />;

  const done = (d: any) => {
    s.setTokens(d.accessToken, d.refreshToken);
    s.set({ user: d.user });
    nav(homeFor(d.user.role === 'driver' ? 'driver' : d.user.role === 'customer' ? 'customer' : ''), { replace: true });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') done(await api.publicPost('/auth/login', { email: f.email, password: f.password }));
      else if (mode === 'register') done(await api.publicPost('/auth/register', { companyName: f.companyName, name: f.name, email: f.email, password: f.password, trn: f.trn || undefined }));
      else if (mode === 'forgot') { await api.publicPost('/auth/forgot', { email: f.email }); setInfo('If that email is registered, a reset link is on its way.'); }
      else { await api.publicPost('/auth/reset', { token: sp.get('token'), password: f.password }); toast.success('Password updated — sign in'); nav('/login'); }
    } catch (e2) {
      const ae = e2 as ApiError;
      setErr(ae.field?.('password') || ae.field?.('email') || ae.field?.('companyName') || ae.field?.('trn') || ae.message);
    } finally { setBusy(false); }
  };

  const titles = { login: 'Sign in', register: 'Create your company', forgot: 'Reset your password', reset: 'Choose a new password' };
  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/brand/business-os.svg" alt="" width={38} height={40} />
          <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 18 }}>DigitalBurj <span style={{ color: 'var(--signal)' }}>Logistics OS</span></div>
        </div>
        <div>
          <h1>Quote to cash, without the re-typing.</h1>
          <p>One system for UAE freight forwarders: quotes become jobs, jobs become invoices, proof of delivery releases billing — with customs, VAT, WPS and WhatsApp built in.</p>
          <div className="flow" aria-label="Core flow"><span>Quote</span><span>Shipment</span><span>Delivery</span><span>Invoice</span><span>Cash</span></div>
        </div>
        <small style={{ color: 'rgba(255,255,255,.5)' }}>Built for 5–30 person forwarders in the UAE · AED · 5% VAT · Arabic RTL</small>
      </section>
      <section className="auth-panel">
        <form className="auth-box" onSubmit={submit} noValidate>
          <h2>{titles[mode]}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Set up a workspace with a UAE chart of accounts, roles and starter automations.' : ''}</p>
          {err && <Banner kind="bad">{err}</Banner>}
          {info && <Banner>{info}</Banner>}
          {mode === 'register' && (<>
            <div className="field"><label htmlFor="c">Company name</label><input id="c" className="input" value={f.companyName} onChange={set('companyName')} required autoComplete="organization" /></div>
            <div className="field"><label htmlFor="n">Your name</label><input id="n" className="input" value={f.name} onChange={set('name')} required autoComplete="name" /></div>
            <div className="field"><label htmlFor="t">TRN (optional)</label><input id="t" className="input mono" value={f.trn} onChange={set('trn')} inputMode="numeric" placeholder="15 digits" /></div>
          </>)}
          {mode !== 'reset' && <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" className="input" value={f.email} onChange={set('email')} required autoComplete="username" autoFocus /></div>}
          {mode !== 'forgot' && <div className="field"><label htmlFor="p">{mode === 'reset' ? 'New password' : 'Password'}</label><input id="p" type="password" className="input" value={f.password} onChange={set('password')} required minLength={mode === 'login' ? 1 : 10} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode !== 'login' && <div className="hint">At least 10 characters.</div>}</div>}
          <button className="btn primary xl" style={{ height: 44, width: '100%' }} disabled={busy}>{busy ? 'Please wait…' : titles[mode]}</button>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            {mode === 'login' ? <><Link to="/forgot">Forgot password?</Link><Link to="/register">Create a company</Link></> : <Link to="/login">Back to sign in</Link>}
          </div>
          {mode === 'login' && import.meta.env.DEV && (
            <div style={{ marginTop: 22 }}>
              <div className="muted" style={{ fontSize: 12 }}>Demo data (dev only) — password <code className="mono">Demo@12345!</code></div>
              <div className="demo-users">{DEMO.map(([l, em]) => <button type="button" key={em} className="chip" onClick={() => setF({ ...f, email: em, password: 'Demo@12345!' })}>{l}</button>)}</div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
