// Встроенный помощник: работает без сети и ключей, строит ответы из данных проекта.
// Он скромнее Claude, но всегда доступен и никогда не выдумывает факты о проекте.
import {
  approvals, blockers, getProject, getTask, getUser, milestoneProgress, projectContribs, projectMembers,
  projectProgress, projectTasks,
} from '../data/ops';
import {
  ACCEPT_RULES, SKILLS, STAGES, skillInfo, type Category, type Contribution, type Priority, type Project, type Size,
  type Skill, type State, type Task, type User,
} from '../data/types';
import { dateLabel, lcFirst } from './format';
import { plain } from './markdown';
import { recommendTasks } from './match';
import { tn, tr } from '../i18n';

export interface DraftTask {
  title: string;
  description: string;
  skills: Skill[];
  priority: Priority;
  size: Size;
  milestone?: string; // название этапа, если помощник его предлагает
}

export type FindingLevel = 'ok' | 'warn' | 'risk';
export interface Finding { level: FindingLevel; title: string; detail: string }
export interface ReviewResult { summary: string; findings: Finding[] }

const who = (s: State, id?: string) => getUser(s, id)?.name ?? tr('участник');
const skillList = (sk: Skill[]) => sk.map((x) => lcFirst(skillInfo(x).name)).join(', ');

// «Критерии приёмки» на всех языках интерфейса — по ним помощник находит чек-лист в описании задачи
const CRIT = /критерии приёмки|acceptance criteria|қабылдау критерийлері|验收标准|受け入れ基準/i;
const CRIT_SPLIT = /\*\*(?:Критерии|Acceptance criteria|Қабылдау критерийлері|验收标准|受け入れ基準)/i;

// ——— слова и сходство ———

const STOP = new Set('и в во на с со по для от до из за что как это или не но а к у о об при над под без так уже все всё его её их мы вы они есть быть нужно надо чтобы если когда где который которая которые этот эта эти один одна'.split(' '));

export function words(text: string): string[] {
  return plain(text).toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9әғқңөұүһі]+/i).filter((w) => w.length > 2 && !STOP.has(w));
}
// грубая, но устойчивая основа слова: первые пять букв («персонажа», «персонажей» → «персо»)
const stem = (w: string) => w.slice(0, 5);
export function stems(text: string): Set<string> { return new Set(words(text).map(stem)); }

export function overlap(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) if (b.has(x)) out.push(x);
  return out;
}

function similar(a: string, b: string) {
  const A = stems(a), B = stems(b);
  if (!A.size || !B.size) return 0;
  return overlap(A, B).length / Math.min(A.size, B.size);
}

// ——— объяснение проекта ———

function currentMilestone(s: State, p: Project) {
  return p.milestones.find((m) => { const pr = milestoneProgress(s, m); return pr.total === 0 || pr.done < pr.total; });
}

function headings(md: string): string[] {
  return md.split('\n').filter((l) => /^#{2,3}\s/.test(l)).map((l) => l.replace(/^#+\s*/, ''));
}

function firstSentence(md: string): string {
  const t = plain(md);
  const m = /^(.{20,220}?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t.slice(0, 160) + (t.length > 160 ? '…' : '');
}

export function explainProject(s: State, p: Project): string {
  const pr = projectProgress(s, p);
  const stage = STAGES.find((x) => x.id === p.stage)!;
  const cur = currentMilestone(s, p);
  const tasks = projectTasks(s, p.id);
  const decisions = s.threads.filter((t) => t.projectId === p.id && t.decision);
  const out: string[] = [];
  out.push(tr('## Коротко'), `${p.tagline}.`, '', tr('**Цель:** {goal}', { goal: p.goal }), '');
  out.push(tr('## Как устроен проект'));
  out.push(tr('- Стадия — **{x1}**: {x2}.', { x1: stage.name.toLowerCase(), x2: stage.hint.toLowerCase() }));
  if (p.techs.length) out.push(tr('- Инструменты: {x1}.', { x1: p.techs.join(', ') }));
  out.push(tr('- Правило принятия вкладов: {x1}.', { x1: ACCEPT_RULES.find((r) => r.id === p.acceptRule)!.hint.toLowerCase() }));
  out.push(tr('- Лицензия: {license}.', { license: p.license }));
  const docs = p.docs.filter((d) => d.body.trim());
  if (docs.length) {
    out.push('', tr('**Документы, которые стоит открыть:**'));
    for (const d of docs) {
      const hs = headings(d.body);
      out.push(`- «${d.title}» — ${hs.length ? tr('разделы: {x1}', { x1: hs.slice(0, 4).join(', ').toLowerCase() }) : firstSentence(d.body)}`);
    }
  }
  out.push('', tr('## Где проект сейчас'));
  out.push(tr('Готово {done} из {x2} ({x3}%).', { done: pr.done, x2: tn(pr.total, '{n} задачи|{n} задач|{n} задач'), x3: Math.round(pr.ratio * 100) }));
  if (cur) {
    const mp = milestoneProgress(s, cur);
    out.push(tr('Текущий этап — «{title}»: {x2}. Сделано {done} из {total}.', { title: cur.title, x2: cur.description.replace(/\.$/, '').toLowerCase(), done: mp.done, total: mp.total }));
  }
  const inWork = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review');
  if (inWork.length) {
    out.push('', tr('**Сейчас в работе:**'));
    for (const t of inWork.slice(0, 6)) out.push(`- «${t.title}» — ${who(s, t.assigneeId)}${t.status === 'review' ? tr(', ждёт проверки') : ''}`);
  }
  if (decisions.length) {
    out.push('', tr('**Принятые решения:**'));
    for (const d of decisions) out.push(`- ${d.decision!.text}`);
  }
  const open = tasks.filter((t) => t.status === 'open' && !t.assigneeId);
  const bySkill = SKILLS.map((sk) => ({ sk, n: open.filter((t) => t.skills.includes(sk.id)).length })).filter((x) => x.n > 0);
  if (bySkill.length) {
    out.push('', tr('## Кого не хватает'));
    for (const { sk, n } of bySkill) out.push(`- ${sk.name} — ${tn(n, '{n} свободная задача|{n} свободные задачи|{n} свободных задач')}${p.rolesNeeded.includes(sk.id) ? tr(' (автор ищет людей)') : ''}`);
  }
  const easy = open.filter((t) => t.size === 'S' && !blockers(s, t).length).slice(0, 3);
  if (easy.length) {
    out.push('', tr('## С чего начать новичку'));
    for (const t of easy) out.push(tr('- «{title}» — {x2}, небольшая задача', { title: t.title, x2: skillList(t.skills) }));
  }
  return out.join('\n');
}

// ——— с чего начать конкретному участнику ———

const SKILL_DOCS: Record<Skill, RegExp> = {
  code: /архитект|техническ|сет|формат/i,
  design: /интерфейс|макет|стиль|библи|техническ/i,
  art3d: /арт|стиль|библи|требован|архитект/i,
  art2d: /арт|стиль|библи|требован|кадр/i,
  writing: /сюжет|сценар|концепц|формат|описан/i,
  audio: /звук|музык|запис|концепц/i,
  qa: /техническ|требован|архитект/i,
  docs: /участв|архитект|формат/i,
};

export function onboarding(s: State, p: Project, user: User | undefined): string {
  if (!user) {
    return [
      tr('## Как присоединиться'),
      tr('1. Войдите и отметьте свои навыки — тогда я подберу задачи именно для вас.'),
      tr('2. Прочитайте «Концепцию»: она отвечает на вопрос, зачем этот проект.'),
      tr('3. Откройте доску задач и отфильтруйте её по своему ремеслу.'),
      tr('4. Возьмите свободную задачу или предложите свою.'),
      '',
      tr('Не обязательно быть профессионалом: небольшие задачи помечены размером S.'),
    ].join('\n');
  }
  const recs = recommendTasks(s, user, { projectId: p.id, limit: 4 });
  const out: string[] = [tr('## {x1}, вот что подойдёт вам', { x1: user.name.split(' ')[0] })];
  out.push(tr('Ваши навыки: {x1}.', { x1: skillList(user.skills) }), '');
  if (recs.length) {
    recs.forEach((r, i) => {
      out.push(`${i + 1}. **«${r.task.title}»** — ${r.reasons.join('; ')}.`);
    });
  } else {
    const other = projectTasks(s, p.id).filter((t) => t.status === 'open').length;
    out.push(tr('Свободных задач под ваши навыки сейчас нет{x1}.', { x1: other ? tr(', но есть задачи для других специалистов') : '' }));
    out.push(tr('Можно предложить свою задачу — например, что вы как ') + skillInfo(user.skills[0]).who + tr(' видите недоработанным в проекте.'));
  }
  const docs = p.docs.filter((d) => d.body.trim() && (d.title === 'Концепция' || d.title === tr('Концепция') || user.skills.some((sk) => SKILL_DOCS[sk].test(d.title))));
  if (docs.length) {
    out.push('', tr('## Что прочитать перед началом'));
    for (const d of docs) out.push(`- «${d.title}» — ${firstSentence(d.body)}`);
  }
  const mine = projectTasks(s, p.id).filter((t) => t.assigneeId === user.id && t.status !== 'done');
  if (mine.length) {
    out.push('', tr('## Ваши задачи здесь'));
    for (const t of mine) out.push(`- «${t.title}» — ${t.status === 'review' ? tr('на проверке') : tr('в работе')}`);
  }
  out.push('', tr('Если что-то непонятно, задайте вопрос в обсуждениях — там отвечают люди из команды.'));
  return out.join('\n');
}

// ——— разделение цели на задачи ———

type Tpl = DraftTask & { phase: number };
const t = (title: string, skills: Skill[], description: string, priority: Priority = 'normal', size: Size = 'M', phase = 0): Tpl =>
  ({ title, skills, description, priority, size, phase });

const BASE = (): Record<Category, Tpl[]> => ({
  game: [
    t(tr('Документ с правилами игры'), ['writing', 'docs'], tr('Одна-две страницы: цель игрока, основной цикл, условия победы и поражения.\n\n**Критерии приёмки**\n- понятно человеку, который не видел игру;\n- описан цикл одной партии.'), 'high', 'S', 0),
    t(tr('Прототип основной механики'), ['code'], tr('Серые кубики вместо графики, но играть уже можно. Цель — проверить, интересно ли.\n\n**Критерии приёмки**\n- партию можно начать и закончить;\n- сборка запускается у других участников.'), 'high', 'M', 0),
    t(tr('Концепт-арт мира и персонажей'), ['art2d'], tr('Несколько эскизов, задающих настроение и стиль.\n\n**Критерии приёмки**\n- 3–5 эскизов окружения и главного героя;\n- предложена палитра.'), 'normal', 'M', 0),
    t(tr('Макеты меню и игрового интерфейса'), ['design'], tr('Главное меню, пауза, интерфейс во время игры.\n\n**Критерии приёмки**\n- макеты для клавиатуры и геймпада;\n- состояния: обычное, наведено, недоступно.'), 'normal', 'M', 1),
    t(tr('Модель главного персонажа'), ['art3d'], tr('Финальная модель по концепт-арту.\n\n**Критерии приёмки**\n- ограничения по полигонам согласованы с программистами;\n- базовые анимации: стойка, ходьба.'), 'normal', 'L', 1),
    t(tr('Музыкальная тема и звуки интерфейса'), ['audio'], tr('Главная тема и 5–10 коротких звуков для меню и действий.\n\n**Критерии приёмки**\n- тема бесшовно зацикливается;\n- громкость звуков выровнена.'), 'normal', 'M', 1),
    t(tr('Сценарий плейтеста и первый плейтест'), ['qa'], tr('Что проверяем, кого зовём, какие вопросы задаём после партии.\n\n**Критерии приёмки**\n- отчёт с найденными проблемами по приоритету.'), 'high', 'S', 1),
    t(tr('Сборка для Windows и инструкция запуска'), ['code', 'docs'], tr('Чтобы любой мог скачать и попробовать промежуточную версию.'), 'normal', 'S', 2),
  ],
  software: [
    t(tr('Сценарии использования'), ['docs', 'writing'], tr('Кто пользуется продуктом и что он делает от начала до конца. 3–5 сценариев.\n\n**Критерии приёмки**\n- каждый сценарий описан по шагам;\n- понятно, какой сценарий главный.'), 'high', 'S', 0),
    t(tr('Макеты основных экранов'), ['design'], tr('Экраны главного сценария, включая пустые состояния и ошибки.\n\n**Критерии приёмки**\n- мобильная и широкая версии;\n- состояния: пусто, загрузка, ошибка.'), 'high', 'M', 0),
    t(tr('Каркас приложения и сборка'), ['code'], tr('Проект собирается и запускается одной командой, есть проверки в CI.'), 'high', 'M', 0),
    t(tr('Хранение данных'), ['code'], tr('Модель данных и сохранение. Описать решение в документе «Архитектура».'), 'normal', 'M', 1),
    t(tr('Главный сценарий от начала до конца'), ['code'], tr('Реализация главного сценария по макетам.'), 'high', 'L', 1),
    t(tr('Тест-план и проверка на устройствах'), ['qa'], tr('Список проверок и прогон на 3–4 устройствах.\n\n**Критерии приёмки**\n- найденные ошибки заведены задачами.'), 'normal', 'S', 2),
    t(tr('README и руководство для участников'), ['docs'], tr('Как запустить проект локально и как предложить изменение.'), 'normal', 'S', 0),
  ],
  education: [
    t(tr('Программа курса: темы и результаты'), ['writing', 'docs'], tr('Список тем и что ученик умеет после каждой.'), 'high', 'M', 0),
    t(tr('Первый урок: объяснение, пример, задание'), ['writing'], tr('Короткий урок, который можно сразу показать ученикам.\n\n**Критерии приёмки**\n- текст помещается на один экран телефона;\n- есть задание с проверкой.'), 'high', 'S', 1),
    t(tr('Макет страницы урока'), ['design'], tr('Текст, пример и задание на одном экране; на телефоне — по вкладкам.'), 'normal', 'M', 1),
    t(tr('Иллюстрации и персонаж-проводник'), ['art2d'], tr('Персонаж, который сопровождает ученика. Несколько эмоций.'), 'normal', 'M', 1),
    t(tr('Интерактивные задания с проверкой'), ['code'], tr('Ученик выполняет задание и сразу видит, верно ли.'), 'normal', 'L', 2),
    t(tr('Проверка урока с учениками'), ['qa'], tr('Провести урок с 3–5 учениками и записать, где они застряли.'), 'normal', 'S', 2),
    t(tr('Методичка для учителя'), ['docs'], tr('Как вести урок, сколько времени занимает, частые ошибки учеников.'), 'low', 'M', 2),
  ],
  art: [
    t(tr('Синопсис и сценарий'), ['writing'], tr('О чём история, ключевые сцены, длительность.'), 'high', 'S', 0),
    t(tr('Мудборд и стиль'), ['art2d'], tr('Подборка референсов и пробные кадры в выбранном стиле.'), 'high', 'S', 0),
    t(tr('Раскадровка'), ['art2d'], tr('Все кадры с таймингом под черновую озвучку.'), 'normal', 'M', 1),
    t(tr('Финальные кадры'), ['art2d'], tr('Отрисовка по раскадровке, исходники со слоями.'), 'normal', 'L', 1),
    t(tr('3D-сцены для сложных ракурсов'), ['art3d'], tr('Простая геометрия под покраску для кадров с движением камеры.'), 'low', 'M', 1),
    t(tr('Музыка и звуковое оформление'), ['audio'], tr('Тема и шумовое сопровождение под монтаж.'), 'normal', 'M', 1),
    t(tr('Страница проекта с рассказом о процессе'), ['design', 'docs'], tr('Чтобы зрители увидели и результат, и путь к нему.'), 'low', 'S', 2),
  ],
  audio: [
    t(tr('Правила записи и метаданные'), ['docs'], tr('Формат, длительность, что указывать о каждой записи.'), 'high', 'S', 0),
    t(tr('Первая серия записей'), ['audio'], tr('10–20 записей по правилам.'), 'high', 'M', 0),
    t(tr('Обработка и выравнивание громкости'), ['audio'], tr('Чистка шумов, единая громкость, нарезка.'), 'normal', 'M', 1),
    t(tr('Сайт с поиском и прослушиванием'), ['code', 'design'], tr('Поиск по тегам, прослушивание, скачивание.'), 'normal', 'L', 1),
    t(tr('Проверка качества записей'), ['qa'], tr('Прослушать записи по чек-листу и отметить проблемные.'), 'normal', 'S', 1),
  ],
  other: [
    t(tr('Описание проблемы и аудитории'), ['writing', 'docs'], tr('Кому и зачем нужен результат, как поймём, что получилось.'), 'high', 'S', 0),
    t(tr('План работ по этапам'), ['docs'], tr('Этапы и что будет готово в конце каждого.'), 'high', 'S', 0),
    t(tr('Первый прототип'), ['code', 'design'], tr('Самая простая версия, которую можно показать людям.'), 'normal', 'M', 1),
    t(tr('Оформление и визуальный стиль'), ['design', 'art2d'], tr('Как результат выглядит и узнаётся.'), 'normal', 'M', 1),
    t(tr('Проверка с первыми пользователями'), ['qa'], tr('Показать 3–5 людям и записать, что им непонятно.'), 'normal', 'S', 2),
  ],
});

const EXTRAS = (): { re: RegExp; cats?: Category[]; task: Tpl }[] => [
  { re: /сет|мультипле|кооп|онлайн|вместе|друз/i, cats: ['game'], task: t(tr('Сетевое лобби и синхронизация'), ['code'], tr('Создание комнаты, вход по коду, синхронизация игроков.\n\n**Критерии приёмки**\n- игра по сети без рассинхронизации в течение партии.'), 'high', 'L', 0) },
  { re: /сюжет|истори|диалог|повеств/i, cats: ['game'], task: t(tr('Синопсис и ключевые персонажи'), ['writing'], tr('Краткий сюжет и описание 3–5 персонажей.'), 'normal', 'M', 1) },
  { re: /мобил|телефон|android|ios|смартфон/i, task: t(tr('Адаптация под телефон'), ['design', 'code'], tr('Управление касанием, крупные элементы, работа на слабых устройствах.'), 'normal', 'M', 1) },
  { re: /офлайн|без связи|без интернета|без сети/i, task: t(tr('Офлайн-режим'), ['code'], tr('Главный сценарий работает без сети, данные синхронизируются при появлении связи.'), 'high', 'L', 1) },
  { re: /карт[аеуыо]|маршрут|gps|геолок/i, task: t(tr('Карта и геолокация'), ['code'], tr('Показ карты и положения пользователя, точность и расход батареи.'), 'normal', 'M', 1) },
  { re: /вход в (приложение|систему|аккаунт)|аккаунт|регистрац|авториз|личн\S* кабинет/i, task: t(tr('Вход и профили пользователей'), ['code', 'design'], tr('Регистрация, вход, восстановление доступа.'), 'normal', 'M', 1) },
  { re: /казах|двух язык|перевод|язык[аи]х|многоязыч/i, task: t(tr('Перевод и локализация'), ['writing'], tr('Перевод интерфейса и материалов, глоссарий терминов.'), 'normal', 'M', 2) },
  { re: /музык|звук|саундтрек/i, cats: ['software', 'education', 'other'], task: t(tr('Звуковое оформление'), ['audio'], tr('Звуки интерфейса и фоновая музыка.'), 'low', 'S', 2) },
  { re: /3d|трёхмер|трехмер|модел/i, cats: ['software', 'education', 'other', 'art'], task: t(tr('3D-модели'), ['art3d'], tr('Список моделей и требования к ним, затем сами модели.'), 'normal', 'L', 1) },
  { re: /видео|ролик|анимац/i, cats: ['education', 'software', 'other'], task: t(tr('Короткие видео или анимации'), ['art2d', 'audio'], tr('Ролики, которые объясняют главное за минуту.'), 'low', 'M', 2) },
  { re: /погод|шторм|дожд/i, cats: ['game'], task: t(tr('Система погоды'), ['code'], tr('Смена погоды и её влияние на игру.'), 'normal', 'M', 1) },
];

export function decompose(goal: string, category: Category, project?: { p: Project; tasks: Task[] }): { drafts: DraftTask[]; note: string } {
  const text = `${goal} ${project?.p.concept ?? ''} ${project?.p.title ?? ''}`;
  const list: Tpl[] = [...BASE()[category]];
  for (const e of EXTRAS()) if ((!e.cats || e.cats.includes(category)) && e.re.test(text)) list.push(e.task);
  const existing = project?.tasks ?? [];
  // проекту, который уже в разработке, не предлагаем стартовые задачи вроде первого прототипа
  const late = !!project && ['development', 'beta', 'release'].includes(project.p.stage);
  const relevant = list.filter((d) => !(late && d.phase === 0));
  const fresh = relevant.filter((d) => !existing.some((x) => similar(d.title, `${x.title} ${firstSentence(x.description)}`) >= 0.5));
  const skipped = relevant.length - fresh.length;
  const ms = project?.p.milestones ?? [];
  const drafts = fresh
    .sort((a, b) => a.phase - b.phase)
    .map(({ phase, ...d }) => ({ ...d, milestone: ms.length ? ms[Math.min(phase, ms.length - 1)].title : undefined }));
  const note = [
    tr('Предлагаю {x1}{x2}.', { x1: tn(drafts.length, '{n} задачу|{n} задачи|{n} задач'), x2: skipped ? tr(', ещё {skipped} похожих уже есть на доске', { skipped }) : '' }),
    tr('Отметьте подходящие — они появятся на доске, а вы сможете их поправить.'),
  ].join(' ');
  return { drafts, note };
}

// ——— техническое задание ———

const SKILL_REQ = (): Record<Skill, string[]> => ({
  code: [tr('код собирается и не ломает существующие сцены и тесты'), tr('настройки вынесены так, чтобы их мог менять не программист'), tr('сложные места прокомментированы')],
  design: [tr('макеты для всех состояний: обычное, пустое, загрузка, ошибка'), tr('учтены клавиатура, мышь и сенсорный экран'), tr('исходники доступны участникам')],
  art3d: [tr('формат и масштаб — по документам проекта'), tr('исходник и экспорт приложены'), tr('имена объектов и материалов понятные, на латинице')],
  art2d: [tr('исходники со слоями приложены'), tr('размеры и формат согласованы с тем, где изображение используется'), tr('стиль соответствует арт-документам')],
  writing: [tr('тон и объём согласованы с концепцией'), tr('текст вычитан, имена и термины единообразны'), tr('указано, где текст используется')],
  audio: [tr('формат и частота — по требованиям проекта'), tr('петли зацикливаются без щелчков'), tr('громкость выровнена с остальными звуками')],
  qa: [tr('шаги воспроизведения, ожидаемый и фактический результат'), tr('указаны версия и устройство'), tr('найденные проблемы заведены задачами')],
  docs: [tr('понятно человеку, который впервые видит проект'), tr('есть примеры'), tr('ссылки на связанные документы')],
});

/** Строки документов с конкретными числами и ограничениями — их полезно напомнить исполнителю. */
function constraints(p: Project, skills: Skill[]): string[] {
  const re = /\d[\d\s]*\s?(кадр|треугольн|полигон|мб|гб|секунд|минут|кгц|бит|px|×|x\d|игрок|fps|юнит)/i;
  const out: string[] = [];
  for (const d of p.docs) {
    for (const line of d.body.split('\n')) {
      const l = plain(line);
      if (l.length > 8 && l.length < 160 && re.test(l)) out.push(tr('{x1} (из «{title}»)', { x1: l.replace(/[;.]$/, ''), title: d.title }));
    }
  }
  const relevant = out.filter((l) => {
    if (skills.includes('art3d')) return /треуг|полиг|юнит|glb|масштаб/i.test(l) || /кадр/i.test(l);
    if (skills.includes('code')) return /кадр|игрок|мб|секунд|fps/i.test(l);
    if (skills.includes('audio')) return /кгц|бит|секунд|минут/i.test(l);
    if (skills.includes('art2d') || skills.includes('design')) return /px|×|кадр|формат/i.test(l);
    return true;
  });
  return [...new Set(relevant)].slice(0, 4);
}

export function draftSpec(p: Project, input: { title: string; description: string; skills: Skill[]; milestoneId?: string }): string {
  const ms = p.milestones.find((m) => m.id === input.milestoneId);
  const skills = input.skills.length ? input.skills : (['code'] as Skill[]);
  const out: string[] = [];
  out.push(tr('## Контекст'), tr('Проект «{title}» — {x2}{x3}.{x4}', { title: p.title, x2: p.tagline.charAt(0).toLowerCase(), x3: p.tagline.slice(1), x4: ms ? tr(' Задача относится к этапу «{title}»: {x2}{x3}', { title: ms.title, x2: ms.description.charAt(0).toLowerCase(), x3: ms.description.slice(1) }) : '' }), '');
  out.push(tr('## Что нужно сделать'), input.description.trim() ? plain(input.description.split(CRIT_SPLIT)[0]) : `${input.title}.`, '');
  out.push(tr('## Требования'));
  for (const sk of skills) for (const r of SKILL_REQ()[sk]) out.push(`- ${r};`);
  const cons = constraints(p, skills);
  if (cons.length) {
    out.push('', tr('**Ограничения из документов проекта:**'));
    for (const c of cons) out.push(`- ${c}`);
  }
  out.push('', tr('## Критерии приёмки'));
  out.push(tr('- [ ] результат соответствует описанию задачи «{title}»;', { title: input.title }));
  out.push(tr('- [ ] приложены файлы или ссылки, по которым можно проверить работу;'));
  out.push(tr('- [ ] в описании вклада сказано, что сделано и что осталось;'));
  if (skills.includes('code')) out.push(tr('- [ ] проверено вместе с последней версией проекта;'));
  if (skills.some((x) => x === 'art3d' || x === 'art2d' || x === 'design')) out.push(tr('- [ ] показано в контексте: в сцене, макете или рядом с соседними элементами;'));
  out.push('', tr('## Вне рамок'), tr('- Всё, что не относится к задаче, — отдельными предложениями. Спорные решения выносим в обсуждения.'));
  out.push('', tr('## Кому подойдёт'), `${skills.map((x) => skillInfo(x).who).join(', ')}.`);
  return out.join('\n');
}

// ——— перевод требований между специализациями ———

const GLOSSARY = (): [RegExp, string, string][] => [
  [/(?<![а-яё])риг/i, tr('Риг'), tr('скелет внутри 3D-модели, за который её двигают аниматоры')],
  [/\.?glb\b/i, 'GLB', tr('формат файла 3D-модели, который понимают игровые движки')],
  [/\bLOD\b/i, 'LOD', tr('упрощённые копии модели для дальнего плана — экономят ресурсы')],
  [/кадр[а-яё]* в секунду|\bfps\b/i, tr('Кадры в секунду'), tr('насколько плавно идёт картинка; 60 — плавно, ниже 30 — заметно дёргается')],
  [/service worker/i, 'Service Worker', tr('часть веб-приложения, которая работает без сети и отдаёт сохранённые файлы')],
  [/indexeddb/i, 'IndexedDB', tr('хранилище данных внутри браузера на устройстве пользователя')],
  [/cache storage/i, 'Cache Storage', tr('ещё одно хранилище браузера, удобное для сохранённых файлов')],
  [/шейдер/i, tr('Шейдер'), tr('маленькая программа для видеокарты, которая рисует поверхность — воду, свет, туман')],
  [/частиц|gpuparticles/i, tr('Частицы'), tr('множество мелких элементов — капли, искры, снег')],
  [/эмбиент/i, tr('Эмбиент'), tr('фоновый звук окружения: ветер, море, город')],
  [/петл|зацикл/i, tr('Петля'), tr('фрагмент, который повторяется по кругу без заметного шва')],
  [/тайл/i, tr('Тайлы'), tr('квадратные кусочки карты, из которых она собирается')],
  [/\bpwa\b/i, 'PWA', tr('сайт, который ставится на телефон как приложение')],
  [/(?<![а-яё])хост/i, tr('Хост'), tr('компьютер игрока, который ведёт партию и рассылает остальным её состояние')],
  [/синхрониз/i, tr('Синхронизация'), tr('чтобы у всех игроков или устройств было одно и то же состояние')],
  [/low-poly|низкополиг/i, 'Low-poly', tr('стиль 3D-графики с небольшим числом граней')],
  [/вертикальн[а-яё]* срез/i, tr('Вертикальный срез'), tr('небольшой кусок продукта в финальном качестве — по нему судят о целом')],
  [/плейтест/i, tr('Плейтест'), tr('игровая проверка с живыми людьми')],
  [/раскадровк/i, tr('Раскадровка'), tr('последовательность эскизов будущих кадров')],
  [/аниматик/i, tr('Аниматик'), tr('черновой ролик из раскадровки со звуком')],
  [/\bhud\b/i, 'HUD', tr('интерфейс поверх игры: здоровье, подсказки, инвентарь')],
  [/треугольник|полигон/i, tr('Треугольники'), tr('грани 3D-модели; чем их меньше, тем легче модель для игры')],
  [/\bci\b/i, 'CI', tr('автоматическая проверка, которая запускается при каждом изменении')],
  [/pyodide/i, 'Pyodide', tr('Python, который запускается прямо в браузере')],
];

const ANGLE = (): Record<Skill, string> => ({
  code: tr('Вам важно, какие данные и события нужны, где ограничения по производительности и как это будет проверяться.'),
  design: tr('Ваша часть — как это выглядит и ощущается: что видит человек, как он понимает, что происходит, какие есть состояния и подсказки.'),
  art3d: tr('Вам важно, какие модели или сцены нужны, в каком масштабе и с какими ограничениями по сложности.'),
  art2d: tr('Вам важно, где появится изображение, какого размера и в каком стиле — и можно ли помочь эскизами на раннем этапе.'),
  writing: tr('Вам важно, какие тексты, реплики или описания нужны и каким тоном говорит проект.'),
  audio: tr('Вам важно, какие звуки сопровождают это действие и как они меняются вместе с ним.'),
  qa: tr('Вам важно, как понять, что работа выполнена: что проверить, на чём и какие крайние случаи бывают.'),
  docs: tr('Вам важно, что из этого должен знать следующий участник и где это записать.'),
});

export function translateTask(s: State, task: Task, to: Skill): string {
  const p = getProject(s, task.projectId)!;
  const text = `${task.title}\n${task.description}`;
  const terms = GLOSSARY().filter(([re]) => re.test(text) || p.docs.some((d) => re.test(d.body) && re.test(text)));
  const out: string[] = [];
  out.push(tr('## «{title}» — объяснение для специалиста: {x2}', { title: task.title, x2: lcFirst(skillInfo(to).name) }));
  out.push(tr('Это задача из области: {x1}. Простыми словами: {x2}', { x1: skillList(task.skills), x2: plain(task.description.split(CRIT_SPLIT)[0]) || task.title }));
  out.push('', tr('## Что это значит для вас'), ANGLE()[to]);
  if (task.skills.includes(to)) out.push('', tr('Задача и так относится к вашему ремеслу — её можно взять в работу.'));
  else out.push('', tr('Можно помочь исполнителю: спросите в обсуждениях, нужен ли взгляд со стороны специалиста. {x1} часто замечает то, что пропускают внутри ремесла.', { x1: skillInfo(to).who[0].toUpperCase() + skillInfo(to).who.slice(1) }));
  if (terms.length) {
    out.push('', tr('## Словарик'));
    for (const [, term, def] of terms) out.push(`- **${term}** — ${def}.`);
  }
  return out.join('\n');
}

// ——— проверка вклада ———

function criteria(md: string): string[] {
  const idx = md.search(CRIT);
  if (idx < 0) return [];
  return md.slice(idx).split('\n').slice(1).filter((l) => /^\s*[-*]\s|^\s*-\s\[/.test(l)).map((l) => plain(l.replace(/^\s*[-*]\s*(\[.\]\s*)?/, '')).replace(/[;.]$/, ''));
}

const numbers = (s: string) => (s.replace(/(\d)\s(\d)/g, '$1$2').match(/\d+/g) ?? []).map(Number);

export function reviewContrib(s: State, c: Contribution): ReviewResult {
  const p = getProject(s, c.projectId)!;
  const task = getTask(s, c.taskId);
  const findings: Finding[] = [];
  const body = `${c.title}\n${c.summary}\n${c.links.join(' ')}`;

  if (!task) {
    findings.push({ level: 'warn', title: tr('Вклад не привязан к задаче'), detail: tr('Сопровождающим сложнее понять, какую потребность он закрывает. Если задачи нет, её можно предложить и связать.') });
  } else {
    if (!task.skills.includes(c.kind)) findings.push({ level: 'warn', title: tr('Ремесло вклада не совпадает с задачей'), detail: tr('Задача требует: {x1}, а вклад отмечен как «{x2}».', { x1: skillList(task.skills), x2: lcFirst(skillInfo(c.kind).name) }) });
    if (task.assigneeId && task.assigneeId !== c.authorId) findings.push({ level: 'warn', title: tr('Задачу ведёт другой участник'), detail: tr('Исполнитель — {x1}. Стоит договориться, чтобы работа не дублировалась.', { x1: who(s, task.assigneeId) }) });
    const crit = criteria(task.description);
    if (crit.length) {
      const B = stems(body);
      const bodyNums = numbers(body);
      for (const cr of crit) {
        const nums = numbers(cr);
        const numOk = nums.length ? nums.every((n) => bodyNums.some((b) => b <= n * 1.0001 && b > 0)) : false;
        const hit = overlap(stems(cr), B).length;
        const ok = numOk || hit >= Math.min(2, stems(cr).size);
        findings.push(ok
          ? { level: 'ok', title: tr('Критерий «{cr}»', { cr }), detail: tr('Подтверждение есть в описании вклада.') }
          : { level: 'warn', title: tr('Критерий «{cr}»', { cr }), detail: tr('В описании не нашёл подтверждения — попросите автора уточнить или проверьте файлы.') });
      }
    }
    if (blockers(s, task).length) findings.push({ level: 'warn', title: tr('Есть незавершённые зависимости'), detail: tr('Задача зависит от: {x1}.', { x1: blockers(s, task).map((b) => `«${b.title}»`).join(', ') }) });
  }

  if (plain(c.summary).length < 80) findings.push({ level: 'warn', title: tr('Описание короткое'), detail: tr('Хорошее описание отвечает на вопросы: что сделано, как проверить, что осталось.') });
  if (!c.links.length && c.kind !== 'writing' && c.kind !== 'docs') findings.push({ level: 'warn', title: tr('Нет файлов или ссылок'), detail: tr('Приложите файл, сборку или макет — без них проверить работу нельзя.') });

  // конфликты с другими открытыми вкладами
  const others = projectContribs(s, p.id).filter((o) => o.id !== c.id && (o.status === 'open' || o.status === 'changes_requested'));
  const myAreas = new Set(c.areas.map((a) => a.toLowerCase()));
  for (const o of others) {
    const common = o.areas.filter((a) => myAreas.has(a.toLowerCase()));
    if (o.taskId && o.taskId === c.taskId) findings.push({ level: 'risk', title: tr('Дублирует вклад «{title}»', { title: o.title }), detail: tr('Оба вклада закрывают одну задачу. Автор второго — {x1}.', { x1: who(s, o.authorId) }) });
    else if (common.length) findings.push({ level: 'risk', title: tr('Может конфликтовать с «{title}»', { title: o.title }), detail: tr('Оба меняют: {x1}. Автор — {x2}. Решите, в каком порядке принимать, или объедините работу.', { x1: common.join(', '), x2: who(s, o.authorId) }) });
  }

  // открытые обсуждения по той же теме
  const B = stems(`${c.title} ${c.summary} ${c.areas.join(' ')}`);
  for (const th of s.threads.filter((x) => x.projectId === p.id && !x.decision)) {
    const common = overlap(stems(`${th.title} ${th.comments.map((m) => m.body).join(' ')}`), B);
    if (common.length >= 2) findings.push({ level: 'risk', title: tr('Не решён вопрос «{title}»', { title: th.title }), detail: tr('Обсуждение касается той же части проекта. Лучше зафиксировать решение до принятия вклада.') });
  }

  // замечания в отзывах, оставленные после последнего обновления вклада
  // время последней правки самого автора (а не любого отзыва)
  const authorUpdate = Math.max(c.createdAt, ...s.activity.filter((a) => a.ref?.id === c.id && a.verb === 'updated').map((a) => a.at));
  const notes = c.reviews.filter((r) => r.verdict === 'comment' && r.authorId !== c.authorId && r.createdAt >= authorUpdate);
  for (const r of notes.slice(-2)) {
    findings.push({ level: 'warn', title: tr('Замечание от {x1}', { x1: who(s, r.authorId) }), detail: tr('«{text}» Убедитесь, что оно учтено или обсуждено.', { text: r.text }) });
  }

  // правки и правило проекта
  const pendingChanges = c.reviews.filter((r) => r.verdict === 'changes');
  if (c.status === 'changes_requested' && pendingChanges.length) {
    const last = pendingChanges[pendingChanges.length - 1];
    findings.push({ level: 'warn', title: tr('Ждёт правок'), detail: `${who(s, last.authorId)}: «${last.text}»` });
  }
  const ap = approvals(s, c).length;
  const rule = p.acceptRule === 'two-approvals' ? tr('нужны два одобрения сопровождающих — сейчас {ap}', { ap }) : p.acceptRule === 'owner' ? tr('решение принимает автор, {x1}', { x1: who(s, p.ownerId) }) : tr('решение принимает любой сопровождающий');
  findings.push({ level: 'ok', title: tr('Правило проекта'), detail: rule[0].toUpperCase() + rule.slice(1) + '.' });

  const risks = findings.filter((f) => f.level === 'risk').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  const summary = risks || warns
    ? tr('Нашёл {x1}. Это подсказка: принять или отклонить вклад решают сопровождающие.', { x1: [risks && tn(risks, '{n} риск|{n} риска|{n} рисков'), warns && tn(warns, '{n} замечание|{n} замечания|{n} замечаний')].filter(Boolean).join(tr(' и ')) })
    : tr('Явных проблем не нашёл. Решение о принятии остаётся за сопровождающими.');
  return { summary, findings };
}

// ——— описание состояния проекта ———

export function statusDoc(s: State, p: Project, now = Date.now()): string {
  const pr = projectProgress(s, p);
  const tasks = projectTasks(s, p.id);
  const recent = projectContribs(s, p.id).filter((c) => c.status === 'accepted' && c.decidedAt && now - c.decidedAt < 21 * 864e5);
  const review = projectContribs(s, p.id).filter((c) => c.status === 'open' || c.status === 'changes_requested');
  const out: string[] = [];
  out.push(tr('Обновлено {x1}. Стадия: {x2}. Готово {done} из {total} задач.', { x1: dateLabel(now, now), x2: STAGES.find((x) => x.id === p.stage)!.name.toLowerCase(), done: pr.done, total: pr.total }), '');
  out.push(tr('## Этапы'));
  p.milestones.forEach((m, i) => {
    const mp = milestoneProgress(s, m);
    const mark = mp.total && mp.done === mp.total ? tr('завершён') : mp.done ? tr('{done} из {total}', { done: mp.done, total: mp.total }) : mp.total ? tr('не начат') : tr('задач пока нет');
    out.push(`${i + 1}. **${m.title}** — ${mark}`);
  });
  if (recent.length) {
    out.push('', tr('## Принято за три недели'));
    for (const c of recent) out.push(`- «${c.title}» — ${who(s, c.authorId)}`);
  }
  const work = tasks.filter((t) => t.status === 'in_progress');
  if (work.length) {
    out.push('', tr('## В работе'));
    for (const t of work) out.push(`- «${t.title}» — ${who(s, t.assigneeId)}`);
  }
  if (review.length) {
    out.push('', tr('## Ждут проверки'));
    for (const c of review) out.push(`- «${c.title}» — ${who(s, c.authorId)}${c.status === 'changes_requested' ? tr(' (нужны правки)') : ''}`);
  }
  const next = tasks.filter((t) => t.status === 'open' && (t.priority === 'high' || t.priority === 'critical'));
  if (next.length) {
    out.push('', tr('## Следующие шаги'));
    for (const t of next) out.push(tr('- «{title}» — нужен специалист: {x2}', { title: t.title, x2: skillList(t.skills) }));
  }
  const decisions = s.threads.filter((t) => t.projectId === p.id && t.decision);
  if (decisions.length) {
    out.push('', tr('## Решения'));
    for (const d of decisions) out.push(`- ${d.decision!.text}`);
  }
  out.push('', tr('Участников: {length}. Следят за проектом: {length2}.', { length: projectMembers(s, p).length, length2: p.followerIds.length }));
  return out.join('\n');
}

// ——— черновик концепции для нового проекта ———

export function draftConcept(input: { title: string; goal: string; category: Category; rolesNeeded: Skill[] }): string {
  const g = input.goal.trim().replace(/\.$/, '');
  return [
    tr('## Зачем'),
    g ? `${g}.` : tr('Опишите проблему, которую решает проект, и почему её стоит решать.'),
    '',
    tr('## Для кого'),
    tr('Кто будет пользоваться результатом? Опишите одного-двух конкретных людей и их ситуацию.'),
    '',
    tr('## Как это работает'),
    tr('Главный сценарий в 3–5 шагах: что человек делает от начала до конца.'),
    '',
    tr('## Чем отличается'),
    tr('Что уже существует похожего и почему этого недостаточно.'),
    '',
    tr('## Как поймём, что получилось'),
    tr('Один-два измеримых признака успеха первой версии.'),
    '',
    tr('## Кого ищем'),
    input.rolesNeeded.length ? input.rolesNeeded.map((r) => `- ${skillInfo(r).name}`).join('\n') : tr('- Отметьте навыки, которые нужны проекту.'),
  ].join('\n');
}

// ——— свободный вопрос: поиск по проекту ———

export function answerLocally(s: State, p: Project, question: string, user?: User): string {
  const q = stems(question);
  if (/начать|начинать|чем помочь|какую задачу|что делать|start|begin|how (can|do) i help|which task|бастау|көмектес|қай тапсырма|开始|从哪|怎么帮|哪个任务|始め|手伝|どのタスク/i.test(question)) return onboarding(s, p, user);
  if (/что это|о чём|о чем|объясни|расскажи|зачем|what is|explain|what.*about|бұл не|түсіндір|не туралы|是什么|介绍|解释|とは|説明|何の/i.test(question) && q.size <= 4) return explainProject(s, p);
  type Hit = { score: number; source: string; text: string };
  const hits: Hit[] = [];
  for (const d of p.docs) {
    for (const para of d.body.split(/\n\s*\n/)) {
      const sc = overlap(stems(para), q).length;
      if (sc) hits.push({ score: sc + 0.5, source: tr('документ «{title}»', { title: d.title }), text: plain(para) });
    }
  }
  for (const t of projectTasks(s, p.id)) {
    const sc = overlap(stems(`${t.title} ${t.description}`), q).length;
    if (sc) hits.push({ score: sc, source: tr('задача «{title}»', { title: t.title }), text: plain(t.description) || t.title });
  }
  for (const th of s.threads.filter((x) => x.projectId === p.id)) {
    const sc = overlap(stems(`${th.title} ${th.comments.map((c) => c.body).join(' ')}`), q).length;
    if (sc) hits.push({ score: sc, source: tr('обсуждение «{title}»', { title: th.title }), text: th.decision ? tr('Решение: {text}', { text: th.decision.text }) : plain(th.comments[th.comments.length - 1].body) });
  }
  hits.sort((a, b) => b.score - a.score);
  if (!hits.length) {
    return tr('В документах, задачах и обсуждениях проекта ответа не нашёл. Задайте вопрос в обсуждениях — ответят участники. А если подключить Claude в настройках, я смогу рассуждать, а не только искать.');
  }
  const out = [tr('Вот что нашёл в проекте:'), ''];
  for (const h of hits.slice(0, 3)) out.push(`- **${h.source[0].toUpperCase() + h.source.slice(1)}:** ${h.text.length > 260 ? h.text.slice(0, 260) + '…' : h.text}`);
  out.push('', tr('Я ищу по материалам проекта. Для развёрнутых ответов подключите Claude в настройках.'));
  return out.join('\n');
}

