import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONSTANTS_PATH = path.join(process.cwd(), 'node_modules', 'dotaconstants', 'build', 'items.json');

export async function buildItemStructures() {
  const constants = JSON.parse(await readFile(CONSTANTS_PATH, 'utf8'));
  const items = {};

  for (const [slug, item] of Object.entries(constants)) {
    const components = Array.isArray(item.components) ? item.components.filter(Boolean) : [];
    const abilities = Array.isArray(item.abilities)
      ? item.abilities
        .filter((ability) => ability?.type || ability?.title || ability?.description)
        .map((ability) => ({
          type: String(ability.type || 'effect').toLocaleLowerCase('en'),
          title: String(ability.title || ''),
          description: String(ability.description || ''),
        }))
      : [];

    if (components.length || abilities.length) items[slug] = { components, abilities };
  }

  return {
    source: 'dotaconstants/build/items.json（由 Valve 游戏文件生成）',
    sourceUrl: 'https://github.com/odota/dotaconstants/blob/master/build/items.json',
    items,
  };
}
