// Стартовое наполнение сайта: один проект — сама платформа Commons. Её развивают здесь же:
// любой может предложить идею в обсуждениях или задачу, взять открытую задачу и внести вклад.
// Тексты собираются на языке посетителя при первом открытии.
import { getLang, tr } from '../i18n';
import { contributingDoc, m } from './ops';
import type { Activity, Announcement, Message, Project, State, Task, Thread, User } from './types';

const DAY = 864e5;
export const TEAM_ID = 'u-commons';
export const COMMONS_ID = 'p-commons';

export function buildSeed(now = Date.now()): State {
  const ago = (d: number, h = 0) => now - d * DAY - h * 36e5;

  const team: User = {
    id: TEAM_ID, name: tr('Команда Commons'), handle: 'commons', team: true, gender: 'f', hue: 160, joinedAt: ago(3), country: 'KZ',
    bio: tr('Делаем Commons открыто, на самой платформе. Предлагайте идеи — лучшие станут задачами.'),
    skills: ['code', 'design', 'docs'],
  };

  const concept = [
    tr('## Зачем'),
    tr('Хорошие проекты часто не случаются, потому что у автора идеи нет команды, а у людей с навыками нет понятного способа присоединиться. Commons соединяет их: проект открыт, задачи разложены по ремёслам, а вклад каждого виден.'),
    '',
    tr('## Как это работает'),
    tr('- Проект устроен как репозиторий: документы, задачи с номерами, вклады к задачам, обсуждения и история.'),
    tr('- Любой участник берёт открытую задачу или предлагает свою. Вклад проверяют сопровождающие по правилу проекта.'),
    tr('- Помощник объясняет проект новичку, пишет техническое задание и проверяет вклад, но решения принимают люди.'),
    '',
    tr('## Commons делается на Commons'),
    tr('Этот проект — сама платформа. Чего не хватает, что неудобно, что добавить — пишите в обсуждение «Идеи для Commons» или предлагайте задачу. Сопровождающие разберут предложения и откроют лучшие для всех.'),
    '',
    tr('## Кого ищем'),
    tr('Программистов (общая база, вход, файлы), дизайнеров, носителей казахского, китайского и японского для вычитки переводов, тестировщиков и тех, кто умеет понятно писать инструкции.'),
  ].join('\n');

  const project: Project = {
    id: COMMONS_ID, slug: 'commons', title: 'Commons',
    tagline: tr('Открытая мастерская, где люди разных ремёсел вместе делают проекты. Сама платформа тоже делается здесь'),
    category: 'software', stage: 'prototype', techs: ['React', 'TypeScript', 'Vite'],
    goal: tr('Платформа, где любой может запустить проект или присоединиться к чужому, взять задачу по своему ремеслу и увидеть свой вклад в общем результате.'),
    concept, ownerId: TEAM_ID, maintainerIds: [TEAM_ID], followerIds: [TEAM_ID],
    rolesNeeded: ['code', 'design', 'writing', 'qa', 'docs'],
    milestones: [
      { id: 'm-c1', title: tr('Демо в браузере'), description: tr('Все разделы работают, данные пока хранятся в браузере.') },
      { id: 'm-c2', title: tr('Общая база и вход'), description: tr('Проекты и профили видны всем, вход по почте или через GitHub.') },
      { id: 'm-c3', title: tr('Файлы и уведомления'), description: tr('Загрузка файлов во вкладах, уведомления об ответах и отзывах.') },
      { id: 'm-c4', title: tr('Интеграции'), description: tr('Связь с GitHub, Figma и игровыми движками в обе стороны.') },
    ],
    docs: [
      { id: 'd-c1', title: tr('Концепция'), body: concept, updatedAt: ago(3), updatedBy: TEAM_ID },
      { id: 'd-c2', title: tr('Как участвовать'), body: contributingDoc('owner'), updatedAt: ago(3), updatedBy: TEAM_ID },
    ],
    links: [], socials: [], country: 'KZ', releases: [], license: 'MIT', acceptRule: 'owner', openForForks: true,
    revenue: { policy: 'none', estimate: 0, currency: 'USD', ownerPct: 0, method: 'effort', note: tr('Commons — некоммерческий открытый проект. Если появятся пожертвования или спонсоры, условия обсудим с участниками открыто.') },
    nextNumber: 1, createdAt: ago(3), updatedAt: ago(0, 2),
  };

  let n = 0;
  const T = (o: Pick<Task, 'title' | 'description' | 'skills' | 'priority' | 'size'> & Partial<Pick<Task, 'status' | 'milestoneId' | 'type'>>, at: number): Task => ({
    id: `t-c${++n}`, number: n, projectId: COMMONS_ID, status: 'open', type: 'task', dependsOn: [], comments: [],
    createdBy: TEAM_ID, createdAt: at, updatedAt: at, ...o,
  });
  const crit = (lines: string[]) => `\n\n**${tr('Критерии приёмки')}**\n${lines.map((l) => `- ${l}`).join('\n')}`;

  const tasks: Task[] = [
    T({ title: tr('Демо-версия платформы в браузере'), description: tr('Проекты, задачи, вклады, обсуждения, история и помощник — всё работает без сервера.'), skills: ['code', 'design'], priority: 'high', size: 'L', status: 'done', milestoneId: 'm-c1' }, ago(3)),
    T({ title: tr('Интерфейс на пяти языках'), description: tr('English, русский, қазақша, 中文, 日本語 и переключатель в шапке.'), skills: ['code', 'writing'], priority: 'normal', size: 'M', status: 'done', milestoneId: 'm-c1' }, ago(2)),
    T({ title: tr('Вычитать перевод на казахский'), description: tr('Пройти по всем экранам на казахском и поправить неточности. Список правок можно приложить к вкладу текстом.') + crit([tr('проверены главная, каталог, страница проекта, задача и вклад'), tr('термины переведены единообразно')]), skills: ['writing'], priority: 'normal', size: 'S', milestoneId: 'm-c1' }, ago(2, 3)),
    T({ title: tr('Вычитать перевод на китайский и японский'), description: tr('Нужны носители языка: проверить естественность формулировок и длину подписей на кнопках.') + crit([tr('правки собраны по экранам'), tr('отмечены места, где текст не помещается')]), skills: ['writing'], priority: 'normal', size: 'S', milestoneId: 'm-c1' }, ago(2, 2)),
    T({ title: tr('Проверить все экраны на телефоне'), description: tr('Пройти основные сценарии на узком экране: создать проект, взять задачу, предложить вклад.') + crit([tr('найденные проблемы заведены задачами со скриншотами')]), skills: ['qa', 'design'], priority: 'normal', size: 'S', milestoneId: 'm-c1' }, ago(2, 1)),
    T({ title: tr('Общая база данных и вход'), description: tr('Перенести хранение из браузера на сервер, чтобы проекты и профили видели все. Все изменения уже идут через одну функцию, её и нужно подключить к базе.') + crit([tr('проект, созданный в одном браузере, виден в другом'), tr('вход по почте или через GitHub'), tr('права проверяются на сервере')]), skills: ['code'], priority: 'high', size: 'L', milestoneId: 'm-c2' }, ago(1, 6)),
    T({ title: tr('Загрузка файлов во вкладах'), description: tr('Сейчас во вкладе можно указать только ссылки. Нужна загрузка картинок, моделей и звуков с предпросмотром.'), skills: ['code', 'design'], priority: 'normal', size: 'M', milestoneId: 'm-c3' }, ago(1, 5)),
    T({ title: tr('Уведомления об ответах и отзывах'), description: tr('Сообщать участнику, когда ему ответили, одобрили вклад или попросили правки.'), skills: ['code', 'design'], priority: 'normal', size: 'M', milestoneId: 'm-c3' }, ago(1, 4)),
    T({ title: tr('Руководство для авторов проектов'), description: tr('Как сформулировать замысел, разбить его на задачи и принимать вклады. Короткий текст с примерами.'), skills: ['docs', 'writing'], priority: 'normal', size: 'S', milestoneId: 'm-c1' }, ago(1, 3)),
    T({ title: tr('Иллюстрации для пустых состояний'), description: tr('Небольшие картинки для пустого каталога, пустой доски и профиля без вкладов — в стиле логотипа.'), skills: ['art2d', 'design'], priority: 'low', size: 'S', milestoneId: 'm-c1' }, ago(1, 2)),
    T({ title: tr('Синхронизация задач с GitHub'), description: tr('Задачи и вклады проекта связываются с issues и pull requests подключённого репозитория в обе стороны.'), skills: ['code'], priority: 'low', size: 'L', milestoneId: 'm-c4' }, ago(1, 1)),
  ];
  project.nextNumber = n + 1;

  const threads: Thread[] = [
    {
      id: 'th-c1', projectId: COMMONS_ID, kind: 'idea', authorId: TEAM_ID, createdAt: ago(0, 20),
      title: tr('Идеи для Commons — пишите сюда'),
      comments: [{
        id: 'cm-c1', authorId: TEAM_ID, createdAt: ago(0, 20),
        body: tr('Чего не хватает платформе? Что неудобно? Какие проекты вы бы здесь запустили? Пишите ответом в этой теме — одна идея на сообщение. Самые нужные мы превратим в задачи, и их сможет взять любой участник.'),
      }],
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'n-c1', projectId: COMMONS_ID, authorId: TEAM_ID, kind: 'plan', pinned: true, createdAt: ago(0, 18),
      title: tr('Планы на ближайшие месяцы'),
      body: [
        tr('Сейчас Commons работает как демо: всё хранится в вашем браузере. Следующие шаги:'),
        '',
        tr('1. **Общая база и вход** — чтобы проекты, профили и чаты видели все.'),
        tr('2. **Файлы и уведомления** — загрузка работ прямо во вклад, письма об ответах.'),
        tr('3. **Интеграции** — GitHub, Figma, игровые движки.'),
        '',
        tr('Нужны программисты, дизайнеры и носители казахского, китайского и японского для вычитки перевода. Загляните в задачи или напишите идею в обсуждениях.'),
      ].join('\n'),
    },
  ];
  const messages: Message[] = [
    { id: 'mg-c1', chatId: `project:${COMMONS_ID}`, authorId: TEAM_ID, createdAt: ago(0, 17), body: tr('Добро пожаловать в чат проекта! Здесь можно быстро договориться о задаче или спросить совета. Сообщения на других языках переводятся кнопкой «Перевести».') },
  ];

  const state: State = {
    version: 2, users: [team], projects: [project], tasks, contributions: [], threads, activity: [], announcements, messages, invites: [], readAt: {},
    currentUserId: null, ai: { mode: 'local', apiKey: '', model: 'claude-opus-5-5' }, theme: 'auto', lang: getLang(),
  };
  state.activity = deriveActivity(state);
  return state;
}

/** История для стартового проекта: создание, задачи и обсуждения. */
function deriveActivity(s: State): Activity[] {
  const out: Activity[] = [];
  let i = 0;
  const add = (a: Omit<Activity, 'id'>) => out.push({ id: `a-seed-${i++}`, ...a });
  for (const p of s.projects) add({ projectId: p.id, actorId: p.ownerId, type: 'project', at: p.createdAt, msg: m('создал проект «{title}»', { title: p.title }), ref: { kind: 'project', id: p.id } });
  for (const t of s.tasks) {
    add({ projectId: t.projectId, actorId: t.createdBy, type: 'task', verb: 'created', at: t.createdAt, msg: m('добавил задачу #{number} «{title}»', { number: t.number, title: t.title }), ref: { kind: 'task', id: t.id } });
    if (t.status === 'done') add({ projectId: t.projectId, actorId: t.createdBy, type: 'task', verb: 'closed', at: t.createdAt + DAY * 0.5, msg: m('закрыл задачу #{number} как выполненную', { number: t.number }), ref: { kind: 'task', id: t.id } });
  }
  for (const th of s.threads) add({ projectId: th.projectId, actorId: th.authorId, type: 'discussion', at: th.createdAt, msg: m('открыл обсуждение «{title}»', { title: th.title }), ref: { kind: 'thread', id: th.id } });
  for (const a of s.announcements) add({ projectId: a.projectId, actorId: a.authorId, type: 'announcement', at: a.createdAt, msg: m('опубликовал объявление «{title}»', { title: a.title }), ref: { kind: 'announcement', id: a.id } });
  return out.sort((a, b) => b.at - a.at);
}
