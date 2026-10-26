// Положить стартовый проект Commons в общую базу (если его там ещё нет).
// Локально: npm run seed:db. Для облака: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY облачного проекта.
//   npm run seed:db -- --lang=en   — язык стартовых текстов (по умолчанию ru)
import { createClient } from '@supabase/supabase-js';
import { buildSeed } from '../src/data/seed';
import { toRows } from '../src/data/entities';
import { loadLang, setLang, type Lang } from '../src/i18n';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
// локальный ключ сервисной роли — стандартный для supabase start
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const lang = (process.argv.find((a) => a.startsWith('--lang='))?.slice(7) ?? 'ru') as Lang;

const db = createClient(url, key, { auth: { persistSession: false } });

const { count, error } = await db.from('entities').select('id', { count: 'exact', head: true }).eq('kind', 'project').eq('id', 'p-commons');
if (error) throw error;
if (count) {
  console.log('Проект Commons уже есть в базе — ничего не делаю.');
} else {
  await loadLang(lang);
  setLang(lang);
  const rows = [...toRows(buildSeed()).values()].filter((r) => r.kind !== 'read');
  const { error: e2 } = await db.rpc('entities_apply', { upserts: rows, deletes: [] });
  if (e2) throw e2;
  console.log(`Записано ${rows.length} строк: проект Commons, задачи, объявление, обсуждение и чат.`);
}
