import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'toy-dist');
const OUTPUTS = path.join(ROOT, 'outputs');
const CACHE = path.join(ROOT, '.data-cache', 'toy-assets');
const TEMPLATE = path.join(ROOT, 'toy');
const DATA = path.join(ROOT, 'data');
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');
const downloadAssets = process.argv.includes('--download-assets');
const makeZip = process.argv.includes('--zip');
const DOTA_LOGO = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/global/dota2_logo_symbol.png';
const TALENT_TREE_ICON = 'https://liquipedia.net/commons/images/7/74/Talent_Tree_abilityicon_dota2_gameasset.png';
const blinkPenaltyRemovedSlugs = new Set(['blink', 'overwhelming_blink', 'swift_blink', 'arcane_blink']);
const enhancementTiers = new Map([
  ['enhancement_vital', '1'], ['enhancement_alert', '1–4'], ['enhancement_brawny', '1–4'],
  ['enhancement_mystical', '1–4'], ['enhancement_quickened', '1–4'], ['enhancement_tough', '1–4'],
  ['enhancement_greedy', '2–3'], ['enhancement_crude', '2–4'], ['enhancement_keen_eyed', '2–4'],
  ['enhancement_nimble', '2–4'], ['enhancement_titanic', '2–4'], ['enhancement_timeless', '4–5'],
  ['enhancement_audacious', '5'], ['enhancement_evolved', '5'], ['enhancement_feverish', '5'],
  ['enhancement_fleetfooted', '5'], ['enhancement_hulking', '5'], ['enhancement_manic', '5'],
  ['enhancement_vampiric', '5'],
]);

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`Refusing to write outside project root: ${resolved}`);
  return resolved;
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
}

async function writeJson(target, value) {
  const resolved = assertInsideRoot(target);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(value));
}

async function loadSpiritBear(patches) {
  const source = await readFile(path.join(ROOT, 'lib', 'special-heroes.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  const importedModule = await import(moduleUrl);
  return importedModule.buildSpiritBear(patches);
}

function normalizeItems(items) {
  return items.map((item) => {
    const specialValues = blinkPenaltyRemovedSlugs.has(item.slug)
      ? item.specialValues.filter((value) => value.name.toLocaleLowerCase('en') !== 'blink_range_clamp')
      : item.specialValues;
    return {
      ...item,
      specialValues,
      image: item.isRecipe ? '/assets/item-recipe.png' : item.image,
    };
  });
}

function normalizeHeroes(heroes) {
  return heroes.map((hero) => ({
    ...hero,
    abilities: hero.abilities.map((ability) => ({
      ...ability,
      image: ability.isInnate && ability.useSharedInnateIcon !== false ? '/assets/innate-ability.png' : ability.image,
    })),
    talents: hero.talents.map((talent) => ({ ...talent, image: TALENT_TREE_ICON })),
  }));
}

function isImageUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false;
  try {
    return /\.(png|jpe?g|webp)(?:$|\?)/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function collectImageUrls(value, target = new Set()) {
  if (isImageUrl(value)) target.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectImageUrls(entry, target));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collectImageUrls(entry, target));
  return target;
}

function mediaName(url) {
  const parsed = new URL(url);
  const extension = path.extname(parsed.pathname).toLocaleLowerCase('en') || '.png';
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const stem = path.basename(parsed.pathname, path.extname(parsed.pathname))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 48) || 'image';
  return `${stem}-${hash}${extension}`;
}

async function fetchAsset(url, target) {
  const headers = { 'user-agent': 'Dota2FanWiki-ToyBuilder/1.0 (+https://github.com/SuperN0va/dota2-cn-wiki)' };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error('empty response');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buffer);
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  console.warn(`  ! ${url}: ${lastError?.message || lastError}`);
  return false;
}

async function mapRemoteAssets(values) {
  const urls = new Set([DOTA_LOGO, TALENT_TREE_ICON]);
  values.forEach((value) => collectImageUrls(value, urls));
  const map = new Map();
  const queue = [...urls];
  let completed = 0;

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      const name = mediaName(url);
      const cached = path.join(CACHE, name);
      const output = path.join(OUT, 'media', name);
      let available = false;
      try {
        available = (await stat(cached)).size > 0;
      } catch {
        if (downloadAssets) available = await fetchAsset(url, cached);
      }
      if (available) {
        await mkdir(path.dirname(output), { recursive: true });
        await cp(cached, output);
        map.set(url, `media/${name}`);
      } else {
        map.set(url, url);
      }
      completed += 1;
      if (downloadAssets && (completed % 100 === 0 || completed === urls.size)) {
        console.log(`  media ${completed}/${urls.size}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(16, queue.length || 1) }, () => worker()));
  return map;
}

function rewriteAssets(value, map) {
  if (typeof value === 'string') {
    if (map.has(value)) return map.get(value);
    if (value.startsWith('/assets/')) return value.slice(1);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => rewriteAssets(entry, map));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewriteAssets(entry, map)]));
  }
  return value;
}

function heroSummary(hero) {
  return {
    id: hero.id,
    slug: hero.slug,
    name: hero.name,
    nameEnglish: hero.nameEnglish,
    attribute: hero.primaryAttribute,
    roles: hero.roles.map((role) => role.name),
    complexity: hero.complexity,
    image: hero.image,
    historyCount: hero.history.length + hero.legacyHistory.length,
    isSpecialUnit: Boolean(hero.isSpecialUnit),
  };
}

function itemSummary(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    nameEnglish: item.nameEnglish,
    cost: item.cost,
    neutralTier: item.neutralTier,
    isRecipe: item.isRecipe,
    isCurrent: item.isCurrent,
    isEnhancement: item.slug.startsWith('enhancement_'),
    enhancementTier: enhancementTiers.get(item.slug) || '',
    hasChineseName: item.name !== item.internalName,
    image: item.image,
    historyCount: item.history.length + item.legacyHistory.length,
  };
}

function patchSummary(patch) {
  return {
    version: patch.version,
    name: patch.name,
    timestamp: patch.timestamp,
    generalSections: patch.general.length,
    heroChanges: patch.heroes.length,
    itemChanges: patch.items.length,
    neutralChanges: patch.neutralItems.length,
  };
}

function itemBuildsInto(items, structures, sourceSlug) {
  return items.filter((candidate) => structures[candidate.slug]?.components?.includes(sourceSlug)).map(itemSummary);
}

function sanitizeFileName(value) {
  return encodeURIComponent(value).replace(/%/g, '_');
}

async function walkFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, next));
    else files.push(next);
  }
  return files;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function createZip(source, destination) {
  const files = await walkFiles(source);
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = dosDateTime(new Date());
  for (const relative of files) {
    const name = Buffer.from(relative.split(path.sep).join('/'));
    const input = await readFile(path.join(source, relative));
    const compressed = deflateRawSync(input, { level: 9 });
    const crc = crc32(input);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(input.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(now.time, 12);
    central.writeUInt16LE(now.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(input.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, entry) => sum + entry.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.concat([...locals, ...centrals, end]));
}

console.log('Building Bilibili Toy package…');
assertInsideRoot(OUT);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(TEMPLATE, OUT, { recursive: true });
await cp(PUBLIC_ASSETS, path.join(OUT, 'assets'), { recursive: true });

const [heroesRaw, itemsRaw, patches, mechanics, itemStructuresRaw, esports, meta, validation] = await Promise.all([
  readJson('heroes.json'), readJson('items.json'), readJson('patches.json'), readJson('liquipedia-mechanics.json'),
  readJson('item-structures.json'), readJson('esports.json'), readJson('meta.json'), readJson('validation-report.json'),
]);
const spiritBear = await loadSpiritBear(patches);
const heroes = normalizeHeroes([...heroesRaw.filter((hero) => hero.id !== 1961), spiritBear]);
const items = normalizeItems(itemsRaw);
const structures = itemStructuresRaw.items || {};

console.log(`  content ${heroes.length} heroes · ${items.length} item records · ${patches.length} patches`);
const remoteMap = await mapRemoteAssets([heroes, items, patches, esports]);
const rewrittenHeroes = rewriteAssets(heroes, remoteMap);
const rewrittenItems = rewriteAssets(items, remoteMap);
const rewrittenPatches = rewriteAssets(patches, remoteMap);
const rewrittenEsports = rewriteAssets(esports, remoteMap);

const heroIndex = rewrittenHeroes.map(heroSummary);
const itemIndex = rewrittenItems.map(itemSummary);
const patchIndex = rewrittenPatches.map(patchSummary).sort((left, right) => right.timestamp - left.timestamp);
const searchablePlayers = rewrittenEsports.players.map((player) => ({
  slug: player.slug, name: player.name, realName: player.realName, country: player.country,
  teamName: player.teamName, identity: player.identity, position: player.position, flag: player.flag,
}));
const searchableTeams = rewrittenEsports.teams.map((team) => ({
  slug: team.slug, name: team.name, region: team.region, subregion: team.subregion, logo: team.logo,
}));
const searchableAbilities = rewrittenHeroes.flatMap((hero) => hero.abilities.map((ability) => ({
  id: ability.id, slug: ability.slug, name: ability.name, heroSlug: hero.slug, heroName: hero.name,
  image: ability.isInnate && ability.useSharedInnateIcon !== false ? 'assets/innate-ability.png' : ability.image,
})));

await writeJson(path.join(OUT, 'data', 'index.json'), {
  meta: { ...meta, counts: { ...meta.counts, heroes: heroIndex.length }, toyGeneratedAt: new Date().toISOString() },
  validation: { generatedAt: validation.generatedAt, passed: validation.passed },
  heroes: heroIndex,
  items: itemIndex,
  patches: patchIndex,
  abilities: searchableAbilities,
  players: searchablePlayers,
  teams: searchableTeams,
  sources: meta.sources,
  logo: remoteMap.get(DOTA_LOGO) || DOTA_LOGO,
});
await writeJson(path.join(OUT, 'data', 'esports.json'), rewrittenEsports);

for (const hero of rewrittenHeroes) {
  await writeJson(path.join(OUT, 'data', 'heroes', `${sanitizeFileName(hero.slug)}.json`), {
    ...hero,
    mechanics: mechanics.heroes?.[hero.slug] || null,
  });
}
for (const item of rewrittenItems) {
  await writeJson(path.join(OUT, 'data', 'items', `${sanitizeFileName(item.slug)}.json`), {
    ...item,
    structure: structures[item.slug] || { components: [], abilities: [] },
    buildsInto: itemBuildsInto(rewrittenItems, structures, item.isRecipe ? item.slug.replace(/^recipe_/, '') : item.slug),
    mechanics: mechanics.items?.[item.slug] || null,
  });
}
for (const patch of rewrittenPatches) {
  await writeJson(path.join(OUT, 'data', 'patches', `${sanitizeFileName(patch.version)}.json`), patch);
}

const outputFiles = await walkFiles(OUT);
const outputBytes = (await Promise.all(outputFiles.map(async (file) => (await stat(path.join(OUT, file))).size)))
  .reduce((sum, size) => sum + size, 0);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  latestPatch: meta.latestPatch,
  counts: { heroes: heroIndex.length, items: itemIndex.length, patches: patchIndex.length, players: searchablePlayers.length, teams: searchableTeams.length },
  files: outputFiles.length + 1,
  bytes: outputBytes,
  localizedRemoteAssets: [...remoteMap.values()].filter((value) => !/^https:/i.test(value)).length,
  unresolvedRemoteAssets: [...remoteMap.values()].filter((value) => /^https:/i.test(value)).length,
};
await writeJson(path.join(OUT, 'toy-manifest.json'), manifest);

if (makeZip) {
  const zipPath = path.join(OUTPUTS, 'dota2-cn-wiki-toy.zip');
  console.log('  compressing ZIP…');
  await createZip(OUT, zipPath);
  const zipBytes = (await stat(zipPath)).size;
  console.log(`Done: ${path.relative(ROOT, zipPath)} · ${(zipBytes / 1024 / 1024).toFixed(1)} MiB`);
}
console.log(`Toy directory: ${path.relative(ROOT, OUT)} · ${manifest.files} files · ${(manifest.bytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(`Assets: ${manifest.localizedRemoteAssets} local · ${manifest.unresolvedRemoteAssets} external fallback`);
