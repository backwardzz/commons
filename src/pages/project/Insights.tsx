// «Вклад и доходы»: кто сколько сил вложил в проект, прогноз дохода и как его можно разделить.
import { useMemo, useState } from 'react';
import { DEFAULT_REVENUE, effortReport, revenueSplit, setRevenue } from '../../data/community';
import { act, useAppState } from '../../data/store';
import { REVENUE_POLICIES, SPLIT_METHODS, type Project, type RevenuePlan } from '../../data/types';
import { Flag } from '../../components/social';
import { Avatar, Empty, Field, UserLink, getUser, report, useMe } from '../../components/ui';
import { IconPeople } from '../../components/icons';
import { locale, tr } from '../../i18n';

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  } catch {
    return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n)} ${currency}`;
  }
}
const pct = (n: number) => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n)}%`;
const num = (n: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n);

const CURRENCIES = ['USD', 'EUR', 'KZT', 'RUB', 'CNY', 'JPY', 'GBP', 'TRY', 'UZS'];

export function Insights({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const owner = me?.id === p.ownerId;
  const rows = useMemo(() => effortReport(s, p), [s, p]);
  const saved = p.revenue ?? DEFAULT_REVENUE;
  const [plan, setPlan] = useState<RevenuePlan>(saved);
  const [estimate, setEstimate] = useState(saved.estimate ? String(saved.estimate) : '');
  const live: RevenuePlan = { ...plan, estimate: Number(estimate.replace(/\s/g, '').replace(',', '.')) || 0 };
  const split = useMemo(() => revenueSplit(p, rows, owner ? live : saved), [p, rows, owner, live, saved]);
  const total = rows.reduce((n, r) => n + r.points, 0);
  const policy = REVENUE_POLICIES.find((x) => x.id === saved.policy)!;
  const view = owner ? live : saved;

  const save = () => { if (me) report(act<ReturnType<typeof setRevenue>>('setRevenue', [p.id, live, me.id]), tr('Условия сохранены')); };

  return (
    <div className="insights stack-lg">
      <section className={`policy policy-${saved.policy}`}>
        <div>
          <p className="policy-label">{tr('Доход от проекта')}</p>
          <p className="policy-name">{policy.name}</p>
          <p className="muted small">{policy.hint}</p>
        </div>
        {saved.note && <p className="policy-note">{saved.note}</p>}
      </section>

      <section className="stack">
        <div className="section-head"><h2 className="h3">{tr('Кто сколько вложил')}</h2><span className="muted small">{tr('Всего очков: {n}', { n: num(total) })}</span></div>
        {rows.length ? (
          <div className="box">
            <table className="effort">
              <thead>
                <tr><th>{tr('Участник')}</th><th>{tr('Очки')}</th><th className="effort-bar-h">{tr('Доля')}</th><th className="hide-sm">{tr('Работа')}</th><th className="hide-sm">{tr('Отзывы')}</th><th className="hide-sm">{tr('Ведение')}</th><th className="hide-sm">{tr('Обсуждения')}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = getUser(s, r.userId);
                  const share = total ? (r.points / total) * 100 : 0;
                  return (
                    <tr key={r.userId}>
                      <td><span className="effort-who"><Avatar user={u} size={24} /><UserLink id={r.userId} /><Flag code={u?.country} size={11} /></span>
                        <span className="muted small effort-sub">{tr('принято вкладов: {n}', { n: r.accepted })}{r.pending ? ` · ${tr('на рассмотрении: {n}', { n: r.pending })}` : ''}</span></td>
                      <td className="num">{num(r.points)}</td>
                      <td className="effort-bar-c"><span className="effort-bar"><span style={{ width: `${share}%` }} /></span><span className="muted small">{pct(share)}</span></td>
                      <td className="num hide-sm">{num(r.work)}</td>
                      <td className="num hide-sm">{num(r.review)}</td>
                      <td className="num hide-sm">{num(r.care)}</td>
                      <td className="num hide-sm">{num(r.talk)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title={tr('Вклада пока нет')} icon={<IconPeople />}>{tr('Очки появятся, когда участники начнут выполнять задачи, писать отзывы и вести проект.')}</Empty>}
        <details className="rules">
          <summary>{tr('Как считаются очки')}</summary>
          <ul>
            <li>{tr('Принятый вклад или выполненная задача: размер S — 2 очка, M — 5, L — 13.')}</li>
            <li>{tr('Отзыв на чужой вклад: одобрение или просьба о правках — 1, комментарий — 0,5.')}</li>
            <li>{tr('Ведение проекта: открытая задача — 0,5, документ — 1, решение в обсуждении — 1, объявление — 0,5.')}</li>
            <li>{tr('Обсуждения: новая тема — 0,5, ответ или комментарий — 0,25.')}</li>
            <li>{tr('Вклады на рассмотрении не учитываются, пока их не примут.')}</li>
          </ul>
        </details>
      </section>

      <section className="stack">
        <h2 className="h3">{tr('Прогноз дохода и распределение')}</h2>
        {owner ? (
          <div className="box stack revenue-form">
            <fieldset className="radio-list">
              <legend className="field-label">{tr('Будете ли вы делиться доходом с участниками?')}</legend>
              {REVENUE_POLICIES.map((r) => (
                <label key={r.id} className="radio"><input type="radio" name="policy" checked={plan.policy === r.id} onChange={() => setPlan({ ...plan, policy: r.id })} /><span><strong>{r.name}</strong><span className="muted small">{r.hint}</span></span></label>
              ))}
            </fieldset>
            <div className="form-grid">
              <Field label={tr('Сколько проект может принести после публикации')} hint={tr('Примерная сумма, например за первый год')}>
                <input inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="10000" />
              </Field>
              <div className="field">
                <span className="field-label">{tr('Валюта')}</span>
                <div className="seg seg-wrap">{CURRENCIES.map((c) => <button key={c} type="button" className={plan.currency === c ? 'is-on' : ''} aria-pressed={plan.currency === c} onClick={() => setPlan({ ...plan, currency: c })}>{c}</button>)}</div>
              </div>
            </div>
            <Field label={tr('Доля автора: {pct}', { pct: pct(plan.ownerPct) })} hint={tr('Остальное делится между всеми, кто вложился, включая автора')}>
              <input type="range" min={0} max={100} step={5} value={plan.ownerPct} onChange={(e) => setPlan({ ...plan, ownerPct: Number(e.target.value) })} />
            </Field>
            <div className="field">
              <span className="field-label">{tr('Как делить долю участников')}</span>
              <div className="seg">{SPLIT_METHODS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={plan.method === m.id} className={plan.method === m.id ? 'is-on' : ''} data-tip={m.hint} onClick={() => setPlan({ ...plan, method: m.id })}>{m.name}</button>)}</div>
            </div>
            <Field label={tr('Комментарий для участников')} hint={tr('Например: когда и как будут выплаты, что считается доходом')}>
              <textarea rows={3} value={plan.note} onChange={(e) => setPlan({ ...plan, note: e.target.value })} />
            </Field>
            <div className="row-end"><button type="button" className="btn btn-primary" onClick={save}>{tr('Сохранить условия')}</button></div>
          </div>
        ) : (
          <p className="muted">{saved.estimate ? tr('Автор ожидает доход около {sum}.', { sum: money(saved.estimate, saved.currency) }) : tr('Автор пока не указал ожидаемый доход.')}</p>
        )}

        {view.policy === 'none' ? (
          <p className="note">{tr('Автор не планирует распределять доход. Вклад участников всё равно виден в профилях и истории проекта.')}</p>
        ) : (
          <div className="box">
            <div className="box-head"><span className="box-title">{view.policy === 'share' ? tr('Как делится доход') : tr('Как мог бы делиться доход')}</span><span className="muted small">{SPLIT_METHODS.find((x) => x.id === view.method)?.name} · {tr('доля автора {pct}', { pct: pct(view.ownerPct) })}</span></div>
            <table className="effort">
              <thead><tr><th>{tr('Участник')}</th><th className="effort-bar-h">{tr('Доля')}</th><th>{tr('Сумма')}</th></tr></thead>
              <tbody>
                {split.map((r) => (
                  <tr key={r.userId}>
                    <td><span className="effort-who"><Avatar user={getUser(s, r.userId)} size={24} /><UserLink id={r.userId} />{r.owner && <span className="role">{tr('Автор')}</span>}</span></td>
                    <td className="effort-bar-c"><span className="effort-bar"><span style={{ width: `${r.pct}%` }} /></span><span className="muted small">{pct(r.pct)}</span></td>
                    <td className="num">{view.estimate ? money(r.amount, view.currency) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="box-foot muted small">{tr('Это оценка по правилам выше, а не договор. Реальные выплаты автор и участники оформляют сами.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
