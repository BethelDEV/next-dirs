# 本地验证

使用 Node >=22.12 和 `corepack pnpm`。所有数据为 `example.invalid` 合成数据；无需平台账号、生产凭据或旧数据库。

| 命令 | 作用 |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | 安装锁定依赖（仅下载公共软件包） |
| `corepack pnpm typecheck` | 不输出 JS、不改写类型文件 |
| `corepack pnpm lint` | Biome 只读检查 |
| `corepack pnpm test` | 禁止外部网络的 SQLite 约束和业务测试 |
| `corepack pnpm test:d1` | 本地 workerd/D1：原子写入、并发、支付重放、发布及通知故障恢复 |
| `corepack pnpm build:local:worker` | 合成配置下构建 Next.js 和 OpenNext 产物，不发布 |
| `corepack pnpm test:worker` | 真实 Worker 的路由、搜索/分页、HTML/RSC 边界、Stripe 验签/重放、Cron 及 OG 图片 |
| `corepack pnpm test:worker:serve` | 在 `http://localhost:8787` 启动浏览器验收用合成环境 |

## Worker 与浏览器验收

先执行 `build:local:worker`，然后执行 `test:worker`。这两步分别验证构建与运行，必须都通过。运行时只读取 `.dev.vars.example`，并在测试代码内启用合成 AI 参数，不会载入开发者 `.env` 或 `.dev.vars`；D1 在内存中从 SQL 初始化，Sanity 查询使用随 Sanity 安装的官方 `groq-js` 对合成投影执行，所有未实现的外部请求直接失败。测试没有远程资源绑定、管理 API 或部署步骤。

Miniflare 5 的 Worker 清单显式列出 JavaScript、WASM 和字体二进制，避免旧版 `modulesRules` 转换失败。Node 内建模块使用 workerd；测试打包对动态 `process` 引用提供静态导入。该打包器用于本地验收，实际平台仍使用 OpenNext/Wrangler 构建流程。输出的 gzip 大小是本地单个 JS bundle 的测量，不是平台部署总大小或启动 CPU 验收。

浏览器测试需要已安装 Playwright 的 Python 环境和 Chromium。保持 `test:worker:serve` 运行，在另一终端执行：

```bash
python tests/browser/architecture.py
```

用所安装 Playwright 环境的 Python 替换 `python`。脚本在 1440px 和 390px 下检查公开页面、正文、真实密码登录、Dashboard 分页、编辑保存、恶意 Markdown 预览、下架提示和访问控制。随后执行：

- 普通用户不能编辑他人条目，EDITOR 编辑已发布条目，ADMIN 首次审批、下架和账号停用；旧会话立即失效。
- 手动图片上传 → 投稿 → 免费审核 → 作者发布 → 实际 Worker Cron 写入 Sanity 替身 → 公开页可见。
- 失败发布的界面重试、付费免审后的作者发布、下架后的详情和 sitemap 隐藏。
- 真实服务端操作拒绝伪造套餐，忽略客户端 price ID；相同订单重用 checkout，已付款拒绝重复购买；浏览器 `pay=success` 不授予权益；签名 Webhook 重放只发放一次。
- 实际 AI SDK 请求、截图/图标下载、Sanity 上传协议和 D1 归属校验；AI 虚构分类/标签被过滤，生成草稿不能绕过审核，私网 URL/重定向及每日限额生效。

提供方响应由 `tests/helpers/{sanity,stripe,ai}-http.mjs` 模拟，不调用真实 AI、不产生支付或发信。浏览器中的外部资源请求也被拦截，图片使用本地像素。服务端操作测试从当前构建 manifest 取得 action ID，不能用旧构建的 manifest。截图和结果默认保存到 `/tmp/next-dirs-v1-ui`，可用 `UI_ARTIFACT_DIR` 指定输出目录。

每次完整浏览器测试前重启合成服务器，因为审批、编辑和下架会修改它的内存数据库。应用代码修改后先停止服务器、重新构建再启动；不要在浏览器测试运行期间重建 `.open-next/assets`。不要将这些合成账号用于实际环境。Studio 的本地入口与客户端构建可以验证，Sanity 登录、项目角色和 CMS 实际读写仍属于 `.19` / `.20` 人工验收。

`tests/helpers/providers.ts` 提供合成用户、图片引用、支付和 AI 输出，以及可注入故障的发布/邮件替身。`tests/helpers/sqlite.ts` 使用内存 SQLite，每次重新执行初始化 SQL。SQLite 测试不能替代 workerd/D1 仿真验收，也不能替代开发者实际部署验收。

## v1 本地验收结果（2026-09-15）

### 后续回归：已同步产品详情 404（next-dirs-5jm）

早期 Sanity HTTP 替身未模拟含点号文档 ID 的匿名访问限制，因此遗漏 `listing.<id>` 投影写入成功但公开查询不可见的问题。修复后使用 `listing-<id>`，替身在匿名查询前过滤受限 ID。新增真实 Worker 回归：D1 显示 `synced` 且存在旧点号投影时详情返回 404；作者通过业务服务重新保存内容，保持审核通过，Cron 创建新投影后同一详情地址返回 200。旧点号文档保留，公开查询仅返回新文档。

本轮 `typecheck`、`lint`、9 项单元测试、`test:d1`、`build:local:worker`、`test:worker` 和 `git diff --check` 通过；Worker 检查包含公开详情、分类/标签/集合、搜索、RSC 隐私、OG 和上述恢复流程。没有 UI 布局变更，本轮未重跑桌面/手机浏览器验收。线上仍需开发者部署后按 `docs/web-deployment.md` 重新同步受影响产品并反馈结果。

### 初始全量验收

| 检查 | 结果 |
| --- | --- |
| 17 个核心依赖的已安装 peer 范围 | 无冲突 |
| Sanity 本地 schema / typegen | 31 个查询、35 个 schema 类型生成成功 |
| TypeScript、Biome、`git diff --check` | 通过；Biome 检查 372 个文件 |
| 单元测试 | 9 项通过，包括正文与编辑预览的恶意 HTML 回归 |
| 本地 workerd/D1 | 通过；身份、原子状态、并发、支付、发布故障、上传、通知和到期清理 |
| Next / OpenNext 构建 | 通过；公开路由动态读取，Studio 随 Worker 构建 |
| 真实 Worker 仿真 | 通过；11 个基础路由及搜索/分类/标签/集合/分页、隐藏状态、Webhook、Cron、OG、HTML/RSC |
| Playwright 完整流程 | 1440px / 390px 通过，`pageerror` 为 0 |
| 本地 Worker 单个 JS bundle | 10,436,696 bytes；gzip 2,814,905 bytes，不含独立 WASM / 字体模块 |

完整浏览器结果保存在 `/tmp/next-dirs-v1-ui/report.json`，截图包括 `public-{1440,390}.png`、`dashboard-{1440,390}.png`、`edit-preview-{1440,390}.png` 和 `admin-390.png`。这些是本地临时验收产物，可以按上述命令重新生成。

本轮验收修复了编辑器预览执行原始 HTML、远程图标依赖、Dashboard 分类/标签 ID 冒充 slug、OG 样式不兼容、按钮过早退出等待状态、付款错误未提示，以及失效会话/普通用户访问管理页时的渲染回退。

构建仍提示 `middleware` 文件约定将被 `proxy` 替代；当前保留已通过 OpenNext 验证的入口。Miniflare 使用 alpha 版本并有测试打包兼容处理，Auth.js 为 beta 版本。实际部署总包体、启动和密码校验 CPU、Sanity 权限/预览、OAuth、真实测试支付和邮件仍需 `.19` / `.20` 的开发者网页验收；这些项目不由本地结果推断完成。

## 升级前基线（2026-09-15）

- 原 lockfile 安装成功：Next 14.2.35 / React 18.3.1 / Sanity 3.63.0。
- `tsc --noEmit --incremental false` 通过。
- Biome 只读检查：352 个文件，98 errors / 3 warnings；未自动修复。
- `next build` 编译成功，页面数据收集阶段因缺少 `NEXT_PUBLIC_SANITY_DATASET` 失败。旧构建要求 Sanity 配置和写 token；未提供真实值。
- 旧 Edge middleware 导入 bcrypt/Sanity 的 Node API，构建存在兼容性警告。

新的失败必须与上述基线区分。远程读取/邮件/支付均不用于本地检查；平台步骤见架构决策与最终网页交付材料。
