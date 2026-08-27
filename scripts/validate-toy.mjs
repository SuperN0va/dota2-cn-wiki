import { access, readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'toy-dist');
const strictAssets = process.argv.includes('--strict-assets');
const failures = [];
const warnings = [];

async function readJson(relative) {
  try {
    return JSON.parse(await readFile(path.join(OUT, relative), 'utf8'));
  } catch (error) {
    failures.push(`${relative}: ${error.message}`);
    return null;
  }
}

async function exists(relative) {
  try {
    await access(path.join(OUT, relative));
    return true;
  } catch {
    return false;
  }
}

function encoded(value) {
  return encodeURIComponent(value).replace(/%/g, '_');
}

function duplicateValues(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

function collectAssetReferences(value, key = '', refs = new Set()) {
  if (typeof value === 'string') {
    if (/^(assets|media)\//.test(value)) refs.add(value);
    if (/^https:\/\//i.test(value) && /\.(png|jpe?g|webp)(?:$|\?)/i.test(value)) {
      warnings.push(`仍使用远程图片：${key || 'unknown'} -> ${value}`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectAssetReferences(entry, key, refs));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, entry]) => collectAssetReferences(entry, childKey, refs));
  }
  return refs;
}

async function walk(relative = '') {
  const entries = await readdir(path.join(OUT, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(next));
    else files.push(next);
  }
  return files;
}

if (!await exists('index.html')) failures.push('上传根目录缺少 index.html');
const manifest = await readJson('toy-manifest.json');
const index = await readJson('data/index.json');

if (manifest && index) {
  const countChecks = [
    ['heroes', index.heroes], ['items', index.items], ['patches', index.patches],
    ['players', index.players], ['teams', index.teams],
  ];
  for (const [key, values] of countChecks) {
    if (manifest.counts[key] !== values.length) failures.push(`${key} 数量不一致：manifest=${manifest.counts[key]} index=${values.length}`);
  }
  for (const [key, values] of [['hero slug', index.heroes.map((entry) => entry.slug)], ['item slug', index.items.map((entry) => entry.slug)], ['patch version', index.patches.map((entry) => entry.version)]]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) failures.push(`${key} 重复：${[...new Set(duplicates)].join(', ')}`);
  }
  for (const hero of index.heroes) if (!await exists(`data/heroes/${encoded(hero.slug)}.json`)) failures.push(`英雄详情缺失：${hero.slug}`);
  for (const item of index.items) if (!await exists(`data/items/${encoded(item.slug)}.json`)) failures.push(`物品详情缺失：${item.slug}`);
  for (const patch of index.patches) if (!await exists(`data/patches/${encoded(patch.version)}.json`)) failures.push(`版本详情缺失：${patch.version}`);
  if (manifest.unresolvedRemoteAssets > 0) {
    const message = `${manifest.unresolvedRemoteAssets} 张图片仍依赖远程地址`;
    if (strictAssets) failures.push(message); else warnings.push(message);
  }
}

const files = await walk();
const jsonFiles = files.filter((file) => file.endsWith('.json'));
const refs = new Set();
for (const file of jsonFiles) {
  const value = await readJson(file);
  if (value) collectAssetReferences(value, '', refs);
}
for (const ref of refs) if (!await exists(ref)) failures.push(`本地图片引用不存在：${ref}`);

for (const file of ['index.html', 'app.js', 'styles.css']) {
  const source = await readFile(path.join(OUT, file), 'utf8');
  if (/(?:src|href)=["']\/(?!\/)/i.test(source)) failures.push(`${file} 含根路径资源引用，嵌套发布会失效`);
  if (/fetch\s*\(\s*["']\/(?!\/)/i.test(source)) failures.push(`${file} 含根路径数据请求，嵌套发布会失效`);
}

const bytes = (await Promise.all(files.map(async (file) => (await stat(path.join(OUT, file))).size))).reduce((sum, size) => sum + size, 0);
console.log(`Toy validation: ${files.length} files · ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(`Content: ${index?.heroes?.length || 0} heroes · ${index?.items?.length || 0} items · ${index?.patches?.length || 0} patches`);
console.log(`Local asset references checked: ${refs.size}`);
if (warnings.length) {
  console.warn(`Warnings: ${warnings.length}`);
  warnings.slice(0, 12).forEach((warning) => console.warn(`  - ${warning}`));
  if (warnings.length > 12) console.warn(`  … ${warnings.length - 12} more`);
}
if (failures.length) {
  console.error(`Failures: ${failures.length}`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
} else {
  console.log('PASS: package is structurally ready for nested static hosting.');
}
