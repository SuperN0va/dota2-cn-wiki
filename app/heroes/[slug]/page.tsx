import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatValues, heroBySlug, heroes } from '../../../lib/data';

export function generateStaticParams() {
  return heroes.map((hero) => ({ slug: hero.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const hero = heroBySlug.get(slug);
  if (!hero) return { title: '英雄未找到' };
  return {
    title: `${hero.name} — 技能与版本历史`,
    description: `${hero.name}（${hero.nameEnglish}）官方中文资料、当前技能数值和完整改动时间线。`,
    openGraph: { title: `${hero.name}｜DOTA 2 中文 WIKI`, description: hero.hype, images: [{ url: hero.image }] },
    twitter: { title: `${hero.name}｜DOTA 2 中文 WIKI`, description: hero.hype, images: [hero.image] },
  };
}

const statLabels: Array<[string, string]> = [
  ['damage', '攻击力'], ['armor', '护甲'], ['movementSpeed', '移动速度'], ['attackRange', '攻击距离'],
  ['attackRate', '攻击间隔'], ['magicResistance', '魔抗'], ['health', '生命值'], ['mana', '魔法值'],
];

export default async function HeroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hero = heroBySlug.get(slug);
  if (!hero) notFound();
  const attributeStats: Array<[string, string, number[]]> = [
    ['力', '力量', hero.stats.strength as number[]], ['敏', '敏捷', hero.stats.agility as number[]], ['智', '智力', hero.stats.intelligence as number[]],
  ];

  return (
    <article className="detail-page hero-detail-page">
      <nav className="breadcrumbs" aria-label="面包屑"><Link href="/">英雄</Link><span>/</span><strong>{hero.name}</strong></nav>
      <header className="hero-detail-hero">
        <div className="hero-detail-art"><img src={hero.image} alt={`${hero.name}肖像`} /><span className={`attribute-badge attr-${hero.primaryAttribute}`}>{hero.primaryAttribute.slice(0, 1)}</span></div>
        <div className="hero-title-copy">
          <p>{hero.nameEnglish}</p>
          <h1>{hero.name}</h1>
          <div className="role-row">{hero.roles.map((role) => <span key={role.name}>{role.name} · {role.level}</span>)}</div>
          <blockquote>{hero.hype}</blockquote>
        </div>
        <div className="hero-attributes">
          {attributeStats.map(([short, label, values]) => <div key={label}><span className={`mini-attr attr-${label}`}>{short}</span><p><strong>{values[0]}</strong><small>+{values[1]}</small></p><em>{label}</em></div>)}
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <header><p className="eyebrow accent">Current abilities</p><h2>当前技能</h2></header>
            <div className="ability-list">
              {hero.abilities.map((ability) => (
                <article className="ability-card" key={ability.id}>
                  <img src={ability.image} alt={`${ability.name}图标`} />
                  <div className="ability-copy">
                    <div className="ability-title"><h3>{ability.name}</h3>{ability.isInnate && <span>先天技能</span>}<small>{ability.slug}</small></div>
                    <p>{ability.description}</p>
                    <div className="ability-values">
                      {ability.cooldown.some(Boolean) && <span><em>冷却</em>{formatValues(ability.cooldown)} 秒</span>}
                      {ability.manaCost.some(Boolean) && <span><em>魔耗</em>{formatValues(ability.manaCost)}</span>}
                      {ability.castRange.some(Boolean) && <span><em>施法距离</em>{formatValues(ability.castRange)}</span>}
                      {ability.damage.some(Boolean) && <span><em>伤害</em>{formatValues(ability.damage)}</span>}
                    </div>
                    {!!ability.specialValues.length && (
                      <details className="special-values"><summary>查看完整技能数值</summary><dl>{ability.specialValues.map((value) => <div key={value.name}><dt>{value.label}</dt><dd>{formatValues(value.values, value.isPercentage)}</dd></div>)}</dl></details>
                    )}
                    {(ability.scepter || ability.shard) && <div className="upgrade-notes">{ability.scepter && <p><b>神杖</b>{ability.scepter}</p>}{ability.shard && <p><b>魔晶</b>{ability.shard}</p>}</div>}
                    {ability.lore && <small className="lore">{ability.lore}</small>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-section timeline-section">
            <header>
              <p className="eyebrow accent">Version history</p>
              <h2>英雄与技能改动时间线</h2>
              <p>7.08 起使用 Valve 官方简体中文日志；更早记录来自 Liquipedia，并保留英文原文供核对。</p>
            </header>
            <div className="history-timeline">
              {hero.history.map((entry, index) => (
                <details className="history-entry" key={entry.version} open={index < 5}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>{entry.timestamp ? formatDate(entry.timestamp) : ''} · Valve 官方中文</small></div><em>{entry.notes.length + (entry.abilities?.reduce((sum, ability) => sum + ability.notes.length, 0) || 0)} 项</em></summary>
                  <div className="history-content">
                    {!!entry.notes.length && <ul>{entry.notes.map((note, noteIndex) => <li style={{ marginLeft: `${(note.indent - 1) * 18}px` }} key={noteIndex}>{note.text}</li>)}</ul>}
                    {entry.abilities?.map((ability) => <div className="history-ability" key={ability.id}><h4>{ability.name}</h4><ul>{ability.notes.map((note, noteIndex) => <li key={noteIndex}>{note.text}</li>)}</ul></div>)}
                  </div>
                </details>
              ))}
              {hero.legacyHistory.map((entry) => (
                <details className="history-entry legacy" key={`legacy-${entry.version}`}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>Liquipedia 历史补充 · CC BY-SA 3.0</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, index) => <li style={{ marginLeft: `${(note.indent - 1) * 18}px` }} key={index}>{note.text}<details className="original-note"><summary>查看英文原文</summary><p>{note.original}</p></details></li>)}</ul></div>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="quick-stats"><p className="eyebrow">基础数据</p>{statLabels.map(([key, label]) => <div key={key}><span>{label}</span><strong>{Array.isArray(hero.stats[key]) ? (hero.stats[key] as number[]).join(' – ') : String(hero.stats[key])}{key === 'magicResistance' ? '%' : ''}</strong></div>)}</section>
          <section className="bio-card"><p className="eyebrow">英雄背景</p><p>{hero.bio}</p></section>
          <section className="provenance-card"><span className="status-dot" /><div><strong>当前资料</strong><small>Valve 官方简体中文 datafeed</small></div></section>
        </aside>
      </div>
    </article>
  );
}
