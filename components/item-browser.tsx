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
  isEnhancement: boolean;
  isActiveEnhancement: boolean;
  enhancementTier: string;
  hasChineseName: boolean;
  image: string;
  historyCount: number;
};

const groups = [
  { id: 'current', label: '全部可用物品' },
  { id: 'shop', label: '商店物品' },
  { id: 'neutral', label: '中立物品' },
  { id: 'enhancement', label: '附魔' },
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
        (group === 'current' && item.isCurrent && !item.isRecipe && (!item.isEnhancement || item.isActiveEnhancement) && item.hasChineseName) ||
        (group === 'shop' && item.isCurrent && !item.isRecipe && item.neutralTier < 0 && !item.isEnhancement && item.hasChineseName) ||
        (group === 'neutral' && item.isCurrent && item.neutralTier >= 0 && item.hasChineseName) ||
        (group === 'enhancement' && item.isCurrent && item.isActiveEnhancement && item.hasChineseName) ||
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

        {(group === 'neutral' || group === 'enhancement') && (
          <section className="neutral-item-guide">
            <header><p className="eyebrow accent">Neutral crafting</p><h2>中立物品 = 宝物 + 附魔</h2></header>
            <div className="neutral-rule-grid">
              <article><strong>宝物</strong><p>决定物品的主动或被动技能。每个层级打造时选择一件；高层级可保留上一件宝物。</p></article>
              <article><strong>附魔</strong><p>提供常驻属性与数值加成；可用层级与英雄主属性会影响候选项，同名附魔在更高层级可能提供更强数值。</p></article>
              <article><strong>打造</strong><p>清理野怪营地获得魔石。1–5级依次开放于5、15、25、35、60分钟，快速模式时间减半。</p></article>
              <article><strong>装备</strong><p>每名英雄只能装备一件中立物品，固定占用中立物品栏；打造新物品会替换上一层级结果。</p></article>
            </div>
            <footer><span>1级各显示4个宝物与附魔候选；2–5级各显示5个。</span><a href="https://liquipedia.net/dota2/Neutral_Items" target="_blank" rel="noreferrer">核对完整规则 ↗</a></footer>
          </section>
        )}
        <div className="catalog-meta"><span><strong>{filtered.length}</strong> 条记录</span><span>{group === 'enhancement' ? '当前可用附魔' : 'Valve Datafeed 全量快照'}</span></div>
        <div className="item-grid">
          {filtered.map((item) => (
            <Link className="item-card" href={`/items/${item.slug}`} key={item.id}>
              <div className="item-icon-wrap"><img src={item.image} alt={`${item.name}图标`} /></div>
              <div className="item-card-copy">
                <small>{item.isEnhancement ? `附魔 · ${item.enhancementTier || '历史'}级` : item.neutralTier >= 0 ? `中立 ${item.neutralTier + 1} 级` : item.isRecipe ? '图纸' : item.nameEnglish || item.slug}</small>
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
