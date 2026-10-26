import { useState } from 'react';
import { backendEnabled, changeLang, exportData, resetDemo, setState, useAppState } from '../data/store';
import type { AiMode } from '../data/types';
import { Field, toast } from '../components/ui';
import { MODELS } from '../lib/ai-claude';
import { Select, confirmDialog } from '../components/pop';
import { LANGS, tr } from '../i18n';

export default function Settings() {
  const s = useAppState();
  const [key, setKey] = useState(s.ai.apiKey);
  const [show, setShow] = useState(false);

  const setMode = (mode: AiMode) => setState({ ai: { ...s.ai, mode } });
  const saveKey = () => { setState({ ai: { ...s.ai, apiKey: key.trim(), mode: key.trim() ? 'claude' : s.ai.mode } }); toast(key.trim() ? tr('Ключ сохранён в этом браузере') : tr('Ключ удалён')); };

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `commons-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page narrow settings-page">
      <h1 className="h1">{tr('Настройки')}</h1>

      <section className="stack panel">
        <h2 className="h3">{tr('Помощник')}</h2>
        <div className="seg" role="radiogroup" aria-label={tr('Чем отвечает помощник')}>
          <button type="button" role="radio" aria-checked={s.ai.mode === 'local'} className={s.ai.mode === 'local' ? 'is-on' : ''} onClick={() => setMode('local')}>{tr('Встроенный')}</button>
          <button type="button" role="radio" aria-checked={s.ai.mode === 'claude'} className={s.ai.mode === 'claude' ? 'is-on' : ''} onClick={() => setMode('claude')}>Claude</button>
        </div>
        {s.ai.mode === 'local' ? (
          <p className="muted">{tr('Встроенный помощник работает без интернета: он собирает ответы из документов, задач и обсуждений проекта по правилам. Он не выдумывает, но и не рассуждает. Для развёрнутых ответов подключите Claude.')}</p>
        ) : (
          <>
            <p className="muted">{tr('Claude читает материалы проекта и отвечает развёрнуто: объясняет архитектуру, пишет техническое задание, разбивает цель на задачи, проверяет вклады. Нужен собственный ключ API Anthropic.')}</p>
            <Field label={tr('Ключ API Anthropic')} hint={tr('Ключ хранится только в этом браузере и отправляется только на api.anthropic.com. Не вводите ключ на чужом компьютере.')}>
              <div className="input-row">
                <input type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="sk-ant-…" />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShow(!show)}>{show ? tr('Скрыть') : tr('Показать')}</button>
                <button type="button" className="btn btn-sm" onClick={saveKey}>{tr('Сохранить')}</button>
              </div>
            </Field>
            <div className="field"><span className="field-label">{tr('Модель')}</span><Select label={tr('Модель')} block value={s.ai.model} onChange={(v) => setState({ ai: { ...s.ai, model: v } })} options={MODELS.map((m) => ({ value: m.id, label: m.name, hint: m.hint }))} /></div>
            {!s.ai.apiKey && <p className="note">{tr('Пока ключ не сохранён, отвечает встроенный помощник.')}</p>}
            <p className="muted small">{tr('Если Claude не ответит — нет сети, ключ не подошёл, — ответит встроенный помощник и скажет почему. Запросы оплачиваются по тарифам Anthropic с вашего ключа.')}</p>
          </>
        )}
      </section>

      <section className="stack panel">
        <h2 className="h3">{tr('Оформление')}</h2>
        <div className="seg" role="radiogroup" aria-label={tr('Язык')}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={s.lang === l.id} className={s.lang === l.id ? 'is-on' : ''} onClick={() => { void changeLang(l.id); }}>{l.name}</button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label={tr('Тема')}>
          {([['auto', tr('Как в системе')], ['light', tr('Светлая')], ['dark', tr('Тёмная')]] as const).map(([id, name]) => (
            <button key={id} type="button" role="radio" aria-checked={s.theme === id} className={s.theme === id ? 'is-on' : ''} onClick={() => setState({ theme: id })}>{name}</button>
          ))}
        </div>
      </section>

      <section className="stack panel">
        <h2 className="h3">{tr('Перевод')}</h2>
        <label className="check"><input type="checkbox" checked={!!s.autoTranslate} onChange={(e) => setState({ autoTranslate: e.target.checked })} /><span>{tr('Автоматически переводить материалы проектов и сообщения на язык интерфейса')}</span></label>
        <p className="muted small">{tr('Переводит встроенный переводчик браузера (свежий Chrome, работает на устройстве). Если его нет — Claude, когда он подключён выше. Под каждым переведённым текстом можно вернуть оригинал.')}</p>
      </section>

      <section className="stack panel">
        <h2 className="h3">{tr('Данные')}</h2>
        <p className="muted">{backendEnabled ? tr('Проекты, профили и сообщения хранятся в общей базе Commons. В этом браузере — только ваши настройки: язык, тема и ключ Claude.') : tr('Сейчас платформа работает в демо-режиме: проекты, профили и история хранятся в этом браузере.')}</p>
        <div className="row-start">
          <button type="button" className="btn btn-sm" onClick={download}>{tr('Скачать данные (JSON)')}</button>
          {!backendEnabled && <button type="button" className="btn btn-sm btn-ghost" onClick={async () => { if (await confirmDialog({ title: tr('Вернуть демо к исходному виду?'), text: tr('Ваши проекты, профили и изменения в этом браузере будут удалены.'), confirm: tr('Вернуть демо'), danger: true })) { resetDemo(); toast(tr('Демо-данные восстановлены')); } }}>{tr('Вернуть демо к исходному виду')}</button>}
        </div>
      </section>
    </div>
  );
}
