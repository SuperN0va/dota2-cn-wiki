import Link from 'next/link';
import { HeroBrowser } from '../components/hero-browser';
import { heroSummaries, meta, patchIndex, formatDate } from '../lib/data';

export default function HomePage() {
  const latest = patchIndex[0];
  return (
    <>
      <section className="home-intro">
        <div>
          <p className="eyebrow accent">可追溯的中文 DOTA 2 知识库</p>
          <h1>每一个技能，<br />都有自己的版本历史。</h1>
        </div>
        <div className="home-intro-copy">
          <p>以 Valve 官方简体中文数据为主轴，将英雄、技能、物品和游戏性改动连成一套可检索的时间线。</p>
          <div>
            <span><strong>{meta.counts.heroes}</strong> 位英雄</span>
            <span><strong>{meta.counts.items}</strong> 件可浏览物品</span>
            <span><strong>{meta.counts.patches}</strong> 个官方中文版本</span>
          </div>
        </div>
      </section>

      <section className="latest-strip">
        <span className="latest-version">{latest.version}</span>
        <div><small>最新官方数据版本 · {formatDate(latest.timestamp)}</small><strong>{latest.name} 游戏性更新</strong></div>
        <div className="latest-stats"><span>{latest.heroChanges} 位英雄</span><span>{latest.itemChanges} 件物品</span></div>
        <Link href={`/patches/${latest.version}`}>阅读完整日志 →</Link>
      </section>

      <HeroBrowser heroes={heroSummaries} latestPatch={meta.latestPatch} />
    </>
  );
}
