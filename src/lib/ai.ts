// Единая точка входа помощника. Если включён Claude и он ответил — берём его ответ,
// иначе (нет ключа, нет сети, ошибка) отвечает встроенный помощник и честно сообщает почему.
import { getProject, getTask, getUser, projectTasks } from '../data/ops';
import { CATEGORIES, PRIORITIES, SIZES, skillInfo, type Category, type Contribution, type Skill, type State } from '../data/types';
import { AiError, SKILL_ENUM, claudeJSON, claudeText, personContext, projectContext } from './ai-claude';
import { lcFirst } from './format';
import { tr } from '../i18n';
import {
  answerLocally, decompose, draftConcept, draftSpec, explainProject, onboarding, reviewContrib, statusDoc, translateTask,
  type DraftTask, type ReviewResult,
} from './ai-local';

export type Engine = 'local' | 'claude';
export interface AiAnswer { text: string; engine: Engine; warning?: string }

export type TextTask =
  | { kind: 'explain' }
  | { kind: 'onboard' }
  | { kind: 'status' }
  | { kind: 'ask'; question: string }
  | { kind: 'spec'; title: string; description: string; skills: Skill[]; milestoneId?: string }
  | { kind: 'translate'; taskId: string; to: Skill };

const useClaude = (s: State) => s.ai.mode === 'claude' && !!s.ai.apiKey.trim();
const fallbackNote = (e: unknown) => tr('Claude не ответил: {reason}. Ответил встроенный помощник.', { reason: e instanceof AiError ? e.message : tr('ошибка') });

function local(s: State, projectId: string, task: TextTask): string {
  const p = getProject(s, projectId)!;
  const user = getUser(s, s.currentUserId);
  switch (task.kind) {
    case 'explain': return explainProject(s, p);
    case 'onboard': return onboarding(s, p, user);
    case 'status': return statusDoc(s, p);
    case 'ask': return answerLocally(s, p, task.question, user);
    case 'spec': return draftSpec(p, task);
    case 'translate': return translateTask(s, getTask(s, task.taskId)!, task.to);
  }
}

function instruction(s: State, projectId: string, task: TextTask): string {
  const p = getProject(s, projectId)!;
  switch (task.kind) {
    case 'explain':
      return 'Объясните новому участнику, что это за проект: зачем он, как устроен (по документам), где он сейчас, какие решения уже приняты и кого не хватает. В конце — 2–3 задачи, с которых удобно начать. 250–400 слов.';
    case 'onboard':
      return 'Подскажите этому человеку, с чего начать в проекте: 2–4 конкретные свободные задачи под его навыки, почему именно они и что прочитать перед началом. Учтите зависимости между задачами. Если подходящих задач нет, предложите, что он мог бы предложить сам.';
    case 'status':
      return `Подготовьте текст документа «Состояние проекта»: этапы и прогресс, что принято за последние недели, что в работе и у кого, что ждёт проверки, следующие шаги и принятые решения. Только факты из контекста. Сегодня ${new Date().toLocaleDateString('ru-RU')}. Начните сразу с содержания, без заголовка документа.`;
    case 'ask':
      return `Вопрос участника: ${task.question}\n\nОтветьте по существу, опираясь на материалы проекта. Если ответа в материалах нет, так и скажите и подскажите, у кого спросить.`;
    case 'spec': {
      const ms = p.milestones.find((m) => m.id === task.milestoneId);
      return [
        `Сформулируйте техническое задание для задачи «${task.title}».`,
        `Текущее описание: ${task.description.trim() || '(нет)'}`,
        `Навыки: ${task.skills.map((x) => skillInfo(x).name).join(', ') || 'не указаны'}. Этап: ${ms?.title ?? 'не указан'}.`,
        'Разделы: ## Контекст, ## Что нужно сделать, ## Требования, ## Критерии приёмки (чек-лист «- [ ] …»), ## Вне рамок, ## Материалы.',
        'Учтите ограничения из документов проекта. Пишите так, чтобы задачу мог выполнить человек, впервые открывший проект.',
      ].join('\n');
    }
    case 'translate': {
      const t = getTask(s, task.taskId)!;
      return `Объясните задачу «${t.title}» специалисту, чьё ремесло — ${lcFirst(skillInfo(task.to).name)}. Простыми словами, без жаргона чужой специальности: что нужно сделать и зачем, как его ремесло связано с задачей и чем он может помочь. В конце — словарик терминов из задачи.`;
    }
  }
}

export async function askText(s: State, projectId: string, task: TextTask, onText?: (t: string) => void): Promise<AiAnswer> {
  if (useClaude(s)) {
    try {
      const ctx = `${projectContext(s, getProject(s, projectId)!)}\n\n# Кто спрашивает\n${personContext(getUser(s, s.currentUserId))}`;
      return { text: await claudeText(s.ai, ctx, instruction(s, projectId, task), onText), engine: 'claude' };
    } catch (e) {
      return { text: local(s, projectId, task), engine: 'local', warning: fallbackNote(e) };
    }
  }
  return { text: local(s, projectId, task), engine: 'local' };
}

// ——— разбиение цели на задачи ———

const DECOMPOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'skills', 'priority', 'size', 'milestone'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          skills: { type: 'array', items: { type: 'string', enum: SKILL_ENUM } },
          priority: { type: 'string', enum: PRIORITIES.map((p) => p.id) },
          size: { type: 'string', enum: SIZES.map((x) => x.id) },
          milestone: { type: ['string', 'null'] },
        },
      },
    },
  },
};

export interface DecomposeInput { goal: string; category: Category; projectId?: string; title?: string }

export async function askDecompose(s: State, input: DecomposeInput): Promise<{ drafts: DraftTask[]; note: string; engine: Engine; warning?: string }> {
  const p = input.projectId ? getProject(s, input.projectId) : undefined;
  const runLocal = () => decompose(input.goal, input.category, p ? { p, tasks: projectTasks(s, p.id) } : undefined);
  if (!useClaude(s)) return { ...runLocal(), engine: 'local' };
  try {
    const ctx = p ? projectContext(s, p) : `# Новый проект «${input.title ?? 'без названия'}»\nКатегория: ${CATEGORIES.find((c) => c.id === input.category)?.name}`;
    const res = await claudeJSON<{ tasks: (DraftTask & { milestone: string | null })[] }>(s.ai, ctx, [
      `Разбейте цель на 5–10 конкретных задач для участников разных специальностей. Цель: ${input.goal}`,
      'Не повторяйте задачи, которые уже есть в проекте. Заголовок — действие («Сделать…», «Описать…»).',
      'Описание: что сделать и зачем, затем раздел «**Критерии приёмки**» со списком.',
      'Размер: S — пара вечеров, M — около недели, L — несколько недель. Этап — точное название одного из этапов проекта или null.',
    ].join('\n'), DECOMPOSE_SCHEMA);
    const drafts = res.tasks.filter((t) => t.title && t.skills.length).map((t) => ({ ...t, milestone: t.milestone ?? undefined }));
    return { drafts, note: tr('Claude предлагает эти задачи. Отметьте подходящие — их можно будет поправить на доске.'), engine: 'claude' };
  } catch (e) {
    return { ...runLocal(), engine: 'local', warning: fallbackNote(e) };
  }
}

// ——— проверка вклада ———

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'title', 'detail'],
        properties: {
          level: { type: 'string', enum: ['ok', 'warn', 'risk'] },
          title: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
  },
};

export async function askReview(s: State, c: Contribution): Promise<ReviewResult & { engine: Engine; warning?: string }> {
  if (!useClaude(s)) return { ...reviewContrib(s, c), engine: 'local' };
  try {
    const res = await claudeJSON<ReviewResult>(s.ai, projectContext(s, getProject(s, c.projectId)!), [
      `Проверьте вклад «${c.title}» от ${getUser(s, c.authorId)?.name} перед решением сопровождающих.`,
      'Соответствует ли он задаче и её критериям приёмки? Не конфликтует ли с другими открытыми вкладами и принятыми или нерешёнными обсуждениями? Чего не хватает в описании?',
      'Не выносите вердикт «принять» или «отклонить» — это решают люди. level: ok — проверено, warn — замечание, risk — риск конфликта или поломки.',
      'summary — одно-два предложения.',
    ].join('\n'), REVIEW_SCHEMA);
    return { ...res, engine: 'claude' };
  } catch (e) {
    return { ...reviewContrib(s, c), engine: 'local', warning: fallbackNote(e) };
  }
}

// ——— концепция нового проекта ———

export async function askConcept(s: State, input: { title: string; goal: string; category: Category; rolesNeeded: Skill[] }, onText?: (t: string) => void): Promise<AiAnswer> {
  if (!useClaude(s)) return { text: draftConcept(input), engine: 'local' };
  try {
    const ctx = `# Новый проект «${input.title || 'без названия'}»\nКатегория: ${CATEGORIES.find((c) => c.id === input.category)?.name}\nЦель: ${input.goal || '(не указана)'}\nИщем: ${input.rolesNeeded.map((r) => skillInfo(r).name).join(', ') || '—'}`;
    const text = await claudeText(s.ai, ctx, 'Помогите автору сформулировать концепцию проекта. Разделы: ## Зачем, ## Для кого, ## Как это работает, ## Чем отличается, ## Как поймём, что получилось, ## Кого ищем. Конкретно и коротко; где информации не хватает, оставьте автору вопрос курсивом.', onText);
    return { text, engine: 'claude' };
  } catch (e) {
    return { text: draftConcept(input), engine: 'local', warning: fallbackNote(e) };
  }
}

export type { DraftTask, ReviewResult };
