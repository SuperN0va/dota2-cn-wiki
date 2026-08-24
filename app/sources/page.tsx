import type { Metadata } from 'next';
import { cnNews, formatDate, meta, validation } from '../../lib/data';

export const metadata: Metadata = {
  title: '数据来源、同步与许可',
  description: 'DOTA 2 中文 WIKI 的数据来源优先级、同步方法、验证结果与图片/文字许可说明。',
};

export default function SourcesPage() {
  return (
    <article className="sources-page">
      <header className="index-hero sources-hero">
        <div><p className="eyebrow accent">Provenance & licensing</p><h1>数据来源、同步与许可</h1></div>
        <p>每条资料都来自可回溯的数据渠道。当前数值与中文文本以 Valve 为准，国服官网用于中文公告对照；Liquipedia 补齐早期历史和英雄模型元数据。</p>
        <div className="validation-badge"><span className={validation.passed ? 'status-dot' : 'status-dot failed'} /><strong>{validation.passed ? '本次数据验证全部通过' : '存在待处理的数据检查'}</strong></div>
      </header>

      <section className="source-priority">
        <p className="eyebrow">来源优先级</p>
        <div className="source-cards">
          {meta.sources.map((source, index) => (
            <a href={source.url} target="_blank" rel="noreferrer" className="source-card" key={source.id}>
              <span>0{index + 1}</span><div><small>{source.language}</small><h2>{source.name}</h2><p>{source.license}</p></div><b>↗</b>
            </a>
          ))}
        </div>
      </section>

      <div className="sources-grid">
        <section className="source-panel">
          <p className="eyebrow accent">未来更新方式</p>
          <h2>一次同步，自动重建全部关联</h2>
          <ol className="sync-steps">
            <li><span>01</span><div><strong>检查版本列表</strong><p>Valve datafeed 是第一入口，只下载尚未保存的新版本。</p></div></li>
            <li><span>02</span><div><strong>更新当前资料</strong><p>发现新版本后，重新抓取英雄、技能与物品的官方简体中文数据。</p></div></li>
            <li><span>03</span><div><strong>补齐历史来源</strong><p>按 Liquipedia 的 API 规范、缓存策略与请求频率增量同步旧记录。</p></div></li>
            <li><span>04</span><div><strong>交叉索引与回检</strong><p>自动把版本条目关联到英雄/技能/物品，并在发布前执行数量、重复 ID、中文内容和来源检查。</p></div></li>
          </ol>
          <div className="sync-command"><span>维护命令</span><code>pnpm data:sync &amp;&amp; pnpm data:validate</code></div>
        </section>

        <section className="source-panel validation-panel">
          <p className="eyebrow accent">本次回检</p>
          <h2>{formatDate(validation.generatedAt)}</h2>
          <div>{validation.checks.map((check) => <p key={check.name}><span className={check.pass ? 'check-pass' : 'check-fail'}>{check.pass ? '✓' : '!'}</span><strong>{check.name}</strong><small>{check.detail}</small></p>)}</div>
        </section>
      </div>

      <section className="license-section">
        <div>
          <p className="eyebrow accent">图片与商标</p>
          <h2>没有把 Liquipedia 图片误标为开源</h2>
          <p>Liquipedia 的文字可按 CC BY-SA 3.0 署名与相同方式共享，但图片和媒体需要逐文件检查，不能自动视为 CC 授权。因此本站英雄、技能与物品图像使用 Valve 官方静态资源地址，并明确其归 Valve 所有；没有直接复制许可不明的 Liquipedia 媒体。Dota、Dota 2 与相关角色、物品名称和图像均为 Valve Corporation 的商标或版权内容。</p>
        </div>
        <div>
          <p className="eyebrow accent">文本再利用</p>
          <h2>Liquipedia 历史补充</h2>
          <p>7.08 以前的历史变更及注明的模型元数据来自 Liquipedia Dota 2 Wiki，相关衍生文本按 CC BY-SA 3.0 使用；每个详情页标明来源，历史记录保留英文原文供核对。规则翻译只处理结构化常用句式，未能可靠翻译的文本会保留原文，不冒充 Valve 官方中文。</p>
          <a href="https://liquipedia.net/dota2/Help%3AReusing_and_remixing_Liquipedia_content" target="_blank" rel="noreferrer">查看 Liquipedia 再利用说明 ↗</a>
        </div>
      </section>

      <section className="cn-news-section">
        <header><div><p className="eyebrow accent">国服公告对照</p><h2>完美世界更新日志索引</h2></div><span>{cnNews.length} 条已发现公告</span></header>
        <div>{cnNews.slice(0, 12).map((article) => <a href={article.url} target="_blank" rel="noreferrer" key={article.url}><span>{article.title}</span><b>↗</b></a>)}</div>
      </section>
    </article>
  );
}
