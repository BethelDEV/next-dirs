# v1 测试环境：网页配置与部署

本文是 `next-dirs-5x9.18` 交付材料，供开发者执行 `.19` 和 `.20`。所有 Cloudflare / Sanity 资源、远程 SQL、权限、凭据和部署均由开发者在网页后台完成。代理尚未部署，也未提交或推送代码。只使用全新的测试 D1、Sanity dataset、Stripe 测试模式和测试收件箱。

## 交付文件

| 文件 | 用途 |
| --- | --- |
| `wrangler.jsonc` | Worker、D1 `DB`、静态资源 `ASSETS`、兼容日期与 Cron |
| `worker.ts` | OpenNext 请求入口和定时任务 |
| `migrations/0001_initial.sql` | 空库初始化，最终记录 schema 版本 1 |
| `docs/sql/verify-v1.sql` | 网页只读核对 |
| `docs/sql/bootstrap-admin.sql` | 首个已验证账户提升为管理员 |
| `.env.example` / `.dev.vars.example` | 构建/开发变量与纯本地合成变量示例 |
| `docs/architecture-v1-decisions.md` | 业务状态、数据边界和版本选择 |

## 1. 准备代码与独立测试资源

开发者将审核后的代码放到自己的 GitHub/GitLab 仓库测试分支。仓库连接会自动触发平台构建/发布，因此应先确认目标是独立测试 Worker。代理不会代为 commit/push。

在 Cloudflare Dashboard 的 **D1 SQL database** 创建空白测试库，记录数据库 ID。在仓库文件 `wrangler.jsonc` 替换占位 `database_id`，`database_name` 改为该测试库名称；`DB` 绑定名不变。`remote:false` 保证本地仿真不用远程绑定，不影响正式 Worker 的 D1 绑定。

在新库 **Console** 执行 `migrations/0001_initial.sql`。按原文件顺序执行，最后才记录版本。控制台支持多条 SQL；如界面限制长度，可按完整 SQL 语句分段，遇错立即停下核对，不重复运行整份初始化文件。不要在已有业务库执行此文件。执行 `docs/sql/verify-v1.sql`，确认版本为 1、表齐全且外键检查无结果。[D1 网页操作](https://developers.cloudflare.com/d1/get-started/)

后续升级新增递增迁移文件；先核对 `schema_migrations`，只执行未应用版本，记录实际执行结果。应用不自动运行远程迁移。

## 2. Sanity 项目、dataset 和权限

在 [Sanity Manage](https://www.sanity.io/manage) 创建独立测试项目和 **public** dataset。公开 dataset 只含 CMS 与可公开投影；不导入旧用户、订单、密码或令牌文档。记录项目 ID 和 dataset 名称。

创建两个分别保存的服务端 token：

| Token | 所需权限 |
| --- | --- |
| `SANITY_PUBLISH_TOKEN` | 读取条目 revision；创建/更新 `item`；上传图片资产 |
| `SANITY_PREVIEW_TOKEN` | CMS 草稿和预览 secret 的必要读取权限；不写条目 |

如果套餐提供自定义角色，在 Access 页面将发布 token 限定在测试 dataset 的 `item`、`sanity.imageAsset`，CMS 人员只写分类/标签/集合/博客/页面/publicProfile 等 CMS 类型。权限累加，不要再叠加宽泛角色。当前自定义角色属于 Enterprise 功能；不具备该能力时，采用隔离测试项目、仅可信管理人员拥有 Studio 写权限，并记录实际 token 权限。应用的 EDITOR 账户不等于 Sanity 项目 Editor，普通用户不加入 Sanity 项目。`readOnly` schema 仅限制 Studio 界面，不能替代平台权限。[Sanity 角色](https://www.sanity.io/docs/user-guides/roles)

在项目 API / CORS origins 加入实际测试站点 origin（无路径），为 Studio 允许 credentials。开发 origin 只在确有需要时加入 `http://localhost:3000` 或 `http://localhost:8787`。不用任意来源通配符。[CORS 网页配置](https://www.sanity.io/docs/content-lake/cors)

Studio 位于应用 `/studio`，随 Worker 发布，无需另建 Sanity Studio 托管。先在 Studio 创建分类、标签、博客作者等 CMS 数据。Collection 的 `Published listings` 用于选择条目；不能在 Studio 改条目审核、付款或管理下架状态。

## 3. Worker 构建与运行设置

在 Cloudflare **Workers & Pages → Create application → Import a repository** 连接测试分支。Worker 名称必须与 `wrangler.jsonc` 的 `name` 一致，默认 `mkdirs-v1`；若自定义名字，同时修改仓库配置。根目录为仓库根。[Git 网页连接](https://developers.cloudflare.com/workers/ci-cd/builds/)

构建配置选择 Node 24，使用仓库 `packageManager` 指定的 pnpm 10.33.0 和 lockfile 安装。**Build command** 填 `corepack pnpm build:worker`；发布字段保留平台提供的默认 Worker 发布流程，仅在网页确认。该流程由平台执行，不在本地终端发布。不要使用 `scripts/local-build.mjs` 做平台构建，它会强制合成测试配置。[Builds 设置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

平台网页会执行其部署流程；如果“网页手动”要求连平台后台构建过程也不能使用部署工具，则当前官方 Git Builds 不满足该更严格限制，需要重新选择部署方式，不能声称有未经验证的完整 Next.js 拖拽上传路径。

### 构建变量

`NEXT_PUBLIC_*` 会进入浏览器产物，需要同时提供给构建和运行环境，并在变更后重新构建：

- `NEXT_PUBLIC_APP_URL`：测试站点 HTTPS origin，无末尾斜杠。
- `NEXT_PUBLIC_SANITY_PROJECT_ID`、`NEXT_PUBLIC_SANITY_DATASET`：新测试项目。
- 可选分析服务变量参见 `.env.example`，测试验收时留空。

构建不需要 D1 数据、Sanity 写 token、Stripe 或 Resend 凭据。

### 运行变量 / secrets

在 Worker 的变量与 secrets 页面保存，下表中的 key/token/secret 使用 Secret 类型。不能使用 `NEXT_PUBLIC_` 保存凭据。

| 变量 | 值 / 用途 |
| --- | --- |
| `AUTH_SECRET` | 开发者生成的高熵随机值；不是示例字符串 |
| `AUTH_TRUST_HOST` | `true`，站点只通过预期 Worker 域名使用 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | 可选 Google OAuth 应用 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 可选 GitHub OAuth 应用 |
| `SANITY_PUBLISH_TOKEN` / `SANITY_PREVIEW_TOKEN` | 上一步的两个 token |
| `STRIPE_API_KEY` | Stripe 测试密钥 |
| `STRIPE_WEBHOOK_SECRET` | 本测试 endpoint 的签名 secret |
| `STRIPE_PRO_PRICE_ID` | 一次性 USD 9.90 的测试价格 |
| `STRIPE_SPONSOR_PRICE_ID` | 一次性 USD 19.90 的测试价格 |
| `RESEND_API_KEY` | 测试发信 API key |
| `RESEND_EMAIL_FROM` | 已验证发信身份 |
| `RESEND_EMAIL_ADMIN` | 首次审核通知的测试收件箱 |
| `RESEND_AUDIENCE_ID` | Newsletter audience（使用该能力时） |
| `DEFAULT_AI_PROVIDER` | 可选 `google/deepseek/openai/xai/openrouter`，关闭时留空 |
| `AI_MODEL` | 对应账户已启用的具体模型名称 |
| 对应 AI provider API key | `.env.example` 中选定提供方的 key；不配置无关 key |

在网页核对 `DB` 指向独立测试库、`ASSETS` 由构建产物提供；兼容日期 `2026-09-15`，flags 为 `nodejs_compat`、`global_fetch_strictly_public`。后者阻止 AI 抓取通过 DNS 指向私网。Cron 为 `* * * * *`，从 `worker.ts` 执行到期清理、发布、通知。无需 R2、KV、Queue 资源。页面使用动态 Sanity API 读取，无共享 ISR 缓存。

首次部署后访问 `/auth/register`、`/studio` 和公开首页，完成 `.19` 最小验证。按平台实际包体与 CPU 报告选择允许该 Next.js 应用及密码校验的 Worker 计划；不要假定免费计划足够。

## 4. 身份、支付和管理员

OAuth 控制台由开发者添加准确的 callback：`https://测试域名/api/auth/callback/google` 和 `/api/auth/callback/github`。未配置的提供方不要用于验收。

Stripe 测试 Dashboard 创建上述固定金额/币种的一次性价格；改变价格时同步修改 `src/config/price.ts` 与服务端价格 ID。添加测试 Webhook endpoint `/api/webhook`，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`checkout.session.expired`、`charge.refunded`。通过测试后台重放事件，确认只发放一次权益。

在应用注册并验证开发者本人的测试账户，在 D1 网页中找到该账户 ID，替换 `docs/sql/bootstrap-admin.sql` 的占位符后执行。脚本只允许创建第一个已验证管理员；重新登录后进入 `/admin`。以后角色/禁用操作在应用管理页面执行，不能靠注册参数指定角色。

## 5. 故障恢复与可见性

正常情况下，一轮 Cron 每分钟处理最多 10 个发布和 10 个通知；无积压、提供方健康时，以 **两分钟内公开更新** 为验收目标。积压/提供方故障会延长时间，应在管理页查看状态和队列。

发布失败保留 D1 保存内容与旧公开版本，Dashboard/管理页可重试。不要手工删除 Sanity 隐藏条目的版本墓碑，也不要绕过应用改投影；旧任务通过 revision 和版本检查防止复活下架内容。

通知失败独立重试，成功后清空收件人/令牌 payload。超过 10 次或首次尝试后 23 小时未确认的通知暂停。管理员先在提供方 Dashboard 查幂等键（通知 ID）与送达结果，再决定如何恢复，不能盲目重复发送。订阅状态以 D1 为准，队列同步当前状态；退订链接带随机 token。

上传失败可重新上传。超时上传意图由定时任务标记 abandoned；公开资产可能被多个条目复用，本版不自动删除 Sanity 资产。旧批量写入/导出邮箱脚本、伪造 Origin 即发信的接口已移除或停用；管理在应用和 Studio 的对应入口完成。

## 6. 实际环境验收记录

在 Beads `.19` / `.20` 记录站点 URL、Git 版本/构建 ID、日期、各流程结果和已知问题，不记录 secret、完整邮箱或支付明细。覆盖：

- 免费提交 → 首次审核 → 作者选择发布；付费到账 → 免审 → 作者选择发布。
- 已发布编辑免审；版本冲突提示；普通用户不能读写他人条目；EDITOR 编辑已发布内容。
- 管理下架后编辑/支付/旧任务不恢复可见性；管理恢复受作者发布意图约束。
- 支付签名错误、重复/乱序/延迟事件、取消、完整/部分退款、赞助到期。
- 上传类型/大小/归属，AI 限额和非公开 URL，通知失败/重试，退订。
- 公开 HTML/RSC/SEO/sitemap 不含私有身份/订单字段；下架前后详情、搜索、分类/标签/集合一致；CMS 草稿仅受控预览可见。
- 登录、Dashboard、编辑、管理、Studio 及正文在桌面和手机宽度显示正常。

仅凭本地 mock 通过不能关闭这两个人工任务。实际验收后再完成 `.21` 最终 README 和 Epic 验收。
