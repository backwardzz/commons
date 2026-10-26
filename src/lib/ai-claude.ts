// Помощник на Claude. Ключ вводит сам пользователь в настройках, он хранится только в его браузере.
// SDK подгружается лениво — без включённого Claude он не попадает в загрузку страницы.
import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { getUser, milestoneProgress, projectMembers, projectTasks } from '../data/ops';
import { ACCEPT_RULES, CATEGORIES, CONTRIBUTION_STATUSES, PRIORITIES, SKILLS, STAGES, TASK_STATUSES, THREAD_KINDS, skillInfo, type AiSettings, type Project, type State, type User } from '../data/types';
import { plain } from './markdown';
import { getLang, tr, type Lang } from '../i18n';

export class AiError extends Error {}

export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', get hint() { return tr('самые вдумчивые ответы'); } },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', get hint() { return tr('быстрее и дешевле'); } },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', get hint() { return tr('самый быстрый и экономный'); } },
];

const SYSTEM_BASE = `Ты — помощник сообщества на Commons, открытой платформе, где люди с разными навыками вместе делают проекты: игры, программы, курсы, цифровое искусство. Твоя задача — снижать порог входа: объяснять проекты новичкам, помогать формулировать задачи и технические задания, переводить требования между специальностями, подсказывать, кому какая задача подойдёт, и проверять вклады на соответствие задаче и конфликты.

Правила:
- Опирайся только на данные проекта из контекста. Не выдумывай факты, людей, файлы и решения. Если данных не хватает, так и скажи.
- Ты советуешь, но не решаешь: принимать или отклонять вклады, менять правила и направление проекта могут только люди, отвечающие за проект.
- Пиши просто и конкретно, вежливо. Ответ — в Markdown: заголовки ##, списки, **жирный** для ключевого. Без вступлений и без повторения вопроса.
- Называй задачи и документы так, как они названы в проекте, в кавычках.`;

const LANG_NAME: Record<Lang, string> = { ru: 'русском', en: 'английском (English)', kk: 'казахском (қазақ тілі)', zh: 'китайском (简体中文)', ja: 'японском (日本語)' };

/** Системная инструкция: отвечать на языке интерфейса участника. */
const system = () => `${SYSTEM_BASE}\n- Отвечай на ${LANG_NAME[getLang()]} языке, даже если материалы проекта на другом языке. Названия задач и документов оставляй как есть.`;

const name = (s: State, id?: string) => getUser(s, id)?.name ?? '—';
const label = <T extends { id: string; name: string }>(list: T[], id: string) => list.find((x) => x.id === id)?.name ?? id;
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** Контекст проекта для модели: всё, что видит участник на странице проекта. */
export function projectContext(s: State, p: Project): string {
  const out: string[] = [];
  out.push(`# Проект «${p.title}»`, `Кратко: ${p.tagline}`, `Цель: ${p.goal}`);
  out.push(`Категория: ${label(CATEGORIES, p.category)}. Стадия: ${label(STAGES, p.stage)}. Инструменты: ${p.techs.join(', ') || '—'}. Лицензия: ${p.license}.`);
  out.push(`Правило принятия вкладов: ${ACCEPT_RULES.find((r) => r.id === p.acceptRule)!.hint}. Автор: ${name(s, p.ownerId)}. Сопровождающие: ${p.maintainerIds.map((id) => name(s, id)).join(', ')}.`);
  if (p.rolesNeeded.length) out.push(`Автор ищет: ${p.rolesNeeded.map((r) => skillInfo(r).name).join(', ')}.`);
  if (p.forkOf) out.push(`Это ответвление проекта «${s.projects.find((x) => x.id === p.forkOf)?.title ?? '—'}».`);

  out.push('', '## Этапы');
  p.milestones.forEach((m, i) => { const mp = milestoneProgress(s, m); out.push(`${i + 1}. ${m.title} — ${m.description} (готово ${mp.done} из ${mp.total})`); });

  out.push('', '## Документы');
  let budget = 30000;
  for (const d of p.docs) {
    const body = cut(d.body.trim(), Math.min(6000, Math.max(0, budget)));
    budget -= body.length;
    out.push(`### ${d.title}`, body || '(пусто)', '');
  }

  out.push('## Задачи');
  for (const t of projectTasks(s, p.id)) {
    const meta = [
      t.skills.map((x) => skillInfo(x).name).join(', '),
      `приоритет: ${label(PRIORITIES, t.priority)}`,
      `размер: ${t.size}`,
      t.type === 'bug' ? 'ошибка' : t.type === 'idea' ? 'идея' : '',
      t.milestoneId ? `этап: ${p.milestones.find((m) => m.id === t.milestoneId)?.title ?? '—'}` : '',
      t.assigneeId ? `исполнитель: ${name(s, t.assigneeId)}` : '',
      t.dependsOn.length ? `зависит от: ${t.dependsOn.map((id) => s.tasks.find((x) => x.id === id)?.title).filter(Boolean).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    out.push(`- [${label(TASK_STATUSES, t.status)}] «${t.title}» (${meta})${t.description ? ` — ${cut(plain(t.description), 400)}` : ''}`);
  }

  const contribs = s.contributions.filter((c) => c.projectId === p.id);
  if (contribs.length) {
    out.push('', '## Вклады');
    for (const c of contribs.slice(0, 30)) {
      const task = s.tasks.find((t) => t.id === c.taskId);
      out.push(`- [${label(CONTRIBUTION_STATUSES, c.status)}] «${c.title}» от ${name(s, c.authorId)} (${skillInfo(c.kind).name}${task ? `; задача «${task.title}»` : '; без задачи'}${c.areas.length ? `; затрагивает: ${c.areas.join(', ')}` : ''}${c.links.length ? `; файлы: ${c.links.join(', ')}` : ''}) — ${cut(plain(c.summary), 500)}`);
      for (const r of c.reviews) out.push(`  - ${name(s, r.authorId)} (${r.verdict === 'approve' ? 'одобрил' : r.verdict === 'changes' ? 'просит правки' : 'комментарий'}): ${cut(r.text, 300)}`);
      if (c.decisionNote) out.push(`  - решение: ${c.decisionNote}`);
    }
  }

  const threads = s.threads.filter((t) => t.projectId === p.id);
  if (threads.length) {
    out.push('', '## Обсуждения');
    for (const th of threads) {
      out.push(`- «${th.title}» (${label(THREAD_KINDS, th.kind)})${th.decision ? ` — решение: ${th.decision.text}` : ' — решение не принято'}`);
      for (const c of th.comments.slice(-4)) out.push(`  - ${name(s, c.authorId)}: ${cut(plain(c.body), 300)}`);
    }
  }

  out.push('', '## Участники');
  for (const id of projectMembers(s, p)) {
    const u = getUser(s, id);
    if (u) out.push(`- ${u.name} — ${u.skills.map((x) => skillInfo(x).name).join(', ')}`);
  }
  return out.join('\n');
}

export function personContext(user?: User): string {
  if (!user) return 'Спрашивает гость без профиля — навыки неизвестны.';
  return `Спрашивает ${user.name}. Навыки: ${user.skills.map((x) => skillInfo(x).name).join(', ')}.${user.bio ? ` О себе: ${user.bio}` : ''}`;
}

async function sdk() {
  const mod = await import('@anthropic-ai/sdk');
  return mod.default;
}

function explain(e: unknown, A: Awaited<ReturnType<typeof sdk>>): string {
  if (e instanceof AiError) return e.message;
  if (e instanceof A.AuthenticationError) return tr('ключ не подошёл — проверьте его в настройках');
  if (e instanceof A.PermissionDeniedError) return tr('у ключа нет доступа к выбранной модели');
  if (e instanceof A.RateLimitError) return tr('слишком много запросов, попробуйте через минуту');
  if (e instanceof A.BadRequestError) return tr('запрос отклонён: {message}', { message: e.message });
  if (e instanceof A.APIConnectionError) return tr('нет связи с сервером Anthropic');
  if (e instanceof A.APIError) return tr('ошибка сервера ({status})', { status: e.status ?? '—' });
  return tr('неизвестная ошибка');
}

function baseParams(settings: AiSettings, context: string, instruction: string): BetaMessageStreamParams {
  const params: BetaMessageStreamParams = {
    model: settings.model,
    max_tokens: 16000,
    // контекст проекта стабилен между вопросами — кэшируем его
    system: [
      { type: 'text', text: system() },
      { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: instruction }],
    output_config: { effort: 'medium' },
  };
  // при отказе классификатора сервер сам повторит запрос на запасной модели
  if (!settings.model.startsWith('claude-haiku')) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

export async function claudeText(settings: AiSettings, context: string, instruction: string, onText?: (snapshot: string) => void): Promise<string> {
  if (!settings.apiKey.trim()) throw new AiError(tr('не указан ключ API'));
  const A = await sdk();
  try {
    const client = new A({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true });
    const stream = client.beta.messages.stream(baseParams(settings, context, instruction));
    if (onText) stream.on('text', (_delta, snapshot) => onText(snapshot));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new AiError(tr('Claude отказался отвечать на этот запрос'));
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (!text) throw new AiError(tr('пустой ответ'));
    return text;
  } catch (e) {
    throw new AiError(explain(e, A));
  }
}

export async function claudeJSON<T>(settings: AiSettings, context: string, instruction: string, schema: Record<string, unknown>): Promise<T> {
  if (!settings.apiKey.trim()) throw new AiError(tr('не указан ключ API'));
  const A = await sdk();
  try {
    const client = new A({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true });
    const params = baseParams(settings, context, instruction);
    params.output_config = { effort: 'medium', format: { type: 'json_schema', schema } };
    const msg = await client.beta.messages.stream(params).finalMessage();
    if (msg.stop_reason === 'refusal') throw new AiError(tr('Claude отказался отвечать на этот запрос'));
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError(tr('ответ пришёл в неожиданном формате'));
    throw new AiError(explain(e, A));
  }
}

/** Перевод текста. Отдельный короткий запрос без контекста проекта. */
export async function claudeTranslate(settings: AiSettings, text: string, to: Lang): Promise<string> {
  if (!settings.apiKey.trim()) throw new AiError(tr('не указан ключ API'));
  const A = await sdk();
  try {
    const client = new A({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true });
    const msg = await client.messages.create({
      model: settings.model,
      max_tokens: 4000,
      system: `Ты переводчик. Переведи текст пользователя на ${LANG_NAME[to]} язык. Сохрани Markdown-разметку, ссылки, имена и названия. Ответь только переводом, без пояснений.`,
      messages: [{ role: 'user', content: text }],
    });
    const out = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (!out) throw new AiError(tr('пустой ответ'));
    return out;
  } catch (e) {
    throw new AiError(explain(e, A));
  }
}

export const SKILL_ENUM = SKILLS.map((s) => s.id);
