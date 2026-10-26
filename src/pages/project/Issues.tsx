import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addTasks, blockers, getUser, isMaintainer, projectMembers, projectTasks, taskContribs, type NewTask } from '../../data/ops';
import { act, getState, useAppState } from '../../data/store';
import { CATEGORIES, SKILLS, TASK_STATUSES, isClosed, type Project, type Skill, type Task } from '../../data/types';
import { EngineBadge } from '../../components/AiPanel';
import { IconBoard, IconCheck, IconChevron, IconComment, IconFlag, IconIssue, IconIssueDone, IconList, IconPeople, IconPull, IconSearch, IconSpark } from '../../components/icons';
import { ActionMenu, FilterMenu, type Option } from '../../components/pop';
import { TimeAgo } from '../../components/Timeline';
import { Avatar, CraftLabels, Empty, Field, Modal, PriorityMark, SkillDots, TaskIcon, openLogin, report, useMe } from '../../components/ui';
import { askDecompose, type DraftTask } from '../../lib/ai';
import { Markdown } from '../../lib/markdown';
import { tn, tr } from '../../i18n';

const PRIO = { critical: 0, high: 1, normal: 2, low: 3 };
type Sort = 'new' | 'old' | 'prio' | 'updated';

export function TypeLabel({ t }: { t: Pick<Task, 'type'> }) {
  if (t.type === 'task') return null;
  return <span className={`label label-${t.type}`}>{t.type === 'bug' ? tr('ошибка') : tr('идея')}</span>;
}

function IssueRow({ p, t, craft }: { p: Project; t: Task; craft?: Skill }) {
  const s = useAppState();
  const pulls = taskContribs(s, t.id).filter((c) => c.status !== 'rejected').length;
  const ms = p.milestones.find((m) => m.id === t.milestoneId);
  const blocked = t.status === 'open' && blockers(s, t).length > 0;
  return (
    <li className="irow">
      <TaskIcon t={t} />
      <div className="irow-main">
        <div className="irow-line">
          <Link to={`/p/${p.slug}/issues/${t.number}`} className="irow-title">{t.title}</Link>
          <TypeLabel t={t} />
          {craft ? <CraftLabels skills={t.skills.filter((x) => x !== craft)} /> : <CraftLabels skills={t.skills} />}
          <PriorityMark priority={t.priority} />
        </div>
        <div className="irow-meta">
          <span>#{t.number} {isClosed(t) ? (t.status === 'done' ? tr('выполнена') : tr('отклонена')) : t.status === 'proposed' ? tr('предложена') : tr('открыта')} <TimeAgo at={isClosed(t) ? t.updatedAt : t.createdAt} />, {getUser(s, t.createdBy)?.name}</span>
          {ms && <span className="irow-ms"><IconFlag />{ms.title}</span>}
          {blocked && <span className="irow-wait">{tr('ждёт других задач')}</span>}
          {t.status === 'open' && !t.assigneeId && !blocked && <span className="irow-free">{tr('свободна')}</span>}
        </div>
      </div>
      <div className="irow-side">
        {pulls > 0 && <span className="irow-stat" data-tip={tn(pulls, '{n} связанный вклад|{n} связанных вклада|{n} связанных вкладов')}><IconPull />{pulls}</span>}
        {t.assigneeId && <span data-tip={tr('Исполнитель: {name}', { name: getUser(s, t.assigneeId)?.name })}><Avatar user={getUser(s, t.assigneeId)} size={22} /></span>}
        {t.comments.length > 0 && <span className="irow-stat" data-tip={tn(t.comments.length, '{n} комментарий|{n} комментария|{n} комментариев')}><IconComment />{t.comments.length}</span>}
      </div>
    </li>
  );
}

/** Стопки задач по ремёслам: у каждого специалиста свой блок. Задача на несколько ремёсел есть в каждом из них. */
function CraftBlocks({ p, tasks, closed }: { p: Project; tasks: Task[]; closed: boolean }) {
  const [open, setOpen] = useState<Skill[]>([]);
  const blocks = SKILLS.map((sk) => ({ sk, list: tasks.filter((t) => t.skills.includes(sk.id)) })).filter((b) => b.list.length);
  if (!blocks.length) return <div className="box"><Empty icon={<IconIssue size={24} />} title={closed ? tr('Закрытых задач нет') : tr('Под эти условия задач нет')}>{tr('Сбросьте фильтры или предложите новую задачу.')}</Empty></div>;
  return (
    <div className="craft-blocks">
      {blocks.map(({ sk, list }) => {
        const free = list.filter((t) => t.status === 'open' && !t.assigneeId).length;
        const all = open.includes(sk.id);
        const shown = all ? list : list.slice(0, 5);
        const needed = p.rolesNeeded.includes(sk.id);
        return (
          <section key={sk.id} className="box craft-block" style={{ ['--c' as string]: `var(--sk-${sk.id})` }} aria-label={sk.name}>
            <div className="craft-head">
              <span className="craft-dot" />
              <h3>{sk.name}</h3>
              <span className="counter">{list.length}</span>
              <span className="craft-sub">{!closed && free > 0 ? tn(free, '{n} свободная|{n} свободные|{n} свободных') : ''}{!closed && needed ? (free ? ', ' : '') + tr('ищут людей') : ''}</span>
            </div>
            <ul className="ilist">{shown.map((t) => <IssueRow key={t.id} p={p} t={t} craft={sk.id} />)}</ul>
            {list.length > 5 && (
              <button type="button" className="craft-more" onClick={() => setOpen(all ? open.filter((x) => x !== sk.id) : [...open, sk.id])}>
                {all ? tr('Свернуть') : tr('Показать ещё {x1}', { x1: list.length - 5 })}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function BoardView({ p, tasks }: { p: Project; tasks: Task[] }) {
  const s = useAppState();
  const cols = TASK_STATUSES.filter((c) => c.id !== 'declined' && (c.id !== 'proposed' || tasks.some((t) => t.status === 'proposed')));
  return (
    <div className="board" role="list">
      {cols.map((col) => {
        const list = tasks.filter((t) => t.status === col.id).sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || b.updatedAt - a.updatedAt);
        return (
          <section key={col.id} className={`col col-${col.id}`} role="listitem" aria-label={col.name}>
            <h3 className="col-head"><span>{col.name}</span><span className="counter">{list.length}</span></h3>
            <div className="col-body">
              {list.map((t) => (
                <Link key={t.id} to={`/p/${p.slug}/issues/${t.number}`} className="tcard">
                  <span className="tcard-num"><TaskIcon t={t} />#{t.number}</span>
                  <span className="tcard-title">{t.title}</span>
                  <span className="tcard-foot">
                    <SkillDots skills={t.skills} />
                    <PriorityMark priority={t.priority} />
                    {t.assigneeId && <Avatar user={getUser(s, t.assigneeId)} size={20} />}
                  </span>
                </Link>
              ))}
              {!list.length && <p className="col-empty">{tr('Пусто')}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DecomposeModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  const [goal, setGoal] = useState(p.goal);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ drafts: (DraftTask & { on: boolean })[]; note: string; warning?: string } | null>(null);
  useEffect(() => { if (open) { setGoal(p.goal); setRes(null); } }, [open, p.goal]);

  const run = async () => {
    setBusy(true);
    const r = await askDecompose(getState(), { goal, category: p.category, projectId: p.id });
    setRes({ ...r, drafts: r.drafts.map((d) => ({ ...d, on: true })) });
    setBusy(false);
  };
  const toggle = (i: number) => setRes((r) => r && { ...r, drafts: r.drafts.map((d, j) => (j === i ? { ...d, on: !d.on } : d)) });
  const chosen = res?.drafts.filter((d) => d.on) ?? [];
  const add = () => {
    if (!me) return openLogin();
    const inputs: NewTask[] = chosen.map((d) => ({
      title: d.title, description: d.description, skills: d.skills, priority: d.priority, size: d.size, type: 'task',
      milestoneId: p.milestones.find((m) => m.title === d.milestone)?.id,
    }));
    if (report(act<ReturnType<typeof addTasks>>('addTasks', [p.id, inputs, me.id]), `${maint ? tr('Добавлено') : tr('Предложено')}: ${tn(inputs.length, '{n} задача|{n} задачи|{n} задач')}`)) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={tr('Разбить цель на задачи')} wide>
      <div className="stack">
        <Field label={tr('Цель')} hint={tr('Помощник учтёт категорию «{x1}», стадию и задачи, которые уже есть.', { x1: CATEGORIES.find((c) => c.id === p.category)!.name.toLowerCase() })}>
          <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <div className="row-between">
          <EngineBadge />
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy || goal.trim().length < 10}>{busy ? tr('Разбиваю…') : res ? tr('Предложить заново') : tr('Предложить задачи')}</button>
        </div>
        {res && (
          <>
            {res.warning && <p className="ai-warn">{res.warning}</p>}
            <p className="muted small">{res.note}</p>
            <ul className="drafts">
              {res.drafts.map((d, i) => (
                <li key={i} className={d.on ? '' : 'is-off'}>
                  <label className="draft-check"><input type="checkbox" checked={d.on} onChange={() => toggle(i)} /><span className="sr-only">{tr('Добавить')}</span></label>
                  <div>
                    <p className="draft-name">{d.title}</p>
                    <div className="draft-meta"><CraftLabels skills={d.skills} /><PriorityMark priority={d.priority} /><span className="muted small">{tr('размер')} {d.size}{d.milestone ? tr(', этап «{milestone}»', { milestone: d.milestone }) : ''}</span></div>
                    <details className="disclosure"><summary>{tr('Описание')}</summary><Markdown text={d.description} /></details>
                  </div>
                </li>
              ))}
            </ul>
            {!res.drafts.length && <p className="muted">{tr('Новых задач не нашлось — похожие уже есть на доске.')}</p>}
            <div className="row-end">
              {!maint && <span className="muted small">{tr('Задачи попадут в предложенные — их откроют сопровождающие.')}</span>}
              <button type="button" className="btn btn-primary" onClick={add} disabled={!chosen.length}>{maint ? tr('Добавить') : tr('Предложить')} {tr('выбранные (')}{chosen.length})</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function Issues({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const closed = params.get('state') === 'closed';
  const view = params.get('view') === 'board' ? 'board' : params.get('view') === 'list' ? 'list' : 'crafts';
  const skills = (params.get('skill')?.split(',').filter(Boolean) ?? []) as Skill[];
  const ms = params.get('m');
  const who = params.get('free') === '1' ? 'none' : params.get('who');
  const sort = (params.get('sort') as Sort) ?? 'new';
  const [q, setQ] = useState('');
  const maint = isMaintainer(p, me?.id);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete('free');
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => projectTasks(s, p.id).filter((t) => {
    if (skills.length && !t.skills.some((x) => skills.includes(x))) return false;
    if (ms && t.milestoneId !== ms) return false;
    if (who === 'none' && (t.assigneeId || t.status !== 'open')) return false;
    if (who === 'me' && t.assigneeId !== me?.id && t.createdBy !== me?.id) return false;
    if (who && who !== 'none' && who !== 'me' && t.assigneeId !== who) return false;
    if (q.trim() && !`${t.title} ${t.description} #${t.number}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [s, p.id, skills, ms, who, q, me?.id]);

  const openList = filtered.filter((t) => !isClosed(t));
  const closedList = filtered.filter(isClosed);
  const list = (closed ? closedList : openList).sort((a, b) =>
    sort === 'old' ? a.number - b.number : sort === 'prio' ? PRIO[a.priority] - PRIO[b.priority] || b.number - a.number : sort === 'updated' ? b.updatedAt - a.updatedAt : b.number - a.number);

  const members = projectMembers(s, p);
  const whoOptions: Option<string>[] = [
    { value: 'none', label: tr('Свободные'), hint: tr('без исполнителя') },
    ...(me ? [{ value: 'me', label: tr('Мои'), hint: tr('взятые или созданные мной') }] : []),
    ...members.map((id) => ({ value: id, label: getUser(s, id)?.name ?? id, icon: <Avatar user={getUser(s, id)} size={18} /> })),
  ];

  const newIssue = (type?: 'bug') => (me ? navigate(`/p/${p.slug}/issues/new${type ? '?type=bug' : ''}`) : openLogin());

  return (
    <div className="issues">
      <div className="list-bar">
        <label className="search-field">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Найти задачу по названию или номеру')} aria-label={tr('Найти задачу')} />
        </label>
        <div className="seg seg-icons" role="tablist" aria-label={tr('Вид')}>
          <button type="button" role="tab" aria-selected={view === 'crafts'} className={view === 'crafts' ? 'is-on' : ''} onClick={() => set({ view: null })}><IconPeople />{tr('По ремёслам')}</button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => set({ view: 'list' })}><IconList />{tr('Список')}</button>
          <button type="button" role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'is-on' : ''} onClick={() => set({ view: 'board' })}><IconBoard />{tr('Доска')}</button>
        </div>
        <div className="split-btn">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => newIssue()}>{maint ? tr('Новая задача') : tr('Предложить задачу')}</button>
          <ActionMenu
            label={tr('Другие способы добавить задачу')}
            className="btn btn-primary btn-sm split-more"
            trigger={<IconChevron />}
            items={[
              { label: tr('Добавить сделанную работу'), hint: tr('задача и вклад к ней сразу'), icon: <IconCheck />, onSelect: () => (me ? navigate(`/p/${p.slug}/issues/done`) : openLogin()) },
              { label: tr('Сообщить об ошибке'), hint: tr('что-то работает не так'), onSelect: () => newIssue('bug') },
              { label: tr('Разбить цель на задачи'), hint: tr('помощник предложит список'), icon: <IconSpark />, onSelect: () => set({ decompose: '1' }) },
            ]}
          />
        </div>
      </div>

      {view === 'board' ? <BoardView p={p} tasks={filtered} /> : (
        <div className={view === 'crafts' ? 'crafts-view' : 'box'}>
          <div className={`box-head list-head${view === 'crafts' ? ' list-head-bar' : ''}`}>
            <div className="state-tabs">
              <button type="button" className={!closed ? 'is-on' : ''} onClick={() => set({ state: null })}><IconIssue />{tn(openList.length, '{n} открытая|{n} открытые|{n} открытых')}</button>
              <button type="button" className={closed ? 'is-on' : ''} onClick={() => set({ state: 'closed' })}><IconIssueDone />{tn(closedList.length, '{n} закрытая|{n} закрытые|{n} закрытых')}</button>
            </div>
            <div className="filters-row">
              <FilterMenu label={tr('Ремесло')} title={tr('Фильтр по ремеслу')} multiple options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))} value={skills}
                onChange={(v) => set({ skill: (skills.includes(v) ? skills.filter((x) => x !== v) : [...skills, v]).join(',') || null })} />
              {p.milestones.length > 0 && (
                <FilterMenu label={tr('Этап')} title={tr('Фильтр по этапу')} options={p.milestones.map((m) => ({ value: m.id, label: m.title, icon: <IconFlag /> }))} value={ms} onChange={(v) => set({ m: ms === v ? null : v })} />
              )}
              <FilterMenu label={tr('Исполнитель')} title={tr('Кто делает')} options={whoOptions} value={who} onChange={(v) => set({ who: who === v ? null : v })} />
              <FilterMenu label={tr('Сортировка')} title={tr('Порядок')} align="end" options={[
                { value: 'new', label: tr('Сначала новые') }, { value: 'old', label: tr('Сначала старые') }, { value: 'prio', label: tr('По приоритету') }, { value: 'updated', label: tr('Недавно обновлённые') },
              ]} value={sort} onChange={(v) => set({ sort: v === 'new' ? null : v })} />
            </div>
          </div>
          {view === 'crafts' ? <CraftBlocks p={p} tasks={list} closed={closed} /> : list.length ? <ul className="ilist">{list.map((t) => <IssueRow key={t.id} p={p} t={t} />)}</ul> : (
            <Empty icon={<IconIssue size={24} />} title={closed ? tr('Закрытых задач нет') : tr('Под эти условия задач нет')}>
              {closed ? tr('Здесь появятся выполненные и отклонённые задачи.') : tr('Сбросьте фильтры или предложите новую задачу.')}
            </Empty>
          )}
        </div>
      )}
      <DecomposeModal p={p} open={params.get('decompose') === '1'} onClose={() => set({ decompose: null })} />
    </div>
  );
}
