import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser, isMaintainer, milestoneProgress, projectMembers, projectTasks } from '../../data/ops';
import { useAppState } from '../../data/store';
import { SKILLS, isClosed, type Project, type Skill } from '../../data/types';
import { IconBook, IconEye, IconFile, IconFork, IconGlobe, IconLink, IconPencil, IconPlus, IconTag } from '../../components/icons';
import { TimeAgo } from '../../components/Timeline';
import { Avatar, AvatarStack, CraftLabel, Progress, StageMeter, UserLink, useMe } from '../../components/ui';
import { g, gverb } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { tn, tr } from '../../i18n';
import { activityText } from '../../lib/activity';
import { projectAnnouncements, projectCountries } from '../../data/community';
import { Country, Flag, SocialLinks } from '../../components/social';
import { countryName } from '../../lib/countries';
import { AnnouncementCard } from './News';

function parseRepo(url: string): string | null {
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}

interface RepoInfo { stars: number; forks: number; language: string | null; pushed: string; commits: { sha: string; message: string; date: string; url: string }[] }

/** Живые данные публичного репозитория GitHub — без ключа, через открытый API. */
function GitHubCard({ url }: { url: string }) {
  const repo = parseRepo(url);
  const [info, setInfo] = useState<RepoInfo | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!repo) return;
    const key = `artel:gh:${repo}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (cached && Date.now() - cached.at < 10 * 60e3) { setInfo(cached.info); return; }
    } catch { /* нет кэша */ }
    let alive = true;
    Promise.all([
      fetch(`https://api.github.com/repos/${repo}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=3`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([r, c]) => {
      if (!alive) return;
      const next: RepoInfo = {
        stars: r.stargazers_count, forks: r.forks_count, language: r.language, pushed: r.pushed_at,
        commits: (Array.isArray(c) ? c : []).map((x: { sha: string; html_url: string; commit: { message: string; author: { date: string } } }) => ({
          sha: x.sha.slice(0, 7), message: x.commit.message.split('\n')[0], date: x.commit.author.date, url: x.html_url,
        })),
      };
      setInfo(next);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), info: next })); } catch { /* без кэша */ }
    }).catch((status) => {
      if (alive) setError(status === 404 ? tr('репозиторий не найден') : status === 403 ? tr('GitHub ограничил запросы') : tr('нет связи с GitHub'));
    });
    return () => { alive = false; };
  }, [repo]);
  if (!repo) return null;
  return (
    <div className="gh">
      <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer noopener" className="side-link"><IconLink />{repo}</a>
      {error && <p className="muted small">GitHub: {error}</p>}
      {info && <p className="gh-stats muted small"><span>★ {info.stars}</span><span>{tn(info.forks, '{n} форк|{n} форка|{n} форков')}</span>{info.language && <span>{info.language}</span>}</p>}
      {info && (
        <ul className="gh-commits">
          {info.commits.map((c) => <li key={c.sha}><a href={c.url} target="_blank" rel="noreferrer noopener">{c.message}</a><span className="muted small"><TimeAgo at={new Date(c.date).getTime()} /></span></li>)}
        </ul>
      )}
    </div>
  );
}

/** Доля ремёсел в задачах проекта — как полоса языков на GitHub. */
function CraftBar({ p }: { p: Project }) {
  const s = useAppState();
  const weights = new Map<Skill, number>();
  for (const t of projectTasks(s, p.id)) {
    if (t.status === 'proposed' || t.status === 'declined') continue;
    for (const sk of t.skills) weights.set(sk, (weights.get(sk) ?? 0) + 1 / t.skills.length);
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (!total) return null;
  const list = SKILLS.map((sk) => ({ sk, pct: ((weights.get(sk.id) ?? 0) / total) * 100 })).filter((x) => x.pct > 0).sort((a, b) => b.pct - a.pct);
  return (
    <section className="side-sec">
      <h2>{tr('Ремёсла')}</h2>
      <div className="craftbar" role="img" aria-label={list.map((x) => `${x.sk.name} ${x.pct.toFixed(0)}%`).join(', ')}>
        {list.map((x) => <span key={x.sk.id} style={{ width: `${x.pct}%`, background: `var(--sk-${x.sk.id})` }} data-tip={`${x.sk.name} — ${x.pct.toFixed(0)}%`} />)}
      </div>
      <ul className="craft-legend">
        {list.map((x) => (
          <li key={x.sk.id}><span className="sdot" style={{ background: `var(--sk-${x.sk.id})` }} /><span>{x.sk.name}</span><span className="muted">{x.pct.toFixed(0)}%</span></li>
        ))}
      </ul>
    </section>
  );
}

export function Overview({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  const members = projectMembers(s, p);
  const last = s.activity.find((a) => a.projectId === p.id);
  const events = s.activity.filter((a) => a.projectId === p.id).length;
  const latest = p.releases[0];
  const forks = s.projects.filter((x) => x.forkOf === p.id).length;
  const github = p.links.find((l) => l.kind === 'github');
  const otherLinks = p.links.filter((l) => l.kind !== 'github');
  const openMilestones = p.milestones.filter((m) => { const mp = milestoneProgress(s, m); return !mp.total || mp.done < mp.total; });
  const shownMilestones = (openMilestones.length ? openMilestones : p.milestones).slice(0, 3);
  const freeTasks = projectTasks(s, p.id).filter((t) => t.status === 'open' && !t.assigneeId && !isClosed(t)).length;
  const topNews = projectAnnouncements(s, p.id)[0];
  const countries = projectCountries(s, p);

  return (
    <div className="repo-grid">
      <div className="repo-main">
        {last && (
          <div className="latest-bar">
            <Avatar user={getUser(s, last.actorId)} size={22} />
            <UserLink id={last.actorId} />
            <span className="latest-text">{gverb(activityText(last), getUser(s, last.actorId))}</span>
            <span className="muted latest-time"><TimeAgo at={last.at} /></span>
            <Link to={`/p/${p.slug}/history`} className="latest-count">{tn(events, '{n} событие|{n} события|{n} событий')}</Link>
          </div>
        )}

        {topNews && (
          <div className="news-top">
            <AnnouncementCard a={topNews} p={p} compact />
            <Link to={`/p/${p.slug}/news`} className="link-quiet small">{tr('Все объявления')}</Link>
          </div>
        )}

        <div className="box files">
          <div className="box-head">
            <span className="box-title">{tr('Документы')}</span>
            {maint && <Link to={`/p/${p.slug}/docs/new`} className="btn btn-sm"><IconPlus />{tr('Документ')}</Link>}
          </div>
          {p.docs.map((d) => (
            <Link key={d.id} to={`/p/${p.slug}/docs/${d.id}`} className="file-row">
              <IconFile className="file-ico" />
              <span className="file-name">{d.title}</span>
              <span className="file-msg">{g(getUser(s, d.updatedBy), tr('обновил'), tr('обновила'))} {getUser(s, d.updatedBy)?.name}</span>
              <span className="file-time"><TimeAgo at={d.updatedAt} /></span>
            </Link>
          ))}
          {!p.docs.length && <p className="box-empty">{tr('Документов пока нет.')}</p>}
        </div>

        <article className="box readme">
          <div className="box-head">
            <span className="box-title"><IconBook />{tr('Концепция')}</span>
            {maint && <Link to={`/p/${p.slug}/settings`} className="icon-btn" aria-label={tr('Править концепцию')} data-tip={tr('Править в настройках')}><IconPencil /></Link>}
          </div>
          <div className="readme-body">
            <p className="readme-goal">{p.goal}</p>
            {p.concept && <Markdown text={p.concept} className="md-serif" />}
          </div>
        </article>
      </div>

      <aside className="repo-side">
        <section className="side-sec">
          <h2>{tr('О проекте')}</h2>
          <p className="side-about">{p.tagline}</p>
          <SocialLinks links={p.socials} />
          {otherLinks.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="side-link"><IconGlobe />{l.label || l.url.replace(/^https?:\/\//, '')}</a>)}
          {p.techs.length > 0 && <div className="topics">{p.techs.map((t) => <Link key={t} to={`/projects?tech=${encodeURIComponent(t)}`} className="topic">{t}</Link>)}</div>}
          {p.rolesNeeded.length > 0 && (
            <div className="side-needs"><span className="muted small">{tr('Ищут')}</span><span className="labels">{p.rolesNeeded.map((r) => <CraftLabel key={r} skill={r} />)}</span></div>
          )}
          <ul className="side-meta">
            {p.country && <li className="side-origin"><span className="muted">{tr('Откуда:')}</span> <Country code={p.country} /></li>}
            <li><IconBook />{tr('Лицензия')} {tr(p.license)}</li>
            <li><IconEye />{tn(p.followerIds.length, '{n} следит|{n} следят|{n} следят')}</li>
            <li><IconFork />{tn(forks, '{n} ответвление|{n} ответвления|{n} ответвлений')}</li>
          </ul>
          {github && <GitHubCard url={github.url} />}
          {freeTasks > 0 && <Link to={`/p/${p.slug}/issues?free=1`} className="btn btn-primary btn-sm btn-block">{tr('Свободных задач:')} {freeTasks}</Link>}
        </section>

        <section className="side-sec">
          <h2>{tr('Стадия')}</h2>
          <StageMeter stage={p.stage} />
        </section>

        {shownMilestones.length > 0 && (
          <section className="side-sec">
            <h2>{tr('Этапы')}</h2>
            <ul className="side-ms">
              {shownMilestones.map((m) => {
                const mp = milestoneProgress(s, m);
                return (
                  <li key={m.id}>
                    <Link to={`/p/${p.slug}/issues?m=${m.id}`}>{m.title}</Link>
                    <span className="muted small">{mp.done} {tr('из')} {mp.total}</span>
                    <Progress ratio={mp.ratio} label={m.title} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {latest && (
          <section className="side-sec">
            <h2><Link to={`/p/${p.slug}/releases`}>{tr('Версии')}</Link> <span className="counter">{p.releases.length}</span></h2>
            <Link to={`/p/${p.slug}/releases`} className="side-release">
              <IconTag className="rel-ico" />
              <span><strong>{latest.version}</strong> {latest.title} <span className="pill-latest">{tr('Последняя')}</span></span>
              <span className="muted small"><TimeAgo at={latest.createdAt} /></span>
            </Link>
          </section>
        )}

        <section className="side-sec">
          <h2>{tr('Участники')} <span className="counter">{members.length}</span></h2>
          <AvatarStack ids={members} max={16} size={30} />
          {countries.length > 0 && (
            <ul className="side-countries" aria-label={tr('Страны участников')}>
              {countries.map((c) => <li key={c.code} data-tip={countryName(c.code)}><Flag code={c.code} size={12} /><span>{countryName(c.code)}</span><span className="muted">{c.n}</span></li>)}
            </ul>
          )}
        </section>

        <CraftBar p={p} />
      </aside>
    </div>
  );
}
