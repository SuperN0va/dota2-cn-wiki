import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatValues, heroBySlug, heroes, type Ability, type Note } from '../../../lib/data';
import { AbilityImage } from '../../../components/ability-image';
import { AttributeIcon } from '../../../components/attribute-icon';
import { GameText } from '../../../components/game-text';

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

const changeLabels = {
  reworked: '重做', removed: '移除', old: '旧版', new: '新版', talents: '天赋', added: '新增',
  changed: '调整', fixed: '修复', moved: '移动',
} as const;
type ChangeKind = keyof typeof changeLabels;

function changeKinds(note: { text: string; original?: string }): ChangeKind[] {
  const text = `${note.text} ${note.original || ''}`;
  const kinds: ChangeKind[] = [];
  if (/重做|重新设计|\breworked?\b/i.test(text)) kinds.push('reworked');
  if (/^\s*(移除|删除|不再)|\bremoved\b|\bno longer\b/i.test(text)) kinds.push('removed');
  if (/^\s*(旧版|旧：|原效果)|\bold\b/i.test(text)) kinds.push('old');
  if (/^\s*(新版|新：|新效果)|\bnew\b/i.test(text)) kinds.push('new');
  if (/天赋|\btalents?\b/i.test(text)) kinds.push('talents');
  if (/^\s*(新增|加入)|\badded\b/i.test(text)) kinds.push('added');
  if (/^\s*(调整|更改)|\bchanged\b/i.test(text)) kinds.push('changed');
  if (/^\s*修复|\bfixed\b/i.test(text)) kinds.push('fixed');
  if (/^\s*移动|\bmoved\b/i.test(text)) kinds.push('moved');
  return [...new Set(kinds)];
}

function displayTalentName(talent: Ability) {
  const ownValues = new Map(talent.specialValues.map((value) => [value.name, value.values[0]]));
  return talent.name.replace(/\{s:([^}]+)\}/g, (_, key: string) => String(ownValues.get(key) ?? '？'));
}

function relatedAbilities(text: string, abilities: Ability[]) {
  return abilities.filter((ability) => ability.name.length > 1 && text.includes(ability.name));
}

function AbilityChip({ ability, compact = false }: { ability: Ability; compact?: boolean }) {
  const anchor = ability.type === 2 ? `talent-${ability.id}` : `ability-${ability.id}`;
  return (
    <a className={`ability-chip${compact ? ' compact' : ''}`} href={`#${anchor}`}>
      <AbilityImage src={ability.image} alt="" isInnate={ability.isInnate && ability.useSharedInnateIcon !== false} />
      <span>{ability.name}</span>
    </a>
  );
}

function ChangeNote({ note, abilities = [], extra }: { note: Note | { text: string; original?: string; indent: number }; abilities?: Ability[]; extra?: ReactNode }) {
  const matches = relatedAbilities(`${note.text} ${note.original || ''}`, abilities);
  return (
    <li className="change-note" style={{ marginLeft: `${Math.max(0, note.indent - 1) * 18}px` }}>
      <span className="change-note-line">
        {changeKinds(note).map((kind) => <b className={`change-badge is-${kind}`} key={kind}>{changeLabels[kind]}</b>)}
        {matches.map((ability) => <AbilityChip ability={ability} compact key={ability.id} />)}
        <span><GameText text={note.text} /></span>
      </span>
      {extra}
    </li>
  );
}

function AbilityCard({ ability }: { ability: Ability }) {
  return (
    <article className={`ability-card${ability.isInnate ? ' is-innate' : ''}`} id={`ability-${ability.id}`}>
      <a className="ability-card-icon" href={`#ability-${ability.id}`} aria-label={`定位到${ability.name}`}><AbilityImage src={ability.image} alt={`${ability.name}图标`} isInnate={ability.isInnate && ability.useSharedInnateIcon !== false} /></a>
      <div className="ability-copy">
        <div className="ability-title"><h3>{ability.name}</h3>{ability.isInnate && <span>先天技能</span>}<small>{ability.slug}</small></div>
        <p><GameText text={ability.description} /></p>
        <div className="ability-values">
          {ability.cooldown.some(Boolean) && <span><em>冷却</em><GameText text={`${formatValues(ability.cooldown)} 秒`} /></span>}
          {ability.manaCost.some(Boolean) && <span><em>魔耗</em><GameText text={formatValues(ability.manaCost)} /></span>}
          {ability.castRange.some(Boolean) && <span><em>施法距离</em><GameText text={formatValues(ability.castRange)} /></span>}
          {ability.damage.some(Boolean) && <span><em>伤害</em><GameText text={formatValues(ability.damage)} /></span>}
        </div>
        {!!ability.specialValues.length && (
          <details className="special-values"><summary>查看完整技能数值</summary><dl>{ability.specialValues.map((value) => <div key={value.name}><dt>{value.label}</dt><dd><GameText text={formatValues(value.values, value.isPercentage)} /></dd></div>)}</dl></details>
        )}
        {(ability.scepter || ability.shard) && <div className="upgrade-notes">{ability.scepter && <p><b>神杖</b><GameText text={ability.scepter} /></p>}{ability.shard && <p><b>魔晶</b><GameText text={ability.shard} /></p>}</div>}
        {!!ability.notes.length && <ul className="ability-notes">{ability.notes.map((note, index) => <li key={index}><GameText text={note} /></li>)}</ul>}
        {ability.lore && <small className="lore">{ability.lore}</small>}
      </div>
    </article>
  );
}

function TalentCell({ talent, abilities }: { talent: Ability; abilities: Ability[] }) {
  const name = displayTalentName(talent);
  const target = abilities.find((ability) => name.includes(ability.name));
  const content = <>{target ? <AbilityImage src={target.image} alt="" isInnate={target.isInnate && target.useSharedInnateIcon !== false} /> : <b className="talent-glyph" aria-hidden="true">✦</b>}<span><GameText text={name} /></span></>;
  return target
    ? <a className="talent-cell" id={`talent-${talent.id}`} href={`#ability-${target.id}`}>{content}</a>
    : <div className="talent-cell" id={`talent-${talent.id}`}>{content}</div>;
}

function formatStat(value: unknown, suffix = '') {
  if (typeof value === 'number') return `${Number(value.toFixed(2))}${suffix}`;
  return value ? `${value}${suffix}` : '—';
}

export default async function HeroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hero = heroBySlug.get(slug);
  if (!hero) notFound();
  const relatedUnit = hero.slug === 'lone_druid' ? heroes.find((entry) => entry.slug === 'spirit_bear') : null;
  const attributeStats: Array<[string, string, number[]]> = [
    ['力', '力量', hero.stats.strength as number[]], ['敏', '敏捷', hero.stats.agility as number[]], ['智', '智力', hero.stats.intelligence as number[]],
  ];
  const abilitiesById = new Map([...hero.abilities, ...hero.talents].map((ability) => [ability.id, ability]));
  const innateAbilities = hero.abilities.filter((ability) => ability.isInnate);
  const regularAbilities = hero.abilities.filter((ability) => !ability.isInnate);
  const indexedAbilities = [...innateAbilities, ...regularAbilities];
  const upgrades = hero.abilities.flatMap((ability) => [
    ability.scepter ? { kind: '神杖', className: 'scepter', ability, text: ability.scepter } : null,
    ability.shard ? { kind: '魔晶', className: 'shard', ability, text: ability.shard } : null,
  ]).filter(Boolean) as Array<{ kind: string; className: string; ability: Ability; text: string }>;
  const talentRows = [3, 2, 1, 0].map((index) => ({ level: [10, 15, 20, 25][index], left: hero.talents[index * 2 + 1], right: hero.talents[index * 2] }));
  const profile = hero.liquipediaProfile;
  const vitalStats = [
    { label: '生命值', value: formatStat(hero.stats.health), regen: hero.stats.healthRegen ? `+${formatStat(hero.stats.healthRegen, '/秒')}` : '—', tone: 'health' },
    { label: '魔法值', value: formatStat(hero.stats.mana), regen: hero.stats.manaRegen ? `+${formatStat(hero.stats.manaRegen, '/秒')}` : '—', tone: 'mana' },
  ];
  const statRows: Array<{ label: string; value: string; tone: 'defense' | 'combat' | 'mobility' | 'vision'; groupStart?: boolean }> = [
    { label: '护甲', value: formatStat(hero.stats.armor), tone: 'defense' },
    { label: '魔法抗性', value: formatStat(hero.stats.magicResistance, '%'), tone: 'defense' },
    { label: '攻击力', value: (hero.stats.damage as number[]).join(' – '), tone: 'combat', groupStart: true },
    { label: '弹道速度', value: hero.stats.attackCapability === '近战' ? '即时（近战）' : formatStat(hero.stats.projectileSpeed), tone: 'combat' },
    { label: '攻击距离', value: formatStat(hero.stats.attackRange), tone: 'combat' },
    { label: '攻击类型', value: formatStat(hero.stats.attackCapability), tone: 'combat' },
    { label: '基础攻击间隔', value: formatStat(hero.stats.attackRate, ' 秒'), tone: 'combat' },
    { label: '移动速度', value: formatStat(hero.stats.movementSpeed), tone: 'mobility', groupStart: true },
    { label: '转身速率', value: formatStat(hero.stats.turnRate), tone: 'mobility' },
    { label: '昼 / 夜视野', value: `${formatStat(hero.stats.sightRangeDay)} / ${formatStat(hero.stats.sightRangeNight)}`, tone: 'vision', groupStart: true },
  ];

  return (
    <article className="detail-page hero-detail-page">
      <nav className="breadcrumbs" aria-label="面包屑"><Link href="/">英雄</Link><span>/</span><strong>{hero.name}</strong></nav>
      <header className="hero-detail-hero">
        <div className="hero-detail-art"><img src={hero.image} alt={`${hero.name}肖像`} /><span className={`attribute-badge attr-${hero.primaryAttribute}`}><AttributeIcon attribute={hero.primaryAttribute} /></span></div>
        <div className="hero-title-copy">
          <p>{hero.nameEnglish}</p>
          <div className="hero-title-line"><AttributeIcon attribute={hero.primaryAttribute} /><h1>{hero.name}</h1></div>
          <div className="role-row">{hero.roles.map((role) => <span key={role.name}>{role.name} · {role.level}</span>)}</div>
          {hero.relatedHero && <Link className="hero-relation" href={`/heroes/${hero.relatedHero.slug}`}>归属于 {hero.relatedHero.name} · {hero.relatedHero.relationship} →</Link>}
          {relatedUnit && <Link className="hero-relation" href={`/heroes/${relatedUnit.slug}`}>关联英雄单位 · {relatedUnit.name} →</Link>}
          <blockquote>{hero.hype}</blockquote>
        </div>
        <div className="hero-attributes">
          {attributeStats.map(([short, label, values]) => <div key={label}><span className={`mini-attr attr-${label}`}>{short}</span><p><strong>{values[0]}</strong><small>+{values[1]}</small></p><em>{label}</em></div>)}
        </div>
      </header>

      <nav className="hero-section-nav" aria-label="英雄详情目录">
        <a href="#abilities">技能</a><a href="#upgrades">神杖 / 魔晶</a><a href="#talents">天赋树</a><a href="#history">版本历史</a><a href="#hero-model">模型资料</a>
      </nav>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section" id="abilities">
            <header><p className="eyebrow accent">Abilities & innate</p><h2>技能与先天能力</h2><p>点击技能目录或版本记录中的技能名称，可直接定位到当前技能详情。</p></header>
            <nav className="ability-index" aria-label="技能目录">{indexedAbilities.map((ability) => <AbilityChip ability={ability} key={ability.id} />)}</nav>
            {!!innateAbilities.length && <div className="ability-group"><div className="ability-group-heading"><span>Innate</span><h3>先天技能</h3></div>{innateAbilities.map((ability) => <AbilityCard ability={ability} key={ability.id} />)}</div>}
            <div className="ability-group"><div className="ability-group-heading"><span>Abilities</span><h3>英雄技能</h3></div>{regularAbilities.map((ability) => <AbilityCard ability={ability} key={ability.id} />)}</div>
          </section>

          <section className="detail-section" id="upgrades">
            <header><p className="eyebrow accent">Aghanim&apos;s upgrades</p><h2>神杖与魔晶升级</h2><p>升级说明来自 Valve 官方简体中文技能数据；点击技能名称可返回完整数值。</p></header>
            {upgrades.length ? <div className="upgrade-grid">{upgrades.map((upgrade) => (
              <article className={`upgrade-card is-${upgrade.className}`} key={`${upgrade.kind}-${upgrade.ability.id}`}>
                <div className="upgrade-kind"><span>{upgrade.kind.slice(0, 1)}</span><strong>阿哈利姆{upgrade.kind}升级</strong></div>
                <AbilityChip ability={upgrade.ability} />
                <p><GameText text={upgrade.text} /></p>
              </article>
            ))}</div> : <p className="section-empty">当前官方数据中没有单独的神杖或魔晶升级。</p>}
          </section>

          <section className="detail-section" id="talents">
            <header><p className="eyebrow accent">Talent tree</p><h2>天赋树</h2><p>按游戏内等级顺序展示。带技能图标的天赋可点击跳转到对应技能。</p></header>
            <div className="talent-tree">
              <div className="talent-tree-title"><span>◆</span><strong>天赋</strong><span>◆</span></div>
              {talentRows.map((row) => row.left && row.right && <div className="talent-row" key={row.level}><TalentCell talent={row.left} abilities={hero.abilities} /><b>{row.level}</b><TalentCell talent={row.right} abilities={hero.abilities} /></div>)}
              <div className="talent-tree-footer">30 级后可学习全部天赋</div>
            </div>
          </section>

          <section className="detail-section timeline-section" id="history">
            <header><p className="eyebrow accent">Version history</p><h2>英雄与技能改动时间线</h2><p>7.08 起以 Valve 官方简体中文正文为准，Liquipedia 补齐新增、重做、移除、旧版、新版与天赋结构；更早记录来自 Liquipedia，并保留英文原文供核对。</p></header>
            <div className="history-timeline">
              {hero.history.map((entry, index) => (
                <details className="history-entry" key={entry.version} open={index < 5}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>{entry.timestamp ? formatDate(entry.timestamp) : ''} · {entry.semanticOnly ? 'Liquipedia 结构记录' : 'Valve 官方中文'}</small></div><em>{entry.semanticOnly ? `${entry.semanticNotes?.length || 0} 项` : `${entry.notes.length + (entry.abilities?.reduce((sum, ability) => sum + ability.notes.length, 0) || 0)} 项`}</em></summary>
                  <div className="history-content">
                    {!!entry.notes.length && <ul>{entry.notes.map((note, noteIndex) => <ChangeNote note={note} abilities={hero.abilities} key={noteIndex} />)}</ul>}
                    {entry.abilities?.map((historyAbility) => {
                      const ability = abilitiesById.get(historyAbility.id);
                      return <div className="history-ability" key={historyAbility.id}>
                        {ability ? <AbilityChip ability={ability} /> : <h4>{historyAbility.name}</h4>}
                        <ul>{historyAbility.notes.map((note, noteIndex) => <ChangeNote note={note} key={noteIndex} />)}</ul>
                      </div>;
                    })}
                    {!!entry.semanticNotes?.length && (
                      <aside className="history-semantic">
                        <header><strong>历史结构补充</strong><small>Liquipedia · CC BY-SA 3.0</small></header>
                        <ul>{entry.semanticNotes.map((note, noteIndex) => (
                          <ChangeNote
                            note={note}
                            abilities={hero.abilities}
                            key={noteIndex}
                            extra={note.original && note.original !== note.text ? <details className="original-note"><summary>查看英文原文</summary><p>{note.original}</p></details> : undefined}
                          />
                        ))}</ul>
                      </aside>
                    )}
                  </div>
                </details>
              ))}
              {hero.legacyHistory.map((entry) => (
                <details className="history-entry legacy" key={`legacy-${entry.version}`}>
                  <summary><span>{entry.version}</span><div><strong>{entry.version} 版本</strong><small>Liquipedia 历史补充 · CC BY-SA 3.0</small></div><em>{entry.notes.length} 项</em></summary>
                  <div className="history-content"><ul>{entry.notes.map((note, index) => <ChangeNote note={note} abilities={hero.abilities} key={index} extra={<details className="original-note"><summary>查看英文原文</summary><p>{note.original}</p></details>} />)}</ul></div>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <section className="quick-stats">
            <header className="sidebar-panel-heading"><p className="eyebrow">详细属性</p><small>当前版本</small></header>
            <div className="stat-vitals">
              {vitalStats.map((stat) => <div className={`vital-stat is-${stat.tone}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.regen}</small></div>)}
            </div>
            <div className="stat-table">
              {statRows.map((stat) => <div className={`stat-row is-${stat.tone}${stat.groupStart ? ' group-start' : ''}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}
            </div>
          </section>
          <section className="model-card" id="hero-model">
            <header className="sidebar-panel-heading"><p className="eyebrow">英雄模型</p><small>模型资料</small></header>
            <dl>
              <div><dt>内部单位名</dt><dd>{hero.internalName}</dd></div>
              <div><dt>攻击前摇 / 后摇</dt><dd>{profile?.attackPoint ?? '—'} / {profile?.attackBackswing ?? '—'} 秒</dd></div>
              <div><dt>基础攻击速度</dt><dd>{profile?.baseAttackSpeed ?? '—'}</dd></div>
              <div><dt>碰撞体积</dt><dd>{profile?.collisionSize ?? '—'}</dd></div>
              <div><dt>边界半径</dt><dd>{profile?.boundRadius ?? '—'}</dd></div>
              <div><dt>首次发布</dt><dd>{profile?.releaseDate ?? '—'}</dd></div>
              {profile?.allstarsReleaseDate && <div><dt>Allstars</dt><dd>{profile.allstarsReleaseDate}{profile.dotaVersion ? `（${profile.dotaVersion}）` : ''}</dd></div>}
            </dl>
            {profile && <a href={profile.sourceUrl} target="_blank" rel="noreferrer">Liquipedia 资料页 ↗</a>}
            <small>模型元数据来自 Liquipedia；当前战斗数值以 Valve 官方中文 datafeed 为准。</small>
          </section>
          <section className="bio-card"><p className="eyebrow">英雄背景</p><p>{hero.bio}</p></section>
          <section className="provenance-card"><span className="status-dot" /><div><strong>当前资料</strong><small>Valve 官方中文 + Liquipedia 补充</small></div></section>
        </aside>
      </div>
    </article>
  );
}
