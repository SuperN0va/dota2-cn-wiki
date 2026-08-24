import Link from 'next/link';

export function SiteFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <footer className="site-footer">
      <div className="footer-identity">
        <strong>DOTA 2 中文 WIKI</strong>
        <span>独立 DOTA 2 中文资料项目，并非 Valve 或完美世界官方网站。</span>
      </div>
      <div className="footer-links">
        <a href="https://www.dota2.com/" target="_blank" rel="noreferrer">Valve Dota 2</a>
        <a href="https://www.dota2.com.cn/news/gamepost/index.htm" target="_blank" rel="noreferrer">国服更新日志</a>
        <a href="https://liquipedia.net/dota2/Main_Page" target="_blank" rel="noreferrer">Liquipedia</a>
        <Link href="/players">职业选手</Link>
        <Link href="/friberg">DOTA 2 弗一把</Link>
        <Link href="/transfers">近期转会</Link>
        <Link href="/sources">来源与许可</Link>
      </div>
      <small>数据快照：{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(generatedAt))}</small>
      <p className="footer-license">
        7.08 前版本历史、职业选手、战队与转会资料改编自 <a href="https://liquipedia.net/dota2/Main_Page" target="_blank" rel="noreferrer">Liquipedia Dota 2 Wiki</a>，相关衍生文本按 <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> 共享。国籍旗帜、战队 Logo、统一先天图标及<a href="https://liquipedia.net/commons/File:Lone_Druid_Spirit_Bear_icon_dota2_gameasset.png" target="_blank" rel="noreferrer">熊灵肖像</a>通过 Liquipedia/Commons 获取；各媒体文件许可可能不同，详情以其原始文件页为准。Dota 2 及相关素材权利归 Valve Corporation 所有。
      </p>
    </footer>
  );
}
