import { useSession } from '../store/session';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, string[]> | any) {
    super(message);
  }
  /** first validation message for a field */
  field(name: string): string | undefined {
    const d = this.details;
    return d && !Array.isArray(d) && d[name]?.[0] ? `${name.replace(/_/g, ' ')} ${d[name][0]}` : undefined;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setTokens, logout } = useSession.getState();
    if (!refreshToken) return false;
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!r.ok) throw new Error('refresh failed');
      const d = await r.json();
      setTokens(d.accessToken, d.refreshToken);
      return true;
    } catch {
      logout();
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

interface Opts { body?: any; form?: FormData; blob?: boolean; noAuth?: boolean; signal?: AbortSignal }

export async function request<T = any>(method: string, path: string, opts: Opts = {}, retried = false): Promise<T> {
  const s = useSession.getState();
  const headers: Record<string, string> = {};
  if (!opts.form) headers['content-type'] = 'application/json';
  if (!opts.noAuth && s.accessToken) headers.authorization = `Bearer ${s.accessToken}`;
  if (s.entityId && s.entityId !== 'all') headers['x-entity-id'] = s.entityId;
  let res: Response;
  try {
    res = await fetch('/api' + path, { method, headers, body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)), signal: opts.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'Network error — check your connection', 'network');
  }
  if (res.status === 401 && !opts.noAuth && !retried && !path.startsWith('/auth/')) {
    if (await refresh()) return request<T>(method, path, opts, true);
  }
  if (!res.ok) {
    let data: any = null;
    try { data = await res.json(); } catch { /* not json */ }
    throw new ApiError(res.status, data?.error?.message || res.statusText || 'Request failed', data?.error?.code, data?.error?.details);
  }
  if (opts.blob) return (await res.blob()) as any;
  if (res.status === 204) return null as any;
  const ct = res.headers.get('content-type') || '';
  return (ct.includes('json') ? res.json() : res.text()) as any;
}

export const api = {
  get: <T = any>(p: string, signal?: AbortSignal) => request<T>('GET', p, { signal }),
  post: <T = any>(p: string, body: any = {}) => request<T>('POST', p, { body }),
  patch: <T = any>(p: string, body: any) => request<T>('PATCH', p, { body }),
  put: <T = any>(p: string, body: any) => request<T>('PUT', p, { body }),
  del: <T = any>(p: string) => request<T>('DELETE', p),
  upload: <T = any>(p: string, form: FormData) => request<T>('POST', p, { form }),
  blob: (p: string) => request<Blob>('GET', p, { blob: true }),
  publicGet: <T = any>(p: string) => request<T>('GET', p, { noAuth: true }),
  publicPost: <T = any>(p: string, body: any) => request<T>('POST', p, { body, noAuth: true }),
};

/** Fetch a protected file and open/download it (Authorization header can't be set on <a href>). */
export async function openFile(path: string, filename?: string) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  if (filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const qs = (o: Record<string, any> = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
};
