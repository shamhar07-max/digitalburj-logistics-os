import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../store/session';
import { toast } from '../ui/kit';

/** Live updates over WebSocket: invalidates cached queries when domain events arrive and surfaces notifications as toasts. */
export function useRealtime() {
  const token = useSession((s) => s.accessToken);
  const qc = useQueryClient();
  useEffect(() => {
    if (!token) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(useSession.getState().accessToken || token)}`);
      ws.onopen = () => (retry = 0);
      ws.onmessage = (m) => {
        try {
          const e = JSON.parse(m.data);
          if (e.type === 'hello') return;
          if (e.type === 'notification.created') {
            const p = e.payload || {};
            toast[p.level === 'error' ? 'error' : p.level === 'warning' ? 'warning' : p.level === 'success' ? 'success' : 'info'](p.title || 'New notification');
            qc.invalidateQueries({ queryKey: ['notifications'] });
          }
          clearTimeout(debounce);
          debounce = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['res'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['shipment'] });
            qc.invalidateQueries({ queryKey: ['inbox'] });
            qc.invalidateQueries({ queryKey: ['approvals'] });
            qc.invalidateQueries({ queryKey: ['dispatch'] });
          }, 400);
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        if (closed) return;
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(debounce);
      ws?.close();
    };
  }, [token, qc]);
}
