import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle } from 'lucide-react';
import { api } from '../lib/api';
import { aed } from '../lib/format';
import { Drawer, Empty, Skeleton } from '../ui/kit';

interface Explained { metric: string; label: string; value: number; unit: 'count' | 'AED' | '%'; formula: string; records: { id: string; ref: string; title: string; detail?: string; amount?: number; link?: string }[] }
const show = (e: Explained) => (e.unit === 'AED' ? aed(e.value) : e.unit === '%' ? `${e.value}%` : String(e.value));

/** Opens a drawer listing the records that make up a dashboard number, with the formula used. */
export function ExplainButton({ metric }: { metric: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn kpi-x" aria-label="Explain this number" title="Explain this number" onClick={() => setOpen(true)}><HelpCircle size={15} /></button>
      {open && <ExplainDrawer metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExplainDrawer({ metric, onClose }: { metric: string; onClose: () => void }) {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['explain', metric], queryFn: () => api.get<Explained>(`/insight/explain/${metric}`) });
  const d = q.data;
  return (
    <Drawer title={d ? `${d.label}: ${show(d)}` : 'Explain this number'} onClose={onClose}>
      {q.isLoading ? <Skeleton rows={5} /> : q.error || !d ? <Empty title="Not available" text="You may not have access to the records behind this number." /> : (
        <>
          <p className="hint" style={{ marginBottom: 12 }}><b>How it is calculated:</b> {d.formula}</p>
          {d.records.length === 0 ? <Empty title="No records" text="Nothing currently contributes to this number." /> : d.records.map((r) => (
            <div key={r.id} className="list-item" style={{ cursor: r.link ? 'pointer' : undefined }} onClick={() => { if (r.link) { onClose(); nav(r.link); } }}>
              <b className="mono" style={{ minWidth: 92 }}>{r.ref}</b>
              <div style={{ flex: 1, minWidth: 0 }}><b>{r.title}</b>{r.detail && <div className="muted" style={{ fontSize: 12.5 }}>{r.detail}</div>}</div>
              {r.amount !== undefined && <b className="mono">{aed(r.amount, { noSymbol: true })}</b>}
            </div>
          ))}
          {d.records.length >= 200 && <p className="muted" style={{ fontSize: 12 }}>Showing the first 200 records.</p>}
        </>
      )}
    </Drawer>
  );
}
