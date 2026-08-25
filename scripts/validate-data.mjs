import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
const load = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
const [heroes, items, patches, patchIndex, meta, legacy, esports, itemStructures] = await Promise.all([
  load('heroes.json'), load('items.json'), load('patches.json'), load('patch-index.json'), load('meta.json'), load('legacy.json'), load('esports.json'), load('item-structures.json'),
]);
const [recipeIcon, dataModuleSource, syncSource] = await Promise.all([
  readFile(path.join(process.cwd(), 'public', 'assets', 'item-recipe.png')).catch(() => null),
  readFile(path.join(process.cwd(), 'lib', 'data.ts'), 'utf8'),
  readFile(path.join(process.cwd(), 'scripts', 'sync-data.mjs'), 'utf8'),
]);

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
const unique = (values) => new Set(values).size === values.length;
const versionNumber = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)/);
  return match ? Number(match[1]) + Number(match[2]) / 100 : null;
};
const versionOrder = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)([a-z])?/i);
  if (!match) return null;
  return Number(match[1]) * 100000 + Number(match[2]) * 100 + (match[3] ? match[3].toLowerCase().charCodeAt(0) - 96 : 0);
};
const timelineNotes = (hero) => [
  ...hero.history.flatMap((entry) => [
    ...entry.notes,
    ...(entry.abilities || []).flatMap((ability) => ability.notes),
    ...(entry.semanticNotes || []),
  ]),
  ...hero.legacyHistory.flatMap((entry) => entry.notes),
];
const semanticCounts = { added: 0, reworked: 0, removed: 0, old: 0, new: 0, talents: 0 };
for (const hero of heroes) {
  for (const note of timelineNotes(hero)) {
    const text = `${note.text || ''} ${note.original || ''}`;
    if (/新增|加入|\badded\b|\bcreated\b/i.test(text)) semanticCounts.added += 1;
    if (/重做|重新设计|\breworked?\b/i.test(text)) semanticCounts.reworked += 1;
    if (/移除|删除|不再|\bremoved\b|\bno longer\b/i.test(text)) semanticCounts.removed += 1;
    if (/旧版|\bold\b/i.test(text)) semanticCounts.old += 1;
    if (/新版|\bnew\b/i.test(text)) semanticCounts.new += 1;
    if (/天赋|\btalents?\b/i.test(text)) semanticCounts.talents += 1;
  }
}

check('英雄总数', heroes.length >= 120, `${heroes.length} 位`);
check('英雄 ID 唯一', unique(heroes.map((hero) => hero.id)), '无重复 ID');
check('英雄中文资料完整', heroes.every((hero) => hero.name && hero.bio && hero.abilities.length), '名称、背景、技能均存在');
check('英雄图片地址完整', heroes.every((hero) => hero.image.startsWith('https://')), '均使用 HTTPS');
check('英雄详细属性完整', heroes.every((hero) => ['healthRegen', 'manaRegen', 'projectileSpeed', 'turnRate', 'sightRangeDay', 'sightRangeNight', 'attackCapability'].every((key) => hero.stats[key] !== undefined)), '战斗与视野字段均存在');
check('英雄先天技能完整', heroes.every((hero) => hero.abilities.some((ability) => ability.isInnate)), '每位英雄均有先天技能');
check('英雄天赋树完整', heroes.every((hero) => hero.talents.length === 8 && hero.talents.every((talent) => !/\{s:/.test(talent.name))), '每位英雄 8 项，数值占位符均已解析');
check('英雄技能文本已解析', heroes.every((hero) => hero.abilities.every((ability) => !/%[A-Za-z][A-Za-z0-9_]*%/.test([ability.description, ability.scepter, ability.shard, ...ability.notes].join(' ')))), '技能、先天、神杖与魔晶文本无数据占位符');
check('英雄模型来源完整', heroes.every((hero) => hero.liquipediaProfile?.sourceUrl && hero.liquipediaProfile?.revisionId), '每位英雄均关联 Liquipedia 修订版本');
check('英雄版本时间线完整', heroes.every((hero) => hero.history.length + hero.legacyHistory.length > 0), '每位英雄至少有一条历史记录');
check('英雄现代记录无空项', heroes.every((hero) => hero.history.every((entry) => entry.notes.length || entry.abilities?.some((ability) => ability.notes.length) || entry.semanticNotes?.length)), '无正文或结构信息的版本已剔除');
check('英雄版本无重复', heroes.every((hero) => unique([...hero.history, ...hero.legacyHistory].map((entry) => entry.version))), '官方与早期历史无版本重叠');
check('英雄版本时间倒序', heroes.every((hero) => hero.history.every((entry, index, entries) => index === 0 || Number(entries[index - 1].timestamp) >= Number(entry.timestamp))), 'Valve 官方记录按日期由新到旧');
check('早期版本顺序准确', heroes.every((hero) => hero.legacyHistory.every((entry, index, entries) => index === 0 || versionOrder(entries[index - 1].version) === null || versionOrder(entry.version) === null || versionOrder(entries[index - 1].version) >= versionOrder(entry.version))), 'Liquipedia 早期记录按版本由新到旧');
check('历史来源分界准确', heroes.every((hero) => hero.history.every((entry) => versionNumber(entry.version) === null || versionNumber(entry.version) >= 7.08) && hero.legacyHistory.every((entry) => versionNumber(entry.version) === null || versionNumber(entry.version) < 7.08)), '7.08 起为官方中文，更早为 Liquipedia 补充');
check('历史结构字段完整', heroes.every((hero) => hero.history.every((entry) => Array.isArray(entry.semanticNotes))), '每条官方英雄记录均完成语义对照');
check('历史结构正文可用', heroes.every((hero) => [...hero.history.flatMap((entry) => entry.semanticNotes || []), ...hero.legacyHistory.flatMap((entry) => entry.notes)].every((note) => note.text?.trim() && !/\{\{|\}\}/.test(`${note.text} ${note.original || ''}`))), '结构记录无空文本或未解析模板');
check('历史修订来源完整', heroes.every((hero) => legacy[`hero:${hero.id}`]?.sourceUrl && legacy[`hero:${hero.id}`]?.revisionId), '每位英雄历史均关联 Liquipedia 修订版本');
const expectedModernSemantics = heroes.reduce((sum, hero) => sum + (legacy[`hero:${hero.id}`]?.semanticEntries || []).filter((entry) => (versionNumber(entry.version) || 0) >= 7.08).length, 0);
const attachedModernSemantics = heroes.reduce((sum, hero) => sum + hero.history.filter((entry) => entry.semanticNotes?.length).length, 0);
check('现代历史结构无遗漏', expectedModernSemantics === attachedModernSemantics, `${attachedModernSemantics}/${expectedModernSemantics} 个版本结构已挂接`);
check('历史状态分类覆盖', Object.values(semanticCounts).every((count) => count > 0), Object.entries(semanticCounts).map(([key, count]) => `${key}=${count}`).join('，'));
check('物品记录总数', items.length >= 500, `${items.length} 条`);
check('物品 ID 唯一', unique(items.map((item) => item.id)), '无重复 ID');
const recipeItems = items.filter((item) => item.isRecipe);
check(
  '图纸图标本地化',
  recipeItems.length > 0
    && recipeIcon?.subarray(1, 4).toString() === 'PNG'
    && dataModuleSource.includes("item.isRecipe ? { ...item, image: '/assets/item-recipe.png' }")
    && syncSource.includes("image: isRecipe ? '/assets/item-recipe.png'"),
  `${recipeItems.length} 条图纸统一使用 Liquipedia 本地卷轴资源`,
);
check('官方物品记录无空项', items.every((item) => item.history.every((entry) => entry.notes.length)), '空物品记录已剔除');
check('物品版本无重复', items.every((item) => unique([...item.history, ...item.legacyHistory].map((entry) => entry.version))), '官方与早期历史无版本重叠');
check('物品版本时间倒序', items.every((item) => item.history.every((entry, index, entries) => index === 0 || Number(entries[index - 1].timestamp) >= Number(entry.timestamp))), 'Valve 官方物品记录按日期由新到旧');
check('物品早期版本顺序准确', items.every((item) => item.legacyHistory.every((entry, index, entries) => index === 0 || versionOrder(entries[index - 1].version) === null || versionOrder(entry.version) === null || versionOrder(entries[index - 1].version) >= versionOrder(entry.version))), 'Liquipedia 物品记录按版本由新到旧');
check('物品历史正文可用', items.every((item) => item.legacyHistory.flatMap((entry) => entry.notes).every((note) => note.text?.trim() && !/\{\{|\}\}/.test(`${note.text} ${note.original || ''}`))), '早期物品记录无空文本或未解析模板');
const itemDescriptionFallbacks = new Set(['ascetic_cap:status_resistance', 'ascetic_cap:slow_resistance', 'ascetic_cap:duration', 'tome_of_knowledge:customval_team_tomes_used']);
const unresolvedItemValues = items.flatMap((item) => {
  const valueNames = new Set(item.specialValues.map((value) => value.name.toLowerCase()));
  return [...[item.description, ...item.notes].join('\n').matchAll(/%([A-Za-z0-9_]+)%/g)]
    .map((match) => match[1].toLowerCase())
    .filter((name) => !valueNames.has(name) && !itemDescriptionFallbacks.has(`${item.slug}:${name}`))
    .map((name) => `${item.slug}:${name}`);
});
check('物品说明参数可解析', unresolvedItemValues.length === 0, unresolvedItemValues.length ? unresolvedItemValues.join('，') : '所有说明参数均可回填为玩家可读数值');
const itemSlugs = new Set(items.map((item) => item.slug));
const recipeStructures = Object.values(itemStructures.items).filter((item) => item.components.length);
const abilityStructures = Object.values(itemStructures.items).filter((item) => item.abilities.length);
const missingRecipeComponents = [...new Set(recipeStructures.flatMap((item) => item.components).filter((slug) => !itemSlugs.has(slug)))];
check('物品配方结构完整', recipeStructures.length >= 100 && missingRecipeComponents.length === 0, `${recipeStructures.length} 份配方，${missingRecipeComponents.length ? `缺少 ${missingRecipeComponents.join('、')}` : '所有组件均可点击关联'}`);
check('物品效果类型完整', abilityStructures.length >= 250 && abilityStructures.every((item) => item.abilities.every((ability) => ability.type && ability.title)), `${abilityStructures.length} 件物品含主动、被动或使用效果结构`);
check('官方版本覆盖', patches.length >= 100, `${patches.length} 个版本`);
check('版本索引一致', patches.length === patchIndex.length, `${patches.length}/${patchIndex.length}`);
check('最新版本一致', meta.latestPatch === patchIndex[0]?.version, meta.latestPatch);
check('版本中文内容存在', patches.some((patch) => patch.general.some((section) => /[\u4e00-\u9fff]/.test(section.title + section.notes.map((note) => note.text).join('')))), '检测到中文更新正文');
check('当前职业战队覆盖', esports.teams.filter((team) => team.roster.length).length >= 30, `${esports.teams.filter((team) => team.roster.length).length} 支当前阵容`);
check('职业选手覆盖', esports.players.filter((player) => player.teamSlug).length >= 150, `${esports.players.length} 名选手，${esports.players.filter((player) => player.teamSlug).length} 名在当前阵容`);
check('选手与战队标识唯一', unique(esports.players.map((player) => player.slug)) && unique(esports.teams.map((team) => team.slug)), '选手与战队 slug 无重复');
check('当前阵容关联完整', esports.teams.every((team) => team.roster.every((slug) => esports.players.some((player) => player.slug === slug))) && esports.players.every((player) => !player.teamSlug || esports.teams.some((team) => team.slug === player.teamSlug)), '选手与战队双向关联无断链');
check('职业图片本地化', esports.teams.every((team) => team.logo.startsWith('/assets/esports/')) && esports.players.every((player) => player.flag.startsWith('/assets/esports/')), '战队 Logo 与国籍旗帜均为本地缓存');
check('选手身份字段完整', esports.players.every((player) => ['Player', 'Coach', 'Retired', 'Inactive'].includes(player.identity)), '选手、教练、退役与非活跃状态均使用规范枚举');
check('选手顶部司职已解析', esports.players.filter((player) => player.primaryRole).length >= 225 && esports.players.filter((player) => player.position >= 1 && player.position <= 5).length >= 210, `${esports.players.filter((player) => player.primaryRole).length} 名含顶部司职，${esports.players.filter((player) => player.position >= 1 && player.position <= 5).length} 名含 1—5 号位`);
check('TI 参赛次数有效', esports.players.every((player) => Number.isInteger(player.tiAppearances) && player.tiAppearances >= 0) && esports.players.filter((player) => player.tiAppearances > 0).length >= 130, `${esports.players.filter((player) => player.tiAppearances > 0).length} 名选手含 TI 参赛记录`);
check('近期转会完整', esports.transfers.length === 50 && esports.transfers.every((transfer) => transfer.date && transfer.players.length && transfer.referenceUrl), `${esports.transfers.length} 条记录均含日期、选手与来源`);
check('来源可追溯', meta.sources?.length === 3 && meta.sources.every((source) => source.url), `${meta.sources?.length || 0} 个来源`);

const report = { generatedAt: new Date().toISOString(), passed: checks.every((item) => item.pass), checks };
await writeFile(path.join(DATA, 'validation-report.json'), JSON.stringify(report, null, 2));

for (const item of checks) console.log(`${item.pass ? '✓' : '✗'} ${item.name}：${item.detail}`);
if (!report.passed) process.exit(1);
