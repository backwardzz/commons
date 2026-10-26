// Вход через Google (Google Identity Services, без своего сервера).
// Нужен OAuth Client ID типа «Web application»: VITE_GOOGLE_CLIENT_ID в .env.local при сборке.
// Google возвращает подписанный токен с именем и почтой; профиль создаётся или находится по его id.
// Пока данные хранятся в браузере, это вход «на этом устройстве», а не общий аккаунт.

export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
export const googleEnabled = () => !!GOOGLE_CLIENT_ID;

export interface GoogleProfile { sub: string; email: string; name: string; picture?: string; locale?: string }

/** Данные из ID-токена Google (часть между точками — base64url JSON). */
export function decodeIdToken(token: string): GoogleProfile | null {
  try {
    const part = token.split('.')[1];
    const json = decodeURIComponent(
      atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
        .split('').map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const p = JSON.parse(json) as Record<string, unknown>;
    if (typeof p.sub !== 'string' || !p.sub) return null;
    if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') return null;
    if (GOOGLE_CLIENT_ID && p.aud !== GOOGLE_CLIENT_ID) return null;
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    return {
      sub: p.sub,
      email: typeof p.email === 'string' ? p.email : '',
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : typeof p.email === 'string' ? p.email.split('@')[0] : 'Google',
      picture: typeof p.picture === 'string' && p.picture.startsWith('https://') ? p.picture : undefined,
      locale: typeof p.locale === 'string' ? p.locale : undefined,
    };
  } catch {
    return null;
  }
}

interface Gsi {
  accounts: { id: {
    initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; use_fedcm_for_prompt?: boolean }): void;
    renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    disableAutoSelect(): void;
  } };
}

let loading: Promise<Gsi> | null = null;

/** Скрипт Google подгружается только когда нужен — при открытии окна входа. */
export function loadGsi(): Promise<Gsi> {
  const w = window as unknown as { google?: Gsi };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => (w.google ? resolve(w.google) : reject(new Error('gsi')));
      s.onerror = () => { loading = null; reject(new Error('gsi')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Нарисовать кнопку «Войти через Google» в элементе. */
export async function renderGoogleButton(el: HTMLElement, lang: string, dark: boolean, onProfile: (p: GoogleProfile | null, credential: string) => void) {
  const g = await loadGsi();
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (r) => onProfile(decodeIdToken(r.credential), r.credential),
    ux_mode: 'popup',
    auto_select: false,
  });
  el.innerHTML = '';
  g.accounts.id.renderButton(el, { type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: lang, width: Math.min(360, el.clientWidth || 320) });
}

export function googleSignOut() {
  const w = window as unknown as { google?: Gsi };
  w.google?.accounts?.id?.disableAutoSelect();
}
