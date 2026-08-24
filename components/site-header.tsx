'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type SearchEntry = { kind: string; title: string; subtitle: string; href: string; image?: string };

const nav = [
  { href: '/', label: '英雄' },
  { href: '/items', label: '物品' },
  { href: '/patches', label: '版本' },
  { href: '/players', label: '选手' },
  { href: '/friberg', label: '弗一把' },
  { href: '/teams', label: '战队' },
  { href: '/transfers', label: '转会' },
  { href: '/sources', label: '来源', optional: true },
];

export function SiteHeader({ latestPatch, entries }: { latestPatch: string; entries: SearchEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    if (!needle) return entries.slice(0, 7);
    return entries.filter((entry) => `${entry.title} ${entry.subtitle} ${entry.kind}`.toLocaleLowerCase('zh-CN').includes(needle)).slice(0, 10);
  }, [entries, query]);

  const isActive = (href: string) => href === '/' ? pathname === '/' || pathname.startsWith('/heroes') : pathname.startsWith(href);

  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="DOTA 2 中文 WIKI 首页">
          <span className="brand-logo" aria-hidden="true">
            <img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/global/dota2_logo_symbol.png" alt="" />
          </span>
          <span className="brand-copy">
            <strong>DOTA 2 中文 WIKI</strong>
            <small>玩家资料库 · 非官方网站</small>
          </span>
        </Link>

        <nav className="primary-nav" aria-label="主导航">
          {nav.map((item) => <Link className={`${isActive(item.href) ? 'is-active ' : ''}${item.optional ? 'nav-optional' : ''}`.trim()} href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>

        <button className="global-search-button" type="button" onClick={() => setOpen(true)} aria-label="打开全站搜索">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <span>搜索英雄、物品、选手、战队或版本</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="header-patch">PATCH {latestPatch}</span>
      </header>

      {open && (
        <div className="search-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="search-dialog" role="dialog" aria-modal="true" aria-label="全站搜索" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-input-row">
              <span aria-hidden="true">⌕</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入英雄、物品、选手、战队或版本…" />
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭搜索">ESC</button>
            </div>
            <div className="search-results">
              <p className="eyebrow">{query ? `找到 ${results.length} 条结果` : '快速访问'}</p>
              {results.map((entry) => (
                <Link className="search-result" href={entry.href} key={`${entry.kind}:${entry.href}`} onClick={() => setOpen(false)}>
                  {entry.image ? <img src={entry.image} alt="" /> : <span className="search-version-icon">{entry.title}</span>}
                  <span><strong>{entry.title}</strong><small>{entry.subtitle}</small></span>
                  <em>{entry.kind}</em>
                  <b>→</b>
                </Link>
              ))}
              {!results.length && <div className="empty-search">没有匹配结果。可尝试英雄英文名或版本号。</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
