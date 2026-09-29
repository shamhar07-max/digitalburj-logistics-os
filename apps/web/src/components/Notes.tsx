import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StickyNote, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCan, useSession } from '../store/session';
import { ago } from '../lib/format';
import { Badge, Card, Empty, toast } from '../ui/kit';

interface Note { id: string; author_id: string; author_name: string; body: string; priority: 'normal' | 'urgent' | 'info'; created_at: string }

/** Short handover notes for the branch — who posted, how urgent, and only the author or an admin can remove one. */
export function Notes() {
  const qc = useQueryClient();
  const can = useCan();
  const user = useSession((s) => s.user);
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Note['priority']>('normal');
  const q = useQuery({ queryKey: ['notes'], queryFn: () => api.get<{ data: Note[] }>('/notes') });
  const add = useMutation({ mutationFn: () => api.post('/notes', { body, priority }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['notes'] }); } });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/notes/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }), onError: (e: any) => toast.error(e.message) });
  const isAdmin = ['owner', 'admin'].includes(user?.baseRole || '');
  return (
    <Card title="Branch notes" icon={<StickyNote />}>
      {can('dashboard', 'r') && (
        <form className="note-form" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}>
          <input className="input" value={body} maxLength={500} placeholder="Handover note, gate change, reminder…" aria-label="New note" onChange={(e) => setBody(e.target.value)} />
          <select className="select" value={priority} aria-label="Priority" onChange={(e) => setPriority(e.target.value as Note['priority'])}><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="info">Info</option></select>
          <button className="btn primary" disabled={add.isPending || !body.trim()}>Post</button>
        </form>
      )}
      {!q.data?.data.length ? <Empty title="No notes" text="Post a note so the next shift sees it." /> : q.data.data.map((n) => (
        <div className="list-item" key={n.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{n.priority !== 'normal' && <Badge tone={n.priority === 'urgent' ? 'bad' : 'info'}>{n.priority}</Badge>} {n.body}</div>
            <div className="muted" style={{ fontSize: 12 }}>{n.author_name} · {ago(n.created_at)}</div>
          </div>
          {(n.author_id === user?.id || isAdmin) && <button className="icon-btn" aria-label="Delete note" onClick={() => del.mutate(n.id)}><Trash2 /></button>}
        </div>
      ))}
    </Card>
  );
}
