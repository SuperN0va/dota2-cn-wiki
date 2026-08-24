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
        <Link href="/sources">来源与许可</Link>
      </div>
      <small>数据快照：{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(generatedAt))}</small>
      <p className="footer-license">
        7.08 前版本历史及注明的资料字段改编自 <a href="https://liquipedia.net/dota2/Main_Page" target="_blank" rel="noreferrer">Liquipedia Dota 2 Wiki</a>，相关衍生文本按 <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> 共享。英雄、技能与物品图片来自 Valve 官方静态资源，Dota 2 及相关素材权利归 Valve Corporation 所有；Liquipedia 媒体不自动适用 CC BY-SA。
      </p>
    </footer>
  );
}
