import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProject, lastActivity } from '../data/ops';
import { useAppState } from '../data/store';
import { COMMONS_ID } from '../data/seed';
import { SKILLS, type Skill } from '../data/types';
import { FilterMenu } from '../components/pop';
import { ProjectRow } from '../components/ProjectRow';
import { CraftLabels, PriorityMark, TaskIcon } from '../components/ui';
import { Loom, LoomLegend } from '../components/Weave';
import { tn, tr } from '../i18n';

export function Home() {
  const s = useAppState();
  const [skill, setSkill] = useState<Skill | null>(null);

  const active = useMemo(() => [...s.projects].sort((a, b) => lastActivity(s, b) - lastActivity(s, a)).slice(0, 3), [s]);
  const needed = useMemo(() => s.tasks
    .filter((t) => t.status === 'open' && !t.assigneeId && (!skill || t.skills.includes(skill)))
    .sort((a, b) => Number(b.priority === 'high' || b.priority === 'critical') - Number(a.priority === 'high' || a.priority === 'critical') || b.createdAt - a.createdAt)
    .slice(0, 6), [s.tasks, skill]);
  const loomProjects = useMemo(() => [...s.projects].sort((a, b) => s.tasks.filter((t) => t.projectId === b.id).length - s.tasks.filter((t) => t.projectId === a.id).length).slice(0, 6), [s.projects, s.tasks]);
  const accepted = s.contributions.filter((c) => c.status === 'accepted').length;
  const commons = getProject(s, COMMONS_ID);
  const ideas = s.threads.find((t) => t.projectId === COMMONS_ID && t.kind === 'idea');

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <h1 className="display">{tr('Идея одного — работа многих')}</h1>
          <p className="lead">{tr('Открытые проекты, где каждый берёт задачу по своему ремеслу и предлагает вклад, а авторы принимают его в общее дело.')}</p>
          <div className="hero-cta">
            <Link to="/projects" className="btn btn-primary btn-lg">{tr('Найти проект')}</Link>
            <Link to="/projects/new" className="btn btn-lg">{tr('Создать проект')}</Link>
          </div>
          <p className="hero-stats">{tn(s.projects.length, '{n} проект|{n} проекта|{n} проектов')}, {tn(accepted, '{n} принятый вклад|{n} принятых вклада|{n} принятых вкладов')}</p>
        </div>
        <figure className="hero-loom">
          <Loom state={s} projects={loomProjects} />
          <figcaption><span>{tr('Строка — проект, клетка — задача, цвет — ремесло')}</span><LoomLegend /></figcaption>
        </figure>
      </section>

      {commons && (
        <section className="dogfood">
          <div>
            <h2 className="h3">{tr('Commons делается на Commons')}</h2>
            <p className="muted">{tr('Платформа — такой же открытый проект. Предложите идею, возьмите задачу или помогите с переводом.')}</p>
          </div>
          <div className="row-start">
            <Link to={ideas ? `/p/${commons.slug}/talk?thread=${ideas.id}` : `/p/${commons.slug}/talk`} className="btn btn-primary">{tr('Предложить идею')}</Link>
            <Link to={`/p/${commons.slug}/issues`} className="btn">{tr('Задачи платформы')}</Link>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">{tr('Нужна помощь')}</h2>
          <FilterMenu label={tr('Ремесло')} title={tr('Задачи для ремесла')} options={SKILLS.map((x) => ({ value: x.id, label: x.name, icon: <span className="sdot" style={{ background: `var(--sk-${x.id})` }} /> }))} value={skill} onChange={(v) => setSkill(skill === v ? null : v)} align="end" />
        </div>
        <div className="box">
          <ul className="ilist">
            {needed.map((t) => {
              const p = getProject(s, t.projectId)!;
              return (
                <li key={t.id} className="irow">
                  <TaskIcon t={t} />
                  <div className="irow-main">
                    <div className="irow-line">
                      <Link to={`/p/${p.slug}/issues/${t.number}`} className="irow-title">{t.title}</Link>
                      <CraftLabels skills={t.skills} />
                      <PriorityMark priority={t.priority} />
                    </div>
                    <div className="irow-meta"><Link to={`/p/${p.slug}`}>{p.title}</Link> <span>#{t.number}</span></div>
                  </div>
                </li>
              );
            })}
            {!needed.length && <li className="box-empty">{tr('Свободных задач по этому ремеслу пока нет.')}</li>}
          </ul>
        </div>
        <p className="section-more"><Link to="/for-you">{tr('Подобрать задачи под мои навыки')}</Link></p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">{tr('Недавно обновлялись')}</h2>
          <Link to="/projects" className="link-quiet">{tr('Все проекты')}</Link>
        </div>
        <div className="prow-list">{active.map((p) => <ProjectRow key={p.id} s={s} p={p} />)}</div>
      </section>
    </div>
  );
}
