# v1 测试环境：网页配置与部署

本文是 `next-dirs-5x9.18` 交付材料，供开发者执行 `.19` 和 `.20`。所有 Cloudflare / Sanity 资源、远程 SQL、权限、凭据和部署均由开发者在网页后台完成。代理尚未部署，也未提交或推送代码。只使用全新的测试 D1、Sanity dataset、Stripe 测试模式和测试收件箱。

## 交付文件

| 文件 | 用途 |
| --- | --- |
| `wrangler.jsonc` | Worker、D1 `DB`、静态资源 `ASSETS`、兼容日期与 Cron |
| `worker.ts` | OpenNext 请求入口和定时任务 |
| `migrations/0001_initial.sql` | 空库初始化，最终记录 schema 版本 1 |
| `docs/sql/verify-v1.sql` | 网页只读核对 |
| `docs/sql/bootstrap-admin.sql` | 本人已验证邮箱或 Google 账户初始化为首个管理员 |
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

页脚的 `/about`、`/privacy`、`/terms` 依赖 Studio **Pages** 中的页面文档，D1 初始化不会创建它们。在 Pages 创建对应内容，将 Slug 分别设为 `about`、`privacy`、`terms`（不带 `/`），然后点击 **Publish**。根据标题自动生成的 `about-us`、`privacy-policy`、`terms-of-service` 与页脚链接不匹配。仅保存草稿或填写 Publish Date 不等于发布；普通访客只读取已发布内容。内容发布后刷新即可，无需产品审核、Cron 或重新部署。若仍返回 404，核对页面所在 project/dataset 是否与应用一致，以及普通已发布文档 ID 是否不含点号。

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

仓库设置 `keep_vars: true`，使部署保留网页后台管理的普通运行时变量。未启用时，平台构建部署流程中的 Wrangler 可能删除配置文件没有声明的网页变量；构建变量也不等于 Worker 运行时变量。该设置不会恢复已经丢失的变量，须由开发者在网页补回。[Wrangler 变量保留配置](https://developers.cloudflare.com/workers/wrangler/configuration/)

如果部署后 `NEXT_PUBLIC_*` 消失，先确认网页部署选择的代码版本已包含 `keep_vars: true`（本地未提交修改不会自动进入 Git Builds）。在运行时恢复 `NEXT_PUBLIC_APP_URL`、原 `NEXT_PUBLIC_SANITY_PROJECT_ID`、原 `NEXT_PUBLIC_SANITY_DATASET`，并检查 `AUTH_TRUST_HOST` 等其他普通变量；可选分析服务变量按实际启用情况恢复。这三项公开变量还须在 Builds 中提供相同值。测试站 origin 为 `https://dirs.apphall.org`，Sanity 值须使用实际项目，不能填写本地 fixture 的 `localtest` / `local`。如构建时值已正确，仅补回运行时变量不需要改变浏览器产物；如构建值也缺失或错误，需从网页重新构建部署。

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

若重新部署后 Google 登录失败，先在浏览器查看 `/api/auth/providers`：正常应返回 HTTP 200 的提供方信息。若它与 `/api/auth/session` 均返回 500 的 server configuration 提示，且 `/api/auth/error` 重定向至 `/auth/error?error=Configuration`，说明认证配置检查已失败，不能仅凭 302 判断 Google 回调问题。到 Worker 日志查看 `[auth][error]`：`UntrustedHost` 优先核对运行时 `AUTH_TRUST_HOST=true`；`MissingSecret` 核对运行时 Secret `AUTH_SECRET` 是否存在且非空。Google 的 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` 也须在运行时可用，不能只配置在 Builds。恢复原有正确值后，在网页保存并部署相应版本，再检查 providers 接口和 Google 登录。不要为排障随意轮换 `AUTH_SECRET`，这会影响已有会话。

OAuth 控制台由开发者添加准确的 callback：`https://测试域名/api/auth/callback/google` 和 `/api/auth/callback/github`。未配置的提供方不要用于验收。

Stripe 测试 Dashboard 创建上述固定金额/币种的一次性价格；改变价格时同步修改 `src/config/price.ts` 与服务端价格 ID。添加测试 Webhook endpoint `/api/webhook`，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`checkout.session.expired`、`charge.refunded`。通过测试后台重放事件，确认只发放一次权益。

在应用注册并验证开发者本人的测试邮箱账户，或使用本人的 Google 账户成功登录。确认账户归属后，在绑定该 Worker 的 D1 网页中找到对应 `users.id`，替换 `docs/sql/bootstrap-admin.sql` 的占位符后执行。脚本只初始化第一个启用的管理员，支持本地邮箱已验证或已关联 Google 的账户，并递增 `session_version`；退出并重新登录后进入 `/admin`。以后角色/禁用操作在应用管理页面执行，不能靠注册参数指定角色。

Google 登录成功时，Auth.js 仍可能将 `users.emailVerified` 保存为 `NULL`，不应为提权伪造该字段。若脚本更新 0 行，检查是否替换了正确的 `users.id`、目标 `disabled` 是否为 0、是否满足邮箱已验证或 Google 关联条件，以及库内是否已经存在 `role='ADMIN' AND disabled=0` 的账户。已有管理员时使用该账户登录管理页面调整角色。

## 5. 故障恢复与可见性

正常情况下，一轮 Cron 每分钟处理最多 10 个发布和 10 个通知；无积压、提供方健康时，以 **两分钟内公开更新** 为验收目标。积压/提供方故障会延长时间，应在管理页查看状态和队列。

发布失败保留 D1 保存内容与旧公开版本，Dashboard/管理页可重试。不要手工删除 Sanity 隐藏条目的版本墓碑，也不要绕过应用改投影；旧任务通过 revision 和版本检查防止复活下架内容。

通知失败独立重试，成功后清空收件人/令牌 payload。超过 10 次或首次尝试后 23 小时未确认的通知暂停。管理员先在提供方 Dashboard 查幂等键（通知 ID）与送达结果，再决定如何恢复，不能盲目重复发送。订阅状态以 D1 为准，队列同步当前状态；退订链接带随机 token。

上传失败可重新上传。超时上传意图由定时任务标记 abandoned；公开资产可能被多个条目复用，本版不自动删除 Sanity 资产。旧批量写入/导出邮箱脚本、伪造 Origin 即发信的接口已移除或停用；管理在应用和 Studio 的对应入口完成。

### 已同步产品详情 404：早期投影 ID 修复

`next-dirs-5jm`：早期发布器使用 `listing.<D1 id>` 作为 Sanity 文档 ID。Sanity 将含点号的 ID 视为受限路径，匿名查询无法读取，即使任务显示 `synced`、文档 `visible=true`。公开读取保持匿名；修复后的投影与隐藏墓碑统一使用 `listing-<D1 id>`。[Sanity ID 与访问限制](https://www.sanity.io/docs/content-lake/ids)

开发者在网页部署修复版本后，作者在 Dashboard 编辑受影响的已发布产品并保存，可触发新一轮同步，无需再次审核。等待同步完成后，通过卡片链接访问 `/item/<slug>`（不是 D1 UUID）。仅刷新页面不会让已经完成的任务再次执行，`Retry failed sync` 也只重试失败任务。

原有 `listing.<D1 id>` 文档暂时保留；不复制旧投影或删除墓碑，新文档始终从 D1 当前状态生成，保留管理下架限制。如 Studio collection 曾引用旧 ID，开发者需在 Studio 将其改选为新 `listing-<D1 id>` 文档；分类和标签本身无需重建。若仍为 404，核对 Cron、发布 token、Worker 运行时与构建时的 Sanity project/dataset 是否一致，以及实际访问的 slug。

## 6. 实际环境验收记录

### 2026-09-15：开发者首批反馈

以下结果由开发者反馈，代理未独立在线复验：

| 项目 | 结果 |
| --- | --- |
| Cloudflare Workers 部署 | 已部署，测试专用地址 https://dirs.apphall.org |
| D1 初始化 | 已应用 `migrations/0001_initial.sql` |
| Google 登录 | 初次成功；重新部署后曾出现配置错误，开发者再次部署后确认登录恢复正常（`next-dirs-rzh`） |
| 项目提交 | 可以提交，显示 `pending` |
| Sanity Studio | `/studio` 可访问，可添加 tag 和分类 |
| 首次管理员 | 使用支持 Google 关联账号的 SQL 后可访问 `/admin` |
| 申请审核 | 管理员可以批准产品申请 |
| 作者发布及公开详情 | 作者已主动发布；曾在 `synced` 状态下返回 404，部署修复并重新编辑更新产品后，开发者确认详情页可访问（`next-dirs-5jm`） |

`pending` 符合免费首次提交等待审核的流程；审核通过后仍由作者选择首次发布。初版管理员脚本因要求 `emailVerified` 非空而未生效，开发者使用支持 Google 关联账号的 SQL 后确认管理员访问和审批成功（`next-dirs-3ig`）。后续部署曾导致普通运行时变量丢失和认证配置错误；补充变量保留配置后，开发者再次部署并确认 Google 登录恢复正常。公开详情 404 经投影 ID 修复、作者重新编辑更新后也已确认恢复。`next-dirs-rzh` 与 `next-dirs-5jm` 已获实际恢复反馈；具体 Auth.js 错误名称未提供，不推断某个 Secret 曾丢失。

`.19` 已进入实际验收，仍需补充部署 Git 版本/构建 ID、`docs/sql/verify-v1.sql` 核对结果、图片公开上传、正文渲染和 OG 验证。`.20` 完整业务验收尚未完成，`.21` 和 Epic 保持未完成。

### 完整验收范围

在 Beads `.19` / `.20` 记录站点 URL、Git 版本/构建 ID、日期、各流程结果和已知问题，不记录 secret、完整邮箱或支付明细。覆盖：

- 免费提交 → 首次审核 → 作者选择发布；付费到账 → 免审 → 作者选择发布。
- 已发布编辑免审；版本冲突提示；普通用户不能读写他人条目；EDITOR 编辑已发布内容。
- 管理下架后编辑/支付/旧任务不恢复可见性；管理恢复受作者发布意图约束。
- 支付签名错误、重复/乱序/延迟事件、取消、完整/部分退款、赞助到期。
- 上传类型/大小/归属，AI 限额和非公开 URL，通知失败/重试，退订。
- 公开 HTML/RSC/SEO/sitemap 不含私有身份/订单字段；下架前后详情、搜索、分类/标签/集合一致；CMS 草稿仅受控预览可见。
- 登录、Dashboard、编辑、管理、Studio 及正文在桌面和手机宽度显示正常。

仅凭本地 mock 通过不能关闭这两个人工任务。实际验收后再完成 `.21` 最终 README 和 Epic 验收。
