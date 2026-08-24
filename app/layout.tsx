import type { Metadata } from 'next';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { meta, searchEntries } from '../lib/data';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'DOTA 2 中文 WIKI', template: '%s｜DOTA 2 中文 WIKI' },
  description: 'DOTA 2 全英雄、技能、物品、版本改动与职业生态的中文检索资料库。',
  icons: { icon: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/global/dota2_logo_symbol.png' },
  openGraph: {
    title: 'DOTA 2 中文 WIKI',
    description: '128 位英雄与英雄单位、全量物品、逐版本中文改动日志与职业生态资料。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'DOTA 2 中文 WIKI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DOTA 2 中文 WIKI',
    description: '128 位英雄与英雄单位、全量物品、逐版本中文改动日志与职业生态资料。',
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
