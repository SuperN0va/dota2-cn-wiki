import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatchDetail } from '../../../components/patch-detail';
import { formatDate, heroById, heroBySlug, itemById, patchByVersion, patches, type Note, type Patch } from '../../../lib/data';

function visibleNotes(notes: Note[]) {
  return notes.filter((note) => note.text.trim());
}

function mapItemChanges(entries: Patch['items'], kind: 'item' | 'neutral') {
  const mapped = [];
  let sectionTitle = kind === 'neutral' ? '中立物品' : '物品';
  for (const [index, entry] of entries.entries()) {
    const notes = visibleNotes(entry.notes);
    if (entry.id < 0 && entry.isGeneralNote) {
      sectionTitle = entry.title || sectionTitle;
      if (notes.length) mapped.push({
        id: -100000 - index,
        notes,
        name: `${sectionTitle}通用改动`,
        slug: '',
        image: '',
        hasDetail: false,
        sectionTitle,
      });
      continue;
    }
    if (entry.id < 0) {
      if (notes.length) mapped.push({
        id: -100000 - index,
        notes,
        name: entry.title || `${sectionTitle}通用改动`,
        slug: '',
        image: '',
        hasDetail: false,
        sectionTitle,
      });
      continue;
    }
    const item = itemById.get(entry.id);
    if (!notes.length) continue;
    mapped.push({
      ...entry,
      notes,
      name: item?.name || `${kind === 'neutral' ? '中立物品' : '物品'} #${entry.id}`,
      slug: item?.slug || '',
      image: item?.image || '',
      hasDetail: Boolean(item),
      sectionTitle,
    });
  }
  return mapped;
}

type MappedHeroChange = {
  id: number;
  notes: Note[];
  name: string;
  slug: string;
  image: string;
  attribute?: string;
  kind: 'hero' | 'special-unit';
  parentSlug?: string;
  hasDetail: boolean;
  abilities: Array<{
    id: number;
    notes: Note[];
    name: string;
    image?: string;
    isInnate?: boolean;
    useSharedInnateIcon?: boolean;
  }>;
  subunits: MappedHeroChange[];
};

function mapHeroChange(entry: Patch['heroes'][number]): MappedHeroChange {
  const hero = heroById.get(entry.id);
  const abilityById = new Map([...(hero?.abilities || []), ...(hero?.talents || [])].map((ability) => [ability.id, ability]));
  return {
    ...entry,
    notes: visibleNotes(entry.notes),
    name: hero?.name || `英雄 #${entry.id}`,
    slug: hero?.slug || '',
    image: hero?.image || '',
    attribute: hero?.primaryAttribute,
    kind: hero?.isSpecialUnit ? 'special-unit' as const : 'hero' as const,
    parentSlug: hero?.relatedHero?.slug,
    hasDetail: Boolean(hero),
    abilities: entry.abilities.map((ability) => {
      const currentAbility = abilityById.get(ability.id);
      return {
        ...ability,
        notes: visibleNotes(ability.notes),
        name: currentAbility?.name || `技能 #${ability.id}`,
        image: currentAbility?.image,
        isInnate: currentAbility?.isInnate,
        useSharedInnateIcon: currentAbility?.isInnate && currentAbility.useSharedInnateIcon !== false,
      };
    }).filter((ability) => ability.notes.length),
    subunits: [],
  };
}

function mapHeroChanges(entries: Patch['heroes']) {
  const mapped = entries.map(mapHeroChange).filter((entry) => entry.notes.length || entry.abilities.length);
  const standardHeroes = mapped.filter((entry) => entry.kind !== 'special-unit');
  const specialUnits = mapped.filter((entry) => entry.kind === 'special-unit');

  for (const unit of specialUnits) {
    let parent = standardHeroes.find((entry) => entry.slug === unit.parentSlug);
    if (!parent && unit.parentSlug) {
      const parentHero = heroBySlug.get(unit.parentSlug);
      if (parentHero) {
        parent = {
          id: parentHero.id,
          name: parentHero.name,
          slug: parentHero.slug,
          image: parentHero.image,
          attribute: parentHero.primaryAttribute,
          kind: 'hero',
          parentSlug: undefined,
          hasDetail: true,
          notes: [],
          abilities: [],
          subunits: [],
        };
        standardHeroes.push(parent);
      }
    }
    if (parent) parent.subunits = [...(parent.subunits || []), unit];
  }

  return standardHeroes;
}

export function generateStaticParams() {
  return patches.map((patch) => ({ version: patch.version }));
}

export async function generateMetadata({ params }: { params: Promise<{ version: string }> }): Promise<Metadata> {
  const { version } = await params;
  const patch = patchByVersion.get(version);
  if (!patch) return { title: '版本未找到' };
  const description = `${patch.name}：${patch.general.length} 个综合章节、${patch.heroes.length} 位英雄、${patch.items.length + patch.neutralItems.length} 件物品的官方中文改动。`;
  return {
    title: `${patch.name} — 完整更新日志`,
    description,
    openGraph: { title: `${patch.name} 完整更新日志｜DOTA 2 中文 WIKI`, description, images: [] },
    twitter: { title: `${patch.name} 完整更新日志｜DOTA 2 中文 WIKI`, description, images: [] },
  };
}

export default async function PatchPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const patch = patchByVersion.get(version);
  if (!patch) notFound();

  const view = {
    general: patch.general,
    items: mapItemChanges(patch.items, 'item'),
    neutralItems: mapItemChanges(patch.neutralItems, 'neutral'),
    heroes: mapHeroChanges(patch.heroes),
  };

  return (
    <article className="patch-detail-page">
      <nav className="breadcrumbs"><Link href="/patches">版本日志</Link><span>/</span><strong>{patch.version}</strong></nav>
      <header className="patch-detail-hero">
        <span className="patch-glyph">{patch.version}</span>
        <div><p className="eyebrow accent">Valve 官方简体中文</p><h1>{patch.name}</h1><p>发布于 {formatDate(patch.timestamp)}</p></div>
        <dl><div><dt>综合章节</dt><dd>{patch.general.length}</dd></div><div><dt>英雄改动</dt><dd>{patch.heroes.length}</dd></div><div><dt>物品改动</dt><dd>{patch.items.length + patch.neutralItems.length}</dd></div></dl>
        <a href={`https://www.dota2.com/patches/${patch.version}?l=schinese`} target="_blank" rel="noreferrer">查看 Valve 原始页面 ↗</a>
      </header>
      <PatchDetail patch={view} />
    </article>
  );
}
