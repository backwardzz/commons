// Реестр действий, которые можно выполнить на сервере. Для каждого указано, в каком аргументе
// (без учёта состояния) стоит автор действия: сервер подставляет туда вошедшего пользователя,
// что бы ни прислал браузер. Действие не из реестра сервер не выполнит.
import * as ops from './ops';
import * as community from './community';
import type { State } from './types';

type Op = (s: State, ...args: never[]) => unknown;
interface Entry { fn: Op; actor: number; args: number }

const e = (fn: Op, actor: number, args: number): Entry => ({ fn, actor, args });

export const REGISTRY: Record<string, Entry> = {
  registerUser: e(ops.registerUser as Op, -1, 1),
  updateUser: e(ops.updateUser as Op, 0, 2),
  createProject: e(ops.createProject as Op, 1, 2),
  updateProject: e(ops.updateProject as Op, 2, 3),
  setMaintainers: e(ops.setMaintainers as Op, 2, 3),
  toggleFollow: e(ops.toggleFollow as Op, 1, 2),
  forkProject: e(ops.forkProject as Op, 1, 3),
  addTask: e(ops.addTask as Op, 2, 3),
  addTasks: e(ops.addTasks as Op, 2, 3),
  editTask: e(ops.editTask as Op, 2, 3),
  addTaskComment: e(ops.addTaskComment as Op, 2, 3),
  approveTask: e(ops.approveTask as Op, 1, 2),
  declineTask: e(ops.declineTask as Op, 1, 3),
  takeTask: e(ops.takeTask as Op, 1, 2),
  assignTask: e(ops.assignTask as Op, 2, 3),
  releaseTask: e(ops.releaseTask as Op, 1, 2),
  moveTask: e(ops.moveTask as Op, 2, 3),
  submitContribution: e(ops.submitContribution as Op, 1, 2),
  submitDoneWork: e(ops.submitDoneWork as Op, 2, 3),
  reviewContribution: e(ops.reviewContribution as Op, 3, 4),
  updateContribution: e(ops.updateContribution as Op, 2, 3),
  decideContribution: e(ops.decideContribution as Op, 3, 4),
  addThread: e(ops.addThread as Op, 2, 3),
  addComment: e(ops.addComment as Op, 2, 3),
  recordDecision: e(ops.recordDecision as Op, 2, 3),
  saveDoc: e(ops.saveDoc as Op, 2, 3),
  deleteDoc: e(ops.deleteDoc as Op, 2, 3),
  publishRelease: e(ops.publishRelease as Op, 2, 3),
  postAnnouncement: e(community.postAnnouncement as Op, 2, 3),
  togglePin: e(community.togglePin as Op, 1, 2),
  deleteAnnouncement: e(community.deleteAnnouncement as Op, 1, 2),
  sendMessage: e(community.sendMessage as Op, 2, 3), // без 4-го аргумента: ссылка на приглашение ставится только сервером
  markRead: e(community.markRead as Op, 1, 2),
  sendInvite: e(community.sendInvite as Op, 1, 2),
  answerInvite: e(community.answerInvite as Op, 2, 3),
  addWork: e(community.addWork as Op, 1, 2),
  removeWork: e(community.removeWork as Op, 1, 2),
  setRevenue: e(community.setRevenue as Op, 2, 3),
};

export type OpName = keyof typeof REGISTRY;

/** Аргументы для запуска: лишние отбрасываются, на место автора ставится вошедший пользователь. */
export function prepareArgs(name: string, args: unknown[], actorId: string): unknown[] {
  const entry = REGISTRY[name];
  if (!entry) throw new ops.OpError(`unknown op ${name}`);
  const out = args.slice(0, entry.args);
  while (out.length < entry.args) out.push(undefined);
  if (entry.actor >= 0) out[entry.actor] = actorId;
  if (name === 'registerUser') out[0] = { ...(out[0] as object), id: actorId };
  return out;
}

/** Результат операции: новое состояние и дополнительные данные (созданный проект и т. п.). */
export function runOp(s: State, name: string, args: unknown[]): { state: State; value: unknown } {
  const res = REGISTRY[name].fn(s, ...(args as never[])) as unknown;
  if (res && typeof res === 'object' && 'version' in res) return { state: res as State, value: res };
  if (res && typeof res === 'object' && 'state' in res) return { state: (res as { state: State }).state, value: res };
  return { state: s, value: res };
}
