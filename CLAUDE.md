# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mkdirs is a Next.js 14 directory website template with Sanity CMS, enabling AI-powered directory sites with listings, payments, authentication, blog, and newsletter features.

## Commands

- **Dev server**: `pnpm dev`
- **Build**: `pnpm build`
- **Start production**: `pnpm start`
- **Lint**: `pnpm lint` (Biome - checks and auto-fixes)
- **Lint with unsafe fixes**: `pnpm lint:fix`
- **Format**: `pnpm format` (Biome)
- **Generate Sanity types**: `pnpm typegen` (run after schema changes)
- **Email preview**: `pnpm email` (starts email dev server on port 3333)
- **Batch item operations**: `pnpm item:import`, `pnpm item:fetch`, `pnpm item:update`, `pnpm item:remove`
- **Batch all**: `pnpm batch` (or `pnpm batch:import`, `pnpm batch:update`, `pnpm batch:remove`)

## Architecture

### Route Structure (Next.js App Router)

The app uses two top-level route groups:

- `src/app/(website)/` - Main website with nested groups:
  - `(public)/` - Public pages: home, search, item, category, tag, collection, blog, pricing
  - `(protected)/` - Auth-required pages: dashboard, settings, submit, edit
  - `(newsletter)/` - Newsletter unsubscribe
  - `auth/` - Login, register, reset password, email verification
- `src/app/(sanity)/` - Sanity Studio admin interface (accessible at `/studio`)
- `src/app/api/` - API routes: auth, webhook (Stripe), og images, draft mode, send-email, upload-image

### Route Protection

`src/routes.ts` defines public routes, auth routes, and API auth prefix. `src/middleware.ts` enforces access control. Authenticated users on auth routes redirect to `/dashboard`.

### Data Layer

- **Sanity CMS** is the primary content store. Schemas live in `src/sanity/schemas/documents/` organized by domain: `directory/` (item, category, tag, collection, group), `blog/` (post, author), `page/`, `order/`, `auth/`, and `settings.ts`.
- **`src/data/`** contains data access functions (item.ts, blog.ts, collection.ts, user.ts, account.ts, order.ts, submission.ts, etc.) used by server components and actions.
- **`src/sanity/lib/`** has Sanity client utilities and GROQ query helpers.
- **`sanity.types.ts`** contains auto-generated TypeScript types from Sanity schemas (regenerate with `pnpm typegen`).

### Server Actions

`src/actions/` contains all server actions for mutations: authentication (login, register, reset), item operations (submit, edit, publish, unpublish), payment (checkout sessions, customer portal), settings, newsletter subscription, and admin operations.

### Key Integrations

- **Auth**: NextAuth v5 (beta.18) configured in `src/auth.ts` and `src/auth.config.ts`. Supports credentials + OAuth providers.
- **Payments**: Stripe via `src/lib/stripe.ts`, with checkout session creation in actions and webhook handling in `src/app/api/webhook/route.ts`.
- **AI**: Vercel AI SDK with multiple providers (OpenAI, Google, DeepSeek, xAI, OpenRouter) for content generation assistance.
- **Email**: React Email templates in `emails/` sent via Resend (`src/lib/mail.ts`).
- **Analytics**: OpenPanel integration (`@openpanel/nextjs`).
- **Image metadata**: Microlink (`@microlink/mql`) for fetching website screenshots/metadata.

### Components Organization

`src/components/` is organized by feature domain: `auth/`, `blog/`, `item/`, `category/`, `collection/`, `tag/`, `dashboard/`, `payment/`, `pricing/`, `search/`, `submit/`, `edit/`, `publish/`, `newsletter/`, `settings/`, `home/` (+ `home2/`, `home3/` variants), `layout/`, `shared/`, `icons/`, and `ui/` (shadcn/ui primitives).

### Configuration

- `src/config/site.ts` - Site-wide settings (name, URL, description)
- `src/config/price.ts` - Pricing plans configuration
- `src/config/dashboard.ts` - Dashboard navigation
- `src/config/hero.ts`, `footer.ts`, `faq.ts`, `marketing.ts` - Landing page sections
- `src/lib/constants.ts` - Shared constants
- `src/lib/schemas.ts` - Zod validation schemas used across forms and actions

### Styling

Tailwind CSS with `tailwind.config.ts`. UI primitives are Radix UI-based shadcn/ui components in `src/components/ui/`. Biome ignores `src/components/ui/*.tsx` (generated code).

### Environment

Copy `.env.example` to `.env`. Key variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, Resend API key, and AI provider keys.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
