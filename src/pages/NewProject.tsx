import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, type NewProject as NewProjectInput } from '../data/ops';
import { act, getState, useAppState } from '../data/store';
import { ACCEPT_RULES, CATEGORIES, LICENSES, PRIORITIES, SIZES, STAGES, type AcceptRule, type Category, type Priority, type Size, type Skill, type Stage } from '../data/types';
import { EngineBadge } from '../components/AiPanel';
import { Field, SkillDots, SkillPicker, openLogin, report, useMe } from '../components/ui';
import { askConcept, askDecompose, type AiAnswer } from '../lib/ai';
import { Markdown } from '../lib/markdown';
import { Select } from '../components/pop';
import { tn, tr } from '../i18n';
import { CountrySelect } from '../components/social';

const DEFAULT_MS = (): Record<Category, string[]> => ({
  game: [tr('Прототип механик'), tr('Вертикальный срез'), tr('Открытая бета')],
  software: [tr('Прототип'), tr('Первая версия'), tr('Публичная бета')],
  education: [tr('Программа'), tr('Первые уроки'), tr('Пилот с учениками')],
  art: [tr('Эскизы и стиль'), tr('Производство'), tr('Показ')],
  audio: [tr('Первые записи'), tr('Библиотека'), tr('Публикация')],
  other: [tr('Прототип'), tr('Первая версия'), tr('Запуск')],
});

type DraftRow = { title: string; description: string; skills: Skill[]; priority: Priority; size: Size; milestoneIndex?: number; on: boolean };

const STEPS = () => [tr('Замысел'), tr('Концепция'), tr('План'), tr('Правила')];

export default function NewProject() {
  useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<Category>('game');
  const [goal, setGoal] = useState('');
  const [concept, setConcept] = useState('');
  const [techs, setTechs] = useState('');
  const [roles, setRoles] = useState<Skill[]>([]);
  const [stage, setStage] = useState<Stage>('idea');
  const [milestones, setMilestones] = useState<{ title: string; description: string }[] | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [license, setLicense] = useState('MIT');
  const [rule, setRule] = useState<AcceptRule>('maintainers');
  const [forks, setForks] = useState(true);
  const [country, setCountry] = useState<string | undefined>(me?.country);
  const [conceptAi, setConceptAi] = useState<AiAnswer | null>(null);
  const [busy, setBusy] = useState<'concept' | 'tasks' | null>(null);
  const [stream, setStream] = useState('');
  const [aiNote, setAiNote] = useState('');
  const [error, setError] = useState('');

  const ms = milestones ?? DEFAULT_MS()[category].map((t) => ({ title: t, description: '' }));

  const helpConcept = async () => {
    setBusy('concept'); setConceptAi(null); setStream('');
    setConceptAi(await askConcept(getState(), { title, goal, category, rolesNeeded: roles }, setStream));
    setBusy(null);
  };

  const helpTasks = async () => {
    setBusy('tasks');
    const r = await askDecompose(getState(), { goal: `${goal}\n${concept}`, category, title });
    setDrafts(r.drafts.map((d) => ({ ...d, on: true, milestoneIndex: Math.max(0, ms.findIndex((m) => m.title === d.milestone)) })));
    setAiNote([r.warning, r.note].filter(Boolean).join(' '));
    setBusy(null);
  };

  const validate = (i: number): string => {
    if (i === 0) {
      if (title.trim().length < 3) return tr('Назовите проект — хотя бы три символа');
      if (goal.trim().length < 10) return tr('Опишите цель: ради чего делать этот проект');
    }
    if (i === 1 && !roles.length) return tr('Отметьте, кого вы ищете, — по этим навыкам проект найдут участники');
    return '';
  };

  const next = () => {
    const e = validate(step);
    setError(e);
    if (!e) setStep(step + 1);
  };

  const publish = () => {
    if (!me) return openLogin();
    const input: NewProjectInput = {
      title, tagline, category, stage, goal, concept, rolesNeeded: roles,
      techs: techs.split(',').map((t) => t.trim()).filter(Boolean),
      milestones: ms, license, acceptRule: rule, openForForks: forks, country,
      tasks: drafts.filter((d) => d.on).map((d) => ({ title: d.title, description: d.description, skills: d.skills, priority: d.priority, size: d.size, milestoneIndex: d.milestoneIndex })),
    };
    const r = act<ReturnType<typeof createProject>>('createProject', [input, me.id]);
    if (report(r, tr('Проект опубликован. Теперь его видят все участники.'))) navigate(`/p/${r.value.project.slug}`);
  };

  return (
    <div className="page narrow new-project">
      <h1 className="h1">{tr('Новый проект')}</h1>
      <p className="lead-sm">{tr('Опишите замысел — дальше подключатся люди с нужными навыками. Всё можно поменять после публикации.')}</p>
      {!me && <p className="note">{tr('Чтобы опубликовать проект, нужно')} <button type="button" className="link-btn" onClick={openLogin}>{tr('войти или создать профиль')}</button>{tr('. Заполнять можно уже сейчас.')}</p>}

      <ol className="wizard-steps" aria-label={tr('Шаги')}>
        {STEPS().map((st, i) => (
          <li key={st} className={i === step ? 'is-now' : i < step ? 'is-past' : ''} aria-current={i === step ? 'step' : undefined}>
            <button type="button" onClick={() => { if (i < step) setStep(i); }} disabled={i > step}><span className="plan-n">{i + 1}</span>{st}</button>
          </li>
        ))}
      </ol>

      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else publish(); }}>
        {step === 0 && (
          <>
            <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Например, «Тихая гавань»')} /></Field>
            <Field label={tr('Одной строкой')} hint={tr('Что это, чтобы было понятно из каталога')}><input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={tr('Уютная кооперативная игра о смотрителях маяка')} /></Field>
            <div className="field">
              <span className="field-label">{tr('Категория')}</span>
              <div className="seg seg-wrap" role="radiogroup" aria-label={tr('Категория')}>
                {CATEGORIES.map((c) => <button key={c.id} type="button" role="radio" aria-checked={category === c.id} className={category === c.id ? 'is-on' : ''} onClick={() => setCategory(c.id)}>{c.name}</button>)}
              </div>
            </div>
            <Field label={tr('Цель')} hint={tr('Что должно получиться и для кого. Чем конкретнее, тем точнее помощник разобьёт её на задачи.')}>
              <textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={tr('Сделать небольшую законченную игру для 2–4 игроков, которую можно пройти с друзьями за пару вечеров…')} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="field"><span className="field-label">{tr('Кого вы ищете')}</span><SkillPicker value={roles} onChange={setRoles} /></div>
            <CountrySelect value={country} onChange={setCountry} label={tr('Страна, где появился проект')} />
            <Field label={tr('Концепция')} hint={tr('Зачем, для кого, как работает, чем отличается. Markdown поддерживается.')}>
              <textarea rows={10} value={concept} onChange={(e) => setConcept(e.target.value)} />
            </Field>
            <div className="helper">
              <div className="helper-head">
                <button type="button" className="btn btn-sm" onClick={helpConcept} disabled={busy === 'concept'}>{busy === 'concept' ? tr('Пишу черновик…') : tr('Помочь сформулировать концепцию')}</button>
                <EngineBadge />
              </div>
              {busy === 'concept' && stream && <div className="helper-out"><Markdown text={stream} /></div>}
              {conceptAi && (
                <div className="helper-out">
                  {conceptAi.warning && <p className="ai-warn">{conceptAi.warning}</p>}
                  <Markdown text={conceptAi.text} />
                  <div className="row-end">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConceptAi(null)}>{tr('Не нужно')}</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setConcept(conceptAi.text); setConceptAi(null); }}>{tr('Взять за основу')}</button>
                  </div>
                </div>
              )}
            </div>
            <div className="form-grid">
              <Field label={tr('Инструменты и технологии')} hint={tr('Через запятую')}><input value={techs} onChange={(e) => setTechs(e.target.value)} placeholder="Godot 4, Blender" /></Field>
              <div className="field"><span className="field-label">{tr('Стадия')}</span><Select label={tr('Стадия')} block value={stage} onChange={setStage} options={STAGES.map((x) => ({ value: x.id, label: x.name, hint: x.hint }))} /></div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <span className="field-label">{tr('Этапы')}</span>
              <ol className="ms-edit">
                {ms.map((m, i) => (
                  <li key={i}>
                    <span className="plan-n" aria-hidden>{i + 1}</span>
                    <div className="ms-fields">
                      <input value={m.title} onChange={(e) => setMilestones(ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={tr('Этап {x1}', { x1: i + 1 })} />
                      <input value={m.description} placeholder={tr('Что будет готово в конце этапа')} onChange={(e) => setMilestones(ms.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} aria-label={tr('Этап {x1}: результат', { x1: i + 1 })} />
                    </div>
                    <div className="ms-btns"><button type="button" className="icon-btn" onClick={() => setMilestones(ms.filter((_, j) => j !== i))} aria-label={tr('Убрать этап')}>×</button></div>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn-sm" onClick={() => setMilestones([...ms, { title: '', description: '' }])}>{tr('Добавить этап')}</button>
            </div>
            <div className="field">
              <div className="field-row"><span className="field-label">{tr('Первые задачи')}</span><EngineBadge /></div>
              <p className="muted small">{tr('Помощник разобьёт цель на задачи для разных специалистов. Выберите подходящие — остальное участники предложат сами.')}</p>
              <button type="button" className="btn btn-sm" onClick={helpTasks} disabled={busy === 'tasks'}>{busy === 'tasks' ? tr('Разбиваю цель…') : drafts.length ? tr('Предложить заново') : tr('Разбить цель на задачи')}</button>
              {aiNote && <p className="muted small">{aiNote}</p>}
              {drafts.length > 0 && (
                <ul className="drafts">
                  {drafts.map((d, i) => (
                    <li key={i} className={d.on ? '' : 'is-off'}>
                      <input type="checkbox" checked={d.on} onChange={() => setDrafts(drafts.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} aria-label={tr('Добавить «{title}»', { title: d.title })} />
                      <div>
                        <input className="draft-title" value={d.title} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={tr('Заголовок задачи')} />
                        <div className="draft-meta">
                          <SkillDots skills={d.skills} />
                          <Select label={tr('Размер')} small prefix={tr('Размер')} value={d.size} onChange={(v: Size) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, size: v } : x)))} options={SIZES.map((x) => ({ value: x.id, label: x.id, hint: x.name.split(' — ')[1] }))} />
                          <Select label={tr('Приоритет')} small value={d.priority} onChange={(v: Priority) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, priority: v } : x)))} options={PRIORITIES.map((x) => ({ value: x.id, label: x.name }))} />
                          <Select label={tr('Этап')} small value={String(d.milestoneIndex ?? 0)} onChange={(v) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, milestoneIndex: Number(v) } : x)))} options={ms.map((m, j) => ({ value: String(j), label: m.title || tr('Этап {x1}', { x1: j + 1 }) }))} />
                        </div>
                        <details><summary className="small">{tr('Описание')}</summary><Markdown text={d.description} /></details>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <fieldset className="radio-list">
              <legend className="field-label">{tr('Кто принимает вклады')}</legend>
              {ACCEPT_RULES.map((r) => (
                <label key={r.id} className="radio"><input type="radio" name="rule" checked={rule === r.id} onChange={() => setRule(r.id)} /><span><strong>{r.name}</strong><span className="muted small">{r.hint}</span></span></label>
              ))}
            </fieldset>
            <div className="field"><span className="field-label">{tr('Лицензия')}</span><Select label={tr('Лицензия')} block value={license} onChange={setLicense} options={LICENSES.map((l) => ({ value: l, label: tr(l) }))} /><span className="field-hint">{tr('На каких условиях другие могут использовать результат. Для кода чаще MIT, для искусства — CC BY.')}</span></div>
            <label className="check"><input type="checkbox" checked={forks} onChange={(e) => setForks(e.target.checked)} /><span>{tr('Разрешить ответвления — любой сможет развивать свою копию проекта')}</span></label>
            <div className="summary-box">
              <p><strong>{title || tr('Без названия')}</strong> — {CATEGORIES.find((c) => c.id === category)!.name.toLowerCase()}, {tn(ms.length, '{n} этап|{n} этапа|{n} этапов')}, {tn(drafts.filter((d) => d.on).length, '{n} задача|{n} задачи|{n} задач')} {tr('на старте.')}</p>
              <p className="muted small">{tr('После публикации проект появится в каталоге. Вы станете автором и сопровождающим.')}</p>
            </div>
          </>
        )}

        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="row-between wizard-nav">
          {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(step - 1); }}>{tr('Назад')}</button> : <span />}
          {step < 3 ? <button type="submit" className="btn btn-primary">{tr('Дальше')}</button> : <button type="submit" className="btn btn-primary">{me ? tr('Опубликовать проект') : tr('Войти и опубликовать')}</button>}
        </div>
      </form>
    </div>
  );
}
