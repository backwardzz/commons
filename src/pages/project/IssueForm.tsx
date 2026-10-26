import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addTask, isMaintainer, projectTasks } from '../../data/ops';
import { act, getState, useAppState } from '../../data/store';
import { PRIORITIES, SIZES, SKILLS, isClosed, type Priority, type Project, type Size, type Skill, type TaskType } from '../../data/types';
import { EngineBadge } from '../../components/AiPanel';
import { IconFlag, IconSpark } from '../../components/icons';
import { SelectMenu } from '../../components/pop';
import { SideSection } from '../../components/Side';
import { Avatar, CraftLabels, Empty, PriorityMark, openLogin, report, useMe } from '../../components/ui';
import { askText, type AiAnswer } from '../../lib/ai';
import { Markdown } from '../../lib/markdown';
import { tr } from '../../i18n';

const TYPES: { id: TaskType; name: string; hint: string }[] = [
  { id: 'task', get name() { return tr('Задача'); }, get hint() { return tr('работа, которую нужно сделать'); } },
  { id: 'bug', get name() { return tr('Ошибка'); }, get hint() { return tr('что-то работает не так'); } },
  { id: 'idea', name: tr('Идея'), hint: tr('предложение, которое стоит обсудить') },
];

export function IssueForm({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [type, setType] = useState<TaskType>(params.get('type') === 'bug' ? 'bug' : 'task');
  const [skills, setSkills] = useState<Skill[]>(params.get('type') === 'bug' ? ['code', 'qa'] : []);
  const [milestoneId, setMilestoneId] = useState<string | undefined>();
  const [priority, setPriority] = useState<Priority>('normal');
  const [size, setSize] = useState<Size>('M');
  const [deps, setDeps] = useState<string[]>([]);
  const [ai, setAi] = useState<AiAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');

  if (!me) return <Empty title={tr('Войдите, чтобы предложить задачу')} action={<button className="btn btn-primary" onClick={openLogin}>{tr('Войти')}</button>} />;
  const maint = isMaintainer(p, me.id);
  const open = projectTasks(s, p.id).filter((t) => !isClosed(t));
  const ms = p.milestones.find((m) => m.id === milestoneId);

  const spec = async () => {
    setBusy(true); setAi(null); setStream('');
    setAi(await askText(getState(), p.id, { kind: 'spec', title, description: body, skills, milestoneId }, setStream));
    setBusy(false);
  };

  const submit = () => {
    const r = act<ReturnType<typeof addTask>>('addTask', [p.id, { title, description: body, skills, priority, size, type, milestoneId, dependsOn: deps }, me.id]);
    if (report(r, maint ? tr('Задача #{x1} создана', { x1: r.ok ? r.value.task.number : '' }) : tr('Задача предложена — сопровождающие её посмотрят'))) navigate(`/p/${p.slug}/issues/${r.value.task.number}`);
  };

  return (
    <div className="issue-form">
      <h1 className="h2">{type === 'bug' ? tr('Сообщить об ошибке') : maint ? tr('Новая задача') : tr('Предложить задачу')}</h1>
      {!maint && <p className="muted small">{tr('Задача появится как предложенная. Сопровождающие решат, открыть ли её для всех.')}</p>}
      <div className="igrid">
        <div className="timeline">
          <div className="tl-item tl-comment">
            <span className="tl-avatar"><Avatar user={me} size={36} /></span>
            <div className="cbox">
              <div className="composer-body">
                <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'bug' ? tr('Что именно не работает') : tr('Заголовок: «Сделать…», «Нарисовать…», «Описать…»')} aria-label={tr('Заголовок')} autoFocus />
              </div>
              <div className="composer-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>{tr('Описание')}</button>
                <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>{tr('Просмотр')}</button>
              </div>
              <div className="composer-body">
                {tab === 'write'
                  ? <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} aria-label={tr('Описание')} placeholder={type === 'bug' ? tr('Шаги, что ожидали, что получилось, версия и устройство') : tr('Что нужно сделать, зачем и как понять, что готово')} />
                  : <div className="composer-preview">{body.trim() ? <Markdown text={body} /> : <p className="muted">{tr('Нечего показать.')}</p>}</div>}
                <div className="composer-foot">
                  <button type="button" className="btn btn-sm" onClick={spec} disabled={busy || title.trim().length < 4} data-tip={title.trim().length < 4 ? tr('Сначала напишите заголовок') : tr('Помощник предложит описание с критериями приёмки')}><IconSpark />{busy ? tr('Пишу задание…') : tr('Сформулировать ТЗ')}</button>
                  <button type="button" className="btn btn-primary" onClick={submit}>{maint ? tr('Создать задачу') : tr('Предложить задачу')}</button>
                </div>
              </div>
            </div>
          </div>
          {(busy || ai) && (
            <div className="tl-item tl-comment">
              <span className="tl-avatar tl-ai"><IconSpark /></span>
              <div className="cbox">
                <div className="cbox-head"><strong>{tr('Помощник')}</strong><EngineBadge engine={busy ? undefined : ai?.engine} /></div>
                <div className="cbox-body">
                  {ai?.warning && <p className="ai-warn">{ai.warning}</p>}
                  <Markdown text={busy ? stream || tr('Собираю требования из документов проекта…') : ai?.text ?? ''} />
                  {ai && !busy && <div className="row-end"><button type="button" className="btn btn-sm btn-ghost" onClick={() => setAi(null)}>{tr('Не нужно')}</button><button type="button" className="btn btn-sm btn-primary" onClick={() => { setBody(ai.text); setAi(null); setTab('write'); }}>{tr('Вставить в описание')}</button></div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="iside">
          <SideSection title={tr('Тип')} menu={(close) => (
            <SelectMenu title={tr('Тип')} value={type} onClose={close} options={TYPES.map((x) => ({ value: x.id, label: x.name, hint: x.hint }))} onPick={setType} />
          )}>{TYPES.find((x) => x.id === type)!.name}</SideSection>
          <SideSection title={tr('Ремёсла')} menu={() => (
            <SelectMenu<Skill> title={tr('Какие навыки нужны')} multiple value={skills} options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))}
              onPick={(v) => setSkills(skills.includes(v) ? skills.filter((x) => x !== v) : [...skills, v])} />
          )}>{skills.length ? <CraftLabels skills={skills} /> : <span className="muted">{tr('Выберите хотя бы одно')}</span>}</SideSection>
          {p.milestones.length > 0 && (
            <SideSection title={tr('Этап')} menu={(close) => (
              <SelectMenu title={tr('Этап')} value={milestoneId ?? '__none'} onClose={close} options={[{ value: '__none', label: tr('Без этапа') }, ...p.milestones.map((m) => ({ value: m.id, label: m.title, icon: <IconFlag /> }))]} onPick={(v) => setMilestoneId(v === '__none' ? undefined : v)} />
            )}>{ms ? ms.title : <span className="muted">{tr('Не указан')}</span>}</SideSection>
          )}
          <SideSection title={tr('Приоритет')} menu={(close) => (
            <SelectMenu title={tr('Приоритет')} value={priority} onClose={close} options={PRIORITIES.map((x) => ({ value: x.id, label: x.name }))} onPick={setPriority} />
          )}><span className="row-start"><PriorityMark priority={priority} />{(priority === 'normal' || priority === 'low') && PRIORITIES.find((x) => x.id === priority)!.name}</span></SideSection>
          <SideSection title={tr('Размер')} menu={(close) => (
            <SelectMenu title={tr('Сколько займёт')} value={size} onClose={close} options={SIZES.map((x) => ({ value: x.id, label: x.id, hint: x.name.split(' — ')[1] }))} onPick={setSize} />
          )}>{SIZES.find((x) => x.id === size)!.name}</SideSection>
          {open.length > 0 && (
            <SideSection title={tr('Ждёт задачи')} menu={() => (
              <SelectMenu title={tr('От каких задач зависит')} multiple value={deps} options={open.map((t) => ({ value: t.id, label: `#${t.number} ${t.title}` }))} onPick={(v) => setDeps(deps.includes(v) ? deps.filter((x) => x !== v) : [...deps, v])} />
            )} menuWidth={340}>{deps.length ? open.filter((t) => deps.includes(t.id)).map((t) => `#${t.number}`).join(', ') : <span className="muted">{tr('Ни от каких')}</span>}</SideSection>
          )}
        </aside>
      </div>
    </div>
  );
}
