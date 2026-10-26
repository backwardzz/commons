// Вход в общую базу: код на почту или аккаунт Google. После первого входа — короткая анкета профиля.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../data/ops';
import { act, useAppState, useAuthUser } from '../data/store';
import { sendEmailCode, signInWithGoogleToken, signOut, verifyEmailCode } from '../data/backend';
import type { Skill } from '../data/types';
import { googleEnabled, renderGoogleButton } from '../lib/google';
import { COUNTRY_CODES } from '../lib/countries';
import { getLang, tr } from '../i18n';
import { CountrySelect } from './social';
import { Field, Modal, SkillPicker, report, toast } from './ui';

function guessCountry(): string | undefined {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && COUNTRY_CODES.includes(region) ? region : undefined;
  } catch {
    return undefined;
  }
}

function GoogleSignIn({ dark }: { dark: boolean }) {
  const s = useAppState();
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    renderGoogleButton(ref.current, s.lang, dark, async (_p, credential) => {
      try {
        await signInWithGoogleToken(credential);
      } catch (e) {
        toast(e instanceof Error ? e.message : tr('Google не подтвердил вход. Попробуйте ещё раз.'), 'error');
      }
    }).catch(() => setFailed(true));
  }, [s.lang, dark]);
  return (
    <div className="google-box">
      <div ref={ref} className="google-btn" />
      {failed && <p className="muted small">{tr('Не удалось загрузить вход через Google. Проверьте соединение или блокировщик рекламы.')}</p>}
      <p className="google-or"><span>{tr('или')}</span></p>
    </div>
  );
}

function EmailSignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast(tr('Проверьте адрес почты'), 'error'); return; }
    setBusy(true);
    try { await sendEmailCode(email.trim()); setSent(true); toast(tr('Код отправлен на {email}', { email: email.trim() })); } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { await verifyEmailCode(email.trim(), code.trim()); } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); } finally { setBusy(false); }
  };
  return sent ? (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
      <Field label={tr('Код из письма')} hint={tr('Письмо пришло на {email}. Если его нет — проверьте «Спам».', { email })}>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" />
      </Field>
      <p className="muted small">{tr('В письме может быть ссылка вместо кода — тогда просто откройте её в этом браузере.')}</p>
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={() => { setSent(false); setCode(''); }}>{tr('Другая почта')}</button>
        <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}>{tr('Войти')}</button>
      </div>
    </form>
  ) : (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <Field label={tr('Почта')} hint={tr('Пришлём код для входа — пароль не нужен')}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
      </Field>
      <div className="row-end"><button type="submit" className="btn btn-primary" disabled={busy}>{tr('Получить код')}</button></div>
    </form>
  );
}

function ProfileSetup({ onDone }: { onDone: () => void }) {
  const auth = useAuthUser();
  const navigate = useNavigate();
  const [name, setName] = useState(auth?.name ?? '');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [country, setCountry] = useState<string | undefined>(guessCountry);
  const create = () => {
    const r = act<ReturnType<typeof registerUser>>('registerUser', [{ name, bio, skills, gender, country, photo: auth?.avatar }]);
    if (report(r, tr('Профиль создан. Вот задачи под ваши навыки.'))) { onDone(); navigate('/for-you'); }
  };
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <p className="note">{tr('Вы вошли как {email}. Осталось рассказать о себе — так вас увидят другие участники.', { email: auth?.email ?? '' })}</p>
      <Field label={tr('Имя')} hint={tr('Так вас увидят другие участники')}>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={tr('Например, Айгерим Садыкова')} />
      </Field>
      {getLang() === 'ru' && (
        <div className="field">
          <span className="field-label">{tr('Как писать о вас в ленте')}</span>
          <div className="seg" role="radiogroup" aria-label={tr('Обращение')}>
            <button type="button" role="radio" aria-checked={gender === 'm'} className={gender === 'm' ? 'is-on' : ''} onClick={() => setGender('m')}>{tr('«взял задачу»')}</button>
            <button type="button" role="radio" aria-checked={gender === 'f'} className={gender === 'f' ? 'is-on' : ''} onClick={() => setGender('f')}>{tr('«взяла задачу»')}</button>
          </div>
        </div>
      )}
      <CountrySelect value={country} onChange={setCountry} />
      <div className="field">
        <span className="field-label">{tr('Что вы умеете')}</span>
        <SkillPicker value={skills} onChange={setSkills} />
        <span className="field-hint">{tr('По навыкам помощник подберёт задачи. Профессионалом быть не обязательно.')}</span>
      </div>
      <Field label={tr('О себе')} hint={tr('Необязательно')}>
        <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr('Чем хотите заниматься, сколько времени готовы уделять')} />
      </Field>
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={() => { void signOut(); onDone(); }}>{tr('Выйти')}</button>
        <button className="btn btn-primary" type="submit">{tr('Создать профиль')}</button>
      </div>
    </form>
  );
}

export function CloudLogin({ open, onClose, dark }: { open: boolean; onClose: () => void; dark: boolean }) {
  const s = useAppState();
  const auth = useAuthUser();
  const hasProfile = !!auth && s.users.some((u) => u.id === auth.id);
  // вошли и профиль есть — окно больше не нужно
  useEffect(() => {
    if (open && hasProfile) { toast(tr('Вы вошли как {name}', { name: s.users.find((u) => u.id === auth!.id)!.name })); onClose(); }
  }, [open, hasProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title={auth ? tr('Новый профиль') : tr('Вход')}>
      {auth ? <ProfileSetup onDone={onClose} /> : (
        <>
          {googleEnabled() && <GoogleSignIn dark={dark} />}
          <EmailSignIn />
          <p className="muted small">{tr('Проекты, профили и сообщения хранятся в общей базе Commons и видны участникам. Личные сообщения видят только собеседники.')}</p>
        </>
      )}
    </Modal>
  );
}
