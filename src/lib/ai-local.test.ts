import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/fixture';
import { getProject, projectTasks, reviewContribution, updateContribution } from '../data/ops';
import { answerLocally, decompose, draftSpec, explainProject, onboarding, reviewContrib, statusDoc, translateTask } from './ai-local';
import { recommendTasks } from './match';

const s = buildSeed(Date.UTC(2026, 9, 25));
const gavan = getProject(s, 'p-gavan')!;
const user = (id: string) => s.users.find((u) => u.id === id)!;

describe('встроенный помощник', () => {
  it('объясняет проект по его данным', () => {
    const text = explainProject(s, gavan);
    expect(text).toContain('Вертикальный срез');
    expect(text).toContain('«Архитектура»');
    expect(text).toContain('Остаёмся на 2–4 игроках');
    expect(text).toMatch(/иллюстрация и 2D/);
  });

  it('подбирает задачи под навыки и учитывает зависимости', () => {
    const recs = recommendTasks(s, user('u-sergey'), { projectId: 'p-gavan' });
    const ids = recs.map((r) => r.task.id);
    expect(ids).toContain('t-g18');
    const playtest = recs.find((r) => r.task.id === 't-g13')!;
    expect(playtest.blockedBy.map((t) => t.id).sort()).toEqual(['t-g6', 't-g7']);
    expect(ids.indexOf('t-g18')).toBeLessThan(ids.indexOf('t-g13'));
    expect(onboarding(s, gavan, user('u-sergey'))).toContain('Персонаж застревает');
  });

  it('находит конфликт двух вкладов и нерешённое обсуждение', () => {
    const c = s.contributions.find((x) => x.id === 'c-t3')!;
    const res = reviewContrib(s, c);
    const risks = res.findings.filter((f) => f.level === 'risk').map((f) => f.title);
    expect(risks.some((t) => t.includes('Предзагрузка района'))).toBe(true);
    expect(risks.some((t) => t.includes('Cache Storage'))).toBe(true);
    expect(res.summary).toMatch(/решают сопровождающие/);
  });

  it('сверяет вклад с критериями приёмки', () => {
    const res = reviewContrib(s, s.contributions.find((x) => x.id === 'c-g6')!);
    const tri = res.findings.find((f) => f.title.includes('3 000 треугольников'))!;
    expect(tri.level).toBe('ok');
    expect(res.findings.find((f) => f.title === 'Правило проекта')!.detail).toContain('сейчас 1');
    expect(res.findings.some((f) => f.title === 'Замечание от Сергей Ким' && f.detail.includes('фонарь'))).toBe(true);
    // чужой отзыв не должен «стирать» замечание — только правка самого автора
    const after = reviewContribution(s, 'c-g6', 'approve', 'Импорт без ошибок', 'u-timur');
    expect(reviewContrib(after, after.contributions.find((x) => x.id === 'c-g6')!).findings.some((f) => f.title.startsWith('Замечание от'))).toBe(true);
    const updated = updateContribution(after, 'c-g6', { summary: 'Исправила кисть: больше не проходит сквозь фонарь. Остальное без изменений.' }, 'u-maria');
    expect(reviewContrib(updated, updated.contributions.find((x) => x.id === 'c-g6')!).findings.some((f) => f.title.startsWith('Замечание от'))).toBe(false);
  });

  it('разбивает цель на задачи и не дублирует существующие', () => {
    const fresh = decompose('Кооперативная игра для друзей с сюжетом', 'game');
    expect(fresh.drafts.some((d) => d.title.includes('Сетевое лобби'))).toBe(true);
    expect(fresh.drafts.some((d) => d.title.includes('Синопсис'))).toBe(true);
    const withProject = decompose(gavan.goal, 'game', { p: gavan, tasks: projectTasks(s, gavan.id) });
    expect(withProject.drafts.some((d) => d.title.includes('Сетевое лобби'))).toBe(false);
    expect(withProject.drafts.every((d) => gavan.milestones.some((m) => m.title === d.milestone))).toBe(true);
    // проект уже в разработке: без стартовых задач, без ложного «входа» из фразы «порог входа»
    const titles = withProject.drafts.map((d) => d.title).join(' | ');
    expect(titles).not.toMatch(/Прототип|Вход и профили|Модель главного персонажа|Музыкальная тема/);
  });

  it('техзадание подтягивает ограничения из документов', () => {
    const spec = draftSpec(gavan, { title: 'Модель чайки', description: 'Птица над маяком', skills: ['art3d'], milestoneId: 'm-g2' });
    expect(spec).toContain('## Критерии приёмки');
    expect(spec).toMatch(/3 000 треугольников/);
    expect(spec).toContain('Вертикальный срез');
  });

  it('переводит задачу для другого ремесла со словариком', () => {
    const t = s.tasks.find((x) => x.id === 't-g6')!;
    const text = translateTask(s, t, 'audio');
    expect(text).toContain('Словарик');
    expect(text).toMatch(/\*\*Риг\*\*/);
    // кириллица после основы слова: «кадров в секунду», «вертикального среза»
    expect(translateTask(s, s.tasks.find((x) => x.id === 't-g7')!, 'design')).toContain('**Кадры в секунду**');
    expect(translateTask(s, s.tasks.find((x) => x.id === 't-g13')!, 'code')).toContain('**Вертикальный срез**');
  });

  it('сводка состояния и поиск по материалам', () => {
    expect(statusDoc(s, gavan)).toContain('## Ждут проверки');
    expect(answerLocally(s, gavan, 'Сколько треугольников можно на персонажа?')).toContain('Архитектура');
  });
});
