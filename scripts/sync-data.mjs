import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildItemStructures } from './item-structures.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const LANGUAGE = 'schinese';
const VALVE = 'https://www.dota2.com/datafeed';
const LIQUIPEDIA_API = 'https://liquipedia.net/dota2/api.php';
const LIQUIPEDIA_UA = 'MidianDotaKB/1.0 (https://openai.com/contact/; community knowledge project)';
const DATA_SCHEMA_VERSION = 8;
const LEGACY_PARSER_VERSION = 5;
const includeLiquipedia = !process.argv.includes('--no-liquipedia');
const force = process.argv.includes('--force');

await mkdir(DATA_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

async function fetchJson(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, br', ...options.headers },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(600 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function mapPool(values, concurrency, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeNote(note) {
  return { text: stripHtml(note.note), indent: Number(note.indent_level || 1), icon: note.icon || null };
}

function formatInlineValues(values = []) {
  const compact = [...values];
  while (compact.length > 1 && compact.at(-1) === compact.at(-2)) compact.pop();
  return compact.map((value) => Number.isInteger(value) ? value : Number(value.toFixed(2))).join('/');
}

function interpolateAbilityText(text, ability, context = 'base') {
  const values = new Map();
  for (const value of ability.special_values || []) {
    const contextual = context === 'scepter' ? value.values_scepter : context === 'shard' ? value.values_shard : [];
    const selected = contextual?.length ? contextual : value.values_float || [];
    const formatted = formatInlineValues(selected);
    if (formatted) values.set(value.name.toLowerCase(), formatted);
    if (context !== 'base' && contextual?.length) values.set(`bonus_${value.name}`.toLowerCase(), formatInlineValues(contextual));
  }
  const topLevelValues = {
    abilityduration: ability.durations,
    abilitychanneltime: ability.channel_times,
    abilitycastpoint: ability.cast_points,
    abilitycastrange: ability.cast_ranges,
    abilitycooldown: ability.cooldowns,
  };
  for (const [key, rawValues] of Object.entries(topLevelValues)) {
    if (!values.has(key) && rawValues?.length) values.set(key, formatInlineValues(rawValues));
  }
  const aliases = {
    castpoint_tooltip: 'abilitycastpoint',
    base_magic_resistance: 'bear_magic_resistance',
  };
  for (const [alias, source] of Object.entries(aliases)) {
    if (!values.has(alias) && values.has(source)) values.set(alias, values.get(source));
  }
  return String(text || '')
    .replace(/%([A-Za-z][A-Za-z0-9_]*)%/g, (placeholder, key) => values.get(key.toLowerCase()) || placeholder)
    .replace(/%[A-Za-z][A-Za-z0-9_]*%%%/g, '游戏内动态值')
    .replace(/%[A-Za-z][A-Za-z0-9_]*%/g, '游戏内动态值')
    .replace(/%%/g, '%');
}

function normalizeAbility(ability) {
  return {
    id: ability.id,
    slug: ability.name,
    name: ability.name_loc || ability.name,
    description: stripHtml(interpolateAbilityText(ability.desc_loc, ability)),
    lore: stripHtml(ability.lore_loc),
    notes: (ability.notes_loc || []).map((note) => stripHtml(interpolateAbilityText(note, ability))).filter(Boolean),
    scepter: stripHtml(interpolateAbilityText(ability.scepter_loc, ability, 'scepter')),
    shard: stripHtml(interpolateAbilityText(ability.shard_loc, ability, 'shard')),
    isInnate: Boolean(ability.ability_is_innate),
    type: ability.type,
    castRange: ability.cast_ranges || [],
    cooldown: ability.cooldowns || [],
    manaCost: ability.mana_costs || [],
    damage: ability.damages || [],
    specialValues: (ability.special_values || [])
      .filter((value) => value.heading_loc || value.values_float?.some((n) => n !== 0) || value.values_shard?.some((n) => n !== 0) || value.values_scepter?.some((n) => n !== 0))
      .map((value) => ({
        name: value.name,
        label: stripHtml(value.heading_loc) || value.name,
        values: value.values_float || [],
        isPercentage: Boolean(value.is_percentage),
        shard: value.values_shard || [],
        scepter: value.values_scepter || [],
      })),
    image: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${ability.name}.png`,
  };
}

function resolveTalentNames(hero) {
  const bonusValues = new Map();
  const bonusValuesByTalent = new Map();
  for (const ability of [...(hero.abilities || []), ...(hero.facet_abilities || [])]) {
    for (const value of ability.special_values || []) {
      for (const bonus of value.bonuses || []) {
        bonusValues.set(`${bonus.name}:bonus_${value.name}`, bonus.value);
        const values = bonusValuesByTalent.get(bonus.name) || new Set();
        values.add(bonus.value);
        bonusValuesByTalent.set(bonus.name, values);
      }
    }
  }

  return (hero.talents || []).map((talent) => {
    const ownValues = new Map((talent.special_values || []).map((value) => [value.name, value.values_float?.[0]]));
    return {
      ...talent,
      name_loc: String(talent.name_loc || talent.name).replace(/\{s:([^}]+)\}/g, (placeholder, key) => {
        if (ownValues.has(key)) return ownValues.get(key);
        const linkedValue = bonusValues.get(`${talent.name}:${key}`);
        if (linkedValue !== undefined) return linkedValue;
        const fallbackValues = bonusValuesByTalent.get(talent.name);
        return fallbackValues?.size === 1 ? [...fallbackValues][0] : placeholder;
      }),
    };
  });
}

const attributeNames = ['力量', '敏捷', '智力', '全才'];
const roleNames = ['核心', '辅助', '爆发', '控制', '打野', '耐久', '逃生', '推进', '先手'];

function normalizeHero(hero) {
  const slug = hero.name.replace('npc_dota_hero_', '');
  const resolvedHero = { ...hero, talents: resolveTalentNames(hero) };
  return {
    id: hero.id,
    slug,
    internalName: hero.name,
    name: hero.name_loc,
    nameEnglish: hero.name_english_loc || '',
    bio: stripHtml(hero.bio_loc),
    hype: stripHtml(hero.hype_loc),
    primaryAttribute: attributeNames[hero.primary_attr] || '未知',
    complexity: hero.complexity || 1,
    roles: (hero.role_levels || []).map((level, index) => ({ name: roleNames[index], level })).filter((role) => role.level > 0),
    stats: {
      strength: [hero.str_base, hero.str_gain], agility: [hero.agi_base, hero.agi_gain], intelligence: [hero.int_base, hero.int_gain],
      damage: [hero.damage_min, hero.damage_max], armor: hero.armor, movementSpeed: hero.movement_speed,
      attackRange: hero.attack_range, attackRate: hero.attack_rate, magicResistance: hero.magic_resistance,
      health: hero.max_health, healthRegen: hero.health_regen, mana: hero.max_mana, manaRegen: hero.mana_regen,
      projectileSpeed: hero.projectile_speed, turnRate: hero.turn_rate,
      sightRangeDay: hero.sight_range_day, sightRangeNight: hero.sight_range_night,
      attackCapability: hero.attack_capability === 1 ? '近战' : '远程',
    },
    abilities: (hero.abilities || []).map(normalizeAbility),
    talents: resolvedHero.talents.map(normalizeAbility),
    image: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    portrait: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    history: [],
    legacyHistory: [],
    liquipediaProfile: null,
  };
}

function normalizeItem(item, listItem) {
  const source = item || listItem;
  const slug = source.name.replace('item_', '');
  const isRecipe = source.name.includes('recipe_');
  const unsignedNeutralTier = item?.item_neutral_tier;
  const neutralTier = unsignedNeutralTier === 4294967295 ? -1 : (unsignedNeutralTier ?? listItem.neutral_item_tier ?? -1);
  return {
    id: source.id,
    slug,
    internalName: source.name,
    name: source.name_loc || listItem.name_loc || source.name,
    nameEnglish: listItem.name_english_loc || '',
    description: stripHtml(item?.desc_loc),
    lore: stripHtml(item?.lore_loc),
    notes: (item?.notes_loc || []).map(stripHtml).filter(Boolean),
    cost: item?.item_cost ?? 0,
    quality: item?.item_quality ?? 0,
    neutralTier,
    isRecipe,
    isCurrent: Boolean(item?.is_item ?? true),
    cooldown: item?.cooldowns || [],
    manaCost: item?.mana_costs || [],
    specialValues: (item?.special_values || []).map((value) => ({
      name: value.name, label: stripHtml(value.heading_loc) || value.name,
      values: value.values_float || [], isPercentage: Boolean(value.is_percentage),
    })),
    image: isRecipe ? '/assets/item-recipe.png' : `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${slug}.png`,
    history: [],
    legacyHistory: [],
  };
}

function normalizePatch(patch) {
  return {
    version: patch.patch_number,
    name: stripHtml(patch.patch_name || patch.patch_number),
    timestamp: patch.patch_timestamp,
    general: (patch.general_notes || []).map((section) => ({
      title: stripHtml(section.title) || '综合改动', notes: (section.generic || []).map(normalizeNote),
    })),
    items: (patch.items || []).map((entry) => ({
      id: entry.ability_id,
      notes: (entry.ability_notes || []).map(normalizeNote),
      ...(entry.title ? { title: stripHtml(entry.title) } : {}),
      ...(entry.is_general_note ? { isGeneralNote: true } : {}),
    })),
    neutralItems: (patch.neutral_items || []).map((entry) => ({
      id: entry.ability_id,
      notes: (entry.ability_notes || []).map(normalizeNote),
      ...(entry.title ? { title: stripHtml(entry.title) } : {}),
      ...(entry.is_general_note ? { isGeneralNote: true } : {}),
    })),
    heroes: (patch.heroes || []).map((entry) => ({
      id: entry.hero_id,
      notes: (entry.hero_notes || []).map(normalizeNote),
      abilities: (entry.abilities || []).map((ability) => ({ id: ability.ability_id, notes: (ability.ability_notes || []).map(normalizeNote) })),
    })),
  };
}

function cleanWikiTemplate(inner) {
  const parts = inner.split('|').map((part) => part.trim());
  const name = parts.shift()?.toLowerCase();
  const params = Object.fromEntries(parts.filter((part) => part.includes('=')).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const positional = parts.filter((part) => !part.includes('='));
  if (name === 'cf') {
    return ({
      added: '新增', created: '新增', removed: '移除', reworked: '重做', changed: '调整',
      old: '旧版', new: '新版', fixed: '修复', moved: '移动',
    })[positional[0]?.toLowerCase()] || positional.at(-1) || '';
  }
  return params.text || params.alt || positional.at(-1) || '';
}

function wikiToText(value) {
  let text = value
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/'''?/g, '');
  for (let pass = 0; pass < 10; pass += 1) {
    const next = text.replace(/\{\{([^{}]+)\}\}/g, (_, inner) => cleanWikiTemplate(inner));
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const termTranslations = [
  ['Aghanim’s Scepter', '阿哈利姆神杖'], ["Aghanim's Scepter", '阿哈利姆神杖'],
  ['Aghanim’s Shard', '阿哈利姆魔晶'], ["Aghanim's Shard", '阿哈利姆魔晶'],
  ['base strength', '基础力量'], ['base agility', '基础敏捷'], ['base intelligence', '基础智力'],
  ['strength gain', '力量成长'], ['agility gain', '敏捷成长'], ['intelligence gain', '智力成长'],
  ['attack damage', '攻击力'], ['attack speed', '攻击速度'], ['movement speed', '移动速度'],
  ['cast range', '施法距离'], ['mana cost', '魔法消耗'], ['cooldown', '冷却时间'],
  ['duration', '持续时间'], ['damage', '伤害'], ['radius', '作用范围'], ['armor', '护甲'],
  ['health regeneration', '生命恢复'], ['mana regeneration', '魔法恢复'],
];

function translateLegacy(text, nameMap) {
  let result = text;
  const replaceTerm = (value, english, chinese) => value.replace(
    new RegExp(`(?<![A-Za-z0-9_])${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'gi'),
    chinese,
  );
  for (const [english, chinese] of nameMap) result = replaceTerm(result, english, chinese);
  for (const [english, chinese] of termTranslations) result = replaceTerm(result, english, chinese);
  return result
    .replace(/^Increased (.+) from (.+) to (.+)\.?$/i, '将$1从$2提升至$3。')
    .replace(/^Reduced (.+) from (.+) to (.+)\.?$/i, '将$1从$2降低至$3。')
    .replace(/^Rescaled (.+) from (.+) to (.+)\.?$/i, '将$1从$2调整为$3。')
    .replace(/^Added (.+)\.?$/i, '新增$1。')
    .replace(/^Removed (.+)\.?$/i, '移除$1。')
    .replace(/^Reworked (.+)\.?$/i, '重做：$1。')
    .replace(/^Old (.+)\.?$/i, '旧版：$1。')
    .replace(/^New (.+)\.?$/i, '新版：$1。')
    .replace(/^Fixed (.+)\.?$/i, '修复：$1。')
    .replace(/^Now (.+)\.?$/i, '现在$1。')
    .replace(/^No longer (.+)\.?$/i, '不再$1。')
    .replace(/^Changed (.+)\.?$/i, '更改：$1。');
}

function extractTemplateBlocks(text, templateName) {
  const blocks = [];
  const pattern = new RegExp(`\\{\\{${templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 0;
    let end = -1;
    for (let index = match.index; index < text.length - 1; index += 1) {
      const pair = text.slice(index, index + 2);
      if (pair === '{{') {
        depth += 1;
        index += 1;
      } else if (pair === '}}') {
        depth -= 1;
        index += 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    blocks.push({ start: match.index, end, content: text.slice(match.index + match[0].length, end - 2) });
    pattern.lastIndex = end;
  }
  return blocks;
}

function collapseTemplateNewlines(value) {
  let depth = 0;
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === '{{') depth += 1;
    if (pair === '}}') depth = Math.max(0, depth - 1);
    result += value[index] === '\n' && depth > 0 ? ' ' : value[index];
  }
  return result;
}

function parseTalentChanges(blocks, nameMap) {
  const notes = [];
  const levels = { 1: 10, 2: 15, 3: 20, 4: 25 };
  for (const block of blocks) {
    for (const line of block.content.split('\n')) {
      const field = line.match(/^\|\s*t([1-4])([lr])\s*=\s*(.*?)\s*$/i);
      if (!field) continue;
      const [, tier, side, rawChange] = field;
      const parts = rawChange.split(';').map((part) => wikiToText(part)).filter((part) => part && part.toLowerCase() !== 'c');
      const prefix = `天赋（${levels[tier]}级${side.toLowerCase() === 'l' ? '左侧' : '右侧'}）`;
      notes.push({ indent: 1, original: `Talents: ${parts.join(' → ')}`, text: prefix });
      if (parts.length >= 2) {
        notes.push({ indent: 2, original: `Old: ${parts[0]}`, text: `旧版：${translateLegacy(parts[0], nameMap)}` });
        notes.push({ indent: 2, original: `New: ${parts[1]}`, text: `新版：${translateLegacy(parts[1], nameMap)}` });
      } else if (parts[0]) {
        notes.push({ indent: 2, original: parts[0], text: translateLegacy(parts[0], nameMap) });
      }
    }
  }
  return notes;
}

function historyVersionOrder(version) {
  const match = String(version).match(/^(\d+)\.(\d+)([a-z])?/i);
  if (!match) return null;
  return Number(match[1]) * 100000 + Number(match[2]) * 100 + (match[3] ? match[3].toLowerCase().charCodeAt(0) - 96 : 0);
}

function mergeHistoryEntries(source = []) {
  const merged = new Map();
  for (const entry of source) {
    const current = merged.get(entry.version) || { version: entry.version, notes: [] };
    const seen = new Set(current.notes.map((note) => `${note.indent}|${note.original}|${note.text}`));
    for (const note of entry.notes || []) {
      const key = `${note.indent}|${note.original}|${note.text}`;
      if (!seen.has(key)) {
        current.notes.push(note);
        seen.add(key);
      }
    }
    merged.set(entry.version, current);
  }
  return [...merged.values()].sort((left, right) => {
    const leftOrder = historyVersionOrder(left.version);
    const rightOrder = historyVersionOrder(right.version);
    return leftOrder === null || rightOrder === null ? 0 : rightOrder - leftOrder;
  });
}

function parseLegacyHistory(wikitext, nameMap) {
  const marker = '{{VersionTableElement|';
  const entries = [];
  const semanticEntries = [];
  let cursor = wikitext.indexOf(marker);
  while (cursor >= 0) {
    const next = wikitext.indexOf(marker, cursor + marker.length);
    const end = next >= 0 ? next : wikitext.indexOf('{{VersionTableEnd', cursor);
    const block = wikitext.slice(cursor + marker.length, end >= 0 ? end : undefined);
    const separator = block.indexOf('|');
    if (separator > 0) {
      const version = block.slice(0, separator).trim();
      const body = block.slice(separator + 1).replace(/\}\}\s*$/, '');
      const talentBlocks = extractTemplateBlocks(body, 'Tal change');
      const talentNotes = parseTalentChanges(talentBlocks, nameMap);
      let bodyWithoutTalents = '';
      let bodyCursor = 0;
      for (const talentBlock of talentBlocks) {
        bodyWithoutTalents += body.slice(bodyCursor, talentBlock.start);
        bodyCursor = talentBlock.end;
      }
      bodyWithoutTalents += body.slice(bodyCursor);
      const parsedLines = collapseTemplateNewlines(bodyWithoutTalents).split('\n')
        .filter((line) => /^\*+\s/.test(line))
        .map((line) => {
          const stars = line.match(/^\*+/)?.[0].length || 1;
          const original = wikiToText(line.replace(/^\*+\s*/, ''));
          const isSemantic = /\{\{cf\|\s*(?:Added|Created|Removed|Reworked|Changed|Old|New|Fixed|Moved)\b/i.test(line);
          return { indent: stars, original, text: translateLegacy(original, nameMap), isSemantic };
        })
        .filter((note) => note.original);
      const semanticNotes = [];
      let activeSemanticIndent = null;
      for (const note of parsedLines) {
        if (note.isSemantic) activeSemanticIndent = note.indent;
        else if (activeSemanticIndent !== null && note.indent <= activeSemanticIndent) activeSemanticIndent = null;
        if (note.isSemantic || activeSemanticIndent !== null) semanticNotes.push({ indent: note.indent, original: note.original, text: note.text });
      }
      semanticNotes.push(...talentNotes);
      if (semanticNotes.length) {
        const minIndent = Math.min(...semanticNotes.map((note) => note.indent));
        semanticEntries.push({ version, notes: semanticNotes.map((note) => ({ ...note, indent: note.indent - minIndent + 1 })) });
      }
      const numeric = version.match(/^(\d+)\.(\d+)/);
      const isBeforeOfficialArchive = !numeric || Number(numeric[1]) < 7 || (Number(numeric[1]) === 7 && Number(numeric[2]) < 8);
      if (isBeforeOfficialArchive) {
        const notes = [...parsedLines.map(({ indent, original, text }) => ({ indent, original, text })), ...talentNotes];
        if (notes.length) entries.push({ version, notes });
      }
    }
    cursor = next;
  }
  return { entries: mergeHistoryEntries(entries), semanticEntries: mergeHistoryEntries(semanticEntries) };
}

async function fetchLiquipediaHistories(targets) {
  const result = {};
  const batches = Array.from({ length: Math.ceil(targets.length / 20) }, (_, index) => targets.slice(index * 20, index * 20 + 20));
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const url = new URL(LIQUIPEDIA_API);
    const params = {
      action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main',
      titles: batch.map((target) => target.title).join('|'), redirects: '1', format: 'json', formatversion: '2',
    };
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetchJson(url, { headers: { 'User-Agent': LIQUIPEDIA_UA } });
    const redirects = new Map((response.query?.redirects || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const normalized = new Map((response.query?.normalized || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const pageMap = new Map((response.query?.pages || []).map((page) => [page.title.toLowerCase(), page]));
    for (const target of batch) {
      let resolved = normalized.get(target.title.toLowerCase()) || target.title.toLowerCase();
      resolved = redirects.get(resolved) || resolved;
      const page = pageMap.get(resolved);
      const revision = page?.revisions?.[0];
      if (!revision) continue;
      const parsedHistory = parseLegacyHistory(revision.slots?.main?.content || '', target.nameMap);
      result[target.key] = {
        sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        revisionId: revision.revid,
        updatedAt: revision.timestamp,
        ...parsedHistory,
      };
    }
    console.log(`Liquipedia 历史日志 ${index + 1}/${batches.length}`);
    if (index < batches.length - 1) await sleep(2100);
  }
  return result;
}

function parseLiquipediaHeroProfile(wikitext) {
  const block = wikitext.match(/\{\{Hero infobox([\s\S]*?)\n\}\}/i)?.[1];
  if (!block) return null;
  const fields = new Map();
  for (const line of block.split('\n')) {
    const match = line.match(/^\|\s*([^=]+?)\s*=\s*(.*?)\s*$/);
    if (match) fields.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  const number = (key) => {
    const value = Number.parseFloat(fields.get(key));
    return Number.isFinite(value) ? value : null;
  };
  const text = (key) => {
    const value = fields.get(key);
    return value ? wikiToText(value) : null;
  };
  const talentBlock = wikitext.match(/===Talents===([\s\S]*?)(?=\n==)/i)?.[1] || '';
  const talentFields = new Map();
  for (const line of talentBlock.split('\n')) {
    const match = line.match(/^\|\s*(v[1-4][lr])\s*=\s*(.*?)\s*$/i);
    if (match) talentFields.set(match[1].toLowerCase(), wikiToText(match[2]));
  }
  const talentValues = [1, 2, 3, 4].flatMap((level) => ['l', 'r'].map((side) => talentFields.get(`v${level}${side}`) || null));
  return {
    controlVersion: text('ctrlver'),
    baseAttackSpeed: number('atkspeed'),
    attackPoint: number('atkpoint'),
    attackBackswing: number('atkbacks'),
    collisionSize: number('collisionsize'),
    boundRadius: number('boundradius'),
    gibType: text('gibtype'),
    releaseDate: text('released'),
    allstarsReleaseDate: text('allstars'),
    dotaVersion: text('dotaver'),
    liquipediaHeroId: number('hid'),
    talentValues,
  };
}

async function fetchLiquipediaHeroProfiles(targets) {
  const result = {};
  const batches = Array.from({ length: Math.ceil(targets.length / 20) }, (_, index) => targets.slice(index * 20, index * 20 + 20));
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const url = new URL(LIQUIPEDIA_API);
    const params = {
      action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main',
      titles: batch.map((target) => target.title).join('|'), redirects: '1', format: 'json', formatversion: '2',
    };
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetchJson(url, { headers: { 'User-Agent': LIQUIPEDIA_UA } });
    const redirects = new Map((response.query?.redirects || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const normalized = new Map((response.query?.normalized || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const pageMap = new Map((response.query?.pages || []).map((page) => [page.title.toLowerCase(), page]));
    for (const target of batch) {
      let resolved = normalized.get(target.title.toLowerCase()) || target.title.toLowerCase();
      resolved = redirects.get(resolved) || resolved;
      const page = pageMap.get(resolved);
      const revision = page?.revisions?.[0];
      if (!revision) continue;
      const profile = parseLiquipediaHeroProfile(revision.slots?.main?.content || '');
      if (!profile) continue;
      result[target.key] = {
        ...profile,
        sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        revisionId: revision.revid,
        updatedAt: revision.timestamp,
      };
    }
    console.log(`Liquipedia 英雄资料 ${index + 1}/${batches.length}`);
    if (index < batches.length - 1) await sleep(2100);
  }
  return result;
}

async function fetchCnNews() {
  const articles = [];
  for (let page = 1; page <= 7; page += 1) {
    const url = `https://www.dota2.com.cn/news/gamepost/index${page}.htm`;
    const response = await fetch(url, { headers: { 'User-Agent': 'MidianDotaKB/1.0' } });
    if (!response.ok) continue;
    const html = await response.text();
    for (const match of html.matchAll(/href="(https:\/\/www\.dota2\.com\.cn\/article\/details\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = stripHtml(match[2]).replace(/\s+/g, ' ');
      if (!title || !/更新|版本|日志|补丁|平衡/i.test(title)) continue;
      articles.push({ title, url: match[1] });
    }
  }
  return [...new Map(articles.map((article) => [article.url, article])).values()];
}

console.log('读取 Valve 官方中文数据…');
const [heroListResponse, itemListResponse, patchListResponse] = await Promise.all([
  fetchJson(`${VALVE}/herolist?language=${LANGUAGE}`),
  fetchJson(`${VALVE}/itemlist?language=${LANGUAGE}`),
  fetchJson(`${VALVE}/patchnoteslist?language=${LANGUAGE}`),
]);
const itemStructures = await buildItemStructures();

const heroList = heroListResponse.result.data.heroes;
const itemList = itemListResponse.result.data.itemabilities;
const patchList = patchListResponse.patches;
const latestPatch = patchList.at(-1)?.patch_number;
const previousMeta = await readJson('meta.json');
const canReuseCurrent = !force && previousMeta?.latestPatch === latestPatch && previousMeta?.schemaVersion === DATA_SCHEMA_VERSION;

let heroes = canReuseCurrent ? await readJson('heroes.json') : null;
let items = canReuseCurrent ? await readJson('items.json') : null;

if (!heroes?.length) {
  console.log(`同步 ${heroList.length} 位英雄…`);
  const details = await mapPool(heroList, 10, async (hero, index) => {
    const data = await fetchJson(`${VALVE}/herodata?language=${LANGUAGE}&hero_id=${hero.id}`);
    if ((index + 1) % 20 === 0) console.log(`英雄 ${index + 1}/${heroList.length}`);
    return { ...data.result.data.heroes[0], name_english_loc: hero.name_english_loc };
  });
  heroes = details.map(normalizeHero);
}

if (!items?.length) {
  console.log(`同步 ${itemList.length} 条物品记录…`);
  const details = await mapPool(itemList, 12, async (item, index) => {
    try {
      const data = await fetchJson(`${VALVE}/itemdata?language=${LANGUAGE}&item_id=${item.id}`);
      if ((index + 1) % 60 === 0) console.log(`物品 ${index + 1}/${itemList.length}`);
      return data.result?.data?.items?.[0] || null;
    } catch {
      return null;
    }
  });
  items = details.map((item, index) => normalizeItem(item, itemList[index]));
}

const previousPatches = await readJson('patches.json', []);
const previousByVersion = new Map(previousPatches.map((patch) => [patch.version, patch]));
const missingPatches = force ? patchList : patchList.filter((patch) => !previousByVersion.has(patch.patch_number));
console.log(`同步 ${missingPatches.length} 个新增版本（总计 ${patchList.length}）…`);
const fetchedPatches = await mapPool(missingPatches, 6, async (patch, index) => {
  const data = await fetchJson(`${VALVE}/patchnotes?version=${encodeURIComponent(patch.patch_number)}&language=${LANGUAGE}`);
  if ((index + 1) % 20 === 0) console.log(`版本 ${index + 1}/${missingPatches.length}`);
  return normalizePatch(data);
});
for (const patch of fetchedPatches) previousByVersion.set(patch.version, patch);
let patches = patchList.map((entry) => previousByVersion.get(entry.patch_number)).filter(Boolean);
const headingRepairVersions = patches.filter((patch) => (
  [...patch.items, ...patch.neutralItems].some((entry) => entry.id < 0 && !entry.title)
)).map((patch) => patch.version);
if (headingRepairVersions.length) {
  console.log(`补全 ${headingRepairVersions.length} 个版本的物品分组标题…`);
  const repaired = await mapPool(headingRepairVersions, 6, async (version) => {
    const data = await fetchJson(`${VALVE}/patchnotes?version=${encodeURIComponent(version)}&language=${LANGUAGE}`);
    return normalizePatch(data);
  });
  const repairedByVersion = new Map(repaired.map((patch) => [patch.version, patch]));
  patches = patches.map((patch) => repairedByVersion.get(patch.version) || patch);
}

const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
const itemById = new Map(items.map((item) => [item.id, item]));
const abilityNames = new Map(heroes.flatMap((hero) => [...hero.abilities, ...hero.talents].map((ability) => [ability.id, ability.name])));

for (const hero of heroes) hero.history = [];
for (const item of items) item.history = [];
for (const patch of [...patches].reverse()) {
  for (const entry of patch.heroes) {
    const hero = heroById.get(entry.id);
    if (!hero) continue;
    const abilities = entry.abilities
      .filter((ability) => ability.ability_notes?.length || ability.notes?.length)
      .map((ability) => ({ ...ability, name: abilityNames.get(ability.id) || `技能 #${ability.id}` }));
    if (!entry.notes.length && !abilities.length) continue;
    hero.history.push({
      version: patch.version, timestamp: patch.timestamp, notes: entry.notes,
      abilities,
    });
  }
  for (const entry of [...patch.items, ...patch.neutralItems]) {
    const item = itemById.get(entry.id);
    if (item && entry.notes.length) item.history.push({ version: patch.version, timestamp: patch.timestamp, notes: entry.notes });
  }
}
for (const item of items) {
  const byVersion = new Map();
  for (const entry of item.history) {
    const current = byVersion.get(entry.version) || { ...entry, notes: [] };
    const seen = new Set(current.notes.map((note) => `${note.indent}|${note.text}`));
    for (const note of entry.notes) {
      const key = `${note.indent}|${note.text}`;
      if (!seen.has(key)) {
        current.notes.push(note);
        seen.add(key);
      }
    }
    byVersion.set(entry.version, current);
  }
  item.history = [...byVersion.values()].sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
}

let legacy = force ? {} : await readJson('legacy.json', {});
const previousLegacyMeta = legacy._meta || {};
for (const value of Object.values(legacy)) {
  if (Array.isArray(value?.entries)) value.entries = mergeHistoryEntries(value.entries);
  if (Array.isArray(value?.semanticEntries)) value.semanticEntries = mergeHistoryEntries(value.semanticEntries);
}
const heroHistoryTargets = heroes.map((hero) => ({
  key: `hero:${hero.id}`,
  title: `${hero.nameEnglish}/Changelogs`,
  nameMap: hero.abilities.map((ability) => {
    const heroPrefix = hero.internalName.replace(/^npc_dota_hero_/, '');
    const abilityPart = ability.slug.startsWith(`${heroPrefix}_`) ? ability.slug.slice(heroPrefix.length + 1) : ability.slug;
    return [abilityPart.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), ability.name];
  }),
}));
const itemHistoryTargets = items.filter((item) => !item.isRecipe && item.nameEnglish).map((item) => ({
  key: `item:${item.id}`, title: `${item.nameEnglish}/Changelogs`, nameMap: [[item.nameEnglish, item.name]],
}));
const heroHistoryCacheAge = Date.now() - new Date(previousLegacyMeta.fetchedAt || 0).getTime();
const itemHistoryCacheAge = Date.now() - new Date(previousLegacyMeta.itemFetchedAt || 0).getTime();
const shouldRefreshAllHistories = force
  || !Object.keys(legacy).some((key) => key.startsWith('hero:') || key.startsWith('item:'))
  || previousLegacyMeta.itemParserVersion !== LEGACY_PARSER_VERSION
  || itemHistoryCacheAge > 30 * 24 * 60 * 60 * 1000;
const shouldRefreshHeroHistories = previousLegacyMeta.parserVersion !== LEGACY_PARSER_VERSION
  || previousMeta?.latestPatch !== latestPatch
  || heroHistoryCacheAge > 7 * 24 * 60 * 60 * 1000
  || heroHistoryTargets.some((target) => !Array.isArray(legacy[target.key]?.semanticEntries));
let refreshedAllHistories = false;
let refreshedHeroHistories = false;
if (includeLiquipedia && shouldRefreshAllHistories) {
  console.log('按 Liquipedia API 规范同步完整历史日志…');
  legacy = await fetchLiquipediaHistories([...heroHistoryTargets, ...itemHistoryTargets]);
  refreshedAllHistories = true;
  refreshedHeroHistories = true;
} else if (includeLiquipedia && shouldRefreshHeroHistories) {
  console.log('按 Liquipedia API 规范补充英雄历史语义…');
  Object.assign(legacy, await fetchLiquipediaHistories(heroHistoryTargets));
  refreshedHeroHistories = true;
}
if (includeLiquipedia) {
  const refreshedAt = new Date().toISOString();
  legacy._meta = {
    parserVersion: LEGACY_PARSER_VERSION,
    itemParserVersion: LEGACY_PARSER_VERSION,
    fetchedAt: refreshedHeroHistories ? refreshedAt : previousLegacyMeta.fetchedAt,
    itemFetchedAt: refreshedAllHistories ? refreshedAt : (previousLegacyMeta.itemFetchedAt || refreshedAt),
  };
}

for (const hero of heroes) {
  const historySource = legacy[`hero:${hero.id}`];
  hero.legacyHistory = historySource?.entries || [];
  const semanticByVersion = new Map((historySource?.semanticEntries || []).map((entry) => [entry.version, entry.notes]));
  const officialVersions = new Set(hero.history.map((entry) => entry.version));
  for (const entry of hero.history) entry.semanticNotes = semanticByVersion.get(entry.version) || [];
  for (const [version, semanticNotes] of semanticByVersion) {
    const numeric = version.match(/^(\d+)\.(\d+)/);
    const isModern = numeric && (Number(numeric[1]) > 7 || (Number(numeric[1]) === 7 && Number(numeric[2]) >= 8));
    if (!isModern || officialVersions.has(version)) continue;
    const patch = patches.find((candidate) => candidate.version === version);
    if (!patch) continue;
    hero.history.push({ version, timestamp: patch.timestamp, notes: [], abilities: [], semanticNotes, semanticOnly: true });
  }
  hero.history.sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
}
for (const item of items) item.legacyHistory = legacy[`item:${item.id}`]?.entries || [];

let heroProfiles = force ? {} : await readJson('liquipedia-profiles.json', {});
const hasAllHeroProfiles = heroes.every((hero) => Array.isArray(heroProfiles[`hero:${hero.id}`]?.talentValues));
const profileCacheAge = Date.now() - new Date(heroProfiles._meta?.fetchedAt || 0).getTime();
const shouldRefreshHeroProfiles = !hasAllHeroProfiles || profileCacheAge > 7 * 24 * 60 * 60 * 1000 || previousMeta?.latestPatch !== latestPatch;
if (includeLiquipedia && shouldRefreshHeroProfiles) {
  console.log('按 Liquipedia API 规范同步英雄模型资料…');
  heroProfiles = await fetchLiquipediaHeroProfiles(heroes.map((hero) => ({ key: `hero:${hero.id}`, title: hero.nameEnglish })));
  heroProfiles._meta = { fetchedAt: new Date().toISOString(), heroCount: heroes.length };
}
for (const hero of heroes) {
  const profile = heroProfiles[`hero:${hero.id}`] || null;
  hero.liquipediaProfile = profile;
  if (profile?.talentValues) {
    hero.talents.forEach((talent, index) => {
      const fallback = profile.talentValues[index % 2 === 0 ? index + 1 : index - 1];
      if (fallback) talent.name = talent.name.replace(/\{s:[^}]+\}/g, fallback);
    });
  }
}

const cnNews = await fetchCnNews();
const generatedAt = new Date().toISOString();
const visibleItems = items.filter((item) => item.isCurrent && !item.isRecipe && item.name && item.name !== item.internalName);
const meta = {
  schemaVersion: DATA_SCHEMA_VERSION,
  generatedAt,
  latestPatch,
  counts: { heroes: heroes.length, items: visibleItems.length, itemRecords: items.length, patches: patches.length, cnNews: cnNews.length, legacyPages: Object.keys(legacy).filter((key) => key !== '_meta').length },
  sources: [
    { id: 'valve', name: 'Valve Dota 2 官方数据', url: 'https://www.dota2.com/datafeed', language: '简体中文', license: 'Valve 游戏资料与媒体资源' },
    { id: 'perfectworld', name: 'Dota 2 国服官方网站', url: 'https://www.dota2.com.cn/news/gamepost/index.htm', language: '简体中文', license: '官方更新公告' },
    { id: 'liquipedia', name: 'Liquipedia Dota 2 Wiki', url: 'https://liquipedia.net/dota2/Main_Page', language: '英文历史补充', license: '文字 CC BY-SA 3.0；媒体许可逐文件判断' },
  ],
};

const patchIndex = [...patches].reverse().map((patch) => ({
  version: patch.version, name: patch.name, timestamp: patch.timestamp,
  generalSections: patch.general.length, heroChanges: patch.heroes.length,
  itemChanges: patch.items.length + patch.neutralItems.length,
}));

await Promise.all([
  writeFile(path.join(DATA_DIR, 'heroes.json'), JSON.stringify(heroes)),
  writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items)),
  writeFile(path.join(DATA_DIR, 'item-structures.json'), JSON.stringify(itemStructures)),
  writeFile(path.join(DATA_DIR, 'patches.json'), JSON.stringify(patches)),
  writeFile(path.join(DATA_DIR, 'patch-index.json'), JSON.stringify(patchIndex, null, 2)),
  writeFile(path.join(DATA_DIR, 'cn-news.json'), JSON.stringify(cnNews, null, 2)),
  writeFile(path.join(DATA_DIR, 'legacy.json'), JSON.stringify(legacy)),
  writeFile(path.join(DATA_DIR, 'liquipedia-profiles.json'), JSON.stringify(heroProfiles)),
  writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2)),
]);

console.log(`同步完成：${heroes.length} 位英雄、${visibleItems.length} 件可浏览物品、${patches.length} 个官方中文版本。`);
