import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  approvals, canDecide, contribByNumber, decideContribution, getTask, getUser, isMaintainer, reviewContribution, updateContribution,
} from '../../data/ops';
import { act, getState, useAppState } from '../../data/store';
import { ACCEPT_RULES, type Contribution, type Project, type Verdict } from '../../data/types';
import { EngineBadge } from '../../components/AiPanel';
import {
  IconAlert, IconCheck, IconComment, IconDot, IconFile, IconIssue, IconLink, IconPencil, IconPull, IconPullClosed, IconPullMerged, IconSpark, IconX,
} from '../../components/icons';
import { ActionMenu, promptDialog } from '../../components/pop';
import { SideSection } from '../../components/Side';
import { CommentBox, Composer, EventRow, TimeAgo } from '../../components/Timeline';
import { Avatar, ContribPill, CraftLabel, Empty, TaskIcon, UserLink, openLogin, report, useMe } from '../../components/ui';
import { askReview, type ReviewResult } from '../../lib/ai';
import { reviewContrib } from '../../lib/ai-local';
import { g } from '../../lib/format';
import { tn, tr } from '../../i18n';

type Check = ReviewResult & { engine: 'local' | 'claude'; warning?: string };
const isUrl = (x: string) => /^https?:\/\//i.test(x);

function Checks({ check, busy, onRun }: { check: Check | null; busy: boolean; onRun: () => void }) {
  const order = { risk: 0, warn: 1, ok: 2 };
  return (
    <div className="box">
      <div className="box-head">
        <span className="box-title"><IconSpark />{tr('Проверка помощником')}</span>
        <span className="row-start">{check && <EngineBadge engine={check.engine} />}<button type="button" className="btn btn-sm" onClick={onRun} disabled={busy}>{busy ? tr('Проверяю…') : check ? tr('Проверить снова') : tr('Запустить проверку')}</button></span>
      </div>
      {check ? (
        <>
          {check.warning && <p className="ai-warn box-pad">{check.warning}</p>}
          <p className="checks-sum">{check.summary}</p>
          <ul className="checks">
            {[...check.findings].sort((a, b) => order[a.level] - order[b.level]).map((f, i) => (
              <li key={i} className={`check check-${f.level}`}>
                <span className="check-ico">{f.level === 'ok' ? <IconCheck /> : f.level === 'warn' ? <IconDot /> : <IconAlert />}</span>
                <div><strong>{f.title}</strong><p>{f.detail}</p></div>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="box-empty">{tr('Помощник сверит вклад с задачей и критериями приёмки и поищет конфликты с другими вкладами и нерешёнными обсуждениями.')}</p>}
    </div>
  );
}

function MergeBox({ p, c, check, goChecks }: { p: Project; c: Contribution; check: Check | null; goChecks: () => void }) {
  const s = useAppState();
  const me = useMe();
  const ap = approvals(s, c);
  const decide = canDecide(s, c, me?.id);
  const canReject = canDecide(s, c, me?.id, 'rejected').ok;
  const can = !!me && (isMaintainer(p, me.id) || p.ownerId === me.id);
  const risks = check?.findings.filter((f) => f.level === 'risk').length ?? 0;
  const warns = check?.findings.filter((f) => f.level === 'warn').length ?? 0;
  const need = p.acceptRule === 'two-approvals' ? 2 : 1;
  const reviewOk = c.status !== 'changes_requested' && (p.acceptRule === 'two-approvals' ? ap.length >= 2 : true);

  const accept = () => report(act<ReturnType<typeof decideContribution>>('decideContribution', [c.id, 'accepted', '', me!.id]), tr('Вклад принят и вошёл в проект'));
  const reject = async () => {
    const note = await promptDialog({ title: tr('Закрыть вклад #{number} без принятия?', { number: c.number }), text: tr('Автор увидит объяснение и сможет доработать вклад в новом.'), label: tr('Почему'), required: true, confirm: tr('Закрыть вклад'), danger: true });
    if (note) report(act<ReturnType<typeof decideContribution>>('decideContribution', [c.id, 'rejected', note, me!.id]), tr('Вклад закрыт'));
  };

  return (
    <div className="tl-item tl-merge">
      <span className={`tl-badge tl-big ${decide.ok ? 'tl-open' : 'tl-muted'}`}><IconPull /></span>
      <div className="mergebox">
        <div className={`mrow ${risks ? 'mrow-risk' : warns ? 'mrow-warn' : check ? 'mrow-ok' : ''}`}>
          <span className="mrow-ico">{!check ? <IconSpark /> : risks ? <IconAlert /> : warns ? <IconDot /> : <IconCheck />}</span>
          <div>
            <strong>{!check ? tr('Проверка помощником не запускалась') : risks ? tr('Помощник нашёл {x1}', { x1: tn(risks, '{n} риск|{n} риска|{n} рисков') }) : warns ? tr('Помощник оставил {x1}', { x1: tn(warns, '{n} замечание|{n} замечания|{n} замечаний') }) : tr('Помощник не нашёл проблем')}</strong>
            <p className="muted small">{tr('Проверка — подсказка, решение за людьми.')}</p>
          </div>
          <button type="button" className="link-btn small" onClick={goChecks}>{tr('Подробнее')}</button>
        </div>
        <div className={`mrow ${reviewOk ? 'mrow-ok' : 'mrow-warn'}`}>
          <span className="mrow-ico">{reviewOk ? <IconCheck /> : <IconDot />}</span>
          <div>
            <strong>{c.status === 'changes_requested' ? tr('Сопровождающие просят правки') : p.acceptRule === 'two-approvals' ? tr('Одобрений {length} из {need}', { length: ap.length, need }) : ap.length ? tr('Вклад одобрен') : tr('Отзывов сопровождающих пока нет')}</strong>
            <p className="muted small">{tr('Правило проекта:')} {ACCEPT_RULES.find((r) => r.id === p.acceptRule)!.hint.toLowerCase()}.{ap.length > 0 && tr(' Одобрили: {x1}.', { x1: ap.map((id) => getUser(s, id)?.name).join(', ') })}</p>
          </div>
        </div>
        <div className="mrow mrow-action">
          {can ? (
            <>
              <button type="button" className="btn btn-merge" onClick={accept} disabled={!decide.ok}><IconPullMerged />{tr('Принять вклад')}</button>
              <button type="button" className="btn" onClick={reject} disabled={!canReject}>{tr('Закрыть')}</button>
              {!decide.ok && <span className="muted small">{decide.reason}</span>}
            </>
          ) : <span className="muted small">{tr('Принять вклад могут')} {p.acceptRule === 'owner' ? tr('только автор проекта') : tr('сопровождающие проекта')}{tr('. Вы можете помочь отзывом.')}</span>}
        </div>
      </div>
    </div>
  );
}

export function PullPage({ p, n }: { p: Project; n: number }) {
  const s = useAppState();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'talk';
  const c = contribByNumber(s, p.id, n);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ summary: string; links: string } | null>(null);

  // встроенную проверку считаем сразу — она мгновенная; Claude запускается по кнопке
  const auto = useMemo(() => (c && s.ai.mode !== 'claude' ? { ...reviewContrib(s, c), engine: 'local' as const } : null), [s, c]);
  useEffect(() => { setCheck(null); }, [c?.id]);
  const shown = check ?? auto;

  if (!c) return <Empty icon={<IconPull size={24} />} title={tr('Вклада #{n} нет', { n })} action={<Link to={`/p/${p.slug}/pulls`} className="btn">{tr('Все вклады')}</Link>}>{tr('Возможно, это номер задачи:')} <Link to={`/p/${p.slug}/issues/${n}`}>{tr('открыть задачу #')}{n}</Link>.</Empty>;

  const task = getTask(s, c.taskId);
  const closed = c.status === 'accepted' || c.status === 'rejected';
  const own = me?.id === c.authorId;
  const reviewers = [...new Set([...p.maintainerIds, ...c.reviews.map((r) => r.authorId)])].filter((id) => id !== c.authorId);
  const lastVerdict = (id: string) => [...c.reviews].reverse().find((r) => r.authorId === id)?.verdict;
  const ms = task ? p.milestones.find((m) => m.id === task.milestoneId) : undefined;
  const files = c.links;

  const run = async () => { setBusy(true); setCheck(await askReview(getState(), c)); setBusy(false); };
  const review = (v: Verdict, text: string, clear: () => void) => {
    if (!me) return openLogin();
    if (report(act<ReturnType<typeof reviewContribution>>('reviewContribution', [c.id, v, text, me.id]), v === 'approve' ? tr('Вы одобрили вклад') : v === 'changes' ? tr('Автор получит просьбу о правках') : undefined)) clear();
  };
  const saveEdit = () => {
    if (!edit) return;
    if (report(act<ReturnType<typeof updateContribution>>('updateContribution', [c.id, { summary: edit.summary, links: edit.links.split('\n').map((l) => l.trim()).filter(Boolean) }, me!.id]), tr('Вклад обновлён и снова ждёт проверки'))) setEdit(null);
  };

  type Item = { at: number; key: string; node: ReactNode };
  const items: Item[] = [];
  for (const r of c.reviews) {
    const badge = r.verdict === 'approve' ? <span className="vbadge vbadge-ok"><IconCheck />{g(getUser(s, r.authorId), tr('одобрил'), tr('одобрила'))}</span> : r.verdict === 'changes' ? <span className="vbadge vbadge-changes"><IconDot />{tr('просит правки')}</span> : undefined;
    items.push({ at: r.createdAt, key: r.id, node: <CommentBox p={p} authorId={r.authorId} at={r.createdAt} body={r.text || undefined} badge={badge} tone={r.verdict === 'approve' ? 'approve' : r.verdict === 'changes' ? 'changes' : undefined}>{!r.text && <p className="muted">{tr('Без комментария.')}</p>}</CommentBox> });
  }
  for (const a of s.activity) {
    if (a.ref?.kind === 'contribution' && a.ref.id === c.id && a.verb === 'updated') items.push({ at: a.at, key: a.id, node: <EventRow icon={<IconPencil />} actorId={a.actorId} at={a.at}>{g(getUser(s, a.actorId), tr('обновил'), tr('обновила'))} {tr('вклад')}</EventRow> });
  }
  if (closed && c.decidedAt) {
    items.push({ at: c.decidedAt, key: 'decision', node: (
      <EventRow icon={c.status === 'accepted' ? <IconPullMerged /> : <IconPullClosed />} tone={c.status === 'accepted' ? 'done' : 'closed'} actorId={c.decidedBy} at={c.decidedAt}>
        {c.status === 'accepted' ? <>{g(getUser(s, c.decidedBy), tr('принял'), tr('приняла'))} {tr('вклад')}{task && <> {tr('и закрыл задачу')} <Link to={`/p/${p.slug}/issues/${task.number}`}>#{task.number}</Link></>}</> : tr('{x1} вклад без принятия', { x1: g(getUser(s, c.decidedBy), tr('закрыл'), tr('закрыла')) })}
        {c.decisionNote && <span className="ev-note">«{c.decisionNote}»</span>}
      </EventRow>
    ) });
  }
  items.sort((a, b) => a.at - b.at);

  const tabs = [
    { id: 'talk', name: tr('Обсуждение'), icon: <IconComment />, n: c.reviews.length },
    { id: 'files', name: tr('Файлы'), icon: <IconFile />, n: files.length },
    { id: 'checks', name: tr('Проверки'), icon: <IconSpark />, n: shown ? shown.findings.filter((f) => f.level !== 'ok').length : undefined },
  ];

  return (
    <div className="issue pull">
      <header className="ihead">
        <div className="ititle-row">
          <h1 className="ititle">{c.title} <span className="inum">#{c.number}</span></h1>
          {own && !closed && !edit && <button type="button" className="btn btn-sm" onClick={() => setEdit({ summary: c.summary, links: c.links.join('\n') })}>{c.status === 'changes_requested' ? tr('Внести правки') : tr('Править')}</button>}
        </div>
        <div className="imeta">
          <ContribPill c={c} />
          <span>
            <UserLink id={c.authorId} /> {c.status === 'accepted' ? g(getUser(s, c.authorId), tr('внёс вклад'), tr('внесла вклад')) : tr('хочет внести вклад')}
            {task ? <> {tr('в задачу')} <Link to={`/p/${p.slug}/issues/${task.number}`} className="ref-chip"><TaskIcon t={task} />#{task.number} {task.title}</Link></> : tr(' без привязки к задаче')}
          </span>
        </div>
        <nav className="subtabs" aria-label={tr('Разделы вклада')}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setParams(t.id === 'talk' ? {} : { tab: t.id }, { replace: true })}>
              {t.icon}{t.name}{t.n ? <span className="counter">{t.n}</span> : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="igrid">
        <div className="timeline">
          {tab === 'files' && (
            <div className="box">
              <div className="box-head"><span className="box-title">{tn(files.length, '{n} файл или ссылка|{n} файла или ссылки|{n} файлов и ссылок')}</span></div>
              {files.map((f) => (
                <div key={f} className="file-row">
                  {isUrl(f) ? <IconLink className="file-ico" /> : <IconFile className="file-ico" />}
                  {isUrl(f) ? <a href={f} target="_blank" rel="noreferrer noopener" className="file-name">{f.replace(/^https?:\/\//, '')}</a> : <span className="file-name">{f}</span>}
                </div>
              ))}
              {!files.length && <p className="box-empty">{tr('Автор не приложил файлов. В демо файлы передаются ссылками на облако, GitHub или Figma.')}</p>}
            </div>
          )}

          {tab === 'checks' && <Checks check={shown} busy={busy} onRun={run} />}

          {tab === 'talk' && (
            <>
              {edit ? (
                <div className="tl-item tl-comment">
                  <span className="tl-avatar"><Avatar user={getUser(s, c.authorId)} size={36} /></span>
                  <div className="cbox"><div className="composer-body stack">
                    <textarea rows={8} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} aria-label={tr('Описание вклада')} />
                    <label className="field"><span className="field-label">{tr('Файлы и ссылки')}</span><textarea rows={3} value={edit.links} onChange={(e) => setEdit({ ...edit, links: e.target.value })} /></label>
                    <div className="row-end"><button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit(null)}>{tr('Отмена')}</button><button type="button" className="btn btn-sm btn-primary" onClick={saveEdit}>{tr('Сохранить и отправить снова')}</button></div>
                  </div></div>
                </div>
              ) : <CommentBox p={p} authorId={c.authorId} at={c.createdAt} body={c.summary} isAuthor />}

              {items.map((it) => <div key={it.key} className="tl-wrap">{it.node}</div>)}

              {!closed && <MergeBox p={p} c={c} check={shown} goChecks={() => setParams({ tab: 'checks' }, { replace: true })} />}
              {closed && (
                <div className={`final final-${c.status}`}>
                  {c.status === 'accepted' ? <IconPullMerged /> : <IconPullClosed />}
                  <div><strong>{c.status === 'accepted' ? tr('Вклад принят') : tr('Вклад закрыт')}</strong><p className="muted small">{c.status === 'accepted' ? tr('Работа вошла в проект и засчитана в профиль автора.') : tr('Автор может учесть замечания и предложить новый вклад.')}</p></div>
                </div>
              )}

              {!closed && (
                <Composer
                  placeholder={own ? tr('Ответьте на отзывы или расскажите, что изменилось') : tr('Что получилось хорошо, что стоит поправить')}
                  onSubmit={own || !me ? (text) => { if (!me) { openLogin(); return false; } return report(act<ReturnType<typeof reviewContribution>>('reviewContribution', [c.id, 'comment', text, me.id])); } : undefined}
                  actions={(text, clear) => (!own && me ? (
                    <ActionMenu label={tr('Отправить отзыв')} className="btn btn-primary btn-sm" trigger={<>{tr('Отправить отзыв')}</>} align="end" width={300} items={[
                      { label: tr('Комментарий'), hint: tr('общий отзыв без решения'), icon: <IconComment />, onSelect: () => review('comment', text, clear), disabled: !text.trim() },
                      { label: tr('Одобрить'), hint: tr('вклад можно принимать'), icon: <IconCheck />, onSelect: () => review('approve', text, clear) },
                      { label: tr('Попросить правки'), hint: tr('опишите, что поправить'), icon: <IconX />, onSelect: () => review('changes', text, clear), disabled: !text.trim() },
                    ]} />
                  ) : null)}
                />
              )}
            </>
          )}
        </div>

        <aside className="iside">
          <SideSection title={tr('Проверяющие')}>
            <ul className="side-list">
              {reviewers.map((id) => {
                const v = lastVerdict(id);
                return (
                  <li key={id} className="reviewer">
                    <UserLink id={id} avatar />
                    <span className={`rv rv-${v ?? 'none'}`} data-tip={v === 'approve' ? g(getUser(s, id), tr('Одобрил'), tr('Одобрила')) : v === 'changes' ? tr('Просит правки') : v === 'comment' ? g(getUser(s, id), tr('Оставил комментарий'), tr('Оставила комментарий')) : isMaintainer(p, id) ? tr('Сопровождающий, отзыва пока нет') : ''}>
                      {v === 'approve' ? <IconCheck /> : v === 'changes' ? <IconDot /> : v === 'comment' ? <IconComment /> : <IconDot />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </SideSection>
          <SideSection title={tr('Задача')}>
            {task ? <Link to={`/p/${p.slug}/issues/${task.number}`} className="side-pr"><TaskIcon t={task} /><span>{task.title}</span><span className="muted">#{task.number}</span></Link> : <span className="muted">{tr('Без задачи')}</span>}
            {task && c.status !== 'rejected' && <p className="muted small">{c.status === 'accepted' ? tr('Закрыта этим вкладом') : tr('Закроется, когда вклад примут')}</p>}
          </SideSection>
          <SideSection title={tr('Ремесло')}><CraftLabel skill={c.kind} /></SideSection>
          {ms && <SideSection title={tr('Этап')}>{ms.title}</SideSection>}
          {c.areas.length > 0 && (
            <SideSection title={tr('Затрагивает')}><div className="topics">{c.areas.map((a) => <span key={a} className="topic">{a}</span>)}</div></SideSection>
          )}
          <SideSection title={tr('Обновлён')}><span className="muted"><TimeAgo at={c.updatedAt} /></span></SideSection>
          {task && <Link to={`/p/${p.slug}/issues/${task.number}`} className="side-action"><IconIssue />{tr('К обсуждению задачи')}</Link>}
        </aside>
      </div>
    </div>
  );
}
