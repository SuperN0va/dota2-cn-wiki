"""Translate parsed Liquipedia mechanics while protecting Valve terminology.

This is a build-time helper. The NLLB model and Python packages live in ignored
local directories; only the translated static JSON is committed.
"""

from __future__ import annotations

import json
import re
import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

OFFICIAL_TERMS = {
    "Ability": "技能",
    "Mechanic": "机制",
    "Mechanics": "机制",
    "Attack Damage": "攻击伤害",
    "Spell Damage": "技能伤害",
    "Physical Damage": "物理伤害",
    "Magical Damage": "魔法伤害",
    "Pure Damage": "纯粹伤害",
    "HP Removal": "生命移除",
    "Damage": "伤害",
    "Health": "生命值",
    "Mana": "魔法值",
    "Armor": "护甲",
    "Strength": "力量",
    "Agility": "敏捷",
    "Intelligence": "智力",
    "Universal": "全才",
    "Projectile": "弹道",
    "Projectiles": "弹道",
    "Distance": "距离",
    "Point": "点",
    "Modifier": "状态效果",
    "Aura": "光环",
    "Stun": "眩晕",
    "Silence": "沉默",
    "Root": "缠绕",
    "Leash": "束缚",
    "Debuff Immunity": "负面效果免疫",
    "Spell Immunity": "技能免疫",
    "Spell Block": "技能抵挡",
    "Spell Reflection": "技能反弹",
    "Basic Dispel": "弱驱散",
    "Strong Dispel": "强驱散",
    "Dispel": "驱散",
    "Incoming Projectiles": "飞行中的弹道",
    "Disjointed": "躲避",
    "Teleport": "传送",
    "Blink": "闪烁",
    "Lifesteal": "攻击吸血",
    "Spell Lifesteal": "技能吸血",
    "Critical Strike": "致命一击",
    "Cleave": "分裂",
    "Damage Block": "伤害格挡",
    "Damage Barrier": "伤害屏障",
    "Evasion": "闪避",
    "Status Resistance": "状态抗性",
    "Slow Resistance": "减速抗性",
    "Phased Movement": "相位移动",
    "Magic Resistance": "魔法抗性",
    "Movement Speed": "移动速度",
    "Attack Speed": "攻击速度",
    "Cast Range": "施法距离",
    "Cast Point": "施法前摇",
    "Cooldown": "冷却时间",
    "Effect Radius": "作用范围",
    "Attack Modifier": "攻击特效",
    "Illusion": "幻象",
    "Clone": "克隆体",
    "Clones": "克隆体",
    "Channeling": "持续施法",
    "Illusions": "幻象",
    "Spirit Bear": "熊灵",
    "Buff": "增益效果",
    "Buffs": "增益效果",
    "Debuff": "负面效果",
    "Debuffs": "负面效果",
    "Enemy Unit": "敌方单位",
    "Enemy Units": "敌方单位",
    "Allied Unit": "友方单位",
    "Allied Units": "友方单位",
    "Ward": "守卫",
    "Ward-type Units": "守卫类单位",
    "Caster": "施法者",
    "Casters": "施法者",
    "Target": "目标",
    "Pseudo-random Distribution": "伪随机分布",
    "Hero": "英雄",
    "Heroes": "英雄",
    "Creep": "小兵",
    "Creeps": "小兵",
    "Creep-Hero": "类英雄单位",
    "Creep-Heroes": "类英雄单位",
    "Roshan": "肉山",
    "Radiant": "天辉",
    "Dire": "夜魇",
    "Fountain": "泉水",
    "Doubletap": "双击施法",
    "Aghanim's Scepter": "阿哈利姆神杖",
    "Aghanim's Shard": "阿哈利姆魔晶",
}

EXACT_TRANSLATIONS = {
    "The ability effects are applied as follows:": "技能效果按以下顺序结算：",
    "The item effects are applied as follows:": "物品效果按以下顺序结算：",
    "Incoming projectiles are disjointed upon teleporting.": "传送时会躲避飞行中的弹道。",
    "Utilizes the teleport mechanic.": "使用传送机制。",
    "Reapplying the debuff refreshes its duration.": "再次施加该负面效果会刷新持续时间。",
    "Locations of the fountains, relative to the center of the map:": "泉水相对于地图中心的位置：",
    "Blink utilizes the teleport mechanic, and has the following properties:": "闪烁使用传送机制，并具有以下特性：",
    "When targeting a point within 1200 distance, teleports directly onto the targeted point.": "以距离不超过 1200 的点为目标时，会直接传送到目标点。",
    "When targeting a point beyond 1200 distance, teleports 1200 distance towards the targeted point instead.": "以超过 1200 距离的点为目标时，会朝目标方向传送 1200 距离。",
    "Doubletap targets a point in front of the team's Fountain, following the same behavior as above.": "双击施法会以己方泉水前方的点为目标，并遵循上述规则。",
    "Radiant Fountain: -7456 / -6938": "天辉泉水：-7456 / -6938",
    "Dire Fountain: 7408 / 6848": "夜魇泉水：7408 / 6848",
    "Disjoints incoming projectiles upon cast.": "施法时会躲避飞行中的弹道。",
    "Doubletap automatically self-targets.": "双击施法会自动以自身为目标。",
    "Does not stack with Shade Sight.": "不与月夜之视叠加。",
    "Considers the Spirit Bear as heroes; clones, illusions and other creep-heroes as creeps.": "熊灵视为英雄；克隆体、幻象和其他类英雄单位视为小兵。",
    "When Target Target point-targeted beyond the min or max distance, Blink teleports Anti-Mage toward the min or max distance respectively.": "目标点超出最小或最大距离时，闪烁会使敌法师分别朝目标方向移动至对应的最小或最大距离。",
    "Considers the enemy being in front of the Wheel, when the Wheel is within ≈(acos0.08715*180/pi round0);enemy facing angle*2° of a circular segment of the affected enemy, regardless of the Wheel's facing angle within the effect radius.": "当轮盘位于受影响敌人前方，以敌人朝向为中心的圆弧扇区总夹角约为 (acos(0.08715) × 180 / π) × 2° 时，即视为敌人在轮盘前方；只要轮盘位于作用范围内，判定不受轮盘自身朝向影响。",
    "The damage cooldown always triggers, even if the item is dropped, if the item is in the backpack or before being purchased.": "伤害触发的冷却始终会生效，即使物品已丢在地上、位于背包中，或尚未购买。",
    "The shockwave at the teleport location is instant, despite the visual effect.": "虽然存在视觉效果，但传送落点的冲击波会立即生效。",
    "The shockwave first applies the debuff, then the impact damage.": "冲击波会先施加负面效果，再结算冲击伤害。",
    "Grants the caster phased movement.": "使施法者获得相位移动。",
    "Considers clones, illusions, and creep-heroes as heroes.": "将克隆体、幻象和类英雄单位视为英雄。",
    "Treats illusions and creep-heroes as heroes.": "将幻象和类英雄单位视为英雄。",
    "Treats creep-heroes as heroes.": "将类英雄单位视为英雄。",
    "Has an instant cast time.": "施法时间为 0。",
    "Item abilities.": "物品技能。",
    "Invulnerable units.": "无敌单位。",
    "Centered on Doom upon cast for the entire duration.": "施法后始终以末日使者为中心，持续整个作用时间。",
    "Deals damage in 1-second intervals, starting 1 second after cast, over 6.66 instances.": "每 1 秒造成一次伤害，施法 1 秒后首次触发，共触发 6.66 次。",
    "Affected by attack range sources of the same range-type as the caster.": "受与施法者同类型的攻击距离来源影响。",
    "Acquires the affected neutral creep's abilities upon cast, regardless of its owner.": "施放吞噬时，末日使者会获得目标中立生物的技能，无论该单位当前由谁控制。",
    "The acquired abilities appear in the dedicated fourth and fifth ability slot.": "获得的技能会出现在专用的第 4 和第 5 个技能栏位中。",
    "The digest duration is independent of the cooldown or the facet's restore time.": "消化时间与技能冷却时间或充能恢复时间相互独立。",
    "Each cast places a new buff on Lucifer, with each buff duration independent of the other.": "每次施放吞噬都会为末日使者添加一个独立的增益效果，各个增益效果的持续时间互不影响。",
    "Lane Creeps or Neutral Creeps": "线上小兵或中立生物",
    "Instant kills the affected creep.": "立即杀死目标小兵或中立生物。",
    "Grants self unreliable gold and experience like a regular last hit.": "视为一次普通补刀，使末日使者获得对应的不可靠金钱和经验。",
    "Applies the self-buff.": "随后对末日使者施加相应的增益效果。",
    "Cannot devour the following units:": "无法吞噬以下单位：",
    "Ancient creeps.": "远古生物。",
    "Creep-heroes": "类英雄单位。",
    "Roshan and the Tormentor.": "肉山和痛苦魔方。",
    "Ward-type units.": "守卫类单位。",
    "Additionally, the following neutral creeps cannot be targeted due to the level restrictions:": "此外，由于吞噬的目标等级限制，以下中立生物也无法成为目标：",
    "Can devour all creeps.": "可以吞噬所有小兵和中立生物。",
}


def manual_translation(original: str):
    if original in EXACT_TRANSLATIONS:
        return EXACT_TRANSLATIONS[original]
    match = re.fullmatch(r"When targeting a point within (\d+) distance, teleports directly onto the targeted point\.", original)
    if match:
        return f"以距离不超过 {match.group(1)} 的点为目标时，会直接传送到目标点。"
    match = re.fullmatch(r"When targeting a point beyond (\d+) distance, teleports (\d+) distance towards the targeted point instead\.", original)
    if match:
        return f"以超过 {match.group(1)} 距离的点为目标时，会朝目标方向传送 {match.group(2)} 距离。"
    return None


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def iter_blocks(record):
    yield from record.get("abilities", {}).values()
    yield from record.get("pageMechanics", [])


def iter_notes(block):
    for kind in ("mechanics", "interactions", "misc"):
        yield from block.get(kind, [])


def good_existing_translation(value: str) -> bool:
    return len(re.findall(r"[\u4e00-\u9fff]", value or "")) >= 5 and not re.search(r"[A-Za-z]{4,}", value or "")


def useful_note(value: str) -> bool:
    text = value.strip()
    if not text or "{{" in text or "}}" in text:
        return False
    if len(text) < 12 and not re.search(r"[\u4e00-\u9fff]", text):
        return False
    if re.fullmatch(r"(?:[A-Za-z]{1,16}|[\W\d_]+)", text):
        return False
    if re.search(r"\bbonus agh\b|\bModifier\s+[a-z0-9_]+|Abilities#|[a-z]+_[a-z0-9_]+|<\s*Abilities|\binvoke\b", text, re.I):
        return False
    if re.search(r"(?:;[A-Za-z][A-Za-z0-9_]*|%/[A-Za-z]+\d*|\b(?:round|floor|ceil)\d+\b|\b[vr]\d+\b|\bt\d+r\b)", text, re.I):
        return False
    if re.search(r"\bbonus\s+(?:aoe|shd|t\d+[a-z]?)\b|\b(?:Affect|Toggle|Autocast)\b", text):
        return False
    if re.fullmatch(r"(?:Damage\s+)?(?:Spell Damage|Attack Damage|Physical Damage|Magical Damage|Pure Damage)", text, re.I):
        return False
    if re.fullmatch(r"(?:Affect|bonus|UnitBound|CurrentHP|Charge Speed)[A-Za-z0-9 ]*", text, re.I):
        return False
    if re.search(r"\b[A-Za-z]+(?:Duration|Radius|Speed|Range|Factor|Count)\b", text):
        return False
    return True


def compile_terms(glossary: dict[str, str]):
    pairs = [(english, chinese) for english, chinese in glossary.items() if english and english.lower() != chinese.lower()]
    if not pairs:
        return None
    values = {english.casefold(): chinese for english, chinese in pairs}
    alternatives = "|".join(re.escape(english) for english, _ in sorted(pairs, key=lambda pair: len(pair[0]), reverse=True))
    return re.compile(rf"(?<![A-Za-z0-9_])(?:{alternatives})(?![A-Za-z0-9_])", re.I), values


def protect_terms(text: str, matchers):
    replacements = []
    protected = text
    for matcher in matchers:
        if not matcher:
            continue
        pattern, values = matcher
        def replace(match):
            token = f"ZXQ{len(replacements)}QXZ"
            replacements.append((token, values[match.group(0).casefold()]))
            return token
        protected = pattern.sub(replace, protected)
    return protected, replacements


def restore_terms(text: str, replacements):
    result = text
    for token, chinese in replacements:
        result = result.replace(token, chinese)
    return result


def polish(text: str) -> str:
    result = text.strip()
    replacements = {
        "敌方部队": "敌方单位",
        "友军部队": "友方单位",
        "铸造": "施法",
        "施法者本人": "施法者",
        "脱节": "躲避",
        "投射物": "弹道",
        "冷却期": "冷却时间",
        "去波": "驱散",
        "魔幻的": "魔法",
        "魔幻": "魔法",
        "不易受伤": "无敌",
        "没有影响": "不影响",
        "没有目标的": "无法作为目标的",
        "隐藏的部队": "隐藏单位",
        "部队": "单位",
        "单元": "单位",
        "项目": "物品",
        "射线": "半径",
        "演员时间": "施法时间",
        "演员": "施法",
        "爬虫类": "小兵",
        "伪物体": "伪物品",
        "长期的负面效果": "负面效果持续时间",
        "长期的幻象": "幻象持续时间",
        "长期的眩晕": "眩晕持续时间",
        "长期眩晕": "眩晕持续时间",
        "长期不受": "持续时间不受",
        "有一个即时的施法时间": "施法时间为 0",
        "影响了以下问题": "影响以下对象",
    }
    for old, new in replacements.items():
        result = result.replace(old, new)
    result = re.sub(r"\s+([，。；：、])", r"\1", result)
    result = result.replace(",", "，").replace(";", "；")
    result = result.replace("⁇", "")
    return result


def safe_translation(original: str, translated: str, replacements) -> bool:
    if not re.search(r"[\u4e00-\u9fff]", translated):
        return False
    if re.search(r"ZXQ\d+QXZ|ZXQ|QXZ|ZQ\d|XQ\d|Q\d+Q|\bQQ\b|维基百科|维基文库", translated, re.I):
        return False
    if re.search(r"电话|交易|调试|我是个英雄|抛物器|可怕的英雄|成功的入侵|影响奖金|纪念品的伪", translated):
        return False
    if len(translated) > max(90, len(original) * 2.3):
        return False
    for _, chinese in replacements:
        if chinese not in translated:
            return False
    source_numbers = re.findall(r"(?<![A-Za-z_])-?\d+(?:\.\d+)?", original)
    if any(number not in translated for number in source_numbers):
        return False
    normalized = re.sub(r"\s+", "", translated)
    chunks = re.findall(r"[\u4e00-\u9fff]{4,12}", normalized)
    if any(normalized.count(chunk) >= 3 for chunk in chunks):
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Apply reviewed Dota translations and optionally refresh machine drafts.")
    parser.add_argument(
        "--review-only",
        action="store_true",
        help="Apply human-reviewed translations and mark every other note for English source display without loading NLLB.",
    )
    args = parser.parse_args()
    mechanics = load("liquipedia-mechanics.json")
    items = load("items.json")
    heroes = load("heroes.json")

    global_name_glossary = {item["nameEnglish"]: item["name"] for item in items if item.get("nameEnglish") and item.get("name")}
    global_name_glossary.update({hero["nameEnglish"]: hero["name"] for hero in heroes if hero.get("nameEnglish") and hero.get("name")})
    global_name_matcher = compile_terms(global_name_glossary)
    official_term_matcher = compile_terms(OFFICIAL_TERMS)

    hero_by_slug = {hero["slug"]: hero for hero in heroes}
    jobs = []
    for section_name in ("items", "heroes"):
        for slug, record in mechanics.get(section_name, {}).items():
            local_glossary = {}
            if section_name == "heroes":
                official_abilities = {ability["slug"]: ability["name"] for ability in hero_by_slug.get(slug, {}).get("abilities", [])}
                for intern, block in record.get("abilities", {}).items():
                    if block.get("nameEnglish") and official_abilities.get(intern):
                        local_glossary[block["nameEnglish"]] = official_abilities[intern]
            for block in iter_blocks(record):
                if block.get("nameEnglish") and block.get("name") and block["nameEnglish"] != block["name"]:
                    local_glossary[block["nameEnglish"]] = block["name"]
            local_matcher = compile_terms(local_glossary)
            for block in iter_blocks(record):
                for kind in ("mechanics", "interactions", "misc"):
                    block[kind] = [note for note in block.get(kind, []) if useful_note(note.get("original", ""))]
                for note in iter_notes(block):
                    original = note.get("original", "").strip()
                    if not original:
                        continue
                    previous_text = note.get("text", original)
                    # Always restart from the preserved English source. This
                    # prevents interrupted translation checkpoints from being
                    # treated as authoritative input on the next run.
                    note["text"] = original
                    note["translationStatus"] = "source"
                    manual = manual_translation(original)
                    if manual:
                        note["text"] = manual
                        note["translationStatus"] = "reviewed"
                        continue
                    if re.search(r"[\u4e00-\u9fff]", original):
                        note["translationStatus"] = "reviewed"
                        continue
                    if args.review_only:
                        if previous_text != original and re.search(r"[\u4e00-\u9fff]", previous_text):
                            note["text"] = previous_text
                            note["translationStatus"] = "machine"
                        continue
                    protected, replacements = protect_terms(original, (global_name_matcher, local_matcher, official_term_matcher))
                    jobs.append((note, protected, replacements))

    mechanics.setdefault("_meta", {})["translationVersion"] = 2
    mechanics["_meta"]["translationSource"] = "Human-reviewed Chinese only in UI; machine drafts hidden; readable English source fallback"
    if args.review_only:
        (DATA / "liquipedia-mechanics.json").write_text(json.dumps(mechanics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        reviewed = sum(1 for section in ("items", "heroes") for record in mechanics.get(section, {}).values() for block in iter_blocks(record) for note in iter_notes(block) if note.get("translationStatus") == "reviewed")
        source = sum(1 for section in ("items", "heroes") for record in mechanics.get(section, {}).values() for block in iter_blocks(record) for note in iter_notes(block) if note.get("translationStatus") == "source")
        machine = sum(1 for section in ("items", "heroes") for record in mechanics.get(section, {}).values() for block in iter_blocks(record) for note in iter_notes(block) if note.get("translationStatus") == "machine")
        print(f"人工校对 {reviewed} 条；英文原文 {source} 条；隐藏机器草稿 {machine} 条。")
        return

    import ctranslate2
    import sentencepiece as spm

    model_path = ROOT / ".translation-models" / "nllb-ct2-int8"
    if not (model_path / "model.bin").exists() or not (model_path / "sentencepiece.bpe.model").exists():
        raise SystemExit("缺少 .translation-models/nllb-ct2-int8；请先下载本地 NLLB CTranslate2 模型。")
    tokenizer = spm.SentencePieceProcessor(model_file=str(model_path / "sentencepiece.bpe.model"))
    translator = ctranslate2.Translator(
        str(model_path),
        device="cpu",
        compute_type="int8",
        inter_threads=1,
        intra_threads=4,
    )
    inputs = set()
    for note, protected, replacements in jobs:
        inputs.add(protected)
    unique_jobs = sorted(inputs, key=lambda value: (len(value), value))
    cache = {}
    completed = 0
    batch_number = 0
    while completed < len(unique_jobs):
        start = completed
        char_budget = 1800
        used_chars = 0
        unique_inputs = []
        while completed < len(unique_jobs) and len(unique_inputs) < 32:
            candidate = unique_jobs[completed]
            if unique_inputs and used_chars + len(candidate) > char_budget:
                break
            unique_inputs.append(candidate)
            used_chars += len(candidate)
            completed += 1
        tokenized = tokenizer.encode_as_pieces(unique_inputs)
        tokenized = [["eng_Latn", *pieces, "</s>"] for pieces in tokenized]
        results = translator.translate_batch(
            tokenized,
            target_prefix=[["zho_Hans"]] * len(unique_inputs),
            replace_unknowns=True,
            max_batch_size=32,
            batch_type="tokens",
            beam_size=2,
            num_hypotheses=1,
            max_decoding_length=256,
            no_repeat_ngram_size=3,
            repetition_penalty=1.08,
        )
        for source, result in zip(unique_inputs, results):
            hypothesis = result.hypotheses[0]
            if hypothesis and hypothesis[0] == "zho_Hans":
                hypothesis = hypothesis[1:]
            cache[source] = polish(tokenizer.decode(hypothesis).strip())
        batch_number += 1
        print(
            f"翻译唯一机制 {completed}/{len(unique_jobs)}（原始记录 {len(jobs)}，本批 {completed - start} 条）",
            flush=True,
        )

    rejected = 0
    for note, protected, replacements in jobs:
        translated = restore_terms(cache.get(protected, protected), replacements)
        translated = polish(translated)
        if safe_translation(note["original"], translated, replacements):
            note["text"] = translated
            note["translationStatus"] = "machine"
        else:
            # Accuracy wins over coverage: keep the verifiable English grammar
            # while still restoring every Valve-official Dota term in Chinese.
            note["text"] = polish(restore_terms(protected, replacements))
            note["translationStatus"] = "source"
            rejected += 1

    (DATA / "liquipedia-mechanics.json").write_text(json.dumps(mechanics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"完成 {len(jobs)} 条机制记录，去重后翻译 {len(unique_jobs)} 个完整机制句；保守回退 {rejected} 条。")


if __name__ == "__main__":
    main()
