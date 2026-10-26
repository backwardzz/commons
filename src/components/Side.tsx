// Раздел боковой колонки в духе GitHub: заголовок, шестерёнка с меню выбора, содержимое.
import { useRef, useState, type ReactNode } from 'react';
import { IconGear } from './icons';
import { Popover } from './pop';
import { tr } from '../i18n';

export function SideSection({ title, menu, children, menuWidth = 280 }: {
  title: string;
  menu?: (close: () => void) => ReactNode;
  children: ReactNode;
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <section className="sside">
      <div className="sside-head">
        <h3>{title}</h3>
        {menu && (
          <button ref={ref} type="button" className="sside-gear" aria-label={tr('Изменить: {x1}', { x1: title.toLowerCase() })} aria-expanded={open} onClick={() => setOpen((v) => !v)} data-tip={tr('Изменить')}>
            <IconGear />
          </button>
        )}
      </div>
      <div className="sside-body">{children}</div>
      {menu && (
        <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align="end" width={menuWidth} label={title}>
          {menu(() => setOpen(false))}
        </Popover>
      )}
    </section>
  );
}
