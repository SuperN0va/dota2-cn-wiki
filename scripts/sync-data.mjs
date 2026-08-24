import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const LANGUAGE = 'schinese';
const VALVE = 'https://www.dota2.com/datafeed';
const LIQUIPEDIA_API = 'https://liquipedia.net/dota2/api.php';
const LIQUIPEDIA_UA = 'MidianDotaKB/1.0 (https://openai.com/contact/; community knowledge project)';
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

function normalizeAbility(ability) {
  return {
    id: ability.id,
    slug: ability.name,
    name: ability.name_loc || ability.name,
    description: stripHtml(ability.desc_loc),
    lore: stripHtml(ability.lore_loc),
    notes: (ability.notes_loc || []).map(stripHtml).filter(Boolean),
    scepter: stripHtml(ability.scepter_loc),
    shard: stripHtml(ability.shard_loc),
    isInnate: Boolean(ability.ability_is_innate),
    type: ability.type,
    castRange: ability.cast_ranges || [],
    cooldown: ability.cooldowns || [],
    manaCost: ability.mana_costs || [],
    damage: ability.damages || [],
    specialValues: (ability.special_values || [])
      .filter((value) => value.heading_loc || value.values_float?.some((n) => n !== 0))
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

const attributeNames = ['力量', '敏捷', '智力', '全才'];
const roleNames = ['核心', '辅助', '爆发', '控制', '打野', '耐久', '逃生', '推进', '先手'];

function normalizeHero(hero) {
  const slug = hero.name.replace('npc_dota_hero_', '');
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
      health: hero.max_health, mana: hero.max_mana,
    },
    abilities: (hero.abilities || []).map(normalizeAbility),
    talents: (hero.talents || []).map(normalizeAbility),
    image: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    portrait: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    history: [],
    legacyHistory: [],
  };
}

function normalizeItem(item, listItem) {
  const source = item || listItem;
  const slug = source.name.replace('item_', '');
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
    isRecipe: source.name.includes('recipe_'),
    isCurrent: Boolean(item?.is_item ?? true),
    cooldown: item?.cooldowns || [],
    manaCost: item?.mana_costs || [],
    specialValues: (item?.special_values || []).map((value) => ({
      name: value.name, label: stripHtml(value.heading_loc) || value.name,
      values: value.values_float || [], isPercentage: Boolean(value.is_percentage),
    })),
    image: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${slug}.png`,
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
    items: (patch.items || []).map((entry) => ({ id: entry.ability_id, notes: (entry.ability_notes || []).map(normalizeNote) })),
    neutralItems: (patch.neutral_items || []).map((entry) => ({ id: entry.ability_id, notes: (entry.ability_notes || []).map(normalizeNote) })),
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
    return ({ added: '新增', removed: '移除', changed: '更改', fixed: '修复', moved: '移动' })[positional[0]?.toLowerCase()] || positional.at(-1) || '';
  }
  if (name === 'tal change') return '';
  return params.text || params.alt || positional.at(-1) || '';
}

function wikiToText(value) {
  let text = value
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '');
  for (let pass = 0; pass < 10; pass += 1) {
    const next = text.replace(/\{\{([^{}]+)\}\}/g, (_, inner) => cleanWikiTemplate(inner));
    if (next === text) break;
    text = next;
  }
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
  for (const [english, chinese] of nameMap) result = result.replaceAll(english, chinese);
  for (const [english, chinese] of termTranslations) result = result.replace(new RegExp(english, 'gi'), chinese);
  return result
    .replace(/^Increased (.+) from (.+) to (.+)\.?$/i, '将$1从$2提升至$3。')
    .replace(/^Reduced (.+) from (.+) to (.+)\.?$/i, '将$1从$2降低至$3。')
    .replace(/^Rescaled (.+) from (.+) to (.+)\.?$/i, '将$1从$2调整为$3。')
    .replace(/^Added (.+)\.?$/i, '新增$1。')
    .replace(/^Removed (.+)\.?$/i, '移除$1。')
    .replace(/^Fixed (.+)\.?$/i, '修复：$1。')
    .replace(/^Now (.+)\.?$/i, '现在$1。')
    .replace(/^No longer (.+)\.?$/i, '不再$1。')
    .replace(/^Changed (.+)\.?$/i, '更改：$1。');
}

function parseLegacyHistory(wikitext, nameMap) {
  const marker = '{{VersionTableElement|';
  const entries = [];
  let cursor = wikitext.indexOf(marker);
  while (cursor >= 0) {
    const next = wikitext.indexOf(marker, cursor + marker.length);
    const end = next >= 0 ? next : wikitext.indexOf('{{VersionTableEnd', cursor);
    const block = wikitext.slice(cursor + marker.length, end >= 0 ? end : undefined);
    const separator = block.indexOf('|');
    if (separator > 0) {
      const version = block.slice(0, separator).trim();
      const numeric = version.match(/^(\d+)\.(\d+)/);
      const isBeforeOfficialArchive = !numeric || Number(numeric[1]) < 7 || (Number(numeric[1]) === 7 && Number(numeric[2]) < 8);
      if (isBeforeOfficialArchive) {
        const body = block.slice(separator + 1).replace(/\{\{Tal change[\s\S]*?\n\}\}/gi, '');
        const notes = body.split('\n')
          .filter((line) => /^\*+\s/.test(line))
          .map((line) => {
            const stars = line.match(/^\*+/)?.[0].length || 1;
            const original = wikiToText(line.replace(/^\*+\s*/, ''));
            return { indent: stars, original, text: translateLegacy(original, nameMap) };
          })
          .filter((note) => note.original);
        if (notes.length) entries.push({ version, notes });
      }
    }
    cursor = next;
  }
  return entries;
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
      result[target.key] = {
        sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        revisionId: revision.revid,
        updatedAt: revision.timestamp,
        entries: parseLegacyHistory(revision.slots?.main?.content || '', target.nameMap),
      };
    }
    console.log(`Liquipedia 历史日志 ${index + 1}/${batches.length}`);
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

const heroList = heroListResponse.result.data.heroes;
const itemList = itemListResponse.result.data.itemabilities;
const patchList = patchListResponse.patches;
const latestPatch = patchList.at(-1)?.patch_number;
const previousMeta = await readJson('meta.json');
const canReuseCurrent = !force && previousMeta?.latestPatch === latestPatch;

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
const patches = patchList.map((entry) => previousByVersion.get(entry.patch_number)).filter(Boolean);

const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
const itemById = new Map(items.map((item) => [item.id, item]));
const abilityNames = new Map(heroes.flatMap((hero) => [...hero.abilities, ...hero.talents].map((ability) => [ability.id, ability.name])));

for (const hero of heroes) hero.history = [];
for (const item of items) item.history = [];
for (const patch of [...patches].reverse()) {
  for (const entry of patch.heroes) {
    const hero = heroById.get(entry.id);
    if (!hero) continue;
    hero.history.push({
      version: patch.version, timestamp: patch.timestamp, notes: entry.notes,
      abilities: entry.abilities.map((ability) => ({ ...ability, name: abilityNames.get(ability.id) || `技能 #${ability.id}` })),
    });
  }
  for (const entry of [...patch.items, ...patch.neutralItems]) {
    const item = itemById.get(entry.id);
    if (item) item.history.push({ version: patch.version, timestamp: patch.timestamp, notes: entry.notes });
  }
}

let legacy = canReuseCurrent ? await readJson('legacy.json', {}) : {};
if (includeLiquipedia && (!Object.keys(legacy).length || force)) {
  console.log('按 Liquipedia API 规范同步 7.08 以前的历史日志…');
  const targets = [
    ...heroes.map((hero) => ({
      key: `hero:${hero.id}`,
      title: `${hero.nameEnglish}/Changelogs`,
      nameMap: hero.abilities.map((ability) => [ability.slug.split('_').slice(1).join(' ').replace(/\b\w/g, (c) => c.toUpperCase()), ability.name]),
    })),
    ...items.filter((item) => !item.isRecipe && item.nameEnglish).map((item) => ({
      key: `item:${item.id}`, title: `${item.nameEnglish}/Changelogs`, nameMap: [[item.nameEnglish, item.name]],
    })),
  ];
  legacy = await fetchLiquipediaHistories(targets);
}

for (const hero of heroes) hero.legacyHistory = legacy[`hero:${hero.id}`]?.entries || [];
for (const item of items) item.legacyHistory = legacy[`item:${item.id}`]?.entries || [];

const cnNews = await fetchCnNews();
const generatedAt = new Date().toISOString();
const visibleItems = items.filter((item) => item.isCurrent && !item.isRecipe && item.name && item.name !== item.internalName);
const meta = {
  generatedAt,
  latestPatch,
  counts: { heroes: heroes.length, items: visibleItems.length, itemRecords: items.length, patches: patches.length, cnNews: cnNews.length, legacyPages: Object.keys(legacy).length },
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
  writeFile(path.join(DATA_DIR, 'patches.json'), JSON.stringify(patches)),
  writeFile(path.join(DATA_DIR, 'patch-index.json'), JSON.stringify(patchIndex, null, 2)),
  writeFile(path.join(DATA_DIR, 'cn-news.json'), JSON.stringify(cnNews, null, 2)),
  writeFile(path.join(DATA_DIR, 'legacy.json'), JSON.stringify(legacy)),
  writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2)),
]);

console.log(`同步完成：${heroes.length} 位英雄、${visibleItems.length} 件可浏览物品、${patches.length} 个官方中文版本。`);
