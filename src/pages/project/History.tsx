import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../../data/store';
import type { Activity, ActivityType, Project, State } from '../../data/types';
import { Avatar, UserLink, getUser } from '../../components/ui';
import { dayKey, dayTitle, gverb, timeLabel } from '../../lib/format';
import { tr } from '../../i18n';
import { activityText } from '../../lib/activity';

const FILTERS: { id: string; name: string; types: ActivityType[] }[] = [
  { id: 'all', get name() { return tr('Всё'); }, types: [] },
  { id: 'tasks', get name() { return tr('Задачи'); }, types: ['task'] },
  { id: 'contrib', get name() { return tr('Вклады и отзывы'); }, types: ['contribution', 'review'] },
  { id: 'talk', get name() { return tr('Обсуждения и решения'); }, types: ['discussion', 'decision'] },
  { id: 'docs', get name() { return tr('Документы, объявления, версии'); }, types: ['doc', 'release', 'project', 'member', 'announcement'] },
];

function refLink(s: State, p: Project, a: Activity): string | null {
  if (!a.ref) return null;
  const id = a.ref.id;
  switch (a.ref.kind) {
    case 'task': { const t = s.tasks.find((x) => x.id === id); return t ? `/p/${p.slug}/issues/${t.number}` : null; }
    case 'contribution': { const c = s.contributions.find((x) => x.id === id); return c ? `/p/${p.slug}/pulls/${c.number}` : null; }
    case 'thread': return `/p/${p.slug}/talk?thread=${id}`;
    case 'doc': return p.docs.some((d) => d.id === id) ? `/p/${p.slug}/docs/${id}` : null;
    case 'release': return `/p/${p.slug}/releases`;
    case 'announcement': return `/p/${p.slug}/news`;
    default: return null;
  }
}

export function History({ p }: { p: Project }) {
  const s = useAppState();
  const [f, setF] = useState('all');
  const [limit, setLimit] = useState(60);
  const types = FILTERS.find((x) => x.id === f)!.types;
  const all = s.activity.filter((a) => a.projectId === p.id && (!types.length || types.includes(a.type)));
  const list = all.slice(0, limit);
  const days: { key: string; title: string; items: Activity[] }[] = [];
  for (const a of list) {
    const k = dayKey(a.at);
    if (days.at(-1)?.key !== k) days.push({ key: k, title: dayTitle(a.at), items: [] });
    days.at(-1)!.items.push(a);
  }
  return (
    <div className="history">
      <div className="chip-row" role="group" aria-label={tr('Что показывать')}>
        {FILTERS.map((x) => <button key={x.id} type="button" className={`chip chip-btn${f === x.id ? ' is-on' : ''}`} aria-pressed={f === x.id} onClick={() => setF(x.id)}>{x.name}</button>)}
      </div>
      {days.map((d) => (
        <section key={d.key} className="hday">
          <h3 className="hday-title">{d.title}</h3>
          <ul className="hlist">
            {d.items.map((a) => {
              const to = refLink(s, p, a);
              return (
                <li key={a.id} className={`h-${a.type}`}>
                  <Avatar user={getUser(s, a.actorId)} size={24} />
                  <p><UserLink id={a.actorId} /> {to ? <Link to={to} className="h-text">{gverb(activityText(a), getUser(s, a.actorId))}</Link> : <span className="h-text">{gverb(activityText(a), getUser(s, a.actorId))}</span>}</p>
                  <time className="muted small" dateTime={new Date(a.at).toISOString()}>{timeLabel(a.at)}</time>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!list.length && <p className="muted">{tr('Событий этого типа пока нет.')}</p>}
      {all.length > limit && <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + 60)}>{tr('Показать раньше')}</button>}
    </div>
  );
}
