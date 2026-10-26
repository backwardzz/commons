import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { approvals, getTask, getUser, isMaintainer, projectContribs } from '../../data/ops';
import { useAppState } from '../../data/store';
import { SKILLS, type Contribution, type Project, type Skill } from '../../data/types';
import { IconCheck, IconComment, IconDot, IconIssue, IconPull, IconPullClosed, IconPullMerged, IconSearch } from '../../components/icons';
import { FilterMenu } from '../../components/pop';
import { TimeAgo } from '../../components/Timeline';
import { Avatar, ContribIcon, CraftLabel, Empty, openLogin, useMe } from '../../components/ui';
import { tn, tr } from '../../i18n';

type State = 'open' | 'accepted' | 'rejected';
const isOpen = (c: Contribution) => c.status === 'open' || c.status === 'changes_requested';

export function ReviewState({ p, c }: { p: Project; c: Contribution }) {
  const s = useAppState();
  if (!isOpen(c)) return null;
  if (c.status === 'changes_requested') return <span className="rstate rstate-changes" data-tip={tr('Сопровождающие просят правки')}><IconDot />{tr('нужны правки')}</span>;
  const n = approvals(s, c).length;
  if (!n) return null;
  const need = p.acceptRule === 'two-approvals' ? 2 : 1;
  return <span className={`rstate${n >= need ? ' rstate-ok' : ''}`} data-tip={tr('Одобрений сопровождающих: {n}', { n })}><IconCheck />{n >= need ? tr('одобрен') : tr('{n} из {need}', { n, need })}</span>;
}

function PullRow({ p, c }: { p: Project; c: Contribution }) {
  const s = useAppState();
  const task = getTask(s, c.taskId);
  const comments = c.reviews.filter((r) => r.text).length;
  return (
    <li className="irow">
      <ContribIcon c={c} />
      <div className="irow-main">
        <div className="irow-line">
          <Link to={`/p/${p.slug}/pulls/${c.number}`} className="irow-title">{c.title}</Link>
          <CraftLabel skill={c.kind} />
          <ReviewState p={p} c={c} />
        </div>
        <div className="irow-meta">
          <span>#{c.number} {c.status === 'accepted' ? tr('принят') : c.status === 'rejected' ? tr('закрыт') : tr('открыт')} <TimeAgo at={c.decidedAt ?? c.createdAt} />, {getUser(s, c.authorId)?.name}</span>
          {task && <Link to={`/p/${p.slug}/issues/${task.number}`} className="irow-ms"><IconIssue />{tr('задача #')}{task.number}</Link>}
        </div>
      </div>
      <div className="irow-side">
        <span data-tip={tr('Автор: {name}', { name: getUser(s, c.authorId)?.name })}><Avatar user={getUser(s, c.authorId)} size={22} /></span>
        {comments > 0 && <span className="irow-stat" data-tip={tn(comments, '{n} отзыв|{n} отзыва|{n} отзывов')}><IconComment />{comments}</span>}
      </div>
    </li>
  );
}

export function Pulls({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const state = (params.get('state') as State) ?? 'open';
  const kinds = (params.get('kind')?.split(',').filter(Boolean) ?? []) as Skill[];
  const author = params.get('author');
  const [q, setQ] = useState('');

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };

  const all = useMemo(() => projectContribs(s, p.id).filter((c) => {
    if (kinds.length && !kinds.includes(c.kind)) return false;
    if (author && c.authorId !== author) return false;
    if (q.trim() && !`${c.title} ${c.summary} #${c.number}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [s, p.id, kinds, author, q]);
  const byState = { open: all.filter(isOpen), accepted: all.filter((c) => c.status === 'accepted'), rejected: all.filter((c) => c.status === 'rejected') };
  const list = [...byState[state]].sort((a, b) => b.number - a.number);
  const authors = [...new Set(projectContribs(s, p.id).map((c) => c.authorId))];

  return (
    <div className="pulls">
      <div className="list-bar">
        <label className="search-field">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Найти вклад по названию или номеру')} aria-label={tr('Найти вклад')} />
        </label>
        <button type="button" className="btn btn-sm" onClick={() => (me ? navigate(`/p/${p.slug}/issues/done`) : openLogin())} data-tip={tr('Работа уже сделана, а задачи под неё нет')}><IconCheck />{tr('Добавить сделанную работу')}</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => (me ? navigate(`/p/${p.slug}/pulls/new`) : openLogin())}><IconPull />{tr('Предложить вклад')}</button>
      </div>
      {isMaintainer(p, me?.id) && byState.open.length > 0 && state === 'open' && (
        <p className="list-note">{tr('Ждут вашего решения:')} {tn(byState.open.length, '{n} вклад|{n} вклада|{n} вкладов')}{tr('. Правило проекта —')} {p.acceptRule === 'two-approvals' ? tr('два одобрения сопровождающих') : p.acceptRule === 'owner' ? tr('решает автор') : tr('решает любой сопровождающий')}.</p>
      )}
      <div className="box">
        <div className="box-head list-head">
          <div className="state-tabs">
            <button type="button" className={state === 'open' ? 'is-on' : ''} onClick={() => set({ state: null })}><IconPull />{tn(byState.open.length, '{n} открытый|{n} открытых|{n} открытых')}</button>
            <button type="button" className={state === 'accepted' ? 'is-on' : ''} onClick={() => set({ state: 'accepted' })}><IconPullMerged />{tn(byState.accepted.length, '{n} принятый|{n} принятых|{n} принятых')}</button>
            <button type="button" className={state === 'rejected' ? 'is-on' : ''} onClick={() => set({ state: 'rejected' })}><IconPullClosed />{tn(byState.rejected.length, '{n} закрытый|{n} закрытых|{n} закрытых')}</button>
          </div>
          <div className="filters-row">
            <FilterMenu label={tr('Ремесло')} title={tr('Фильтр по ремеслу')} multiple options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))} value={kinds}
              onChange={(v) => set({ kind: (kinds.includes(v) ? kinds.filter((x) => x !== v) : [...kinds, v]).join(',') || null })} />
            <FilterMenu label={tr('Автор')} title={tr('Чьи вклады')} align="end" options={authors.map((id) => ({ value: id, label: getUser(s, id)?.name ?? id, icon: <Avatar user={getUser(s, id)} size={18} /> }))} value={author} onChange={(v) => set({ author: author === v ? null : v })} />
          </div>
        </div>
        {list.length ? <ul className="ilist">{list.map((c) => <PullRow key={c.id} p={p} c={c} />)}</ul> : (
          <Empty icon={<IconPull size={24} />} title={state === 'open' ? tr('Открытых вкладов нет') : tr('Здесь пока пусто')}>
            {tr('Вклад — это результат работы над задачей: код, макет, модель, текст, музыка или отчёт о тестировании.')}
          </Empty>
        )}
      </div>
    </div>
  );
}
