import { Link } from 'react-router-dom';
import { getProject, getUser, lastActivity, projectTasks } from '../data/ops';
import { STAGES, isClosed, skillInfo, type Project, type Skill, type State } from '../data/types';
import { IconEye, IconFork, IconIssue } from './icons';
import { TimeAgo } from './Timeline';
import { tr } from '../i18n';
import { Flag } from './social';
import { countryName } from '../lib/countries';

/** Основное ремесло проекта — по числу задач, как язык репозитория на GitHub. */
export function mainCraft(s: State, p: Project): Skill | undefined {
  const m = new Map<Skill, number>();
  for (const t of projectTasks(s, p.id)) for (const sk of t.skills) m.set(sk, (m.get(sk) ?? 0) + 1 / t.skills.length);
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function ProjectRow({ s, p }: { s: State; p: Project }) {
  const owner = getUser(s, p.ownerId);
  const free = projectTasks(s, p.id).filter((t) => t.status === 'open' && !t.assigneeId && !isClosed(t)).length;
  const parent = p.forkOf ? getProject(s, p.forkOf) : undefined;
  const craft = mainCraft(s, p);
  const forks = s.projects.filter((x) => x.forkOf === p.id).length;
  return (
    <article className="prow">
      <div className="prow-head">
        <h3 className="prow-title"><Link to={`/p/${p.slug}`}><span className="muted">{owner?.handle} /</span> {p.title}</Link></h3>
        <span className="stage-chip" data-stage={p.stage}>{STAGES.find((x) => x.id === p.stage)!.name}</span>
      </div>
      {parent && <p className="prow-fork">{tr('ответвление от')} {parent.title}</p>}
      <p className="prow-tagline">{p.tagline}</p>
      {p.techs.length > 0 && <div className="topics">{p.techs.map((t) => <span key={t} className="topic">{t}</span>)}</div>}
      <p className="prow-meta">
        {p.country && <span data-tip={countryName(p.country)}><Flag code={p.country} size={11} />{countryName(p.country)}</span>}
        {craft && <span><span className="sdot" style={{ background: `var(--sk-${craft})` }} />{skillInfo(craft).name}</span>}
        <span data-tip={tr('Следят за проектом')}><IconEye />{p.followerIds.length}</span>
        {forks > 0 && <span data-tip={tr('Ответвления')}><IconFork />{forks}</span>}
        {free > 0 && <Link to={`/p/${p.slug}/issues?free=1`} className="prow-free"><IconIssue />{free} {tr('свободных задач')}</Link>}
        <span>{tr('обновлён')} <TimeAgo at={lastActivity(s, p)} /></span>
      </p>
    </article>
  );
}
