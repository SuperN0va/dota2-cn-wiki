import Link from 'next/link';
import { HeroBrowser } from '../components/hero-browser';
import { heroSummaries, meta, patchIndex, formatDate } from '../lib/data';

export default function HomePage() {
  const latest = patchIndex[0];
  return (
    <>
      <section className="latest-strip">
        <div className="latest-label"><span />NEW UPDATE</div>
        <span className="latest-version">{latest.version}</span>
        <div className="latest-copy"><small>最新官方数据版本 · {formatDate(latest.timestamp)}</small><strong>{latest.name} 游戏性更新</strong></div>
        <div className="latest-stats"><span>{latest.heroChanges} 位英雄</span><span>{latest.itemChanges} 件物品</span></div>
        <Link className="latest-action" href={`/patches/${latest.version}`}>查看完整更新 <span>→</span></Link>
      </section>

      <HeroBrowser heroes={heroSummaries} latestPatch={meta.latestPatch} />
    </>
  );
}
