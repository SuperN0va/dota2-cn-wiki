'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Note } from '../lib/data';

type EntityChange = {
  id: number;
  name: string;
  slug: string;
  image: string;
  notes: Note[];
  abilities?: Array<{ id: number; name: string; image?: string; notes: Note[] }>;
};

type PatchView = {
  general: Array<{ title: string; notes: Note[] }>;
  items: EntityChange[];
  neutralItems: EntityChange[];
  heroes: EntityChange[];
};

const tabs = [
  { id: 'general', label: '综合改动' },
  { id: 'items', label: '物品改动' },
  { id: 'neutral', label: '中立物品' },
  { id: 'heroes', label: '英雄改动' },
];

function NoteList({ notes }: { notes: Note[] }) {
  return <ul className="change-notes">{notes.map((note, index) => <li style={{ marginLeft: `${Math.max(0, note.indent - 1) * 18}px` }} key={`${note.text}:${index}`}>{note.text}</li>)}</ul>;
}

export function PatchDetail({ patch }: { patch: PatchView }) {
  const [tab, setTab] = useState('general');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('zh-CN');

  const entities = useMemo(() => {
    const source = tab === 'items' ? patch.items : tab === 'neutral' ? patch.neutralItems : patch.heroes;
    return source.filter((entry) => !needle || `${entry.name} ${entry.slug} ${entry.notes.map((note) => note.text).join(' ')}`.toLocaleLowerCase('zh-CN').includes(needle));
  }, [needle, patch, tab]);

  return (
    <section className="patch-body">
      <div className="patch-tabs" role="tablist">
        {tabs.map((item) => <button className={tab === item.id ? 'is-active' : ''} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}
        {tab !== 'general' && <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在本版本中搜索" /></label>}
      </div>

      {tab === 'general' ? (
        <div className="general-sections">
          {patch.general.map((section, index) => (
            <article className="change-section" key={`${section.title}:${index}`}>
              <span className="section-index">{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{section.title}</h2><NoteList notes={section.notes} /></div>
            </article>
          ))}
          {!patch.general.length && <div className="catalog-empty">本版本没有单独的综合改动。</div>}
        </div>
      ) : (
        <div className="entity-changes">
          {entities.map((entry) => (
            <article className="entity-change" key={entry.id}>
              <header>
                {entry.image ? <img src={entry.image} alt="" /> : <span className="entity-placeholder">?</span>}
                <div><small>{tab === 'heroes' ? '英雄' : tab === 'neutral' ? '中立物品' : '物品'}</small><h2>{entry.name}</h2></div>
                <Link href={tab === 'heroes' ? `/heroes/${entry.slug}` : `/items/${entry.slug}`}>查看完整资料 →</Link>
              </header>
              <NoteList notes={entry.notes} />
              {entry.abilities?.map((ability) => (
                <div className="ability-change" key={ability.id}>
                  {ability.image && <img src={ability.image} alt="" />}
                  <div><h3>{ability.name}</h3><NoteList notes={ability.notes} /></div>
                </div>
              ))}
            </article>
          ))}
          {!entities.length && <div className="catalog-empty">没有匹配的改动记录。</div>}
        </div>
      )}
    </section>
  );
}
