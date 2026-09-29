import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ClipboardList, Fuel, LogOut, MapPin, Navigation, PenLine, RefreshCw, User, WifiOff } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSession } from '../store/session';
import { fdt, label } from '../lib/format';
import { Banner, StatusBadge, toast } from '../ui/kit';

/** Mobile-first driver app: trips, POD (signature + photos + GPS), expenses. Works offline: actions queue locally and sync when back online. */
type Op = { id: string; type: 'pod' | 'expense' | 'arrive'; stop_id?: string; payload: any; at: number };
const KEY = 'db-driver-queue';
const readQ = (): Op[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const writeQ = (q: Op[]) => localStorage.setItem(KEY, JSON.stringify(q));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  return on;
}

async function shrink(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0a2a2b';
  }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <div>
      <canvas ref={ref} className="sig" aria-label="Signature pad"
        onPointerDown={(e) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); }}
        onPointerUp={() => { drawing.current = false; onChange(ref.current!.toDataURL('image/png')); }} />
      <button type="button" className="btn sm outline" style={{ marginTop: 6 }} onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); onChange(null); }}>Clear signature</button>
    </div>
  );
}

function PodSheet({ stop, onDone, onClose }: { stop: any; onDone: (op: Op) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [failed, setFailed] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErr, setGpsErr] = useState('');
  useEffect(() => { navigator.geolocation?.getCurrentPosition((p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }), (e) => setGpsErr(e.message), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }); }, []);
  const valid = failed ? notes.trim().length > 3 : name.trim().length > 1 && (!!sig || photos.length > 0);
  return (
    <div className="modal-bg" style={{ padding: 0, alignItems: 'flex-end' }}>
      <div className="modal" style={{ borderRadius: '18px 18px 0 0', maxWidth: 460, maxHeight: '96vh' }}>
        <div className="modal-h"><div><h2>{failed ? 'Delivery not completed' : 'Proof of delivery'}</h2><p className="muted">{stop.shipment_number} · {stop.address}</p></div><button className="btn sm outline" onClick={onClose}>Close</button></div>
        <div className="modal-b">
          <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} /> Could not deliver</label>
          {!failed && (<>
            <div className="field"><label htmlFor="rn">Receiver name</label><input id="rn" className="input" style={{ height: 48, fontSize: 16 }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
            <div className="field"><label>Signature</label><SignaturePad onChange={setSig} /></div>
            <div className="field"><label>Photos of the delivered cargo</label>
              <label className="btn outline" style={{ height: 48 }}><Camera /> Take / add photo<input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const d = await shrink(f); setPhotos((p) => (p.length < 6 ? [...p, d] : p)); }} /></label>
              <div className="thumbs">{photos.map((p, i) => <img key={i} src={p} alt={`Photo ${i + 1}`} />)}</div></div>
          </>)}
          <div className="field"><label htmlFor="pn">{failed ? 'What happened? (required)' : 'Notes (optional)'}</label><textarea id="pn" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <p className="hint">{gps ? `GPS captured (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})` : gpsErr ? `GPS unavailable: ${gpsErr}` : 'Getting GPS location…'}</p>
        </div>
        <div className="modal-f"><button className={`btn xl ${failed ? 'outline' : 'ok'}`} disabled={!valid} onClick={() => onDone({ id: uid(), type: 'pod', stop_id: stop.id, at: Date.now(), payload: { client_id: uid(), signed_by: failed ? 'n/a' : name, signature: sig || undefined, photos: photos.length ? photos : undefined, lat: gps?.lat, lng: gps?.lng, captured_at: new Date().toISOString(), notes: notes || undefined, failed: failed || undefined } })}>{failed ? 'Report failed attempt' : 'Confirm delivery'}</button></div>
      </div>
    </div>
  );
}

export default function DriverApp() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const s = useSession();
  const online = useOnline();
  const [tab, setTab] = useState<'trips' | 'expenses' | 'profile'>('trips');
  const [queue, setQueue] = useState<Op[]>(readQ);
  const [pod, setPod] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [exp, setExp] = useState({ category: 'fuel', amount: '', note: '' });
  const me = useQuery({ queryKey: ['driver', 'me'], queryFn: () => api.get('/driver/me'), retry: false });
  const trips = useQuery({ queryKey: ['driver', 'trips'], queryFn: () => api.get('/driver/trips'), refetchInterval: online ? 60_000 : false, retry: false });
  const expenses = useQuery({ queryKey: ['driver', 'exp'], queryFn: () => api.get('/driver/expenses'), enabled: tab === 'expenses', retry: false });

  const persist = (q: Op[]) => { setQueue(q); writeQ(q); };
  const sync = useCallback(async () => {
    const q = readQ();
    if (!q.length || syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      const r = await api.post('/driver/sync', { ops: q.map((o) => ({ type: o.type, stop_id: o.stop_id, payload: o.payload })) });
      const keep = q.filter((_o, i) => !r.results[i]?.ok && !r.results[i]?.permanent);
      const dropped = q.length - keep.length;
      persist(keep);
      if (dropped) toast.success(`${dropped} item(s) synced`);
      qc.invalidateQueries({ queryKey: ['driver'] });
    } catch (e) { if (!(e instanceof ApiError && e.status === 0)) toast.error((e as Error).message); } finally { setSyncing(false); }
  }, [syncing, qc]);
  useEffect(() => { if (online) sync(); }, [online]);

  /** Try online first; on network failure queue the op for later (idempotent via client_id). */
  const submit = async (op: Op) => {
    try {
      if (!navigator.onLine) throw new ApiError(0, 'offline');
      if (op.type === 'pod') await api.post(`/driver/stops/${op.stop_id}/pod`, op.payload);
      else if (op.type === 'expense') await api.post('/driver/expenses', op.payload);
      else await api.post(`/driver/stops/${op.stop_id}/arrive`);
      toast.success(op.type === 'pod' ? 'Delivery confirmed' : 'Saved');
      qc.invalidateQueries({ queryKey: ['driver'] });
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) { toast.error(e.message); return false; }
      persist([...readQ(), op]);
      toast.warning('You are offline — saved on this phone and will sync automatically');
    }
    return true;
  };
  const start = async (id: string) => { try { await api.post(`/driver/trips/${id}/start`); qc.invalidateQueries({ queryKey: ['driver'] }); } catch (e: any) { toast.error(e.message); } };
  const list: any[] = trips.data?.data || [];
  const stopsToday = list.flatMap((t) => t.stops);
  const done = stopsToday.filter((x) => x.status === 'done').length;
  const pending = (id: string) => queue.some((o) => o.stop_id === id);

  return (
    <div className="phone">
      <div className="phone-h">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ opacity: 0.7, fontSize: 12 }}>DigitalBurj Driver</div><h1 style={{ fontFamily: 'var(--font)', fontSize: 22 }}>Hello, {s.user?.name?.split(' ')[0]}</h1></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{!online && <WifiOff size={20} aria-label="Offline" />}{queue.length > 0 && <button className="badge b-signal" onClick={sync} aria-label="Sync now"><RefreshCw size={12} className={syncing ? 'spin' : ''} /> {queue.length} pending</button>}</div>
        </div>
        <p style={{ opacity: 0.8, marginTop: 4 }}>{list.length} trip(s) · {done}/{stopsToday.length} stops done</p>
      </div>
      <div className="phone-b">
        {!online && <Banner kind="warn">Offline mode — everything you do is saved on this phone and syncs when you reconnect.</Banner>}
        {tab === 'trips' && (
          trips.error ? <Banner kind="bad">{(trips.error as Error).message}</Banner> : !list.length ? <div className="empty"><ClipboardList /><h3>No trips assigned</h3><p>Pull to refresh or ask dispatch.</p></div> : list.map((t) => (
            <div key={t.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}><b className="mono">{t.number}</b><StatusBadge value={t.status} /></div>
              {t.status === 'assigned' && <button className="btn primary xl" style={{ marginBottom: 10 }} onClick={() => start(t.id)}>Start trip</button>}
              {t.stops.map((st: any) => (
                <div className="stop" key={st.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{st.seq}. {label(st.kind)}</b><StatusBadge value={pending(st.id) ? 'pending' : st.status} /></div>
                  <div style={{ margin: '6px 0' }}>{st.customer_name && <b>{st.customer_name}<br /></b>}{st.address}<br /><span className="muted">{st.shipment_number} {st.cargo_description ? `· ${st.cargo_description}` : ''}{st.pieces ? ` · ${st.pieces} pcs` : ''}</span></div>
                  {st.contact_phone && <a href={`tel:${st.contact_phone}`} className="muted">{st.contact_name || 'Contact'}: {st.contact_phone}</a>}
                  {st.completed_at && <div className="muted" style={{ fontSize: 12 }}>Done {fdt(st.completed_at)}</div>}
                  {t.status === 'in_progress' && !['done', 'failed'].includes(st.status) && !pending(st.id) && (
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <a className="btn outline" style={{ height: 44 }} href={st.lat ? `https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.address || '')}`} target="_blank" rel="noopener noreferrer"><Navigation /> Navigate</a>
                      {st.status === 'pending' && <button className="btn outline" style={{ height: 44 }} onClick={() => submit({ id: uid(), type: 'arrive', stop_id: st.id, payload: {}, at: Date.now() })}><MapPin /> I have arrived</button>}
                      <button className="btn ok xl" onClick={() => setPod(st)}><PenLine /> Capture POD</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        {tab === 'expenses' && (
          <div>
            <div className="stop">
              <h3 style={{ fontFamily: 'var(--font)', marginBottom: 10 }}>Log an expense</h3>
              <div className="field"><label htmlFor="ec">Category</label><select id="ec" className="select" style={{ height: 48 }} value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>{['fuel', 'toll', 'parking', 'fine', 'repair', 'other'].map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></div>
              <div className="field"><label htmlFor="ea">Amount (AED)</label><input id="ea" className="input" style={{ height: 48, fontSize: 18 }} inputMode="decimal" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} /></div>
              <div className="field"><label htmlFor="en">Note</label><input id="en" className="input" style={{ height: 48 }} value={exp.note} onChange={(e) => setExp({ ...exp, note: e.target.value })} /></div>
              <button className="btn primary xl" disabled={!(Number(exp.amount) > 0)} onClick={async () => { if (await submit({ id: uid(), type: 'expense', at: Date.now(), payload: { client_id: uid(), category: exp.category, amount: Number(exp.amount), note: exp.note || undefined, trip_id: list.find((t) => t.status === 'in_progress')?.id } })) setExp({ category: 'fuel', amount: '', note: '' }); }}>Save expense</button>
              <p className="hint">Larger amounts and fines need office approval.</p>
            </div>
            {(expenses.data?.data || []).map((x: any) => <div key={x.id} className="stop" style={{ display: 'flex', justifyContent: 'space-between' }}><span><b>{label(x.category)}</b> · {x.note}<br /><span className="muted">{fdt(x.created_at)}</span></span><span style={{ textAlign: 'end' }}><b className="mono">{Number(x.amount).toFixed(2)}</b><br /><StatusBadge value={x.status} /></span></div>)}
          </div>
        )}
        {tab === 'profile' && (
          <div className="stop">
            <h3 style={{ fontFamily: 'var(--font)' }}>{me.data?.driver?.name || s.user?.name}</h3>
            <p className="muted">{s.user?.email}</p>
            <p style={{ marginTop: 8 }}>Licence <b className="mono">{me.data?.driver?.license_no || '—'}</b> · expires {me.data?.driver?.license_expiry || '—'}</p>
            <p>Today: {me.data?.stats?.done ?? 0}/{me.data?.stats?.today ?? 0} trips completed</p>
            <button className="btn outline xl" style={{ marginTop: 14 }} onClick={async () => { s.logout(); qc.clear(); nav('/login'); }}><LogOut /> Sign out</button>
            {queue.length > 0 && <p className="hint" style={{ marginTop: 8 }}>{queue.length} item(s) still waiting to sync — stay signed in until they upload.</p>}
          </div>
        )}
      </div>
      <nav className="phone-nav" aria-label="Driver navigation">
        <button className={tab === 'trips' ? 'on' : ''} onClick={() => setTab('trips')}><ClipboardList />Trips</button>
        <button className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}><Fuel />Expenses</button>
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}><User />Profile</button>
        <button onClick={() => { trips.refetch(); sync(); }}><RefreshCw />Refresh</button>
      </nav>
      {pod && <PodSheet stop={pod} onClose={() => setPod(null)} onDone={async (op) => { if (await submit(op)) setPod(null); }} />}
    </div>
  );
}
