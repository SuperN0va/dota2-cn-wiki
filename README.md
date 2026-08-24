# DOTA 2 中文 WIKI

面向中文玩家的 DOTA 2 英雄、技能、物品、版本改动与职业生态资料库。当前游戏数据以 Valve / DOTA 2 官方简体中文内容为主，并补充 Liquipedia 的早期版本历史、英雄模型元数据、职业选手、战队与近期转会；详细来源与许可见网站的“数据与许可”页面。

英雄页包含详细属性、先天技能、可跳转的技能图标、神杖/魔晶升级、完整天赋树，以及带“新增 / 重做 / 移除 / 旧版 / 新版 / 天赋 / 调整 / 修复 / 移动”等语义标签的版本时间线。

“DOTA 2 弗一把”是基于当前职业阵容快照的纯前端单人猜选手模式。每局随机选择一名资料完整的现役阵容选手，玩家可根据国籍、赛区、战队、身份与昵称长度反馈在 8 次内作答；对局和统计只保存在浏览器本地，不需要账号或服务端。

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
pnpm data:sync:esports
pnpm data:validate
```

GitHub Actions 每天自动执行一次同步。Valve 当前资料在发现新版本时刷新；Liquipedia 英雄历史在新版本出现时立即刷新、平时每周刷新，物品历史每月刷新，英雄模型资料每周刷新。

职业生态同步器通过 Liquipedia MediaWiki API 读取各赛区当前阵容与最近 50 条重要转会，严格限制 `action=parse` 请求间隔不短于 30 秒，并按页缓存结果。战队 Logo 与国籍旗帜会缓存到 `public/assets/esports/`，访客不会直接请求 Liquipedia。同步后会检查选手/战队唯一性、双向阵容关联、图片本地化和转会来源完整性；只有实际内容发生变化且全部通过验证时才提交数据与新增资源，随后由 Vercel 自动构建发布。

也可以在 GitHub 仓库的 **Actions → Sync DOTA 2 data → Run workflow** 中手动触发。

## 部署

项目使用标准 Next.js，可直接导入 Vercel。Vercel 会识别框架并在 `main` 分支更新后自动部署，无需 ChatGPT 登录。

如绑定自定义域名，可在 Vercel 中设置 `NEXT_PUBLIC_SITE_URL=https://你的域名`，以生成准确的社交分享链接。
