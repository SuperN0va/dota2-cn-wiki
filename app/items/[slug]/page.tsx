import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatItemDescription, formatItemText, formatValues, itemBySlug, itemDescriptionValueNames, items } from '../../../lib/data';

export function generateStaticParams() {
  return items.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = itemBySlug.get(slug);
  if (!item) return { title: '物品未找到' };
  const description = formatItemDescription(item) || `${item.name}的当前资料与完整改动时间线。`;
  return {
    title: `${item.name} — 属性与版本历史`,
    description,
    openGraph: { title: `${item.name}｜DOTA 2 中文 WIKI`, description, images: [{ url: item.image }] },
    twitter: { title: `${item.name}｜DOTA 2 中文 WIKI`, description, images: [item.image] },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = itemBySlug.get(slug);
  if (!item) notFound();
  const description = formatItemDescription(item);
  const descriptionValues = itemDescriptionValueNames([item.description, ...item.notes]);
  const currentValues = item.specialValues.filter((value) =>
    value.values.some((number) => number !== 0)
    && !descriptionValues.has(value.name.toLocaleLowerCase('en'))
    && !['abilitycooldown', 'abilitymanacost'].includes(value.name.toLocaleLowerCase('en')),
  );
  const hasCurrentData = item.cooldown.some(Boolean) || item.manaCost.some(Boolean) || currentValues.length > 0;

  return (
    <article className="detail-page item-detail-page">
      <nav className="breadcrumbs"><Link href="/items">物品</Link><span>/</span><strong>{item.name}</strong></nav>
      <header className="item-detail-hero">
        <div className="large-item-icon"><img src={item.image} alt={`${item.name}图标`} /></div>
        <div>
          <p>{item.nameEnglish || item.internalName}</p>
          <h1>{item.name}</h1>
          <div className="role-row">
            <span>{item.neutralTier >= 0 ? `中立 ${item.neutralTier + 1} 级` : item.isRecipe ? '图纸' : '商店物品'}</span>
            <span>ID {item.id}</span>
          </div>
          {description && <p className="item-description">{description}</p>}
        </div>
        <div className="item-price"><small>当前价格</small><strong>{item.cost > 0 ? item.cost : '—'}</strong><span>{item.cost > 0 ? '金币' : '不可购买'}</span></div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          {hasCurrentData && <section className="detail-section item-current-data">
            <header><p className="eyebrow accent">Current data</p><h2>当前属性</h2></header>
            <div className="item-value-grid">
              {item.cooldown.some(Boolean) && <div><span>冷却时间</span><strong>{formatValues(item.cooldown)} 秒</strong></div>}
              {item.manaCost.some(Boolean) && <div><span>魔法消耗</span><strong>{formatValues(item.manaCost)}</strong></div>}
              {currentValues.map((value) => <div key={value.name}><span>{value.label}</span><strong>{formatValues(value.values, value.isPercentage)}</strong></div>)}
            </div>
          </section>}

          <section className="detail-section timeline-section">
            <header><p className="eyebrow accent">Version history</p><h2>物品改动时间线</h2><p>官方中文版本与 7.08 以前的 Liquipedia 历史记录统一按时间排列。</p></header>
            <div className="history-timeline">
              {item.history.map((entry, index) => (
                <details className="history-entry" key={entry.version} open={index < 6}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>{entry.timestamp ? formatDate(entry.timestamp) : ''} · Valve 官方中文</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, noteIndex) => <li style={{ marginLeft: `${(note.indent - 1) * 18}px` }} key={noteIndex}>{note.text}</li>)}</ul></div>
                </details>
              ))}
              {item.legacyHistory.map((entry) => (
                <details className="history-entry legacy" key={`legacy-${entry.version}`}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>Liquipedia 历史补充 · CC BY-SA 3.0</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, noteIndex) => <li key={noteIndex}>{note.text}<details className="original-note"><summary>查看英文原文</summary><p>{note.original}</p></details></li>)}</ul></div>
                </details>
              ))}
              {!item.history.length && !item.legacyHistory.length && <div className="catalog-empty">暂未找到该记录对应的版本改动。</div>}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          {item.notes.length > 0 && <section className="bio-card"><p className="eyebrow">使用说明</p><ul>{item.notes.map((note) => { const formattedNote = formatItemText(item, note); return <li key={formattedNote}>{formattedNote}</li>; })}</ul></section>}
          {item.lore && <section className="bio-card"><p className="eyebrow">物品背景</p><p>{item.lore}</p></section>}
        </aside>
      </div>
    </article>
  );
}
