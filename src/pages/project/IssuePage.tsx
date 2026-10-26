import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  addTaskComment, approveTask, assignTask, blockers, declineTask, editTask, getTask, getUser, isMaintainer, milestoneProgress,
  moveTask, projectMembers, projectTasks, releaseTask, taskByNumber, taskContribs, takeTask,
} from '../../data/ops';
import { act, getState, useAppState } from '../../data/store';
import { PRIORITIES, SIZES, SKILLS, isClosed, skillInfo, type Project, type Skill, type Task } from '../../data/types';
import { EngineBadge } from '../../components/AiPanel';
import {
  IconCheck, IconFlag, IconIssue, IconIssueDeclined, IconIssueDone, IconPencil, IconPull, IconPullMerged, IconSpark, IconUser,
} from '../../components/icons';
import { ActionMenu, SelectMenu, promptDialog } from '../../components/pop';
import { SideSection } from '../../components/Side';
import { CommentBox, Composer, EventRow, TimeAgo } from '../../components/Timeline';
import { Avatar, ContribIcon, CraftLabels, Empty, Modal, PriorityMark, Progress, TaskPill, UserLink, openLogin, report, useMe } from '../../components/ui';
import { askText, type AiAnswer, type TextTask } from '../../lib/ai';
import { g, gverb } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { TypeLabel } from './Issues';
import { tn, tr } from '../../i18n';
import { activityText } from '../../lib/activity';

const EVENT_ICON: Record<string, { icon: ReactNode; tone?: string }> = {
  taken: { icon: <IconUser /> },
  assigned: { icon: <IconUser /> },
  released: { icon: <IconUser /> },
  approved: { icon: <IconIssue />, tone: 'open' },
  moved: { icon: <IconFlag /> },
  edited: { icon: <IconPencil /> },
  closed: { icon: <IconIssueDone />, tone: 'done' },
  declined: { icon: <IconIssueDeclined />, tone: 'muted' },
  reopened: { icon: <IconIssue />, tone: 'open' },
};

/** Убрать из текста события повтор «в задаче #N», он и так на странице задачи. */
const trimSelf = (text: string, n: number) => text
  .replace(new RegExp(`\\s*(в задаче|с задачи|задачу|задачи|in issue|on issue|from issue|issue)?\\s*#${n}(\\s*[«“「][^»”」]*[»”」])?`, 'i'), '')
  .replace(/\s+([,.。、])/g, '$1').trim();

function AiHelp({ p, t }: { p: Project; t: Task }) {
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  const [res, setRes] = useState<(AiAnswer & { title: string; spec?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const run = async (task: TextTask, title: string, spec = false) => {
    setBusy(true); setStream(''); setRes({ text: '', engine: 'local', title, spec });
    const r = await askText(getState(), p.id, task, setStream);
    setRes({ ...r, title, spec }); setBusy(false);
  };
  const items = SKILLS.filter((x) => !t.skills.includes(x.id)).map((x) => ({
    label: tr('Для {gen}', { gen: x.gen }), onSelect: () => run({ kind: 'translate', taskId: t.id, to: x.id }, tr('«{title}» — для {gen}', { title: t.title, gen: x.gen })),
  }));
  const applySpec = () => {
    if (!res || !me) return;
    if (report(act<ReturnType<typeof editTask>>('editTask', [t.id, { description: res.text }, me.id]), tr('Описание задачи обновлено'))) setRes(null);
  };
  return (
    <>
      <div className="side-ai">
        <ActionMenu label={tr('Объяснить задачу для другого ремесла')} className="btn btn-sm btn-block" trigger={<><IconSpark />{tr('Объяснить для…')}</>} items={items} align="end" width={240} />
        {maint && !isClosed(t) && <button type="button" className="btn btn-sm btn-block" onClick={() => run({ kind: 'spec', title: t.title, description: t.description, skills: t.skills, milestoneId: t.milestoneId }, tr('Техническое задание'), true)}><IconSpark />{tr('Уточнить ТЗ')}</button>}
      </div>
      <Modal open={!!res} onClose={() => setRes(null)} title={res?.title ?? ''} wide>
        <div className="stack">
          <div className="row-start"><EngineBadge engine={busy ? undefined : res?.engine} />{busy && <span className="muted small">{tr('Пишу…')}</span>}</div>
          {res?.warning && <p className="ai-warn">{res.warning}</p>}
          <Markdown text={busy ? stream || tr('Собираю ответ по материалам проекта…') : res?.text ?? ''} />
          {res?.spec && !busy && (
            <div className="row-end">
              <button type="button" className="btn btn-ghost" onClick={() => setRes(null)}>{tr('Не нужно')}</button>
              <button type="button" className="btn btn-primary" onClick={applySpec}>{tr('Заменить описание задачи')}</button>
            </div>
          )}
          <p className="ai-note">{tr('Это подсказка помощника. Решения по задаче принимают люди.')}</p>
        </div>
      </Modal>
    </>
  );
}

export function IssuePage({ p, n }: { p: Project; n: number }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const t = taskByNumber(s, p.id, n);
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string | null>(null);

  if (!t) return <Empty icon={<IconIssue size={24} />} title={tr('Задачи #{n} нет', { n })} action={<Link to={`/p/${p.slug}/issues`} className="btn">{tr('Все задачи')}</Link>}>{tr('Возможно, номер относится к вкладу:')} <Link to={`/p/${p.slug}/pulls/${n}`}>{tr('открыть вклад #')}{n}</Link>.</Empty>;

  const maint = isMaintainer(p, me?.id);
  const canEdit = maint || (t.createdBy === me?.id && t.status === 'proposed');
  const closed = isClosed(t);
  const blockedBy = blockers(s, t);
  const deps = t.dependsOn.map((id) => getTask(s, id)).filter((x): x is Task => !!x);
  const blocking = projectTasks(s, p.id).filter((x) => x.dependsOn.includes(t.id));
  const pulls = taskContribs(s, t.id);
  const ms = p.milestones.find((m) => m.id === t.milestoneId);
  const members = projectMembers(s, p);
  const run = <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }, ok?: string) => (me ? report(fn(), ok) : (openLogin(), false));

  // лента: комментарии, события из истории, связанные вклады
  type Item = { at: number; key: string; node: ReactNode };
  const items: Item[] = [];
  for (const c of t.comments) items.push({ at: c.createdAt, key: c.id, node: <CommentBox p={p} authorId={c.authorId} at={c.createdAt} body={c.body} isAuthor={c.authorId === t.createdBy} /> });
  for (const a of s.activity) {
    if (a.ref?.kind !== 'task' || a.ref.id !== t.id || !a.verb || !(a.verb in EVENT_ICON)) continue;
    const ic = EVENT_ICON[a.verb];
    items.push({ at: a.at, key: a.id, node: <EventRow icon={ic.icon} tone={ic.tone} actorId={a.actorId} at={a.at}>{gverb(trimSelf(activityText(a), t.number), getUser(s, a.actorId))}</EventRow> });
  }
  for (const c of pulls) {
    items.push({ at: c.createdAt, key: `pr-${c.id}`, node: (
      <EventRow icon={<IconPull />} tone="open" actorId={c.authorId} at={c.createdAt}>
        {g(getUser(s, c.authorId), tr('предложил'), tr('предложила'))} {tr('вклад')} <Link to={`/p/${p.slug}/pulls/${c.number}`} className="ev-link"><ContribIcon c={c} />{c.title} <span className="muted">#{c.number}</span></Link>
      </EventRow>
    ) });
    if (c.status === 'accepted' && c.decidedAt) {
      items.push({ at: c.decidedAt, key: `merged-${c.id}`, node: (
        <EventRow icon={<IconPullMerged />} tone="done" actorId={c.decidedBy} at={c.decidedAt}>
          {g(getUser(s, c.decidedBy), tr('закрыл'), tr('закрыла'))} {tr('задачу, приняв вклад')} <Link to={`/p/${p.slug}/pulls/${c.number}`}>#{c.number}</Link>
        </EventRow>
      ) });
    }
  }
  items.sort((a, b) => a.at - b.at);

  const saveTitle = () => { if (editTitle !== null && run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { title: editTitle }, me!.id]))) setEditTitle(null); };
  const saveBody = () => { if (editBody !== null && run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { description: editBody }, me!.id]), tr('Описание обновлено'))) setEditBody(null); };
  const decline = async () => {
    const reason = await promptDialog({ title: tr('Закрыть задачу #{number} как неактуальную?', { number: t.number }), text: tr('Задача останется в истории проекта, а причина появится в комментариях.'), label: tr('Причина'), placeholder: tr('Например: не подходит концепции или уже сделано в другой задаче'), confirm: tr('Закрыть задачу'), danger: true });
    if (reason !== null) run(() => act<ReturnType<typeof declineTask>>('declineTask', [t.id, me!.id, reason]), tr('Задача закрыта'));
  };

  return (
    <div className="issue">
      <header className="ihead">
        {editTitle !== null ? (
          <form className="ititle-edit" onSubmit={(e) => { e.preventDefault(); saveTitle(); }}>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label={tr('Заголовок задачи')} autoFocus />
            <button type="submit" className="btn btn-sm">{tr('Сохранить')}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditTitle(null)}>{tr('Отмена')}</button>
          </form>
        ) : (
          <div className="ititle-row">
            <h1 className="ititle">{t.title} <span className="inum">#{t.number}</span></h1>
            <div className="row-start">
              {canEdit && <button type="button" className="btn btn-sm" onClick={() => setEditTitle(t.title)}>{tr('Править')}</button>}
              <Link to={`/p/${p.slug}/issues/new`} className="btn btn-sm btn-primary">{tr('Новая задача')}</Link>
            </div>
          </div>
        )}
        <div className="imeta">
          <TaskPill t={t} />
          <span><UserLink id={t.createdBy} /> {gverb(t.type === 'bug' ? tr('сообщил об ошибке') : t.status === 'proposed' ? tr('предложил задачу') : tr('открыл задачу'), getUser(s, t.createdBy))} <TimeAgo at={t.createdAt} />, {tn(t.comments.length, '{n} комментарий|{n} комментария|{n} комментариев')}</span>
        </div>
      </header>

      <div className="igrid">
        <div className="timeline">
          {editBody !== null ? (
            <div className="tl-item tl-comment">
              <span className="tl-avatar"><Avatar user={getUser(s, t.createdBy)} size={36} /></span>
              <div className="cbox"><div className="composer-body">
                <textarea rows={10} value={editBody} onChange={(e) => setEditBody(e.target.value)} aria-label={tr('Описание задачи')} />
                <div className="composer-foot"><span /><div className="row-end"><button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditBody(null)}>{tr('Отмена')}</button><button type="button" className="btn btn-sm btn-primary" onClick={saveBody}>{tr('Сохранить')}</button></div></div>
              </div></div>
            </div>
          ) : (
            <CommentBox p={p} authorId={t.createdBy} at={t.createdAt} body={t.description} isAuthor
              badge={canEdit ? <button type="button" className="icon-btn cbox-edit" onClick={() => setEditBody(t.description)} aria-label={tr('Править описание')} data-tip={tr('Править описание')}><IconPencil /></button> : undefined} />
          )}

          {items.map((it) => <div key={it.key} className="tl-wrap">{it.node}</div>)}

          {!closed && t.status !== 'proposed' && (
            <div className="tl-item tl-callout">
              <span className="tl-badge tl-open"><IconIssue /></span>
              <div className="callout">
                {me && t.assigneeId === me.id ? (
                  <>
                    <div><strong>{tr('Вы работаете над этой задачей')}</strong><p className="muted small">{tr('Когда результат готов, предложите вклад — его проверят сопровождающие.')}</p></div>
                    <div className="row-start">
                      <button type="button" className="btn btn-sm" onClick={() => run(() => act<ReturnType<typeof releaseTask>>('releaseTask', [t.id, me!.id]), tr('Задача снова свободна'))}>{tr('Отказаться')}</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/p/${p.slug}/pulls/new?task=${t.number}`)}><IconPull />{tr('Предложить вклад')}</button>
                    </div>
                  </>
                ) : t.assigneeId ? (
                  <>
                    <div><strong>{tr('Задачу делает')} {getUser(s, t.assigneeId)?.name}</strong><p className="muted small">{tr('Можно помочь советом в комментариях или выбрать другую задачу.')}</p></div>
                  </>
                ) : blockedBy.length ? (
                  <div><strong>{tr('Задача ждёт')}</strong><p className="muted small">{tr('Сначала нужно закончить:')} {blockedBy.map((b, i) => <span key={b.id}>{i > 0 && ', '}<Link to={`/p/${p.slug}/issues/${b.number}`}>#{b.number} {b.title}</Link></span>)}.</p></div>
                ) : (
                  <>
                    <div><strong>{tr('Задача свободна')}</strong><p className="muted small">{tr('Нужны:')} {t.skills.map((x) => skillInfo(x).name.toLowerCase()).join(', ')}. {SIZES.find((x) => x.id === t.size)!.name}.</p></div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => run(() => act<ReturnType<typeof takeTask>>('takeTask', [t.id, me!.id]), tr('Задача ваша. Когда закончите — предложите вклад.'))}>{tr('Взять задачу')}</button>
                  </>
                )}
              </div>
            </div>
          )}

          <Composer
            onSubmit={(text) => !!run(() => act<ReturnType<typeof addTaskComment>>('addTaskComment', [t.id, text, me!.id]))}
            actions={() => (
              <>
                {maint && t.status === 'proposed' && (
                  <>
                    <button type="button" className="btn btn-sm" onClick={decline}>{tr('Отклонить')}</button>
                    <button type="button" className="btn btn-sm btn-ok" onClick={() => run(() => act<ReturnType<typeof approveTask>>('approveTask', [t.id, me!.id]), tr('Задача открыта для всех'))}><IconCheck />{tr('Открыть для всех')}</button>
                  </>
                )}
                {maint && !closed && t.status !== 'proposed' && (
                  <ActionMenu label={tr('Закрыть задачу')} className="btn btn-sm" trigger={<><IconIssueDone />{tr('Закрыть задачу')}</>} align="end" items={[
                    { label: tr('Как выполненную'), hint: tr('работа сделана'), icon: <IconIssueDone />, onSelect: () => run(() => act<ReturnType<typeof moveTask>>('moveTask', [t.id, 'done', me!.id]), tr('Задача закрыта')) },
                    { label: tr('Как неактуальную'), hint: tr('больше не нужна'), icon: <IconIssueDeclined />, onSelect: decline },
                  ]} />
                )}
                {maint && closed && <button type="button" className="btn btn-sm" onClick={() => run(() => act<ReturnType<typeof moveTask>>('moveTask', [t.id, 'open', me!.id]), tr('Задача снова открыта'))}><IconIssue />{tr('Открыть снова')}</button>}
              </>
            )}
          />
        </div>

        <aside className="iside">
          <SideSection title={tr('Исполнитель')} menu={maint && !closed && t.status !== 'proposed' ? (close) => (
            <SelectMenu title={tr('Назначить исполнителя')} value={t.assigneeId ?? null} onClose={close}
              options={[{ value: '__none', label: tr('Без исполнителя') }, ...members.map((id) => ({ value: id, label: getUser(s, id)?.name ?? id, icon: <Avatar user={getUser(s, id)} size={18} /> }))]}
              onPick={(v) => run(() => act<ReturnType<typeof assignTask>>('assignTask', [t.id, v === '__none' ? null : v, me!.id]))} />
          ) : undefined}>
            {t.assigneeId ? <UserLink id={t.assigneeId} avatar /> : (
              <span className="muted">{tr('Никого')}{!closed && t.status === 'open' && !blockedBy.length && <> — <button type="button" className="link-btn" onClick={() => run(() => act<ReturnType<typeof takeTask>>('takeTask', [t.id, me!.id]), tr('Задача ваша'))}>{tr('взять себе')}</button></>}</span>
            )}
          </SideSection>

          <SideSection title={tr('Ремёсла')} menu={canEdit ? () => (
            <SelectMenu<Skill> title={tr('Какие навыки нужны')} multiple value={t.skills}
              options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))}
              onPick={(v) => run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { skills: t.skills.includes(v) ? t.skills.filter((x) => x !== v) : [...t.skills, v] }, me!.id]))} />
          ) : undefined}>
            <span className="labels-wrap"><TypeLabel t={t} /><CraftLabels skills={t.skills} /></span>
          </SideSection>

          <SideSection title={tr('Этап')} menu={canEdit && p.milestones.length ? (close) => (
            <SelectMenu title={tr('Этап')} value={t.milestoneId ?? '__none'} onClose={close}
              options={[{ value: '__none', label: tr('Без этапа') }, ...p.milestones.map((m) => ({ value: m.id, label: m.title, icon: <IconFlag /> }))]}
              onPick={(v) => run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { milestoneId: v === '__none' ? undefined : v }, me!.id]))} />
          ) : undefined}>
            {ms ? (
              <div className="side-ms-one">
                <Link to={`/p/${p.slug}/issues?m=${ms.id}`}>{ms.title}</Link>
                <Progress ratio={milestoneProgress(s, ms).ratio} label={ms.title} />
              </div>
            ) : <span className="muted">{tr('Не указан')}</span>}
          </SideSection>

          <SideSection title={tr('Приоритет и размер')} menu={canEdit ? (close) => (
            <SelectMenu title={tr('Приоритет')} value={t.priority} onClose={close} options={PRIORITIES.map((x) => ({ value: x.id, label: x.name }))}
              onPick={(v) => run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { priority: v }, me!.id]))}
              footer={<div className="smenu-sizes"><span className="muted small">{tr('Размер')}</span>{SIZES.map((x) => (
                <button key={x.id} type="button" className={`chip chip-btn${t.size === x.id ? ' is-on' : ''}`} onClick={() => run(() => act<ReturnType<typeof editTask>>('editTask', [t.id, { size: x.id }, me!.id]))} data-tip={x.name}>{x.id}</button>
              ))}</div>} />
          ) : undefined}>
            <span className="row-start"><PriorityMark priority={t.priority} />{(t.priority === 'normal' || t.priority === 'low') && <span>{PRIORITIES.find((x) => x.id === t.priority)!.name}</span>}<span className="muted">{SIZES.find((x) => x.id === t.size)!.name.toLowerCase()}</span></span>
          </SideSection>

          <SideSection title={tr('Вклады')}>
            {pulls.length ? (
              <ul className="side-list">
                {pulls.map((c) => <li key={c.id}><Link to={`/p/${p.slug}/pulls/${c.number}`} className="side-pr"><ContribIcon c={c} /><span>{c.title}</span><span className="muted">#{c.number}</span></Link></li>)}
              </ul>
            ) : <span className="muted">{tr('Пока нет.')}</span>}
            {!closed && t.status !== 'proposed' && <Link to={`/p/${p.slug}/pulls/new?task=${t.number}`} className="side-action" onClick={(e) => { if (!me) { e.preventDefault(); openLogin(); } }}>{tr('Предложить вклад')}</Link>}
          </SideSection>

          {(deps.length > 0 || blocking.length > 0) && (
            <SideSection title={tr('Связи')}>
              {deps.length > 0 && <p className="small"><span className="muted">{tr('Ждёт:')}</span> {deps.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link to={`/p/${p.slug}/issues/${d.number}`}>#{d.number}</Link>{d.status === 'done' && ' ✓'}</span>)}</p>}
              {blocking.length > 0 && <p className="small"><span className="muted">{tr('Её ждут:')}</span> {blocking.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link to={`/p/${p.slug}/issues/${d.number}`}>#{d.number}</Link></span>)}</p>}
            </SideSection>
          )}

          <SideSection title={tr('Помощник')}><AiHelp p={p} t={t} /></SideSection>
        </aside>
      </div>
    </div>
  );
}
