// Общение и признание: объявления проекта, чаты, приглашения, портфолио,
// подсчёт вложенных усилий и распределение будущего дохода.
import { tr } from '../i18n';
import { now as clock, uid } from './runtime';
import {
  OpError, getProject, getTask, getUser, isMaintainer, log, m, mustMaintain, mustUser, need, patchProject, projectMembers, safeUrl,
} from './ops';
import type {
  Announcement, AnnouncementKind, Invite, Message, Project, RevenuePlan, Size, State, User, Work,
} from './types';

// ——— объявления ———

export interface NewAnnouncement { kind: AnnouncementKind; title: string; body: string; pinned?: boolean }

export function postAnnouncement(s: State, projectId: string, input: NewAnnouncement, actorId: string): { state: State; announcement: Announcement } {
  mustMaintain(s, projectId, actorId);
  const title = input.title.trim();
  if (title.length < 3) throw new OpError(tr('Добавьте заголовок объявления'));
  if (!input.body.trim()) throw new OpError(tr('Напишите текст объявления'));
  const a: Announcement = { id: uid('n'), projectId, authorId: actorId, kind: input.kind, title, body: input.body.trim(), pinned: !!input.pinned, createdAt: clock() };
  let next: State = { ...s, announcements: [a, ...s.announcements] };
  next = patchProject(next, projectId, {});
  next = log(next, { projectId, actorId, type: 'announcement', msg: m('опубликовал объявление «{title}»', { title }), ref: { kind: 'announcement', id: a.id } });
  return { state: next, announcement: a };
}

export function togglePin(s: State, id: string, actorId: string): State {
  const a = need(s.announcements.find((x) => x.id === id), tr('Объявление не найдено'));
  mustMaintain(s, a.projectId, actorId);
  return { ...s, announcements: s.announcements.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)) };
}

export function deleteAnnouncement(s: State, id: string, actorId: string): State {
  const a = need(s.announcements.find((x) => x.id === id), tr('Объявление не найдено'));
  mustMaintain(s, a.projectId, actorId);
  return { ...s, announcements: s.announcements.filter((x) => x.id !== id) };
}

export const projectAnnouncements = (s: State, projectId: string) =>
  s.announcements.filter((a) => a.projectId === projectId).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt);

// ——— чаты ———

export const projectChatId = (projectId: string) => `project:${projectId}`;
export const dmChatId = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`;
export const dmPeer = (chatId: string, me: string) => chatId.slice(3).split(':').find((x) => x !== me) ?? me;

export function canWrite(s: State, chatId: string, userId: string): boolean {
  if (chatId.startsWith('project:')) return !!getProject(s, chatId.slice(8));
  if (chatId.startsWith('dm:')) return chatId.slice(3).split(':').includes(userId);
  return false;
}

export function sendMessage(s: State, chatId: string, body: string, actorId: string, extra?: Pick<Message, 'inviteId'>): State {
  mustUser(s, actorId);
  const text = body.trim();
  if (!text && !extra?.inviteId) throw new OpError(tr('Сообщение пустое'));
  if (text.length > 4000) throw new OpError(tr('Слишком длинное сообщение — до 4000 символов'));
  if (!canWrite(s, chatId, actorId)) throw new OpError(tr('В этот чат писать нельзя'));
  if (chatId.startsWith('dm:')) {
    const peer = dmPeer(chatId, actorId);
    if (peer === actorId || !getUser(s, peer)) throw new OpError(tr('Собеседник не найден'));
    if (getUser(s, peer)?.team) throw new OpError(tr('Команде платформы лучше писать в обсуждениях проекта Commons'));
  }
  const msg: Message = { id: uid('mg'), chatId, authorId: actorId, body: text, createdAt: clock(), ...extra };
  return { ...s, messages: [...s.messages, msg], readAt: { ...s.readAt, [`${actorId}|${chatId}`]: msg.createdAt } };
}

export function markRead(s: State, chatId: string, userId: string): State {
  const last = chatMessages(s, chatId).at(-1)?.createdAt ?? 0;
  const key = `${userId}|${chatId}`;
  if ((s.readAt[key] ?? 0) >= last) return s;
  return { ...s, readAt: { ...s.readAt, [key]: last } };
}

export const chatMessages = (s: State, chatId: string) => s.messages.filter((x) => x.chatId === chatId);

export function unreadIn(s: State, chatId: string, userId: string): number {
  const seen = s.readAt[`${userId}|${chatId}`] ?? 0;
  return s.messages.filter((x) => x.chatId === chatId && x.authorId !== userId && x.createdAt > seen).length;
}

/** Личные переписки участника: собеседник, последнее сообщение, непрочитанные. */
export function conversations(s: State, userId: string) {
  const ids = new Set(s.messages.filter((x) => x.chatId.startsWith('dm:') && x.chatId.split(':').includes(userId)).map((x) => x.chatId));
  return [...ids].map((chatId) => {
    const list = chatMessages(s, chatId);
    return { chatId, peerId: dmPeer(chatId, userId), last: list[list.length - 1], unread: unreadIn(s, chatId, userId) };
  }).sort((a, b) => b.last.createdAt - a.last.createdAt);
}

export function unreadTotal(s: State, userId: string): number {
  return conversations(s, userId).reduce((n, c) => n + c.unread, 0) + s.invites.filter((i) => i.toId === userId && i.status === 'pending').length;
}

// ——— приглашения в проект ———

export interface NewInvite { toId: string; projectId: string; taskId?: string; message: string }

export function sendInvite(s: State, input: NewInvite, actorId: string): { state: State; invite: Invite } {
  mustUser(s, actorId);
  const p = need(getProject(s, input.projectId), tr('Проект не найден'));
  if (!isMaintainer(p, actorId)) throw new OpError(tr('Приглашать могут только сопровождающие проекта'));
  const to = need(getUser(s, input.toId), tr('Участник не найден'));
  if (to.id === actorId) throw new OpError(tr('Нельзя пригласить самого себя'));
  if (to.team) throw new OpError(tr('Этого участника нельзя пригласить'));
  if (s.invites.some((i) => i.toId === to.id && i.projectId === p.id && i.status === 'pending')) throw new OpError(tr('Приглашение в этот проект уже отправлено'));
  const task = input.taskId ? getTask(s, input.taskId) : undefined;
  if (input.taskId && (!task || task.projectId !== p.id)) throw new OpError(tr('Задача не найдена'));
  if (task && (task.status !== 'open' || task.assigneeId)) throw new OpError(tr('Задача уже занята или закрыта'));
  const invite: Invite = { id: uid('iv'), fromId: actorId, toId: to.id, projectId: p.id, taskId: task?.id, message: input.message.trim(), status: 'pending', createdAt: clock() };
  let next: State = { ...s, invites: [invite, ...s.invites] };
  next = sendMessage(next, dmChatId(actorId, to.id), invite.message, actorId, { inviteId: invite.id });
  return { state: next, invite };
}

export function answerInvite(s: State, inviteId: string, accept: boolean, actorId: string): State {
  const inv = need(s.invites.find((i) => i.id === inviteId), tr('Приглашение не найдено'));
  if (inv.toId !== actorId) throw new OpError(tr('Ответить может только тот, кого пригласили'));
  if (inv.status !== 'pending') throw new OpError(tr('На приглашение уже ответили'));
  const p = need(getProject(s, inv.projectId), tr('Проект не найден'));
  let next: State = { ...s, invites: s.invites.map((i) => (i.id === inviteId ? { ...i, status: accept ? 'accepted' : 'declined', decidedAt: clock() } : i)) };
  if (!accept) return next;
  if (!p.followerIds.includes(actorId)) next = { ...next, projects: next.projects.map((x) => (x.id === p.id ? { ...x, followerIds: [...x.followerIds, actorId] } : x)) };
  const task = getTask(next, inv.taskId);
  if (task && task.status === 'open' && !task.assigneeId) {
    next = { ...next, tasks: next.tasks.map((t) => (t.id === task.id ? { ...t, status: 'in_progress', assigneeId: actorId, updatedAt: clock() } : t)) };
    next = log(next, { projectId: p.id, actorId, type: 'task', verb: 'taken', msg: m('взял в работу #{number} «{title}»', { number: task.number, title: task.title }), ref: { kind: 'task', id: task.id } });
  }
  next = log(next, { projectId: p.id, actorId, type: 'member', msg: m('присоединился к проекту по приглашению'), ref: { kind: 'project', id: p.id } });
  return next;
}

// ——— портфолио ———

export interface NewWork { title: string; description: string; url: string; skill: Work['skill']; year?: number }

export function addWork(s: State, input: NewWork, actorId: string): State {
  const u = mustUser(s, actorId);
  if (input.title.trim().length < 2) throw new OpError(tr('Назовите работу'));
  const url = input.url.trim() ? safeUrl(input.url) : undefined;
  if (input.url.trim() && !url) throw new OpError(tr('Ссылка должна начинаться с https://'));
  const work: Work = { id: uid('w'), title: input.title.trim(), description: input.description.trim(), url: url ?? undefined, skill: input.skill, year: input.year, createdAt: clock() };
  return { ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, portfolio: [work, ...(x.portfolio ?? [])] } : x)) };
}

export function removeWork(s: State, workId: string, actorId: string): State {
  const u = mustUser(s, actorId);
  return { ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, portfolio: (x.portfolio ?? []).filter((w) => w.id !== workId) } : x)) };
}

// ——— вклад участников ———

const SIZE_POINTS: Record<Size, number> = { S: 2, M: 5, L: 13 };

export interface EffortRow {
  userId: string;
  points: number;
  work: number; // принятые вклады и выполненные задачи
  review: number; // отзывы на чужие вклады
  care: number; // задачи, документы, объявления, решения — работа по ведению проекта
  talk: number; // ответы в обсуждениях и комментарии
  accepted: number; // число принятых вкладов
  pending: number; // вклады на рассмотрении, ещё не учтённые в очках
}

/**
 * Очки вклада. Главное — принятая работа (по размеру задачи: S — 2, M — 5, L — 13),
 * меньше весят отзывы, ведение проекта и обсуждения. Правило одно для всех и видно в интерфейсе.
 */
export function effortReport(s: State, p: Project): EffortRow[] {
  const rows = new Map<string, EffortRow>();
  const row = (id: string) => {
    if (!rows.has(id)) rows.set(id, { userId: id, points: 0, work: 0, review: 0, care: 0, talk: 0, accepted: 0, pending: 0 });
    return rows.get(id)!;
  };
  const tasks = s.tasks.filter((t) => t.projectId === p.id);
  const contribs = s.contributions.filter((c) => c.projectId === p.id);
  const creditedTasks = new Set<string>();
  for (const c of contribs) {
    if (c.status === 'accepted') {
      const task = tasks.find((t) => t.id === c.taskId);
      row(c.authorId).work += task ? SIZE_POINTS[task.size] : 3;
      row(c.authorId).accepted += 1;
      if (task) creditedTasks.add(task.id);
    } else if (c.status === 'open' || c.status === 'changes_requested') row(c.authorId).pending += 1;
    for (const r of c.reviews) {
      if (r.authorId === c.authorId) continue;
      row(r.authorId).review += r.verdict === 'comment' ? 0.5 : 1;
    }
  }
  for (const t of tasks) {
    if (t.status === 'done' && t.assigneeId && !creditedTasks.has(t.id)) row(t.assigneeId).work += SIZE_POINTS[t.size];
    if (t.status !== 'declined' && t.status !== 'proposed') row(t.createdBy).care += 0.5;
    for (const cm of t.comments) row(cm.authorId).talk += 0.25;
  }
  for (const th of s.threads.filter((x) => x.projectId === p.id)) {
    th.comments.forEach((cm, i) => { row(cm.authorId).talk += i === 0 ? 0.5 : 0.25; });
    if (th.decision) row(th.decision.by).care += 1;
  }
  for (const a of s.activity) if (a.projectId === p.id && a.type === 'doc') row(a.actorId).care += 1;
  for (const a of s.announcements) if (a.projectId === p.id) row(a.authorId).care += 0.5;
  for (const r of rows.values()) r.points = Math.round((r.work + r.review + r.care + r.talk) * 100) / 100;
  return [...rows.values()].filter((r) => r.points > 0 || r.pending > 0).sort((a, b) => b.points - a.points);
}

export interface SplitRow { userId: string; pct: number; amount: number; owner: boolean }

/** Как разошёлся бы доход: доля автора + распределение остального по выбранному правилу. */
export function revenueSplit(p: Project, rows: EffortRow[], plan: RevenuePlan): SplitRow[] {
  const people = rows.filter((r) => r.points > 0);
  const owner = Math.min(100, Math.max(0, plan.ownerPct));
  const pool = 100 - owner;
  const total = people.reduce((n, r) => n + r.points, 0);
  const pcts = new Map<string, number>([[p.ownerId, owner]]);
  for (const r of people) {
    const byEffort = total ? r.points / total : 0;
    const equal = people.length ? 1 / people.length : 0;
    const share = plan.method === 'effort' ? byEffort : plan.method === 'equal' ? equal : (byEffort + equal) / 2;
    pcts.set(r.userId, (pcts.get(r.userId) ?? 0) + pool * share);
  }
  if (!people.length) pcts.set(p.ownerId, 100);
  return [...pcts].map(([userId, pct]) => ({ userId, pct, amount: (plan.estimate * pct) / 100, owner: userId === p.ownerId }))
    .sort((a, b) => b.pct - a.pct);
}

export const DEFAULT_REVENUE: RevenuePlan = { policy: 'undecided', estimate: 0, currency: 'USD', ownerPct: 30, method: 'effort', note: '' };

export function setRevenue(s: State, projectId: string, plan: RevenuePlan, actorId: string): State {
  const p = need(getProject(s, projectId), tr('Проект не найден'));
  if (p.ownerId !== actorId) throw new OpError(tr('Условия дохода задаёт только автор проекта'));
  if (!Number.isFinite(plan.estimate) || plan.estimate < 0) throw new OpError(tr('Ожидаемый доход — неотрицательное число'));
  if (plan.ownerPct < 0 || plan.ownerPct > 100) throw new OpError(tr('Доля автора — от 0 до 100%'));
  const clean: RevenuePlan = { ...plan, currency: plan.currency.trim().toUpperCase().slice(0, 5) || 'USD', note: plan.note.trim() };
  let next = patchProject(s, projectId, { revenue: clean });
  const policyChanged = (p.revenue?.policy ?? 'undecided') !== clean.policy;
  next = log(next, { projectId, actorId, type: 'project', msg: policyChanged ? m('изменил условия распределения дохода') : m('обновил прогноз дохода'), ref: { kind: 'project', id: projectId } });
  return next;
}

// ——— страны ———

/** Страны участников проекта: код страны → сколько людей. */
export function projectCountries(s: State, p: Project): { code: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const id of projectMembers(s, p)) {
    const c = getUser(s, id)?.country;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n);
}

/** Проекты участника: свои, в которых участвует, на которые подписан. */
export function userProjects(s: State, u: User) {
  const own = s.projects.filter((p) => p.ownerId === u.id);
  const member = s.projects.filter((p) => p.ownerId !== u.id && projectMembers(s, p).includes(u.id));
  return { own, member };
}
