import type { Ability, Hero, Patch } from './data';

const VALVE_ABILITY_ASSET = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities';

function ability(input: Partial<Ability> & Pick<Ability, 'id' | 'slug' | 'name' | 'description'>): Ability {
  return {
    lore: '',
    notes: [],
    scepter: '',
    shard: '',
    isInnate: false,
    type: 0,
    castRange: [0],
    cooldown: [0],
    manaCost: [0],
    damage: [0],
    specialValues: [],
    image: `${VALVE_ABILITY_ASSET}/${input.slug}.png`,
    ...input,
  };
}

function talent(id: number, name: string): Ability {
  return ability({
    id,
    slug: `spirit_bear_talent_${id}`,
    name,
    description: '',
    type: 2,
    image: '',
  });
}

const spiritBearAbilities: Ability[] = [
  ability({
    id: 1348,
    slug: 'lone_druid_spirit_bear_demolish',
    name: '粉碎击',
    description: '熊灵对建筑造成的伤害提升。',
    isInnate: true,
    useSharedInnateIcon: false,
    specialValues: [{ name: 'bonus_building_damage', label: '对建筑额外伤害', values: [20], isPercentage: true }],
  }),
  ability({
    id: 1343,
    slug: 'lone_druid_spirit_bear_return',
    name: '回归',
    description: '经过短暂持续施法后，熊灵传送回独行德鲁伊身边。',
    cooldown: [30],
    scepter: '允许熊灵伙伴无视独行德鲁伊位置进行攻击，并且在独行德鲁伊死亡时不会消失。',
    specialValues: [{ name: 'channel_tooltip', label: '持续施法时间', values: [3], isPercentage: false }],
  }),
  ability({
    id: 1344,
    slug: 'lone_druid_spirit_bear_entangle',
    name: '缠绕之爪',
    description: '熊灵攻击敌方英雄会施加叠加效果；达到所需层数后将目标缠绕，使其无法移动并持续受到伤害。',
    notes: ['叠加效果只会施加给敌方英雄、类英雄单位和肉山。', '被缠绕的单位无法使用闪烁类技能，进入隐身状态也会显形。'],
    specialValues: [
      { name: 'hits_required', label: '所需攻击次数', values: [5], isPercentage: false },
      { name: 'damage', label: '每秒缠绕伤害', values: [90], isPercentage: false },
      { name: 'entangle_duration', label: '缠绕持续时间', values: [1.2, 1.6, 2, 2.4], isPercentage: false },
    ],
  }),
  ability({
    id: 5687,
    slug: 'lone_druid_savage_roar_bear',
    name: '野蛮咆哮',
    description: '独行德鲁伊和熊灵发出野性的咆哮，使周围敌人恐惧并朝自己的基地逃跑。',
    notes: ['与独行德鲁伊共享冷却时间。'],
    cooldown: [38, 32, 26, 20],
    manaCost: [50],
    shard: '为作用范围内友军提供移动速度和攻击速度加成；对独行德鲁伊与熊灵施加弱驱散，并解除两者同时施放的限制。',
    specialValues: [
      { name: 'radius', label: '作用范围', values: [375], isPercentage: false },
      { name: 'duration', label: '持续时间', values: [1.1, 1.4, 1.7, 2], isPercentage: false },
    ],
  }),
  ability({
    id: 7309,
    slug: 'lone_druid_spirit_link',
    name: '灵魂链接',
    description: '连接独行德鲁伊和熊灵，提升双方的移动速度，并让双方共享一定比例的吸血效果。',
    lore: '悉拉在伙伴身旁倍感鼓舞，熊灵每次挥爪都让他的生命力得到补充。',
    notes: ['破坏会使共享吸血效果失效。'],
    specialValues: [
      { name: 'bonus_movement_speed_bear', label: '熊灵移动速度', values: [20, 40, 60, 80], isPercentage: false },
      { name: 'lifesteal_percent', label: '吸血分享', values: [15, 30, 45, 60], isPercentage: true },
    ],
  }),
  ability({
    id: 1347,
    slug: 'lone_druid_spirit_bear_fetch',
    name: '抓取',
    description: '抓住友军、敌方目标或神符，并将其向独行德鲁伊拖拽；敌人会持续受到伤害。',
    cooldown: [30],
    manaCost: [75],
    castRange: [200],
    shard: '获得新技能“抓取”。',
    specialValues: [
      { name: 'duration', label: '持续时间', values: [2.5], isPercentage: false },
      { name: 'break_distance', label: '中断距离', values: [425], isPercentage: false },
      { name: 'damage', label: '总伤害', values: [300], isPercentage: false },
    ],
  }),
];

const spiritBearTalents = [
  talent(196101, '+10% 魔法抗性'),
  talent(196102, '+15 移动速度'),
  talent(196103, '+4 护甲'),
  talent(196104, '回归无冷却并且持续施法时间减少0.5秒'),
  talent(196105, '+500 生命值'),
  talent(196106, '+30 攻击力'),
  talent(196107, '缠绕之爪对缠绕目标的伤害提升15%'),
  talent(196108, '+15% 粉碎击对建筑额外伤害'),
];

export function buildSpiritBear(patches: Patch[]): Hero {
  const abilityById = new Map(spiritBearAbilities.map((entry) => [entry.id, entry]));
  const history = [...patches].reverse().flatMap((patch) => {
    const change = patch.heroes.find((entry) => entry.id === 1961);
    if (!change) return [];
    return [{
      version: patch.version,
      timestamp: patch.timestamp,
      notes: change.notes.filter((note) => note.text.trim()),
      abilities: change.abilities.map((entry) => ({
        id: entry.id,
        name: abilityById.get(entry.id)?.name || `技能 #${entry.id}`,
        notes: entry.notes.filter((note) => note.text.trim()),
      })).filter((entry) => entry.notes.length),
    }];
  });

  return {
    id: 1961,
    slug: 'spirit_bear',
    internalName: 'npc_dota_lone_druid_bear1',
    name: '熊灵',
    nameEnglish: 'Spirit Bear',
    bio: '熊灵是独行德鲁伊以技能召唤的共生伙伴。它拥有英雄式属性成长、物品栏和独立天赋，但不能自行获得经验，而是随独行德鲁伊同步升级。',
    hype: '熊灵既是独行德鲁伊的召唤物，也是一个按英雄规则交互的全才类英雄单位。',
    primaryAttribute: '全才',
    complexity: 3,
    roles: [{ name: '核心', level: 2 }, { name: '推进', level: 2 }, { name: '耐久', level: 2 }],
    stats: {
      strength: [0, 4.5], agility: [0, 4.5], intelligence: [0, 0.5],
      damage: [28, 28], armor: -1, movementSpeed: 310,
      attackRange: 150, attackRate: 1.5, magicResistance: 25,
      health: 1500, healthRegen: 1.5, mana: 300, manaRegen: 0.5,
      projectileSpeed: 0, turnRate: 0.6,
      sightRangeDay: 1800, sightRangeNight: 800,
      attackCapability: '近战',
    },
    abilities: spiritBearAbilities,
    talents: spiritBearTalents,
    image: '/assets/spirit-bear-hero.png',
    portrait: '/assets/spirit-bear-hero.png',
    history,
    legacyHistory: [],
    isSpecialUnit: true,
    relatedHero: { slug: 'lone_druid', name: '独行德鲁伊', relationship: '技能召唤物' },
    liquipediaProfile: {
      controlVersion: '7.40c',
      baseAttackSpeed: 110,
      attackPoint: 0.43,
      attackBackswing: 0.4,
      collisionSize: 27,
      boundRadius: 24,
      gibType: 'Default',
      releaseDate: '2012-03-28',
      allstarsReleaseDate: '2004-09-18',
      dotaVersion: '5.62',
      liquipediaHeroId: 73,
      talentValues: ['10%', '15', '4', '无冷却 / -0.5秒', '500', '30', '15%', '15%'],
      sourceUrl: 'https://liquipedia.net/dota2/Spirit_Bear',
      revisionId: 2416111,
      updatedAt: '2026-08-16T05:25:26Z',
    },
  };
}
