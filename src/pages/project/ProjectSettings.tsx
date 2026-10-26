import { useState } from 'react';
import { projectMembers, setMaintainers, uid, updateProject } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { ACCEPT_RULES, CATEGORIES, LICENSES, STAGES, type LinkKind, type Milestone, type Project, type ProjectLink, type Skill } from '../../data/types';
import { Avatar, Field, SkillDots, SkillPicker, getUser, report, useMe } from '../../components/ui';
import { Select } from '../../components/pop';
import { CountrySelect, SocialEditor } from '../../components/social';
import { toast } from '../../components/ui';
import type { SocialLink } from '../../data/types';
import { tr } from '../../i18n';

const LINK_KINDS: { id: LinkKind; name: string; placeholder: string }[] = [
  { id: 'github', get name() { return tr('Репозиторий GitHub'); }, placeholder: 'https://github.com/owner/repo' },
  { id: 'figma', get name() { return tr('Макеты в Figma'); }, placeholder: 'https://www.figma.com/file/…' },
  { id: 'engine', get name() { return tr('Движок или основной инструмент'); }, placeholder: 'https://godotengine.org' },
  { id: 'demo', get name() { return tr('Демо-версия'); }, placeholder: 'https://…' },
];

export function ProjectSettings({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe()!;
  const owner = p.ownerId === me.id;
  const [title, setTitle] = useState(p.title);
  const [tagline, setTagline] = useState(p.tagline);
  const [goal, setGoal] = useState(p.goal);
  const [concept, setConcept] = useState(p.concept);
  const [category, setCategory] = useState(p.category);
  const [stage, setStage] = useState(p.stage);
  const [techs, setTechs] = useState(p.techs.join(', '));
  const [roles, setRoles] = useState<Skill[]>(p.rolesNeeded);
  const [license, setLicense] = useState(p.license);
  const [rule, setRule] = useState(p.acceptRule);
  const [forks, setForks] = useState(p.openForForks);
  const [milestones, setMs] = useState<Milestone[]>(p.milestones);
  const [links, setLinks] = useState<Record<LinkKind, ProjectLink>>(() => {
    const base = Object.fromEntries(LINK_KINDS.map((k) => [k.id, { kind: k.id, label: '', url: '' }])) as Record<LinkKind, ProjectLink>;
    for (const l of p.links) base[l.kind] = l;
    return base;
  });
  const [maint, setMaint] = useState<string[]>(p.maintainerIds);
  const [socials, setSocials] = useState<SocialLink[]>(p.socials ?? []);
  const [country, setCountry] = useState(p.country);
  const projectUrl = `${location.origin}${location.pathname}#/p/${p.slug}`;
  const badge = `[![Commons](https://img.shields.io/badge/Commons-${encodeURIComponent(p.title.replace(/-/g, '--'))}-12897c)](${projectUrl})`;

  const save = () => {
    const r = act<ReturnType<typeof updateProject>>('updateProject', [p.id, {
      title, tagline, goal, concept, category, stage, techs: techs.split(',').map((t) => t.trim()).filter(Boolean),
      rolesNeeded: roles, license, openForForks: forks, links: Object.values(links).filter((l) => l.url.trim()),
      milestones: milestones.filter((m) => m.title.trim()), socials, country, ...(owner ? { acceptRule: rule } : {}),
    }, me.id]);
    if (!report(r)) return;
    if (owner && maint.join() !== p.maintainerIds.join()) { if (!report(act<ReturnType<typeof setMaintainers>>('setMaintainers', [p.id, maint, me.id]))) return; }
    report({ ok: true, value: null }, tr('Настройки сохранены'));
  };

  const members = projectMembers(s, p);

  return (
    <form className="settings stack-lg" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className="stack">
        <h2 className="h3">{tr('Описание')}</h2>
        <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={tr('Одной строкой')}><input value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
        <Field label={tr('Цель')}><textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
        <Field label={tr('Концепция')} hint="Markdown"><textarea rows={8} value={concept} onChange={(e) => setConcept(e.target.value)} /></Field>
        <div className="form-grid">
          <div className="field"><span className="field-label">{tr('Категория')}</span><Select label={tr('Категория')} block value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} /></div>
          <div className="field"><span className="field-label">{tr('Стадия')}</span><Select label={tr('Стадия')} block value={stage} onChange={setStage} options={STAGES.map((c) => ({ value: c.id, label: c.name, hint: c.hint }))} /></div>
        </div>
        <Field label={tr('Инструменты и технологии')} hint={tr('Через запятую')}><input value={techs} onChange={(e) => setTechs(e.target.value)} /></Field>
        <div className="field"><span className="field-label">{tr('Кого ищете')}</span><SkillPicker value={roles} onChange={setRoles} /></div>
        <CountrySelect value={country} onChange={setCountry} label={tr('Страна, где появился проект')} />
      </section>

      <section className="stack">
        <h2 className="h3">{tr('Соцсети проекта')}</h2>
        <p className="muted small">{tr('Ссылки появятся на странице проекта — туда участники и зрители смогут подписаться.')}</p>
        <SocialEditor value={socials} onChange={setSocials} scope="project" />
      </section>

      <section className="stack">
        <h2 className="h3">{tr('План')}</h2>
        <ol className="ms-edit">
          {milestones.map((m, i) => (
            <li key={m.id}>
              <span className="plan-n" aria-hidden>{i + 1}</span>
              <div className="ms-fields">
                <input value={m.title} onChange={(e) => setMs(milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} aria-label={tr('Этап {x1}: название', { x1: i + 1 })} placeholder={tr('Название этапа')} />
                <input value={m.description} onChange={(e) => setMs(milestones.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))} aria-label={tr('Этап {x1}: что будет готово', { x1: i + 1 })} placeholder={tr('Что будет готово в конце')} />
              </div>
              <div className="ms-btns">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => { const a = [...milestones]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setMs(a); }} aria-label={tr('Выше')}>↑</button>
                <button type="button" className="icon-btn" onClick={() => setMs(milestones.filter((x) => x.id !== m.id))} aria-label={tr('Убрать этап')}>×</button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-sm" onClick={() => setMs([...milestones, { id: uid('m'), title: '', description: '' }])}>{tr('Добавить этап')}</button>
      </section>

      <section className="stack">
        <h2 className="h3">{tr('Интеграции')}</h2>
        <p className="muted small">{tr('GitHub подключается напрямую: на странице проекта появятся последние изменения публичного репозитория.')}</p>
        <p className="muted small">{tr('Ссылку на YouTube, Figma, Sketchfab, SoundCloud или Spotify отдельной строкой в документах и объявлениях покажем встроенным плеером.')}</p>
        {LINK_KINDS.map((k) => (
          <Field key={k.id} label={k.name}>
            <input value={links[k.id].url} placeholder={k.placeholder} onChange={(e) => setLinks({ ...links, [k.id]: { ...links[k.id], url: e.target.value, label: links[k.id].label || '' } })} />
          </Field>
        ))}
      </section>

      <section className="stack">
        <h2 className="h3">{tr('Значок для README')}</h2>
        <p className="muted small">{tr('Вставьте в README репозитория — по значку люди найдут проект на Commons.')}</p>
        <div className="copy-row"><code className="copy-code">{badge}</code><button type="button" className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(badge); toast(tr('Скопировано')); } catch { toast(tr('Не удалось скопировать'), 'error'); } }}>{tr('Копировать')}</button></div>
      </section>

      <section className="stack">
        <h2 className="h3">{tr('Правила')}</h2>
        <fieldset className="radio-list" disabled={!owner}>
          <legend className="field-label">{tr('Кто принимает вклады')}{!owner && tr(' — меняет только автор')}</legend>
          {ACCEPT_RULES.map((r) => (
            <label key={r.id} className="radio"><input type="radio" name="rule" checked={rule === r.id} onChange={() => setRule(r.id)} /><span><strong>{r.name}</strong><span className="muted small">{r.hint}</span></span></label>
          ))}
        </fieldset>
        <div className="field"><span className="field-label">{tr('Лицензия')}</span><Select label={tr('Лицензия')} block value={license} onChange={setLicense} options={LICENSES.map((l) => ({ value: l, label: tr(l) }))} /><span className="field-hint">{tr('На каких условиях другие могут использовать результат')}</span></div>
        <label className="check"><input type="checkbox" checked={forks} onChange={(e) => setForks(e.target.checked)} /><span>{tr('Разрешить ответвления — любой сможет развивать свою копию проекта')}</span></label>
      </section>

      {owner && (
        <section className="stack">
          <h2 className="h3">{tr('Сопровождающие')}</h2>
          <p className="muted small">{tr('Сопровождающие открывают задачи, правят документы и принимают вклады по правилу проекта.')}</p>
          <ul className="people">
            {members.map((id) => {
              const u = getUser(s, id)!;
              return (
                <li key={id}>
                  <Avatar user={u} size={30} />
                  <label className="check"><input type="checkbox" checked={maint.includes(id)} disabled={id === p.ownerId} onChange={() => setMaint(maint.includes(id) ? maint.filter((x) => x !== id) : [...maint, id])} /><span>{u.name}{id === p.ownerId && tr(' — автор')}</span></label>
                  <SkillDots skills={u.skills} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="row-end sticky-save"><button type="submit" className="btn btn-primary">{tr('Сохранить настройки')}</button></div>
    </form>
  );
}
