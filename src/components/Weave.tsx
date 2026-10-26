// «Полотно»: каждая клетка — задача, цвет — ремесло, заполненность — состояние.
// Готовое — плотный стежок, в работе — наполовину, свободное — пустая ячейка основы.
import { Link } from 'react-router-dom';
import { TASK_STATUSES, skillInfo, type Project, type State, type Task } from '../data/types';
import { lcFirst } from '../lib/format';
import { tr } from '../i18n';

const ORDER = { done: 0, review: 1, in_progress: 2, open: 3, proposed: 4, declined: 5 } as const;

export function stitchesFor(tasks: Task[]) {
  return tasks.filter((t) => t.status !== 'proposed' && t.status !== 'declined').sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.createdAt - b.createdAt);
}

function stitchState(t: Task) {
  return t.status === 'done' ? 'done' : t.status === 'open' ? 'open' : 'work';
}

function Stitch({ t, delay }: { t: Task; delay?: number }) {
  const skill = t.skills[0];
  const status = TASK_STATUSES.find((x) => x.id === t.status)!.name.toLowerCase();
  return (
    <span
      className={`stitch stitch-${stitchState(t)}`}
      style={{ ['--c' as string]: `var(--sk-${skill})`, ...(delay !== undefined ? { animationDelay: `${delay}ms` } : {}) }}
      data-tip={`${t.title} — ${lcFirst(skillInfo(skill).name)}, ${status}`}
    />
  );
}

/** Строка-полоска для карточки проекта. */
export function WeaveStrip({ tasks, label }: { tasks: Task[]; label?: string }) {
  const list = stitchesFor(tasks);
  return (
    <span className="weave-strip" role="img" aria-label={label ?? tr('Задач: {length}, готово {length2}', { length: list.length, length2: list.filter((t) => t.status === 'done').length })}>
      {list.map((t) => <Stitch key={t.id} t={t} />)}
    </span>
  );
}

/** Большое полотно: строка — проект, клетка — задача. */
export function Loom({ state, projects }: { state: State; projects: Project[] }) {
  let i = 0;
  return (
    <div className="loom" role="list" aria-label={tr('Проекты и их задачи')}>
      {projects.map((p) => {
        const list = stitchesFor(state.tasks.filter((t) => t.projectId === p.id));
        const done = list.filter((t) => t.status === 'done').length;
        return (
          <Link key={p.id} to={`/p/${p.slug}`} className="loom-row" role="listitem" aria-label={tr('{title}: готово {done} из {length}', { title: p.title, done, length: list.length })}>
            <span className="loom-label">{p.title}</span>
            <span className="loom-thread">
              {list.map((t) => <Stitch key={t.id} t={t} delay={(i++) * 18} />)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function LoomLegend() {
  return (
    <div className="loom-legend" aria-hidden>
      <span><i className="stitch stitch-done" style={{ ['--c' as string]: 'var(--ink-2)' }} />{tr('готово')}</span>
      <span><i className="stitch stitch-work" style={{ ['--c' as string]: 'var(--ink-2)' }} />{tr('в работе')}</span>
      <span><i className="stitch stitch-open" style={{ ['--c' as string]: 'var(--ink-2)' }} />{tr('свободно')}</span>
    </div>
  );
}
