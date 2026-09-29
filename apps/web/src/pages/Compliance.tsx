import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { label } from '../lib/format';
import { Badge, Banner, Card, DataTable, Empty, Kpi, PageHead, Skeleton, StatusBadge } from '../ui/kit';

interface Row { id: string; number: string; customer: string | null; mode: string; status: string; direction: 'import' | 'export'; pct: number; present: string[]; missing: string[] }

/** What is missing from each open shipment file, by mode and direction. */
export default function Compliance() {
  const q = useQuery({ queryKey: ['doc-scorecard'], queryFn: () => api.get<{ score: number; complete: number; total: number; shipments: Row[] }>('/insight/document-scorecard') });
  const [onlyGaps, setOnlyGaps] = useState(true);
  const d = q.data;
  const rows = d ? d.shipments.filter((s) => !onlyGaps || s.pct < 100) : [];
  return (
    <>
      <PageHead title="Document compliance" sub="Required documents per open shipment, checked against what is actually on file." actions={<label className="check"><input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Only files with gaps</label>} />
      {q.isLoading ? <Skeleton rows={6} /> : !d ? <Empty title="Scorecard unavailable" /> : (
        <>
          <div className="kpis">
            <Kpi icon={<ShieldCheck />} label="File completeness" value={`${d.score}%`} sub="average across open files" tone={d.score >= 80 ? 'up' : 'down'} />
            <Kpi label="Complete files" value={`${d.complete}/${d.total}`} />
            <Kpi label="Files with gaps" value={d.total - d.complete} tone={d.total - d.complete ? 'down' : 'up'} />
          </div>
          <Banner>Direction is inferred: a UAE origin is treated as an export, anything else as an import. Documents count once uploaded or generated for the shipment; a customs declaration counts once one exists.</Banner>
          <Card pad={false}>
            <DataTable rowKey="id" rows={rows} empty={<Empty title="No gaps" text="Every open file has its required documents." />} columns={[
              { key: 'number', label: 'Shipment', render: (r: Row) => <Link to={`/shipments/${r.id}`} className="mono"><b>{r.number}</b></Link> },
              { key: 'customer', label: 'Customer', render: (r: Row) => r.customer || '—' },
              { key: 'mode', label: 'Mode', render: (r: Row) => <span>{label(r.mode)} <Badge>{r.direction}</Badge></span> },
              { key: 'status', label: 'Status', render: (r: Row) => <StatusBadge value={r.status} /> },
              { key: 'pct', label: 'Complete', num: true, render: (r: Row) => <b className="mono">{r.pct}%</b> },
              { key: 'missing', label: 'Missing', render: (r: Row) => (r.missing.length ? r.missing.map((m) => <Badge key={m} tone="warn">{m}</Badge>) : <Badge tone="ok">complete</Badge>) },
            ]} />
          </Card>
        </>
      )}
    </>
  );
}
