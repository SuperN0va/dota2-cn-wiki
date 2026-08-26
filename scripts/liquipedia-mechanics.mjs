const LIQUIPEDIA_API = 'https://liquipedia.net/dota2/api.php';
const LIQUIPEDIA_UA = 'MidianDotaKB/1.0 (https://openai.com/contact/; community knowledge project)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractTemplateBlocks(text, templateName) {
  const blocks = [];
  const escaped = templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\{\\{${escaped}\\b`, 'gi');
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 0;
    let end = -1;
    for (let index = match.index; index < text.length - 1; index += 1) {
      const pair = text.slice(index, index + 2);
      if (pair === '{{') {
        depth += 1;
        index += 1;
      } else if (pair === '}}') {
        depth -= 1;
        index += 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    blocks.push({ start: match.index, end, content: text.slice(match.index + match[0].length, end - 2) });
    pattern.lastIndex = end;
  }
  return blocks;
}

function collapseTemplateNewlines(value) {
  let depth = 0;
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === '{{') depth += 1;
    if (pair === '}}') depth = Math.max(0, depth - 1);
    result += value[index] === '\n' && depth > 0 ? ' ' : value[index];
  }
  return result;
}

function parseTemplateFields(content) {
  const fields = new Map();
  let currentKey = null;
  for (const line of collapseTemplateNewlines(content).split('\n')) {
    const field = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (field) {
      currentKey = field[1].trim().toLowerCase();
      fields.set(currentKey, field[2].trim());
    } else if (currentKey && line.trim()) {
      fields.set(currentKey, `${fields.get(currentKey)}\n${line.trim()}`.trim());
    }
  }
  return fields;
}

function splitTemplate(inner) {
  const parts = inner.split('|').map((part) => part.trim());
  const name = (parts.shift() || '').toLowerCase();
  const params = new Map();
  const positional = [];
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator > 0) params.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
    else positional.push(part);
  }
  return { name, params, positional };
}

function cleanMechanicTemplate(inner, fields) {
  const { name, params, positional } = splitTemplate(inner);
  if (name.startsWith('#var:')) {
    const fieldName = name.slice(5).trim().split(/\s+/).at(-1)?.toLowerCase();
    return fields.get(fieldName) || fieldName || '';
  }
  if (name.startsWith('#expr:')) return name.slice(6).trim();
  if (name === 'item cooldown sharing') {
    const items = [...params.entries()].filter(([key]) => /^item\d+$/.test(key)).map(([, value]) => value).filter(Boolean);
    return items.length ? `共享冷却：${items.join('、')}。使用其中任意一件会使其余物品同时进入冷却。` : '与同组物品共享冷却。';
  }
  const fixedCards = {
    spellblockcard: '遵循技能抵挡（Spell Block）的通用结算规则。',
    spellreflectcard: '遵循技能反弹（Spell Reflection）的通用结算规则。',
    innatecard: '包含英雄模型所需的隐藏先天能力。',
  };
  if (fixedCards[name]) return fixedCards[name];
  if (name === 'cf') return '';
  if (name === 'calc') return positional[0] || '';
  if (name === 'valuecolor') return positional.find((value) => value && !/^(?:agh|shd|tal|x)$/i.test(value)) || '';
  if (name === 'show') return positional.at(-1) || '';
  if (name === 'symbol') return positional[0] || '';
  if (['m', 'mechanic'].includes(name)) return params.get('text') || positional[0] || '';
  if (['a', 'h', 'u', 'i', 'cl'].includes(name)) return params.get('text') || positional.at(-1) || '';
  if (name === 'code') return positional[0] || '';
  return params.get('text') || params.get('desc') || params.get('alt') || positional.at(-1) || '';
}

function wikiToPlain(value, fields) {
  let text = String(value || '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<hr\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/'''?/g, '');
  for (let pass = 0; pass < 18; pass += 1) {
    const next = text.replace(/\{\{([^{}]+)\}\}/g, (_, inner) => cleanMechanicTemplate(inner, fields));
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/\[\[File:[^\]]+\]\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[\[\]]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

const phraseTranslations = [
  ['The ability effects are applied as follows:', '技能效果按以下顺序结算：'],
  ['The item effects are applied as follows:', '物品效果按以下顺序结算：'],
  ['The following properties apply:', '适用以下规则：'],
  ['Does not stack with', '不与以下效果叠加：'],
  ['Interacts with the following sources:', '会与以下来源产生相互作用：'],
  ['Does not interact with the following sources:', '不会与以下来源产生相互作用：'],
  ['Stacks additively with other', '与其他同类来源加法叠加：'],
  ['Stacks multiplicatively with other', '与其他同类来源乘法叠加：'],
  ['Reapplying the debuff refreshes its duration.', '再次施加该负面效果会刷新持续时间。'],
  ['Incoming projectiles are disjointed upon teleporting.', '传送时会躲避正在飞行的弹道。'],
  ['Utilizes the teleport mechanic.', '使用传送机制。'],
  ['upon cast', '施放时'],
  ['upon teleporting', '传送时'],
  ['enemy units', '敌方单位'],
  ['allied units', '友方单位'],
  ['the affected unit', '受影响单位'],
  ['the caster', '施法者'],
  ['the target', '目标'],
  ['movement speed', '移动速度'],
  ['attack speed', '攻击速度'],
  ['attack damage', '攻击伤害'],
  ['spell damage', '技能伤害'],
  ['magic resistance', '魔法抗性'],
  ['status resistance', '状态抗性'],
  ['health regeneration', '生命恢复'],
  ['mana regeneration', '魔法恢复'],
  ['damage block', '伤害格挡'],
  ['critical strike', '致命一击'],
  ['lifesteal', '攻击吸血'],
  ['projectiles', '弹道'],
  ['cooldown', '冷却时间'],
  ['duration', '持续时间'],
  ['radius', '作用范围'],
  ['distance', '距离'],
  ['damage', '伤害'],
  ['mana', '魔法值'],
  ['health', '生命值'],
  ['buff', '增益效果'],
  ['debuff', '负面效果'],
  ['illusion', '幻象'],
  ['teleport', '传送'],
  ['dispel', '驱散'],
  ['channeling', '持续施法'],
  ['sources', '来源'],
];

function replaceTerm(value, english, chinese) {
  return value.replace(new RegExp(`(?<![A-Za-z0-9_])${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'gi'), chinese);
}

function translateMechanicText(text, nameMap) {
  let result = text;
  for (const [english, chinese] of nameMap) result = replaceTerm(result, english, chinese);
  for (const [english, chinese] of phraseTranslations) result = replaceTerm(result, english, chinese);
  return result
    .replace(/^When targeting a point within (.+?) 距离, teleports directly onto the targeted point\.?$/i, '以不超过 $1 距离的地点为目标时，会直接传送到目标地点。')
    .replace(/^When targeting a point beyond (.+?) 距离, teleports (.+?) 距离 towards the targeted point instead\.?$/i, '以超过 $1 距离的地点为目标时，会朝目标方向传送 $2 距离。')
    .replace(/^The 伤害 冷却时间 always triggers, even if (.+)$/i, '伤害触发的冷却时间始终生效，即使$1')
    .replace(/^Doubletap targets a point in front of the team's Fountain, following the same behavior as above\.?$/i, '双击施法会以己方泉水前方的地点为目标，并遵循上述规则。')
    .replace(/^Locations of the fountains, relative to the center of the map:$/i, '泉水相对于地图中心的位置：');
}

function parseBulletNotes(raw, fields, nameMap) {
  if (!raw) return [];
  const expanded = wikiToPlain(raw, fields);
  const sourceLines = String(raw).split('\n').filter((line) => /^[*#]/.test(line.trim()));
  const lines = sourceLines.length ? sourceLines : expanded.split('\n').filter(Boolean).map((line) => `* ${line}`);
  const notes = [];
  for (const block of extractTemplateBlocks(String(raw), 'Item Cooldown Sharing')) {
    const original = cleanMechanicTemplate(`Item Cooldown Sharing|${block.content}`, fields);
    if (original) notes.push({ indent: 1, text: translateMechanicText(original, nameMap), original });
  }
  for (const line of lines) {
    const marker = line.trim().match(/^[*#]+/)?.[0] || '*';
    const original = wikiToPlain(line.trim().slice(marker.length).trim(), fields);
    if (!original) continue;
    if (/^(?:fx|bonus\s+(?:agh|shd|tal|cas|aoe)|modifier|target|affect|self|enemy|teleport)$/i.test(original)) continue;
    notes.push({ indent: Math.max(1, marker.length), text: translateMechanicText(original, nameMap), original });
  }
  if (!notes.length && expanded) notes.push({ indent: 1, text: translateMechanicText(expanded, nameMap), original: expanded });
  return notes;
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedRule(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (/^(?:true|yes)$/i.test(value)) return '是';
  if (/^(?:false|no)$/i.test(value)) return '否';
  if (/partially/i.test(value)) return '部分允许';
  return wikiToPlain(value, new Map()) || fallback;
}

function parseSpellcards(wikitext, nameMap, abilityNameByIntern = new Map()) {
  const abilities = {};
  const pageMechanics = [];
  for (const block of extractTemplateBlocks(wikitext, 'Spellcard')) {
    const fields = parseTemplateFields(block.content);
    const intern = fields.get('intern')?.trim();
    const englishName = wikiToPlain(fields.get('name') || '', fields) || '机制说明';
    const chineseName = abilityNameByIntern.get(intern) || englishName;
    const mechanics = parseBulletNotes(fields.get('mechanics'), fields, [...nameMap, [englishName, chineseName]]);
    const interactions = parseBulletNotes(fields.get('interacts') || fields.get('interactions'), fields, [...nameMap, [englishName, chineseName]]);
    const misc = parseBulletNotes(fields.get('miscnotes'), fields, [...nameMap, [englishName, chineseName]]);
    if (!mechanics.length && !interactions.length && !misc.length) continue;
    const entry = { name: chineseName, nameEnglish: englishName, mechanics, interactions, misc };
    if (intern) abilities[intern] = entry;
    else pageMechanics.push(entry);
  }
  return { abilities, pageMechanics };
}

export function inferItemEffectNames(description = '') {
  return String(description).split(/\n+/).flatMap((paragraph) => {
    const match = paragraph.trim().match(/^(?:主动|被动|使用|切换|开关|升级)\s*[：:]\s*(.+)$/i);
    if (!match) return [];
    const rest = match[1].trim();
    const spaced = rest.match(/^([^\s，。；:：]{1,20})\s+(.+)$/);
    if (spaced) return [spaced[1]];
    const verb = /(提供|给予|使|造成|增加|获得|消耗|传送|发射|召唤|切换|放置|摧毁|创建|攻击|施放|激活|回复|恢复|降低|提升|抵挡|格挡)/.exec(rest);
    if (verb?.index && verb.index <= 20) return [rest.slice(0, verb.index)];
    return rest.length <= 16 && !/[。；，]/.test(rest) ? [rest] : [];
  });
}

function walkMechanicNotes(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkMechanicNotes(entry, visitor));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.original === 'string' && typeof value.text === 'string') visitor(value);
  Object.values(value).forEach((entry) => walkMechanicNotes(entry, visitor));
}

export function preserveMechanicTranslations(next, previous = {}) {
  const translations = new Map();
  walkMechanicNotes(previous, (note) => {
    if (note.original && note.translationStatus === 'reviewed' && note.text !== note.original && /[\u4e00-\u9fff]/.test(note.text)) {
      translations.set(note.original, { text: note.text, translationStatus: 'reviewed' });
    }
  });
  walkMechanicNotes(next, (note) => {
    const preserved = translations.get(note.original);
    if (preserved) Object.assign(note, preserved);
    else note.translationStatus = /[\u4e00-\u9fff]/.test(note.original) ? 'reviewed' : 'source';
  });
  if (previous._meta?.translationVersion && translations.size) {
    next._meta.translationVersion = previous._meta.translationVersion;
    next._meta.translationSource = previous._meta.translationSource;
  }
  return next;
}

export function parseLiquipediaItemPage(wikitext, target, nameMap) {
  const infobox = extractTemplateBlocks(wikitext, 'Item infobox')[0];
  const fields = infobox ? parseTemplateFields(infobox.content) : new Map();
  const itemCost = parseNumber(fields.get('item cost')) ?? target.cost ?? 0;
  const explicitlySellable = fields.get('sellable');
  const sellable = explicitlySellable === undefined ? itemCost > 0 && target.neutralTier < 0 : !/^(?:false|no)$/i.test(explicitlySellable);
  const sellValue = sellable ? (parseNumber(fields.get('sell value')) ?? Math.floor(itemCost / 2)) : null;
  const shops = [];
  if (/true|yes/i.test(fields.get('base') || '')) shops.push('基础商店');
  if (/true|yes/i.test(fields.get('secret') || '')) shops.push('秘密商店');
  if (/true|yes/i.test(fields.get('neutral') || '') || target.neutralTier >= 0) shops.push('中立物品');
  const spellcards = parseSpellcards(wikitext, nameMap);
  spellcards.pageMechanics.forEach((entry, index) => {
    if (target.effectNames?.[index]) entry.name = target.effectNames[index];
  });
  return {
    category: wikiToPlain(fields.get('type') || '', fields),
    shops,
    sellable,
    sellValue,
    shareable: normalizedRule(fields.get('shareable'), '否'),
    disassemble: normalizedRule(fields.get('disassemble'), '否'),
    droppable: normalizedRule(fields.get('droppable'), '是'),
    destroyable: normalizedRule(fields.get('destroyable'), '是'),
    maxStack: wikiToPlain(fields.get('max stack') || '', fields) || null,
    charges: parseNumber(fields.get('charges')),
    ...spellcards,
  };
}

export function parseLiquipediaHeroPage(wikitext, target, nameMap) {
  const abilityNameByIntern = new Map((target.abilities || []).map((ability) => [ability.slug, ability.name]));
  return parseSpellcards(wikitext, nameMap, abilityNameByIntern);
}

export async function fetchLiquipediaMechanics(targets, parser) {
  const result = {};
  const batches = Array.from({ length: Math.ceil(targets.length / 20) }, (_, index) => targets.slice(index * 20, index * 20 + 20));
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const url = new URL(LIQUIPEDIA_API);
    const params = {
      action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main',
      titles: batch.map((target) => target.title).join('|'), redirects: '1', format: 'json', formatversion: '2',
    };
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': LIQUIPEDIA_UA } });
    if (!response.ok) throw new Error(`Liquipedia mechanics ${response.status} ${response.statusText}`);
    const payload = await response.json();
    const redirects = new Map((payload.query?.redirects || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const normalized = new Map((payload.query?.normalized || []).map((entry) => [entry.from.toLowerCase(), entry.to.toLowerCase()]));
    const pageMap = new Map((payload.query?.pages || []).map((page) => [page.title.toLowerCase(), page]));
    for (const target of batch) {
      let resolved = normalized.get(target.title.toLowerCase()) || target.title.toLowerCase();
      resolved = redirects.get(resolved) || resolved;
      const page = pageMap.get(resolved);
      const revision = page?.revisions?.[0];
      if (!revision) continue;
      const parsed = parser(revision.slots?.main?.content || '', target);
      result[target.slug] = {
        ...parsed,
        sourceUrl: `https://liquipedia.net/dota2/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        revisionId: revision.revid,
        updatedAt: revision.timestamp,
      };
    }
    console.log(`Liquipedia 机制资料 ${index + 1}/${batches.length}`);
    if (index < batches.length - 1) await sleep(2100);
  }
  return result;
}
