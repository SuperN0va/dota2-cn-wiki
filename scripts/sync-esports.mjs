import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data', 'esports.json');
const ASSET_ROOT = join(ROOT, 'public', 'assets', 'esports');
const HTML_CACHE_ROOT = join(ROOT, '.data-cache', 'liquipedia-esports');
const API_URL = 'https://liquipedia.net/dota2/api.php';
const WIKI_ROOT = 'https://liquipedia.net';
const USER_AGENT = 'Dota2CNWiki/0.1 (https://github.com/SuperN0va/dota2-cn-wiki; non-commercial community project)';
const PARSE_INTERVAL_MS = 31_000;
const QUERY_INTERVAL_MS = 2_100;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const force = process.argv.includes('--force');
const forceApi = process.argv.includes('--force-api');

const portalPages = [
  { page: 'Portal:Teams/Americas', region: 'Americas' },
  { page: 'Portal:Teams/Europe', region: 'Europe' },
  { page: 'Portal:Teams/China', region: 'China' },
  { page: 'Portal:Teams/Southeast Asia', region: 'Southeast Asia' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function stripHtml(value = '') {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeUrlPath(value = '') {
  return decodeHtml(value).replaceAll(' ', '_');
}

function toWikiUrl(path = '') {
  if (!path) return '';
  const decoded = decodeHtml(path);
  if (/^https?:\/\//.test(decoded)) return decoded;
  return `${WIKI_ROOT}${decoded}`;
}

function slugFromWikiPath(path = '') {
  const decoded = decodeHtml(path);
  let title = decodeURIComponent(decoded.replace(/^\/dota2\//, '').split(/[?#]/)[0] || '');
  if (title === 'index.php') {
    title = new URL(toWikiUrl(decoded)).searchParams.get('title') || title;
  }
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    || createHash('sha1').update(path).digest('hex').slice(0, 12);
}

function wikiTitleFromUrl(value = '') {
  if (!value) return '';
  const url = new URL(value, WIKI_ROOT);
  if (url.pathname.endsWith('/index.php')) return url.searchParams.get('title') || '';
  return decodeURIComponent(url.pathname.replace(/^\/dota2\//, '')).replaceAll('_', ' ');
}

function normalizeWikiTitle(value = '') {
  return decodeHtml(value).replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
}

function lastHeadingBefore(html, index) {
  const headings = [...html.slice(0, index).matchAll(/<h2 id="([^"]+)"/g)];
  return decodeHtml(headings.at(-1)?.[1]?.replaceAll('_', ' ') || '');
}

function imageFromBlock(block = '') {
  const dark = block.match(/<span class="team-template-image-icon darkmode">([\s\S]*?)<\/span>/)?.[1];
  const source = dark || block;
  const match = source.match(/<img[^>]+src="([^"]+)"/);
  return match ? toWikiUrl(decodeUrlPath(match[1])) : '';
}

function parseTeamPortal(html, portalRegion) {
  const teams = [];
  const tables = [...html.matchAll(/<table class="wikitable collapsible collapsed"[^>]*>([\s\S]*?)<\/table>/g)];

  for (const tableMatch of tables) {
    const table = tableMatch[1];
    const teamName = decodeHtml(table.match(/data-highlightingclass="([^"]+)"/)?.[1] || '').trim();
    const teamLink = table.match(/class="team-template-text"[^>]*>[\s\S]*?<a href="([^"]+)"/)?.[1] || '';
    if (!teamName || !teamLink) continue;

    const players = [];
    const rows = table.matchAll(/<tr><td style="font-weight:bold">([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g);
    for (const row of rows) {
      const playerCell = row[1];
      const flag = playerCell.match(/<img alt="([^"]*)" src="([^"]+)"/);
      const profile = playerCell.match(/<a href="(\/dota2\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!profile) continue;
      players.push({
        slug: slugFromWikiPath(profile[1]),
        name: stripHtml(profile[2]),
        realName: stripHtml(row[2]),
        role: stripHtml(row[3]),
        country: decodeHtml(flag?.[1] || ''),
        flagSource: flag ? toWikiUrl(decodeUrlPath(flag[2])) : '',
        profileUrl: toWikiUrl(profile[1]),
      });
    }

    const slug = slugFromWikiPath(teamLink);
    teams.push({
      slug,
      name: teamName,
      region: portalRegion,
      subregion: lastHeadingBefore(html, tableMatch.index),
      logoSource: imageFromBlock(table),
      sourceUrl: toWikiUrl(teamLink),
      players,
    });
  }

  return teams;
}

function parseTransferPlayers(block = '') {
  const players = [];
  for (const item of block.matchAll(/<div class="block-player"[^>]*>([\s\S]*?)<\/div>/g)) {
    const flag = item[1].match(/<img alt="([^"]*)" src="([^"]+)"/);
    const profile = item[1].match(/<a href="(\/dota2\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!profile) continue;
    players.push({
      slug: slugFromWikiPath(profile[1]),
      name: stripHtml(profile[2]),
      country: decodeHtml(flag?.[1] || ''),
      flagSource: flag ? toWikiUrl(decodeUrlPath(flag[2])) : '',
      profileUrl: toWikiUrl(profile[1]),
    });
  }
  return players;
}

function parseTransferTeams(block = '') {
  const teams = [];
  const starts = [...block.matchAll(/data-highlighting-class="([^"]+)"/g)];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1]?.index ?? block.length;
    const segment = block.slice(start.index, end);
    const link = segment.match(/<a href="(\/dota2\/[^"]+)"[^>]*>/)?.[1] || '';
    if (!link) continue;
    teams.push({
      slug: slugFromWikiPath(link),
      name: decodeHtml(start[1]),
      logoSource: imageFromBlock(segment),
      sourceUrl: toWikiUrl(link),
    });
  }
  return teams;
}

function parseTransfers(html) {
  const starts = [...html.matchAll(/<div class="divRow mainpage-transfer[^"]*">/g)];
  const transfers = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index;
    const end = starts[index + 1]?.index ?? html.length;
    const row = html.slice(start, end);
    const date = stripHtml(row.match(/class="divCell Date">([\s\S]*?)<\/div>/)?.[1] || '');
    const nameStart = row.indexOf('<div class="divCell Name">');
    const oldStart = row.indexOf('<div class="divCell Team OldTeam">');
    const iconStart = row.indexOf('<div class="divCell Icon"');
    const newStart = row.indexOf('<div class="divCell Team NewTeam">');
    const refStart = row.indexOf('<div class="divCell Ref">');
    if (!date || nameStart < 0 || oldStart < 0 || iconStart < 0 || newStart < 0 || refStart < 0) continue;

    const playerBlock = row.slice(nameStart, oldStart);
    const oldBlock = row.slice(oldStart, iconStart);
    const newBlock = row.slice(newStart, refStart);
    const reference = row.slice(refStart).match(/<a[^>]+href="([^"]+)"/)?.[1] || '';
    const players = parseTransferPlayers(playerBlock);
    if (!players.length) continue;

    transfers.push({
      id: `${date}-${players.map((player) => player.slug).join('-')}-${index}`,
      date,
      players,
      from: parseTransferTeams(oldBlock),
      to: parseTransferTeams(newBlock),
      fromStatus: [...oldBlock.matchAll(/<span[^>]*font-style:italic[^>]*>\s*\(([^)]+)\)/g)].map((match) => stripHtml(match[1])),
      toStatus: [...newBlock.matchAll(/<span[^>]*font-style:italic[^>]*>\s*\(([^)]+)\)/g)].map((match) => stripHtml(match[1])),
      referenceUrl: decodeHtml(reference),
    });
  }

  return transfers.slice(0, 50);
}

let lastParseAt = 0;
async function fetchParsedPage(page) {
  const cacheName = `${page.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
  const cacheFile = join(HTML_CACHE_ROOT, cacheName);
  if (!forceApi) {
    try {
      const cacheStat = await stat(cacheFile);
      if (Date.now() - cacheStat.mtimeMs < CACHE_TTL_MS) {
        console.log(`Using cached Liquipedia response for ${page}.`);
        return await readFile(cacheFile, 'utf8');
      }
    } catch {}
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const wait = Math.max(0, PARSE_INTERVAL_MS - (Date.now() - lastParseAt));
    if (wait) {
      console.log(`Waiting ${Math.ceil(wait / 1000)}s for Liquipedia parse rate limit…`);
      await sleep(wait);
    }
    const params = new URLSearchParams({ action: 'parse', page, prop: 'text', format: 'json', formatversion: '2' });
    try {
      const response = await fetch(`${API_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
      });
      lastParseAt = Date.now();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error.info || payload.error.code);
      await mkdir(HTML_CACHE_ROOT, { recursive: true });
      await writeFile(cacheFile, payload.parse.text);
      return payload.parse.text;
    } catch (error) {
      lastError = error;
      console.warn(`Liquipedia ${page} attempt ${attempt}/3 failed: ${error.message}`);
    }
  }
  throw new Error(`Liquipedia ${page}: ${lastError?.message || 'unknown error'}`);
}

let lastQueryAt = 0;
async function fetchWikitextPages(titles, cacheName) {
  const uniqueTitles = [...new Set(titles.filter(Boolean))];
  const cacheFile = join(HTML_CACHE_ROOT, `${cacheName}.json`);
  if (!forceApi) {
    try {
      const cacheStat = await stat(cacheFile);
      if (Date.now() - cacheStat.mtimeMs < PROFILE_CACHE_TTL_MS) {
        const cached = new Map(Object.entries(JSON.parse(await readFile(cacheFile, 'utf8'))));
        if (uniqueTitles.every((title) => cached.has(normalizeWikiTitle(title)))) {
          console.log(`Using cached Liquipedia wikitext for ${cacheName}.`);
          return cached;
        }
      }
    } catch {}
  }

  const result = new Map();
  for (let offset = 0; offset < uniqueTitles.length; offset += 45) {
    const batch = uniqueTitles.slice(offset, offset + 45);
    const wait = Math.max(0, QUERY_INTERVAL_MS - (Date.now() - lastQueryAt));
    if (wait) await sleep(wait);
    const params = new URLSearchParams({
      action: 'query',
      prop: 'revisions',
      titles: batch.join('|'),
      redirects: '1',
      rvslots: 'main',
      rvprop: 'content',
      format: 'json',
      formatversion: '2',
    });
    const response = await fetch(`${API_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' } });
    lastQueryAt = Date.now();
    if (!response.ok) throw new Error(`Liquipedia wikitext ${cacheName}: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.info || payload.error.code);
    for (const page of payload.query?.pages || []) {
      const content = page.revisions?.[0]?.slots?.main?.content || '';
      result.set(normalizeWikiTitle(page.title), content);
    }
    for (const redirect of payload.query?.redirects || []) {
      result.set(normalizeWikiTitle(redirect.from), result.get(normalizeWikiTitle(redirect.to)) || '');
    }
    for (const normalized of payload.query?.normalized || []) {
      result.set(normalizeWikiTitle(normalized.from), result.get(normalizeWikiTitle(normalized.to)) || '');
    }
  }
  await mkdir(HTML_CACHE_ROOT, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(Object.fromEntries(result)));
  return result;
}

function templateParams(value = '') {
  const named = new Map();
  const positional = [];
  for (const rawPart of value.split('|')) {
    const part = rawPart.trim();
    const separator = part.indexOf('=');
    if (separator > 0) named.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
    else if (part && !part.startsWith('{{')) positional.push(part);
  }
  return { named, positional };
}

function personSlug(value = '') {
  const { named, positional } = templateParams(value);
  const title = named.get('link') || named.get('id') || positional[0] || '';
  return title ? slugFromWikiPath(`/dota2/${title.replace(/<[^>]+>/g, '').trim()}`) : '';
}

function parseActiveRosterPositions(content = '') {
  const rosterSection = content.match(/==\s*(?:Players of [^\r\n=]+|Player Roster)\s*==([\s\S]*?)(?=\n==[^=]|$)/i)?.[1] || '';
  const activeRoster = rosterSection.match(/===\s*(?:Active Roster|Active)\s*===([\s\S]*?)(?=\n===|$)/i)?.[1] || '';
  const positions = new Map();
  for (const match of activeRoster.matchAll(/\{\{Person\|([^\r\n]+?)(?:\}\}|$)/gi)) {
    const params = templateParams(match[1]);
    const position = Number.parseInt(params.named.get('position') || '', 10);
    const slug = personSlug(match[1]);
    if (slug && position >= 1 && position <= 5) positions.set(slug, position);
  }
  return positions;
}

function infoboxField(content = '', field) {
  const value = content.match(new RegExp(`^\\|${field}\\s*=([^\\r\\n]*)`, 'mi'))?.[1] || '';
  return value.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function positionFromPrimaryRole(role = '') {
  const normalized = role.toLowerCase().replaceAll('_', ' ').trim();
  if (normalized === 'carry') return 1;
  if (normalized === 'mid' || normalized === 'solo middle' || normalized === 'midlaner') return 2;
  if (normalized === 'offlane' || normalized === 'offlaner') return 3;
  return 0;
}

function identityFromProfile(status = '', primaryRole = '') {
  const normalizedStatus = status.toLowerCase();
  if (primaryRole.toLowerCase().includes('coach')) return 'Coach';
  if (normalizedStatus.includes('retired')) return 'Retired';
  if (normalizedStatus.includes('inactive')) return 'Inactive';
  return 'Player';
}

function parseTiParticipants(content = '') {
  const players = new Map();
  for (const match of content.matchAll(/\{\{Person\|([^\r\n]+?)(?:\}\}|$)/gi)) {
    const params = templateParams(match[1]);
    const position = Number.parseInt(params.named.get('role') || '', 10);
    const slug = personSlug(match[1]);
    if (slug && position >= 1 && position <= 5) players.set(slug, position);
  }
  return players;
}

function safeAssetName(kind, id, sourceUrl) {
  const clean = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'asset';
  const sourcePath = new URL(sourceUrl).pathname;
  const extension = extname(sourcePath).toLowerCase().match(/^\.(png|jpg|jpeg|webp|gif|svg)$/)?.[0] || '.png';
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 8);
  return `/assets/esports/${kind}/${clean}-${hash}${extension}`;
}

async function cacheAsset(sourceUrl, kind, id) {
  if (!sourceUrl) return '';
  const publicPath = safeAssetName(kind, id, sourceUrl);
  const target = join(ROOT, 'public', ...publicPath.split('/').filter(Boolean));
  try {
    await stat(target);
    return publicPath;
  } catch {}

  const response = await fetch(sourceUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' } });
  if (!response.ok) {
    console.warn(`Asset skipped (${response.status}): ${sourceUrl}`);
    return '';
  }
  await mkdir(join(ASSET_ROOT, kind), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  await sleep(120);
  return publicPath;
}

async function isFreshSnapshot() {
  if (force) return false;
  try {
    const file = await stat(DATA_FILE);
    return Date.now() - file.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function main() {
  if (await isFreshSnapshot()) {
    const existing = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    console.log(`Esports snapshot is fresh: ${existing.teams.length} teams, ${existing.players.length} players, ${existing.transfers.length} transfers.`);
    return;
  }

  const teamGroups = [];
  for (const portal of portalPages) {
    console.log(`Syncing ${portal.page}…`);
    teamGroups.push(parseTeamPortal(await fetchParsedPage(portal.page), portal.region));
  }
  console.log('Syncing Portal:Transfers…');
  const transfers = parseTransfers(await fetchParsedPage('Portal:Transfers'));

  const teamsBySlug = new Map();
  for (const team of teamGroups.flat()) {
    const current = teamsBySlug.get(team.slug);
    if (!current || team.players.length > current.players.length) teamsBySlug.set(team.slug, team);
  }
  for (const transfer of transfers) {
    for (const team of [...transfer.from, ...transfer.to]) {
      if (!teamsBySlug.has(team.slug)) teamsBySlug.set(team.slug, { ...team, region: '', subregion: '', players: [] });
    }
  }

  const teams = [...teamsBySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const playersBySlug = new Map();
  for (const team of teams) {
    for (const player of team.players) {
      playersBySlug.set(player.slug, {
        ...player,
        teamSlug: team.slug,
        teamName: team.name,
        teamLogoSource: team.logoSource,
        region: team.region,
      });
    }
  }
  for (const transfer of transfers) {
    for (const player of transfer.players) {
      if (!playersBySlug.has(player.slug)) {
        playersBySlug.set(player.slug, { ...player, realName: '', role: '', teamSlug: '', teamName: '', teamLogoSource: '', region: '' });
      }
    }
  }

  console.log('Syncing player roles, statuses and active roster positions…');
  const playerProfilePages = await fetchWikitextPages(
    [...playersBySlug.values()].map((player) => wikiTitleFromUrl(player.profileUrl)),
    'player-profiles',
  );
  const teamProfilePages = await fetchWikitextPages(
    teams.map((team) => wikiTitleFromUrl(team.sourceUrl)),
    'team-profiles',
  );
  const activePositions = new Map();
  for (const team of teams) {
    const content = teamProfilePages.get(normalizeWikiTitle(wikiTitleFromUrl(team.sourceUrl))) || '';
    for (const [slug, position] of parseActiveRosterPositions(content)) activePositions.set(slug, position);
  }

  console.log('Syncing The International participation history…');
  const tiYears = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026];
  const tiTitles = tiYears.map((year) => `The International/${year}`);
  const tiPages = await fetchWikitextPages(tiTitles, 'the-international-participants');
  const tiAppearances = new Map();
  const latestTiPositions = new Map();
  for (const title of tiTitles) {
    const participants = parseTiParticipants(tiPages.get(normalizeWikiTitle(title)) || '');
    for (const [slug, position] of participants) {
      tiAppearances.set(slug, (tiAppearances.get(slug) || 0) + 1);
      latestTiPositions.set(slug, position);
    }
  }

  for (const player of playersBySlug.values()) {
    const profile = playerProfilePages.get(normalizeWikiTitle(wikiTitleFromUrl(player.profileUrl))) || '';
    const wikiRoles = infoboxField(profile, 'roles').split(',').map((role) => role.trim()).filter(Boolean);
    const primaryRole = wikiRoles[0] || '';
    const profileStatus = infoboxField(profile, 'status');
    const rolePosition = positionFromPrimaryRole(primaryRole);
    const supportPosition = primaryRole.toLowerCase() === 'support'
      ? activePositions.get(player.slug) || latestTiPositions.get(player.slug) || 0
      : 0;
    Object.assign(player, {
      wikiRoles,
      primaryRole,
      profileStatus,
      identity: identityFromProfile(profileStatus, primaryRole),
      position: rolePosition || supportPosition || activePositions.get(player.slug) || 0,
      tiAppearances: tiAppearances.get(player.slug) || 0,
    });
  }

  const allFlagSources = new Map();
  for (const player of playersBySlug.values()) if (player.flagSource) allFlagSources.set(player.country || player.slug, player.flagSource);
  for (const transfer of transfers) for (const player of transfer.players) if (player.flagSource) allFlagSources.set(player.country || player.slug, player.flagSource);
  const flagPaths = new Map();
  for (const [country, source] of allFlagSources) flagPaths.set(source, await cacheAsset(source, 'flags', country));

  const logoSources = new Map();
  for (const team of teams) if (team.logoSource) logoSources.set(team.slug, team.logoSource);
  const logoPaths = new Map();
  for (const [slug, source] of logoSources) logoPaths.set(source, await cacheAsset(source, 'teams', slug));
  const logoPathBySlug = new Map(teams.map((team) => [team.slug, logoPaths.get(team.logoSource) || '']));

  const players = [...playersBySlug.values()]
    .map(({ flagSource, teamLogoSource, ...player }) => ({
      ...player,
      flag: flagPaths.get(flagSource) || '',
      teamLogo: logoPaths.get(teamLogoSource) || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const normalizedTeams = teams.map(({ logoSource, players: roster, ...team }) => ({
    ...team,
    logo: logoPaths.get(logoSource) || '',
    roster: roster.map((player) => player.slug),
  }));

  const normalizedTransfers = transfers.map((transfer) => ({
    ...transfer,
    players: transfer.players.map(({ flagSource, ...player }) => ({ ...player, flag: flagPaths.get(flagSource) || '' })),
    from: transfer.from.map(({ logoSource, ...team }) => ({ ...team, logo: logoPathBySlug.get(team.slug) || logoPaths.get(logoSource) || '' })),
    to: transfer.to.map(({ logoSource, ...team }) => ({ ...team, logo: logoPathBySlug.get(team.slug) || logoPaths.get(logoSource) || '' })),
  }));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    sourceUrl: 'https://liquipedia.net/dota2/Portal:Players',
    transferSourceUrl: 'https://liquipedia.net/dota2/Portal:Transfers',
    scope: 'Current rosters from regional team portals and the 50 latest notable transfers.',
    teams: normalizedTeams,
    players,
    transfers: normalizedTransfers,
  };
  try {
    const previous = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    const previousContent = JSON.stringify({ teams: previous.teams, players: previous.players, transfers: previous.transfers });
    const nextContent = JSON.stringify({ teams: snapshot.teams, players: snapshot.players, transfers: snapshot.transfers });
    if (previousContent === nextContent) {
      console.log('Esports content is unchanged; keeping the existing snapshot timestamp.');
      return;
    }
  } catch {}
  await writeFile(DATA_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${normalizedTeams.length} teams, ${players.length} players, ${normalizedTransfers.length} transfers.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
