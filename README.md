# DOTA 2 中文 WIKI

面向中文玩家的 DOTA 2 英雄、技能、物品与版本改动资料库。当前数据以 Valve / DOTA 2 官方简体中文内容为主，并补充 Liquipedia 的早期版本历史；详细来源与许可见网站的“数据与许可”页面。

在线访问：[https://dota2-cn-wiki.vercel.app](https://dota2-cn-wiki.vercel.app)

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm start
```

## 数据更新

```bash
pnpm data:sync
pnpm data:validate
```

GitHub Actions 每天自动执行一次完整同步。只有生成数据发生变化且通过验证时才会提交 `data/`；连接到该仓库的 Vercel 项目随后自动构建并发布。

也可以在 GitHub 仓库的 **Actions → Sync DOTA 2 data → Run workflow** 中手动触发。

## 部署

项目使用标准 Next.js，可直接导入 Vercel。Vercel 会识别框架并在 `main` 分支更新后自动部署，无需 ChatGPT 登录。

如绑定自定义域名，可在 Vercel 中设置 `NEXT_PUBLIC_SITE_URL=https://你的域名`，以生成准确的社交分享链接。
