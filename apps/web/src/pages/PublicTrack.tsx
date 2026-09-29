import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, PackageSearch } from 'lucide-react';
import { api } from '../lib/api';
import { fdate, fdt, label } from '../lib/format';
import { Badge, Skeleton } from '../ui/kit';
import { tone } from '../lib/format';

export default function PublicTrack() {
  const { token } = useParams();
  const q = useQuery({ queryKey: ['track', token], queryFn: () => api.publicGet(`/public/track/${token}`), retry: false, refetchInterval: 120_000 });
  const s = q.data?.shipment;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header style={{ background: 'var(--ink)', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/brand/business-os.svg" width={28} height={30} alt="" /><b style={{ fontFamily: 'var(--font)', fontSize: 17 }}>{s?.company || 'Shipment tracking'}</b>
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        {q.isLoading ? <Skeleton /> : q.error ? (
          <div className="empty"><PackageSearch /><h3>Tracking link not found</h3><p>Check the link, or contact your freight forwarder.</p></div>
        ) : (
          <>
            <h1 className="page-title mono">{s.number}</h1>
            <p className="page-sub">{s.origin} → {s.destination} · {label(s.mode)}</p>
            <div className="actions" style={{ margin: '12px 0 18px' }}><Badge tone={tone(s.status)}>{label(s.status)}</Badge>{s.container_no && <span className="mono">{s.container_no}</span>}{s.vessel && <span className="muted">{s.vessel} {s.voyage}</span>}</div>
            <div className="card"><div className="card-b">
              <div className="timeline">{q.data.milestones.map((m: any) => (
                <div key={m.name} className={`tl ${m.status === 'done' ? 'done' : ''}`}>
                  <div className="tl-t" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{m.status === 'done' ? <CheckCircle2 size={15} color="var(--ok)" /> : <Circle size={15} color="var(--text-3)" />}{m.name}</div>
                  <div className="tl-s">{m.done_at ? `Completed ${fdt(m.done_at)}` : `Expected ${fdate(m.due_at)}`}</div>
                </div>))}</div>
            </div></div>
            <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>ETA {fdate(s.eta)}{s.delivered_at ? ` · delivered ${fdt(s.delivered_at)}` : ''}. Schedules are estimates and may change with carrier and customs.</p>
          </>
        )}
      </main>
    </div>
  );
}
