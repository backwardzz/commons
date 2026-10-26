// Модель данных платформы. Всё, что видит пользователь, строится из этих сущностей.
import { tr, type Lang } from '../i18n';

export type Skill = 'code' | 'design' | 'art3d' | 'art2d' | 'writing' | 'audio' | 'qa' | 'docs';

export const SKILLS: { id: Skill; name: string; short: string; who: string; gen: string }[] = [
  { id: 'code', get name() { return tr('Программирование'); }, get short() { return tr('Код'); }, get who() { return tr('программист'); }, get gen() { return tr('программиста'); } },
  { id: 'design', get name() { return tr('Дизайн интерфейсов'); }, get short() { return tr('Дизайн'); }, get who() { return tr('дизайнер'); }, get gen() { return tr('дизайнера'); } },
  { id: 'art3d', get name() { return tr('3D-графика'); }, short: '3D', get who() { return tr('3D-художник'); }, get gen() { return tr('3D-художника'); } },
  { id: 'art2d', get name() { return tr('Иллюстрация и 2D'); }, short: '2D', get who() { return tr('художник'); }, get gen() { return tr('художника'); } },
  { id: 'writing', get name() { return tr('Сценарий и тексты'); }, get short() { return tr('Тексты'); }, get who() { return tr('сценарист'); }, get gen() { return tr('сценариста'); } },
  { id: 'audio', get name() { return tr('Музыка и звук'); }, get short() { return tr('Звук'); }, get who() { return tr('композитор'); }, get gen() { return tr('композитора'); } },
  { id: 'qa', get name() { return tr('Тестирование'); }, get short() { return tr('Тесты'); }, get who() { return tr('тестировщик'); }, get gen() { return tr('тестировщика'); } },
  { id: 'docs', get name() { return tr('Документация'); }, get short() { return tr('Доки'); }, get who() { return tr('технический писатель'); }, get gen() { return tr('технического писателя'); } },
];

export const skillInfo = (s: Skill) => SKILLS.find((x) => x.id === s)!;

export type Category = 'game' | 'software' | 'education' | 'art' | 'audio' | 'other';
export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'game', get name() { return tr('Игры'); } },
  { id: 'software', get name() { return tr('Программы и инструменты'); } },
  { id: 'education', get name() { return tr('Образование'); } },
  { id: 'art', get name() { return tr('Цифровое искусство'); } },
  { id: 'audio', get name() { return tr('Музыка и звук'); } },
  { id: 'other', get name() { return tr('Другое'); } },
];

export type Stage = 'idea' | 'prototype' | 'development' | 'beta' | 'release';
export const STAGES: { id: Stage; name: string; hint: string }[] = [
  { id: 'idea', get name() { return tr('Идея'); }, get hint() { return tr('Замысел и концепция, ищем участников'); } },
  { id: 'prototype', get name() { return tr('Прототип'); }, get hint() { return tr('Проверяем, работает ли основа'); } },
  { id: 'development', get name() { return tr('Разработка'); }, get hint() { return tr('Строим основные части продукта'); } },
  { id: 'beta', get name() { return tr('Бета'); }, get hint() { return tr('Можно пробовать, собираем отзывы'); } },
  { id: 'release', get name() { return tr('Релиз'); }, get hint() { return tr('Готовая версия, дальше — развитие'); } },
];

export type AcceptRule = 'owner' | 'maintainers' | 'two-approvals';
export const ACCEPT_RULES: { id: AcceptRule; name: string; hint: string }[] = [
  { id: 'owner', get name() { return tr('Только автор'); }, get hint() { return tr('Вклады принимает автор проекта'); } },
  { id: 'maintainers', get name() { return tr('Любой сопровождающий'); }, get hint() { return tr('Достаточно решения одного сопровождающего'); } },
  { id: 'two-approvals', get name() { return tr('Два одобрения'); }, get hint() { return tr('Нужны два одобрения сопровождающих, затем любой из них принимает вклад'); } },
];

export const LICENSES = ['MIT', 'Apache-2.0', 'GPL-3.0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Все права у автора'];

export interface User {
  id: string;
  name: string;
  handle: string;
  bio: string;
  skills: Skill[];
  hue: number; // цвет аватара
  gender?: 'm' | 'f'; // для согласования глаголов: «взял» / «взяла»
  joinedAt: number;
  demo?: boolean;
  team?: boolean; // служебный профиль команды платформы: под ним нельзя войти
  country?: string; // код страны ISO 3166-1, например KZ
  socials?: SocialLink[];
  portfolio?: Work[]; // работы вне проектов платформы
  google?: { sub: string; email: string }; // вход через Google: постоянный id аккаунта и почта (видна только владельцу)
  photo?: string; // аватар из аккаунта Google
}

// ——— соцсети и ссылки ———

export type SocialKind = 'website' | 'github' | 'x' | 'tiktok' | 'instagram' | 'youtube' | 'telegram' | 'discord' | 'linkedin' | 'behance' | 'artstation' | 'itch' | 'steam';
export interface SocialLink { kind: SocialKind; url: string }

export const SOCIALS: { id: SocialKind; name: string; placeholder: string; forUser: boolean; forProject: boolean }[] = [
  { id: 'website', get name() { return tr('Сайт'); }, placeholder: 'https://…', forUser: true, forProject: true },
  { id: 'github', name: 'GitHub', placeholder: 'https://github.com/…', forUser: true, forProject: false },
  { id: 'x', name: 'X (Twitter)', placeholder: 'https://x.com/…', forUser: true, forProject: true },
  { id: 'tiktok', name: 'TikTok', placeholder: 'https://www.tiktok.com/@…', forUser: true, forProject: true },
  { id: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/…', forUser: true, forProject: true },
  { id: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@…', forUser: true, forProject: true },
  { id: 'telegram', name: 'Telegram', placeholder: 'https://t.me/…', forUser: true, forProject: true },
  { id: 'discord', name: 'Discord', placeholder: 'https://discord.gg/…', forUser: false, forProject: true },
  { id: 'linkedin', name: 'LinkedIn', placeholder: 'https://linkedin.com/in/…', forUser: true, forProject: false },
  { id: 'behance', name: 'Behance', placeholder: 'https://behance.net/…', forUser: true, forProject: false },
  { id: 'artstation', name: 'ArtStation', placeholder: 'https://artstation.com/…', forUser: true, forProject: false },
  { id: 'itch', name: 'itch.io', placeholder: 'https://….itch.io', forUser: true, forProject: true },
  { id: 'steam', name: 'Steam', placeholder: 'https://store.steampowered.com/app/…', forUser: false, forProject: true },
];

/** Работа в портфолио участника, сделанная вне проектов платформы. */
export interface Work {
  id: string;
  title: string;
  description: string;
  url?: string;
  skill: Skill;
  year?: number;
  createdAt: number;
}

// ——— доходы и их распределение ———

/** Делится ли автор доходом с участниками. */
export type RevenuePolicy = 'undecided' | 'none' | 'discuss' | 'share';
export const REVENUE_POLICIES: { id: RevenuePolicy; name: string; hint: string }[] = [
  { id: 'undecided', get name() { return tr('Не решено'); }, get hint() { return tr('автор ещё не определился'); } },
  { id: 'none', get name() { return tr('Без распределения дохода'); }, get hint() { return tr('проект некоммерческий или доход остаётся у автора'); } },
  { id: 'discuss', get name() { return tr('Обсуждается'); }, get hint() { return tr('условия обсуждаются с участниками'); } },
  { id: 'share', get name() { return tr('Автор делится доходом'); }, get hint() { return tr('часть дохода делится между участниками по вкладу'); } },
];

/** Как делить долю участников: по вложенным усилиям, поровну или смешанно. */
export type SplitMethod = 'effort' | 'equal' | 'mixed';
export const SPLIT_METHODS: { id: SplitMethod; name: string; hint: string }[] = [
  { id: 'effort', get name() { return tr('По вкладу'); }, get hint() { return tr('пропорционально очкам вклада'); } },
  { id: 'equal', get name() { return tr('Поровну'); }, get hint() { return tr('все участники получают одинаково'); } },
  { id: 'mixed', get name() { return tr('Смешанно'); }, get hint() { return tr('половина поровну, половина по вкладу'); } },
];

export interface RevenuePlan {
  policy: RevenuePolicy;
  estimate: number; // ожидаемый доход после публикации
  currency: string; // USD, KZT, RUB…
  ownerPct: number; // доля автора, остальное — участникам
  method: SplitMethod;
  note: string;
}

// ——— объявления проекта ———

export type AnnouncementKind = 'plan' | 'news' | 'call';
export const ANNOUNCEMENT_KINDS: { id: AnnouncementKind; name: string; hint: string }[] = [
  { id: 'plan', get name() { return tr('Планы'); }, get hint() { return tr('куда движется проект дальше'); } },
  { id: 'news', get name() { return tr('Новости'); }, get hint() { return tr('что сделано и что изменилось'); } },
  { id: 'call', get name() { return tr('Ищем людей'); }, get hint() { return tr('кого не хватает и чем помочь'); } },
];

export interface Announcement {
  id: string;
  projectId: string;
  authorId: string;
  kind: AnnouncementKind;
  title: string;
  body: string; // markdown
  pinned?: boolean;
  createdAt: number;
}

// ——— сообщения и приглашения ———

/** Чат проекта: `project:<id>`, личная переписка: `dm:<id1>:<id2>` (id по алфавиту). */
export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  body: string;
  createdAt: number;
  inviteId?: string; // сообщение о приглашении в проект
}

export type InviteStatus = 'pending' | 'accepted' | 'declined';
export interface Invite {
  id: string;
  fromId: string;
  toId: string;
  projectId: string;
  taskId?: string;
  message: string;
  status: InviteStatus;
  createdAt: number;
  decidedAt?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
}

export interface Doc {
  id: string;
  title: string;
  body: string; // markdown
  updatedAt: number;
  updatedBy: string;
}

export type LinkKind = 'github' | 'figma' | 'engine' | 'demo' | 'other';
export interface ProjectLink {
  kind: LinkKind;
  label: string;
  url: string;
}

export interface Release {
  id: string;
  version: string;
  title: string;
  notes: string;
  url?: string;
  createdAt: number;
  authorId: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  category: Category;
  stage: Stage;
  techs: string[];
  goal: string;
  concept: string; // markdown
  ownerId: string;
  maintainerIds: string[]; // включая автора
  followerIds: string[];
  rolesNeeded: Skill[];
  milestones: Milestone[];
  docs: Doc[];
  links: ProjectLink[];
  socials?: SocialLink[];
  country?: string; // страна, где появился проект (ISO 3166-1)
  revenue?: RevenuePlan;
  releases: Release[];
  license: string;
  acceptRule: AcceptRule;
  openForForks: boolean;
  forkOf?: string;
  nextNumber: number;
  createdAt: number;
  updatedAt: number;
}

export type TaskStatus = 'proposed' | 'open' | 'in_progress' | 'review' | 'done' | 'declined';
export const TASK_STATUSES: { id: TaskStatus; name: string }[] = [
  { id: 'proposed', get name() { return tr('Предложены'); } },
  { id: 'open', get name() { return tr('Свободны'); } },
  { id: 'in_progress', get name() { return tr('В работе'); } },
  { id: 'review', get name() { return tr('На проверке'); } },
  { id: 'done', get name() { return tr('Готово'); } },
  { id: 'declined', get name() { return tr('Отклонены'); } },
];

export const isClosed = (t: { status: TaskStatus }) => t.status === 'done' || t.status === 'declined';

export type Priority = 'low' | 'normal' | 'high' | 'critical';
export const PRIORITIES: { id: Priority; name: string }[] = [
  { id: 'low', get name() { return tr('Низкий'); } },
  { id: 'normal', get name() { return tr('Обычный'); } },
  { id: 'high', get name() { return tr('Высокий'); } },
  { id: 'critical', get name() { return tr('Срочно'); } },
];

export type TaskType = 'task' | 'bug' | 'idea';
export type Size = 'S' | 'M' | 'L';
export const SIZES: { id: Size; name: string }[] = [
  { id: 'S', get name() { return tr('Небольшая — пара вечеров'); } },
  { id: 'M', get name() { return tr('Средняя — около недели'); } },
  { id: 'L', get name() { return tr('Большая — несколько недель'); } },
];

export interface Task {
  id: string;
  number: number; // общий счётчик с вкладами внутри проекта, как #12 на GitHub
  projectId: string;
  title: string;
  description: string; // markdown
  status: TaskStatus;
  priority: Priority;
  type: TaskType;
  size: Size;
  skills: Skill[];
  milestoneId?: string;
  assigneeId?: string;
  dependsOn: string[];
  comments: Comment[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type ContributionStatus = 'open' | 'changes_requested' | 'accepted' | 'rejected';
export const CONTRIBUTION_STATUSES: { id: ContributionStatus; name: string }[] = [
  { id: 'open', get name() { return tr('На рассмотрении'); } },
  { id: 'changes_requested', get name() { return tr('Нужны правки'); } },
  { id: 'accepted', get name() { return tr('Принят'); } },
  { id: 'rejected', get name() { return tr('Отклонён'); } },
];

export type Verdict = 'approve' | 'changes' | 'comment';
export interface Review {
  id: string;
  authorId: string;
  verdict: Verdict;
  text: string;
  createdAt: number;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Contribution {
  id: string;
  number: number;
  projectId: string;
  taskId?: string;
  authorId: string;
  title: string;
  summary: string; // markdown
  kind: Skill;
  links: string[];
  files?: Attachment[]; // загруженные файлы (в демо — внутри браузера, с базой — в хранилище)
  areas: string[]; // какие части проекта затрагивает — для поиска конфликтов
  status: ContributionStatus;
  reviews: Review[];
  createdAt: number;
  updatedAt: number;
  decidedAt?: number;
  decidedBy?: string;
  decisionNote?: string;
}

export type ThreadKind = 'question' | 'idea' | 'proposal' | 'general';
export const THREAD_KINDS: { id: ThreadKind; name: string }[] = [
  { id: 'question', get name() { return tr('Вопрос'); } },
  { id: 'idea', get name() { return tr('Идея'); } },
  { id: 'proposal', get name() { return tr('Предложение решения'); } },
  { id: 'general', get name() { return tr('Обсуждение'); } },
];

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: number;
}

export interface Thread {
  id: string;
  projectId: string;
  title: string;
  kind: ThreadKind;
  authorId: string;
  createdAt: number;
  comments: Comment[]; // первый комментарий — текст темы
  decision?: { text: string; by: string; at: number };
}

export type ActivityType =
  | 'project'
  | 'task'
  | 'contribution'
  | 'review'
  | 'decision'
  | 'discussion'
  | 'doc'
  | 'release'
  | 'member'
  | 'announcement';

/** Переводимое сообщение: ключ словаря и подстановки (вложенные сообщения тоже переводятся). */
export interface Msg { k: string; a?: Record<string, string | number | Msg | Msg[]> }

export interface Activity {
  id: string;
  projectId: string;
  actorId: string;
  type: ActivityType;
  text?: string; // старые записи: готовый русский текст без подлежащего
  msg?: Msg; // «взял задачу «…»» — подлежащее (участник) подставляется при показе
  verb?: string; // машинное имя события: created, taken, commented, accepted…
  at: number;
  ref?: { kind: 'task' | 'contribution' | 'thread' | 'doc' | 'release' | 'project' | 'announcement'; id: string };
}

export type AiMode = 'local' | 'claude';
export interface AiSettings {
  mode: AiMode;
  apiKey: string;
  model: string;
}

export interface State {
  version: 2;
  users: User[];
  projects: Project[];
  tasks: Task[];
  contributions: Contribution[];
  threads: Thread[];
  activity: Activity[];
  announcements: Announcement[];
  messages: Message[];
  invites: Invite[];
  /** Когда участник последний раз открывал чат: ключ `${userId}|${chatId}`. */
  readAt: Record<string, number>;
  currentUserId: string | null;
  ai: AiSettings;
  theme: 'auto' | 'light' | 'dark';
  lang: Lang;
  /** Переводить материалы проектов и сообщения на язык интерфейса автоматически. */
  autoTranslate?: boolean;
}
