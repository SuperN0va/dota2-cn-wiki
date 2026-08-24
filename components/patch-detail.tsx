'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AbilityImage } from './ability-image';
import { AttributeIcon } from './attribute-icon';
import type { Note } from '../lib/data';

type EntityChange = {
  id: number;
  name: string;
  slug: string;
  image: string;
  notes: Note[];
  hasDetail?: boolean;
  attribute?: string;
  kind?: 'hero' | 'special-unit';
  sectionTitle?: string;
  abilities?: Array<{ id: number; name: string; image?: string; isInnate?: boolean; useSharedInnateIcon?: boolean; notes: Note[] }>;
  subunits?: EntityChange[];
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
  { id: 'neutral', label: '中立物品与附魔' },
  { id: 'heroes', label: '英雄改动' },
];

function NoteList({ notes }: { notes: Note[] }) {
  const visibleNotes = notes.filter((note) => note.text.trim());
  return <ul className="change-notes">{visibleNotes.map((note, index) => <li style={{ marginLeft: `${Math.max(0, note.indent - 1) * 18}px` }} key={`${note.text}:${index}`}>{note.text}</li>)}</ul>;
}

function hasChanges(entry: EntityChange): boolean {
  return entry.notes.some((note) => note.text.trim())
    || Boolean(entry.abilities?.some((ability) => ability.notes.some((note) => note.text.trim())))
    || Boolean(entry.subunits?.some(hasChanges));
}

function searchableText(entry: EntityChange): string {
  return [
    entry.name,
    entry.slug,
    ...entry.notes.map((note) => note.text),
    ...(entry.abilities?.flatMap((ability) => [ability.name, ...ability.notes.map((note) => note.text)]) || []),
    ...(entry.subunits?.map(searchableText) || []),
  ].join(' ');
}

function AbilityChanges({ entry }: { entry: EntityChange }) {
  return entry.abilities?.map((ability, abilityIndex) => (
    <div className="ability-change" key={`${entry.id}:${ability.id}:${abilityIndex}`}>
      {(ability.image || ability.useSharedInnateIcon) && (
        <AbilityImage
          src={ability.image || ''}
          alt={`${ability.name}图标`}
          isInnate={ability.isInnate && ability.useSharedInnateIcon !== false}
        />
      )}
      <div><h3>{ability.name}</h3><NoteList notes={ability.notes} /></div>
    </div>
  ));
}

function EntityHeading({ entry, label, href }: { entry: EntityChange; label: string; href?: string }) {
  return (
    <header>
      {entry.image ? <img className="entity-portrait" src={entry.image} alt="" /> : <span className="entity-placeholder">?</span>}
      <div>
        <small>{label}</small>
        <div className="entity-title-line">{entry.attribute && <AttributeIcon attribute={entry.attribute} />}<h2>{entry.name}</h2></div>
      </div>
      {entry.hasDetail && href && <Link href={href}>查看完整资料 →</Link>}
    </header>
  );
}

function SpecialUnitChange({ entry }: { entry: EntityChange }) {
  return (
    <section className="special-unit-change">
      <EntityHeading entry={entry} label="关联英雄单位" href={`/heroes/${entry.slug}`} />
      <NoteList notes={entry.notes} />
      <AbilityChanges entry={entry} />
    </section>
  );
}

export function PatchDetail({ patch }: { patch: PatchView }) {
  const [tab, setTab] = useState('general');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('zh-CN');

  const entities = useMemo(() => {
    const source = tab === 'items' ? patch.items : tab === 'neutral' ? patch.neutralItems : patch.heroes;
    return source.filter(hasChanges).filter((entry) => !needle || searchableText(entry).toLocaleLowerCase('zh-CN').includes(needle));
  }, [needle, patch, tab]);

  const entityGroups = useMemo(() => {
    const groups: Array<{ title: string; entries: EntityChange[] }> = [];
    for (const entry of entities) {
      const title = entry.sectionTitle || (tab === 'neutral' ? '中立物品' : tab === 'heroes' ? '英雄' : '物品');
      const current = groups.at(-1);
      if (!current || current.title !== title) groups.push({ title, entries: [entry] });
      else current.entries.push(entry);
    }
    return groups;
  }, [entities, tab]);

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
          {entityGroups.map((group, groupIndex) => (
            <section className="entity-change-group" key={`${group.title}:${groupIndex}`}>
              {(tab === 'neutral' || entityGroups.length > 1) && <header className="entity-group-heading"><span />{group.title}</header>}
              <div>
                {group.entries.map((entry, entryIndex) => (
                  <article className="entity-change" key={`${tab}:${entry.id}:${entryIndex}`}>
                    <EntityHeading
                      entry={entry}
                      label={tab === 'heroes' ? '英雄' : group.title === '附魔' ? '附魔' : tab === 'neutral' ? '中立物品' : '物品'}
                      href={tab === 'heroes' ? `/heroes/${entry.slug}` : `/items/${entry.slug}`}
                    />
                    <NoteList notes={entry.notes} />
                    <AbilityChanges entry={entry} />
                    {entry.subunits?.map((subunit, subunitIndex) => <SpecialUnitChange entry={subunit} key={`${entry.id}:${subunit.id}:${subunitIndex}`} />)}
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!entities.length && <div className="catalog-empty">没有匹配的改动记录。</div>}
        </div>
      )}
    </section>
  );
}
