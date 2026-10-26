import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../data/store';
import { CraftLabels, PriorityMark, TaskIcon, openLogin, useMe } from '../components/ui';
import { acceptedCount, recommendTasks } from '../lib/match';
import { tn, tr } from '../i18n';

export default function ForYou() {
  const s = useAppState();
  const me = useMe();
  const recs = useMemo(() => (me ? recommendTasks(s, me) : []), [s, me]);
  const mine = me ? s.tasks.filter((t) => t.assigneeId === me.id && (t.status === 'in_progress' || t.status === 'review')) : [];

  if (!me) {
    return (
      <div className="page narrow">
        <h1 className="h1">{tr('Задачи под ваши навыки')}</h1>
        <p className="lead">{tr('Отметьте, что вы умеете, — и мы подберём задачи во всех открытых проектах.')}</p>
        <p><button type="button" className="btn btn-primary btn-lg" onClick={openLogin}>{tr('Создать профиль')}</button></p>
      </div>
    );
  }

  const n = acceptedCount(s, me.id);
  return (
    <div className="page narrow foryou">
      <h1 className="h1">{tr('Для вас')}</h1>
      <p className="lead-sm">{n ? tr('У вас {x1}.', { x1: tn(n, '{n} принятый вклад|{n} принятых вклада|{n} принятых вкладов') }) : tr('Для первого вклада выбирайте задачи размера S.')}</p>

      {mine.length > 0 && (
        <section className="section-sm">
          <h2 className="h3">{tr('В работе')}</h2>
          <div className="box"><ul className="ilist">
            {mine.map((t) => {
              const p = s.projects.find((x) => x.id === t.projectId)!;
              return (
                <li key={t.id} className="irow">
                  <TaskIcon t={t} />
                  <div className="irow-main">
                    <div className="irow-line"><Link to={`/p/${p.slug}/issues/${t.number}`} className="irow-title">{t.title}</Link></div>
                    <div className="irow-meta"><span>{p.title} #{t.number}</span><span>{t.status === 'review' ? tr('вклад на проверке') : tr('пора предложить вклад, когда будет готово')}</span></div>
                  </div>
                </li>
              );
            })}
          </ul></div>
        </section>
      )}

      <section className="section-sm">
        <h2 className="h3">{tr('Подходят вам')}</h2>
        {recs.length ? (
          <div className="box"><ul className="ilist">
            {recs.map((r) => (
              <li key={r.task.id} className={`irow${r.blockedBy.length ? ' is-dim' : ''}`}>
                <TaskIcon t={r.task} />
                <div className="irow-main">
                  <div className="irow-line">
                    <Link to={`/p/${r.project.slug}/issues/${r.task.number}`} className="irow-title">{r.task.title}</Link>
                    <CraftLabels skills={r.task.skills} />
                    <PriorityMark priority={r.task.priority} />
                  </div>
                  <div className="irow-meta"><span>{r.project.title} #{r.task.number}{tr(', размер')} {r.task.size}</span></div>
                  <p className="irow-why">{r.reasons[0][0].toUpperCase() + r.reasons[0].slice(1)}{r.reasons.length > 1 && `; ${r.reasons.slice(1).join('; ')}`}.</p>
                </div>
              </li>
            ))}
          </ul></div>
        ) : <p className="muted">{tr('Свободных задач под ваши навыки сейчас нет. Загляните в')} <Link to="/projects">{tr('каталог')}</Link> {tr('или предложите задачу в проекте, который нравится.')}</p>}
      </section>
    </div>
  );
}
