// Набор данных для тестов (бывшее демо с несколькими проектами). На сайте не используется.
import type { Activity, Contribution, Project, Review, State, Task, Thread, User } from './types';
import { contributingDoc } from './ops';

const DAY = 864e5;

export function buildSeed(now = Date.now()): State {
  const ago = (d: number, h = 0) => now - d * DAY - h * 36e5;

  const FEM = new Set(['u-aruzhan', 'u-maria', 'u-dana', 'u-alina', 'u-olga']);
  const U = (id: string, name: string, handle: string, bio: string, skills: User['skills'], hue: number, joined: number): User =>
    ({ id, name, handle, bio, skills, hue, joinedAt: ago(joined), demo: true, gender: FEM.has(id) ? 'f' : 'm' });

  const users: User[] = [
    U('u-erlan', 'Ерлан Жумабаев', 'erlan', 'Геймдизайнер и программист. Мечтаю о маленьких уютных играх, в которые играют вместе.', ['code', 'writing'], 18, 120),
    U('u-timur', 'Тимур Ахметов', 'timur', 'Пишу игровую логику и инструменты. Люблю, когда код понятен новичку.', ['code', 'docs'], 220, 110),
    U('u-aruzhan', 'Аружан Сейтказы', 'aruzhan', 'Дизайнер интерфейсов. Делаю так, чтобы игроку не приходилось читать инструкцию.', ['design', 'art2d'], 330, 100),
    U('u-maria', 'Мария Лебедева', 'maria', '3D-художница: персонажи, риггинг, стилизованный low-poly.', ['art3d', 'art2d'], 160, 95),
    U('u-ilya', 'Илья Воронцов', 'ilya', 'Сценарист. Пишу диалоги, которые хочется дочитать.', ['writing', 'docs'], 270, 90),
    U('u-dana', 'Дана Нурланова', 'dana', 'Композитор и звукорежиссёр. Записываю город и превращаю его в музыку.', ['audio'], 45, 85),
    U('u-sergey', 'Сергей Ким', 'sergey', 'Тестировщик. Ломаю то, что считается готовым, и аккуратно описываю, как именно.', ['qa', 'code'], 0, 80),
    U('u-alina', 'Алина Гарипова', 'alina', 'Иллюстратор и аниматор. Степь, мифы, текстуры старой бумаги.', ['art2d', 'design'], 300, 75),
    U('u-olga', 'Ольга Миронова', 'olga', 'Учитель информатики. Хочу, чтобы программирование было понятным с первого урока.', ['docs', 'writing'], 130, 60),
    U('u-nikita', 'Никита Павлов', 'nikita', 'Бэкенд, сети, офлайн-режим. В выходные хожу в горы.', ['code', 'qa'], 200, 70),
  ];

  // ——— Проекты ———
  const P = (o: Omit<Project, 'followerIds' | 'updatedAt' | 'docs' | 'releases' | 'links' | 'nextNumber'> & Partial<Pick<Project, 'followerIds' | 'docs' | 'releases' | 'links'>>): Project =>
    ({ followerIds: [], docs: [], releases: [], links: [], updatedAt: o.createdAt, nextNumber: 1, ...o });

  const game = P({
    id: 'p-gavan', slug: 'tihaya-gavan', title: 'Тихая гавань',
    tagline: 'Уютная кооперативная игра о смотрителях маяка на краю северного моря',
    category: 'game', stage: 'development', techs: ['Godot 4', 'GDScript', 'Blender', 'FMOD'],
    goal: 'Сделать небольшую законченную игру для 2–4 игроков, которую можно пройти с друзьями за пару вечеров: смотрители чинят маяк, встречают корабли и вместе переживают шторма.',
    concept: [
      '## Ядро игры',
      'Каждый игрок — смотритель маяка на маленьком острове. Днём вы чините механизмы, собираете выброшенное морем и готовитесь к ночи. Ночью приходят корабли, и маяк должен гореть.',
      '',
      '## Атмосфера',
      'Тёплый свет в холодном море. Никаких врагов — только погода, усталость и время. Игра должна ощущаться как совместное чаепитие во время шторма.',
      '',
      '## Для кого',
      'Для друзей и пар, которые хотят спокойную игру на вечер. Порог входа — как у настольной игры.',
      '',
      '## Что уже есть',
      '- движение, камера и сетевое лобби;',
      '- мини-игра починки;',
      '- блокинг острова и интерфейс инвентаря.',
    ].join('\n'),
    ownerId: 'u-erlan', maintainerIds: ['u-erlan', 'u-timur'],
    followerIds: ['u-erlan', 'u-timur', 'u-maria', 'u-sergey', 'u-aruzhan', 'u-dana', 'u-ilya', 'u-alina'],
    rolesNeeded: ['art3d', 'audio', 'writing', 'qa'],
    milestones: [
      { id: 'm-g1', title: 'Прототип механик', description: 'Движение, сеть, починка — проверяем, что играть интересно.' },
      { id: 'm-g2', title: 'Вертикальный срез', description: 'Один остров и одна ночь в финальном качестве: модели, звук, интерфейс.' },
      { id: 'm-g3', title: 'Сюжет и контент', description: 'Три главы, диалоги, новые острова и корабли.' },
      { id: 'm-g4', title: 'Открытая бета', description: 'Сборки для всех желающих, сбор отзывов, исправление ошибок.' },
    ],
    license: 'MIT', acceptRule: 'two-approvals', openForForks: true, createdAt: ago(58),
    links: [{ kind: 'engine', label: 'Godot 4.3', url: 'https://godotengine.org' }],
  });
  game.docs = [
    { id: 'd-g1', title: 'Концепция', body: game.concept, updatedAt: ago(30), updatedBy: 'u-erlan' },
    {
      id: 'd-g2', title: 'Техническое задание', updatedAt: ago(12), updatedBy: 'u-erlan', body: [
        '## Механики первой версии',
        '1. **Починка.** Механизмы маяка ломаются со временем. Починка — короткая мини-игра с инструментом, длительность 10–20 секунд.',
        '2. **Свет.** Маяк расходует масло. Если свет гаснет, корабль может сесть на мель — команда теряет очки доверия.',
        '3. **Погода.** Шторм усиливает поломки и мешает обзору. Туман требует включить ревун.',
        '4. **Корабли.** За ночь приходит 3–5 кораблей. Каждый приносит припасы, если его встретили.',
        '',
        '## Требования',
        '- от 2 до 4 игроков по сети, вход по коду комнаты;',
        '- 60 кадров в секунду на видеокарте уровня GTX 1050;',
        '- партия-ночь длится 12–15 минут;',
        '- игра понятна без текстового обучения: подсказки — значками и светом.',
        '',
        '## Вне рамок первой версии',
        'Строительство, прокачка персонажей, PvP.',
      ].join('\n'),
    },
    {
      id: 'd-g3', title: 'Архитектура', updatedAt: ago(20), updatedBy: 'u-timur', body: [
        '## Сцены',
        '- `Main` — загрузка и меню;',
        '- `Island` — остров: маяк, причал, склад;',
        '- `Keeper` — персонаж игрока, управляется локально, синхронизируется по сети;',
        '- `Weather` — погода, влияет на освещение и частоту поломок.',
        '',
        '## Глобальные узлы',
        '`Net` (лобби и синхронизация), `Clock` (время суток), `Events` (сигналы игры).',
        '',
        '## Сеть',
        'Хост авторитетен: состояние механизмов и кораблей считается у хоста, клиенты присылают только ввод. Это проще отлаживать и спасает от рассинхронизации.',
        '',
        '## Ассеты',
        'Модели — `.glb` из Blender, масштаб 1 юнит = 1 метр, не больше 3 000 треугольников на персонажа.',
      ].join('\n'),
    },
    {
      id: 'd-g4', title: 'Арт-библия', updatedAt: ago(25), updatedBy: 'u-maria', body: [
        '## Стиль',
        'Стилизованный low-poly без текстур — цвет задаётся вершинами и палитрой. Формы мягкие, без острых углов.',
        '',
        '## Палитра',
        'Холодное море и камень (сине-серые), тёплый свет маяка (янтарь), акценты — красный спасательный круг и жёлтые дождевики.',
        '',
        '## Персонажи',
        'Пропорции 1:4, крупные руки и обувь — их хорошо видно сверху. Лица без детальной мимики, эмоции через позы.',
      ].join('\n'),
    },
    { id: 'd-g5', title: 'Как участвовать', updatedAt: ago(58), updatedBy: 'u-erlan', body: '' },
  ];
  game.releases = [
    { id: 'v-g2', version: '0.2', title: 'Маяк загорается', notes: '- Новая модель маяка и острова\n- Инвентарь\n- Свет маяка расходует масло\n\nИзвестная проблема: персонаж иногда застревает в двери.', url: '', createdAt: ago(9), authorId: 'u-erlan' },
    { id: 'v-g1', version: '0.1', title: 'Первый прототип', notes: '- Движение и камера\n- Лобби на четырёх игроков\n- Мини-игра починки', url: '', createdAt: ago(40), authorId: 'u-erlan' },
  ];

  const tropa = P({
    id: 'p-tropa', slug: 'tropa', title: 'Тропа',
    tagline: 'Офлайн-путеводитель по горным маршрутам Заилийского Алатау',
    category: 'software', stage: 'prototype', techs: ['React', 'TypeScript', 'MapLibre', 'PWA', 'IndexedDB'],
    goal: 'Бесплатное приложение, которое работает в горах без связи: карта, ваш трек, описание маршрута, источники воды и опасные участки.',
    concept: [
      '## Проблема',
      'Связь в горах пропадает уже через час подъёма, а популярные приложения требуют интернет или платную подписку для офлайн-карт.',
      '',
      '## Решение',
      'Веб-приложение, которое ставится на телефон с сайта. Перед походом вы скачиваете район, и дальше всё работает без сети.',
      '',
      '## Принципы',
      '- никаких аккаунтов для основного сценария;',
      '- описания маршрутов пишут сами туристы и проверяют опытные;',
      '- данные открыты, их можно скачать целиком.',
    ].join('\n'),
    ownerId: 'u-nikita', maintainerIds: ['u-nikita', 'u-sergey'], followerIds: ['u-nikita', 'u-sergey', 'u-timur', 'u-olga'],
    rolesNeeded: ['design', 'writing', 'qa', 'docs'],
    milestones: [
      { id: 'm-t1', title: 'Офлайн-карта', description: 'Скачать район и открыть карту без сети.' },
      { id: 'm-t2', title: 'Маршруты и описания', description: 'Двадцать проверенных маршрутов с водой, ночёвками и опасностями.' },
      { id: 'm-t3', title: 'Публичная бета', description: 'Установка на телефон, отзывы туристов.' },
    ],
    license: 'Apache-2.0', acceptRule: 'maintainers', openForForks: true, createdAt: ago(34),
  });
  tropa.docs = [
    { id: 'd-t1', title: 'Концепция', body: tropa.concept, updatedAt: ago(34), updatedBy: 'u-nikita' },
    {
      id: 'd-t2', title: 'Архитектура', updatedAt: ago(15), updatedBy: 'u-nikita', body: [
        '## Как работает офлайн',
        'Service Worker перехватывает запросы к тайлам карты. Скачанный район хранится в IndexedDB: тайлы, маршруты и точки.',
        '',
        '## Данные маршрута',
        'Маршрут — GeoJSON с треком и точками интереса (вода, ночёвка, опасность, развилка). Описание — Markdown.',
        '',
        '## Ограничения',
        'Район — не больше 150 МБ, чтобы помещался на старые телефоны.',
      ].join('\n'),
    },
    {
      id: 'd-t3', title: 'Формат описания маршрута', updatedAt: ago(10), updatedBy: 'u-sergey', body: [
        'Каждое описание отвечает на вопросы:',
        '1. Сколько идти и какой набор высоты.',
        '2. Где вода и где можно встать на ночёвку.',
        '3. Где опасно и что делать при плохой погоде.',
        '4. Как вернуться, если идти дальше нельзя.',
      ].join('\n'),
    },
    { id: 'd-t4', title: 'Как участвовать', updatedAt: ago(34), updatedBy: 'u-nikita', body: '' },
  ];

  const azbuka = P({
    id: 'p-azbuka', slug: 'azbuka-koda', title: 'Азбука кода',
    tagline: 'Интерактивный курс программирования для школьников на казахском и русском',
    category: 'education', stage: 'idea', techs: ['Python', 'Pyodide', 'Markdown'],
    goal: 'Курс из 20 коротких уроков, где ученик пишет код прямо в браузере и сразу видит результат — без установки программ и регистрации.',
    concept: [
      '## Для кого',
      'Ученики 5–9 классов и учителя, у которых нет компьютерного класса с установленным Python.',
      '',
      '## Как устроен урок',
      'Короткое объяснение на одном экране, пример, который можно менять, и задача с автоматической проверкой.',
      '',
      '## Языки',
      'Каждый урок есть на казахском и русском. Термины — с переводом и примером.',
    ].join('\n'),
    ownerId: 'u-olga', maintainerIds: ['u-olga'], followerIds: ['u-olga', 'u-ilya', 'u-timur'],
    rolesNeeded: ['code', 'writing', 'design', 'art2d'],
    milestones: [
      { id: 'm-a1', title: 'Программа курса', description: 'Темы двадцати уроков и что ученик умеет после каждого.' },
      { id: 'm-a2', title: 'Первые пять уроков', description: 'Тексты, примеры и задачи на двух языках.' },
      { id: 'm-a3', title: 'Песочница кода', description: 'Редактор с запуском Python в браузере и проверкой решений.' },
    ],
    license: 'CC BY-SA 4.0', acceptRule: 'owner', openForForks: true, createdAt: ago(16),
  });
  azbuka.docs = [
    { id: 'd-a1', title: 'Концепция', body: azbuka.concept, updatedAt: ago(16), updatedBy: 'u-olga' },
    { id: 'd-a2', title: 'Как участвовать', body: '', updatedAt: ago(16), updatedBy: 'u-olga' },
  ];

  const legends = P({
    id: 'p-legends', slug: 'stepnye-legendy', title: 'Степные легенды',
    tagline: 'Серия коротких анимированных иллюстраций по легендам Великой степи',
    category: 'art', stage: 'development', techs: ['Krita', 'Blender', 'DaVinci Resolve'],
    goal: 'Пять анимированных историй по полторы минуты, каждая — по одной легенде, с озвучкой на казахском и субтитрами на трёх языках.',
    concept: [
      '## Визуальный язык',
      'Живопись в духе старых книжных иллюстраций, ограниченная анимация: движутся свет, ткань, ветер и отдельные персонажи.',
      '',
      '## Легенды',
      'Коркыт, Айман и Шолпан, Козы-Корпеш и Баян-Сулу, Алдар-Косе, Ер-Тостик.',
    ].join('\n'),
    ownerId: 'u-alina', maintainerIds: ['u-alina', 'u-maria'], followerIds: ['u-alina', 'u-maria', 'u-dana', 'u-ilya'],
    rolesNeeded: ['art2d', 'audio', 'writing'],
    milestones: [
      { id: 'm-l1', title: 'Легенда о Коркыте', description: 'Первая история от сценария до финального монтажа.' },
      { id: 'm-l2', title: 'Айман и Шолпан', description: 'Вторая история.' },
      { id: 'm-l3', title: 'Онлайн-выставка', description: 'Страница с историями, эскизами и рассказом о процессе.' },
    ],
    license: 'CC BY 4.0', acceptRule: 'maintainers', openForForks: false, createdAt: ago(45),
  });
  legends.docs = [
    { id: 'd-l1', title: 'Концепция', body: legends.concept, updatedAt: ago(45), updatedBy: 'u-alina' },
    { id: 'd-l2', title: 'Технические требования к кадрам', updatedAt: ago(22), updatedBy: 'u-maria', body: '- Формат 16:9, 1920×1080, 24 кадра в секунду\n- Слои по планам: дальний, средний, персонажи, свет\n- Исходники — PSD или KRA, имена слоёв на латинице' },
    { id: 'd-l3', title: 'Как участвовать', body: '', updatedAt: ago(45), updatedBy: 'u-alina' },
  ];
  legends.releases = [
    { id: 'v-l1', version: '1.0-аниматик', title: 'Коркыт — аниматик', notes: 'Черновой монтаж с раскадровкой и временной музыкой. Нужны отзывы о ритме.', createdAt: ago(6), authorId: 'u-alina' },
  ];

  const noise = P({
    id: 'p-noise', slug: 'shum-goroda', title: 'Шум города',
    tagline: 'Открытая библиотека звуков города для игр, фильмов и подкастов',
    category: 'audio', stage: 'beta', techs: ['Web Audio API', 'FLAC', 'Svelte'],
    goal: 'Собрать 500 чистых записей городских звуков Центральной Азии под лицензией CC0 и сделать удобный сайт с поиском и прослушиванием.',
    concept: [
      '## Зачем',
      'В открытых библиотеках почти нет звуков наших городов: базаров, маршруток, дворов, мечетей, трамваев.',
      '',
      '## Правила записи',
      'Запись не короче 60 секунд, 48 кГц / 24 бит, без узнаваемых голосов крупным планом. К каждой записи — место, время и оборудование.',
    ].join('\n'),
    ownerId: 'u-dana', maintainerIds: ['u-dana'], followerIds: ['u-dana', 'u-erlan', 'u-alina'],
    rolesNeeded: ['audio', 'code', 'qa'],
    milestones: [
      { id: 'm-n1', title: 'Первые 100 записей', description: 'Алматы и Астана.' },
      { id: 'm-n2', title: 'Сайт библиотеки', description: 'Поиск, фильтры, прослушивание, скачивание.' },
    ],
    license: 'CC0', acceptRule: 'owner', openForForks: true, createdAt: ago(70),
  });
  noise.docs = [
    { id: 'd-n1', title: 'Концепция', body: noise.concept, updatedAt: ago(70), updatedBy: 'u-dana' },
    { id: 'd-n2', title: 'Как участвовать', body: '', updatedAt: ago(70), updatedBy: 'u-dana' },
  ];
  noise.releases = [
    { id: 'v-n1', version: '0.9', title: 'Открытая бета сайта', notes: '- 112 записей\n- Поиск по месту и типу звука\n- Скачивание в FLAC и MP3', createdAt: ago(4), authorId: 'u-dana' },
  ];

  const fork = P({
    id: 'p-gavan-noch', slug: 'tihaya-gavan-polyarnaya-noch', title: 'Тихая гавань: Полярная ночь',
    tagline: 'Сюжетное ответвление: одиночная история смотрителя во время полярной ночи',
    category: 'game', stage: 'idea', techs: ['Godot 4', 'GDScript'],
    goal: 'Проверить, работает ли мир «Тихой гавани» как одиночная повествовательная игра на 2–3 часа.',
    concept: 'Ответвление основного проекта. Механики те же, но вместо кооператива — история одного смотрителя и его писем на большую землю.',
    ownerId: 'u-ilya', maintainerIds: ['u-ilya'], followerIds: ['u-ilya'], rolesNeeded: ['writing', 'code'],
    milestones: [{ id: 'm-f1', title: 'Сюжетный прототип', description: 'Первая неделя полярной ночи.' }],
    license: 'MIT', acceptRule: 'owner', openForForks: true, forkOf: 'p-gavan', createdAt: ago(11),
  });
  fork.docs = [{ id: 'd-f1', title: 'Концепция', body: fork.concept, updatedAt: ago(11), updatedBy: 'u-ilya' }];

  const projects = [game, tropa, azbuka, legends, noise, fork];
  for (const p of projects) for (const d of p.docs) if (!d.body) d.body = contributingDoc(p.acceptRule);

  // ——— Задачи ———
  type TaskInit = Partial<Task> & Pick<Task, 'id' | 'projectId' | 'title' | 'skills'> & { at: number };
  const T = (o: TaskInit): Task => ({
    number: 0, comments: [], description: '', status: 'open', priority: 'normal', type: 'task', size: 'M', dependsOn: [],
    createdBy: projects.find((p) => p.id === o.projectId)!.ownerId, createdAt: o.at, updatedAt: o.at, ...o,
  });

  const tasks: Task[] = [
    // Тихая гавань
    T({ id: 't-g1', projectId: 'p-gavan', title: 'Движение персонажа и камера', skills: ['code'], status: 'done', assigneeId: 'u-timur', milestoneId: 'm-g1', at: ago(56), description: 'Управление с клавиатуры и геймпада, камера сверху под углом 50°, плавное следование.' }),
    T({ id: 't-g2', projectId: 'p-gavan', title: 'Сетевое лобби на четырёх игроков', skills: ['code'], status: 'done', assigneeId: 'u-nikita', milestoneId: 'm-g1', priority: 'high', at: ago(55), description: 'Создание комнаты, вход по шестизначному коду, список игроков, готовность.' }),
    T({ id: 't-g3', projectId: 'p-gavan', title: 'Мини-игра починки механизмов', skills: ['code', 'design'], status: 'done', assigneeId: 'u-timur', milestoneId: 'm-g1', at: ago(50), description: 'Игрок выбирает инструмент и попадает в ритм. Длительность 10–20 секунд, сложность растёт в шторм.' }),
    T({ id: 't-g4', projectId: 'p-gavan', title: 'Блокинг острова и маяка', skills: ['art3d'], status: 'done', assigneeId: 'u-maria', milestoneId: 'm-g1', at: ago(48), description: 'Простые формы для проверки масштаба и маршрутов игроков.' }),
    T({ id: 't-g5', projectId: 'p-gavan', title: 'Интерфейс инвентаря', skills: ['design'], status: 'done', assigneeId: 'u-aruzhan', milestoneId: 'm-g2', at: ago(35), description: 'Четыре ячейки на игрока, общий склад на маяке. Управление с геймпада.' }),
    T({
      id: 't-g6', projectId: 'p-gavan', title: 'Модель смотрителя с базовой анимацией', skills: ['art3d'], status: 'review', assigneeId: 'u-maria', milestoneId: 'm-g2', priority: 'high', at: ago(30),
      description: [
        'Нужна финальная модель персонажа игрока по арт-библии.',
        '',
        '**Критерии приёмки**',
        '- до 3 000 треугольников, цвет по вершинам;',
        '- риг совместим с Godot (экспорт `.glb`);',
        '- анимации: стойка, ходьба, бег, починка;',
        '- четыре варианта цвета дождевика для разных игроков.',
      ].join('\n'),
    }),
    T({ id: 't-g7', projectId: 'p-gavan', title: 'Система погоды: шторм и туман', skills: ['code'], status: 'review', assigneeId: 'u-nikita', milestoneId: 'm-g2', priority: 'high', at: ago(28), description: 'Погода меняется за ночь по сценарию. Шторм: дождь, ветер, волны, чаще поломки. Туман: видимость 15 м, корабли сигналят.\n\n**Ограничение:** 60 кадров в секунду на GTX 1050.' }),
    T({ id: 't-g8', projectId: 'p-gavan', title: 'Главная тема: музыка маяка', skills: ['audio'], status: 'in_progress', assigneeId: 'u-dana', milestoneId: 'm-g2', at: ago(21), description: 'Спокойная тема на 2–3 минуты, которая бесшовно зацикливается. Инструменты: гармонь, виолончель, звон буя.' }),
    T({ id: 't-g9', projectId: 'p-gavan', title: 'Пролог: диалог смотрителя и капитана', skills: ['writing'], status: 'in_progress', assigneeId: 'u-ilya', milestoneId: 'm-g3', at: ago(18), description: 'Первая встреча с капитаном баржи. Объясняет правила мира без прямых инструкций. 20–30 реплик.' }),
    T({ id: 't-g10', projectId: 'p-gavan', title: 'Экран настроек и меню паузы', skills: ['design', 'code'], status: 'in_progress', assigneeId: 'u-aruzhan', milestoneId: 'm-g2', size: 'S', at: ago(14), description: 'Громкость, яркость, раскладка управления, язык. Пауза в сетевой игре не останавливает мир — только открывает меню.' }),
    T({
      id: 't-g11', projectId: 'p-gavan', title: 'Модели кораблей: шхуна и баржа', skills: ['art3d'], milestoneId: 'm-g2', priority: 'high', at: ago(13),
      description: 'Два корабля, которые подходят к острову ночью.\n\n**Критерии приёмки**\n- до 5 000 треугольников каждый;\n- огни на мачте отдельным мешем — их включает игра;\n- стиль по арт-библии.',
    }),
    T({ id: 't-g12', projectId: 'p-gavan', title: 'Звуки моря и ветра', skills: ['audio'], milestoneId: 'm-g2', size: 'S', at: ago(12), description: 'Три слоя эмбиента: штиль, ветер, шторм. Каждый — бесшовная петля 60–90 секунд, формат OGG.' }),
    T({ id: 't-g13', projectId: 'p-gavan', title: 'Плейтест вертикального среза', skills: ['qa'], milestoneId: 'm-g2', priority: 'high', size: 'S', dependsOn: ['t-g6', 't-g7'], at: ago(12), description: 'Сценарий проверки: что пробуем, на чём играем, какие вопросы задаём игрокам после партии. Итог — отчёт с проблемами по приоритету.' }),
    T({ id: 't-g14', projectId: 'p-gavan', title: 'Синопсис глав 1–3', skills: ['writing'], milestoneId: 'm-g3', at: ago(10), description: 'Кратко: что происходит в каждой главе, какие корабли приходят, как меняется остров. Одна страница на главу.' }),
    T({ id: 't-g15', projectId: 'p-gavan', title: 'Гайд по сетевому коду для новичков', skills: ['docs', 'code'], milestoneId: 'm-g2', priority: 'low', size: 'S', at: ago(8), description: 'Как устроена синхронизация, как добавить новый сетевой объект, как тестировать вдвоём на одном компьютере.' }),
    T({ id: 't-g16', projectId: 'p-gavan', title: 'Иконки предметов для инвентаря', skills: ['art2d'], milestoneId: 'm-g2', size: 'S', at: ago(7), description: '12 иконок 64×64: масло, ключ, молоток, верёвка, фонарь и др. Список — в макете инвентаря.' }),
    T({ id: 't-g17', projectId: 'p-gavan', title: 'Фоторежим', skills: ['code'], type: 'idea', status: 'proposed', createdBy: 'u-sergey', priority: 'low', size: 'S', at: ago(3), description: 'Свободная камера и скрытие интерфейса, чтобы делать красивые кадры маяка в шторм.' }),
    T({ id: 't-g18', projectId: 'p-gavan', title: 'Персонаж застревает в двери маяка', skills: ['code', 'qa'], type: 'bug', status: 'open', createdBy: 'u-sergey', priority: 'high', size: 'S', milestoneId: 'm-g2', at: ago(8), description: 'Версия 0.2. Если заходить в дверь по диагонали с бегом, персонаж застревает в косяке. Воспроизводится в 3 случаях из 5.' }),

    // Тропа
    T({ id: 't-t1', projectId: 'p-tropa', title: 'Карта на MapLibre с векторными тайлами', skills: ['code'], status: 'done', assigneeId: 'u-nikita', milestoneId: 'm-t1', at: ago(33) }),
    T({ id: 't-t2', projectId: 'p-tropa', title: 'Запись трека по GPS в фоне', skills: ['code'], status: 'done', assigneeId: 'u-timur', milestoneId: 'm-t1', at: ago(30) }),
    T({ id: 't-t3', projectId: 'p-tropa', title: 'Скачивание района для офлайна', skills: ['code'], status: 'review', assigneeId: 'u-timur', milestoneId: 'm-t1', priority: 'critical', at: ago(20), description: 'Пользователь выбирает прямоугольник на карте, видит размер и скачивает. Прогресс, отмена, докачка.' }),
    T({ id: 't-t4', projectId: 'p-tropa', title: 'Макеты экрана маршрута', skills: ['design'], milestoneId: 'm-t2', priority: 'high', at: ago(18), description: 'Экран маршрута: профиль высот, точки воды и ночёвок, кнопка «Начать». Важно: читаемость на солнце и в перчатках.' }),
    T({ id: 't-t5', projectId: 'p-tropa', title: 'Описание маршрута: Большое Алматинское озеро', skills: ['writing'], milestoneId: 'm-t2', size: 'S', at: ago(15), description: 'По шаблону из документа «Формат описания маршрута».' }),
    T({ id: 't-t6', projectId: 'p-tropa', title: 'Описание маршрута: пик Фурманова', skills: ['writing'], milestoneId: 'm-t2', size: 'S', at: ago(15) }),
    T({ id: 't-t7', projectId: 'p-tropa', title: 'Проверка офлайна на старых телефонах', skills: ['qa'], milestoneId: 'm-t1', dependsOn: ['t-t3'], at: ago(14), description: 'Android 9–11 и iPhone 8. Режим полёта, перезагрузка, нехватка памяти.' }),
    T({ id: 't-t8', projectId: 'p-tropa', title: 'Инструкция: как добавить свой маршрут', skills: ['docs'], milestoneId: 'm-t2', priority: 'low', size: 'S', at: ago(9) }),
    T({ id: 't-t9', projectId: 'p-tropa', title: 'Предупреждение о садящейся батарее', skills: ['code', 'design'], status: 'in_progress', assigneeId: 'u-sergey', milestoneId: 'm-t3', size: 'S', at: ago(6) }),

    // Азбука кода
    T({ id: 't-a1', projectId: 'p-azbuka', title: 'Программа курса: 20 тем', skills: ['writing', 'docs'], status: 'done', assigneeId: 'u-ilya', milestoneId: 'm-a1', at: ago(15) }),
    T({ id: 't-a2', projectId: 'p-azbuka', title: 'Урок 1: «Привет, мир» на двух языках', skills: ['writing'], milestoneId: 'm-a2', size: 'S', priority: 'high', at: ago(12), description: 'Объяснение, пример и задача. Текст — не больше одного экрана телефона.' }),
    T({ id: 't-a3', projectId: 'p-azbuka', title: 'Урок 2: переменные', skills: ['writing'], milestoneId: 'm-a2', size: 'S', at: ago(12) }),
    T({ id: 't-a4', projectId: 'p-azbuka', title: 'Запуск Python в браузере через Pyodide', skills: ['code'], milestoneId: 'm-a3', priority: 'high', at: ago(11), description: 'Редактор кода, кнопка «Запустить», вывод результата. Загрузка Pyodide — с индикатором.' }),
    T({ id: 't-a5', projectId: 'p-azbuka', title: 'Персонаж-проводник курса', skills: ['art2d'], milestoneId: 'm-a2', size: 'M', at: ago(10), description: 'Дружелюбный персонаж, который появляется в уроках. Пять эмоций.' }),
    T({ id: 't-a6', projectId: 'p-azbuka', title: 'Макет страницы урока', skills: ['design'], milestoneId: 'm-a3', at: ago(9), description: 'Текст, редактор и задача на одном экране. На телефоне — по вкладкам.' }),
    T({ id: 't-a7', projectId: 'p-azbuka', title: 'Словарь терминов казахский — русский', skills: ['docs', 'writing'], milestoneId: 'm-a1', size: 'S', priority: 'low', at: ago(5) }),

    // Степные легенды
    T({ id: 't-l1', projectId: 'p-legends', title: 'Сценарий «Легенды о Коркыте»', skills: ['writing'], status: 'done', assigneeId: 'u-ilya', milestoneId: 'm-l1', at: ago(42) }),
    T({ id: 't-l2', projectId: 'p-legends', title: 'Раскадровка «Коркыта»', skills: ['art2d'], status: 'done', assigneeId: 'u-alina', milestoneId: 'm-l1', at: ago(36) }),
    T({ id: 't-l3', projectId: 'p-legends', title: 'Фоны: степь на рассвете и в бурю', skills: ['art2d'], status: 'in_progress', assigneeId: 'u-alina', milestoneId: 'm-l1', at: ago(20) }),
    T({ id: 't-l4', projectId: 'p-legends', title: 'Музыка: тема кобыза', skills: ['audio'], status: 'review', assigneeId: 'u-dana', milestoneId: 'm-l1', at: ago(18) }),
    T({ id: 't-l5', projectId: 'p-legends', title: '3D-сцена юрты для сложных пролётов камеры', skills: ['art3d'], milestoneId: 'm-l1', at: ago(14), description: 'Простая геометрия под покраску сверху: нужна для двух кадров с движением камеры.' }),
    T({ id: 't-l6', projectId: 'p-legends', title: 'Субтитры на английском', skills: ['writing'], milestoneId: 'm-l1', size: 'S', at: ago(5) }),

    // Шум города
    T({ id: 't-n1', projectId: 'p-noise', title: 'Зелёный базар, утро', skills: ['audio'], status: 'done', assigneeId: 'u-dana', milestoneId: 'm-n1', at: ago(66) }),
    T({ id: 't-n2', projectId: 'p-noise', title: 'Плеер с волной и поиском по тегам', skills: ['code'], status: 'done', assigneeId: 'u-timur', milestoneId: 'm-n2', at: ago(40) }),
    T({ id: 't-n3', projectId: 'p-noise', title: 'Трамвай и остановки Алматы', skills: ['audio'], milestoneId: 'm-n1', size: 'S', at: ago(20), description: 'Посадка, движение, звонок. Каждая запись не короче минуты.' }),
    T({ id: 't-n4', projectId: 'p-noise', title: 'Проверка сайта на мобильных', skills: ['qa'], milestoneId: 'm-n2', size: 'S', priority: 'high', at: ago(4) }),
    T({ id: 't-n5', projectId: 'p-noise', title: 'Руководство: как записывать на телефон', skills: ['docs', 'audio'], milestoneId: 'm-n1', size: 'S', at: ago(3) }),

    // Ответвление
    T({ id: 't-f1', projectId: 'p-gavan-noch', title: 'Письма смотрителя: первая неделя', skills: ['writing'], milestoneId: 'm-f1', at: ago(10) }),
    T({ id: 't-f2', projectId: 'p-gavan-noch', title: 'Одиночный режим без лобби', skills: ['code'], milestoneId: 'm-f1', at: ago(10) }),
  ];

  // ——— Вклады ———
  const R = (authorId: string, verdict: Review['verdict'], text: string, at: number): Review => ({ id: `r-${authorId}-${at}`, authorId, verdict, text, createdAt: at });
  type CInit = Partial<Contribution> & Pick<Contribution, 'id' | 'projectId' | 'authorId' | 'title' | 'summary' | 'kind'> & { at: number };
  const C = (o: CInit): Contribution => ({ number: 0, links: [], areas: [], status: 'open', reviews: [], createdAt: o.at, updatedAt: o.at, ...o });

  const contributions: Contribution[] = [
    C({ id: 'c-g1', projectId: 'p-gavan', taskId: 't-g1', authorId: 'u-timur', kind: 'code', title: 'Контроллер персонажа и камера с инерцией', summary: 'Движение на `CharacterBody3D`, поддержка геймпада, камера с плавным догоном. Настройки скорости вынесены в инспектор.', areas: ['персонаж', 'камера'], status: 'accepted', at: ago(52), decidedAt: ago(50), decidedBy: 'u-erlan', reviews: [R('u-erlan', 'approve', 'Ощущается мягко, как и хотели.', ago(51)), R('u-nikita', 'approve', 'Проверил по сети — дёрганий нет.', ago(51, 3))] }),
    C({ id: 'c-g2', projectId: 'p-gavan', taskId: 't-g2', authorId: 'u-nikita', kind: 'code', title: 'Лобби и вход по коду комнаты', summary: 'ENet, хост авторитетен. Код комнаты — шесть цифр, переподключение при обрыве в течение 30 секунд.', areas: ['сеть', 'лобби'], status: 'accepted', at: ago(49), decidedAt: ago(46), decidedBy: 'u-erlan', reviews: [R('u-timur', 'approve', 'Код чистый, оставил пару мелких замечаний.', ago(47)), R('u-erlan', 'approve', 'Сыграли вчетвером — работает.', ago(46, 2))] }),
    C({ id: 'c-g3', projectId: 'p-gavan', taskId: 't-g3', authorId: 'u-timur', kind: 'code', title: 'Мини-игра починки', summary: 'Ритм-мини-игра с тремя инструментами. Сложность берётся из `Weather.intensity`.', areas: ['механики', 'погода'], status: 'accepted', at: ago(44), decidedAt: ago(41), decidedBy: 'u-erlan', reviews: [R('u-erlan', 'approve', 'Отлично.', ago(42)), R('u-sergey', 'comment', 'На геймпаде окно попадания узковато.', ago(42, 5)), R('u-nikita', 'approve', 'Согласен с Сергеем, но можно поправить потом.', ago(41, 4))] }),
    C({ id: 'c-g4', projectId: 'p-gavan', taskId: 't-g4', authorId: 'u-maria', kind: 'art3d', title: 'Блокинг острова', summary: 'Остров, маяк, причал и склад простыми формами. Масштаб сверен с персонажем.', links: ['island_blockout.glb'], areas: ['остров', 'маяк'], status: 'accepted', at: ago(43), decidedAt: ago(40), decidedBy: 'u-timur', reviews: [R('u-erlan', 'approve', 'Маршруты удобные.', ago(41)), R('u-timur', 'approve', 'Импортируется без ошибок.', ago(40, 2))] }),
    C({ id: 'c-g5', projectId: 'p-gavan', taskId: 't-g5', authorId: 'u-aruzhan', kind: 'design', title: 'Макеты и вёрстка инвентаря', summary: 'Макеты для клавиатуры и геймпада, сверстала сцену `Inventory.tscn`. Иконки пока временные.', links: ['https://www.figma.com/'], areas: ['интерфейс', 'инвентарь'], status: 'accepted', at: ago(24), decidedAt: ago(20), decidedBy: 'u-erlan', reviews: [R('u-timur', 'approve', 'Подключил к логике, всё сходится.', ago(21)), R('u-erlan', 'approve', 'Красиво и понятно.', ago(20, 3))] }),
    C({
      id: 'c-g6', projectId: 'p-gavan', taskId: 't-g6', authorId: 'u-maria', kind: 'art3d', title: 'Смотритель: модель, риг и четыре анимации',
      summary: 'Модель 2 840 треугольников, цвет по вершинам, риг на 22 кости.\n\nАнимации: стойка, ходьба, бег, починка. Четыре варианта дождевика переключаются материалом.',
      links: ['keeper_v3.glb', 'keeper_turnaround.png'], areas: ['персонажи', 'анимация'], at: ago(4),
      reviews: [R('u-erlan', 'approve', 'Силуэт читается отлично даже сверху.', ago(3)), R('u-sergey', 'comment', 'В стойке кисть на секунду проходит сквозь фонарь.', ago(2))],
    }),
    C({
      id: 'c-g7', projectId: 'p-gavan', taskId: 't-g7', authorId: 'u-nikita', kind: 'code', title: 'Погода: шторм, туман и смена силы ветра',
      summary: 'Сценарий погоды на ночь, дождь на частицах, волны в шейдере воды. Туман меняет дальность видимости и включает сигналы кораблей.',
      areas: ['погода', 'рендеринг', 'освещение'], status: 'changes_requested', at: ago(6),
      reviews: [R('u-timur', 'changes', 'На GTX 1050 шторм съедает 15 кадров. Давай дождь через GPUParticles и упростим волны на дальнем плане.', ago(5))],
    }),
    C({ id: 'c-g8', projectId: 'p-gavan', authorId: 'u-alina', kind: 'art2d', title: 'Концепт-арт: интерьер маяка ночью', summary: 'Три варианта интерьера нижнего этажа маяка — склад, печь, лестница. Хочу помочь 3D-художникам с настроением освещения.', links: ['lighthouse_interior.png'], areas: ['маяк', 'освещение'], at: ago(2) }),
    C({ id: 'c-g9', projectId: 'p-gavan', authorId: 'u-sergey', kind: 'code', title: 'Режим выживания с монстрами из тумана', summary: 'Добавил врагов, которые выходят из тумана и ломают механизмы.', areas: ['механики'], status: 'rejected', at: ago(26), decidedAt: ago(25), decidedBy: 'u-erlan', decisionNote: 'Идея интересная, но в концепции нет врагов — игра про спокойствие. Это отличный повод для ответвления.', reviews: [R('u-timur', 'comment', 'Технически сделано аккуратно.', ago(25, 5))] }),

    C({ id: 'c-t1', projectId: 'p-tropa', taskId: 't-t1', authorId: 'u-nikita', kind: 'code', title: 'Карта на MapLibre', summary: 'Векторные тайлы, стиль под горы: горизонтали, тропы, источники.', areas: ['карта'], status: 'accepted', at: ago(31), decidedAt: ago(29), decidedBy: 'u-sergey', reviews: [R('u-sergey', 'approve', 'Работает быстро.', ago(29))] }),
    C({ id: 'c-t2', projectId: 'p-tropa', taskId: 't-t2', authorId: 'u-timur', kind: 'code', title: 'Запись трека в фоне', summary: 'Wake Lock и Geolocation API, точки пишутся в IndexedDB каждые 5 секунд.', areas: ['трек', 'хранилище'], status: 'accepted', at: ago(26), decidedAt: ago(24), decidedBy: 'u-nikita', reviews: [R('u-nikita', 'approve', 'Проверил на подъёме на Кок-Жайляу — трек ровный.', ago(24))] }),
    C({ id: 'c-t3', projectId: 'p-tropa', taskId: 't-t3', authorId: 'u-timur', kind: 'code', title: 'Скачивание района через Service Worker', summary: 'Выбор прямоугольника, оценка размера, скачивание с прогрессом и докачкой. Тайлы кладутся в Cache Storage.', areas: ['офлайн-кэш', 'service worker'], at: ago(3), reviews: [R('u-sergey', 'comment', 'Как поведёт себя при нехватке места?', ago(2))] }),
    C({ id: 'c-t4', projectId: 'p-tropa', authorId: 'u-olga', kind: 'code', title: 'Предзагрузка района по маршруту', summary: 'При открытии маршрута предлагаю скачать коридор вокруг трека — 2 км в каждую сторону. Тайлы складываю в IndexedDB.', areas: ['офлайн-кэш', 'маршруты'], at: ago(1) }),

    C({ id: 'c-a1', projectId: 'p-azbuka', taskId: 't-a1', authorId: 'u-ilya', kind: 'writing', title: 'Программа курса из 20 тем', summary: 'От вывода текста до маленькой игры «Угадай число». После каждой темы — что ученик умеет.', areas: ['программа'], status: 'accepted', at: ago(13), decidedAt: ago(12), decidedBy: 'u-olga', reviews: [R('u-olga', 'approve', 'То, что нужно. Чуть упростила тему 7.', ago(12))] }),

    C({ id: 'c-l1', projectId: 'p-legends', taskId: 't-l1', authorId: 'u-ilya', kind: 'writing', title: 'Сценарий о Коркыте', summary: 'Полторы минуты, закадровый голос, 14 сцен.', areas: ['сценарий'], status: 'accepted', at: ago(39), decidedAt: ago(37), decidedBy: 'u-alina', reviews: [R('u-alina', 'approve', 'Очень красиво.', ago(37))] }),
    C({ id: 'c-l2', projectId: 'p-legends', taskId: 't-l2', authorId: 'u-alina', kind: 'art2d', title: 'Раскадровка «Коркыта»', summary: '42 кадра с таймингом под черновую озвучку.', areas: ['раскадровка'], status: 'accepted', at: ago(30), decidedAt: ago(29), decidedBy: 'u-maria', reviews: [R('u-maria', 'approve', 'Сцена с бурей — мурашки.', ago(29))] }),
    C({ id: 'c-l3', projectId: 'p-legends', taskId: 't-l4', authorId: 'u-dana', kind: 'audio', title: 'Тема кобыза, черновой вариант', summary: 'Две минуты, кобыз и низкий дрон. Есть короткая версия под аниматик.', links: ['korkyt_theme_v1.flac'], areas: ['музыка'], at: ago(3), reviews: [R('u-maria', 'approve', 'Ложится на аниматик идеально.', ago(2))] }),

    C({ id: 'c-n1', projectId: 'p-noise', taskId: 't-n1', authorId: 'u-dana', kind: 'audio', title: 'Зелёный базар: 6 записей', summary: 'Торговые ряды, мясной павильон, выход к Жибек Жолы. Zoom H5, 48 кГц / 24 бит.', areas: ['записи'], status: 'accepted', at: ago(60), decidedAt: ago(60), decidedBy: 'u-dana' }),
    C({ id: 'c-n2', projectId: 'p-noise', taskId: 't-n2', authorId: 'u-timur', kind: 'code', title: 'Плеер с волной', summary: 'Отрисовка волны на canvas, перемотка, фильтр по тегам.', areas: ['сайт', 'плеер'], status: 'accepted', at: ago(35), decidedAt: ago(33), decidedBy: 'u-dana', reviews: [R('u-dana', 'approve', 'Спасибо, очень удобно.', ago(33))] }),
    C({ id: 'c-n3', projectId: 'p-noise', authorId: 'u-erlan', kind: 'audio', title: 'Вокзал Астана-1: объявления и толпа', summary: 'Четыре записи по две минуты. Голоса в объявлениях — общий план, без узнаваемых людей.', links: ['astana_station.zip'], areas: ['записи'], at: ago(2) }),
  ];

  // ——— Комментарии к задачам ———
  const say = (taskId: string, authorId: string, body: string, at: number) => tasks.find((t) => t.id === taskId)!.comments.push({ id: `cm-${taskId}-${at}`, authorId, body, createdAt: at });
  say('t-g18', 'u-timur', 'Похоже на коллизию: капсула персонажа шире проёма. Попробую уменьшить радиус или расширить дверь.', ago(7));
  say('t-g18', 'u-sergey', 'Проверил ещё раз на 0.2 — застревает и при ходьбе, если прижаться к косяку.', ago(6, 5));
  say('t-g11', 'u-maria', 'Возьму после смотрителя, если никто не против.', ago(9));
  say('t-g11', 'u-erlan', 'Отлично! Референсы собираем в обсуждении про корабли.', ago(8, 3));
  say('t-g13', 'u-sergey', 'Готов провести, как только примут модель смотрителя и погоду.', ago(5));
  say('t-a4', 'u-timur', 'Pyodide весит около 10 МБ. Предлагаю грузить его при первом запуске кода, а не при открытии урока.', ago(9));
  say('t-a4', 'u-olga', 'Согласна, главное — понятный индикатор загрузки.', ago(8));
  say('t-t3', 'u-nikita', 'Не забудьте про ограничение в 150 МБ из архитектуры.', ago(10));

  // ——— Нумерация: задачи и вклады проекта идут одним счётчиком, как на GitHub ———
  for (const p of projects) {
    const items: { createdAt: number; number: number }[] = [...tasks.filter((t) => t.projectId === p.id), ...contributions.filter((c) => c.projectId === p.id)];
    items.sort((a, b) => a.createdAt - b.createdAt).forEach((it, i) => { it.number = i + 1; });
    p.nextNumber = items.length + 1;
  }

  // ——— Обсуждения ———
  const M = (authorId: string, body: string, at: number) => ({ id: `cm-${authorId}-${at}`, authorId, body, createdAt: at });
  const threads: Thread[] = [
    {
      id: 'th-g1', projectId: 'p-gavan', title: 'Сколько игроков поддерживаем: 2–4 или до 6?', kind: 'proposal', authorId: 'u-nikita', createdAt: ago(47),
      comments: [
        M('u-nikita', 'Лобби технически тянет шестерых. Может, сразу заложим?', ago(47)),
        M('u-erlan', 'Остров маленький, вшестером будет тесно. И балансировать поломки сложнее.', ago(46)),
        M('u-sergey', 'Тестировать шестерых тоже сложнее — нас просто столько не соберётся.', ago(46, 4)),
        M('u-timur', 'За 2–4. Если будет спрос, сделаем большие острова позже.', ago(45)),
      ],
      decision: { text: 'Остаёмся на 2–4 игроках: острова маленькие, а сетевой код проще тестировать.', by: 'u-erlan', at: ago(45) },
    },
    {
      id: 'th-g2', projectId: 'p-gavan', title: 'Где взять референсы для кораблей?', kind: 'question', authorId: 'u-maria', createdAt: ago(9),
      comments: [
        M('u-maria', 'Беру задачу про корабли после смотрителя. Хочется не «пиратские», а северные рабочие суда.', ago(9)),
        M('u-aruzhan', 'Поморские кочи и рыболовецкие сейнеры 50-х — очень подходят по формам.', ago(8)),
        M('u-alina', 'Могу набросать пару силуэтов в палитре арт-библии, если поможет.', ago(7)),
      ],
    },
    {
      id: 'th-g3', projectId: 'p-gavan', title: 'Собака смотрителя, которая находит детали', kind: 'idea', authorId: 'u-ilya', createdAt: ago(5),
      comments: [
        M('u-ilya', 'Собака бегает по острову и лает возле выброшенных морем деталей. Заодно — живое существо, о котором заботятся вместе.', ago(5)),
        M('u-erlan', 'Нравится! Но давай после вертикального среза.', ago(4)),
      ],
    },
    {
      id: 'th-t1', projectId: 'p-tropa', title: 'Храним тайлы в Cache Storage или IndexedDB?', kind: 'proposal', authorId: 'u-timur', createdAt: ago(4),
      comments: [
        M('u-timur', 'В своём вкладе использую Cache Storage — проще с Service Worker.', ago(4)),
        M('u-nikita', 'В архитектуре написано IndexedDB. Давайте решим до того, как примем скачивание района.', ago(3)),
      ],
    },
    {
      id: 'th-a1', projectId: 'p-azbuka', title: 'С какого языка начинать: Python или Scratch?', kind: 'question', authorId: 'u-timur', createdAt: ago(14),
      comments: [
        M('u-timur', 'Для пятиклассников Scratch может быть проще.', ago(14)),
        M('u-olga', 'Scratch уже есть везде. Нам не хватает именно перехода к тексту, поэтому Python.', ago(13)),
      ],
      decision: { text: 'Курс на Python: он закрывает переход от блоков к настоящему коду.', by: 'u-olga', at: ago(13) },
    },
    {
      id: 'th-l1', projectId: 'p-legends', title: 'Озвучка: актёр или синтез?', kind: 'general', authorId: 'u-alina', createdAt: ago(8),
      comments: [
        M('u-alina', 'Есть знакомый диктор, но он может только в конце месяца.', ago(8)),
        M('u-dana', 'Подождём живой голос — легенды без него не звучат.', ago(7)),
      ],
    },
  ];

  const state: State = {
    version: 2, users, projects, tasks, contributions, threads, activity: [], announcements: [], messages: [], invites: [], readAt: {},
    currentUserId: null, ai: { mode: 'local', apiKey: '', model: 'claude-opus-5-5' }, theme: 'auto', lang: 'ru',
  };
  state.activity = deriveActivity(state);
  return state;
}

/** История проекта для демо: восстанавливается из дат задач, вкладов, обсуждений и версий. */
function deriveActivity(s: State): Activity[] {
  const out: Activity[] = [];
  let n = 0;
  const add = (a: Omit<Activity, 'id'>) => out.push({ id: `a-seed-${n++}`, ...a });
  const name = (id: string) => s.users.find((u) => u.id === id)?.name ?? 'участника';

  for (const p of s.projects) {
    add({ projectId: p.id, actorId: p.ownerId, type: 'project', at: p.createdAt, text: p.forkOf ? `создал ответвление от «${s.projects.find((x) => x.id === p.forkOf)?.title}»` : `создал проект «${p.title}»`, ref: { kind: 'project', id: p.id } });
    for (const r of p.releases) add({ projectId: p.id, actorId: r.authorId, type: 'release', at: r.createdAt, text: `выпустил версию ${r.version} — «${r.title}»`, ref: { kind: 'release', id: r.id } });
    for (const d of p.docs) if (d.updatedAt > p.createdAt) add({ projectId: p.id, actorId: d.updatedBy, type: 'doc', at: d.updatedAt, text: `обновил документ «${d.title}»`, ref: { kind: 'doc', id: d.id } });
  }
  for (const p of s.projects.filter((x) => x.forkOf)) {
    add({ projectId: p.forkOf!, actorId: p.ownerId, type: 'project', at: p.createdAt, text: `создал ответвление «${p.title}»`, ref: { kind: 'project', id: p.id } });
  }
  for (const t of s.tasks) {
    const verb = t.type === 'bug' ? 'сообщил об ошибке' : t.status === 'proposed' ? 'предложил задачу' : 'добавил задачу';
    add({ projectId: t.projectId, actorId: t.createdBy, type: 'task', verb: 'created', at: t.createdAt, text: `${verb} #${t.number} «${t.title}»`, ref: { kind: 'task', id: t.id } });
    if (t.assigneeId) add({ projectId: t.projectId, actorId: t.assigneeId, type: 'task', verb: 'taken', at: t.createdAt + DAY * 0.6, text: `взял в работу #${t.number} «${t.title}»`, ref: { kind: 'task', id: t.id } });
    for (const cm of t.comments) add({ projectId: t.projectId, actorId: cm.authorId, type: 'task', verb: 'commented', at: cm.createdAt, text: `прокомментировал задачу #${t.number}`, ref: { kind: 'task', id: t.id } });
  }
  for (const c of s.contributions) {
    const task = s.tasks.find((t) => t.id === c.taskId);
    add({ projectId: c.projectId, actorId: c.authorId, type: 'contribution', verb: 'submitted', at: c.createdAt, text: `предложил вклад #${c.number} «${c.title}»${task ? ` к задаче #${task.number}` : ''}`, ref: { kind: 'contribution', id: c.id } });
    for (const r of c.reviews) {
      const verb = r.verdict === 'approve' ? 'одобрил' : r.verdict === 'changes' ? 'попросил правки во вкладе' : 'прокомментировал вклад';
      add({ projectId: c.projectId, actorId: r.authorId, type: 'review', verb: 'reviewed', at: r.createdAt, text: `${verb} #${c.number} «${c.title}»`, ref: { kind: 'contribution', id: c.id } });
    }
    if (c.decidedAt && c.decidedBy) {
      add({ projectId: c.projectId, actorId: c.decidedBy, type: 'contribution', verb: c.status, at: c.decidedAt, text: c.status === 'accepted' ? `принял вклад #${c.number} «${c.title}», автор — ${name(c.authorId)}` : `закрыл вклад #${c.number} «${c.title}» без принятия`, ref: { kind: 'contribution', id: c.id } });
    }
  }
  for (const th of s.threads) {
    add({ projectId: th.projectId, actorId: th.authorId, type: 'discussion', at: th.createdAt, text: `открыл обсуждение «${th.title}»`, ref: { kind: 'thread', id: th.id } });
    for (const cm of th.comments.slice(1)) add({ projectId: th.projectId, actorId: cm.authorId, type: 'discussion', at: cm.createdAt, text: `ответил в обсуждении «${th.title}»`, ref: { kind: 'thread', id: th.id } });
    if (th.decision) add({ projectId: th.projectId, actorId: th.decision.by, type: 'decision', at: th.decision.at + 36e5, text: `зафиксировал решение: ${th.decision.text}`, ref: { kind: 'thread', id: th.id } });
  }
  return out.sort((a, b) => b.at - a.at);
}
