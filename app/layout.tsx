import type { Metadata } from 'next';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { meta, searchEntries } from '../lib/data';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: '秘典 — DOTA 2 中文资料库', template: '%s｜秘典' },
  description: 'DOTA 2 全英雄、技能、物品与版本改动的中文检索资料库。',
  openGraph: {
    title: '秘典 — DOTA 2 中文资料库',
    description: '127 位英雄、全量物品与逐版本中文改动日志。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '秘典 — DOTA 2 中文资料库' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '秘典 — DOTA 2 中文资料库',
    description: '127 位英雄、全量物品与逐版本中文改动日志。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader latestPatch={meta.latestPatch} entries={searchEntries} />
        <main className="page-shell">{children}</main>
        <SiteFooter generatedAt={meta.generatedAt} />
      </body>
    </html>
  );
}
