// Флаги, страны, соцсети — общие кусочки профиля и проекта.
import { SOCIALS, type SocialKind, type SocialLink } from '../data/types';
import { countryName, countryOptions } from '../lib/countries';
import { tr } from '../i18n';
import { Select } from './pop';
import { Field } from './ui';

/** Флаг страны. Картинка с flagcdn.com: эмодзи-флаги в Windows не рисуются. */
export function Flag({ code, size = 16 }: { code?: string; size?: number }) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  return <img className="flag" src={`https://flagcdn.com/${code.toLowerCase()}.svg`} width={Math.round(size * 1.33)} height={size} alt="" loading="lazy" />;
}

export function Country({ code }: { code?: string }) {
  if (!code) return null;
  return <span className="country"><Flag code={code} />{countryName(code)}</span>;
}

export function CountrySelect({ value, onChange, label = tr('Страна') }: { value?: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Select<string> label={label} block value={value ?? null} placeholder={tr('Не указана')} title={label}
        options={countryOptions().map((o) => ({ ...o, icon: <Flag code={o.value} size={12} /> }))} onChange={onChange} />
    </div>
  );
}

const socialName = (k: SocialKind) => SOCIALS.find((x) => x.id === k)?.name ?? k;

/** Ссылки на соцсети: короткие подписи с названием сети. */
export function SocialLinks({ links }: { links?: SocialLink[] }) {
  if (!links?.length) return null;
  return (
    <ul className="socials">
      {links.map((l) => (
        <li key={l.kind + l.url}>
          <a href={l.url} target="_blank" rel="noreferrer noopener me" className={`social social-${l.kind}`}>
            <span className="social-dot" aria-hidden />{socialName(l.kind)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Поля для ссылок на соцсети. */
export function SocialEditor({ value, onChange, scope }: { value: SocialLink[]; onChange: (v: SocialLink[]) => void; scope: 'user' | 'project' }) {
  const kinds = SOCIALS.filter((k) => (scope === 'user' ? k.forUser : k.forProject));
  const get = (k: SocialKind) => value.find((x) => x.kind === k)?.url ?? '';
  const set = (k: SocialKind, url: string) => onChange([...value.filter((x) => x.kind !== k), { kind: k, url }].sort((a, b) => kinds.findIndex((x) => x.id === a.kind) - kinds.findIndex((x) => x.id === b.kind)));
  return (
    <div className="form-grid">
      {kinds.map((k) => (
        <Field key={k.id} label={k.name}>
          <input value={get(k.id)} placeholder={k.placeholder} inputMode="url" onChange={(e) => set(k.id, e.target.value)} />
        </Field>
      ))}
    </div>
  );
}
