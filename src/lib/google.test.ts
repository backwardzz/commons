import { describe, expect, it } from 'vitest';
import { decodeIdToken } from './google';
import { buildSeed } from '../data/seed';
import { registerUser, userByGoogle } from '../data/ops';

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (payload: Record<string, unknown>) => `${b64url({ alg: 'RS256' })}.${b64url(payload)}.sig`;

describe('вход через Google', () => {
  it('читает имя (в том числе кириллицей), почту и id из токена', () => {
    const p = decodeIdToken(token({ iss: 'https://accounts.google.com', sub: '1234', email: 'aigerim@gmail.com', name: 'Айгерим Садыкова', picture: 'https://lh3.googleusercontent.com/a/x', exp: Date.now() / 1000 + 600 }));
    expect(p).toEqual({ sub: '1234', email: 'aigerim@gmail.com', name: 'Айгерим Садыкова', picture: 'https://lh3.googleusercontent.com/a/x', locale: undefined });
  });

  it('отбрасывает чужие и просроченные токены', () => {
    expect(decodeIdToken(token({ iss: 'https://evil.example', sub: '1' }))).toBeNull();
    expect(decodeIdToken(token({ iss: 'accounts.google.com', sub: '1', exp: Date.now() / 1000 - 10 }))).toBeNull();
    expect(decodeIdToken('мусор')).toBeNull();
  });

  it('один аккаунт Google — один профиль', () => {
    const r = registerUser(buildSeed(), { name: 'Aigerim', bio: '', skills: ['design'], google: { sub: 'g-1', email: 'a@gmail.com' } });
    expect(userByGoogle(r.state, 'g-1')?.id).toBe(r.id);
    expect(() => registerUser(r.state, { name: 'Aigerim 2', bio: '', skills: ['code'], google: { sub: 'g-1', email: 'a@gmail.com' } })).toThrow(/уже привязан/);
  });
});
