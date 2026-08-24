import type { Metadata } from 'next';
import { meta } from '../../lib/data';

export const metadata: Metadata = {
  title: '数据来源与许可',
  description: 'DOTA 2 中文 WIKI 的数据来源优先级与许可信息。',
};

export default function SourcesPage() {
  return (
    <article className="sources-page">
      <header className="index-hero sources-hero">
        <div><p className="eyebrow accent">Provenance & licensing</p><h1>数据来源与许可</h1></div>
        <p>每条资料都来自可回溯的数据渠道。当前数值与中文文本以 Valve 为准，国服官网用于中文公告对照；Liquipedia 补齐早期历史和英雄模型元数据。</p>
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
    </article>
  );
}
