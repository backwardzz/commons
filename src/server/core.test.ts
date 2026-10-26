import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { fromRows, toRows } from '../data/entities';
import { record } from '../data/runtime';
import { prepareArgs, runOp } from '../data/registry';
import { execute, stateFromRows } from './core';
import type { State } from '../data/types';

const base = () => stateFromRows(toRows(buildSeed()).values());

/** Применить изменения сервера к состоянию — как это сделала бы база. */
function applyRows(s: State, res: ReturnType<typeof execute>): State {
  if (!res.ok) throw new Error(res.error);
  const rows = toRows(s);
  for (const d of res.deletes) rows.delete(`${d.kind}:${d.id}`);
  for (const u of res.upserts) rows.set(`${u.kind}:${u.id}`, u);
  return stateFromRows(rows.values());
}

/** Действие так, как его отправит браузер: выполнено локально, записаны id и время. */
function fromClient(s: State, op: string, args: unknown[], actor: string) {
  const rec = record(() => runOp(s, op, prepareArgs(op, args, actor)));
  return { req: { op, args, ids: rec.ids, time: rec.time, lang: 'ru' }, local: rec.value.state };
}

describe('серверные действия', () => {
  it('профиль создаётся с id вошедшего, а не с тем, что прислал браузер', () => {
    const s = base();
    const res = execute(s, { op: 'registerUser', args: [{ name: 'Айгерим', bio: '', skills: ['design'], id: 'чужой' }], ids: [], time: Date.now() }, 'auth-uid-1');
    const next = applyRows(s, res);
    expect(next.users.some((u) => u.id === 'auth-uid-1' && u.name === 'Айгерим')).toBe(true);
  });

  it('автор действия — всегда вошедший, подменить его нельзя', () => {
    let s = applyRows(base(), execute(base(), { op: 'registerUser', args: [{ name: 'Ерлан', bio: '', skills: ['code'] }], ids: [], time: Date.now() }, 'u1'));
    // пытаемся от имени команды платформы (сопровождающий) открыть доступ к закрытой операции
    const res = execute(s, { op: 'postAnnouncement', args: ['p-commons', { kind: 'news', title: 'Взлом', body: 'текст' }, 'u-commons'], ids: [], time: Date.now() }, 'u1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(422);
    // а обычное действие проходит и записывается от u1
    const { req } = fromClient(s, 'takeTask', ['t-c3', 'u-commons'], 'u1');
    s = applyRows(s, execute(s, req, 'u1'));
    expect(s.tasks.find((t) => t.id === 't-c3')!.assigneeId).toBe('u1');
  });

  it('сервер повторяет действие браузера с теми же id', () => {
    let s = applyRows(base(), execute(base(), { op: 'registerUser', args: [{ name: 'Дана', bio: '', skills: ['audio'] }], ids: [], time: Date.now() }, 'u2'));
    const { req, local } = fromClient(s, 'addThread', ['p-commons', { title: 'Нужен звук в интерфейсе', kind: 'idea', body: 'Предлагаю короткие звуки' }], 'u2');
    s = applyRows(s, execute(s, req, 'u2'));
    expect(s.threads.map((t) => t.id).sort()).toEqual(local.threads.map((t) => t.id).sort());
  });

  it('нельзя подсунуть id, который уже занят, — так не перезаписать чужое', () => {
    const s = applyRows(base(), execute(base(), { op: 'registerUser', args: [{ name: 'Тимур', bio: '', skills: ['code'] }], ids: [], time: Date.now() }, 'u3'));
    const res = execute(s, { op: 'createProject', args: [{ title: 'Подмена', tagline: '', category: 'other', stage: 'idea', techs: [], goal: 'цель', concept: '', rolesNeeded: [], milestones: [], tasks: [], license: 'MIT', acceptRule: 'owner', openForForks: true }], ids: ['p-commons'], time: Date.now() }, 'u3');
    expect(res.ok).toBe(false);
  });

  it('неизвестные действия и чужие ссылки на приглашения отклоняются', () => {
    const s = base();
    expect(execute(s, { op: 'resetDemo', args: [], ids: [], time: 0 }, 'u4').ok).toBe(false);
    expect(execute(s, { op: '__proto__', args: [], ids: [], time: 0 }, 'u4').ok).toBe(false);
  });

  it('личные сообщения видны только участникам, почта Google не уходит в общий доступ', () => {
    let s = base();
    s = applyRows(s, execute(s, { op: 'registerUser', args: [{ name: 'Аня', bio: '', skills: ['design'], google: { sub: 'g', email: 'a@gmail.com' } }], ids: [], time: Date.now() }, 'ua'));
    s = applyRows(s, execute(s, { op: 'registerUser', args: [{ name: 'Боря', bio: '', skills: ['code'] }], ids: [], time: Date.now() }, 'ub'));
    const { req } = fromClient(s, 'sendMessage', ['dm:ua:ub', 'Привет', 'ua', { inviteId: 'iv-fake' }], 'ua');
    const res = execute(s, req, 'ua');
    if (!res.ok) throw new Error(res.error);
    const msg = res.upserts.find((r) => r.kind === 'message')!;
    expect(msg.visible_to).toEqual(['ua', 'ub']);
    expect((msg.data as { inviteId?: string }).inviteId).toBeUndefined();
    const users = [...toRows(s).values()].filter((r) => r.kind === 'user');
    expect(JSON.stringify(users)).not.toContain('a@gmail.com');
  });

  it('команда платформы при создании профиля становится сопровождающим Commons', () => {
    const s = base();
    const next = applyRows(s, execute(s, { op: 'registerUser', args: [{ name: 'Админ', bio: '', skills: ['code'] }], ids: [], time: Date.now() }, 'admin', { isAdmin: true, adminProjectId: 'p-commons' }));
    expect(next.projects.find((p) => p.id === 'p-commons')!.maintainerIds).toContain('admin');
  });

  it('состояние переживает раскладку на строки и обратно', () => {
    const s = buildSeed(Date.UTC(2026, 9, 25));
    const back = fromRows(toRows(s).values());
    expect(back.projects).toEqual(s.projects);
    expect(back.tasks.length).toBe(s.tasks.length);
    expect(back.activity.length).toBe(s.activity.length);
  });
});
