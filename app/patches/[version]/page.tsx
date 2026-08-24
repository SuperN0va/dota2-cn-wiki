import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatchDetail } from '../../../components/patch-detail';
import { formatDate, heroById, itemById, patchByVersion, patches } from '../../../lib/data';

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
    openGraph: { title: `${patch.name} 完整更新日志｜秘典`, description, images: [] },
    twitter: { title: `${patch.name} 完整更新日志｜秘典`, description, images: [] },
  };
}

export default async function PatchPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const patch = patchByVersion.get(version);
  if (!patch) notFound();

  const view = {
    general: patch.general,
    items: patch.items.map((entry) => {
      const item = itemById.get(entry.id);
      return { ...entry, name: item?.name || `物品 #${entry.id}`, slug: item?.slug || String(entry.id), image: item?.image || '' };
    }),
    neutralItems: patch.neutralItems.map((entry) => {
      const item = itemById.get(entry.id);
      return { ...entry, name: item?.name || `中立物品 #${entry.id}`, slug: item?.slug || String(entry.id), image: item?.image || '' };
    }),
    heroes: patch.heroes.map((entry) => {
      const hero = heroById.get(entry.id);
      const abilityById = new Map(hero?.abilities.map((ability) => [ability.id, ability]));
      return {
        ...entry,
        name: hero?.name || `英雄 #${entry.id}`,
        slug: hero?.slug || String(entry.id),
        image: hero?.image || '',
        abilities: entry.abilities.map((ability) => ({
          ...ability,
          name: abilityById.get(ability.id)?.name || `技能 #${ability.id}`,
          image: abilityById.get(ability.id)?.image,
        })),
      };
    }),
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
