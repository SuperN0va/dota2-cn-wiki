(() => {
  'use strict';

  const content = document.querySelector('#content');
  const nav = document.querySelector('#main-nav');
  const searchPanel = document.querySelector('.search-panel');
  const searchInput = document.querySelector('#global-search');
  const searchResults = document.querySelector('#global-search-results');
  const cache = new Map();
  const state = { index: null, heroPage: 0, itemPage: 0, esports: null };
  const pageSize = 72;
  const attributeSlug = { 力量: 'strength', 敏捷: 'agility', 智力: 'intelligence', 全才: 'universal' };
  const attributeAsset = {
    力量: 'assets/attribute-strength.png', 敏捷: 'assets/attribute-agility.png',
    智力: 'assets/attribute-intelligence.png', 全才: 'assets/attribute-universal.png',
  };
  const identityLabels = { Player: '选手', Coach: '教练', Retired: '退役', Inactive: '休赛 / 非活跃' };
  const positionLabels = { 1: 'Carry · 1号位', 2: 'Solo Middle · 2号位', 3: 'Offlaner · 3号位', 4: 'Support · 4号位', 5: 'Support · 5号位' };
  const effectTypeLabels = { active: '主动', passive: '被动', use: '使用', toggle: '切换', upgrade: '升级', effect: '效果' };
  const valueLabels = {
    abilitycooldown: '冷却时间', abilitymanacost: '魔法消耗', abilitycastrange: '施法距离', abilitycastpoint: '施法前摇',
    duration: '持续时间', slow_duration: '减速持续时间', buff_duration: '增益持续时间', debuff_duration: '负面效果持续时间',
    bonus_damage: '攻击力', damage: '伤害', bonus_attack_speed: '攻击速度', attack_speed: '攻击速度',
    bonus_strength: '力量', bonus_str: '力量', bonus_agility: '敏捷', bonus_intellect: '智力', bonus_all_stats: '全属性',
    bonus_armor: '护甲', armor: '护甲', bonus_health: '生命值', bonus_mana: '魔法值', bonus_health_regen: '生命恢复', bonus_mana_regen: '魔法恢复',
    radius: '作用范围', aura_radius: '光环范围', cast_range_bonus: '施法距离加成', bonus_movement_speed: '移动速度',
    bonus_night_vision: '夜间视野', consumed_bonus: '吞噬后攻击速度', consumed_bonus_night_vision: '吞噬后夜间视野',
    bonus_attack_speed_pct: '基础攻击速度', bonus_spell_amp: '技能增强', bonus_spell_resist: '技能抗性', bonus_magic_resistance: '魔法抗性', bonus_magical_armor: '魔法抗性',
    blink_range: '闪烁距离', blink_damage_cooldown: '受伤禁用时间', maximum_distance: '最大距离', vision_radius: '视野范围',
    bonus_chance: '触发几率', bonus_chance_damage: '额外魔法伤害', proc_chance: '触发几率', crit_chance: '暴击几率', crit_multiplier: '暴击伤害',
    evasion: '闪避', bonus_evasion: '闪避', magic_resist: '魔法抗性', status_resistance: '状态抗性',
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function safeUrl(value) {
    const url = String(value || '');
    if (/^(?:assets|media)\/[a-zA-Z0-9_./%-]+$/.test(url)) return url;
    if (/^https:\/\//i.test(url)) return url;
    return '';
  }

  function image(url, alt, className = '') {
    const src = safeUrl(url);
    return src ? `<img${className ? ` class="${escapeHtml(className)}"` : ''} src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">` : '<span class="result-icon">?</span>';
  }

  function highlightNumbers(value) {
    return escapeHtml(value).replace(/(?<![A-Za-z])([+−-]?\d+(?:\.\d+)?(?:\s*[–—/]\s*[+−-]?\d+(?:\.\d+)?)*(?:%|秒|点|米|金币|次|级)?)/g, '<span class="number">$1</span>');
  }

  function formatValues(values, percentage = false) {
    if (!Array.isArray(values) || !values.length) return '—';
    const trimmed = [...values];
    while (trimmed.length > 1 && trimmed.at(-1) === trimmed.at(-2)) trimmed.pop();
    return trimmed.map((value) => `${Number.isInteger(value) ? value : Number(Number(value).toFixed(2))}${percentage ? '%' : ''}`).join(' / ');
  }

  function formatDate(timestamp) {
    const date = new Date(Number(timestamp) * 1000);
    if (Number.isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function paragraphs(value, className = '') {
    return String(value || '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
      .map((part) => `<p${className ? ` class="${className}"` : ''}>${highlightNumbers(part).replace(/\n/g, '<br>')}</p>`).join('');
  }

  async function getJson(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const request = fetch(`./${relative}`, { cache: 'no-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    });
    cache.set(relative, request);
    return request;
  }

  function parseRoute() {
    const raw = (location.hash || '#/home').slice(2);
    const [pathPart, queryPart = ''] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    return { segments: segments.length ? segments : ['home'], query: new URLSearchParams(queryPart) };
  }

  function setActiveNav(route) {
    const root = route === 'hero' ? 'heroes' : route === 'item' ? 'items' : route === 'patch' ? 'patches' : route;
    nav.querySelectorAll('a').forEach((link) => link.classList.toggle('is-active', link.dataset.route === root));
  }

  function pageHeading(eyebrow, title, description, stat = '') {
    return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${stat ? `<div class="heading-stat">${stat}</div>` : ''}</header>`;
  }

  function heroCard(hero) {
    const attribute = attributeSlug[hero.attribute] || 'universal';
    return `<a class="entity-card" href="#/hero/${encodeURIComponent(hero.slug)}">
      ${image(hero.image, `${hero.name}肖像`)}
      <span class="entity-card-copy"><small><i class="attribute-dot ${attribute}"></i>${escapeHtml(hero.attribute)} · ${escapeHtml(hero.nameEnglish)}</small><strong>${escapeHtml(hero.name)}</strong><span>${escapeHtml(hero.roles.join(' / '))} · ${hero.historyCount} 个版本节点</span></span><b>→</b>
    </a>`;
  }

  function itemCategory(item) {
    if (item.isEnhancement) return `附魔${item.enhancementTier ? ` · ${item.enhancementTier}级` : ''}`;
    if (item.neutralTier > 0) return `中立宝物 · ${item.neutralTier}级`;
    if (item.isRecipe) return '图纸';
    if (!item.isCurrent) return '历史物品';
    return '商店物品';
  }

  function itemCard(item) {
    return `<a class="entity-card is-item" href="#/item/${encodeURIComponent(item.slug)}">
      ${image(item.image, `${item.name}图标`)}
      <span class="entity-card-copy"><small>${escapeHtml(itemCategory(item))}</small><strong>${escapeHtml(item.name)}</strong><span>${item.cost > 0 ? `${item.cost} 金币` : '不可购买'} · ${item.historyCount} 次改动</span></span><b>→</b>
    </a>`;
  }

  function patchCard(patch) {
    return `<a class="patch-card" href="#/patch/${encodeURIComponent(patch.version)}"><strong>${escapeHtml(patch.name)}</strong><div><b>${formatDate(patch.timestamp)}</b><span>${patch.heroChanges} 位英雄 · ${patch.itemChanges + patch.neutralChanges} 件物品</span></div><span>→</span></a>`;
  }

  function homeView() {
    const { meta, heroes, items, patches, players, teams } = state.index;
    const latest = patches[0];
    const currentItems = items.filter((item) => item.isCurrent && !item.isRecipe && !item.isEnhancement).length;
    const cards = [
      ['Heroes', '英雄图鉴', `${heroes.length} 位英雄与特殊英雄单位`, '#/heroes', '英'],
      ['Items', '物品资料', `${currentItems} 件当前物品、配方与机制`, '#/items', '物'],
      ['Patches', '版本日志', `${patches.length} 个官方中文版本节点`, '#/patches', '版'],
      ['Players', '职业选手', `${players.length} 名选手、教练与退役选手`, '#/esports?tab=players', '选'],
      ['Teams', '职业战队', `${teams.length} 支战队与近期转会`, '#/esports?tab=teams', '队'],
    ];
    content.innerHTML = `<section class="home-hero"><div><p class="eyebrow">DOTA 2 中文资料库</p><h1>从当前数值，到每一次<span>版本变动</span>。</h1><p>集中检索 Valve 官方简体中文英雄、技能、物品和更新日志，并补充 Liquipedia 的历史、机制与职业资料。</p><div class="home-actions"><a class="button primary" href="#/heroes">浏览英雄</a><a class="button" href="#/items">查找物品</a></div></div><a class="latest-card" href="#/patch/${encodeURIComponent(latest.version)}"><small>当前收录的最新官方数据版本</small><strong>${escapeHtml(latest.name)}</strong><span>查看完整更新 →</span></a></section>
      <nav class="catalog-grid" aria-label="百科栏目">${cards.map(([label, title, detail, href, symbol]) => `<a class="catalog-card" data-symbol="${symbol}" href="${href}"><span>${label}</span><strong>${title}</strong><small>${detail}</small></a>`).join('')}</nav>
      <section class="home-section"><header class="section-title"><div><p class="eyebrow">Hero attributes</p><h2>按主属性查看英雄</h2></div><a href="#/heroes">全部英雄 →</a></header><div class="attribute-strip">${Object.keys(attributeAsset).map((attribute) => `<a href="#/heroes?attribute=${encodeURIComponent(attribute)}">${image(attributeAsset[attribute], `${attribute}属性图标`)}<span><strong>${attribute}</strong><small>${heroes.filter((hero) => hero.attribute === attribute).length} 位</small></span></a>`).join('')}</div></section>
      <section class="home-section"><header class="section-title"><div><p class="eyebrow">Recent updates</p><h2>最近版本</h2></div><a href="#/patches">完整日志 →</a></header><div class="patch-grid">${patches.slice(0, 6).map(patchCard).join('')}</div></section>
      <section class="license-note"><strong>数据状态</strong>　当前索引生成于 ${escapeHtml(new Date(meta.toyGeneratedAt).toLocaleString('zh-CN'))}，内容版本 ${escapeHtml(meta.latestPatch)}。${state.index.validation.passed ? '同步数据已通过结构校验。' : '同步数据校验状态需要复核。'}</section>`;
  }

  function heroesView(query) {
    const selected = query.get('attribute') || '全部';
    const q = (query.get('q') || '').trim().toLocaleLowerCase('zh-CN');
    const filtered = state.index.heroes.filter((hero) => (selected === '全部' || hero.attribute === selected)
      && (!q || `${hero.name} ${hero.nameEnglish} ${hero.roles.join(' ')}`.toLocaleLowerCase('zh-CN').includes(q)));
    const visible = filtered.slice(0, (state.heroPage + 1) * pageSize);
    content.innerHTML = `${pageHeading('Heroes', '英雄图鉴', '主属性、技能、天赋、神杖魔晶、机制与完整版本历史。', `<strong>${filtered.length}</strong>位`)}
      <div class="toolbar"><input id="hero-filter" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="搜索英雄中文名、英文名或定位"><div class="filter-chips">${['全部', '力量', '敏捷', '智力', '全才'].map((attribute) => `<button class="filter-chip${selected === attribute ? ' is-active' : ''}" data-attribute="${attribute}">${attribute}</button>`).join('')}</div></div>
      <p class="result-count">显示 ${visible.length} / ${filtered.length} 位英雄</p><div class="entity-grid">${visible.map(heroCard).join('')}</div>${visible.length < filtered.length ? '<button class="button load-more" type="button">继续显示</button>' : ''}`;
    const input = content.querySelector('#hero-filter');
    input.addEventListener('input', () => {
      const params = new URLSearchParams(query);
      if (input.value) params.set('q', input.value); else params.delete('q');
      location.hash = `#/heroes?${params}`;
    });
    content.querySelectorAll('[data-attribute]').forEach((button) => button.addEventListener('click', () => {
      const params = new URLSearchParams(query);
      if (button.dataset.attribute === '全部') params.delete('attribute'); else params.set('attribute', button.dataset.attribute);
      location.hash = `#/heroes?${params}`;
    }));
    content.querySelector('.load-more')?.addEventListener('click', () => { state.heroPage += 1; heroesView(query); });
  }

  function valueLabel(value) {
    const key = String(value.name || '').toLocaleLowerCase('en');
    if (valueLabels[key]) return valueLabels[key];
    if (value.label && value.label !== value.name && !/[A-Za-z_$]/.test(value.label)) return value.label.replace(/^\+/, '').trim();
    return '';
  }

  function abilityValues(ability) {
    const rows = [];
    if (ability.cooldown?.some(Boolean)) rows.push(['冷却', `${formatValues(ability.cooldown)} 秒`]);
    if (ability.manaCost?.some(Boolean)) rows.push(['魔耗', formatValues(ability.manaCost)]);
    if (ability.castRange?.some(Boolean)) rows.push(['施法距离', formatValues(ability.castRange)]);
    if (ability.damage?.some(Boolean)) rows.push(['伤害', formatValues(ability.damage)]);
    return rows.map(([label, value]) => `<span class="value-pill">${label}<b>${highlightNumbers(value)}</b></span>`).join('');
  }

  function mechanicBlock(block, open = false) {
    if (!block) return '';
    const groups = [['mechanics', '机制结算'], ['interactions', '相互作用'], ['misc', '补充规则']]
      .filter(([key]) => Array.isArray(block[key]) && block[key].length);
    if (!groups.length) return '';
    const count = groups.reduce((sum, [key]) => sum + block[key].length, 0);
    return `<details class="mechanic-block"${open ? ' open' : ''}><summary>机制与相互作用 · ${count} 条</summary>${groups.map(([key, title]) => `<section class="mechanic-group"><h4>${title}</h4><ol class="mechanic-list">${block[key].map((note) => {
      const reviewed = note.translationStatus === 'reviewed';
      const text = reviewed ? note.text : note.original;
      return `<li class="mechanic-note" data-indent="${Math.min(4, Math.max(1, Number(note.indent) || 1))}">${reviewed ? '' : '<small class="source-label">英文原文</small>'}${highlightNumbers(text)}</li>`;
    }).join('')}</ol></section>`).join('')}</details>`;
  }

  function abilityCard(ability, mechanic) {
    const icon = ability.isInnate && ability.useSharedInnateIcon !== false ? 'assets/innate-ability.png' : ability.image;
    const specials = (ability.specialValues || []).filter((value) => value.label && !/^\w+_\w+/.test(value.label));
    return `<article class="ability-card${ability.isInnate ? ' is-innate' : ''}" id="ability-${ability.id}">${image(icon, `${ability.name}图标`, 'ability-icon')}<div class="ability-copy"><div><h3>${escapeHtml(ability.name)}</h3>${ability.isInnate ? '<span class="innate-label">先天技能</span>' : ''}</div>${paragraphs(ability.description)}<div class="value-row">${abilityValues(ability)}</div>
      ${specials.length ? `<details class="ability-values"><summary>查看完整技能数值</summary><dl>${specials.map((value) => `<div><dt>${escapeHtml(value.label)}</dt><dd>${highlightNumbers(formatValues(value.values, value.isPercentage))}</dd></div>`).join('')}</dl></details>` : ''}
      ${ability.scepter ? `<p class="upgrade-note"><b>神杖</b>${highlightNumbers(ability.scepter)}</p>` : ''}${ability.shard ? `<p class="upgrade-note"><b>魔晶</b>${highlightNumbers(ability.shard)}</p>` : ''}
      ${(ability.notes || []).length ? `<ul class="ability-notes">${ability.notes.map((note) => `<li>${highlightNumbers(note)}</li>`).join('')}</ul>` : ''}${mechanicBlock(mechanic)}${ability.lore ? `<small class="ability-lore">${escapeHtml(ability.lore)}</small>` : ''}</div></article>`;
  }

  function talentName(talent) {
    const values = new Map((talent.specialValues || []).map((value) => [value.name, value.values?.[0]]));
    return String(talent.name || '').replace(/\{s:([^}]+)\}/g, (_, key) => String(values.get(key) ?? '？'));
  }

  function talentTree(hero) {
    const rows = [3, 2, 1, 0].map((index) => ({ level: [10, 15, 20, 25][index], left: hero.talents[index * 2 + 1], right: hero.talents[index * 2] }));
    const cell = (talent) => {
      const name = talentName(talent);
      const ability = hero.abilities.find((entry) => entry.name.length > 1 && name.includes(entry.name));
      const icon = ability ? (ability.isInnate && ability.useSharedInnateIcon !== false ? 'assets/innate-ability.png' : ability.image) : talent.image;
      return `<div class="talent-cell">${icon ? image(icon, '') : ''}<span>${highlightNumbers(name)}</span></div>`;
    };
    return `<div class="talent-tree"><div class="talent-title">◆　天赋　◆</div>${rows.filter((row) => row.left && row.right).map((row) => `<div class="talent-row">${cell(row.left)}<b>${row.level}</b>${cell(row.right)}</div>`).join('')}<div class="talent-footer">30 级后可学习全部天赋</div></div>`;
  }

  function changeList(notes, sourceOnly = false) {
    return `<ul class="change-list">${(notes || []).filter((note) => String(note.text || note.original || '').trim()).map((note) => {
      const text = sourceOnly ? (note.original || note.text) : note.text;
      return `<li style="margin-left:${Math.max(0, (Number(note.indent) || 1) - 1) * 16}px">${sourceOnly ? '<small class="source-label">英文原文</small>' : ''}${highlightNumbers(text)}</li>`;
    }).join('')}</ul>`;
  }

  function historyTimeline(history, legacy, abilities = []) {
    const byId = new Map(abilities.map((ability) => [ability.id, ability]));
    const current = (history || []).map((entry, index) => `<details class="history-entry"${index < 3 ? ' open' : ''}><summary><strong>${escapeHtml(entry.version)}</strong><small>${entry.timestamp ? `${formatDate(entry.timestamp)} · ` : ''}${entry.semanticOnly ? 'Liquipedia 结构记录' : 'Valve 官方中文'}</small><b>${(entry.notes?.length || 0) + (entry.abilities || []).reduce((sum, ability) => sum + (ability.notes?.length || 0), 0)} 项</b></summary><div class="history-body">${changeList(entry.notes)}${(entry.abilities || []).map((ability) => `<section class="history-ability"><strong>${escapeHtml(byId.get(ability.id)?.name || ability.name || `技能 #${ability.id}`)}</strong>${changeList(ability.notes)}</section>`).join('')}${entry.semanticNotes?.length ? `<section class="history-ability"><strong>历史结构补充</strong>${changeList(entry.semanticNotes, true)}</section>` : ''}</div></details>`).join('');
    const older = (legacy || []).map((entry) => `<details class="history-entry"><summary><strong>${escapeHtml(entry.version)}</strong><small>Liquipedia 历史补充 · CC BY-SA 3.0</small><b>${entry.notes.length} 项</b></summary><div class="history-body">${changeList(entry.notes, true)}</div></details>`).join('');
    return `<div class="timeline">${current}${older}</div>`;
  }

  function statValue(value, suffix = '') {
    if (Array.isArray(value)) return value.join(' + ');
    if (typeof value === 'number') return `${Number(value.toFixed(2))}${suffix}`;
    return value ? `${value}${suffix}` : '—';
  }

  async function heroDetail(slug, query) {
    const hero = await getJson(`data/heroes/${encodeURIComponent(slug).replace(/%/g, '_')}.json`);
    const mechanics = hero.mechanics || {};
    const mechanicFor = (ability) => mechanics.abilities?.[ability.slug]
      || Object.values(mechanics.abilities || {}).find((block) => block.name === ability.name || block.nameEnglish === ability.name);
    const innate = hero.abilities.filter((ability) => ability.isInnate);
    const regular = hero.abilities.filter((ability) => !ability.isInnate);
    const profile = hero.liquipediaProfile;
    const stats = [
      ['生命值', hero.stats.health], ['生命恢复', `${statValue(hero.stats.healthRegen)}/秒`], ['魔法值', hero.stats.mana], ['魔法恢复', `${statValue(hero.stats.manaRegen)}/秒`],
      ['攻击力', (hero.stats.damage || []).join(' – ')], ['护甲', hero.stats.armor], ['魔法抗性', `${hero.stats.magicResistance}%`], ['攻击类型', hero.stats.attackCapability],
      ['攻击距离', hero.stats.attackRange], ['基础攻击间隔', `${hero.stats.attackRate} 秒`], ['移动速度', hero.stats.movementSpeed], ['昼 / 夜视野', `${hero.stats.sightRangeDay} / ${hero.stats.sightRangeNight}`],
    ];
    content.innerHTML = `<nav class="breadcrumbs"><a href="#/heroes">英雄</a><span>/</span><strong>${escapeHtml(hero.name)}</strong></nav><header class="detail-hero"><div class="detail-art">${image(hero.image, `${hero.name}肖像`)}${image(attributeAsset[hero.primaryAttribute], `${hero.primaryAttribute}属性`, 'attribute-emblem')}</div><div class="detail-copy"><p class="eyebrow">${hero.isSpecialUnit ? 'Special hero unit' : 'Hero'}</p><span class="english-name">${escapeHtml(hero.nameEnglish)}</span><h1>${escapeHtml(hero.name)}</h1><div class="tag-row"><span class="tag">${escapeHtml(hero.primaryAttribute)}</span>${hero.roles.map((role) => `<span class="tag">${escapeHtml(role.name)} · ${role.level}</span>`).join('')}</div>${paragraphs(hero.hype, 'lead')}</div></header>
      <div class="detail-layout"><div><section class="detail-section"><header><p class="eyebrow">Current stats</p><h2>当前属性</h2></header><div class="hero-vitals">${[['力量', hero.stats.strength], ['敏捷', hero.stats.agility], ['智力', hero.stats.intelligence]].map(([label, values]) => `<div>${image(attributeAsset[label], `${label}属性`)}<strong>${highlightNumbers(values.join(' + '))}</strong><small>${label}</small></div>`).join('')}</div><div class="stat-list">${stats.map(([label, value]) => `<div><span>${label}</span><strong>${highlightNumbers(statValue(value))}</strong></div>`).join('')}</div></section>
      <section class="detail-section" id="abilities"><header><p class="eyebrow">Abilities & innate</p><h2>技能与先天能力</h2><p>先天技能置于普通技能之前；不确定的机制翻译直接保留可核对的英文原文。</p></header>${innate.length ? `<div class="ability-group-title"><span>Innate</span><h3>先天技能</h3></div>${innate.map((ability) => abilityCard(ability, mechanicFor(ability))).join('')}` : ''}<div class="ability-group-title"><span>Abilities</span><h3>英雄技能</h3></div>${regular.map((ability) => abilityCard(ability, mechanicFor(ability))).join('')}</section>
      ${mechanics.pageMechanics?.length ? `<section class="detail-section"><header><p class="eyebrow">Rules</p><h2>英雄机制总览</h2></header>${mechanics.pageMechanics.map((block) => `<h3>${escapeHtml(block.name || block.nameEnglish || hero.name)}</h3>${mechanicBlock(block, true)}`).join('')}</section>` : ''}
      <section class="detail-section"><header><p class="eyebrow">Talent tree</p><h2>天赋树</h2></header>${talentTree(hero)}</section>
      <section class="detail-section"><header><p class="eyebrow">Version history</p><h2>英雄与技能改动时间线</h2><p>7.08 起以 Valve 官方简体中文为主，更早记录保留 Liquipedia 英文原文。</p></header>${historyTimeline(hero.history, hero.legacyHistory, hero.abilities)}</section></div>
      <aside class="detail-sidebar"><section class="side-card"><h3>英雄模型</h3><dl><div><dt>基础攻击速度</dt><dd>${profile?.baseAttackSpeed ?? '—'}</dd></div><div><dt>攻击前摇 / 后摇</dt><dd>${profile?.attackPoint ?? '—'} / ${profile?.attackBackswing ?? '—'}</dd></div><div><dt>碰撞体积</dt><dd>${profile?.collisionSize ?? '—'}</dd></div><div><dt>边界半径</dt><dd>${profile?.boundRadius ?? '—'}</dd></div><div><dt>首次发布</dt><dd>${profile?.releaseDate ?? '—'}</dd></div></dl>${profile?.sourceUrl ? `<a class="source-link" href="${escapeHtml(safeUrl(profile.sourceUrl))}" target="_blank" rel="noreferrer">Liquipedia 资料页 ↗</a>` : ''}</section><section class="side-card"><h3>英雄背景</h3>${paragraphs(hero.bio)}</section>${hero.relatedHero ? `<section class="side-card"><h3>单位关系</h3><p>归属于 <a class="source-link" href="#/hero/${encodeURIComponent(hero.relatedHero.slug)}">${escapeHtml(hero.relatedHero.name)}</a><br>${escapeHtml(hero.relatedHero.relationship)}</p></section>` : ''}</aside></div>`;
    const ability = query.get('ability');
    if (ability) requestAnimationFrame(() => document.querySelector(`#ability-${CSS.escape(ability)}`)?.scrollIntoView());
  }

  function itemsView(query) {
    const selected = query.get('type') || '当前物品';
    const q = (query.get('q') || '').trim().toLocaleLowerCase('zh-CN');
    const matchesType = (item) => ({
      当前物品: item.isCurrent && !item.isRecipe && item.neutralTier < 1 && !item.isEnhancement,
      中立宝物: item.isCurrent && item.neutralTier > 0 && !item.isEnhancement,
      附魔: item.isEnhancement && Boolean(item.enhancementTier),
      图纸: item.isRecipe,
      历史物品: !item.isCurrent && !item.isRecipe,
      全部: true,
    })[selected];
    const filtered = state.index.items.filter((item) => matchesType(item) && item.hasChineseName
      && (!q || `${item.name} ${item.nameEnglish}`.toLocaleLowerCase('zh-CN').includes(q)));
    const visible = filtered.slice(0, (state.itemPage + 1) * pageSize);
    content.innerHTML = `${pageHeading('Items', '物品资料', '商店物品、中立宝物、附魔、图纸、配方、售价和底层机制。', `<strong>${filtered.length}</strong>条`)}<div class="toolbar"><input id="item-filter" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="搜索物品中文名或英文名"><div class="filter-chips">${['当前物品', '中立宝物', '附魔', '图纸', '历史物品', '全部'].map((type) => `<button class="filter-chip${selected === type ? ' is-active' : ''}" data-type="${type}">${type}</button>`).join('')}</div></div><p class="result-count">显示 ${visible.length} / ${filtered.length} 条物品记录</p><div class="entity-grid">${visible.map(itemCard).join('')}</div>${visible.length < filtered.length ? '<button class="button load-more" type="button">继续显示</button>' : ''}`;
    const input = content.querySelector('#item-filter');
    input.addEventListener('input', () => { const params = new URLSearchParams(query); if (input.value) params.set('q', input.value); else params.delete('q'); location.hash = `#/items?${params}`; });
    content.querySelectorAll('[data-type]').forEach((button) => button.addEventListener('click', () => { const params = new URLSearchParams(query); params.set('type', button.dataset.type); location.hash = `#/items?${params}`; }));
    content.querySelector('.load-more')?.addEventListener('click', () => { state.itemPage += 1; itemsView(query); });
  }

  function formatItemText(item, text) {
    const values = new Map((item.specialValues || []).map((value) => [String(value.name).toLocaleLowerCase('en'), formatValues(value.values)]));
    return String(text || '').replace(/%([A-Za-z0-9_]+)%/g, (token, name) => values.get(name.toLocaleLowerCase('en')) || token).replaceAll('%%', '%');
  }

  function itemEffects(item) {
    const parts = String(item.description || '').split(/\n+/).map((part) => part.trim()).filter(Boolean);
    const tagged = parts.map((part) => {
      const match = part.match(/^(主动|被动|使用|切换|开关|升级|Active|Passive|Use|Toggle|Upgrade)\s*[：:]\s*(.+)$/i);
      if (!match) return null;
      const normalized = { 主动: 'active', 被动: 'passive', 使用: 'use', 切换: 'toggle', 开关: 'toggle', 升级: 'upgrade', active: 'active', passive: 'passive', use: 'use', toggle: 'toggle', upgrade: 'upgrade' }[match[1].toLocaleLowerCase('en')] || 'effect';
      const rest = match[2];
      const titleMatch = rest.match(/^([^，。；:：]{1,20})\s+(.+)$/);
      return { type: normalized, title: titleMatch?.[1] || effectTypeLabels[normalized], description: titleMatch?.[2] || rest };
    }).filter(Boolean);
    if (tagged.length) return tagged;
    return (item.structure?.abilities || []).map((ability) => ({ type: String(ability.type || 'effect').toLocaleLowerCase('en'), title: ability.title, description: ability.description }));
  }

  async function itemDetail(slug) {
    const item = await getJson(`data/items/${encodeURIComponent(slug).replace(/%/g, '_')}.json`);
    const itemMap = new Map(state.index.items.map((entry) => [entry.slug, entry]));
    const components = (item.structure?.components || []).map((component) => itemMap.get(component)).filter(Boolean);
    const recipe = itemMap.get(`recipe_${item.slug}`);
    if (recipe?.cost > 0 && !components.some((component) => component.slug === recipe.slug)) components.push(recipe);
    const effects = itemEffects(item);
    const visibleValues = (item.specialValues || []).map((value) => [valueLabel(value), value]).filter(([label, value]) => label && value.values?.some((number) => number !== 0));
    const sellValue = item.mechanics?.sellValue;
    const titleDescription = formatItemText(item, item.description).split(/\n{2,}/).filter((paragraph) => !/^(主动|被动|使用|切换|开关|升级|Active|Passive|Use|Toggle|Upgrade)\s*[：:]/i.test(paragraph.trim())).join('\n\n');
    content.innerHTML = `<nav class="breadcrumbs"><a href="#/items">物品</a><span>/</span><strong>${escapeHtml(item.name)}</strong></nav><header class="detail-hero"><div class="detail-art item">${image(item.image, `${item.name}图标`)}</div><div class="detail-copy"><p class="eyebrow">${escapeHtml(itemCategory(item))}</p><span class="english-name">${escapeHtml(item.nameEnglish)}</span><h1>${escapeHtml(item.name)}</h1><div class="tag-row"><span class="tag">${item.isCurrent ? '当前可用' : '历史记录'}</span>${item.mechanics?.category ? `<span class="tag">${escapeHtml(item.mechanics.category)}</span>` : ''}</div>${paragraphs(titleDescription, 'lead')}</div><div class="detail-price"><small>${item.cost > 0 ? '当前价格' : '获取方式'}</small><strong>${item.cost > 0 ? item.cost : '—'}</strong><small>${item.cost > 0 ? '金币' : '不可购买'}</small>${sellValue != null ? `<span>售价 ${highlightNumbers(sellValue)} 金币</span>` : ''}</div></header>
      <div class="detail-layout"><div>${components.length || item.buildsInto?.length ? `<section class="detail-section"><header><p class="eyebrow">Recipe</p><h2>配方关系</h2></header>${components.length ? `<div class="recipe-tree"><strong>合成所需</strong><div class="recipe-parts">${components.map((component) => `<a class="recipe-node" href="#/item/${encodeURIComponent(component.slug)}">${image(component.image, component.name)}<span><b>${escapeHtml(component.name)}</b><small>${component.cost > 0 ? `${component.cost} 金币` : '不可购买'}</small></span></a>`).join('')}</div></div>` : ''}${item.buildsInto?.length ? `<div class="recipe-tree"><strong>还能合成</strong><div class="recipe-parts">${item.buildsInto.map((result) => `<a class="recipe-node" href="#/item/${encodeURIComponent(result.slug)}">${image(result.image, result.name)}<span><b>${escapeHtml(result.name)}</b><small>${result.cost > 0 ? `${result.cost} 金币` : '不可购买'}</small></span></a>`).join('')}</div></div>` : ''}</section>` : ''}
      <section class="detail-section"><header><p class="eyebrow">Effects</p><h2>物品效果与机制</h2><p>效果、属性和配方集中展示；涉及概率、距离、持续时间与数值的部分使用高亮。</p></header>${effects.length ? effects.map((effect) => `<article class="effect-card">${image(item.image, `${effect.title}图标`)}<div><h3><span>${escapeHtml(effectTypeLabels[effect.type] || effectTypeLabels.effect)}</span>${escapeHtml(effect.title)}</h3><p>${highlightNumbers(formatItemText(item, effect.description))}</p></div></article>`).join('') : paragraphs(formatItemText(item, item.description))}${visibleValues.length ? `<div class="stat-list">${visibleValues.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${highlightNumbers(formatValues(value.values, value.isPercentage))}</strong></div>`).join('')}</div>` : ''}${(item.notes || []).length ? `<ul class="ability-notes">${item.notes.map((note) => `<li>${highlightNumbers(formatItemText(item, note))}</li>`).join('')}</ul>` : ''}${item.mechanics?.abilities ? Object.values(item.mechanics.abilities).map((block) => mechanicBlock(block)).join('') : ''}${item.mechanics?.pageMechanics ? item.mechanics.pageMechanics.map((block) => mechanicBlock(block)).join('') : ''}</section>
      <section class="detail-section"><header><p class="eyebrow">Version history</p><h2>物品改动时间线</h2></header>${historyTimeline(item.history, item.legacyHistory)}</section></div><aside class="detail-sidebar"><section class="side-card"><h3>物品信息</h3><dl><div><dt>价格</dt><dd>${item.cost > 0 ? `${item.cost} 金币` : '不可购买'}</dd></div><div><dt>售价</dt><dd>${sellValue != null ? `${sellValue} 金币` : '—'}</dd></div><div><dt>可分享</dt><dd>${item.mechanics?.shareable ?? '—'}</dd></div><div><dt>可拆分</dt><dd>${item.mechanics?.disassemble ?? '—'}</dd></div><div><dt>可掉落</dt><dd>${item.mechanics?.droppable ?? '—'}</dd></div><div><dt>最大堆叠</dt><dd>${item.mechanics?.maxStack ?? '—'}</dd></div></dl></section>${item.lore ? `<section class="side-card"><h3>物品背景</h3>${paragraphs(item.lore)}</section>` : ''}${item.mechanics?.sourceUrl ? `<section class="side-card"><h3>机制资料</h3><p>Liquipedia 修订 #${escapeHtml(item.mechanics.revisionId)}</p><a class="source-link" href="${escapeHtml(safeUrl(item.mechanics.sourceUrl))}" target="_blank" rel="noreferrer">查看英文原页 ↗</a></section>` : ''}</aside></div>`;
  }

  function patchesView(query) {
    const q = (query.get('q') || '').trim().toLocaleLowerCase('en');
    const filtered = state.index.patches.filter((patch) => !q || patch.version.toLocaleLowerCase('en').includes(q));
    content.innerHTML = `${pageHeading('Patches', '版本日志', '7.08 起的 Valve 官方简体中文综合、物品、中立物品和英雄改动。', `<strong>${filtered.length}</strong>个版本`)}<div class="toolbar"><input id="patch-filter" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="搜索版本号，例如 7.41e"></div><div class="patch-grid">${filtered.map(patchCard).join('')}</div>`;
    const input = content.querySelector('#patch-filter');
    input.addEventListener('input', () => { const params = new URLSearchParams(query); if (input.value) params.set('q', input.value); else params.delete('q'); location.hash = `#/patches?${params}`; });
  }

  function patchEntityCard(entry, type, entity) {
    if (entry.isGeneralNote || (!entity && entry.id < 0)) {
      return `<article class="patch-entity is-general-note"><header><span class="section-badge">分组说明</span><strong>${escapeHtml(entry.title || '综合改动')}</strong></header>${changeList(entry.notes)}</article>`;
    }
    const name = entity?.name || entry.title || `${type === 'hero' ? '英雄' : '物品'} #${entry.id}`;
    const href = entity ? `#/${type}/${encodeURIComponent(entity.slug)}` : '';
    return `<article class="patch-entity${type === 'item' ? ' is-item' : ''}"><header>${entity ? image(entity.image, name) : ''}${href ? `<a href="${href}"><strong>${escapeHtml(name)}</strong></a>` : `<strong>${escapeHtml(name)}</strong>`}</header>${changeList(entry.notes)}${(entry.abilities || []).map((ability) => `<section class="history-ability"><strong>${escapeHtml(ability.name || `技能 #${ability.id}`)}</strong>${changeList(ability.notes)}</section>`).join('')}</article>`;
  }

  async function patchDetail(version) {
    const patch = await getJson(`data/patches/${encodeURIComponent(version).replace(/%/g, '_')}.json`);
    const heroes = new Map(state.index.heroes.map((entry) => [entry.id, entry]));
    const items = new Map(state.index.items.map((entry) => [entry.id, entry]));
    const heroEntries = patch.heroes.map((entry) => ({ ...entry, entity: heroes.get(entry.id) }));
    const itemEntries = patch.items.map((entry) => ({ ...entry, entity: items.get(entry.id) }));
    const neutralEntries = patch.neutralItems.map((entry) => ({ ...entry, entity: items.get(entry.id) }));
    content.innerHTML = `<nav class="breadcrumbs"><a href="#/patches">版本日志</a><span>/</span><strong>${escapeHtml(patch.name)}</strong></nav>${pageHeading('Official patch', `${patch.name} 版本`, `${formatDate(patch.timestamp)} · Valve 官方简体中文更新记录`, `<strong>${heroEntries.length}</strong>位英雄`)}
      ${patch.general.length ? `<section class="patch-section"><h2>综合改动</h2>${patch.general.map((section) => `<article class="patch-entity"><header><strong>${escapeHtml(section.title)}</strong></header>${changeList(section.notes)}</article>`).join('')}</section>` : ''}
      ${itemEntries.length ? `<section class="patch-section"><h2>物品改动</h2>${itemEntries.map((entry) => patchEntityCard(entry, 'item', entry.entity)).join('')}</section>` : ''}
      ${neutralEntries.length ? `<section class="patch-section"><h2>中立宝物与附魔</h2>${neutralEntries.map((entry) => patchEntityCard(entry, 'item', entry.entity)).join('')}</section>` : ''}
      ${heroEntries.length ? `<section class="patch-section"><h2>英雄改动</h2>${heroEntries.map((entry) => patchEntityCard(entry, 'hero', entry.entity)).join('')}</section>` : ''}`;
  }

  async function esportsView(query) {
    if (!state.esports) state.esports = await getJson('data/esports.json');
    const tab = query.get('tab') || 'players';
    const q = (query.get('q') || '').trim().toLocaleLowerCase('en');
    const tabs = [['players', '选手'], ['teams', '战队'], ['transfers', '转会']];
    let body = '';
    if (tab === 'players') {
      const players = state.esports.players.filter((player) => !q || `${player.name} ${player.realName} ${player.teamName} ${player.country}`.toLocaleLowerCase('en').includes(q));
      body = `<p class="result-count">${players.length} 名记录</p><div class="esports-grid">${players.map((player) => `<article class="player-card" id="player-${escapeHtml(player.slug)}"><header>${image(player.flag, `${player.country}国旗`, 'flag')}<span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.realName || player.country)}</small></span>${image(player.teamLogo, player.teamName, 'team-logo')}</header><div class="player-facts"><span>身份<b>${escapeHtml(identityLabels[player.identity] || player.identity)}</b></span><span>位置<b>${escapeHtml(positionLabels[player.position] || '待确认')}</b></span><span>TI 参赛<b>${Number(player.tiAppearances) || 0} 次</b></span><span>当前战队<b>${escapeHtml(player.teamName || '暂无公开归属')}</b></span></div></article>`).join('')}</div>`;
    } else if (tab === 'teams') {
      const teams = state.esports.teams.filter((team) => !q || `${team.name} ${team.region} ${team.subregion}`.toLocaleLowerCase('en').includes(q));
      const players = new Map(state.esports.players.map((player) => [player.slug, player]));
      body = `<p class="result-count">${teams.length} 支战队</p><div class="esports-grid">${teams.map((team) => `<article class="team-card"><header>${image(team.logo, `${team.name} Logo`)}<span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.subregion || team.region || '赛区待确认')}</small></span></header><div class="roster">${team.roster.map((slug) => `<span>${escapeHtml(players.get(slug)?.name || slug)}</span>`).join('') || '<span>暂无当前阵容</span>'}</div></article>`).join('')}</div>`;
    } else {
      const transfers = state.esports.transfers.filter((transfer) => !q || JSON.stringify(transfer).toLocaleLowerCase('en').includes(q));
      body = `<p class="result-count">${transfers.length} 条近期流动</p><div class="esports-grid">${transfers.map((transfer) => `<article class="transfer-card"><time>${escapeHtml(transfer.date || '日期待确认')}</time><div><p><strong>${transfer.players.map((player) => escapeHtml(player.name)).join('、')}</strong></p><small>${transfer.from.map((team) => escapeHtml(team.name)).join('、') || transfer.fromStatus.join('、') || '无公开前战队'} → ${transfer.to.map((team) => escapeHtml(team.name)).join('、') || transfer.toStatus.join('、') || '无公开新战队'}</small></div></article>`).join('')}</div>`;
    }
    content.innerHTML = `${pageHeading('Esports', '职业生态', '选手与战队名称保持原文；国籍、位置、TI 参赛次数和近期转会来自 Liquipedia。')}<div class="toolbar"><input id="esports-filter" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="搜索选手、战队、国籍或转会"><div class="esports-tabs">${tabs.map(([value, label]) => `<a class="filter-chip${tab === value ? ' is-active' : ''}" href="#/esports?tab=${value}">${label}</a>`).join('')}</div></div>${body}`;
    const input = content.querySelector('#esports-filter');
    input.addEventListener('input', () => { const params = new URLSearchParams(query); params.set('tab', tab); if (input.value) params.set('q', input.value); else params.delete('q'); location.hash = `#/esports?${params}`; });
  }

  function sourcesView() {
    content.innerHTML = `${pageHeading('Sources & licensing', '来源与许可', '区分官方当前数据、官方中文公告、历史机制补充与逐文件媒体许可。')}<div class="source-grid">${state.index.sources.map((source) => `<article class="source-card"><p class="eyebrow">${escapeHtml(source.language)}</p><h2>${escapeHtml(source.name)}</h2><p>${escapeHtml(source.license)}</p><a href="${escapeHtml(safeUrl(source.url))}" target="_blank" rel="noreferrer">查看原始来源 ↗</a></article>`).join('')}</div><section class="license-note"><h2>项目性质</h2><p>本站是非官方、非商业的中文玩家资料库，不代表 Valve、完美世界或 Liquipedia。Valve 官方游戏资料与媒体资源的权利归其权利人所有；Liquipedia 衍生文字按 CC BY-SA 3.0 标注共享，媒体文件的许可应以各原始文件页为准。</p><p>机制翻译只有在人工核对后才展示中文；未完成核对的记录直接展示英文原文，避免产生难以理解或可能误导玩家的机翻术语。</p></section>`;
  }

  function searchEntries(query) {
    const q = query.trim().toLocaleLowerCase('zh-CN');
    if (!q) return [];
    const entries = [
      ...state.index.heroes.map((hero) => ({ kind: '英雄', title: hero.name, subtitle: hero.nameEnglish, href: `#/hero/${hero.slug}`, image: hero.image })),
      ...state.index.abilities.map((ability) => ({ kind: '技能', title: ability.name, subtitle: ability.heroName, href: `#/hero/${ability.heroSlug}?ability=${ability.id}`, image: ability.image })),
      ...state.index.items.filter((item) => item.hasChineseName).map((item) => ({ kind: itemCategory(item), title: item.name, subtitle: item.nameEnglish, href: `#/item/${item.slug}`, image: item.image })),
      ...state.index.patches.map((patch) => ({ kind: '版本', title: patch.name, subtitle: `${patch.heroChanges} 位英雄 · ${patch.itemChanges + patch.neutralChanges} 件物品`, href: `#/patch/${patch.version}` })),
      ...state.index.players.map((player) => ({ kind: '选手', title: player.name, subtitle: player.teamName || player.country, href: `#/esports?tab=players&q=${encodeURIComponent(player.name)}`, image: player.flag })),
      ...state.index.teams.map((team) => ({ kind: '战队', title: team.name, subtitle: team.subregion || team.region, href: `#/esports?tab=teams&q=${encodeURIComponent(team.name)}`, image: team.logo })),
    ];
    return entries.filter((entry) => `${entry.title} ${entry.subtitle}`.toLocaleLowerCase('zh-CN').includes(q)).slice(0, 36);
  }

  function renderSearch() {
    const entries = searchEntries(searchInput.value);
    searchResults.innerHTML = searchInput.value.trim() ? (entries.length ? entries.map((entry) => `<a class="search-result" href="${escapeHtml(entry.href)}">${entry.image ? image(entry.image, '') : `<span class="result-icon">${escapeHtml(entry.kind.slice(0, 1))}</span>`}<span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.kind)} · ${escapeHtml(entry.subtitle || '')}</small></span></a>`).join('') : '<p class="search-empty">没有找到匹配的资料。</p>') : '<p class="search-empty">输入中文名、英文名、技能名或版本号。</p>';
  }

  function closeSearch() {
    searchPanel.classList.remove('is-open');
    searchPanel.setAttribute('aria-hidden', 'true');
  }

  async function renderRoute() {
    if (!state.index) return;
    const { segments, query } = parseRoute();
    const [route, slug] = segments;
    setActiveNav(route);
    closeSearch();
    nav.classList.remove('is-open');
    document.querySelector('.mobile-nav-toggle').setAttribute('aria-expanded', 'false');
    content.innerHTML = '<section class="loading-view"><span class="loading-rune"></span><strong>正在读取资料</strong></section>';
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      if (route === 'home') homeView();
      else if (route === 'heroes') heroesView(query);
      else if (route === 'hero' && slug) await heroDetail(slug, query);
      else if (route === 'items') itemsView(query);
      else if (route === 'item' && slug) await itemDetail(slug);
      else if (route === 'patches') patchesView(query);
      else if (route === 'patch' && slug) await patchDetail(slug);
      else if (route === 'esports') await esportsView(query);
      else if (route === 'sources') sourcesView();
      else throw new Error('页面不存在');
      document.title = `${content.querySelector('h1')?.textContent || 'DOTA 2 FanWiki'}｜DOTA 2 中文百科`;
    } catch (error) {
      console.error(error);
      content.innerHTML = `<section class="error-view"><p class="eyebrow">Load error</p><h1>资料读取失败</h1><p>${escapeHtml(error.message)}</p><a class="button" href="#/home">返回首页</a></section>`;
    }
  }

  document.querySelector('.search-toggle').addEventListener('click', () => {
    const open = !searchPanel.classList.contains('is-open');
    searchPanel.classList.toggle('is-open', open);
    searchPanel.setAttribute('aria-hidden', String(!open));
    if (open) { searchInput.focus(); renderSearch(); }
  });
  document.querySelector('.search-close').addEventListener('click', closeSearch);
  searchInput.addEventListener('input', renderSearch);
  searchResults.addEventListener('click', (event) => { if (event.target.closest('a')) closeSearch(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSearch(); if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en') === 'k') { event.preventDefault(); document.querySelector('.search-toggle').click(); } });
  document.querySelector('.mobile-nav-toggle').addEventListener('click', (event) => { const open = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', open); event.currentTarget.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) event.target.classList.add('is-broken'); }, true);
  window.addEventListener('hashchange', renderRoute);

  getJson('data/index.json').then((index) => {
    state.index = index;
    const logo = document.querySelector('#brand-logo');
    if (index.logo) { logo.src = index.logo; logo.hidden = false; logo.nextElementSibling.hidden = true; }
    if (!location.hash) location.replace('#/home');
    else renderRoute();
  }).catch((error) => {
    console.error(error);
    content.innerHTML = `<section class="error-view"><p class="eyebrow">Initialization error</p><h1>百科数据无法载入</h1><p>${escapeHtml(error.message)}</p><p>请确认上传包中的 index.html、app.js、styles.css 与 data 目录位于同一级。</p></section>`;
  });
})();
