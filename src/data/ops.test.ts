import { describe, expect, it } from 'vitest';
import { buildSeed } from './fixture';
import {
  OpError, addTask, addTaskComment, approvals, assignTask, canDecide, contribByNumber, decideContribution, declineTask, forkProject, getTask,
  registerUser, reviewContribution, slugify, submitContribution, submitDoneWork, takeTask, taskByNumber, updateProject,
} from './ops';

const seed = () => buildSeed(Date.UTC(2026, 9, 25));

describe('демо-данные', () => {
  it('ссылки между сущностями целы', () => {
    const s = seed();
    const users = new Set(s.users.map((u) => u.id));
    const projects = new Set(s.projects.map((p) => p.id));
    const tasks = new Set(s.tasks.map((t) => t.id));
    expect(new Set(s.projects.map((p) => p.slug)).size).toBe(s.projects.length);
    for (const p of s.projects) {
      expect(users.has(p.ownerId)).toBe(true);
      p.maintainerIds.forEach((id) => expect(users.has(id)).toBe(true));
      if (p.forkOf) expect(projects.has(p.forkOf)).toBe(true);
    }
    for (const t of s.tasks) {
      expect(projects.has(t.projectId)).toBe(true);
      if (t.assigneeId) expect(users.has(t.assigneeId)).toBe(true);
      t.dependsOn.forEach((d) => expect(tasks.has(d)).toBe(true));
      if (t.milestoneId) expect(s.projects.find((p) => p.id === t.projectId)!.milestones.some((m) => m.id === t.milestoneId)).toBe(true);
    }
    for (const c of s.contributions) {
      expect(users.has(c.authorId)).toBe(true);
      if (c.taskId) expect(getTask(s, c.taskId)?.projectId).toBe(c.projectId);
    }
    expect(s.activity.length).toBeGreaterThan(50);
  });

  it('документ «Как участвовать» заполнен по правилу проекта', () => {
    const s = seed();
    const doc = s.projects.find((p) => p.id === 'p-gavan')!.docs.find((d) => d.title === 'Как участвовать')!;
    expect(doc.body).toContain('двух одобрений');
  });
});

describe('задачи', () => {
  it('участник предлагает, сопровождающий сразу открывает', () => {
    let s = seed();
    const input = { title: 'Добавить звук шагов', description: '', skills: ['audio' as const], priority: 'normal' as const, size: 'S' as const, type: 'task' as const };
    const a = addTask(s, 'p-gavan', input, 'u-dana');
    expect(a.task.status).toBe('proposed');
    s = a.state;
    const b = addTask(s, 'p-gavan', input, 'u-timur');
    expect(b.task.status).toBe('open');
  });

  it('свободную задачу можно взять один раз', () => {
    const s = takeTask(seed(), 't-g11', 'u-maria');
    expect(getTask(s, 't-g11')).toMatchObject({ status: 'in_progress', assigneeId: 'u-maria' });
    expect(() => takeTask(s, 't-g11', 'u-alina')).toThrow(OpError);
  });

  it('без навыков задачу не создать', () => {
    expect(() => addTask(seed(), 'p-gavan', { title: 'Что-то сделать', description: '', skills: [], priority: 'normal', size: 'S', type: 'task' }, 'u-erlan')).toThrow(/навыки/);
  });
});

describe('вклады и правила принятия', () => {
  it('сдача результата переводит задачу на проверку', () => {
    let s = takeTask(seed(), 't-g11', 'u-maria');
    s = submitContribution(s, { projectId: 'p-gavan', taskId: 't-g11', title: 'Шхуна и баржа', summary: 'Две модели, по 4 800 треугольников, огни отдельным мешем.', kind: 'art3d', links: ['ships.glb'], areas: ['корабли'] }, 'u-maria').state;
    expect(getTask(s, 't-g11')!.status).toBe('review');
  });

  it('«два одобрения»: одного мало, после второго — можно принять', () => {
    let s = seed();
    const c = () => s.contributions.find((x) => x.id === 'c-g6')!;
    expect(approvals(s, c())).toEqual(['u-erlan']);
    expect(canDecide(s, c(), 'u-erlan').ok).toBe(false);
    expect(() => decideContribution(s, 'c-g6', 'accepted', '', 'u-erlan')).toThrow(/два одобрения/);
    s = reviewContribution(s, 'c-g6', 'approve', 'Импорт в Godot без ошибок', 'u-timur');
    expect(canDecide(s, c(), 'u-erlan').ok).toBe(true);
    s = decideContribution(s, 'c-g6', 'accepted', '', 'u-erlan');
    expect(c().status).toBe('accepted');
    expect(getTask(s, 't-g6')!.status).toBe('done');
  });

  it('одобрение от не сопровождающего не считается', () => {
    const s = reviewContribution(seed(), 'c-g6', 'approve', 'Красиво', 'u-alina');
    expect(approvals(s, s.contributions.find((x) => x.id === 'c-g6')!)).toEqual(['u-erlan']);
  });

  it('свой вклад одобрить нельзя', () => {
    expect(() => reviewContribution(seed(), 'c-g6', 'approve', '', 'u-maria')).toThrow(/собственный/);
  });

  it('отклонить можно без одобрений, но с объяснением; задача возвращается в работу', () => {
    const s0 = seed();
    expect(() => decideContribution(s0, 'c-g6', 'rejected', '', 'u-timur')).toThrow(/почему/);
    const s = decideContribution(s0, 'c-g6', 'rejected', 'Нужен другой стиль', 'u-timur');
    expect(s.contributions.find((x) => x.id === 'c-g6')!.status).toBe('rejected');
    expect(getTask(s, 't-g6')!.status).toBe('in_progress');
  });

  it('«только автор»: сопровождающий не может принять', () => {
    let s = seed();
    s = { ...s, projects: s.projects.map((p) => (p.id === 'p-azbuka' ? { ...p, maintainerIds: ['u-olga', 'u-ilya'] } : p)) };
    s = submitContribution(s, { projectId: 'p-azbuka', taskId: 't-a2', title: 'Урок 1', summary: 'Текст урока, пример и задача на двух языках.', kind: 'writing', links: [], areas: ['уроки'] }, 'u-timur').state;
    const c = s.contributions[0];
    expect(canDecide(s, c, 'u-ilya').ok).toBe(false);
    expect(canDecide(s, c, 'u-olga').ok).toBe(true);
  });
});

describe('нумерация и жизнь задачи', () => {
  it('задачи и вклады проекта идут одним счётчиком без повторов', () => {
    const s = seed();
    for (const p of s.projects) {
      const nums = [...s.tasks.filter((t) => t.projectId === p.id), ...s.contributions.filter((c) => c.projectId === p.id)].map((x) => x.number).sort((a, b) => a - b);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
      expect(p.nextNumber).toBe(nums.length + 1);
    }
  });

  it('новая задача и новый вклад получают следующие номера', () => {
    let s = seed();
    const next = s.projects.find((p) => p.id === 'p-gavan')!.nextNumber;
    const a = addTask(s, 'p-gavan', { title: 'Звук шагов по доскам', description: '', skills: ['audio'], priority: 'normal', size: 'S', type: 'task' }, 'u-erlan');
    expect(a.task.number).toBe(next);
    s = takeTask(a.state, a.task.id, 'u-dana');
    const c = submitContribution(s, { projectId: 'p-gavan', taskId: a.task.id, title: 'Шаги по доскам', summary: 'Шесть вариантов шагов, без повторов подряд.', kind: 'audio', links: [], areas: [] }, 'u-dana');
    expect(c.contribution.number).toBe(next + 1);
  });

  it('отклонённая задача остаётся в истории с причиной', () => {
    const s = declineTask(seed(), 't-g17', 'u-erlan', 'Сделаем после релиза');
    const t = getTask(s, 't-g17')!;
    expect(t.status).toBe('declined');
    expect(t.comments.at(-1)!.body).toBe('Сделаем после релиза');
    expect(() => declineTask(seed(), 't-g17', 'u-sergey', '')).toThrow(/сопровождающие/);
  });

  it('сопровождающий назначает и снимает исполнителя', () => {
    let s = assignTask(seed(), 't-g12', 'u-dana', 'u-timur');
    expect(getTask(s, 't-g12')).toMatchObject({ assigneeId: 'u-dana', status: 'in_progress' });
    s = assignTask(s, 't-g12', null, 'u-timur');
    expect(getTask(s, 't-g12')).toMatchObject({ assigneeId: undefined, status: 'open' });
    expect(() => assignTask(seed(), 't-g12', 'u-dana', 'u-dana')).toThrow();
  });

  it('комментарий к задаче попадает в ленту и историю', () => {
    const s = addTaskComment(seed(), 't-g11', 'Начинаю с баржи', 'u-maria');
    expect(getTask(s, 't-g11')!.comments.at(-1)!.body).toBe('Начинаю с баржи');
    expect(s.activity[0]).toMatchObject({ verb: 'commented', ref: { kind: 'task', id: 't-g11' } });
  });

  it('сделанная работа: задача и вклад одним шагом, после принятия задача закрыта', () => {
    const r = submitDoneWork(seed(), 'p-noise', { title: 'Звуки Арбата вечером', summary: 'Три записи по две минуты, Zoom H5, 48 кГц.', skills: ['audio'], size: 'S', links: ['arbat.zip'], areas: ['записи'] }, 'u-alina');
    expect(r.task).toMatchObject({ status: 'review', assigneeId: 'u-alina' });
    expect(r.contribution).toMatchObject({ taskId: r.task.id, number: r.task.number + 1, kind: 'audio' });
    const s = decideContribution(r.state, r.contribution.id, 'accepted', '', 'u-dana');
    expect(getTask(s, r.task.id)!.status).toBe('done');
    expect(() => submitDoneWork(seed(), 'p-noise', { title: 'Нечто', summary: 'коротко', skills: [], size: 'S', links: [], areas: [] }, 'u-alina')).toThrow();
  });

  it('по номеру находится и задача, и вклад', () => {
    const s = seed();
    const t = getTask(s, 't-g6')!;
    expect(taskByNumber(s, 'p-gavan', t.number)?.id).toBe('t-g6');
    const c = s.contributions.find((x) => x.id === 'c-g6')!;
    expect(contribByNumber(s, 'p-gavan', c.number)?.id).toBe('c-g6');
  });
});

describe('проекты', () => {
  it('ответвление копирует незавершённые задачи и помнит источник', () => {
    const { state, project } = forkProject(seed(), 'p-gavan', 'u-sergey', 'Гавань с монстрами');
    expect(project.forkOf).toBe('p-gavan');
    expect(project.ownerId).toBe('u-sergey');
    const tasks = state.tasks.filter((t) => t.projectId === project.id);
    expect(tasks.length).toBeGreaterThan(5);
    expect(tasks.every((t) => t.status === 'open' && !t.assigneeId)).toBe(true);
  });

  it('если автор запретил ответвления — нельзя', () => {
    expect(() => forkProject(seed(), 'p-legends', 'u-sergey')).toThrow(/не разрешил/);
  });

  it('правило принятия меняет только автор', () => {
    expect(() => updateProject(seed(), 'p-gavan', { acceptRule: 'maintainers' }, 'u-timur')).toThrow(/только автор/);
    const s = updateProject(seed(), 'p-gavan', { acceptRule: 'maintainers' }, 'u-erlan');
    expect(s.projects.find((p) => p.id === 'p-gavan')!.acceptRule).toBe('maintainers');
  });

  it('регистрация требует имя и навыки и сразу входит', () => {
    expect(() => registerUser(seed(), { name: 'А', bio: '', skills: ['code'] })).toThrow();
    expect(() => registerUser(seed(), { name: 'Айгерим', bio: '', skills: [] })).toThrow();
    const { state, id } = registerUser(seed(), { name: 'Айгерим Садыкова', bio: '', skills: ['design'] });
    expect(state.currentUserId).toBe(id);
    expect(state.users.find((u) => u.id === id)!.handle).toBe('aygerim-sadykova');
  });

  it('транслитерация адреса', () => {
    expect(slugify('Тихая гавань')).toBe('tihaya-gavan');
    expect(slugify('Қазақ тілі 101')).toBe('kazak-tili-101');
    expect(slugify('!!!')).toBe('project');
  });
});
