import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { registerUser, userByGoogle } from '../data/ops';
import { googleEnabled, googleSignOut, renderGoogleButton, type GoogleProfile } from '../lib/google';
import { act, backendEnabled, changeLang, getState, onSyncError, setState, useAppState, useAuthUser } from '../data/store';
import type { Skill } from '../data/types';
import { Avatar, Field, Modal, SkillDots, SkillPicker, Toasts, report, toast, useLoginRequest, useMe } from './ui';
import { IconChevron, IconGear, IconGlobe, IconIssue, IconMail, IconMoon, IconSun, IconUser } from './icons';
import { unreadTotal } from '../data/community';
import { CloudLogin } from './CloudLogin';
import { signOut } from '../data/backend';
import { CountrySelect } from './social';
import { COUNTRY_CODES } from '../lib/countries';

/** Страна по настройкам браузера — как подсказка, участник может поменять. */
function guessCountry(): string | undefined {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && COUNTRY_CODES.includes(region) ? region : undefined;
  } catch {
    return undefined;
  }
}
import { DialogHost, Popover, SelectMenu, TooltipLayer } from './pop';
import { LANGS, getLang, tr, type Lang } from '../i18n';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label={tr('Commons — на главную')}>
      <svg className="brand-mark" viewBox="0 0 32 32" width="24" height="24" aria-hidden>
        <path d="M13.16 6.41A10 10 0 0 1 23.07 8.93" style={{ stroke: 'var(--sk-code)' }} />
        <path d="M6.02 15.30A10 10 0 0 1 11.85 6.90" style={{ stroke: 'var(--sk-design)' }} />
        <path d="M11.85 25.10A10 10 0 0 1 6.02 16.70" style={{ stroke: 'var(--sk-art2d)' }} />
        <path d="M23.07 23.07A10 10 0 0 1 13.16 25.59" style={{ stroke: 'var(--sk-art3d)' }} />
        <circle cx="16" cy="16" r="2.6" />
      </svg>
      <span className="brand-word">commons</span>
    </Link>
  );
}

/** Какая тема сейчас видна: «как в системе» раскрываем по настройке ОС. */
function useDark(theme: 'auto' | 'light' | 'dark') {
  const [sysDark, setSysDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return theme === 'dark' || (theme === 'auto' && sysDark);
}

function ThemeToggle() {
  const s = useAppState();
  const dark = useDark(s.theme);
  const label = dark ? tr('Светлая тема') : tr('Тёмная тема');
  return (
    <button type="button" className="top-btn" aria-label={label} data-tip={label} onClick={() => setState({ theme: dark ? 'light' : 'dark' })}>
      {dark ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}

function LangMenu() {
  const s = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const cur = LANGS.find((l) => l.id === s.lang) ?? LANGS[0];
  return (
    <>
      <button ref={ref} type="button" className="top-btn lang-btn" aria-label={tr('Язык')} data-tip={tr('Язык')} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <IconGlobe size={16} /><span>{cur.short}</span>
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align="end" width={200} label={tr('Язык')}>
        <SelectMenu<Lang> title={tr('Язык')} value={s.lang} options={LANGS.map((l) => ({ value: l.id, label: l.name }))} onPick={(v) => { void changeLang(v); }} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}

function MessagesLink() {
  const s = useAppState();
  const me = useMe();
  if (!me) return null;
  const n = unreadTotal(s, me.id);
  const label = n ? tr('Сообщения: {n} новых', { n }) : tr('Сообщения');
  return (
    <Link to="/messages" className="top-btn msg-link" aria-label={label} data-tip={label}>
      <IconMail size={17} />{n > 0 && <span className="badge badge-dot">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}

function UserMenu({ onLogin }: { onLogin: () => void }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!me) return <button type="button" className="btn btn-sm" onClick={onLogin}>{tr('Войти')}</button>;
  const go = (to: string) => { setOpen(false); navigate(to); };
  return (
    <>
      <button ref={ref} type="button" className="user-menu-btn" aria-expanded={open} aria-haspopup="menu" aria-label={tr('Меню профиля')} onClick={() => setOpen((v) => !v)}>
        <Avatar user={me} size={30} />
        <IconChevron />
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align="end" width={240} label={tr('Меню профиля')}>
        <div className="amenu" role="menu">
          <div className="menu-head"><strong>{me.name}</strong><span className="muted small">{me.handle}</span></div>
          <button type="button" role="menuitem" className="amenu-item" onClick={() => go(`/u/${me.handle}`)}><span className="amenu-icon"><IconUser /></span>{tr('Мой профиль')}</button>
          <button type="button" role="menuitem" className="amenu-item" onClick={() => go('/for-you')}><span className="amenu-icon"><IconIssue /></span>{tr('Задачи для меня')}</button>
          <button type="button" role="menuitem" className="amenu-item" onClick={() => go('/messages')}><span className="amenu-icon"><IconMail /></span>{tr('Сообщения')}</button>
          <button type="button" role="menuitem" className="amenu-item" onClick={() => go('/settings')}><span className="amenu-icon"><IconGear /></span>{tr('Настройки')}</button>
          <div className="amenu-sep" />
          {!backendEnabled && <button type="button" role="menuitem" className="amenu-item" onClick={() => { setOpen(false); onLogin(); }}>{tr('Сменить профиль')}</button>}
          <button type="button" role="menuitem" className="amenu-item" onClick={() => { googleSignOut(); if (backendEnabled) void signOut(); else setState({ currentUserId: null }); setOpen(false); }}>{tr('Выйти')}</button>
        </div>
      </Popover>
    </>
  );
}

/** Кнопка Google: скрипт грузится при открытии окна входа. */
function GoogleButton({ onProfile }: { onProfile: (p: GoogleProfile | null) => void }) {
  const s = useAppState();
  const dark = useDark(s.theme);
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef(onProfile);
  cb.current = onProfile;
  useEffect(() => {
    if (!ref.current) return;
    renderGoogleButton(ref.current, s.lang, dark, (p) => cb.current(p)).catch(() => setFailed(true));
  }, [s.lang, dark]);
  return (
    <div className="google-box">
      <div ref={ref} className="google-btn" />
      {failed && <p className="muted small">{tr('Не удалось загрузить вход через Google. Проверьте соединение или блокировщик рекламы.')}</p>}
      <p className="google-or"><span>{tr('или')}</span></p>
    </div>
  );
}

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const dark = useDark(s.theme);
  if (backendEnabled) return <CloudLogin open={open} onClose={onClose} dark={dark} />;
  return <LocalLogin open={open} onClose={onClose} />;
}

/** Демо-режим: профили только в этом браузере. */
function LocalLogin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [country, setCountry] = useState<string | undefined>(guessCountry);
  const [google, setGoogle] = useState<GoogleProfile | null>(null);
  const navigate = useNavigate();
  useEffect(() => { if (open) { setMode(s.users.some((u) => !u.demo && !u.team) ? 'pick' : 'new'); } }, [open]);

  const create = () => {
    const r = act<ReturnType<typeof registerUser>>('registerUser', [{ name, bio, skills, gender, country, google: google ? { sub: google.sub, email: google.email } : undefined, photo: google?.picture }]);
    if (report(r, tr('Профиль создан. Вот задачи под ваши навыки.'))) {
      onClose();
      setName(''); setBio(''); setSkills([]); setGoogle(null);
      navigate('/for-you');
    }
  };

  const onGoogle = (p: GoogleProfile | null) => {
    if (!p) { toast(tr('Google не подтвердил вход. Попробуйте ещё раз.'), 'error'); return; }
    const known = userByGoogle(getState(), p.sub);
    if (known) { setState({ currentUserId: known.id }); toast(tr('Вы вошли как {name}', { name: known.name })); onClose(); return; }
    // новый человек: заполняем профиль из Google, остаётся выбрать навыки
    setGoogle(p); setName(p.name); setMode('new');
  };

  const own = s.users.filter((u) => !u.demo && !u.team);
  const demo = s.users.filter((u) => u.demo && !u.team);
  return (
    <Modal open={open} onClose={onClose} title={mode === 'new' ? tr('Новый профиль') : tr('Вход')}>
      {googleEnabled() && !google && <GoogleButton onProfile={onGoogle} />}
      {google && <p className="note google-linked">{tr('Аккаунт Google: {email}. Осталось отметить навыки — и профиль готов.', { email: google.email })}</p>}
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'is-on' : ''} onClick={() => setMode('new')}>{tr('Создать профиль')}</button>
        <button type="button" role="tab" aria-selected={mode === 'pick'} className={mode === 'pick' ? 'is-on' : ''} onClick={() => setMode('pick')}>{tr('Войти как участник')}</button>
      </div>
      {mode === 'new' ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Field label={tr('Имя')} hint={tr('Так вас увидят другие участники')}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={tr('Например, Айгерим Садыкова')} />
          </Field>
          {getLang() === 'ru' && <div className="field">
            <span className="field-label">{tr('Как писать о вас в ленте')}</span>
            <div className="seg" role="radiogroup" aria-label={tr('Обращение')}>
              <button type="button" role="radio" aria-checked={gender === 'm'} className={gender === 'm' ? 'is-on' : ''} onClick={() => setGender('m')}>{tr('«взял задачу»')}</button>
              <button type="button" role="radio" aria-checked={gender === 'f'} className={gender === 'f' ? 'is-on' : ''} onClick={() => setGender('f')}>{tr('«взяла задачу»')}</button>
            </div>
          </div>}
          <CountrySelect value={country} onChange={setCountry} />
          <div className="field">
            <span className="field-label">{tr('Что вы умеете')}</span>
            <SkillPicker value={skills} onChange={setSkills} />
            <span className="field-hint">{tr('По навыкам помощник подберёт задачи. Профессионалом быть не обязательно.')}</span>
          </div>
          <Field label={tr('О себе')} hint={tr('Необязательно')}>
            <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr('Чем хотите заниматься, сколько времени готовы уделять')} />
          </Field>
          <div className="row-end"><button className="btn btn-primary" type="submit">{tr('Создать профиль')}</button></div>
        </form>
      ) : (
        <div className="stack">
          {own.length > 0 && (
            <>
              <p className="muted small">{tr('Ваши профили')}</p>
              <div className="user-pick">
                {own.map((u) => (
                  <button key={u.id} type="button" className="user-pick-item" onClick={() => { setState({ currentUserId: u.id }); onClose(); }}>
                    <Avatar user={u} size={36} /><span><strong>{u.name}</strong><SkillDots skills={u.skills} /></span>
                  </button>
                ))}
              </div>
            </>
          )}
          {demo.length > 0 && (
            <>
              <p className="muted small">{tr('Участники демо-проектов — войдите, чтобы посмотреть платформу их глазами')}</p>
              <div className="user-pick">
                {demo.map((u) => (
                  <button key={u.id} type="button" className={`user-pick-item${s.currentUserId === u.id ? ' is-on' : ''}`} onClick={() => { setState({ currentUserId: u.id }); onClose(); }}>
                    <Avatar user={u} size={36} /><span><strong>{u.name}</strong><SkillDots skills={u.skills} /></span>
                  </button>
                ))}
              </div>
            </>
          )}
          {!own.length && !demo.length && <p className="muted">{tr('В этом браузере ещё нет профилей. Создайте свой — это займёт минуту.')}</p>}
        </div>
      )}
      <p className="note">{tr('Это демо: профили и проекты хранятся только в этом браузере, пароль не нужен.')}</p>
    </Modal>
  );
}

export function Layout() {
  const s = useAppState();
  const [login, setLogin] = useState(false);
  const openLogin = useCallback(() => setLogin(true), []);
  useLoginRequest(openLogin);
  const loc = useLocation();
  const auth = useAuthUser();
  const hasProfile = !!auth && s.users.some((u) => u.id === auth.id);
  // вошли впервые — сразу предлагаем заполнить профиль
  useEffect(() => { if (backendEnabled && auth && !hasProfile) setLogin(true); }, [auth?.id, hasProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onSyncError((m) => toast(tr('Сервер не принял изменение: {reason}', { reason: m }), 'error')), []);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.theme);
  }, [s.theme]);

  return (
    <div className="app">
      <a href="#main" className="skip">{tr('К содержанию')}</a>
      <header className="topbar">
        <div className="topbar-in">
          <Brand />
          <nav className="nav" aria-label={tr('Главное меню')}>
            <NavLink to="/projects">{tr('Проекты')}</NavLink>
            <NavLink to="/for-you">{tr('Для меня')}</NavLink>
            <NavLink to="/about">{tr('Как это устроено')}</NavLink>
          </nav>
          <div className="topbar-actions">
            <Link to="/projects/new" className="btn btn-primary btn-sm">{tr('Создать проект')}</Link>
            <MessagesLink />
            <LangMenu />
            <ThemeToggle />
            <UserMenu onLogin={openLogin} />
          </div>
        </div>
        <nav className="mobile-nav" aria-label={tr('Главное меню')}>
          <NavLink to="/projects">{tr('Проекты')}</NavLink>
          <NavLink to="/for-you">{tr('Для меня')}</NavLink>
          <NavLink to="/projects/new" end>{tr('Создать')}</NavLink>
          <NavLink to="/about">{tr('О платформе')}</NavLink>
        </nav>
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-in">
          <span>{tr('Commons — открытая мастерская проектов')}</span>
          <nav aria-label={tr('Нижнее меню')}>
            <Link to="/projects">{tr('Каталог')}</Link>
            <Link to="/about">{tr('Принципы')}</Link>
            <Link to="/settings">{tr('Настройки')}</Link>
          </nav>
        </div>
      </footer>
      <LoginModal open={login} onClose={() => setLogin(false)} />
      <Toasts />
      <TooltipLayer />
      <DialogHost />
    </div>
  );
}
