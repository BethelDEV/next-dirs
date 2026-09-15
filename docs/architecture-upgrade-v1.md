这是一个目录站的模板项目，现在需要对该模板项目做改造升级：
1. 升级 Next.js / React / Auth / Sanity
Next 14 → Next 16.3.x
React 18 → 对应 React 19
然后把 Auth.js、Sanity、Stripe 等依赖一起升级测试。

2. 项目要运行在 Cloudflare Workers 中，需要迁移部署环境；

3. 数据存储架构要做调整：把用户数据、应用数据库放在 Cloudflare D1 （用户隐私、身份认证、业务状态、关系型数据和内部工作流），把 “CMS 内容”、应用图片等资源放在 Sanity，Sanity 只存“即使被公开也不会造成安全事故”的数据。

架构升级决策：
Project runs on Cloudflare Workers. Cloudflare D1 stores private application data, identity, authentication, business state and workflows. Sanity serves as the editorial CMS and published catalog, storing only content that is safe to expose publicly. Public application media is stored in Sanity Assets. Users never write directly to Sanity; all user-generated changes first enter D1 and are published to Sanity only through trusted application workflows.

相比 Mkdirs 原版，这是有限度重构，而不是推倒重写：目录 UI、Sanity Schema/Studio、分类/标签/Collection、搜索展示、SEO、图片体系基本可以继续使用；主要替换 Sanity Auth Adapter、Submission、Order/User persistence 和部署层。

架构升级最大价值并不是性能，而是确立了一个非常干净的原则：
Sanity 负责“世界可以看到什么”；D1 负责“Project 内部发生了什么”。

4. 架构升级完成后，根据项目原理，重新编写 README.md 文件

