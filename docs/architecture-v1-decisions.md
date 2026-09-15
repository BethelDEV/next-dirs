# 架构 v1 实施决策

## 边界

本次授权实施 `next-dirs-5x9`。没有历史数据迁移。平台资源、权限、远程 SQL、部署由开发者在网页后台执行；本地脚本不得创建或修改远程环境。Git 提交和推送另由开发者决定。

D1 是身份、内容草稿、条目版本、审核、订单、上传归属、通知和审计的唯一业务事实来源。Sanity 只保存可公开的目录投影和 CMS 内容，图片直接进入公开 Sanity Assets。

| 数据 | 管理方 | 可公开字段 |
| --- | --- | --- |
| 用户、OAuth、验证与重置令牌 | D1 / 认证服务 | 无；会话只给本人必要字段 |
| 公开作者 | D1 用户公开字段 → 条目内嵌快照；博客作者为 CMS profile | 显示名称、头像、公开链接，不自动公开邮箱 |
| 条目内容 | D1 / 应用 | 名称、稳定 slug、描述、Markdown、图片、分类、标签 |
| 发布投影 | D1 outbox → Sanity | 内容白名单、公开版本、可见性、发布时间、展示权益 |
| 订单、审核理由、owner、操作记录 | D1 | 无 |
| 分类、标签、Collection、博客、页面 | Sanity Studio | CMS 内容 |
| 图片上传意图和归属 | D1 | 仅成功后的公开资源引用进入投影 |

## 版本组合

2026-09-15 核对 npm registry 的发行版本及 peerDependencies。使用精确版本和 pnpm lockfile；本地 Node 24，最低 Node 22.12。

| 包 | 选定版本 | 约束 |
| --- | --- | --- |
| Next / third-parties | 16.3.5 | 符合 16.3.x 目标；迁移 async request APIs |
| React / React DOM / types | 19.3.0 | 同版本 |
| Sanity / GROQ / Vision | 6.13.2 | React >=19.2.2、Node >=22.12 |
| next-sanity | 13.3.4 | Next 16、Sanity 5/6、client 7/8 |
| Sanity client | 8.6.1 | 公共读取与服务器发布客户端分离 |
| Auth.js | 5.0.0-beta.32 | Next 16 / React 19 peer；明确保留 beta 风险 |
| D1 adapter | 仓库实现 | `src/db/auth-adapter.ts`，JWT / OAuth 契约由本地 D1 测试覆盖 |
| OpenNext Cloudflare | 1.20.6 | 支持 Next >=16.3.3，Wrangler ^4.125.0 |
| Wrangler | 4.131.2 | 仅本地类型生成/仿真/构建 |
| Stripe | 22.6.2 | fetch HTTP + Web Crypto 异步验签 |

沿用 Auth.js + D1，避免替换已有凭据/OAuth UI 和会话集成。Better Auth 不纳入本轮。JWT 只标识会话，服务端敏感操作重新读取 D1 的角色、禁用状态和会话版本；密码重置/禁用使旧会话失效。

## 状态和权限

审核、付款、发布互相独立：

- 首次审核：`draft → pending → approved/rejected`。未首次发布的免费内容修改后重新等待首次审核；付费资格可免人工审核。
- 支付订单：`pending → processing → paid/failed/expired`，退款另记。浏览器成功参数不能授予权益；签名验证后的事件按事件和支付对象幂等处理。
- 作者意图：`unpublished/published`。免费审批或付款成功不自动替作者首次发布。首次发布后编辑直接同步，不复审。
- 管理下架独立保存；作者编辑、付款、旧发布任务都不能解除。
- slug 创建后稳定；使用唯一约束和可预测的冲突后缀。编辑用版本条件更新防止覆盖。
- USER 只编辑本人内容；EDITOR/ADMIN 可编辑已经发布过的用户条目、首次审核、下架和恢复。只有 ADMIN 可改角色/禁用账号。付款事实、owner 不接受表单字段修改。
- Sponsor 从首次发布写入起持续 30 天（网络响应丢失时沿用该次起点）；再次购买只允许现有权益到期后，不能并发创建两个有效订单。到期降为 Pro，移除赞助位置，保留 Pro 展示权益，保留目录条目。退款不自动退款调用：接收提供方退款事实，撤销付费展示权益；已发布条目保留，未发布且未审核条目回到首次审核条件。部分退款保留资格，完整退款撤销。

## 发布一致性

业务状态与 outbox 在 D1 原子 batch 中写入。固定 Sanity 文档 ID；发布、隐藏、恢复共享同一版本顺序。Sanity 公开文档保留版本墓碑，隐藏不物理删除，避免租约过期后的旧任务重新创建。写入使用 revision 条件事务，旧版本不得覆盖新版本。失败保留 D1 内容和上次有效公开版本，任务可重试。通知独立，不影响支付/发布提交。

## 平台网页流程

Workers 使用网页关联 Git 代码源的 Builds；构建在平台执行，代理不在终端部署。D1 的 SQL console 用于人工初始化和版本核对。Studio 嵌入 `/studio`，随同 Worker 发布，避免单独执行 Sanity CLI 部署。Sanity 项目、dataset、token、CORS 和角色由管理网页设置。自定义最小权限的可用性依 Sanity 账户套餐核对，Studio 的 readOnly 只是界面约束；运行时发布 token 必须仅在服务端。

实际环境能力仍由 human-step `.19` / `.20` 验证。OpenNext 框架缓存需要额外资源时单独列出；没有临时图片 R2 不等于禁止框架缓存。初版优先动态公开读取（Sanity API、不叠加框架共享缓存），可靠发布验收后再决定缓存设施。

## 依据

- [Next 16 升级](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [OpenNext Cloudflare 配置](https://opennext.js.org/cloudflare/get-started)
- [Workers Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [D1 原子 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Auth.js D1 adapter](https://authjs.dev/getting-started/adapters/d1)
- [Studio 托管](https://www.sanity.io/docs/studio/deployment)

版本 peer 匹配不替代安装、类型、构建、本地 Workers 或实际部署验收；这些证据分别记录在对应 Beads 任务。

Collection 在 Studio 的集合文档内选择公开条目，应用发布不会覆盖策展关系。
