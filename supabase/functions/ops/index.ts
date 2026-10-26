// Серверная функция Commons: выполняет действие пользователя с проверкой прав и пишет изменения в базу.
// Правила — те же, что в интерфейсе: core.js собирается из src/server/core.ts (npm run build:functions).
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore — собранный файл без типов
import { execute, stateFromRows, useLang } from './core.js';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// почты команды платформы: при создании профиля они становятся сопровождающими проекта Commons
const ADMINS = (Deno.env.get('COMMONS_ADMINS') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const ADMIN_PROJECT = Deno.env.get('COMMONS_PROJECT_ID') ?? 'p-commons';
// адрес публичных файлов, как его видит браузер (локально он отличается от внутреннего SUPABASE_URL)
const FILES_BASE = Deno.env.get('COMMONS_FILES_BASE') ?? `${URL}/storage/v1/object/public/files/`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

async function loadRows() {
  const rows: { kind: string; data: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('entities').select('kind, data').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user || user.is_anonymous) return json({ error: 'sign in required' }, 401);

  let body: { op: string; args: unknown[]; ids: string[]; time: number; lang?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  try {
    await useLang(body.lang);
    const state = stateFromRows(await loadRows());
    const res = execute(state, body, user.id, { isAdmin: ADMINS.includes((user.email ?? '').toLowerCase()), adminProjectId: ADMIN_PROJECT, filesBase: FILES_BASE });
    if (!res.ok) return json({ error: res.error }, res.status);
    if (res.upserts.length || res.deletes.length) {
      const { error } = await db.rpc('entities_apply', { upserts: res.upserts, deletes: res.deletes });
      if (error) throw error;
    }
    return json({ ok: true, changed: res.upserts.length + res.deletes.length });
  } catch (e) {
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
});
