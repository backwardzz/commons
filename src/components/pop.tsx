// Собственные всплывающие элементы: поповер, меню выбора, выпадающий список, меню действий,
// подсказки и диалоги подтверждения. Браузерные select / title / confirm / prompt не используются.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevron, IconSearch } from './icons';
import { tr } from '../i18n';

// ——— поповер ———

export function Popover({ anchor, open, onClose, children, align = 'start', width, label }: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  const place = useCallback(() => {
    const a = anchor.current;
    const el = ref.current;
    if (!a || !el) return;
    const r = a.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    const below = window.innerHeight - r.bottom;
    const up = below < h + 12 && r.top > below;
    const top = up ? r.top - h - 6 : r.bottom + 6;
    setPos({ top: Math.max(8, top), left, up });
  }, [anchor, align]);

  useLayoutEffect(() => { if (open) place(); else setPos(null); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor.current?.focus(); }
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, onClose, anchor, place]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={`pop${pos?.up ? ' pop-up' : ''}`}
      role="dialog"
      aria-label={label}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ——— меню выбора (одиночный и множественный) ———

export interface Option<T extends string> { value: T; label: string; hint?: string; icon?: ReactNode }

export function SelectMenu<T extends string>({ title, options, value, multiple, onPick, onClose, filterPlaceholder, footer }: {
  title?: string;
  options: Option<T>[];
  value: T | T[] | null;
  multiple?: boolean;
  onPick: (v: T) => void;
  onClose?: () => void;
  filterPlaceholder?: string;
  footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(n)) : options;
  }, [options, q]);
  const withFilter = options.length > 7;

  useEffect(() => {
    const i = Math.max(0, options.findIndex((o) => selected(o.value)));
    setActive(i);
    setTimeout(() => (withFilter ? filterRef.current : listRef.current)?.focus(), 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o: Option<T>) => { onPick(o.value); if (!multiple) onClose?.(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
    else if ((e.key === 'Enter' || (e.key === ' ' && e.target === listRef.current)) && shown[active]) { e.preventDefault(); pick(shown[active]); }
  };

  return (
    <div className="smenu" onKeyDown={onKey}>
      {title && <div className="smenu-title">{title}</div>}
      {withFilter && (
        <div className="smenu-filter">
          <IconSearch />
          <input ref={filterRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder={filterPlaceholder ?? tr('Найти')} aria-controls={id} aria-activedescendant={`${id}-${active}`} />
        </div>
      )}
      <ul ref={listRef} id={id} className="smenu-list" role="listbox" aria-multiselectable={multiple || undefined} tabIndex={withFilter ? -1 : 0} aria-activedescendant={`${id}-${active}`}>
        {shown.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-${i}`}
            data-i={i}
            role="option"
            aria-selected={selected(o.value)}
            className={`smenu-item${i === active ? ' is-active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(o)}
          >
            <span className="smenu-check">{selected(o.value) && <IconCheck />}</span>
            {o.icon && <span className="smenu-icon">{o.icon}</span>}
            <span className="smenu-text">
              <span>{o.label}</span>
              {o.hint && <span className="smenu-hint">{o.hint}</span>}
            </span>
          </li>
        ))}
        {!shown.length && <li className="smenu-empty">{tr('Ничего не нашлось')}</li>}
      </ul>
      {footer && <div className="smenu-foot">{footer}</div>}
    </div>
  );
}

// ——— выпадающий список (замена <select>) ———

export function Select<T extends string>({ value, options, onChange, label, prefix, placeholder, small, block, disabled, title }: {
  value: T | null;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string; // для экранных читалок
  prefix?: string; // видимая подпись перед значением: «Ремесло: Код»
  placeholder?: string;
  small?: boolean;
  block?: boolean;
  disabled?: boolean;
  title?: string; // заголовок меню
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`select-btn${small ? ' select-sm' : ''}${block ? ' select-block' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${cur?.label ?? placeholder ?? tr('не выбрано')}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}
        disabled={disabled}
      >
        {prefix && <span className="select-prefix">{prefix}</span>}
        {cur?.icon}
        <span className={`select-value${cur ? '' : ' is-empty'}`}>{cur?.label ?? placeholder ?? tr('Выбрать')}</span>
        <IconChevron className="select-chev" />
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={Math.max(220, ref.current?.offsetWidth ?? 0)} label={label}>
        <SelectMenu title={title} options={options} value={value} onPick={onChange} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}

/** Кнопка-фильтр в стиле «Ремесло ▾» с меню (одиночный или множественный выбор). */
export function FilterMenu<T extends string>({ label, title, options, value, onChange, multiple, align = 'start' }: {
  label: string;
  title: string;
  options: Option<T>[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  multiple?: boolean;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const count = Array.isArray(value) ? value.length : value ? 1 : 0;
  return (
    <>
      <button ref={ref} type="button" className={`filter-btn${count ? ' is-on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}{count > 0 && <span className="filter-n">{Array.isArray(value) ? count : options.find((o) => o.value === value)?.label}</span>}
        <IconChevron />
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align={align} width={260} label={title}>
        <SelectMenu title={title} options={options} value={value} multiple={multiple} onPick={onChange} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}

// ——— меню действий ———

export interface MenuItem { label: string; hint?: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }

export function ActionMenu({ trigger, items, align = 'end', label, className = 'btn', width = 260 }: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  label: string;
  className?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setActive(0); setTimeout(() => listRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus(), 0); } }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const btns = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[Math.min(btns.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[Math.max(0, i - 1)]?.focus(); }
  };
  return (
    <>
      <button ref={ref} type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>{trigger}</button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align={align} width={width} label={label}>
        <div className="amenu" role="menu" ref={listRef} onKeyDown={onKey}>
          {items.map((it, i) => (
            <button key={it.label} type="button" role="menuitem" className={`amenu-item${it.danger ? ' is-danger' : ''}${i === active ? ' is-active' : ''}`} disabled={it.disabled} onMouseEnter={() => setActive(i)} onClick={() => { setOpen(false); it.onSelect(); }}>
              {it.icon && <span className="amenu-icon">{it.icon}</span>}
              <span className="smenu-text"><span>{it.label}</span>{it.hint && <span className="smenu-hint">{it.hint}</span>}</span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// ——— подсказки: любой элемент с data-tip ———

export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<number>(0);
  const bubble = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const show = (el: HTMLElement, delay: number) => {
      const text = el.dataset.tip;
      if (!text) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.top < 48;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
      }, delay);
    };
    const hide = () => { window.clearTimeout(timer.current); setTip(null); };
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
      if (el) show(el, 350); else hide();
    };
    const focus = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]');
      if (el && (e.target as HTMLElement).matches(':focus-visible')) show(el, 0); else hide();
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !bubble.current) return;
    const r = bubble.current.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 8);
    const under = 8 - r.left;
    setShift(over > 0 ? -over : under > 0 ? under : 0);
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={bubble} role="tooltip" className={`tip${tip.below ? ' tip-below' : ''}`} style={{ left: tip.x + shift, top: tip.y, ['--arrow' as string]: `${-shift}px` }}>
      {tip.text}
    </div>,
    document.body,
  );
}

// ——— диалоги подтверждения и ввода ———

type DialogReq =
  | { kind: 'confirm'; title: string; text?: string; confirm: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; text?: string; label: string; placeholder?: string; confirm: string; required?: boolean; danger?: boolean; resolve: (v: string | null) => void };

const dialogListeners = new Set<(d: DialogReq) => void>();

export function confirmDialog(opts: { title: string; text?: string; confirm: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => dialogListeners.forEach((l) => l({ kind: 'confirm', ...opts, resolve })));
}

export function promptDialog(opts: { title: string; text?: string; label: string; placeholder?: string; confirm: string; required?: boolean; danger?: boolean }): Promise<string | null> {
  return new Promise((resolve) => dialogListeners.forEach((l) => l({ kind: 'prompt', ...opts, resolve })));
}

export function DialogHost() {
  const [req, setReq] = useState<DialogReq | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const l = (d: DialogReq) => { setReq(d); setValue(''); setError(''); };
    dialogListeners.add(l);
    return () => { dialogListeners.delete(l); };
  }, []);
  useEffect(() => {
    if (!req) return;
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => box.current?.querySelector<HTMLElement>('input, textarea, .btn-primary, .btn-danger')?.focus(), 20);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = (ok: boolean) => {
    if (!req) return;
    if (req.kind === 'confirm') req.resolve(ok);
    else {
      if (ok && req.required && !value.trim()) { setError(tr('Заполните поле')); return; }
      req.resolve(ok ? value.trim() : null);
    }
    setReq(null);
  };

  if (!req) return null;
  return createPortal(
    <div className="overlay overlay-dialog" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" ref={box}>
        <h2 id="dlg-t">{req.title}</h2>
        {req.text && <p className="dialog-text">{req.text}</p>}
        {req.kind === 'prompt' && (
          <label className="field">
            <span className="field-label">{req.label}</span>
            <textarea rows={3} value={value} placeholder={req.placeholder} onChange={(e) => { setValue(e.target.value); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(true); }} />
            {error && <span className="field-error">{error}</span>}
          </label>
        )}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>{tr('Отмена')}</button>
          <button type="button" className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{req.confirm}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
