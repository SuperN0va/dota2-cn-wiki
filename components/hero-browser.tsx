'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type HeroSummary = {
  id: number;
  slug: string;
  name: string;
  nameEnglish: string;
  attribute: string;
  roles: string[];
  complexity: number;
  image: string;
  historyCount: number;
};

const attributes = ['全部', '力量', '敏捷', '智力', '全才'];
const roles = ['核心', '辅助', '爆发', '控制', '耐久', '逃生', '推进', '先手'];

export function HeroBrowser({ heroes, latestPatch }: { heroes: HeroSummary[]; latestPatch: string }) {
  const [attribute, setAttribute] = useState('全部');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  useEffect(() => {
    if (window.localStorage.getItem('hero-view-mode') === 'compact') setViewMode('compact');
  }, []);

  const changeView = (mode: 'grid' | 'compact') => {
    setViewMode(mode);
    window.localStorage.setItem('hero-view-mode', mode);
  };

  const counts = useMemo(() => Object.fromEntries(attributes.map((item) => [item, item === '全部' ? heroes.length : heroes.filter((hero) => hero.attribute === item).length])), [heroes]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    return heroes.filter((hero) => {
      const matchesAttribute = attribute === '全部' || hero.attribute === attribute;
      const matchesRole = !role || hero.roles.includes(role);
      const matchesQuery = !needle || `${hero.name} ${hero.nameEnglish}`.toLocaleLowerCase('zh-CN').includes(needle);
      return matchesAttribute && matchesRole && matchesQuery;
    });
  }, [attribute, heroes, query, role]);

  return (
    <div className="catalog-layout">
      <aside className="filter-sidebar">
        <section>
          <p className="eyebrow">主属性</p>
          <div className="filter-list">
            {attributes.map((item) => (
              <button className={attribute === item ? 'is-active' : ''} key={item} onClick={() => setAttribute(item)} type="button">
                <span>{item === '全部' ? '全部英雄' : item}</span><em>{counts[item]}</em>
              </button>
            ))}
          </div>
        </section>
        <section>
          <p className="eyebrow">英雄定位</p>
          <div className="filter-chips">
            {roles.map((item) => <button className={role === item ? 'is-active' : ''} key={item} onClick={() => setRole(role === item ? '' : item)} type="button">{item}</button>)}
          </div>
        </section>
        <section className="source-status">
          <span className="status-dot" />
          <div><strong>Valve 数据已同步</strong><small>简体中文 · 当前版本</small></div>
          <code>{latestPatch}</code>
        </section>
      </aside>

      <section className="catalog-main">
        <header className="catalog-heading">
          <div>
            <p className="eyebrow accent">英雄图鉴</p>
            <h1>所有英雄</h1>
            <p>官方中文背景、当前技能数值，以及从 7.08 至今的官方中文改动和更早的社区历史补充。</p>
          </div>
          <label className="catalog-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在英雄中搜索" />
          </label>
        </header>

        <div className="catalog-meta">
          <span><strong>{filtered.length}</strong> / {heroes.length} 位英雄</span>
          <div className="catalog-meta-actions">
            {(attribute !== '全部' || role || query) && <button className="clear-filters" type="button" onClick={() => { setAttribute('全部'); setRole(''); setQuery(''); }}>清除筛选</button>}
            <div className="view-switch" role="group" aria-label="英雄展示方式">
              <button className={viewMode === 'grid' ? 'is-active' : ''} type="button" onClick={() => changeView('grid')} aria-pressed={viewMode === 'grid'} title="卡片视图"><span aria-hidden="true">▦</span> 卡片</button>
              <button className={viewMode === 'compact' ? 'is-active' : ''} type="button" onClick={() => changeView('compact')} aria-pressed={viewMode === 'compact'} title="紧凑列表"><span aria-hidden="true">☷</span> 列表</button>
            </div>
          </div>
        </div>

        <div className={`hero-grid${viewMode === 'compact' ? ' is-compact' : ''}`}>
          {filtered.map((hero) => (
            <Link className="hero-card" href={`/heroes/${hero.slug}`} key={hero.id}>
              <div className="hero-art">
                <img src={hero.image} alt={`${hero.name}英雄肖像`} />
                <span className={`attribute-badge attr-${hero.attribute}`}>{hero.attribute.slice(0, 1)}</span>
                <span className="history-count">{hero.historyCount} 个版本节点</span>
              </div>
              <div className="hero-card-info">
                <p>{hero.nameEnglish}</p>
                <h2>{hero.name}</h2>
                <div>{hero.roles.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
              </div>
            </Link>
          ))}
        </div>
        {!filtered.length && <div className="catalog-empty">没有符合当前条件的英雄。</div>}
      </section>
    </div>
  );
}
