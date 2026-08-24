import heroesRaw from '../data/heroes.json';
import itemsRaw from '../data/items.json';
import patchesRaw from '../data/patches.json';
import patchIndexRaw from '../data/patch-index.json';
import metaRaw from '../data/meta.json';
import cnNewsRaw from '../data/cn-news.json';
import validationRaw from '../data/validation-report.json';
import esportsRaw from '../data/esports.json';
import { buildSpiritBear } from './special-heroes';

export type Note = { text: string; indent: number; icon?: string | null; original?: string };

export type Ability = {
  id: number;
  slug: string;
  name: string;
  description: string;
  lore: string;
  notes: string[];
  scepter: string;
  shard: string;
  isInnate: boolean;
  useSharedInnateIcon?: boolean;
  type: number;
  castRange: number[];
  cooldown: number[];
  manaCost: number[];
  damage: number[];
  specialValues: Array<{ name: string; label: string; values: number[]; isPercentage: boolean; shard?: number[]; scepter?: number[] }>;
  image: string;
};

export type HistoryEntry = {
  version: string;
  timestamp?: number;
  notes: Note[];
  abilities?: Array<{ id: number; name: string; notes: Note[] }>;
  semanticNotes?: Note[];
  semanticOnly?: boolean;
};

export type LegacyEntry = { version: string; notes: Array<{ text: string; original: string; indent: number }> };

export type LiquipediaHeroProfile = {
  controlVersion: string | null;
  baseAttackSpeed: number | null;
  attackPoint: number | null;
  attackBackswing: number | null;
  collisionSize: number | null;
  boundRadius: number | null;
  gibType: string | null;
  releaseDate: string | null;
  allstarsReleaseDate: string | null;
  dotaVersion: string | null;
  liquipediaHeroId: number | null;
  talentValues: Array<string | null>;
  sourceUrl: string;
  revisionId: number;
  updatedAt: string;
};

export type Hero = {
  id: number;
  slug: string;
  internalName: string;
  name: string;
  nameEnglish: string;
  bio: string;
  hype: string;
  primaryAttribute: string;
  complexity: number;
  roles: Array<{ name: string; level: number }>;
  stats: Record<string, number | number[] | string>;
  abilities: Ability[];
  talents: Ability[];
  image: string;
  portrait: string;
  history: HistoryEntry[];
  legacyHistory: LegacyEntry[];
  liquipediaProfile?: LiquipediaHeroProfile | null;
  isSpecialUnit?: boolean;
  relatedHero?: { slug: string; name: string; relationship: string };
};

export type Item = {
  id: number;
  slug: string;
  internalName: string;
  name: string;
  nameEnglish: string;
  description: string;
  lore: string;
  notes: string[];
  cost: number;
  quality: number;
  neutralTier: number;
  isRecipe: boolean;
  isCurrent: boolean;
  cooldown: number[];
  manaCost: number[];
  specialValues: Array<{ name: string; label: string; values: number[]; isPercentage: boolean }>;
  image: string;
  history: HistoryEntry[];
  legacyHistory: LegacyEntry[];
};

export type Patch = {
  version: string;
  name: string;
  timestamp: number;
  general: Array<{ title: string; notes: Note[] }>;
  items: Array<{ id: number; notes: Note[]; title?: string; isGeneralNote?: boolean }>;
  neutralItems: Array<{ id: number; notes: Note[]; title?: string; isGeneralNote?: boolean }>;
  heroes: Array<{ id: number; notes: Note[]; abilities: Array<{ id: number; notes: Note[] }> }>;
};

export type EsportsPlayer = {
  slug: string;
  name: string;
  realName: string;
  role: string;
  country: string;
  flag: string;
  profileUrl: string;
  teamSlug: string;
  teamName: string;
  teamLogo: string;
  region: string;
  wikiRoles: string[];
  primaryRole: string;
  profileStatus: string;
  identity: 'Player' | 'Coach' | 'Retired' | 'Inactive';
  position: number;
  tiAppearances: number;
};

export type EsportsTeam = {
  slug: string;
  name: string;
  region: string;
  subregion: string;
  logo: string;
  sourceUrl: string;
  roster: string[];
};

export type TransferTeam = Pick<EsportsTeam, 'slug' | 'name' | 'logo' | 'sourceUrl'>;

export type EsportsTransfer = {
  id: string;
  date: string;
  players: Array<Pick<EsportsPlayer, 'slug' | 'name' | 'country' | 'flag' | 'profileUrl'>>;
  from: TransferTeam[];
  to: TransferTeam[];
  fromStatus: string[];
  toStatus: string[];
  referenceUrl: string;
};

export const items = itemsRaw as unknown as Item[];
export const patches = patchesRaw as unknown as Patch[];
const standardHeroes = heroesRaw as unknown as Hero[];
export const heroes = [...standardHeroes.filter((hero) => hero.id !== 1961), buildSpiritBear(patches)];
export const patchIndex = patchIndexRaw as unknown as Array<{
  version: string; name: string; timestamp: number; generalSections: number; heroChanges: number; itemChanges: number;
}>;
export const meta = metaRaw as unknown as {
  schemaVersion?: number;
  generatedAt: string;
  latestPatch: string;
  counts: { heroes: number; items: number; itemRecords: number; patches: number; cnNews: number; legacyPages: number };
  sources: Array<{ id: string; name: string; url: string; language: string; license: string }>;
};
export const cnNews = cnNewsRaw as unknown as Array<{ title: string; url: string }>;
export const validation = validationRaw as unknown as { generatedAt: string; passed: boolean; checks: Array<{ name: string; pass: boolean; detail: string }> };
export const esports = esportsRaw as unknown as {
  generatedAt: string;
  sourceUrl: string;
  transferSourceUrl: string;
  scope: string;
  teams: EsportsTeam[];
  players: EsportsPlayer[];
  transfers: EsportsTransfer[];
};

export const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
export const heroBySlug = new Map(heroes.map((hero) => [hero.slug, hero]));
export const itemById = new Map(items.map((item) => [item.id, item]));
export const itemBySlug = new Map(items.map((item) => [item.slug, item]));
export const patchByVersion = new Map(patches.map((patch) => [patch.version, patch]));

export const heroSummaries = heroes.map((hero) => ({
  id: hero.id,
  slug: hero.slug,
  name: hero.name,
  nameEnglish: hero.nameEnglish,
  attribute: hero.primaryAttribute,
  roles: hero.roles.map((role) => role.name),
  complexity: hero.complexity,
  image: hero.image,
  historyCount: hero.history.length + hero.legacyHistory.length,
}));

const activeEnhancementTiers = new Map([
  ['enhancement_vital', '1'],
  ['enhancement_alert', '1–4'],
  ['enhancement_brawny', '1–4'],
  ['enhancement_mystical', '1–4'],
  ['enhancement_quickened', '1–4'],
  ['enhancement_tough', '1–4'],
  ['enhancement_greedy', '2–3'],
  ['enhancement_crude', '2–4'],
  ['enhancement_keen_eyed', '2–4'],
  ['enhancement_nimble', '2–4'],
  ['enhancement_titanic', '2–4'],
  ['enhancement_timeless', '4–5'],
  ['enhancement_audacious', '5'],
  ['enhancement_evolved', '5'],
  ['enhancement_feverish', '5'],
  ['enhancement_fleetfooted', '5'],
  ['enhancement_hulking', '5'],
  ['enhancement_manic', '5'],
  ['enhancement_vampiric', '5'],
]);

export const itemSummaries = items.map((item) => ({
  id: item.id,
  slug: item.slug,
  name: item.name,
  nameEnglish: item.nameEnglish,
  cost: item.cost,
  neutralTier: item.neutralTier,
  isRecipe: item.isRecipe,
  isCurrent: item.isCurrent,
  isEnhancement: item.slug.startsWith('enhancement_'),
  isActiveEnhancement: activeEnhancementTiers.has(item.slug),
  enhancementTier: activeEnhancementTiers.get(item.slug) || '',
  hasChineseName: item.name !== item.internalName,
  image: item.image,
  historyCount: item.history.length + item.legacyHistory.length,
}));

export const searchEntries = [
  { kind: '玩法', title: 'DOTA 2 弗一把', subtitle: '8 次机会猜出职业选手', href: '/friberg' },
  ...heroSummaries.map((hero) => ({ kind: '英雄', title: hero.name, subtitle: hero.nameEnglish, href: `/heroes/${hero.slug}`, image: hero.image })),
  ...itemSummaries.filter((item) => item.hasChineseName && !item.isRecipe).map((item) => ({ kind: '物品', title: item.name, subtitle: item.nameEnglish, href: `/items/${item.slug}`, image: item.image })),
  ...patchIndex.map((patch) => ({ kind: '版本', title: patch.name, subtitle: `${patch.heroChanges} 位英雄 · ${patch.itemChanges} 件物品`, href: `/patches/${patch.version}` })),
  ...esports.players.map((player) => ({ kind: '选手', title: player.name, subtitle: player.teamName || player.country || '职业选手', href: `/players#player-${player.slug}`, image: player.flag })),
  ...esports.teams.map((team) => ({ kind: '战队', title: team.name, subtitle: team.subregion || team.region || '职业战队', href: `/teams#team-${team.slug}`, image: team.logo })),
];

export function formatDate(timestamp: number | string) {
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatValues(values: number[] | undefined, percentage = false) {
  if (!values?.length) return '—';
  const trimmed = [...values];
  while (trimmed.length > 1 && trimmed.at(-1) === trimmed.at(-2)) trimmed.pop();
  return trimmed.map((value) => `${Number.isInteger(value) ? value : Number(value.toFixed(2))}${percentage ? '%' : ''}`).join(' / ');
}
