import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { forkProject, getProject, getUser, isMaintainer, projectBySlug, projectContribs, projectTasks, toggleFollow } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { isClosed, type Project } from '../../data/types';
import { AiPanel, EngineBadge } from '../../components/AiPanel';
import { IconBook, IconChart, IconComment, IconDiscussion, IconEye, IconFlag, IconFork, IconGear, IconHistory, IconIssue, IconPull, IconShare, IconSpark, IconTag, IconTranslate } from '../../components/icons';
import { ChatView } from '../../components/Chat';
import { News } from './News';
import { Insights } from './Insights';
import { projectChatId, unreadIn } from '../../data/community';
import { setState } from '../../data/store';
import { Field, Modal, openLogin, report, toast, useMe } from '../../components/ui';
import { Overview } from './Overview';
import { DocView } from './DocView';
import { Issues } from './Issues';
import { IssuePage } from './IssuePage';
import { IssueForm } from './IssueForm';
import { DoneWorkForm } from './DoneWorkForm';
import { Pulls } from './Pulls';
import { PullPage } from './PullPage';
import { PullForm } from './PullForm';
import { Discussions } from './Discussions';
import { Releases } from './Releases';
import { History } from './History';
import { ProjectSettings } from './ProjectSettings';
import { tr } from '../../i18n';

function ForkModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const me = useMe();
  const [title, setTitle] = useState(tr('{title}: ответвление', { title: p.title }));
  const navigate = useNavigate();
  const submit = () => {
    if (!me) return openLogin();
    const r = act<ReturnType<typeof forkProject>>('forkProject', [p.id, me.id, title]);
    if (report(r, tr('Ответвление создано. Вы его автор.'))) { onClose(); navigate(`/p/${r.value.project.slug}`); }
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('Создать ответвление')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="muted">{tr('Ваша копия проекта с документами, планом и незавершёнными задачами. Связь с исходным проектом сохранится.')}</p>
        <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="row-end"><button className="btn btn-primary" type="submit">{tr('Создать ответвление')}</button></div>
      </form>
    </Modal>
  );
}

export function ProjectPage() {
  const { slug = '', tab = '', sub } = useParams();
  const s = useAppState();
  const me = useMe();
  const [fork, setFork] = useState(false);
  const [ai, setAi] = useState(false);
  const p = projectBySlug(s, slug);

  if (!p) {
    return (
      <div className="page narrow">
        <h1 className="h1">{tr('Проект не найден')}</h1>
        <p className="lead">{tr('Возможно, его переименовали. Поищите в каталоге.')}</p>
        <Link to="/projects" className="btn btn-primary">{tr('Открыть каталог')}</Link>
      </div>
    );
  }

  const owner = getUser(s, p.ownerId);
  const maint = isMaintainer(p, me?.id);
  const following = !!me && p.followerIds.includes(me.id);
  const parent = p.forkOf ? getProject(s, p.forkOf) : undefined;
  const forks = s.projects.filter((x) => x.forkOf === p.id).length;
  const openTasks = projectTasks(s, p.id).filter((t) => !isClosed(t)).length;
  const openPulls = projectContribs(s, p.id).filter((c) => c.status === 'open' || c.status === 'changes_requested').length;
  const openTalk = s.threads.filter((t) => t.projectId === p.id && !t.decision).length;
  const news = s.announcements.filter((a) => a.projectId === p.id).length;
  const chatUnread = me ? unreadIn(s, projectChatId(p.id), me.id) : 0;

  const tabs: { id: string; name: string; icon: ReactNode; n?: number }[] = [
    { id: '', name: tr('Обзор'), icon: <IconBook /> },
    { id: 'issues', name: tr('Задачи'), icon: <IconIssue />, n: openTasks },
    { id: 'pulls', name: tr('Вклады'), icon: <IconPull />, n: openPulls },
    { id: 'news', name: tr('Объявления'), icon: <IconFlag />, n: news },
    { id: 'talk', name: tr('Обсуждения'), icon: <IconDiscussion />, n: openTalk },
    { id: 'chat', name: tr('Чат'), icon: <IconComment />, n: chatUnread },
    { id: 'stats', name: tr('Вклад и доходы'), icon: <IconChart /> },
    { id: 'releases', name: tr('Версии'), icon: <IconTag />, n: p.releases.length },
    { id: 'history', name: tr('История'), icon: <IconHistory /> },
    ...(maint ? [{ id: 'settings', name: tr('Настройки'), icon: <IconGear /> }] : []),
  ];

  const follow = () => {
    if (!me) return openLogin();
    report(act<ReturnType<typeof toggleFollow>>('toggleFollow', [p.id, me.id]), following ? tr('Вы больше не следите за проектом') : tr('Теперь проект в ваших подписках'));
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#/p/${p.slug}`;
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ title: p.title, text: p.tagline, url }); return; } catch { /* отмена */ } }
    try { await navigator.clipboard.writeText(url); toast(tr('Ссылка скопирована')); } catch { toast(url); }
  };

  const num = sub && /^\d+$/.test(sub) ? Number(sub) : undefined;
  const body = (() => {
    switch (tab) {
      case 'docs': return <DocView p={p} docId={sub} />;
      case 'issues': return sub === 'new' ? <IssueForm p={p} /> : sub === 'done' ? <DoneWorkForm p={p} /> : num ? <IssuePage p={p} n={num} /> : <Issues p={p} />;
      case 'pulls': return sub === 'new' ? <PullForm p={p} /> : num ? <PullPage p={p} n={num} /> : <Pulls p={p} />;
      case 'talk': return <Discussions p={p} />;
      case 'news': return <News p={p} />;
      case 'chat': return <div className="project-chat"><ChatView chatId={projectChatId(p.id)} empty={tr('В чате проекта пока тихо. Поздоровайтесь и расскажите, чем хотите помочь.')} /></div>;
      case 'stats': return <Insights p={p} />;
      case 'releases': return <Releases p={p} />;
      case 'history': return <History p={p} />;
      case 'settings': return maint ? <ProjectSettings p={p} /> : <Overview p={p} />;
      default: return <Overview p={p} />;
    }
  })();

  return (
    <div className="repo">
      <header className="repo-head">
        <div className="repo-head-in">
          <div className="repo-title">
            <h1>
              <span className="repo-ico"><IconBook /></span>
              <Link to={`/u/${owner?.handle}`} className="repo-owner">{owner?.handle}</Link>
              <span className="repo-sep">/</span>
              <Link to={`/p/${p.slug}`} className="repo-name">{p.title}</Link>
              <span className="repo-vis">{tr('Открытый')}</span>
            </h1>
            {parent && <p className="repo-fork">{tr('ответвление от')} <Link to={`/p/${parent.slug}`}>{getUser(s, parent.ownerId)?.handle} / {parent.title}</Link></p>}
          </div>
          <div className="repo-actions">
            <button type="button" className={`btn btn-sm btn-count${following ? ' is-on' : ''}`} aria-pressed={following} aria-label={following ? tr('Вы следите за проектом') : tr('Следить за проектом')} onClick={follow} data-tip={following ? tr('Перестать следить') : tr('Получать новости проекта')}>
              <IconEye /><span className="btn-text">{following ? tr('Вы следите') : tr('Следить')}</span><span className="counter">{p.followerIds.length}</span>
            </button>
            <button type="button" className="btn btn-sm btn-count" onClick={() => (me ? setFork(true) : openLogin())} disabled={!p.openForForks} aria-label={tr('Создать ответвление')} data-tip={p.openForForks ? tr('Развивать свою копию проекта') : tr('Автор не разрешил ответвления')}>
              <IconFork /><span className="btn-text">{tr('Ответвление')}</span><span className="counter">{forks}</span>
            </button>
            <button type="button" className={`btn btn-sm${s.autoTranslate ? ' is-on' : ''}`} aria-pressed={!!s.autoTranslate} onClick={() => setState({ autoTranslate: !s.autoTranslate })} data-tip={tr('Переводить тексты проекта на язык интерфейса')}><IconTranslate /><span className="btn-text">{s.autoTranslate ? tr('Перевод включён') : tr('Переводить')}</span></button>
            <button type="button" className="btn btn-sm" onClick={share} aria-label={tr('Поделиться')} data-tip={tr('Поделиться')}><IconShare /></button>
            <button type="button" className="btn btn-sm btn-ai" onClick={() => setAi(true)}><IconSpark />{tr('Помощник')}</button>
          </div>
        </div>
        <nav className="repo-tabs" aria-label={tr('Разделы проекта')}>
          {tabs.map((t) => (
            <NavLink key={t.id} to={`/p/${p.slug}${t.id ? `/${t.id}` : ''}`} end={!t.id} className={({ isActive }) => `rtab${isActive || (t.id === '' && tab === 'docs') ? ' active' : ''}`}>
              {t.icon}<span>{t.name}</span>{t.n ? <span className="counter">{t.n}</span> : null}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="repo-body">{body}</div>

      <Modal open={ai} onClose={() => setAi(false)} title={tr('Помощник проекта')} side>
        <div className="ai-drawer-head"><EngineBadge /><span className="muted small">{tr('знает документы, задачи и обсуждения «')}{p.title}»</span></div>
        <AiPanel p={p} bare onNavigate={() => setAi(false)} />
      </Modal>
      <ForkModal p={p} open={fork} onClose={() => setFork(false)} />
    </div>
  );
}
