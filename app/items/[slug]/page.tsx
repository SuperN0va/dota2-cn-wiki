import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatDate, formatItemDescription, formatItemText, formatItemValueLabel, formatValues,
  getItemBuildsInto, getItemEffects, getItemRecipeComponents, itemBySlug, itemDescriptionValueNames, items,
  isItemValuePercentage,
  type Item,
} from '../../../lib/data';
import { GameText } from '../../../components/game-text';

const effectGlyphs = { active: '▶', passive: '◎', use: '◆', toggle: '↔', upgrade: '↑', effect: '✦' };

function groupComponents(components: Item[]) {
  const grouped = new Map<string, { item: Item; count: number }>();
  for (const component of components) {
    const current = grouped.get(component.slug);
    if (current) current.count += 1;
    else grouped.set(component.slug, { item: component, count: 1 });
  }
  return [...grouped.values()];
}

function RecipeBranch({ item, count = 1, root = false, trail = [] }: { item: Item; count?: number; root?: boolean; trail?: string[] }) {
  const isCycle = trail.includes(item.slug);
  const components = isCycle ? [] : groupComponents(getItemRecipeComponents(item));
  return <li className={root ? 'recipe-root' : ''}>
    <Link className="recipe-node" href={`/items/${item.slug}`}>
      <img src={item.image} alt={`${item.name}图标`} />
      <span><strong>{item.name}</strong><small>{item.cost > 0 ? `${item.cost} 金币` : item.isRecipe ? '免费图纸' : '不可购买'}</small></span>
      {count > 1 && <b>×{count}</b>}
    </Link>
    {components.length > 0 && <ul>{components.map((component) => <RecipeBranch item={component.item} count={component.count} trail={[...trail, item.slug]} key={component.item.slug} />)}</ul>}
  </li>;
}

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
  const effects = getItemEffects(item);
  const effectValueNames = new Set(effects.flatMap((effect) => effect.valueNames));
  const recipeComponents = getItemRecipeComponents(item);
  const buildsInto = getItemBuildsInto(item);
  const descriptionValues = itemDescriptionValueNames([item.description, ...item.notes]);
  const currentValues = item.specialValues.filter((value) =>
    value.values.some((number) => number !== 0)
    && !descriptionValues.has(value.name.toLocaleLowerCase('en'))
    && !effectValueNames.has(value.name.toLocaleLowerCase('en'))
    && !['abilitycooldown', 'abilitymanacost'].includes(value.name.toLocaleLowerCase('en')),
  );
  const hasCurrentData = currentValues.length > 0 || (!effects.length && (item.cooldown.some(Boolean) || item.manaCost.some(Boolean)));

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
          {description && <p className="item-description"><GameText text={description} /></p>}
        </div>
        <div className="item-price"><small>当前价格</small><strong>{item.cost > 0 ? item.cost : '—'}</strong><span>{item.cost > 0 ? '金币' : '不可购买'}</span></div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          {(recipeComponents.length > 0 || buildsInto.length > 0) && <section className="detail-section item-recipe-section">
            <header><p className="eyebrow accent">Recipe</p><h2>{recipeComponents.length > 0 ? '合成配方' : '可合成物品'}</h2></header>
            {recipeComponents.length > 0 && <div className="recipe-tree"><ul><RecipeBranch item={item} root /></ul></div>}
            {buildsInto.length > 0 && <div className="builds-into"><strong>还能合成</strong><div>{buildsInto.map((result) => <Link href={`/items/${result.slug}`} key={result.slug}><img src={result.image} alt="" /><span>{result.name}<small>{result.cost > 0 ? `${result.cost} 金币` : '不可购买'}</small></span><b>→</b></Link>)}</div></div>}
          </section>}

          {effects.length > 0 && <section className="detail-section item-effects-section">
            <header><p className="eyebrow accent">Abilities</p><h2>物品效果</h2></header>
            <div className="item-effect-list">
              {effects.map((effect, index) => {
                const values = item.specialValues.filter((value) => effect.valueNames.includes(value.name.toLocaleLowerCase('en')) && value.values.some((number) => number !== 0));
                return <article className={`item-effect-card is-${effect.type}`} id={`effect-${index + 1}`} key={`${effect.type}:${effect.title}:${index}`}>
                  <div className="item-effect-icon"><img src={item.image} alt={`${effect.title}图标`} /><span aria-label={effect.typeLabel}>{effectGlyphs[effect.type]}</span></div>
                  <div className="item-effect-copy">
                    <header><span>{effect.typeLabel}</span><h3>{effect.title}</h3></header>
                    {effect.description && <p><GameText text={effect.description} /></p>}
                    <div className="effect-resource-row">
                      {effect.type !== 'passive' && item.cooldown.some(Boolean) && <span>冷却 <strong>{formatValues(item.cooldown)} 秒</strong></span>}
                      {effect.type !== 'passive' && item.manaCost.some(Boolean) && <span>魔耗 <strong>{formatValues(item.manaCost)}</strong></span>}
                    </div>
                    {values.length > 0 && <dl>{values.map((value) => <div key={value.name}><dt>{formatItemValueLabel(value)}</dt><dd>{formatValues(value.values, isItemValuePercentage(value))}</dd></div>)}</dl>}
                  </div>
                </article>;
              })}
            </div>
          </section>}

          {hasCurrentData && <section className="detail-section item-current-data">
            <header><p className="eyebrow accent">Current data</p><h2>当前属性</h2></header>
            <div className="item-value-grid">
              {!effects.length && item.cooldown.some(Boolean) && <div><span>冷却时间</span><strong>{formatValues(item.cooldown)} 秒</strong></div>}
              {!effects.length && item.manaCost.some(Boolean) && <div><span>魔法消耗</span><strong>{formatValues(item.manaCost)}</strong></div>}
              {currentValues.map((value) => <div key={value.name}><span>{formatItemValueLabel(value)}</span><strong>{formatValues(value.values, isItemValuePercentage(value))}</strong></div>)}
            </div>
          </section>}

          <section className="detail-section timeline-section">
            <header><p className="eyebrow accent">Version history</p><h2>物品改动时间线</h2><p>官方中文版本与 7.08 以前的 Liquipedia 历史记录统一按时间排列。</p></header>
            <div className="history-timeline">
              {item.history.map((entry, index) => (
                <details className="history-entry" key={entry.version} open={index < 6}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>{entry.timestamp ? formatDate(entry.timestamp) : ''} · Valve 官方中文</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, noteIndex) => <li style={{ marginLeft: `${(note.indent - 1) * 18}px` }} key={noteIndex}><GameText text={note.text} /></li>)}</ul></div>
                </details>
              ))}
              {item.legacyHistory.map((entry) => (
                <details className="history-entry legacy" key={`legacy-${entry.version}`}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>Liquipedia 历史补充 · CC BY-SA 3.0</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, noteIndex) => <li key={noteIndex}><GameText text={note.text} /><details className="original-note"><summary>查看英文原文</summary><p>{note.original}</p></details></li>)}</ul></div>
                </details>
              ))}
              {!item.history.length && !item.legacyHistory.length && <div className="catalog-empty">暂未找到该记录对应的版本改动。</div>}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          {item.notes.length > 0 && <section className="bio-card"><p className="eyebrow">使用说明</p><ul>{item.notes.map((note) => { const formattedNote = formatItemText(item, note); return <li key={formattedNote}><GameText text={formattedNote} /></li>; })}</ul></section>}
          {item.lore && <section className="bio-card"><p className="eyebrow">物品背景</p><p>{item.lore}</p></section>}
        </aside>
      </div>
    </article>
  );
}
