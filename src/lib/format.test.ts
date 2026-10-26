import { describe, expect, it } from 'vitest';
import { g, gverb, plural } from './format';

describe('русский текст', () => {
  it('согласует глагол с участницей', () => {
    const she = { gender: 'f' as const };
    expect(gverb('взял в работу #6 «Модель»', she)).toBe('взяла в работу #6 «Модель»');
    expect(gverb('перенёс задачу #3 в работу', she)).toBe('перенесла задачу #3 в работу');
    expect(gverb('снова открыл задачу #4', she)).toBe('снова открыла задачу #4');
    expect(gverb('взял в работу', { gender: 'm' })).toBe('взял в работу');
    expect(gverb('взял в работу', undefined)).toBe('взял в работу');
    expect(g(she, 'внёс вклад', 'внесла вклад')).toBe('внесла вклад');
  });

  it('склоняет числительные', () => {
    expect(plural(1, 'задача', 'задачи', 'задач')).toBe('задача');
    expect(plural(3, 'задача', 'задачи', 'задач')).toBe('задачи');
    expect(plural(11, 'задача', 'задачи', 'задач')).toBe('задач');
    expect(plural(22, 'задача', 'задачи', 'задач')).toBe('задачи');
  });
});
