// Ядро серверной функции ops: проверить запрос, повторить действие с правилами платформы,
// вернуть изменения для записи в базу. Без сетевых вызовов — чтобы проверять тестами.
import { OpError, getProject } from '../data/ops';
import { ID_RE, replay } from '../data/runtime';
import { REGISTRY, prepareArgs, runOp } from '../data/registry';
import { diffRows, fromRows, takenIds, toRows, type Row } from '../data/entities';
import type { State } from '../data/types';
import { LANGS, loadLang, setLang, tr, type Lang } from '../i18n';

export interface OpRequest {
  op: string;
  args: unknown[];
  ids: string[];
  time: number;
  lang?: string;
}

export type OpResult =
  | { ok: true; upserts: Row[]; deletes: Pick<Row, 'kind' | 'id'>[] }
  | { ok: false; status: number; error: string };

const MAX_SKEW = 10 * 60e3;

export function stateFromRows(rows: Iterable<Pick<Row, 'kind' | 'data'>>): State {
  return {
    version: 2, ...fromRows(rows),
    currentUserId: null, ai: { mode: 'local', apiKey: '', model: '' }, theme: 'auto', lang: 'ru',
  };
}

export async function useLang(lang?: string) {
  const l = (LANGS.some((x) => x.id === lang) ? lang : 'en') as Lang;
  await loadLang(l);
  setLang(l);
}

export interface ExecOptions {
  /** Проект, в котором вошедший становится сопровождающим при создании профиля (для команды платформы). */
  adminProjectId?: string;
  isAdmin?: boolean;
  /**
   * Адрес публичных файлов хранилища (…/storage/v1/object/public/files/). Новые файлы во вкладе
   * должны лежать в папке вошедшего пользователя — чужие ссылки и файлы внутри запроса не принимаются.
   */
  filesBase?: string;
}

/** Новые (которых не было в прежней версии) файлы вкладов в изменениях. */
function newFileUrls(state: State, upserts: Row[]): string[] {
  const out: string[] = [];
  for (const r of upserts) {
    if (r.kind !== 'contribution') continue;
    const was = new Set((state.contributions.find((c) => c.id === r.id)?.files ?? []).map((f) => f.url));
    for (const f of (r.data as { files?: { url: string }[] }).files ?? []) if (!was.has(f.url)) out.push(f.url);
  }
  return out;
}

export function execute(state: State, req: OpRequest, actorId: string, opt: ExecOptions = {}): OpResult {
  if (!req || typeof req.op !== 'string' || !Object.hasOwn(REGISTRY, req.op)) return { ok: false, status: 400, error: 'unknown op' };
  if (!Array.isArray(req.args) || !Array.isArray(req.ids) || req.ids.length > 500) return { ok: false, status: 400, error: 'bad request' };
  if (JSON.stringify(req.args).length > 200_000) return { ok: false, status: 413, error: 'too large' };

  // новые id из браузера: правильного вида, не повторяются и не совпадают с уже существующими
  const taken = takenIds(state);
  const seen = new Set<string>();
  for (const id of req.ids) {
    if (typeof id !== 'string' || !ID_RE.test(id) || taken.has(id) || seen.has(id)) return { ok: false, status: 400, error: 'bad ids' };
    seen.add(id);
  }
  const fresh = typeof req.time === 'number' && Math.abs(req.time - Date.now()) <= MAX_SKEW;
  const run = fresh ? { ids: req.ids, time: req.time } : { ids: [], time: Date.now() };

  const args = prepareArgs(req.op, req.args, actorId);
  let next: State;
  try {
    next = replay(run, () => runOp(state, req.op, args).state);
  } catch (e) {
    if (e instanceof OpError) return { ok: false, status: 422, error: e.message };
    return { ok: false, status: 500, error: 'internal error' };
  }

  if (req.op === 'registerUser' && opt.isAdmin && opt.adminProjectId) {
    const p = getProject(next, opt.adminProjectId);
    if (p && !p.maintainerIds.includes(actorId)) {
      next = { ...next, projects: next.projects.map((x) => (x.id === p.id ? { ...x, maintainerIds: [...x.maintainerIds, actorId], followerIds: [...new Set([...x.followerIds, actorId])] } : x)) };
    }
  }

  const { upserts, deletes } = diffRows(toRows(state), toRows(next));
  const own = opt.filesBase ? opt.filesBase + actorId + '/' : null;
  for (const url of newFileUrls(state, upserts)) {
    if (url.startsWith('data:') || (own && (!url.startsWith(own) || url.includes('..')))) return { ok: false, status: 422, error: tr('Файлы прикладываются только загрузкой через Commons') };
  }
  return { ok: true, upserts, deletes };
}
