import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_KEYS, extractKeys } from './keys';
import { en } from './en';
import { kk } from './kk';
import { zh } from './zh';
import { ja } from './ja';
import { loadLang, setLang, tn, tr } from '.';

const SRC = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'i18n' ? [] : files(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) && n !== 'fixture.ts' ? [p] : [];
  });
}

const keys = [...new Set([...files(SRC).flatMap((f) => extractKeys(readFileSync(f, 'utf8'), f)), ...DYNAMIC_KEYS])];
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('словари', () => {
  it('ключей много — сбор работает', () => {
    expect(keys.length).toBeGreaterThan(500);
  });
  for (const [name, dict] of Object.entries({ en, kk, zh, ja })) {
    it(`${name}: есть перевод для каждой строки`, () => {
      expect(keys.filter((k) => !(k in dict))).toEqual([]);
    });
    it(`${name}: подстановки совпадают с оригиналом`, () => {
      const bad = keys.filter((k) => k in dict).filter((k) => {
        const want = new Set(vars(k));
        // в формах множественного числа {n} может встречаться не во всех формах — сравниваем наборы
        return [...new Set(vars(dict[k]))].join() !== [...want].join();
      });
      expect(bad).toEqual([]);
    });
  }
});

describe('tr и tn', () => {
  it('переводит и подставляет', async () => {
    await loadLang('en');
    setLang('en');
    expect(tr('Задачи')).toBe(en['Задачи']);
    expect(tn(1, '{n} задача|{n} задачи|{n} задач')).toMatch(/^1 /);
    expect(tn(5, '{n} задача|{n} задачи|{n} задач')).toMatch(/^5 /);
    setLang('ru');
    expect(tn(3, '{n} задача|{n} задачи|{n} задач')).toBe('3 задачи');
    expect(tn(5, '{n} задача|{n} задачи|{n} задач')).toBe('5 задач');
  });
});
