// Сквозная проверка общей базы на локальном Supabase: два пользователя, проект, задача,
// личное сообщение. Запуск: npm run db:start, npm run functions:serve, затем npm run smoke:db.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failed++; };

async function user(email: string): Promise<{ db: SupabaseClient; id: string; token: string }> {
  const password = 'smoke-test-password-1';
  const found = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email);
  if (found) await admin.auth.admin.deleteUser(found.id);
  await admin.from('entities').delete().eq('kind', 'user').eq('id', found?.id ?? '-');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await db.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { db, id: data.user.id, token: s.data.session!.access_token };
}

async function op(token: string, name: string, args: unknown[], ids: string[] = []) {
  const r = await fetch(`${URL}/functions/v1/ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify({ op: name, args, ids, time: Date.now(), lang: 'ru' }),
  });
  return { status: r.status, body: await r.json() as { ok?: boolean; error?: string } };
}

const a = await user('smoke-a@test.local');
const b = await user('smoke-b@test.local');
const c = await user('smoke-c@test.local');

check((await op(a.token, 'registerUser', [{ name: 'Смоук А', bio: '', skills: ['code'] }])).status === 200, 'А создал профиль');
check((await op(b.token, 'registerUser', [{ name: 'Смоук Б', bio: '', skills: ['design'] }])).status === 200, 'Б создал профиль');
check((await op(c.token, 'registerUser', [{ name: 'Смоук В', bio: '', skills: ['qa'] }])).status === 200, 'В создал профиль');

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const projects = await anon.from('entities').select('id').eq('kind', 'project');
check((projects.data ?? []).some((p) => p.id === 'p-commons'), 'без входа виден проект Commons');

const thread = await op(b.token, 'addThread', ['p-commons', { title: 'Идея от Б из смоук-теста', kind: 'idea', body: 'Текст идеи' }], ['thsmoke' + Date.now().toString(36)]);
check(thread.status === 200, 'Б написал идею в обсуждения');
const seen = await a.db.from('entities').select('data').eq('kind', 'thread');
check((seen.data ?? []).some((t) => (t.data as { title: string }).title === 'Идея от Б из смоук-теста'), 'А видит идею Б');

const forbidden = await op(a.token, 'postAnnouncement', ['p-commons', { kind: 'news', title: 'Чужая новость', body: 'нельзя' }, 'u-commons']);
check(forbidden.status === 422, `А не может публиковать объявления в чужом проекте (${forbidden.body.error})`);

const chat = `dm:${[a.id, b.id].sort().join(':')}`;
check((await op(a.token, 'sendMessage', [chat, 'Привет из смоук-теста'])).status === 200, 'А написал Б личное сообщение');
const forB = await b.db.from('entities').select('data').eq('kind', 'message');
check((forB.data ?? []).some((m) => (m.data as { body: string }).body === 'Привет из смоук-теста'), 'Б видит сообщение');
const forC = await c.db.from('entities').select('data').eq('kind', 'message');
check(!(forC.data ?? []).some((m) => (m.data as { body: string }).body === 'Привет из смоук-теста'), 'В не видит чужую переписку');
const forAnon = await anon.from('entities').select('data').eq('kind', 'message');
check(!(forAnon.data ?? []).some((m) => (m.data as { body: string }).body === 'Привет из смоук-теста'), 'без входа переписку не видно');

const direct = await a.db.from('entities').insert({ kind: 'project', id: 'hack', data: {} });
check(!!direct.error, 'напрямую в базу записать нельзя');
const noAuth = await op('not-a-token', 'toggleFollow', ['p-commons']);
check(noAuth.status === 401, 'без входа действия не выполняются');

// уборка: тестовые пользователи и их следы
for (const u of [a, b, c]) {
  await admin.from('entities').delete().contains('visible_to', [u.id]);
  await admin.from('entities').delete().eq('kind', 'user').eq('id', u.id);
  await admin.auth.admin.deleteUser(u.id);
}
await admin.from('entities').delete().eq('kind', 'thread').like('id', 'thsmoke%');
await admin.from('entities').delete().eq('kind', 'activity').like('data->>actorId', '%').in('data->>actorId', [a.id, b.id, c.id]);

console.log(failed ? `\nНе прошло: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
