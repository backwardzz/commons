// Состояние ↔ записи таблицы entities. Каждая сущность — отдельная строка (kind, id, data).
// visible_to: null — видно всем (в том числе без входа), иначе только перечисленным участникам.
import type { State } from './types';

export type Kind = 'user' | 'project' | 'task' | 'contribution' | 'thread' | 'activity' | 'announcement' | 'message' | 'invite' | 'read';

export interface Row {
  kind: Kind;
  id: string;
  project_id: string | null;
  visible_to: string[] | null;
  data: unknown;
}

export const rowKey = (r: Pick<Row, 'kind' | 'id'>) => `${r.kind}:${r.id}`;

/** Что нельзя показывать всем: почта Google в профиле. */
function publicUser(u: State['users'][number]) {
  const { google: _google, ...rest } = u;
  return rest;
}

export function toRows(s: State): Map<string, Row> {
  const out = new Map<string, Row>();
  const put = (r: Row) => out.set(rowKey(r), r);
  for (const u of s.users) put({ kind: 'user', id: u.id, project_id: null, visible_to: null, data: publicUser(u) });
  for (const p of s.projects) put({ kind: 'project', id: p.id, project_id: p.id, visible_to: null, data: p });
  for (const t of s.tasks) put({ kind: 'task', id: t.id, project_id: t.projectId, visible_to: null, data: t });
  for (const c of s.contributions) put({ kind: 'contribution', id: c.id, project_id: c.projectId, visible_to: null, data: c });
  for (const t of s.threads) put({ kind: 'thread', id: t.id, project_id: t.projectId, visible_to: null, data: t });
  for (const a of s.activity) put({ kind: 'activity', id: a.id, project_id: a.projectId, visible_to: null, data: a });
  for (const a of s.announcements) put({ kind: 'announcement', id: a.id, project_id: a.projectId, visible_to: null, data: a });
  for (const m of s.messages) {
    const dm = m.chatId.startsWith('dm:');
    put({ kind: 'message', id: m.id, project_id: dm ? null : m.chatId.replace(/^project:/, ''), visible_to: dm ? m.chatId.slice(3).split(':') : null, data: m });
  }
  for (const i of s.invites) put({ kind: 'invite', id: i.id, project_id: i.projectId, visible_to: [i.fromId, i.toId], data: i });
  for (const [key, at] of Object.entries(s.readAt)) put({ kind: 'read', id: key, project_id: null, visible_to: [key.split('|')[0]], data: { key, at } });
  return out;
}

type Shared = Pick<State, 'users' | 'projects' | 'tasks' | 'contributions' | 'threads' | 'activity' | 'announcements' | 'messages' | 'invites' | 'readAt'>;

export function fromRows(rows: Iterable<Pick<Row, 'kind' | 'data'>>): Shared {
  const s: Shared = { users: [], projects: [], tasks: [], contributions: [], threads: [], activity: [], announcements: [], messages: [], invites: [], readAt: {} };
  for (const r of rows) {
    const d = r.data as never;
    switch (r.kind) {
      case 'user': s.users.push(d); break;
      case 'project': s.projects.push(d); break;
      case 'task': s.tasks.push(d); break;
      case 'contribution': s.contributions.push(d); break;
      case 'thread': s.threads.push(d); break;
      case 'activity': s.activity.push(d); break;
      case 'announcement': s.announcements.push(d); break;
      case 'message': s.messages.push(d); break;
      case 'invite': s.invites.push(d); break;
      case 'read': { const x = d as { key: string; at: number }; s.readAt[x.key] = x.at; break; }
    }
  }
  // порядок, к которому привыкли страницы
  s.activity.sort((a, b) => b.at - a.at);
  s.messages.sort((a, b) => a.createdAt - b.createdAt);
  s.projects.sort((a, b) => b.createdAt - a.createdAt);
  s.contributions.sort((a, b) => b.createdAt - a.createdAt);
  s.threads.sort((a, b) => b.createdAt - a.createdAt);
  s.invites.sort((a, b) => b.createdAt - a.createdAt);
  s.tasks.sort((a, b) => a.createdAt - b.createdAt || a.number - b.number);
  return s;
}

/** Что записать и что удалить, чтобы из «до» получилось «после». */
export function diffRows(before: Map<string, Row>, after: Map<string, Row>): { upserts: Row[]; deletes: Pick<Row, 'kind' | 'id'>[] } {
  const upserts: Row[] = [];
  const deletes: Pick<Row, 'kind' | 'id'>[] = [];
  for (const [k, r] of after) {
    const old = before.get(k);
    if (!old || JSON.stringify(old) !== JSON.stringify(r)) upserts.push(r);
  }
  for (const [k, r] of before) if (!after.has(k)) deletes.push({ kind: r.kind, id: r.id });
  return { upserts, deletes };
}

/** Все id, уже занятые в состоянии, — новые id из браузера не должны с ними совпадать. */
export function takenIds(s: State): Set<string> {
  const ids = new Set<string>();
  for (const k of ['users', 'projects', 'tasks', 'contributions', 'threads', 'activity', 'announcements', 'messages', 'invites'] as const) for (const x of s[k]) ids.add(x.id);
  for (const p of s.projects) { for (const d of p.docs) ids.add(d.id); for (const m of p.milestones) ids.add(m.id); for (const r of p.releases) ids.add(r.id); }
  for (const t of s.tasks) for (const c of t.comments) ids.add(c.id);
  for (const t of s.threads) for (const c of t.comments) ids.add(c.id);
  for (const c of s.contributions) for (const r of c.reviews) ids.add(r.id);
  for (const u of s.users) for (const w of u.portfolio ?? []) ids.add(w.id);
  return ids;
}
