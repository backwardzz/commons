// Подбор задач под навыки участника. Те же правила использует встроенный помощник.
import { blockers, getProject, isMaintainer, projectMembers } from '../data/ops';
import { skillInfo, type Project, type State, type Task, type User } from '../data/types';
import { lcFirst } from './format';
import { tr } from '../i18n';

export interface Recommendation {
  task: Task;
  project: Project;
  score: number;
  reasons: string[];
  blockedBy: Task[];
}

const PRIORITY_SCORE = { low: 0, normal: 1, high: 2, critical: 3 } as const;

export function acceptedCount(s: State, userId: string) {
  return s.contributions.filter((c) => c.authorId === userId && c.status === 'accepted').length;
}

export function recommendTasks(s: State, user: User, opts: { projectId?: string; limit?: number } = {}): Recommendation[] {
  const newcomer = acceptedCount(s, user.id) < 2;
  const out: Recommendation[] = [];
  for (const task of s.tasks) {
    if (task.status !== 'open' || task.assigneeId) continue;
    if (opts.projectId && task.projectId !== opts.projectId) continue;
    const match = task.skills.filter((sk) => user.skills.includes(sk));
    if (!match.length) continue;
    const project = getProject(s, task.projectId);
    if (!project) continue;
    const reasons: string[] = [tr('нужен ваш навык: {x1}', { x1: match.map((m) => lcFirst(skillInfo(m).name)).join(', ') })];
    let score = match.length * 3 + PRIORITY_SCORE[task.priority];
    if (task.priority === 'high' || task.priority === 'critical') reasons.push(tr('высокий приоритет для проекта'));
    if (task.type === 'bug') reasons.push(tr('ошибка мешает участникам'));
    if (newcomer && task.size === 'S') { score += 2; reasons.push(tr('небольшая — хороша для первого вклада')); }
    if (project.rolesNeeded.some((r) => match.includes(r))) { score += 1; reasons.push(tr('проекту не хватает людей с этим навыком')); }
    if (projectMembers(s, project).includes(user.id) || isMaintainer(project, user.id)) { score += 1; reasons.push(tr('вы уже участвуете в проекте')); }
    else if (project.followerIds.includes(user.id)) { score += 1; reasons.push(tr('вы следите за проектом')); }
    const blockedBy = blockers(s, task);
    if (blockedBy.length) { score -= 4; reasons.push(tr('сначала нужно закончить: {x1}', { x1: blockedBy.map((b) => `«${b.title}»`).join(', ') })); }
    out.push({ task, project, score, reasons, blockedBy });
  }
  out.sort((a, b) => b.score - a.score || b.task.createdAt - a.task.createdAt);
  return opts.limit ? out.slice(0, opts.limit) : out;
}
