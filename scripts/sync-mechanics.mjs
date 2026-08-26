import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  fetchLiquipediaMechanics,
  MECHANICS_PARSER_VERSION,
  inferItemEffectNames,
  parseLiquipediaHeroPage,
  parseLiquipediaItemPage,
  preserveMechanicTranslations,
} from './liquipedia-mechanics.mjs';

const DATA = path.join(process.cwd(), 'data');
const load = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
const [items, heroes, meta, previousMechanics] = await Promise.all([
  load('items.json'), load('heroes.json'), load('meta.json'), load('liquipedia-mechanics.json').catch(() => ({})),
]);

const nameMap = [
  ...items.filter((item) => item.nameEnglish && item.name).map((item) => [item.nameEnglish, item.name]),
  ...heroes.filter((hero) => hero.nameEnglish && hero.name).map((hero) => [hero.nameEnglish, hero.name]),
];
const itemTargets = items
  .filter((item) => item.isCurrent && !item.isRecipe && item.nameEnglish)
  .map((item) => ({
    slug: item.slug,
    title: item.nameEnglish,
    cost: item.cost,
    neutralTier: item.neutralTier,
    effectNames: inferItemEffectNames(item.description),
  }));
const heroTargets = heroes.map((hero) => ({
  slug: hero.slug,
  title: hero.nameEnglish,
  abilities: hero.abilities.map((ability) => ({ slug: ability.slug, name: ability.name })),
}));

console.log(`同步 ${itemTargets.length} 件物品机制…`);
const itemMechanics = await fetchLiquipediaMechanics(
  itemTargets,
  (wikitext, target) => parseLiquipediaItemPage(wikitext, target, nameMap),
);
console.log(`同步 ${heroTargets.length} 位英雄的技能机制…`);
const heroMechanics = await fetchLiquipediaMechanics(
  heroTargets,
  (wikitext, target) => parseLiquipediaHeroPage(wikitext, target, nameMap),
);

const output = preserveMechanicTranslations({
  _meta: {
    parserVersion: MECHANICS_PARSER_VERSION,
    latestPatch: meta.latestPatch,
    fetchedAt: new Date().toISOString(),
    itemCount: Object.keys(itemMechanics).length,
    heroCount: Object.keys(heroMechanics).length,
  },
  items: itemMechanics,
  heroes: heroMechanics,
}, previousMechanics);
await writeFile(path.join(DATA, 'liquipedia-mechanics.json'), JSON.stringify(output));
console.log(`机制同步完成：${output._meta.itemCount} 件物品、${output._meta.heroCount} 位英雄。`);
