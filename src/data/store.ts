// Хранилище состояния. Два режима:
// • демо — всё в браузере (localStorage), как раньше;
// • общая база — проекты, профили, чаты приходят из Supabase и видны всем, в браузере остаются
//   только личные настройки (язык, тема, ключ Claude).
// Страницы меняют данные через act(name, args): действие выполняется сразу у себя,
// а в режиме общей базы — ещё и на сервере, который проверяет права теми же правилами.
import { useSyncExternalStore } from 'react';
import { buildSeed } from './seed';
import { OpError } from './ops';
import type { State } from './types';
import { REGISTRY, prepareArgs, runOp, type OpName } from './registry';
import { record } from './runtime';
import { fromRows } from './entities';
import { backendEnabled, reloadAll, sendOp, startBackend, type AuthInfo } from './backend';
import { detectLang, loadLang, setLang, tr, type Lang } from '../i18n';

export { backendEnabled };

// новый ключ: демо-данные сменились (один проект — сама платформа), старые проекты не подтягиваем
const KEY = 'commons:v1';
const PREFS_KEY = 'commons:prefs';

type Prefs = Pick<State, 'ai' | 'theme' | 'lang' | 'autoTranslate'>;

function readStorage(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as State;
    if (parsed?.version !== 2 || !Array.isArray(parsed.projects)) return null;
    // поля, которых не было в ранних версиях сохранения
    return { ...parsed, announcements: parsed.announcements ?? [], messages: parsed.messages ?? [], invites: parsed.invites ?? [], readAt: parsed.readAt ?? {}, lang: parsed.lang ?? detectLang() };
  } catch {
    return null;
  }
}

function readPrefs(): Prefs {
  const base: Prefs = { ai: { mode: 'local', apiKey: '', model: 'claude-opus-5-5' }, theme: 'auto', lang: detectLang(), autoTranslate: false };
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return base;
  }
}

function writeStorage(s: State) {
  try {
    if (backendEnabled) {
      const prefs: Prefs = { ai: s.ai, theme: s.theme, lang: s.lang, autoTranslate: s.autoTranslate };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } else {
      localStorage.setItem(KEY, JSON.stringify(s));
    }
  } catch {
    /* приватный режим или нет места — работаем без сохранения */
  }
}

function initialState(): State {
  if (typeof localStorage === 'undefined') return buildSeed();
  if (backendEnabled) {
    return { version: 2, ...fromRows([]), currentUserId: null, ...readPrefs() };
  }
  const saved = readStorage();
  if (saved) return saved;
  setLang(detectLang());
  return buildSeed();
}

let state: State = initialState();
setLang(state.lang);
const listeners = new Set<() => void>();

export const getState = () => state;

function set(next: State) {
  state = next;
  setLang(next.lang);
  writeStorage(next);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Весь стейт. Производные считаются в компонентах через useMemo. */
export function useAppState(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

export type ApplyResult<T> = { ok: true; value: T } | { ok: false; error: string };

const failure = (e: unknown): { ok: false; error: string } => {
  if (e instanceof OpError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: tr('Что-то пошло не так. Обновите страницу и попробуйте ещё раз.') };
};

/**
 * Выполняет операцию над состоянием (только локально). Операция возвращает либо новое состояние,
 * либо { state, …данные }. Ошибки правил (OpError) возвращаются текстом для показа.
 */
export function apply<R>(op: (s: State) => R): ApplyResult<R> {
  try {
    const result = op(state);
    if (result === (state as unknown)) {
      // ничего не изменилось
    } else if (result && typeof result === 'object' && 'version' in (result as object)) {
      set(result as unknown as State);
    } else if (result && typeof result === 'object' && 'state' in (result as object)) {
      set((result as unknown as { state: State }).state);
    }
    return { ok: true, value: result };
  } catch (e) {
    return failure(e);
  }
}

// ——— ошибки синхронизации показываются уведомлением (подписывается интерфейс) ———

const syncErrorListeners = new Set<(message: string) => void>();
export function onSyncError(l: (message: string) => void) {
  syncErrorListeners.add(l);
  return () => { syncErrorListeners.delete(l); };
}

/**
 * Действие платформы по имени из реестра. В демо — как apply; с общей базой — сразу у себя
 * и параллельно на сервере. Если сервер не согласен, данные перечитываются из базы.
 */
export function act<R = never>(name: OpName, args: unknown[]): ApplyResult<R> {
  const entry = REGISTRY[name];
  if (!backendEnabled) return apply((s) => entry.fn(s, ...(args as never[])) as R);
  const actor = state.currentUserId;
  if (!actor) return { ok: false, error: tr('Войдите, чтобы продолжить') };
  try {
    const rec = record(() => runOp(state, name, prepareArgs(name, args, actor)));
    const next = rec.value.state;
    if (next !== state) {
      set({ ...next, currentUserId: state.currentUserId });
      void sendOp({ op: name, args, ids: rec.ids, time: rec.time, lang: state.lang }).catch((e: Error) => {
        syncErrorListeners.forEach((l) => l(e.message));
        void reloadAll();
      });
    }
    return { ok: true, value: rec.value.value as R };
  } catch (e) {
    return failure(e);
  }
}

/** Сменить язык: сначала догружаем словарь, потом перерисовываем интерфейс. */
export async function changeLang(l: Lang) {
  try { await loadLang(l); } catch { /* нет сети — останется текст по-русски */ }
  setState({ lang: l });
}

export function setState(patch: Partial<State>) {
  set({ ...state, ...patch });
}

export function resetDemo() {
  if (backendEnabled) return;
  const keep = { ai: state.ai, theme: state.theme, lang: state.lang };
  set({ ...buildSeed(), ...keep });
}

export function exportData(): string {
  const { ai, ...rest } = state;
  return JSON.stringify({ ...rest, ai: { ...ai, apiKey: '' } }, null, 2);
}

// ——— вход в общую базу ———

let authUser: AuthInfo | null = null;
const authListeners = new Set<() => void>();
export const getAuthUser = () => authUser;
export function useAuthUser(): AuthInfo | null {
  return useSyncExternalStore((l) => { authListeners.add(l); return () => authListeners.delete(l); }, getAuthUser, getAuthUser);
}

/** Подключиться к общей базе: первая загрузка данных, вход, живые обновления. */
export async function connect(): Promise<void> {
  if (!backendEnabled) return;
  await startBackend(
    (rows) => {
      const shared = fromRows(rows.values());
      state = { ...state, ...shared };
      listeners.forEach((l) => l());
    },
    (user) => {
      authUser = user;
      authListeners.forEach((l) => l());
      if (state.currentUserId !== (user?.id ?? null)) setState({ currentUserId: user?.id ?? null });
    },
  );
}

// синхронизация между вкладками (в демо-режиме)
if (typeof window !== 'undefined' && !backendEnabled) {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const next = readStorage();
    if (next) {
      void loadLang(next.lang).catch(() => undefined).then(() => {
        state = next;
        setLang(next.lang);
        listeners.forEach((l) => l());
      });
    }
  });
}
