# Mkdirs · 架构 v1

基于 Next.js 16、React 19、Cloudflare Workers / D1 和 Sanity 的目录网站模板，包含投稿、首次审核、支付、作者发布、运营管理、博客和 Newsletter。

当前版本处于 `next-dirs-5x9` 验收阶段。开发者于 2026-09-15 反馈：已部署至 Cloudflare Workers - https://apphall.org ， 已应用 D1 初始化 SQL，Google 登录、项目提交（pending）及 Studio 分类/标签写入成功。完整业务流程仍待实际验收，详见 [部署与验收记录](docs/web-deployment.md#6-实际环境验收记录)；本地仿真结果不能替代实际环境验收。原版 Mkdirs 的 Vercel / Docker 安装指南不适用于本分支的 D1 架构。

## 数据与业务规则

| 部分 | 职责 |
| --- | --- |
| D1 | 身份、OAuth、令牌、内容草稿、审核、订单、上传归属、通知、审计、发布队列 |
| Sanity Content Lake | 可公开条目投影、分类、标签、Collection、博客、页面和公开图片 |
| Workers / OpenNext | 网页、服务端操作、支付 Webhook，以及每分钟的发布和通知任务 |
| Sanity Studio `/studio` | CMS 内容管理；审核和条目业务操作在应用 `/admin` 完成 |

免费条目首次发布前需要审核，付费条目免人工审核；两者都由作者选择首次发布。已发布条目编辑后自动同步，无需复审。管理员下架不会被作者编辑、付款或旧发布任务解除。正文使用安全 Markdown，用户输入不能执行 MDX / JSX。

普通用户只编辑自己的条目；EDITOR / ADMIN 可以编辑已发布的用户条目并处理审核。只有 ADMIN 可以调整账号角色和停用状态。Sanity 公开模型不保存登录邮箱、密码、令牌、订单、内部审核备注或业务 owner。

没有历史数据迁移，不使用临时图片 R2。图片直接上传公开 Sanity Assets，归属和上传状态保存在 D1。

## 自动生成 LLM 内容入口

- `/llms.txt`：简洁的站点说明和各类内容入口，不随条目数量增长。
- `/llms-full.txt`：**全文分片目录**，明确指引客户端读取各分片，不再把全站正文汇总成一个文件。
- `/blog/llms.txt`、`/blog/llms-full.txt`：博客专用索引与全文分片目录。
- `/llms/items.txt`、`/llms/blog.txt`、`/llms/pages.txt`：产品、博客、CMS 页面摘要索引，每页最多 50 条；另外还有 `categories`、`tags`、`collections`、`blog-categories` 索引。
- `/llms/items-full.txt`、`/llms/blog-full.txt`、`/llms/pages-full.txt`：相应全文分片，每页最多 10 篇，未压缩 UTF-8 响应最多 128 KiB（预留导航开销）。其他类型也有对应 `-full.txt` 入口。
- `/item/{slug}/index.md`、`/blog/{slug}/index.md`、`/{slug}/index.md`：单个产品、博客、CMS 页面的完整 Markdown。富文本转换为 Markdown，图片仅保留替代文本。

分页响应在正文中提供 `Next part`，同时返回 `Link: <...>; rel="next"`；沿链接可读取全部公开条目。游标按文档 ID 前进，无深度 offset 扫描。达到字节预算时，下一篇留给下一分片；单篇超过预算时，分片明确提示并链接到完整 Markdown，绝不截断正文。单篇地址仍可能很大，客户端可以按需选择读取。摘要索引中标题和简介分别最多显示 160、280 个字符。

所有入口请求时自动生成，读取 Sanity 已发布内容，不需要额外环境变量、生成脚本或 Cron。站点名称与简介来自 `src/config/site.ts`，绝对链接使用 `NEXT_PUBLIC_APP_URL`。产品发布、更新或隐藏在同步到 Sanity 后反映到输出；CMS 修改在发布后反映。响应和上游读取均不缓存，即使携带预览 Cookie，也只读取已发布视图。分页是实时视图，跨请求并非冻结快照；抓取期间若有内容发布，可从首个分片重新读取。

根索引不查询全库。分片只读取一页元数据，全文逐篇读取并重新检查可见性，避免同时把全站或整批博客正文装入内存；单篇大小仍影响该次读取的内存和耗时，实际 Worker 限制须在部署环境核验。查询只选取公开字段，不导出账号、订单、审核备注或业务归属信息。已隐藏、未发布或不存在的单篇返回 `404`；读取失败返回 `503`，不会用不完整文件冒充成功。页面通过 `rel="describedby"` 关联索引，产品、博客、CMS 页通过 `rel="alternate" type="text/markdown"` 关联单篇 Markdown。

格式参考 [llms.txt 提案](https://llmstxt.org/)；它为 AI 客户端提供内容入口，不保证被特定服务抓取或提升排名。部署后可直接访问以上两个路径核验。

## 从空白环境运行本地验收

需要 Node **22.12 以上**（本次使用 Node 24）、Corepack 和 Python Playwright / Chromium（仅浏览器测试需要）。

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:d1
corepack pnpm build:local:worker
corepack pnpm test:worker:serve
```

访问 `http://localhost:8787`。此环境使用内存 D1 和合成 Sanity、Stripe、AI 提供方；无需平台账号或真实凭据，重启后数据重置。只读取 `.dev.vars.example` 和测试代码中的合成值，外部请求由本地替身处理，未实现请求直接失败。

可用测试账号 `owner@example.invalid`、`other@example.invalid`、`editor@example.invalid`、`admin@example.invalid`，密码统一为 `Local-fixture-password-123!`。这些账号只存在于本地测试进程。Studio 入口可以加载；实际 Sanity 登录和 CMS 读写需要开发者配置测试项目。

保持服务器运行，在另一终端运行浏览器验收：

```bash
python tests/browser/architecture.py
```

使用已安装 Playwright 的 Python。每次完整浏览器验收前重启合成服务器；修改应用代码后先停止服务器、重新构建，再启动。不要在浏览器运行中重建静态资源。

详细覆盖范围、截图位置和仿真限制见 [本地验证说明](docs/local-validation.md)。

## 开发入口

| 命令 | 用途 |
| --- | --- |
| `corepack pnpm dev` | Next 开发服务器，使用 OpenNext 本地绑定；需要另行准备本地 D1 和测试 CMS 配置 |
| `corepack pnpm build:local` | 使用合成公开配置验证 Next 构建 |
| `corepack pnpm build:worker` | 使用开发者提供的构建变量生成 OpenNext 产物，不部署 |
| `corepack pnpm test:worker` | 验证已构建的真实 Worker 后退出 |
| `corepack pnpm typegen` | schema 变化后本地提取 Sanity schema 并生成类型 |
| `corepack pnpm lint` | Biome 只读检查 |
| `corepack pnpm format` | 格式化并写入文件 |
| `corepack pnpm email` | 邮件模板预览 |

`pnpm build` / `pnpm start` 仅是 Next 命令，不能作为完整 Workers / D1 环境的验收。旧批量条目写入和邮箱导出脚本已移除。AI Autofill 默认由 `src/lib/constants.ts` 中的开关关闭；启用时同时配置服务端提供方、模型和对应 key。

主要代码位置：

- `src/db/`、`migrations/`：D1 schema、约束和业务状态转换。
- `src/services/`、`worker.ts`：发布、上传、通知和定时任务。
- `src/actions/`：每个操作独立鉴权，客户端不能授予付款、审核或角色权限。
- `src/data/`：应用 DTO 和公开查询。
- `src/sanity/`：公开 schema、CMS、查询和服务端发布客户端。
- `tests/`：SQLite、workerd/D1、真实 Worker 与浏览器测试。

## 测试环境部署与运行

Cloudflare / Sanity 的资源、binding、secret、CORS、远程 SQL、Cron 和发布均由开发者在相应网页后台执行。本仓库不提供终端平台部署流程。

按 [网页配置与部署交付包](docs/web-deployment.md) 准备独立测试环境，包括：

1. 创建空白 D1，在网页按顺序执行 `migrations/0001_initial.sql`，核对 `schema_migrations` 和 `docs/sql/verify-v1.sql`。
2. 创建公开 Sanity dataset，配置独立发布 / 预览 token、权限和 CORS。
3. 在 Worker 网页关联审核后的代码版本，配置 `DB`、`ASSETS`、构建变量、运行 secrets 和 Cron。
4. 在应用验证本人的邮箱账户或使用本人的 Google 账户登录，再按 `docs/sql/bootstrap-admin.sql` 在 D1 网页初始化管理员，退出并重新登录。
5. 用测试账号、测试支付和测试收件箱完成文档中的实际环境验收。

变量以 [.env.example](.env.example) 和交付包为准：公开 URL 使用 `NEXT_PUBLIC_APP_URL`；认证使用 `AUTH_SECRET`；Sanity 写入使用 `SANITY_PUBLISH_TOKEN`；Stripe 使用 `STRIPE_API_KEY` 和 `STRIPE_WEBHOOK_SECRET`。`NEXT_PUBLIC_*` 会进入浏览器产物，不得保存凭据。

无积压且提供方健康时，以两分钟内完成公开更新为验收目标。发布失败保留 D1 内容与旧公开版本，作者或运营可在管理界面重试；通知独立重试。上传失败可以重新上传，过期意图会标记 abandoned，本版不自动删除公开资产。后续 SQL 升级只执行未应用的递增迁移文件。

实际平台包体、启动和密码校验 CPU、OAuth 回调、CMS 权限、发信与提供方故障恢复仍需网页部署后的验证。版本和业务决策见 [架构说明](docs/architecture-v1-decisions.md)。进度与验收结果以 Beads `next-dirs-5x9` 为准；`.19` / `.20` 完成后才能最终确认 `.21` 与 Epic。

## License

Licensed under the [Apache License 2.0](LICENSE). You may use, modify, and
distribute the code, including for commercial purposes, subject to the terms
of the license.

The license does not grant permission to use the Mkdirs name, logo, or other
trademarks to identify or promote derived products. Reasonable use to describe
the origin of the software, such as “Built with Mkdirs,” is permitted.

Copyright © Mkdirs.
