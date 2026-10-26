import { describe, expect, it } from 'vitest';
import { buildSeed as buildFixture } from './fixture';
import { buildSeed } from './seed';
import {
  DEFAULT_REVENUE, answerInvite, conversations, dmChatId, effortReport, markRead, postAnnouncement, projectAnnouncements,
  projectChatId, revenueSplit, sendInvite, sendMessage, setRevenue, unreadTotal, addWork,
} from './community';
import { getProject, getTask, safeUrl, updateUser } from './ops';

const fx = () => buildFixture(Date.UTC(2026, 9, 25));

describe('стартовые данные сайта', () => {
  it('один проект — сама платформа, с задачами, объявлением и обсуждением для идей', () => {
    const s = buildSeed(Date.UTC(2026, 9, 25));
    expect(s.projects).toHaveLength(1);
    expect(s.projects[0].slug).toBe('commons');
    expect(s.tasks.filter((t) => t.status === 'open').length).toBeGreaterThan(5);
    expect(s.threads.some((t) => t.kind === 'idea')).toBe(true);
    expect(s.announcements).toHaveLength(1);
    // под командой платформы войти нельзя
    expect(s.users.every((u) => u.team)).toBe(true);
  });
});

describe('объявления', () => {
  it('публикуют только сопровождающие, закреплённые — сверху', () => {
    const s = fx();
    expect(() => postAnnouncement(s, 'p-gavan', { kind: 'news', title: 'Новость', body: 'Текст' }, 'u-maria')).toThrow(/сопровождающие/);
    const a = postAnnouncement(s, 'p-gavan', { kind: 'news', title: 'Обычная', body: 'Текст' }, 'u-erlan').state;
    const b = postAnnouncement(a, 'p-gavan', { kind: 'plan', title: 'Закреплённая', body: 'Планы', pinned: true }, 'u-timur').state;
    const c = postAnnouncement(b, 'p-gavan', { kind: 'call', title: 'Свежая', body: 'Ищем людей' }, 'u-erlan').state;
    expect(projectAnnouncements(c, 'p-gavan').map((x) => x.title)).toEqual(['Закреплённая', 'Свежая', 'Обычная']);
    expect(c.activity[0].type).toBe('announcement');
  });
});

describe('сообщения и приглашения', () => {
  it('личная переписка видна только участникам и считает непрочитанные', () => {
    let s = fx();
    const chat = dmChatId('u-erlan', 'u-maria');
    s = sendMessage(s, chat, 'Привет!', 'u-erlan');
    expect(() => sendMessage(s, chat, 'Влезу', 'u-dana')).toThrow();
    expect(conversations(s, 'u-maria')[0].unread).toBe(1);
    s = markRead(s, chat, 'u-maria');
    expect(conversations(s, 'u-maria')[0].unread).toBe(0);
    expect(() => sendMessage(s, chat, '   ', 'u-maria')).toThrow(/пустое/);
  });

  it('в чат проекта может писать любой участник платформы', () => {
    const s = sendMessage(fx(), projectChatId('p-gavan'), 'Можно помочь со звуком?', 'u-dana');
    expect(s.messages.at(-1)?.body).toBe('Можно помочь со звуком?');
  });

  it('приглашение с задачей: принять — значит подписаться и взять задачу', () => {
    let s = fx();
    const free = s.tasks.find((t) => t.projectId === 'p-gavan' && t.status === 'open' && !t.assigneeId)!;
    expect(() => sendInvite(s, { toId: 'u-olga', projectId: 'p-gavan', message: 'Привет' }, 'u-maria')).toThrow(/сопровождающие/);
    const r = sendInvite(s, { toId: 'u-olga', projectId: 'p-gavan', taskId: free.id, message: 'Присоединяйтесь' }, 'u-erlan');
    s = r.state;
    expect(unreadTotal(s, 'u-olga')).toBe(2); // сообщение и само приглашение
    expect(() => sendInvite(s, { toId: 'u-olga', projectId: 'p-gavan', message: 'Ещё раз' }, 'u-timur')).toThrow(/уже отправлено/);
    expect(() => answerInvite(s, r.invite.id, true, 'u-maria')).toThrow();
    s = answerInvite(s, r.invite.id, true, 'u-olga');
    expect(getTask(s, free.id)?.assigneeId).toBe('u-olga');
    expect(getProject(s, 'p-gavan')!.followerIds).toContain('u-olga');
    expect(() => answerInvite(s, r.invite.id, false, 'u-olga')).toThrow(/уже ответили/);
  });
});

describe('вклад и доходы', () => {
  it('принятая работа весит больше разговоров, вклады на рассмотрении не считаются', () => {
    const s = fx();
    const p = getProject(s, 'p-gavan')!;
    const rows = effortReport(s, p);
    expect(rows.length).toBeGreaterThan(3);
    const timur = rows.find((r) => r.userId === 'u-timur')!;
    expect(timur.work).toBeGreaterThan(timur.talk);
    expect(rows.every((r) => r.points >= 0)).toBe(true);
    expect(rows[0].points).toBeGreaterThanOrEqual(rows[rows.length - 1].points);
  });

  it('доли в сумме дают 100%, у автора — его доля плюс часть по вкладу', () => {
    const s = fx();
    const p = getProject(s, 'p-gavan')!;
    const rows = effortReport(s, p);
    for (const method of ['effort', 'equal', 'mixed'] as const) {
      const split = revenueSplit(p, rows, { ...DEFAULT_REVENUE, estimate: 1000, ownerPct: 40, method });
      expect(split.reduce((n, r) => n + r.pct, 0)).toBeCloseTo(100, 5);
      expect(split.reduce((n, r) => n + r.amount, 0)).toBeCloseTo(1000, 5);
      expect(split.find((r) => r.owner)!.pct).toBeGreaterThanOrEqual(40);
    }
  });

  it('условия дохода меняет только автор', () => {
    const s = fx();
    expect(() => setRevenue(s, 'p-gavan', { ...DEFAULT_REVENUE, policy: 'share' }, 'u-timur')).toThrow(/только автор/);
    const next = setRevenue(s, 'p-gavan', { ...DEFAULT_REVENUE, policy: 'share', estimate: 5000, currency: 'kzt' }, 'u-erlan');
    expect(getProject(next, 'p-gavan')!.revenue).toMatchObject({ policy: 'share', estimate: 5000, currency: 'KZT' });
    expect(() => setRevenue(s, 'p-gavan', { ...DEFAULT_REVENUE, estimate: -5 }, 'u-erlan')).toThrow();
  });
});

describe('профиль', () => {
  it('ссылки только http(s), опасные отбрасываются', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('github.com/me')).toBe('https://github.com/me');
    const s = updateUser(fx(), 'u-maria', { socials: [{ kind: 'github', url: 'javascript:alert(1)' }, { kind: 'x', url: 'x.com/maria' }] }, );
    expect(s.users.find((u) => u.id === 'u-maria')!.socials).toEqual([{ kind: 'x', url: 'https://x.com/maria' }]);
  });

  it('работы вне проектов попадают в портфолио', () => {
    const s = addWork(fx(), { title: 'Иллюстрации к сказке', description: '', url: 'https://www.behance.net/x', skill: 'art2d', year: 2025 }, 'u-alina');
    expect(s.users.find((u) => u.id === 'u-alina')!.portfolio?.[0].title).toBe('Иллюстрации к сказке');
    expect(() => addWork(fx(), { title: 'Х', description: '', url: 'ftp://x', skill: 'art2d' }, 'u-alina')).toThrow();
  });
});
