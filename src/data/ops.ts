// Чистые операции над состоянием: (state, …) => новое state.
// Права проверяются здесь, чтобы интерфейс и тесты опирались на одни и те же правила.
import type {
  Activity, Attachment, Contribution, Msg, ContributionStatus, Doc, Milestone, Priority, Project,
  ProjectLink, Release, Size, Skill, State, Task, TaskStatus, TaskType, Thread, ThreadKind, User, Verdict,
  SocialLink,
} from './types';
import { tr } from '../i18n';
import { now as clock, uid } from './runtime';

export { uid };

export class OpError extends Error {}

/** Сообщение ленты: ключ перевода и данные. Текст собирается при показе — на языке зрителя. */
export const m = (k: string, a?: Msg['a']): Msg => (a ? { k, a } : { k });


export function slugify(title: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  };
  const s = title.toLowerCase().split('').map((c) => map[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || 'project';
}

// ——— выборки ———

export const getUser = (s: State, id?: string | null) => s.users.find((u) => u.id === id);
export const getProject = (s: State, id: string) => s.projects.find((p) => p.id === id);
export const projectBySlug = (s: State, slug: string) => s.projects.find((p) => p.slug === slug);
export const getTask = (s: State, id?: string) => s.tasks.find((t) => t.id === id);
export const projectTasks = (s: State, projectId: string) => s.tasks.filter((t) => t.projectId === projectId);
export const projectContribs = (s: State, projectId: string) => s.contributions.filter((c) => c.projectId === projectId);
export const taskByNumber = (s: State, projectId: string, n: number) => s.tasks.find((t) => t.projectId === projectId && t.number === n);
export const contribByNumber = (s: State, projectId: string, n: number) => s.contributions.find((c) => c.projectId === projectId && c.number === n);
export const taskContribs = (s: State, taskId: string) => s.contributions.filter((c) => c.taskId === taskId);

export const isMaintainer = (p: Project, userId?: string | null) => !!userId && (p.ownerId === userId || p.maintainerIds.includes(userId));

/** Участники проекта: автор, сопровождающие и все, у кого есть задачи или вклады. */
export function projectMembers(s: State, p: Project): string[] {
  const ids = new Set<string>([p.ownerId, ...p.maintainerIds]);
  for (const t of s.tasks) if (t.projectId === p.id && t.assigneeId) ids.add(t.assigneeId);
  for (const c of s.contributions) if (c.projectId === p.id) ids.add(c.authorId);
  return [...ids];
}

/** Время последнего события в проекте — для сортировки «недавно обновлённые». */
export function lastActivity(s: State, p: Project): number {
  let at = p.updatedAt;
  for (const a of s.activity) if (a.projectId === p.id && a.at > at) at = a.at;
  return at;
}

const counts = (t: Task) => t.status !== 'proposed' && t.status !== 'declined';

export function projectProgress(s: State, p: Project) {
  const tasks = projectTasks(s, p.id).filter(counts);
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

export function milestoneProgress(s: State, m: Milestone) {
  const tasks = s.tasks.filter((t) => t.milestoneId === m.id && counts(t));
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

/** Задачи, от которых зависит эта, но которые ещё не готовы. */
export const blockers = (s: State, t: Task) => t.dependsOn.map((id) => getTask(s, id)).filter((d): d is Task => !!d && d.status !== 'done');

export function approvals(s: State, c: Contribution): string[] {
  const p = getProject(s, c.projectId);
  if (!p) return [];
  // считаем последнее мнение каждого сопровождающего
  const last = new Map<string, Verdict>();
  for (const r of c.reviews) if (isMaintainer(p, r.authorId) && r.verdict !== 'comment') last.set(r.authorId, r.verdict);
  return [...last].filter(([, v]) => v === 'approve').map(([id]) => id);
}

/** Может ли участник принять или отклонить вклад — по правилу проекта. */
export function canDecide(s: State, c: Contribution, userId?: string | null, decision: 'accepted' | 'rejected' = 'accepted'): { ok: boolean; reason: string } {
  const p = getProject(s, c.projectId);
  if (!p || !userId) return { ok: false, reason: tr('Войдите, чтобы принимать решения') };
  if (c.status === 'accepted' || c.status === 'rejected') return { ok: false, reason: tr('Решение по вкладу уже принято') };
  if (p.acceptRule === 'owner') {
    return p.ownerId === userId ? { ok: true, reason: '' } : { ok: false, reason: tr('По правилам проекта вклады принимает только автор') };
  }
  if (!isMaintainer(p, userId)) return { ok: false, reason: tr('Решение принимают сопровождающие проекта') };
  if (p.acceptRule === 'two-approvals' && decision === 'accepted') {
    const n = approvals(s, c).length;
    if (n < 2) return { ok: false, reason: tr('Нужны два одобрения сопровождающих, сейчас {n}', { n }) };
  }
  return { ok: true, reason: '' };
}

// ——— служебное ———

export function log(s: State, a: Omit<Activity, 'id' | 'at'> & { at?: number }): State {
  const entry: Activity = { id: uid('a'), at: a.at ?? clock(), ...a };
  return { ...s, activity: [entry, ...s.activity] };
}

export function need<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new OpError(msg);
  return v;
}

export function mustUser(s: State, actorId: string | null | undefined): User {
  return need(getUser(s, actorId), tr('Войдите, чтобы продолжить'));
}

export function mustMaintain(s: State, projectId: string, actorId: string): Project {
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  if (!isMaintainer(p, actorId)) throw new OpError(tr('Это могут делать только сопровождающие проекта'));
  return p;
}

export const patchProject = (s: State, id: string, patch: Partial<Project>): State => ({
  ...s,
  projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: clock() } : p)),
});
const patchTask = (s: State, id: string, patch: Partial<Task>): State => ({
  ...s,
  tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: clock() } : t)),
});
const patchContrib = (s: State, id: string, patch: Partial<Contribution>): State => ({
  ...s,
  contributions: s.contributions.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: clock() } : c)),
});

/** Следующий номер #N в проекте — общий для задач и вкладов. */
function takeNumber(s: State, projectId: string): [State, number] {
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  const n = p.nextNumber;
  return [{ ...s, projects: s.projects.map((x) => (x.id === projectId ? { ...x, nextNumber: n + 1 } : x)) }, n];
}

const touch = (s: State, projectId: string): State => ({
  ...s,
  projects: s.projects.map((p) => (p.id === projectId ? { ...p, updatedAt: clock() } : p)),
});

// ——— участники ———

export interface NewUser { name: string; bio: string; skills: Skill[]; gender?: 'm' | 'f'; country?: string; google?: User['google']; photo?: string; id?: string }

/** Профиль, привязанный к аккаунту Google. */
export const userByGoogle = (s: State, sub: string) => s.users.find((u) => u.google?.sub === sub);

export function registerUser(s: State, input: NewUser): { state: State; id: string } {
  const name = input.name.trim();
  if (name.length < 2) throw new OpError(tr('Укажите имя — хотя бы два символа'));
  if (!input.skills.length) throw new OpError(tr('Отметьте хотя бы один навык — по нему мы подберём задачи'));
  if (input.google && userByGoogle(s, input.google.sub)) throw new OpError(tr('Этот аккаунт Google уже привязан к профилю — просто войдите'));
  let handle = slugify(name);
  while (s.users.some((u) => u.handle === handle)) handle = `${slugify(name)}-${Math.floor(Math.random() * 90 + 10)}`;
  if (input.id && getUser(s, input.id)) throw new OpError(tr('Профиль уже создан'));
  const user: User = { id: input.id ?? uid('u'), name, handle, bio: input.bio.trim(), skills: input.skills, hue: Math.floor(Math.random() * 360), joinedAt: clock(), gender: input.gender ?? 'm', country: input.country, google: input.google, photo: safeUrl(input.photo ?? '') ?? undefined };
  return { state: { ...s, users: [...s.users, user], currentUserId: user.id }, id: user.id };
}

export function updateUser(s: State, actorId: string, patch: Partial<Pick<User, 'name' | 'bio' | 'skills' | 'gender' | 'country' | 'socials' | 'portfolio'>>): State {
  mustUser(s, actorId);
  if (patch.skills && !patch.skills.length) throw new OpError(tr('Оставьте хотя бы один навык'));
  if (patch.name !== undefined && patch.name.trim().length < 2) throw new OpError(tr('Укажите имя — хотя бы два символа'));
  const clean = { ...patch, ...(patch.socials ? { socials: cleanSocials(patch.socials) } : {}) };
  return { ...s, users: s.users.map((u) => (u.id === actorId ? { ...u, ...clean } : u)) };
}

// ——— проекты ———

export interface NewProject {
  title: string;
  tagline: string;
  category: Project['category'];
  stage: Project['stage'];
  techs: string[];
  goal: string;
  concept: string;
  rolesNeeded: Skill[];
  milestones: { title: string; description: string }[];
  tasks: { title: string; description: string; skills: Skill[]; priority: Priority; size: Size; milestoneIndex?: number }[];
  license: string;
  acceptRule: Project['acceptRule'];
  openForForks: boolean;
  country?: string;
}

export function createProject(s: State, input: NewProject, actorId: string): { state: State; project: Project } {
  mustUser(s, actorId);
  const title = input.title.trim();
  if (title.length < 3) throw new OpError(tr('Название проекта — хотя бы три символа'));
  if (!input.goal.trim()) throw new OpError(tr('Опишите цель проекта — ради чего его делать'));
  let slug = slugify(title);
  for (let i = 2; s.projects.some((p) => p.slug === slug); i++) slug = `${slugify(title)}-${i}`;
  const now = clock();
  const milestones: Milestone[] = input.milestones.filter((m) => m.title.trim()).map((m) => ({ id: uid('m'), title: m.title.trim(), description: m.description.trim() }));
  const project: Project = {
    id: uid('p'), slug, title, tagline: input.tagline.trim(), category: input.category, stage: input.stage,
    techs: input.techs, goal: input.goal.trim(), concept: input.concept.trim(), ownerId: actorId, maintainerIds: [actorId],
    followerIds: [actorId], rolesNeeded: input.rolesNeeded, milestones,
    docs: [
      { id: uid('d'), title: tr('Концепция'), body: input.concept.trim() || input.goal.trim(), updatedAt: now, updatedBy: actorId },
      { id: uid('d'), title: tr('Как участвовать'), body: contributingDoc(input.acceptRule), updatedAt: now, updatedBy: actorId },
    ],
    links: [], socials: [], country: input.country, releases: [], license: input.license, acceptRule: input.acceptRule, openForForks: input.openForForks,
    createdAt: now, updatedAt: now, nextNumber: 1,
  };
  const tasks: Task[] = input.tasks.filter((t) => t.title.trim()).map((t, i) => ({
    id: uid('t'), number: i + 1, projectId: project.id, title: t.title.trim(), description: t.description.trim(), status: 'open',
    priority: t.priority, type: 'task', size: t.size, skills: t.skills,
    milestoneId: t.milestoneIndex !== undefined ? milestones[t.milestoneIndex]?.id : undefined,
    dependsOn: [], comments: [], createdBy: actorId, createdAt: now, updatedAt: now,
  }));
  project.nextNumber = tasks.length + 1;
  let next: State = { ...s, projects: [project, ...s.projects], tasks: [...s.tasks, ...tasks] };
  next = log(next, { projectId: project.id, actorId, type: 'project', msg: m('создал проект «{title}»', { title }), ref: { kind: 'project', id: project.id } });
  return { state: next, project };
}

export function contributingDoc(rule: Project['acceptRule']): string {
  const how = rule === 'owner' ? tr('Вклады принимает автор проекта.')
    : rule === 'two-approvals' ? tr('Вклад принимается после двух одобрений сопровождающих.')
      : tr('Вклад принимает любой сопровождающий.');
  return [
    tr('## С чего начать'), '',
    tr('1. Прочитайте концепцию и откройте список задач.'),
    tr('2. Выберите свободную задачу под свои навыки и нажмите «Взять задачу».'),
    tr('3. Если что-то непонятно — спросите в комментариях к задаче или у помощника.'),
    tr('4. Когда закончите, нажмите «Предложить вклад»: опишите, что сделано, и приложите ссылки.'), '',
    tr('## Как принимаются изменения'), '', how, tr('Помощник может проверить вклад и подсказать, что поправить, но решение всегда за людьми.'), '',
    tr('## Своя задача'), '', tr('Нашли, чего не хватает? Предложите задачу — сопровождающие посмотрят и откроют её для всех.'),
  ].join('\n');
}

export type ProjectPatch = Partial<Pick<Project,
  'title' | 'tagline' | 'category' | 'stage' | 'techs' | 'goal' | 'concept' | 'rolesNeeded' | 'license' | 'acceptRule' | 'openForForks' | 'links' | 'milestones' | 'socials' | 'country'>>;

export function updateProject(s: State, projectId: string, patch: ProjectPatch, actorId: string): State {
  const p = mustMaintain(s, projectId, actorId);
  if (patch.title !== undefined && patch.title.trim().length < 3) throw new OpError(tr('Название проекта — хотя бы три символа'));
  if (patch.acceptRule && patch.acceptRule !== p.acceptRule && p.ownerId !== actorId) throw new OpError(tr('Правило принятия изменений меняет только автор'));
  let next = patchProject(s, projectId, patch.socials ? { ...patch, socials: cleanSocials(patch.socials) } : patch);
  const changed: Msg[] = [];
  if (patch.stage && patch.stage !== p.stage) changed.push(m('стадию'));
  if (patch.acceptRule && patch.acceptRule !== p.acceptRule) changed.push(m('правило принятия вкладов'));
  if (patch.license && patch.license !== p.license) changed.push(m('лицензию'));
  if (patch.milestones) changed.push(m('план'));
  next = log(next, { projectId, actorId, type: 'project', msg: changed.length ? m('изменил {x1}', { x1: changed }) : m('обновил описание проекта'), ref: { kind: 'project', id: projectId } });
  return next;
}

export function setMaintainers(s: State, projectId: string, ids: string[], actorId: string): State {
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  if (p.ownerId !== actorId) throw new OpError(tr('Состав сопровождающих меняет только автор'));
  const unique = [...new Set([p.ownerId, ...ids])];
  const added = unique.filter((id) => !p.maintainerIds.includes(id));
  let next = patchProject(s, projectId, { maintainerIds: unique });
  for (const id of added) next = log(next, { projectId, actorId, type: 'member', msg: m('сделал сопровождающим — {x1}', { x1: getUser(s, id)?.name ?? m('участника') }) });
  return next;
}

export function toggleFollow(s: State, projectId: string, actorId: string): State {
  mustUser(s, actorId);
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  const followerIds = p.followerIds.includes(actorId) ? p.followerIds.filter((x) => x !== actorId) : [...p.followerIds, actorId];
  return { ...s, projects: s.projects.map((x) => (x.id === projectId ? { ...x, followerIds } : x)) };
}

export function forkProject(s: State, projectId: string, actorId: string, title?: string): { state: State; project: Project } {
  mustUser(s, actorId);
  const src = need(getProject(s, projectId), tr('Проект не найден'));
  if (!src.openForForks) throw new OpError(tr('Автор не разрешил ответвления этого проекта'));
  const now = clock();
  const t = (title ?? tr('{title}: ответвление', { title: src.title })).trim();
  let slug = slugify(t);
  for (let i = 2; s.projects.some((p) => p.slug === slug); i++) slug = `${slugify(t)}-${i}`;
  const mMap = new Map<string, string>();
  const milestones = src.milestones.map((m) => { const id = uid('m'); mMap.set(m.id, id); return { ...m, id }; });
  const project: Project = {
    ...src, id: uid('p'), slug, title: t, ownerId: actorId, maintainerIds: [actorId], followerIds: [actorId],
    milestones, docs: src.docs.map((d) => ({ ...d, id: uid('d') })), releases: [], forkOf: src.id,
    stage: src.stage === 'idea' ? 'idea' : 'prototype', createdAt: now, updatedAt: now,
  };
  // переносим незавершённые задачи как свободные, с новой нумерацией
  const tasks: Task[] = projectTasks(s, src.id)
    .filter((x) => x.status !== 'done' && x.status !== 'proposed' && x.status !== 'declined')
    .sort((a, b) => a.number - b.number)
    .map((x, i) => ({
      ...x, id: uid('t'), number: i + 1, projectId: project.id, status: 'open' as TaskStatus, assigneeId: undefined, dependsOn: [], comments: [],
      milestoneId: x.milestoneId ? mMap.get(x.milestoneId) : undefined, createdBy: actorId, createdAt: now, updatedAt: now,
    }));
  project.nextNumber = tasks.length + 1;
  let next: State = { ...s, projects: [project, ...s.projects], tasks: [...s.tasks, ...tasks] };
  next = log(next, { projectId: project.id, actorId, type: 'project', verb: 'forked', msg: m('создал ответвление от «{title}»', { title: src.title }), ref: { kind: 'project', id: project.id } });
  next = log(next, { projectId: src.id, actorId, type: 'project', verb: 'forked', msg: m('создал ответвление «{t}»', { t }), ref: { kind: 'project', id: project.id } });
  return { state: next, project };
}

// ——— задачи ———

export interface NewTask {
  title: string;
  description: string;
  skills: Skill[];
  priority: Priority;
  size: Size;
  type: TaskType;
  milestoneId?: string;
  dependsOn?: string[];
}

/** Сопровождающие создают задачи сразу открытыми, остальные — предлагают. */
export function addTask(s: State, projectId: string, input: NewTask, actorId: string): { state: State; task: Task } {
  mustUser(s, actorId);
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  const title = input.title.trim();
  if (title.length < 4) throw new OpError(tr('Опишите задачу в заголовке — хотя бы несколько слов'));
  if (!input.skills.length) throw new OpError(tr('Укажите, какие навыки нужны для задачи'));
  const maint = isMaintainer(p, actorId);
  const now = clock();
  const [s1, number] = takeNumber(s, projectId);
  const task: Task = {
    id: uid('t'), number, projectId, title, description: input.description.trim(), status: maint ? 'open' : 'proposed',
    priority: input.priority, type: input.type, size: input.size, skills: input.skills, milestoneId: input.milestoneId || undefined,
    dependsOn: input.dependsOn ?? [], comments: [], createdBy: actorId, createdAt: now, updatedAt: now,
  };
  let next: State = touch({ ...s1, tasks: [...s1.tasks, task] }, projectId);
  next = log(next, { projectId, actorId, type: 'task', verb: 'created', msg: input.type === 'bug' ? m('сообщил об ошибке #{number} «{title}»', { number, title }) : maint ? m('добавил задачу #{number} «{title}»', { number, title }) : m('предложил задачу #{number} «{title}»', { number, title }), ref: { kind: 'task', id: task.id } });
  return { state: next, task };
}

export function addTasks(s: State, projectId: string, inputs: NewTask[], actorId: string): State {
  let next = s;
  for (const t of inputs) next = addTask(next, projectId, t, actorId).state;
  return next;
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'skills' | 'priority' | 'size' | 'milestoneId' | 'dependsOn' | 'type'>>;

export function editTask(s: State, taskId: string, patch: TaskPatch, actorId: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  const p = need(getProject(s, t.projectId), tr('Проект не найден'));
  if (!isMaintainer(p, actorId) && !(t.createdBy === actorId && t.status === 'proposed')) throw new OpError(tr('Править задачу могут сопровождающие или автор предложения'));
  if (patch.title !== undefined && patch.title.trim().length < 4) throw new OpError(tr('Опишите задачу в заголовке — хотя бы несколько слов'));
  if (patch.skills && !patch.skills.length) throw new OpError(tr('Оставьте хотя бы один навык'));
  let next = patchTask(s, taskId, patch);
  const n = { number: t.number };
  const what = patch.skills ? m('изменил ремёсла в задаче #{number}', n) : patch.milestoneId !== undefined ? m('изменил этап в задаче #{number}', n) : patch.priority ? m('изменил приоритет в задаче #{number}', n) : patch.size ? m('изменил размер в задаче #{number}', n) : patch.dependsOn ? m('изменил зависимости в задаче #{number}', n) : m('уточнил описание в задаче #{number}', n);
  next = log(next, { projectId: p.id, actorId, type: 'task', verb: 'edited', msg: what, ref: { kind: 'task', id: taskId } });
  return next;
}

export function addTaskComment(s: State, taskId: string, body: string, actorId: string): State {
  mustUser(s, actorId);
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  if (!body.trim()) throw new OpError(tr('Комментарий пустой'));
  const comment = { id: uid('cm'), authorId: actorId, body: body.trim(), createdAt: clock() };
  let next: State = { ...s, tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, comments: [...x.comments, comment] } : x)) };
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: 'commented', msg: m('прокомментировал задачу #{number}', { number: t.number }), ref: { kind: 'task', id: taskId } });
  return next;
}

export function approveTask(s: State, taskId: string, actorId: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  mustMaintain(s, t.projectId, actorId);
  if (t.status !== 'proposed') throw new OpError(tr('Задача уже открыта'));
  let next = patchTask(s, taskId, { status: 'open' });
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: 'approved', msg: m('открыл предложенную задачу #{number}', { number: t.number }), ref: { kind: 'task', id: taskId } });
  return next;
}

/** Отклонить задачу: она закрывается, но остаётся в истории вместе с причиной. */
export function declineTask(s: State, taskId: string, actorId: string, reason: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  mustMaintain(s, t.projectId, actorId);
  if (t.status === 'done' || t.status === 'declined') throw new OpError(tr('Задача уже закрыта'));
  let next = patchTask(s, taskId, { status: 'declined', assigneeId: undefined });
  if (reason.trim()) next = { ...next, tasks: next.tasks.map((x) => (x.id === taskId ? { ...x, comments: [...x.comments, { id: uid('cm'), authorId: actorId, body: reason.trim(), createdAt: clock() }] } : x)) };
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: 'declined', msg: m('закрыл задачу #{number} как неактуальную', { number: t.number }), ref: { kind: 'task', id: taskId } });
  return next;
}

export function takeTask(s: State, taskId: string, actorId: string): State {
  mustUser(s, actorId);
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  if (t.status !== 'open') throw new OpError(tr('Взять можно только свободную задачу'));
  if (t.assigneeId) throw new OpError(tr('Задачу уже кто-то взял'));
  let next = patchTask(s, taskId, { status: 'in_progress', assigneeId: actorId });
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: 'taken', msg: m('взял в работу #{number} «{title}»', { number: t.number, title: t.title }), ref: { kind: 'task', id: taskId } });
  return next;
}

/** Сопровождающий назначает исполнителя или снимает его. */
export function assignTask(s: State, taskId: string, userId: string | null, actorId: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  mustMaintain(s, t.projectId, actorId);
  if (t.status === 'done' || t.status === 'declined' || t.status === 'proposed') throw new OpError(tr('Назначить можно только открытую задачу'));
  if (userId === (t.assigneeId ?? null)) return s;
  const user = userId ? need(getUser(s, userId), tr('Участник не найден')) : undefined;
  const status: TaskStatus = userId ? (t.status === 'open' ? 'in_progress' : t.status) : (t.status === 'in_progress' ? 'open' : t.status);
  let next = patchTask(s, taskId, { assigneeId: userId ?? undefined, status });
  next = log(next, {
    projectId: t.projectId, actorId, type: 'task', verb: 'assigned',
    msg: user ? m('назначил исполнителем {name} в задаче #{number}', { name: user.name, number: t.number }) : m('снял исполнителя с задачи #{number}', { number: t.number }),
    ref: { kind: 'task', id: taskId },
  });
  return next;
}

export function releaseTask(s: State, taskId: string, actorId: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  const p = need(getProject(s, t.projectId), tr('Проект не найден'));
  if (t.assigneeId !== actorId && !isMaintainer(p, actorId)) throw new OpError(tr('Освободить задачу может исполнитель или сопровождающий'));
  if (t.status !== 'in_progress') throw new OpError(tr('Задача не в работе'));
  let next = patchTask(s, taskId, { status: 'open', assigneeId: undefined });
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: 'released', msg: m('освободил задачу #{number}', { number: t.number }), ref: { kind: 'task', id: taskId } });
  return next;
}

export function moveTask(s: State, taskId: string, status: TaskStatus, actorId: string): State {
  const t = need(getTask(s, taskId), tr('Задача не найдена'));
  mustMaintain(s, t.projectId, actorId);
  if (t.status === status) return s;
  const patch: Partial<Task> = { status };
  if (status === 'open' || status === 'proposed' || status === 'declined') patch.assigneeId = undefined;
  let next = patchTask(s, taskId, patch);
  const closed = (x: TaskStatus) => x === 'done' || x === 'declined';
  const n = { number: t.number };
  const msg = status === 'done' ? m('закрыл задачу #{number} как выполненную', n)
    : closed(t.status) && !closed(status) ? m('снова открыл задачу #{number}', n)
      : { proposed: m('перенёс задачу #{number} в предложенные', n), open: m('перенёс задачу #{number} в свободные', n), in_progress: m('перенёс задачу #{number} в работу', n), review: m('перенёс задачу #{number} на проверку', n), done: m('закрыл задачу #{number} как выполненную', n), declined: m('перенёс задачу #{number} в отклонённые', n) }[status];
  next = log(next, { projectId: t.projectId, actorId, type: 'task', verb: status === 'done' ? 'closed' : closed(t.status) ? 'reopened' : 'moved', msg, ref: { kind: 'task', id: taskId } });
  return next;
}

// ——— вклады ———

export const MAX_FILES = 10;
/** Самый большой файл: с общей базой — в хранилище, в демо — внутри браузера (места там мало). */
export const FILE_LIMIT = 20 * 1024 * 1024;
export const FILE_LIMIT_DEMO = 1024 * 1024;

/** Проверить список приложенных файлов: только описание файла, сам файл уже загружен. */
export function cleanFiles(files: unknown): Attachment[] {
  if (files === undefined || files === null) return [];
  if (!Array.isArray(files)) throw new OpError(tr('Не удалось прочитать список файлов'));
  if (files.length > MAX_FILES) throw new OpError(tr('Можно приложить не больше {n} файлов', { n: MAX_FILES }));
  return files.map((x): Attachment => {
    const a = (x ?? {}) as Partial<Attachment>;
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 200) : '';
    const url = typeof a.url === 'string' ? a.url : '';
    const size = typeof a.size === 'number' && Number.isFinite(a.size) && a.size >= 0 ? Math.round(a.size) : -1;
    const type = typeof a.type === 'string' ? a.type.slice(0, 120) : '';
    const dataUrl = url.startsWith('data:');
    if (!name || size < 0 || !(dataUrl || /^https?:\/\//.test(url))) throw new OpError(tr('Не удалось прочитать список файлов'));
    if (size > FILE_LIMIT || (dataUrl && url.length > FILE_LIMIT_DEMO * 1.4)) throw new OpError(tr('Файл «{name}» слишком большой', { name }));
    return { name, size, type, url };
  });
}

export interface NewContribution {
  projectId: string;
  taskId?: string;
  title: string;
  summary: string;
  kind: Skill;
  links: string[];
  files?: Attachment[];
  areas: string[];
}

export function submitContribution(s: State, input: NewContribution, actorId: string): { state: State; contribution: Contribution } {
  mustUser(s, actorId);
  need(getProject(s, input.projectId), tr('Проект не найден'));
  const title = input.title.trim();
  if (title.length < 4) throw new OpError(tr('Назовите вклад — что именно вы сделали'));
  if (input.summary.trim().length < 10) throw new OpError(tr('Опишите результат хотя бы парой предложений — так его быстрее проверят'));
  const task = input.taskId ? getTask(s, input.taskId) : undefined;
  if (input.taskId && !task) throw new OpError(tr('Задача не найдена'));
  if (task && task.projectId !== input.projectId) throw new OpError(tr('Задача из другого проекта'));
  if (task && (task.status === 'done' || task.status === 'declined')) throw new OpError(tr('Эта задача уже закрыта'));
  if (task && task.status === 'proposed') throw new OpError(tr('Задачу ещё не открыли сопровождающие'));
  const files = cleanFiles(input.files);
  const now = clock();
  const [s1, number] = takeNumber(s, input.projectId);
  const c: Contribution = {
    id: uid('c'), number, projectId: input.projectId, taskId: input.taskId, authorId: actorId, title, summary: input.summary.trim(),
    kind: input.kind, links: input.links.map((l) => l.trim()).filter(Boolean), ...(files.length ? { files } : {}), areas: input.areas.map((a) => a.trim()).filter(Boolean),
    status: 'open', reviews: [], createdAt: now, updatedAt: now,
  };
  let next: State = touch({ ...s1, contributions: [c, ...s1.contributions] }, input.projectId);
  if (task) {
    next = patchTask(next, task.id, { status: 'review', assigneeId: task.assigneeId ?? actorId });
  }
  next = log(next, { projectId: input.projectId, actorId, type: 'contribution', verb: 'submitted', msg: m('предложил вклад #{number} «{title}»{x3}', { number, title, x3: task ? m(' к задаче #{number}', { number: task.number }) : '' }), ref: { kind: 'contribution', id: c.id } });
  return { state: next, contribution: c };
}

export interface DoneWork {
  title: string;
  summary: string;
  skills: Skill[];
  size: Size;
  milestoneId?: string;
  links: string[];
  files?: Attachment[];
  areas: string[];
}

/**
 * Работа уже сделана: одним шагом создаём задачу (сразу на исполнителе) и вклад к ней.
 * Когда вклад примут, задача закроется как выполненная.
 */
export function submitDoneWork(s: State, projectId: string, input: DoneWork, actorId: string): { state: State; task: Task; contribution: Contribution } {
  mustUser(s, actorId);
  need(getProject(s, projectId), tr('Проект не найден'));
  const title = input.title.trim();
  if (title.length < 4) throw new OpError(tr('Назовите работу — хотя бы несколько слов'));
  if (!input.skills.length) throw new OpError(tr('Отметьте, к какому ремеслу относится работа'));
  if (input.summary.trim().length < 10) throw new OpError(tr('Опишите результат хотя бы парой предложений — так его быстрее проверят'));
  cleanFiles(input.files);
  const now = clock();
  const [s1, number] = takeNumber(s, projectId);
  const task: Task = {
    id: uid('t'), number, projectId, title, description: tr('Работа уже сделана и предложена вкладом.\n\n{x1}', { x1: input.summary.trim() }),
    status: 'in_progress', priority: 'normal', type: 'task', size: input.size, skills: input.skills, milestoneId: input.milestoneId || undefined,
    assigneeId: actorId, dependsOn: [], comments: [], createdBy: actorId, createdAt: now, updatedAt: now,
  };
  let next: State = { ...s1, tasks: [...s1.tasks, task] };
  next = log(next, { projectId, actorId, type: 'task', verb: 'created', msg: m('добавил сделанную работу #{number} «{title}»', { number, title }), ref: { kind: 'task', id: task.id } });
  const r = submitContribution(next, { projectId, taskId: task.id, title, summary: input.summary, kind: input.skills[0], links: input.links, files: input.files, areas: input.areas }, actorId);
  return { state: r.state, task: getTask(r.state, task.id)!, contribution: r.contribution };
}

export function reviewContribution(s: State, contribId: string, verdict: Verdict, text: string, actorId: string): State {
  mustUser(s, actorId);
  const c = need(s.contributions.find((x) => x.id === contribId), tr('Вклад не найден'));
  const p = need(getProject(s, c.projectId), tr('Проект не найден'));
  if (c.status === 'accepted' || c.status === 'rejected') throw new OpError(tr('Решение по вкладу уже принято'));
  if (verdict !== 'comment' && c.authorId === actorId) throw new OpError(tr('Нельзя одобрять или отклонять собственный вклад'));
  if (verdict === 'changes' && !text.trim()) throw new OpError(tr('Напишите, что нужно поправить'));
  if (verdict === 'comment' && !text.trim()) throw new OpError(tr('Комментарий пустой'));
  const review = { id: uid('r'), authorId: actorId, verdict, text: text.trim(), createdAt: clock() };
  const patch: Partial<Contribution> = { reviews: [...c.reviews, review] };
  if (verdict === 'changes' && isMaintainer(p, actorId)) patch.status = 'changes_requested';
  let next = patchContrib(s, contribId, patch);
  const n = { number: c.number, title: c.title };
  next = log(next, { projectId: c.projectId, actorId, type: 'review', verb: 'reviewed', msg: verdict === 'approve' ? m('одобрил #{number} «{title}»', n) : verdict === 'changes' ? m('попросил правки во вкладе #{number} «{title}»', n) : m('прокомментировал вклад #{number} «{title}»', n), ref: { kind: 'contribution', id: c.id } });
  return next;
}

export function updateContribution(s: State, contribId: string, patch: Partial<Pick<Contribution, 'summary' | 'links' | 'files' | 'title' | 'areas'>>, actorId: string): State {
  const c = need(s.contributions.find((x) => x.id === contribId), tr('Вклад не найден'));
  if (c.authorId !== actorId) throw new OpError(tr('Обновить вклад может только его автор'));
  if (c.status === 'accepted' || c.status === 'rejected') throw new OpError(tr('Решение по вкладу уже принято'));
  const clean: Partial<Contribution> = {};
  if (patch.summary !== undefined) clean.summary = String(patch.summary);
  if (patch.title !== undefined) clean.title = String(patch.title);
  if (Array.isArray(patch.links)) clean.links = patch.links.map((l) => String(l).trim()).filter(Boolean);
  if (Array.isArray(patch.areas)) clean.areas = patch.areas.map((a) => String(a).trim()).filter(Boolean);
  if (patch.files !== undefined) clean.files = cleanFiles(patch.files);
  let next = patchContrib(s, contribId, { ...clean, status: 'open' });
  next = log(next, { projectId: c.projectId, actorId, type: 'contribution', verb: 'updated', msg: m('обновил вклад #{number}', { number: c.number }), ref: { kind: 'contribution', id: c.id } });
  return next;
}

export function decideContribution(s: State, contribId: string, decision: Extract<ContributionStatus, 'accepted' | 'rejected'>, note: string, actorId: string): State {
  const c = need(s.contributions.find((x) => x.id === contribId), tr('Вклад не найден'));
  const check = canDecide(s, c, actorId, decision);
  if (!check.ok) throw new OpError(check.reason);
  if (decision === 'rejected' && !note.trim()) throw new OpError(tr('Объясните автору, почему вклад отклонён'));
  const now = clock();
  let next = patchContrib(s, contribId, { status: decision, decidedAt: now, decidedBy: actorId, decisionNote: note.trim() || undefined });
  const task = getTask(next, c.taskId);
  if (task && task.status !== 'done') {
    if (decision === 'accepted') next = patchTask(next, task.id, { status: 'done', assigneeId: task.assigneeId ?? c.authorId });
    else if (task.status === 'review') next = patchTask(next, task.id, { status: 'in_progress' });
  }
  const author = getUser(s, c.authorId)?.name ?? m('участника');
  next = log(next, {
    projectId: c.projectId, actorId, type: 'contribution', verb: decision,
    msg: decision === 'accepted' ? m('принял вклад #{number} «{title}», автор — {author}', { number: c.number, title: c.title, author }) : m('закрыл вклад #{number} «{title}» без принятия', { number: c.number, title: c.title }),
    ref: { kind: 'contribution', id: c.id },
  });
  return next;
}

// ——— обсуждения ———

export function addThread(s: State, projectId: string, input: { title: string; kind: ThreadKind; body: string }, actorId: string): { state: State; thread: Thread } {
  mustUser(s, actorId);
  need(getProject(s, projectId), tr('Проект не найден'));
  if (input.title.trim().length < 4) throw new OpError(tr('Сформулируйте тему обсуждения'));
  if (!input.body.trim()) throw new OpError(tr('Добавьте текст — с чего начинается обсуждение'));
  const now = clock();
  const thread: Thread = {
    id: uid('th'), projectId, title: input.title.trim(), kind: input.kind, authorId: actorId, createdAt: now,
    comments: [{ id: uid('cm'), authorId: actorId, body: input.body.trim(), createdAt: now }],
  };
  let next: State = touch({ ...s, threads: [thread, ...s.threads] }, projectId);
  next = log(next, { projectId, actorId, type: 'discussion', msg: m('открыл обсуждение «{title}»', { title: thread.title }), ref: { kind: 'thread', id: thread.id } });
  return { state: next, thread };
}

export function addComment(s: State, threadId: string, body: string, actorId: string): State {
  mustUser(s, actorId);
  const th = need(s.threads.find((t) => t.id === threadId), tr('Обсуждение не найдено'));
  if (!body.trim()) throw new OpError(tr('Комментарий пустой'));
  const comment = { id: uid('cm'), authorId: actorId, body: body.trim(), createdAt: clock() };
  let next: State = { ...s, threads: s.threads.map((t) => (t.id === threadId ? { ...t, comments: [...t.comments, comment] } : t)) };
  next = log(next, { projectId: th.projectId, actorId, type: 'discussion', msg: m('ответил в обсуждении «{title}»', { title: th.title }), ref: { kind: 'thread', id: th.id } });
  return next;
}

export function recordDecision(s: State, threadId: string, text: string, actorId: string): State {
  const th = need(s.threads.find((t) => t.id === threadId), tr('Обсуждение не найдено'));
  mustMaintain(s, th.projectId, actorId);
  if (!text.trim()) throw new OpError(tr('Запишите, что решили'));
  const decision = { text: text.trim(), by: actorId, at: clock() };
  let next: State = { ...s, threads: s.threads.map((t) => (t.id === threadId ? { ...t, decision } : t)) };
  next = log(next, { projectId: th.projectId, actorId, type: 'decision', msg: m('зафиксировал решение: {text}', { msg: decision.text }), ref: { kind: 'thread', id: th.id } });
  return next;
}

// ——— документы и версии ———

export function saveDoc(s: State, projectId: string, doc: { id?: string; title: string; body: string }, actorId: string): { state: State; docId: string } {
  const p = mustMaintain(s, projectId, actorId);
  if (!doc.title.trim()) throw new OpError(tr('Назовите документ'));
  const now = clock();
  const existing = doc.id ? p.docs.find((d) => d.id === doc.id) : undefined;
  const saved: Doc = { id: existing?.id ?? uid('d'), title: doc.title.trim(), body: doc.body, updatedAt: now, updatedBy: actorId };
  const docs = existing ? p.docs.map((d) => (d.id === existing.id ? saved : d)) : [...p.docs, saved];
  let next = patchProject(s, projectId, { docs });
  next = log(next, { projectId, actorId, type: 'doc', msg: existing ? m('обновил документ «{title}»', { title: saved.title }) : m('добавил документ «{title}»', { title: saved.title }), ref: { kind: 'doc', id: saved.id } });
  return { state: next, docId: saved.id };
}

export function deleteDoc(s: State, projectId: string, docId: string, actorId: string): State {
  const p = mustMaintain(s, projectId, actorId);
  const d = need(p.docs.find((x) => x.id === docId), tr('Документ не найден'));
  let next = patchProject(s, projectId, { docs: p.docs.filter((x) => x.id !== docId) });
  next = log(next, { projectId, actorId, type: 'doc', msg: m('убрал документ «{title}»', { title: d.title }) });
  return next;
}

export function publishRelease(s: State, projectId: string, input: { version: string; title: string; notes: string; url?: string }, actorId: string): State {
  const p = mustMaintain(s, projectId, actorId);
  if (!input.version.trim()) throw new OpError(tr('Укажите номер версии'));
  if (p.releases.some((r) => r.version === input.version.trim())) throw new OpError(tr('Версия с таким номером уже есть'));
  const r: Release = { id: uid('v'), version: input.version.trim(), title: input.title.trim(), notes: input.notes.trim(), url: input.url?.trim() || undefined, createdAt: clock(), authorId: actorId };
  let next = patchProject(s, projectId, { releases: [r, ...p.releases] });
  next = log(next, { projectId, actorId, type: 'release', msg: m('выпустил версию {version}{x2}', { version: r.version, x2: r.title ? m(' — «{title}»', { title: r.title }) : '' }), ref: { kind: 'release', id: r.id } });
  return next;
}

export function setLinks(s: State, projectId: string, links: ProjectLink[], actorId: string): State {
  mustMaintain(s, projectId, actorId);
  return patchProject(s, projectId, { links: links.filter((l) => l.url.trim()) });
}


// ——— ссылки ———

/** Оставляем только http(s)-ссылки: в профиль и проект нельзя подложить javascript: и прочее. */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const withProto = /^[a-z][\w+.-]*:/i.test(u) ? u : `https://${u}`;
  try {
    const p = new URL(withProto);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : null;
  } catch {
    return null;
  }
}

export const cleanSocials = (list: SocialLink[]): SocialLink[] =>
  list.map((x) => ({ kind: x.kind, url: safeUrl(x.url) ?? '' })).filter((x) => x.url);
