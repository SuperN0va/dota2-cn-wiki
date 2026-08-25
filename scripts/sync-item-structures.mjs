import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildItemStructures } from './item-structures.mjs';

const output = path.join(process.cwd(), 'data', 'item-structures.json');
const structures = await buildItemStructures();
await writeFile(output, JSON.stringify(structures));

const entries = Object.values(structures.items);
console.log(`物品结构已更新：${entries.filter((item) => item.components.length).length} 份配方，${entries.filter((item) => item.abilities.length).length} 件含主动或被动效果的物品。`);
