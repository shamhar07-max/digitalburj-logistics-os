import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCan } from '../store/session';
import { fdt, label } from '../lib/format';
import { Badge, Banner, Card, DataTable, Empty, PageHead, toast } from '../ui/kit';
import { Field, useRefOptions } from '../ui/forms';

const KINDS = [['BL', 'Bill of lading'], ['AWB', 'Air waybill'], ['INVOICE', 'Commercial invoice'], ['PACKING', 'Packing list'], ['CUSTOMS', 'Customs declaration']];

export default function DocIntel() {
  const can = useCan();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('BL');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [ship, setShip] = useState('');
  const shipOpts = useRefOptions({ resource: 'shipments', label: 'number' });
  const hist = useQuery({ queryKey: ['res', 'docintel-history'], queryFn: () => api.get('/docintel/history') });
  const extract = useMutation({
    mutationFn: async () => { const f = new FormData(); f.append('doc_type', kind); if (file) f.append('file', file); if (text.trim()) f.append('text', text); return api.upload('/docintel/extract', f); },
    onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ['res', 'docintel-history'] }); },
  });
  const apply = useMutation({ mutationFn: () => api.post(`/docintel/${res.id}/apply`, { shipment_id: ship }), onSuccess: (r: any) => { toast.success(r.applied.length ? `Updated: ${r.applied.join(', ')}` : 'Nothing to update — fields already filled'); qc.invalidateQueries({ queryKey: ['shipment'] }); } });
  const fields = res ? Object.entries(res.fields) : [];
  return (
    <>
      <PageHead title="AI document intelligence" sub="Drop a B/L, AWB, invoice or packing list. Structured fields are extracted, validated (ISO 6346 container check digits) and can be pushed straight into a shipment." />
      <div className="grid g2">
        <Card title="Upload">
          <div className="field"><label>Document type</label><div className="chips">{KINDS.map(([k, l]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}</div></div>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            style={{ border: `2px dashed ${drag ? 'var(--signal)' : 'var(--line-2)'}`, borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', background: drag ? 'var(--signal-tint)' : 'var(--paper)' }} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
            <FileUp size={30} style={{ opacity: 0.5 }} /><p><b>{file ? file.name : 'Drop a PDF / image here or click to browse'}</b></p><p className="muted">PDF, PNG, JPG or text · max 15 MB</p>
            <input ref={fileRef} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="pt">…or paste the document text</label><textarea id="pt" className="textarea" style={{ minHeight: 110 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'B/L No: MEDU9912345\nShipper: …\nContainer: CSQU3054383'} /></div>
          <button className="btn primary" disabled={!can('docintel', 'c') || extract.isPending || (!file && !text.trim())} onClick={() => extract.mutate()}><Wand2 /> {extract.isPending ? 'Extracting…' : 'Extract fields'}</button>
        </Card>
        <Card title="Extraction result">
          {!res ? <Empty title="No document yet" text="Results appear here with a confidence score." /> : (<>
            <div className="actions" style={{ marginBottom: 10 }}><Badge tone={res.engine === 'claude' ? 'violet' : 'info'}>engine: {res.engine}</Badge><Badge tone={res.confidence >= 0.7 ? 'ok' : res.confidence >= 0.4 ? 'warn' : 'bad'}>{Math.round(res.confidence * 100)}% of expected fields found</Badge></div>
            {res.warnings?.map((w: string) => <Banner key={w} kind="warn">{w}</Banner>)}
            {!fields.length ? <Empty title="Nothing extracted" text="Try pasting the text, or set ANTHROPIC_API_KEY to read scanned documents." /> : (
              <div className="table-wrap"><table className="t" style={{ minWidth: 0 }}><tbody>{fields.map(([k, v]) => <tr key={k}><td className="muted" style={{ width: '38%' }}>{label(k)}</td><td><b>{Array.isArray(v) ? (v as any[]).join(', ') : String(v)}</b></td></tr>)}</tbody></table></div>
            )}
            {fields.length > 0 && can('shipments', 'u') && (
              <div style={{ marginTop: 14 }}><Field spec={{ name: 's', label: 'Apply to shipment', type: 'select', options: shipOpts.options }} value={ship} onChange={(v) => setShip(v || '')} />
                <button className="btn dark" disabled={!ship || apply.isPending} onClick={() => apply.mutate()}>Fill empty shipment fields</button><p className="hint">Only empty fields are filled — existing data is never overwritten.</p></div>
            )}
          </>)}
        </Card>
      </div>
      <Card title="Recent extractions" className="mt" pad={false}><DataTable rows={hist.data?.data || []} empty={<Empty title="No history" />} columns={[{ key: 'created_at', label: 'When', render: (r) => fdt(r.created_at) }, { key: 'doc_type', label: 'Type', render: (r) => <Badge>{r.doc_type}</Badge> }, { key: 'filename', label: 'File' }, { key: 'engine', label: 'Engine' }, { key: 'confidence', label: 'Confidence', num: true, render: (r) => `${Math.round(r.confidence * 100)}%` }]} /></Card>
    </>
  );
}
