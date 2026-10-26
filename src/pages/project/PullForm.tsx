import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectContribs, projectTasks, submitContribution, taskByNumber } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { SKILLS, type Attachment, type Project, type Skill } from '../../data/types';
import { FileDrop } from '../../components/files';
import { IconIssue, IconPull } from '../../components/icons';
import { Select, SelectMenu } from '../../components/pop';
import { SideSection } from '../../components/Side';
import { Avatar, CraftLabel, Empty, TaskIcon, openLogin, report, useMe } from '../../components/ui';
import { Markdown } from '../../lib/markdown';
import { tr } from '../../i18n';

export function PullForm({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tasks = projectTasks(s, p.id).filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'review');
  const pre = params.get('task') ? taskByNumber(s, p.id, Number(params.get('task'))) : (me ? tasks.find((t) => t.assigneeId === me.id && t.status === 'in_progress') : undefined);
  const [taskId, setTaskId] = useState<string>(pre?.id ?? '__none');
  const task = tasks.find((t) => t.id === taskId);
  const [title, setTitle] = useState(params.get('title') ?? pre?.title ?? '');
  const [summary, setSummary] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [kind, setKind] = useState<Skill>((params.get('kind') as Skill) ?? pre?.skills.find((x) => me?.skills.includes(x)) ?? pre?.skills[0] ?? me?.skills[0] ?? 'code');
  const [links, setLinks] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [area, setArea] = useState('');
  const known = useMemo(() => [...new Set(projectContribs(s, p.id).flatMap((c) => c.areas))], [s, p.id]);

  if (!me) return <Empty title={tr('Войдите, чтобы предложить вклад')} action={<button className="btn btn-primary" onClick={openLogin}>{tr('Войти')}</button>} />;

  const pickTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (t) {
      if (!title.trim()) setTitle(t.title);
      if (!t.skills.includes(kind)) setKind(t.skills.find((x) => me.skills.includes(x)) ?? t.skills[0]);
    }
  };
  const addArea = (a: string) => { const v = a.trim(); if (v && !areas.includes(v)) setAreas([...areas, v]); setArea(''); };

  const submit = () => {
    const r = act<ReturnType<typeof submitContribution>>('submitContribution', [{ projectId: p.id, taskId: task?.id, title, summary, kind, links: links.split('\n'), files, areas: area.trim() ? [...areas, area] : areas }, me.id]);
    if (report(r, tr('Вклад отправлен на проверку'))) navigate(`/p/${p.slug}/pulls/${r.value.contribution.number}`);
  };

  const criteria = task?.description.match(/\*\*Критерии приёмки\*\*[\s\S]*/)?.[0];

  return (
    <div className="issue-form">
      <h1 className="h2">{tr('Предложить вклад')}</h1>
      <div className="compare-bar">
        <IconPull />
        <span className="muted">{tr('к задаче')}</span>
        <Select
          label={tr('Задача')}
          value={taskId}
          title={tr('Какую задачу закрывает вклад')}
          options={[{ value: '__none', label: tr('Без задачи — своя инициатива') }, ...tasks.map((t) => ({ value: t.id, label: `#${t.number} ${t.title}`, hint: t.assigneeId === me.id ? tr('ваша задача') : undefined, icon: <TaskIcon t={t} /> }))]}
          onChange={pickTask}
        />
        {task && <span className="muted small">{tr('закроется, когда вклад примут')}</span>}
      </div>

      <div className="igrid">
        <div className="timeline">
          <div className="tl-item tl-comment">
            <span className="tl-avatar"><Avatar user={me} size={36} /></span>
            <div className="cbox">
              <div className="composer-body">
                <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Что вы сделали, коротко')} aria-label={tr('Название вклада')} />
              </div>
              <div className="composer-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>{tr('Описание')}</button>
                <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>{tr('Просмотр')}</button>
              </div>
              <div className="composer-body">
                {tab === 'write'
                  ? <textarea rows={8} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label={tr('Описание')} placeholder={tr('Что сделано, как проверить, что осталось. Напишите, как выполнены критерии приёмки.')} />
                  : <div className="composer-preview">{summary.trim() ? <Markdown text={summary} /> : <p className="muted">{tr('Нечего показать.')}</p>}</div>}
                <div className="field">
                  <span className="field-label">{tr('Файлы')}</span>
                  <FileDrop value={files} onChange={setFiles} onBusy={setUploading} />
                </div>
                <label className="field">
                  <span className="field-label">{tr('Ссылки')}</span>
                  <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={tr('По одной на строку: GitHub, Figma, облако с большими файлами')} />
                </label>
                <div className="composer-foot"><span /><button type="button" className="btn btn-primary" onClick={submit} disabled={uploading}><IconPull />{tr('Предложить вклад')}</button></div>
              </div>
            </div>
          </div>
          {criteria && (
            <details className="disclosure task-criteria" open>
              <summary><IconIssue />{tr('Критерии приёмки задачи #')}{task!.number}</summary>
              <Markdown text={criteria.replace(tr('**Критерии приёмки**'), '')} />
            </details>
          )}
        </div>
        <aside className="iside">
          <SideSection title={tr('Ремесло')} menu={(close) => (
            <SelectMenu<Skill> title={tr('Ремесло вклада')} value={kind} onClose={close} options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))} onPick={setKind} />
          )}><CraftLabel skill={kind} /></SideSection>
          <SideSection title={tr('Затрагивает')}>
            {areas.length > 0 && <div className="topics">{areas.map((a) => <button key={a} type="button" className="topic topic-x" onClick={() => setAreas(areas.filter((x) => x !== a))} aria-label={tr('Убрать «{a}»', { a })}>{a} ×</button>)}</div>}
            <input className="input-sm" value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea(area); } }} placeholder={tr('Например: погода')} aria-label={tr('Часть проекта, которую затрагивает вклад')} />
            {known.filter((k) => !areas.includes(k)).length > 0 && (
              <div className="topics topics-suggest">{known.filter((k) => !areas.includes(k)).slice(0, 8).map((k) => <button key={k} type="button" className="topic" onClick={() => addArea(k)}>{k}</button>)}</div>
            )}
            <p className="muted small">{tr('По этому полю помощник ищет конфликты с другими вкладами.')}</p>
          </SideSection>
        </aside>
      </div>
    </div>
  );
}
