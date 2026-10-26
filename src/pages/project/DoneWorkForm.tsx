import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isMaintainer, projectContribs, submitDoneWork } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { SIZES, SKILLS, type Project, type Size, type Skill } from '../../data/types';
import { IconCheck, IconFlag } from '../../components/icons';
import { SelectMenu } from '../../components/pop';
import { SideSection } from '../../components/Side';
import { Avatar, CraftLabels, Empty, openLogin, report, useMe } from '../../components/ui';
import { Markdown } from '../../lib/markdown';
import { tr } from '../../i18n';

/** Работа уже сделана: одна форма создаёт задачу и сразу вклад к ней. */
export function DoneWorkForm({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [skills, setSkills] = useState<Skill[]>(me?.skills.slice(0, 1) ?? []);
  const [size, setSize] = useState<Size>('S');
  const [milestoneId, setMilestoneId] = useState<string | undefined>();
  const [links, setLinks] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [area, setArea] = useState('');
  const known = useMemo(() => [...new Set(projectContribs(s, p.id).flatMap((c) => c.areas))], [s, p.id]);

  if (!me) return <Empty title={tr('Войдите, чтобы добавить работу')} action={<button className="btn btn-primary" onClick={openLogin}>{tr('Войти')}</button>} />;
  const ms = p.milestones.find((m) => m.id === milestoneId);
  const addArea = (a: string) => { const v = a.trim(); if (v && !areas.includes(v)) setAreas([...areas, v]); setArea(''); };

  const submit = () => {
    const r = act<ReturnType<typeof submitDoneWork>>('submitDoneWork', [p.id, { title, summary, skills, size, milestoneId, links: links.split('\n'), areas: area.trim() ? [...areas, area] : areas }, me.id]);
    if (report(r, tr('Работа добавлена: задача #{x1} и вклад к ней ждут проверки', { x1: r.ok ? r.value.task.number : '' }))) navigate(`/p/${p.slug}/pulls/${r.value.contribution.number}`);
  };

  return (
    <div className="issue-form">
      <h1 className="h2">{tr('Добавить сделанную работу')}</h1>
      <p className="muted small">
        {tr('Для работы, которую вы уже сделали, а задачи под неё не было. Появится задача в стопке вашего ремесла и вклад к ней.')}
        {isMaintainer(p, me.id) ? tr(' Принять вклад можно по правилу проекта.') : tr(' Когда сопровождающие примут вклад, задача закроется как выполненная.')}
      </p>
      <div className="igrid">
        <div className="timeline">
          <div className="tl-item tl-comment">
            <span className="tl-avatar"><Avatar user={me} size={36} /></span>
            <div className="cbox">
              <div className="composer-body">
                <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Что сделано, коротко: «Иконки погоды для интерфейса»')} aria-label={tr('Название работы')} autoFocus />
              </div>
              <div className="composer-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>{tr('Описание')}</button>
                <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>{tr('Просмотр')}</button>
              </div>
              <div className="composer-body">
                {tab === 'write'
                  ? <textarea rows={8} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label={tr('Описание')} placeholder={tr('Что сделано, зачем это проекту и как проверить результат')} />
                  : <div className="composer-preview">{summary.trim() ? <Markdown text={summary} /> : <p className="muted">{tr('Нечего показать.')}</p>}</div>}
                <label className="field">
                  <span className="field-label">{tr('Файлы и ссылки')}</span>
                  <textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder={tr('По одной на строку: https://… или icons.zip')} />
                  <span className="field-hint">{tr('В демо файлы не загружаются — дайте ссылку на облако, GitHub или Figma.')}</span>
                </label>
                <div className="composer-foot"><span /><button type="button" className="btn btn-primary" onClick={submit}><IconCheck />{tr('Добавить работу')}</button></div>
              </div>
            </div>
          </div>
        </div>
        <aside className="iside">
          <SideSection title={tr('Ремёсла')} menu={() => (
            <SelectMenu<Skill> title={tr('К какому ремеслу относится')} multiple value={skills} options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))}
              onPick={(v) => setSkills(skills.includes(v) ? skills.filter((x) => x !== v) : [...skills, v])} />
          )}>{skills.length ? <CraftLabels skills={skills} /> : <span className="muted">{tr('Выберите хотя бы одно')}</span>}</SideSection>
          {p.milestones.length > 0 && (
            <SideSection title={tr('Этап')} menu={(close) => (
              <SelectMenu title={tr('Этап')} value={milestoneId ?? '__none'} onClose={close} options={[{ value: '__none', label: tr('Без этапа') }, ...p.milestones.map((m) => ({ value: m.id, label: m.title, icon: <IconFlag /> }))]} onPick={(v) => setMilestoneId(v === '__none' ? undefined : v)} />
            )}>{ms ? ms.title : <span className="muted">{tr('Не указан')}</span>}</SideSection>
          )}
          <SideSection title={tr('Объём работы')} menu={(close) => (
            <SelectMenu title={tr('Сколько заняло')} value={size} onClose={close} options={SIZES.map((x) => ({ value: x.id, label: x.id, hint: x.name.split(' — ')[1] }))} onPick={setSize} />
          )}>{SIZES.find((x) => x.id === size)!.name}</SideSection>
          <SideSection title={tr('Затрагивает')}>
            {areas.length > 0 && <div className="topics">{areas.map((a) => <button key={a} type="button" className="topic topic-x" onClick={() => setAreas(areas.filter((x) => x !== a))} aria-label={tr('Убрать «{a}»', { a })}>{a} ×</button>)}</div>}
            <input className="input-sm" value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea(area); } }} placeholder={tr('Например: интерфейс')} aria-label={tr('Часть проекта, которую затрагивает работа')} />
            {known.filter((k) => !areas.includes(k)).length > 0 && (
              <div className="topics topics-suggest">{known.filter((k) => !areas.includes(k)).slice(0, 8).map((k) => <button key={k} type="button" className="topic" onClick={() => addArea(k)}>{k}</button>)}</div>
            )}
          </SideSection>
        </aside>
      </div>
    </div>
  );
}
