import heroesRaw from '../data/heroes.json';
import itemsRaw from '../data/items.json';
import patchesRaw from '../data/patches.json';
import patchIndexRaw from '../data/patch-index.json';
import metaRaw from '../data/meta.json';
import cnNewsRaw from '../data/cn-news.json';
import validationRaw from '../data/validation-report.json';
import esportsRaw from '../data/esports.json';
import itemStructuresRaw from '../data/item-structures.json';
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

export type ItemEffect = {
  type: 'active' | 'passive' | 'use' | 'toggle' | 'upgrade' | 'effect';
  typeLabel: string;
  title: string;
  description: string;
  valueNames: string[];
};

type ItemStructure = {
  components: string[];
  abilities: Array<{ type: string; title: string; description: string }>;
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

export const items = (itemsRaw as unknown as Item[]).map((item) => (
  item.isRecipe ? { ...item, image: '/assets/item-recipe.png' } : item
));
export const itemStructures = (itemStructuresRaw as unknown as { items: Record<string, ItemStructure> }).items;
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

const itemDescriptionFallbacks: Record<string, Record<string, string>> = {
  ascetic_cap: { status_resistance: '40', slow_resistance: '40', duration: '5' },
  tome_of_knowledge: { customval_team_tomes_used: '对局内动态统计' },
};

export function itemDescriptionValueNames(text: string | string[]) {
  const joined = Array.isArray(text) ? text.join('\n') : text;
  return new Set([...joined.matchAll(/%([A-Za-z0-9_]+)%/g)].map((match) => match[1].toLocaleLowerCase('en')));
}

export function formatItemText(item: Pick<Item, 'slug' | 'specialValues'>, text: string) {
  if (!text) return '';
  const values = new Map(item.specialValues.map((value) => [value.name.toLocaleLowerCase('en'), formatValues(value.values)]));
  const fallbacks = itemDescriptionFallbacks[item.slug] || {};
  return text
    .replace(/%([A-Za-z0-9_]+)%/g, (token, name: string) => values.get(name.toLocaleLowerCase('en')) || fallbacks[name.toLocaleLowerCase('en')] || token)
    .replaceAll('%%', '%');
}

export function formatItemDescription(item: Pick<Item, 'slug' | 'description' | 'specialValues'>) {
  return formatItemText(item, item.description);
}

const effectTypeLabels = {
  active: '主动',
  passive: '被动',
  use: '使用',
  toggle: '切换',
  upgrade: '升级',
  effect: '效果',
} as const;

function normalizeEffectType(value: string): ItemEffect['type'] {
  const type = value.toLocaleLowerCase('en');
  if (['active', 'passive', 'use', 'toggle', 'upgrade'].includes(type)) return type as ItemEffect['type'];
  if (type === '主动') return 'active';
  if (type === '被动') return 'passive';
  if (type === '使用') return 'use';
  if (['切换', '开关'].includes(type)) return 'toggle';
  if (type === '升级') return 'upgrade';
  return 'effect';
}

function splitChineseEffect(rest: string, typeLabel: string) {
  const spaced = rest.match(/^([^\s，。；:：]{1,20})\s+(.+)$/);
  if (spaced) return { title: spaced[1], description: spaced[2] };

  const verb = /(提供|给予|使|造成|增加|获得|消耗|传送|发射|召唤|切换|放置|摧毁|创建|攻击|施放|激活|回复|恢复|降低|提升|抵挡|格挡|驱散)/.exec(rest);
  if (verb?.index && verb.index <= 20) return { title: rest.slice(0, verb.index), description: rest.slice(verb.index) };
  if (rest.length <= 16 && !/[。；，]/.test(rest)) return { title: rest, description: '' };
  return { title: typeLabel, description: rest };
}

export function getItemEffects(item: Item): ItemEffect[] {
  const structured = itemStructures[item.slug]?.abilities || [];
  const paragraphs = item.description.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const tagged = paragraphs.flatMap((paragraph) => {
    const match = paragraph.match(/^(主动|被动|使用|切换|开关|升级|Active|Passive|Use|Toggle|Upgrade)\s*[：:]\s*(.+)$/i);
    if (!match) return [];
    const type = normalizeEffectType(match[1]);
    const typeLabel = effectTypeLabels[type];
    const split = splitChineseEffect(match[2].trim(), typeLabel);
    return [{
      type,
      typeLabel,
      title: split.title || typeLabel,
      description: formatItemText(item, split.description),
      raw: paragraph,
    }];
  });

  const resolved = tagged.map((effect, index) => {
    const matchingStructure = structured[index] || structured.find((ability) => normalizeEffectType(ability.type) === effect.type);
    const placeholderNames = [...effect.raw.matchAll(/%([A-Za-z0-9_]+)%/g)].map((match) => match[1].toLocaleLowerCase('en'));
    const referenceNumbers = new Set((matchingStructure?.description.match(/-?\d+(?:\.\d+)?/g) || []).map(Number));
    const inferredNames = item.specialValues
      .filter((value) => value.values.some((number) => referenceNumbers.has(Number(number))))
      .map((value) => value.name.toLocaleLowerCase('en'));

    return {
      type: effect.type,
      typeLabel: effect.typeLabel,
      title: effect.title,
      description: effect.description,
      valueNames: [...new Set([...placeholderNames, ...inferredNames])],
    };
  });

  const assigned = new Set(resolved.flatMap((effect) => effect.valueNames));
  for (const value of item.specialValues) {
    const name = value.name.toLocaleLowerCase('en');
    if (assigned.has(name)) continue;
    const label = formatItemValueLabel(value).replace(/加成|额外|增加|提升|降低|减少|[+\-]/g, '').trim();
    if (label.length < 2 || /[A-Za-z_$]/.test(label)) continue;
    const matchingEffects = resolved.filter((effect) => `${effect.title}${effect.description}`.includes(label));
    const matchingEffect = matchingEffects.find((effect) => effect.type === 'passive')
      || (!name.startsWith('bonus_') ? matchingEffects[0] : undefined);
    if (matchingEffect) matchingEffect.valueNames.push(name);
  }
  return resolved;
}

const valueLabelByName: Record<string, string> = {
  abilitycooldown: '冷却时间', abilitymanacost: '魔法消耗', abilitycastrange: '施法距离', abilitycastpoint: '施法前摇',
  duration: '持续时间', slow_duration: '减速持续时间', buff_duration: '增益持续时间', debuff_duration: '负面效果持续时间',
  bonus_damage: '攻击力', damage: '伤害', bonus_attack_speed: '攻击速度', attack_speed: '攻击速度',
  bonus_strength: '力量', bonus_str: '力量', bonus_agility: '敏捷', bonus_intellect: '智力', bonus_all_stats: '全属性',
  bonus_armor: '护甲', armor: '护甲', bonus_health: '生命值', bonus_mana: '魔法值', bonus_health_regen: '生命恢复', bonus_mana_regen: '魔法恢复',
  radius: '作用范围', aura_radius: '光环范围', cast_range_bonus: '施法距离加成', bonus_movement_speed: '移动速度',
  bonus_night_vision: '夜间视野', consumed_bonus: '吞噬后攻击速度', consumed_bonus_night_vision: '吞噬后夜间视野',
  bonus_attack_speed_pct: '基础攻击速度', bonus_spell_amp: '技能增强', bonus_spell_resist: '技能抗性', bonus_magic_resistance: '魔法抗性', bonus_magical_armor: '魔法抗性', bonus_movement: '移动速度',
  blink_range: '闪烁距离', blink_damage_cooldown: '受伤禁用时间', blink_range_clamp: '最大闪烁距离',
  maximum_distance: '最大距离', vision_radius: '视野范围', tp_cooldown: '回城卷轴冷却时间',
  bonus_chance: '触发几率', bonus_chance_damage: '额外魔法伤害', proc_chance: '触发几率', crit_chance: '暴击几率', crit_multiplier: '暴击伤害',
  evasion: '闪避', bonus_evasion: '闪避', magic_resist: '魔法抗性', status_resistance: '状态抗性',
};

export function formatItemValueLabel(value: Item['specialValues'][number]) {
  const key = value.name.toLocaleLowerCase('en');
  const mapped = valueLabelByName[key];
  if (mapped) return mapped;
  if (value.label && value.label !== value.name && !/[A-Za-z_$]/.test(value.label)) return value.label.replace(/^\+/, '').trim();
  const tokenLabels: Record<string, string> = {
    active: '主动', all: '全', amp: '增强', armor: '护甲', attack: '攻击', barrier: '屏障', block: '格挡',
    cast: '施法', chance: '几率', charge: '充能', charges: '充能', cooldown: '冷却', crit: '暴击', damage: '伤害',
    debuff: '负面效果', distance: '距离', duration: '持续时间', evasion: '闪避', health: '生命', hp: '生命',
    lifesteal: '吸血', magic: '魔法', magical: '魔法', mana: '魔法', max: '最大', movement: '移动', movespeed: '移动速度',
    outgoing: '造成', pct: '百分比', percent: '百分比', proc: '触发', projectile: '弹道', radius: '范围', range: '距离',
    regen: '恢复', replenish: '补充', resist: '抗性', resistance: '抗性', restore: '恢复', slow: '减速', soul: '灵魂',
    speed: '速度', spell: '技能', status: '状态', stun: '眩晕', summon: '召唤', tooltip: '', vision: '视野',
  };
  const parts = key.split('_');
  const isBonus = parts[0] === 'bonus';
  const translated = parts.filter((part) => part !== 'bonus').map((part) => tokenLabels[part]).filter(Boolean);
  return translated.length === parts.filter((part) => part !== 'bonus' && part !== 'tooltip').length
    ? `${translated.join('')}${isBonus ? '加成' : ''}`
    : '效果数值';
}

export function isItemValuePercentage(value: Item['specialValues'][number]) {
  const name = value.name.toLocaleLowerCase('en');
  return value.isPercentage || (!/(damage|amount|duration|radius|range)/.test(name) && /(^|_)(chance|percent|percentage|pct)($|_)/.test(name));
}

export function getItemRecipeComponents(item: Item) {
  const slugs = [...(itemStructures[item.slug]?.components || [])];
  const recipe = itemBySlug.get(`recipe_${item.slug}`);
  if (recipe && recipe.cost > 0 && !slugs.includes(recipe.slug)) slugs.push(recipe.slug);
  return slugs.map((slug) => itemBySlug.get(slug)).filter((component): component is Item => Boolean(component));
}

export function getItemBuildsInto(item: Item) {
  const sourceSlug = item.isRecipe ? item.slug.replace(/^recipe_/, '') : item.slug;
  if (item.isRecipe) {
    const result = itemBySlug.get(sourceSlug);
    return result ? [result] : [];
  }
  return items.filter((candidate) => itemStructures[candidate.slug]?.components?.includes(sourceSlug));
}
