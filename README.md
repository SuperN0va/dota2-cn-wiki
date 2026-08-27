# DOTA 2 中文 WIKI

面向中文玩家的 DOTA 2 英雄、技能、物品、版本改动与职业生态资料库。当前游戏数据以 Valve / DOTA 2 官方简体中文内容为主，并补充 Liquipedia 的早期版本历史、英雄模型元数据、职业选手、战队与近期转会；详细来源与许可见网站的“数据与许可”页面。

英雄页包含详细属性、先天技能、可跳转的技能图标、神杖/魔晶升级、完整天赋树，以及带“新增 / 重做 / 移除 / 旧版 / 新版 / 天赋 / 调整 / 修复 / 移动”等语义标签的版本时间线。

“DOTA 2 弗一把”是基于职业生态快照的纯前端单人猜选手模式。每局随机选择一名资料完整的选手或教练，玩家可根据国籍、当前战队、身份、TI 参赛次数与 1—5 号位反馈在 8 次内作答；对局和统计只保存在浏览器本地，不需要账号或服务端。

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

## Vercel 部署

Vercel 默认使用 `vercel.json` 构建与 Bilibili Toy 共用的精简静态站：一个页面外壳、Hash 路由、目录索引和按需 JSON 分片。这样不会再为数千个英雄、物品和版本地址分别复制 HTML 与 React Server Components 数据；图片会在构建时本地化到部署产物，访问者不会依赖本机路径。

```bash
pnpm vercel:build
```

`main` 分支更新后 Vercel 会自动发布 `toy-dist/`。原有 Next.js 页面源码仍然保留，需要对照或回退时可以运行 `pnpm build`；它不再是 Vercel 默认产物。

## Bilibili Toy 静态镜像

项目包含一个与 Vercel 主站共用数据源的 Toy 专用构建。它使用单一 `index.html`、Hash 路由和按条目拆分的 JSON 数据，不依赖 Node.js 服务端，也不依赖站点根路径，适合上传到 Bilibili Toy 的随机子目录。

生成完整本地化上传包：

```bash
pnpm toy:pack
```

输出文件为 `outputs/dota2-cn-wiki-toy.zip`。构建器会缓存 Valve 图片到 `.data-cache/toy-assets/`，把英雄、技能和物品图片写入 ZIP；战队 Logo、国籍旗帜、统一先天图标、属性图标、图纸卷轴与熊灵肖像直接复用 `public/assets/`。

只验证页面和数据分片、暂不下载远程图片时可以运行：

```bash
pnpm toy:build:fast
```

生成的 `toy-dist/toy-manifest.json` 会记录内容数量、总文件数、包体积以及仍未本地化的远程资源数量。Toy 管理后台需要 ZIP 根目录直接包含 `index.html`，不要再额外套一层目录。

上传或部署前可单独运行严格验收：

```bash
pnpm toy:validate
```

它会检查目录与详情分片是否一一对应、嵌套目录下是否仍有错误的根路径、JSON 是否可解析、本地图片引用是否存在，以及是否仍有远程图片依赖。
