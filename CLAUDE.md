# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mkdirs v1 uses Next.js 16 / React 19 on Cloudflare Workers through OpenNext. D1 owns identity, listing business content, review, payments, uploads, notifications and audit. Sanity holds public listing projections, CMS content and public images. See `README.md`, `docs/architecture-v1-decisions.md`, and `docs/local-validation.md`.

## Execution Boundaries

Cloudflare / Sanity resource creation, remote SQL, bindings, secrets, CORS, roles, Cron, domains and deployment are developer-only web dashboard steps. Do not use CLI, management APIs, SDKs or scripts to bypass this boundary. Local configuration, SQL files, builds and isolated workerd/D1 tests are authorized. Do not commit, push or sync Dolt without explicit user authorization. Human acceptance is tracked in `next-dirs-5x9.19` and `.20`.

## Commands

Use `corepack pnpm` with Node >=22.12; the lockfile specifies the pnpm version.

- `typecheck`: TypeScript, no output or incremental cache.
- `lint`: read-only Biome checks; `lint:fix` applies unsafe fixes.
- `format`: formatting with writes.
- `test`: network-disabled SQLite and rendering tests.
- `test:d1`: isolated workerd/D1 integration tests.
- `build:local:worker`: synthetic Next/OpenNext build, no provider credentials required.
- `test:worker`: run the built Worker with local HTTP doubles and exit.
- `test:worker:serve`: the same fixture at localhost:8787 for browser tests.
- `python tests/browser/architecture.py`: desktop/mobile acceptance using installed Playwright.
- `dev`: Next dev with local OpenNext bindings; requires prepared local D1 and CMS configuration.
- `build:worker`: OpenNext build using developer-provided build variables; does not deploy.
- `typegen`: local Sanity schema extraction and type generation after schema changes.
- `email`: React Email preview on port 3333.

Stop the fixture before rebuilding; restart before each full browser run because its memory database is mutated. `next start` alone is not a Workers/D1 runtime. Removed batch-write and email-export scripts must not be restored as a bypass around business services.

## Architecture

- `src/app/(website)/(public)/`: directory, taxonomy, search, blog, pricing and CMS pages.
- `src/app/(website)/(protected)/`: dashboard, submit/payment/publish, edit, settings and `/admin`.
- `src/app/(sanity)/studio/`: embedded Studio; CMS staff permissions are independent of application roles.
- `src/app/api/`: Auth.js, signed Stripe webhooks, upload, OG and controlled preview routes. Legacy send-email is disabled.
- `src/db/` and `migrations/`: D1 schema, version records, constraints, auth adapter and atomic business transitions.
- `src/services/` and `worker.ts`: provider integrations, outbox publication, upload and notification processing, scheduled maintenance.
- `src/data/`: D1 application DTOs and Sanity public reads.
- `src/sanity/`: public schemas, generated queries, anonymous published reads, separate server-only publishing and preview clients. No Sanity auth/order persistence.
- `src/auth.ts` / `src/auth.config.ts`: Auth.js credentials/OAuth and fresh D1 role/disabled/session-version validation. Middleware handles navigation; every action/API must enforce its own authorization.
- `src/components/`: feature directories and generated Radix/shadcn primitives; Tailwind styling.
- `src/config/`: site, pricing and marketing configuration; feature switches in `src/lib/constants.ts`.

Free first publication requires review; paid access skips review. Authors still control first publication. Published edits synchronize without another review. Staff hiding cannot be undone by author edits, payment or stale outbox work. Users edit their own records; EDITOR/ADMIN can edit published user content; only ADMIN changes roles or disables accounts. Stable slugs and version checks prevent lost edits. Render user content as safe Markdown, never executable MDX.

## Environment and Validation

Use `.env.example` for real variable names and `.dev.vars.example` only for synthetic local fixtures. Key names include `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `AUTH_SECRET`, `SANITY_PUBLISH_TOKEN`, `SANITY_PREVIEW_TOKEN`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, and optional Resend / AI keys. Never place secrets in `NEXT_PUBLIC_*`. Platform setup instructions and SQL order are in `docs/web-deployment.md`.

There is no legacy-data migration or temporary-image R2. Public HTML, RSC, JSON and Sanity projections must exclude email, password, tokens, orders, internal notes and business owner fields. Local tests do not prove actual Worker package/CPU limits, provider authentication, or CMS permissions; keep human-step tasks open until the developer supplies evidence.

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
