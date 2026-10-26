import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { toRows } from '../data/entities';
import { record } from '../data/runtime';
import { prepareArgs, runOp } from '../data/registry';
import { OpError, cleanFiles, submitContribution, updateContribution } from '../data/ops';
import { execute, stateFromRows } from './core';
import type { State } from '../data/types';

const BASE = 'https://x.supabase.co/storage/v1/object/public/files/';

function withUser(id: string): State {
  const s = stateFromRows(toRows(buildSeed()).values());
  const res = execute(s, { op: 'registerUser', args: [{ name: 'Айгерим', bio: '', skills: ['design'] }], ids: [], time: Date.now() }, id);
  if (!res.ok) throw new Error(res.error);
  const rows = toRows(s);
  for (const u of res.upserts) rows.set(`${u.kind}:${u.id}`, u);
  return stateFromRows(rows.values());
}

function send(s: State, files: unknown[], actor: string) {
  const args = [{ projectId: 'p-commons', title: 'Иконки погоды', summary: 'Нарисовала набор иконок для интерфейса.', kind: 'design', links: [], files, areas: [] }, actor];
  const rec = record(() => runOp(s, 'submitContribution', prepareArgs('submitContribution', args, actor)));
  return execute(s, { op: 'submitContribution', args, ids: rec.ids, time: rec.time, lang: 'ru' }, actor, { filesBase: BASE });
}

const file = (url: string) => ({ name: 'иконки.png', size: 1200, type: 'image/png', url });

describe('файлы во вкладах', () => {
  it('описание файлов проверяется', () => {
    expect(cleanFiles(undefined)).toEqual([]);
    expect(cleanFiles([file('https://a/b.png')])).toEqual([file('https://a/b.png')]);
    expect(() => cleanFiles([{ name: 'x', size: 1, type: '', url: 'javascript:alert(1)' }])).toThrow(OpError);
    expect(() => cleanFiles([{ name: '', size: 1, type: '', url: 'https://a/b' }])).toThrow(OpError);
    expect(() => cleanFiles([{ name: 'x', size: 999e6, type: '', url: 'https://a/b' }])).toThrow(OpError);
    expect(() => cleanFiles(Array.from({ length: 11 }, () => file('https://a/b')))).toThrow(OpError);
  });

  it('вклад с файлами сохраняется, без файлов — поля нет', () => {
    const s = withUser('u1');
    const a = submitContribution(s, { projectId: 'p-commons', title: 'Иконки', summary: 'Нарисовала набор иконок.', kind: 'design', links: [], files: [file('data:image/png;base64,AAAA')], areas: [] }, 'u1');
    expect(a.contribution.files).toHaveLength(1);
    const b = submitContribution(s, { projectId: 'p-commons', title: 'Иконки', summary: 'Нарисовала набор иконок.', kind: 'design', links: [], areas: [] }, 'u1');
    expect('files' in b.contribution).toBe(false);
  });

  it('сервер принимает только файлы из папки вошедшего', () => {
    const s = withUser('u1');
    expect(send(s, [file(`${BASE}u1/abc/icons.png`)], 'u1').ok).toBe(true);
    expect(send(s, [file(`${BASE}u2/abc/icons.png`)], 'u1').ok).toBe(false);
    expect(send(s, [file('https://evil.example/u1/icons.png')], 'u1').ok).toBe(false);
    expect(send(s, [file(`${BASE}u1/../u2/icons.png`)], 'u1').ok).toBe(false);
    expect(send(s, [file('data:image/png;base64,AAAA')], 'u1').ok).toBe(false);
  });

  it('при правке вклада можно убрать файл и добавить новый', () => {
    const s = withUser('u1');
    const r = submitContribution(s, { projectId: 'p-commons', title: 'Иконки', summary: 'Нарисовала набор иконок.', kind: 'design', links: [], files: [file('https://a/1.png')], areas: [] }, 'u1');
    const next = updateContribution(r.state, r.contribution.id, { files: [file('https://a/2.png')] }, 'u1');
    expect(next.contributions.find((c) => c.id === r.contribution.id)!.files!.map((f) => f.url)).toEqual(['https://a/2.png']);
  });
});
