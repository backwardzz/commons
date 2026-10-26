// Связь с общей базой (Supabase). Включается, если заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY;
// без них сайт работает как демо в браузере.
// Чтение — напрямую из таблицы entities (что можно видеть, решает база), изменения — через
// серверную функцию ops, живые обновления — через Realtime.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { rowKey, type Row } from './entities';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const backendEnabled = !!(URL && KEY);

export const sb: SupabaseClient | null = backendEnabled
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'commons-auth', flowType: 'pkce', detectSessionInUrl: true } })
  : null;

export interface AuthInfo { id: string; email: string; name: string; avatar?: string }

type RowsListener = (rows: Map<string, Row>) => void;
type AuthListener = (user: AuthInfo | null) => void;

let rows = new Map<string, Row>();
let onRows: RowsListener = () => undefined;
let onAuth: AuthListener = () => undefined;
let currentUid: string | null = null;
let flush: ReturnType<typeof setTimeout> | null = null;

const emit = () => {
  if (flush) return;
  flush = setTimeout(() => { flush = null; onRows(rows); }, 30);
};

function authInfo(session: Session | null): AuthInfo | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name ?? meta.name ?? (u.email ?? '').split('@')[0]) as string;
  return { id: u.id, email: u.email ?? '', name, avatar: typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : undefined };
}

async function loadAll(): Promise<void> {
  const next = new Map<string, Row>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb!.from('entities').select('kind, id, project_id, visible_to, data').range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as Row[]) next.set(rowKey(r), r);
    if (!data || data.length < 1000) break;
  }
  rows = next;
  if (flush) { clearTimeout(flush); flush = null; }
  onRows(rows);
}

let channel: ReturnType<SupabaseClient['channel']> | null = null;

function subscribe() {
  if (channel) void sb!.removeChannel(channel);
  channel = sb!
    .channel('entities')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entities' }, (p) => {
      if (p.eventType === 'DELETE') {
        const old = p.old as Partial<Row>;
        if (old.kind && old.id) rows.delete(rowKey(old as Row));
      } else {
        const r = p.new as Row;
        rows.set(rowKey(r), r);
      }
      emit();
    })
    .subscribe((status) => {
      // после переподключения могли пропустить изменения — перечитываем
      if (status === 'SUBSCRIBED' && rows.size) void loadAll().catch(() => undefined);
    });
}

/** Первая загрузка и подписки. Возвращается, когда данные получены (или не удалось). */
export async function startBackend(rowsListener: RowsListener, authListener: AuthListener): Promise<void> {
  if (!sb) return;
  onRows = rowsListener;
  onAuth = authListener;
  const { data } = await sb.auth.getSession();
  currentUid = data.session?.user.id ?? null;
  onAuth(authInfo(data.session));
  sb.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id ?? null;
    onAuth(authInfo(session));
    if (uid !== currentUid) {
      currentUid = uid;
      // другой пользователь — другие личные данные: перечитываем и переподписываемся
      if (session) sb!.realtime.setAuth(session.access_token);
      void loadAll().then(subscribe).catch(() => undefined);
    }
  });
  await loadAll();
  subscribe();
}

export const reloadAll = () => (sb ? loadAll() : Promise.resolve());

/** Отправить действие на сервер. Ошибка приходит текстом, понятным человеку. */
export async function sendOp(body: { op: string; args: unknown[]; ids: string[]; time: number; lang: string }): Promise<void> {
  if (!sb) return;
  const { error } = await sb.functions.invoke('ops', { body });
  if (!error) return;
  let message = error.message;
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try { message = ((await ctx.json()) as { error?: string }).error ?? message; } catch { /* не JSON */ }
  }
  throw new Error(message);
}

// ——— вход ———

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await sb!.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await sb!.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signInWithGoogleToken(idToken: string): Promise<void> {
  const { error } = await sb!.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await sb?.auth.signOut();
}
