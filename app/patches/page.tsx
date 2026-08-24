import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, meta, patchIndex } from '../../lib/data';

export const metadata: Metadata = {
  title: '版本日志',
  description: 'DOTA 2 7.08 至今的 Valve 官方简体中文游戏性、物品和英雄改动日志。',
};

export default function PatchesPage() {
  const years = new Map<number, typeof patchIndex>();
  for (const patch of patchIndex) {
    const year = new Date(patch.timestamp * 1000).getFullYear();
    years.set(year, [...(years.get(year) || []), patch]);
  }
  return (
    <article className="patch-index-page">
      <header className="index-hero">
        <div><p className="eyebrow accent">Official patch archive</p><h1>版本日志</h1></div>
        <p>从 7.08 起收录 Valve 官方简体中文结构化版本日志，逐项关联到英雄、技能与物品资料页。当前最新版本为 <strong>{meta.latestPatch}</strong>。</p>
        <div><span><strong>{meta.counts.patches}</strong> 个版本</span><span><strong>{meta.counts.legacyPages}</strong> 个历史来源页</span></div>
      </header>

      <div className="patch-years">
        {[...years.entries()].map(([year, entries]) => (
          <section className="patch-year" key={year}>
            <header><h2>{year}</h2><span>{entries.length} 个版本</span></header>
            <div className="patch-cards">
              {entries.map((patch, index) => (
                <Link className={`patch-card ${index === 0 && year === [...years.keys()][0] ? 'latest' : ''}`} href={`/patches/${patch.version}`} key={patch.version}>
                  <div className="patch-card-version">{patch.version}</div>
                  <div><small>{formatDate(patch.timestamp)}</small><strong>{patch.name}</strong><p>{patch.generalSections} 个综合章节 · {patch.heroChanges} 位英雄 · {patch.itemChanges} 件物品</p></div>
                  <span>→</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
