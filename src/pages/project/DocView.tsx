import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteDoc, getUser, isMaintainer, saveDoc } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import type { Project } from '../../data/types';
import { IconFile, IconMore, IconPencil } from '../../components/icons';
import { ActionMenu, Select, confirmDialog } from '../../components/pop';
import { TimeAgo } from '../../components/Timeline';
import { Avatar, Empty, Field, UserLink, report, useMe } from '../../components/ui';
import { Markdown } from '../../lib/markdown';
import { g } from '../../lib/format';
import { tr } from '../../i18n';

function DocEditor({ p, docId, onDone }: { p: Project; docId?: string; onDone: (id?: string) => void }) {
  const me = useMe()!;
  const doc = p.docs.find((d) => d.id === docId);
  const [title, setTitle] = useState(doc?.title ?? '');
  const [body, setBody] = useState(doc?.body ?? '');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const save = () => {
    const r = act<ReturnType<typeof saveDoc>>('saveDoc', [p.id, { id: doc?.id, title, body }, me.id]);
    if (report(r, doc ? tr('Документ сохранён') : tr('Документ добавлен'))) onDone(r.value.docId);
  };
  return (
    <form className="stack doc-editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Например, «Архитектура» или «Арт-библия»')} /></Field>
      <div className="cbox">
        <div className="composer-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>{tr('Текст')}</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>{tr('Просмотр')}</button>
        </div>
        <div className="composer-body">
          {tab === 'write'
            ? <textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)} className="mono-area" aria-label={tr('Текст документа')} placeholder={tr('## Раздел\nТекст. **Жирный**, списки через «- », ссылки [текст](https://…)')} />
            : <div className="composer-preview"><Markdown text={body || tr('_Пусто_')} className="md-serif" /></div>}
        </div>
      </div>
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={() => onDone(doc?.id)}>{tr('Отмена')}</button>
        <button type="submit" className="btn btn-primary">{tr('Сохранить')}</button>
      </div>
    </form>
  );
}

export function DocView({ p, docId }: { p: Project; docId?: string }) {
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const maint = isMaintainer(p, me?.id);
  const base = `/p/${p.slug}/docs`;

  if (docId === 'new') {
    if (!maint) return <Empty title={tr('Документы добавляют сопровождающие')}>{tr('Предложите документ вкладом — сопровождающие его посмотрят.')}</Empty>;
    return <div className="narrow-col"><h2 className="h2">{tr('Новый документ')}</h2><DocEditor p={p} onDone={(id) => navigate(id ? `${base}/${id}` : `/p/${p.slug}`)} /></div>;
  }

  const doc = p.docs.find((d) => d.id === docId);
  if (!doc) return <Empty title={tr('Документ не найден')} action={<Link to={`/p/${p.slug}`} className="btn">{tr('К обзору проекта')}</Link>} />;

  if (editing) return <div className="narrow-col"><DocEditor p={p} docId={doc.id} onDone={() => setEditing(false)} /></div>;

  const remove = async () => {
    if (!(await confirmDialog({ title: tr('Удалить «{title}»?', { title: doc.title }), text: tr('Документ исчезнет из проекта. Его можно будет написать заново.'), confirm: tr('Удалить'), danger: true }))) return;
    if (report(act<ReturnType<typeof deleteDoc>>('deleteDoc', [p.id, doc.id, me!.id]), tr('Документ удалён'))) navigate(`/p/${p.slug}`);
  };

  return (
    <div className="doc-page">
      <div className="doc-crumbs">
        <Link to={`/p/${p.slug}`}>{p.title}</Link>
        <span>/</span>
        <Select
          label={tr('Документ')}
          value={doc.id}
          options={p.docs.map((d) => ({ value: d.id, label: d.title, icon: <IconFile /> }))}
          onChange={(id) => navigate(`${base}/${id}`)}
          small
          title={tr('Документы проекта')}
        />
      </div>
      <div className="box">
        <div className="box-head">
          <span className="doc-by"><Avatar user={getUser(s, doc.updatedBy)} size={20} /><UserLink id={doc.updatedBy} /> <span className="muted">{g(getUser(s, doc.updatedBy), tr('обновил'), tr('обновила'))} <TimeAgo at={doc.updatedAt} /></span></span>
          <span className="row-start">
            {maint ? (
              <>
                <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={tr('Править')} data-tip={tr('Править документ')}><IconPencil /></button>
                <ActionMenu label={tr('Ещё')} className="icon-btn" trigger={<IconMore />} items={[{ label: tr('Удалить документ'), danger: true, onSelect: remove }]} width={200} />
              </>
            ) : (
              <Link className="btn btn-sm" to={`/p/${p.slug}/pulls/new?kind=docs&title=${encodeURIComponent(tr('Правка документа «{title}»', { title: doc.title }))}`}>{tr('Предложить правку')}</Link>
            )}
          </span>
        </div>
        <article className="doc-body">
          <h1 className="doc-title">{doc.title}</h1>
          {doc.body.trim() ? <Markdown text={doc.body} className="md-serif" /> : <p className="muted">{tr('Документ пустой.')}</p>}
        </article>
      </div>
    </div>
  );
}
