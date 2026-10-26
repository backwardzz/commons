import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { lastActivity, projectProgress, projectTasks } from '../data/ops';
import { useAppState } from '../data/store';
import { CATEGORIES, SKILLS, STAGES, type Category, type Skill, type Stage } from '../data/types';
import { IconSearch } from '../components/icons';
import { FilterMenu } from '../components/pop';
import { ProjectRow } from '../components/ProjectRow';
import { Empty } from '../components/ui';
import { plain } from '../lib/markdown';
import { tn, tr } from '../i18n';
import { projectCountries } from '../data/community';
import { countryName } from '../lib/countries';
import { Flag } from '../components/social';

type Sort = 'active' | 'new' | 'help' | 'progress';

export function Catalog() {
  const s = useAppState();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') as Category | null;
  const stage = params.get('stage') as Stage | null;
  const role = params.get('role') as Skill | null;
  const tech = params.get('tech');
  const country = params.get('country');
  const sort = (params.get('sort') as Sort) ?? 'active';

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const techs = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of s.projects) for (const t of p.techs) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [s.projects]);

  // страны: откуда проект и откуда его участники
  const countriesOf = useMemo(() => new Map(s.projects.map((p) => [p.id, new Set([p.country, ...projectCountries(s, p).map((c) => c.code)].filter(Boolean) as string[])])), [s]);
  const allCountries = useMemo(() => [...new Set([...countriesOf.values()].flatMap((x) => [...x]))].sort((a, b) => countryName(a).localeCompare(countryName(b))), [countriesOf]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const res = s.projects.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (stage && p.stage !== stage) return false;
      if (tech && !p.techs.includes(tech)) return false;
      if (country && !countriesOf.get(p.id)?.has(country)) return false;
      if (role && !p.rolesNeeded.includes(role) && !projectTasks(s, p.id).some((t) => t.status === 'open' && t.skills.includes(role))) return false;
      if (needle) {
        const hay = `${p.title} ${p.tagline} ${p.goal} ${plain(p.concept)} ${p.techs.join(' ')}`.toLowerCase();
        if (!needle.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const free = (id: string) => s.tasks.filter((t) => t.projectId === id && t.status === 'open' && !t.assigneeId).length;
    return res.sort((a, b) => {
      if (sort === 'new') return b.createdAt - a.createdAt;
      if (sort === 'help') return free(b.id) - free(a.id);
      if (sort === 'progress') return projectProgress(s, b).ratio - projectProgress(s, a).ratio;
      return lastActivity(s, b) - lastActivity(s, a);
    });
  }, [s, q, cat, stage, tech, role, sort, country, countriesOf]);

  const filtered = !!(cat || stage || role || tech || q || country);

  return (
    <div className="page catalog">
      <div className="catalog-head">
        <h1 className="h1">{tr('Проекты')}</h1>
        <label className="search-field search-lg">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => set('q', e.target.value || null)} placeholder={tr('Поиск по названию, цели, инструментам')} aria-label={tr('Поиск проектов')} />
        </label>
      </div>
      <div className="catalog-bar">
        <span className="muted">{tn(list.length, '{n} проект|{n} проекта|{n} проектов')}</span>
        <div className="filters-row">
          <FilterMenu label={tr('Категория')} title={tr('Категория')} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} value={cat} onChange={(v) => set('cat', cat === v ? null : v)} />
          <FilterMenu label={tr('Стадия')} title={tr('Стадия')} options={STAGES.map((x) => ({ value: x.id, label: x.name, hint: x.hint }))} value={stage} onChange={(v) => set('stage', stage === v ? null : v)} />
          <FilterMenu label={tr('Ищут')} title={tr('Кого ищут')} options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))} value={role} onChange={(v) => set('role', role === v ? null : v)} />
          <FilterMenu label={tr('Инструмент')} title={tr('Инструменты')} options={techs.map((t) => ({ value: t, label: t }))} value={tech} onChange={(v) => set('tech', tech === v ? null : v)} />
          {allCountries.length > 0 && <FilterMenu label={tr('Страна')} title={tr('Откуда проект и участники')} options={allCountries.map((c) => ({ value: c, label: countryName(c), icon: <Flag code={c} size={11} /> }))} value={country} onChange={(v) => set('country', country === v ? null : v)} />}
          <FilterMenu label={tr('Сортировка')} title={tr('Порядок')} align="end" options={[
            { value: 'active', label: tr('Недавно обновлённые') }, { value: 'help', label: tr('Больше свободных задач') }, { value: 'progress', label: tr('Ближе к готовности') }, { value: 'new', label: tr('Новые') },
          ]} value={sort} onChange={(v) => set('sort', v === 'active' ? null : v)} />
          {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>{tr('Сбросить')}</button>}
        </div>
      </div>
      {list.length ? (
        <div className="prow-list">{list.map((p) => <ProjectRow key={p.id} s={s} p={p} />)}</div>
      ) : (
        <Empty title={tr('Под эти условия проектов нет')} action={<Link to="/projects/new" className="btn btn-primary">{tr('Создать свой проект')}</Link>}>
          {tr('Ослабьте фильтры или начните проект сами — участники с нужными навыками найдут его здесь.')}
        </Empty>
      )}
    </div>
  );
}
