'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type ItemSummary = {
  id: number;
  slug: string;
  name: string;
  nameEnglish: string;
  cost: number;
  neutralTier: number;
  isRecipe: boolean;
  isCurrent: boolean;
  hasChineseName: boolean;
  image: string;
  historyCount: number;
};

const groups = [
  { id: 'current', label: '全部可用物品' },
  { id: 'shop', label: '商店物品' },
  { id: 'neutral', label: '中立物品' },
  { id: 'recipe', label: '图纸' },
  { id: 'archive', label: '全部数据记录' },
];

export function ItemBrowser({ items }: { items: ItemSummary[] }) {
  const [group, setGroup] = useState('current');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    return items.filter((item) => {
      const matchesGroup =
        group === 'archive' ||
        (group === 'current' && item.isCurrent && !item.isRecipe && item.hasChineseName) ||
        (group === 'shop' && item.isCurrent && !item.isRecipe && item.neutralTier < 0 && item.hasChineseName) ||
        (group === 'neutral' && item.isCurrent && item.neutralTier >= 0 && item.hasChineseName) ||
        (group === 'recipe' && item.isRecipe);
      const matchesQuery = !needle || `${item.name} ${item.nameEnglish} ${item.slug}`.toLocaleLowerCase('zh-CN').includes(needle);
      return matchesGroup && matchesQuery;
    });
  }, [group, items, query]);

  return (
    <div className="catalog-layout">
      <aside className="filter-sidebar">
        <section>
          <p className="eyebrow">物品分类</p>
          <div className="filter-list">
            {groups.map((item) => <button className={group === item.id ? 'is-active' : ''} key={item.id} onClick={() => setGroup(item.id)} type="button"><span>{item.label}</span></button>)}
          </div>
        </section>
        <section className="archive-note">
          <p className="eyebrow">覆盖说明</p>
          <p>“全部数据记录”保留 Valve 接口中的内部、历史与图纸条目，便于旧版本日志回溯。</p>
        </section>
      </aside>

      <section className="catalog-main">
        <header className="catalog-heading">
          <div>
            <p className="eyebrow accent">物品辞典</p>
            <h1>所有物品</h1>
            <p>当前属性、官方描述、价格与逐版本改动；中立物品和历史记录均可单独筛选。</p>
          </div>
          <label className="catalog-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索物品" /></label>
        </header>

        <div className="catalog-meta"><span><strong>{filtered.length}</strong> 条记录</span><span>Valve Datafeed 全量快照</span></div>
        <div className="item-grid">
          {filtered.map((item) => (
            <Link className="item-card" href={`/items/${item.slug}`} key={item.id}>
              <div className="item-icon-wrap"><img src={item.image} alt={`${item.name}图标`} /></div>
              <div className="item-card-copy">
                <small>{item.neutralTier >= 0 ? `中立 ${item.neutralTier + 1} 级` : item.isRecipe ? '图纸' : item.nameEnglish || item.slug}</small>
                <h2>{item.name}</h2>
                <p>{item.cost > 0 ? `${item.cost} 金` : '不可购买'}<span>{item.historyCount} 次改动</span></p>
              </div>
              <b>→</b>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
