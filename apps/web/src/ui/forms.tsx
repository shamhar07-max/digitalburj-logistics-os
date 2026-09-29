import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Modal, toast } from './kit';

export interface FieldSpec {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'checkbox' | 'tags' | 'email' | 'tel' | 'ref';
  required?: boolean;
  options?: { value: string; label: string }[] | string[];
  /** type 'ref': options loaded from /api/<resource> */
  ref?: { resource: string; label?: string | ((r: any) => string); params?: Record<string, any> };
  hint?: string;
  placeholder?: string;
  step?: string;
  span?: 1 | 2;
  min?: number;
  showIf?: (values: Record<string, any>) => boolean;
  readOnlyOnEdit?: boolean;
}

export function useRefOptions(ref?: FieldSpec['ref']) {
  const q = useQuery({
    queryKey: ['ref', ref?.resource, ref?.params],
    enabled: !!ref,
    staleTime: 60_000,
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '300', ...(ref!.params || {}) } as any).toString();
      const r = await api.get(`/${ref!.resource}?${p}`);
      return (r.data || r) as any[];
    },
  });
  const lab = (r: any) => (typeof ref?.label === 'function' ? ref.label(r) : r[ref?.label || 'name'] ?? r.number ?? r.title ?? r.id);
  return { options: (q.data || []).map((r) => ({ value: r.id, label: String(lab(r)) })), loading: q.isLoading };
}

function RefSelect({ spec, value, onChange, invalid, id, describedBy }: { spec: FieldSpec; value: any; onChange: (v: any) => void; invalid: boolean; id: string; describedBy?: string }) {
  const { options, loading } = useRefOptions(spec.ref);
  return (
    <select id={id} aria-describedby={describedBy} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-invalid={invalid} disabled={loading}>
      <option value="">{loading ? 'Loading…' : '— select —'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Field({ spec, value, onChange, error, editing }: { spec: FieldSpec; value: any; onChange: (v: any) => void; error?: string; editing?: boolean }) {
  const id = `f-${spec.name}`;
  const common = { id, 'aria-invalid': !!error, 'aria-describedby': error ? id + '-e' : undefined, disabled: editing && spec.readOnlyOnEdit } as any;
  let input: ReactNode;
  switch (spec.type) {
    case 'textarea':
      input = <textarea {...common} className="textarea" value={value ?? ''} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select': {
      const opts = (spec.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) } : o));
      input = (
        <select {...common} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          {!spec.required && <option value="">—</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    }
    case 'ref':
      input = <RefSelect spec={spec} value={value} onChange={onChange} invalid={!!error} id={id} describedBy={error ? id + '-e' : undefined} />;
      break;
    case 'checkbox':
      input = <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {spec.hint || spec.label}</label>;
      break;
    case 'tags':
      input = <input {...common} className="input" value={Array.isArray(value) ? value.join(', ') : value ?? ''} placeholder={spec.placeholder || 'comma, separated'} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />;
      break;
    case 'datetime':
      input = <input {...common} type="datetime-local" className="input" value={value ? String(value).slice(0, 16) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
      break;
    case 'date':
      input = <input {...common} type="date" className="input" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case 'number':
      input = <input {...common} type="number" inputMode="decimal" step={spec.step || 'any'} min={spec.min} className="input" value={value ?? ''} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
      break;
    default:
      input = <input {...common} type={spec.type || 'text'} className="input" value={value ?? ''} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className="field" style={spec.span === 2 ? { gridColumn: '1 / -1' } : undefined}>
      {spec.type !== 'checkbox' && <label htmlFor={id}>{spec.label}{spec.required && <span className="req"> *</span>}</label>}
      {input}
      {error && <div className="err" id={id + '-e'} role="alert">{error}</div>}
      {!error && spec.hint && spec.type !== 'checkbox' && <div className="hint">{spec.hint}</div>}
    </div>
  );
}

export function FormFields({ fields, values, setValues, errors, editing }: { fields: FieldSpec[]; values: Record<string, any>; setValues: (v: Record<string, any>) => void; errors: Record<string, string>; editing?: boolean }) {
  return (
    <div className="row2">
      {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => (
        <Field key={f.name} spec={f} value={values[f.name]} error={errors[f.name]} editing={editing} onChange={(v) => setValues({ ...values, [f.name]: v })} />
      ))}
    </div>
  );
}

/** Convert an ApiError into per-field messages. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.details || Array.isArray(e.details)) return {};
  return Object.fromEntries(Object.entries(e.details as Record<string, string[]>).map(([k, v]) => [k, `${k.replace(/_/g, ' ')} ${v[0]}`]));
}

export function FormModal({ title, sub, fields, initial, submitLabel = 'Save', onSubmit, onClose, size, footerExtra }: {
  title: string; sub?: string; fields: FieldSpec[]; initial?: Record<string, any>; submitLabel?: string; size?: '' | 'lg';
  onSubmit: (values: Record<string, any>) => Promise<any>; onClose: () => void; footerExtra?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(initial || {}), [initial]);
  const editing = !!initial?.id;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const local: Record<string, string> = {};
    for (const f of fields) if (f.required && (f.showIf ? f.showIf(values) : true) && (values[f.name] === undefined || values[f.name] === null || values[f.name] === '')) local[f.name] = `${f.label} is required`;
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      // only send declared fields (never echo server-computed columns back)
      const payload: Record<string, any> = {};
      for (const f of fields) if (f.name in values) payload[f.name] = values[f.name] === '' ? null : values[f.name];
      await onSubmit(payload);
      onClose();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} sub={sub} onClose={onClose} size={size} footer={<>
      {footerExtra}
      <button className="btn outline" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={busy} onClick={() => submit()}>{busy ? 'Saving…' : submitLabel}</button>
    </>}>
      <form onSubmit={submit} noValidate>
        <FormFields fields={fields} values={values} setValues={setValues} errors={errors} editing={editing} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
