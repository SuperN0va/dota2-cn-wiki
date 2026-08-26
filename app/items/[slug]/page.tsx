import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatDate, formatItemDescription, formatItemText, formatItemValueLabel, formatValues,
  getItemBuildsInto, getItemEffects, getItemMechanicProfile, getItemRecipeComponents, itemBySlug, itemDescriptionValueNames, items,
  isItemValuePercentage,
  type Item, type MechanicBlock,
} from '../../../lib/data';
import { GameText } from '../../../components/game-text';
import { MechanicDetails } from '../../../components/mechanic-details';

const effectGlyphs = { active: '▶', passive: '◎', use: '◆', toggle: '↔', upgrade: '↑', effect: '✦' };
const categoryLabels: Record<string, string> = {
  Accessories: '配件', Armaments: '军备', Artifacts: '宝物', Consumables: '消耗品', Miscellaneous: '杂项', Secret: '神秘商店', Support: '辅助用品', Upgrades: '升级物品', Neutral: '中立物品', Enchantment: '附魔',
};

function normalizeEffectName(value: string) {
  return value.toLocaleLowerCase('en').replace(/[\s'’·：:（）()_-]/g, '');
}

function matchMechanicBlocks(effects: ReturnType<typeof getItemEffects>, blocks: MechanicBlock[]) {
  const used = new Set<number>();
  const matches = effects.map((effect, effectIndex) => {
    const names = [effect.title, effect.typeLabel].map(normalizeEffectName);
    let index = blocks.findIndex((block, blockIndex) => !used.has(blockIndex) && [block.name, block.nameEnglish].map(normalizeEffectName).some((name) => names.includes(name)));
    if (index < 0 && effects.length === blocks.length) index = effectIndex;
    if (index >= 0) used.add(index);
    return index >= 0 ? blocks[index] : null;
  });
  return { matches, unmatched: blocks.filter((_, index) => !used.has(index)) };
}

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
  const mechanicProfile = getItemMechanicProfile(item.slug);
  const mechanicBlocks = mechanicProfile ? [...Object.values(mechanicProfile.abilities || {}), ...(mechanicProfile.pageMechanics || [])] : [];
  const { matches: effectMechanics, unmatched: unmatchedMechanics } = matchMechanicBlocks(effects, mechanicBlocks);
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
  const canSell = mechanicProfile?.sellable ?? (item.cost > 0 && item.neutralTier < 0);
  const sellValue = mechanicProfile?.sellValue ?? (canSell ? Math.floor(item.cost / 2) : null);
  const tradeRules = mechanicProfile ? [
    mechanicProfile.category && { label: '分类', value: categoryLabels[mechanicProfile.category] || mechanicProfile.category },
    mechanicProfile.shops.length && { label: '商店', value: mechanicProfile.shops.join(' / ') },
    mechanicProfile.shareable && { label: '可分享', value: mechanicProfile.shareable },
    mechanicProfile.disassemble && { label: '可拆分', value: mechanicProfile.disassemble },
    mechanicProfile.droppable && { label: '可丢弃', value: mechanicProfile.droppable },
    mechanicProfile.destroyable && { label: '可销毁', value: mechanicProfile.destroyable },
    mechanicProfile.maxStack && { label: '单格上限', value: String(mechanicProfile.maxStack) },
    mechanicProfile.charges && { label: '初始充能', value: String(mechanicProfile.charges) },
  ].filter(Boolean) as Array<{ label: string; value: string }> : [];

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
          {hasCurrentData && <dl className="item-primary-stats">
            {!effects.length && item.cooldown.some(Boolean) && <div><dt>冷却时间</dt><dd>{formatValues(item.cooldown)} 秒</dd></div>}
            {!effects.length && item.manaCost.some(Boolean) && <div><dt>魔法消耗</dt><dd>{formatValues(item.manaCost)}</dd></div>}
            {currentValues.map((value) => <div key={value.name}><dt>{formatItemValueLabel(value)}</dt><dd>{formatValues(value.values, isItemValuePercentage(value))}</dd></div>)}
          </dl>}
        </div>
        <div className="item-price">
          <div><small>购买价格</small><strong>{item.cost > 0 ? item.cost : '—'}</strong><span>{item.cost > 0 ? '金币' : '不可购买'}</span></div>
          <div className="item-sell-price"><small>出售价格</small><strong>{canSell && sellValue !== null ? sellValue : '—'}</strong><span>{canSell && sellValue !== null ? '金币' : '不可出售'}</span></div>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          {tradeRules.length > 0 && <section className="item-rules" aria-label="购买与持有规则">
            {tradeRules.map((rule) => <div key={rule.label}><span>{rule.label}</span><strong>{rule.value}</strong></div>)}
          </section>}
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
                    {effectMechanics[index] && <MechanicDetails block={effectMechanics[index]!} compact />}
                  </div>
                </article>;
              })}
            </div>
          </section>}

          {unmatchedMechanics.length > 0 && <section className="detail-section item-mechanics-section">
            <header><p className="eyebrow accent">Mechanics</p><h2>机制与相互作用</h2></header>
            <div className="standalone-mechanics">{unmatchedMechanics.map((block, index) => <article key={`${block.nameEnglish}:${index}`}><h3>{block.name || block.nameEnglish || item.name}</h3><MechanicDetails block={block} /></article>)}</div>
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
                  <div className="history-content"><ul>{entry.notes.map((note, noteIndex) => <li className="history-source-note" key={noteIndex}><small className="history-source-label">英文原文</small><GameText text={note.original || note.text} /></li>)}</ul></div>
                </details>
              ))}
              {!item.history.length && !item.legacyHistory.length && <div className="catalog-empty">暂未找到该记录对应的版本改动。</div>}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          {item.notes.length > 0 && <section className="bio-card"><p className="eyebrow">使用说明</p><ul>{item.notes.map((note) => { const formattedNote = formatItemText(item, note); return <li key={formattedNote}><GameText text={formattedNote} /></li>; })}</ul></section>}
          {item.lore && <section className="bio-card"><p className="eyebrow">物品背景</p><p>{item.lore}</p></section>}
          {mechanicProfile && <section className="provenance-card mechanic-source"><span>LP</span><div><strong>机制资料来源</strong><small>Liquipedia 修订 #{mechanicProfile.revisionId}</small><a href={mechanicProfile.sourceUrl} rel="noreferrer" target="_blank">查看英文原页 ↗</a></div></section>}
        </aside>
      </div>
    </article>
  );
}
