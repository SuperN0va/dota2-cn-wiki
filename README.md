# DOTA 2 中文 WIKI

面向中文玩家的 DOTA 2 英雄、技能、物品与版本改动资料库。当前数据以 Valve / DOTA 2 官方简体中文内容为主，并补充 Liquipedia 的早期版本历史与英雄模型元数据；详细来源与许可见网站的“数据与许可”页面。

英雄页包含详细属性、先天技能、可跳转的技能图标、神杖/魔晶升级、完整天赋树，以及带“新增 / 重做 / 移除 / 旧版 / 新版 / 天赋 / 调整 / 修复 / 移动”等语义标签的版本时间线。

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

GitHub Actions 每天自动执行一次同步。Valve 当前资料在发现新版本时刷新；Liquipedia 英雄历史在新版本出现时立即刷新、平时每周刷新，物品历史每月刷新，英雄模型资料每周刷新。解析器版本升级也会自动重建相应缓存。同步后会检查空记录、重复版本、时间顺序、7.08 来源分界、历史模板残留及结构覆盖率；只有生成数据发生变化且全部通过验证时才会提交 `data/`，随后由 Vercel 自动构建发布。

也可以在 GitHub 仓库的 **Actions → Sync DOTA 2 data → Run workflow** 中手动触发。

## 部署

项目使用标准 Next.js，可直接导入 Vercel。Vercel 会识别框架并在 `main` 分支更新后自动部署，无需 ChatGPT 登录。

如绑定自定义域名，可在 Vercel 中设置 `NEXT_PUBLIC_SITE_URL=https://你的域名`，以生成准确的社交分享链接。
