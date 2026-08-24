import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA = path.join(process.cwd(), 'data');
const load = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));
const [heroes, items, patches, patchIndex, meta] = await Promise.all([
  load('heroes.json'), load('items.json'), load('patches.json'), load('patch-index.json'), load('meta.json'),
]);

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
const unique = (values) => new Set(values).size === values.length;

check('英雄总数', heroes.length >= 120, `${heroes.length} 位`);
check('英雄 ID 唯一', unique(heroes.map((hero) => hero.id)), '无重复 ID');
check('英雄中文资料完整', heroes.every((hero) => hero.name && hero.bio && hero.abilities.length), '名称、背景、技能均存在');
check('英雄图片地址完整', heroes.every((hero) => hero.image.startsWith('https://')), '均使用 HTTPS');
check('物品记录总数', items.length >= 500, `${items.length} 条`);
check('物品 ID 唯一', unique(items.map((item) => item.id)), '无重复 ID');
check('官方版本覆盖', patches.length >= 100, `${patches.length} 个版本`);
check('版本索引一致', patches.length === patchIndex.length, `${patches.length}/${patchIndex.length}`);
check('最新版本一致', meta.latestPatch === patchIndex[0]?.version, meta.latestPatch);
check('版本中文内容存在', patches.some((patch) => patch.general.some((section) => /[\u4e00-\u9fff]/.test(section.title + section.notes.map((note) => note.text).join('')))), '检测到中文更新正文');
check('来源可追溯', meta.sources?.length === 3 && meta.sources.every((source) => source.url), `${meta.sources?.length || 0} 个来源`);

const report = { generatedAt: new Date().toISOString(), passed: checks.every((item) => item.pass), checks };
await writeFile(path.join(DATA, 'validation-report.json'), JSON.stringify(report, null, 2));

for (const item of checks) console.log(`${item.pass ? '✓' : '✗'} ${item.name}：${item.detail}`);
if (!report.passed) process.exit(1);
