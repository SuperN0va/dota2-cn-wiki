import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
const load = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
const [heroes, items, patches, patchIndex, meta, legacy, esports, itemStructures, mechanics] = await Promise.all([
  load('heroes.json'), load('items.json'), load('patches.json'), load('patch-index.json'), load('meta.json'), load('legacy.json'), load('esports.json'), load('item-structures.json'), load('liquipedia-mechanics.json'),
]);
const [recipeIcon, dataModuleSource, syncSource, mechanicUiSource, heroPageSource, itemPageSource] = await Promise.all([
  readFile(path.join(process.cwd(), 'public', 'assets', 'item-recipe.png')).catch(() => null),
  readFile(path.join(process.cwd(), 'lib', 'data.ts'), 'utf8'),
  readFile(path.join(process.cwd(), 'scripts', 'sync-data.mjs'), 'utf8'),
  readFile(path.join(process.cwd(), 'components', 'mechanic-details.tsx'), 'utf8'),
  readFile(path.join(process.cwd(), 'app', 'heroes', '[slug]', 'page.tsx'), 'utf8'),
  readFile(path.join(process.cwd(), 'app', 'items', '[slug]', 'page.tsx'), 'utf8'),
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
    && dataModuleSource.includes("normalizedItem.isRecipe ? { ...normalizedItem, image: '/assets/item-recipe.png' }")
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
const blinkItemIds = new Set([1, 600, 603, 604]);
const patch739 = patches.find((patch) => patch.version === '7.39');
const blinkPenaltyRemovalRecords = patch739?.items
  .filter((item) => blinkItemIds.has(item.id))
  .filter((item) => item.notes.some((note) => /不再拥有超出距离的惩罚/.test(note.text))) || [];
check(
  '闪烁超距惩罚字段已废弃',
  blinkPenaltyRemovalRecords.length === 4
    && dataModuleSource.includes("blinkPenaltyRemovedSlugs")
    && dataModuleSource.includes("'blink_range_clamp'")
    && syncSource.includes('BLINK_PENALTY_REMOVED_ITEMS')
    && syncSource.includes("'blink_range_clamp'"),
  `${blinkPenaltyRemovalRecords.length}/4 件闪烁物品保留 7.39 历史记录，现行资料不再展示 960/1120 的旧惩罚落点`,
);
const itemSlugs = new Set(items.map((item) => item.slug));
const recipeStructures = Object.values(itemStructures.items).filter((item) => item.components.length);
const abilityStructures = Object.values(itemStructures.items).filter((item) => item.abilities.length);
const missingRecipeComponents = [...new Set(recipeStructures.flatMap((item) => item.components).filter((slug) => !itemSlugs.has(slug)))];
check('物品配方结构完整', recipeStructures.length >= 100 && missingRecipeComponents.length === 0, `${recipeStructures.length} 份配方，${missingRecipeComponents.length ? `缺少 ${missingRecipeComponents.join('、')}` : '所有组件均可点击关联'}`);
check('物品效果类型完整', abilityStructures.length >= 250 && abilityStructures.every((item) => item.abilities.every((ability) => ability.type && ability.title)), `${abilityStructures.length} 件物品含主动、被动或使用效果结构`);
const mechanicNotes = [];
const walkMechanics = (value) => {
  if (Array.isArray(value)) return value.forEach(walkMechanics);
  if (!value || typeof value !== 'object') return;
  if (typeof value.original === 'string' && typeof value.text === 'string') mechanicNotes.push(value);
  Object.values(value).forEach(walkMechanics);
};
walkMechanics(mechanics.items);
walkMechanics(mechanics.heroes);
const heroMechanicAbilityCount = Object.values(mechanics.heroes).reduce((sum, profile) => sum + Object.keys(profile.abilities || {}).length, 0);
const reviewedMechanicNotes = mechanicNotes.filter((note) => note.translationStatus === 'reviewed');
const nonReviewedMechanicNotes = mechanicNotes.filter((note) => note.translationStatus !== 'reviewed');
const suspiciousMechanicNotes = reviewedMechanicNotes.filter((note) => /电话|交易|调试|我是个英雄|抛物器|可怕的英雄|成功的入侵|影响奖金|纪念品的伪|维基百科|维基文库|ZXQ|QXZ|⁇/i.test(note.text));
const unresolvedMechanicNotes = mechanicNotes.filter((note) => /(?:;[A-Za-z][A-Za-z0-9_]*|%\/[A-Za-z]+\d*|\b(?:round|floor|ceil)\d+\b|\b[vr]\d+\b|\bt\d+r\b|\bbonus (?:agh|aoe|shd|t\d+[a-z]?)\b|\bModifier\s+[a-z0-9_]+|\b(?:Affect|Toggle|Autocast)\b|Abilities#|[a-z]+_[a-z0-9_]+|<\s*Abilities)/i.test(note.original));
check('物品机制来源覆盖', mechanics._meta.itemCount >= 390 && Object.values(mechanics.items).every((profile) => profile.sourceUrl && profile.revisionId), `${mechanics._meta.itemCount} 件当前物品关联 Liquipedia 修订版本`);
check('英雄技能机制覆盖', mechanics._meta.heroCount === heroes.length && heroMechanicAbilityCount >= 700 && Object.values(mechanics.heroes).every((profile) => profile.sourceUrl && profile.revisionId), `${mechanics._meta.heroCount}/${heroes.length} 位英雄，${heroMechanicAbilityCount} 个技能机制块`);
check('机制英文原文可回检', mechanicNotes.length >= 15000 && mechanicNotes.every((note) => note.original.trim()), `${mechanicNotes.length} 条机制均保留英文原文`);
check('机制翻译状态完整', mechanics._meta.translationVersion >= 2 && mechanicNotes.every((note) => ['reviewed', 'machine', 'source'].includes(note.translationStatus)), `${reviewedMechanicNotes.length} 条人工校对，${nonReviewedMechanicNotes.length} 条采用英文原文展示`);
check('未经校对内容回退英文', mechanicUiSource.includes("reviewed ? note.text : note.original") && mechanicUiSource.includes('英文原文'), '机器草稿不会作为中文正文展示');
check('历史补充回退英文', heroPageSource.includes('sourceOnly') && heroPageSource.includes('note.original || note.text') && itemPageSource.includes('note.original || note.text'), 'Liquipedia 未校对历史不再显示中英混排草稿');
check('人工校对译文有效', reviewedMechanicNotes.length >= 40 && reviewedMechanicNotes.every((note) => /[\u4e00-\u9fff]/.test(note.text)), `${reviewedMechanicNotes.length} 条校对译文均含中文`);
check('人工校对译文无异常模式', suspiciousMechanicNotes.length === 0, suspiciousMechanicNotes.length ? `异常 ${suspiciousMechanicNotes.length} 条` : '人工译文无机器误译标记或占位符残留');
check('机制原文无模板噪声', unresolvedMechanicNotes.length === 0, unresolvedMechanicNotes.length ? `异常 ${unresolvedMechanicNotes.length} 条` : '未解析变量和内部模板记录已剔除');
const invalidSales = Object.entries(mechanics.items).filter(([, profile]) => profile.sellable && (!Number.isFinite(profile.sellValue) || profile.sellValue < 0));
check('物品售价规则完整', invalidSales.length === 0 && mechanics.items.arcane_blink?.sellValue === 3400 && mechanics.items.blink?.sellValue === 1125, invalidSales.length ? `异常：${invalidSales.map(([slug]) => slug).join('、')}` : '可出售物品均含售价；闪烁匕首与秘奥闪光抽查通过');
const blinkMechanicText = (mechanics.items.blink?.pageMechanics || []).flatMap((block) => block.mechanics || []).map((note) => note.text).join(' ');
check('闪烁当前机制同步', /1200/.test(blinkMechanicText) && !/960|1120/.test(blinkMechanicText), '机制详情使用当前最大闪烁距离，不含旧超距惩罚数值');
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
