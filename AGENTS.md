<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions (SpeakEasy)

- Stack: Next.js 16 App Router, TypeScript, Tailwind v4, Drizzle ORM on Postgres, deployed on Vercel. `cacheComponents` is intentionally off.
- Auth: `src/proxy.ts` (Next 16's renamed middleware) redirects logged-out page visits. API routes wrap handlers in `withUser()` from `src/lib/api.ts` and must filter every query by `user.id`.
- Validate request bodies with zod schemas from `src/lib/validation.ts` via `parseBody()`.
- All Claude API calls go through `src/lib/ai.ts` and must keep a built-in fallback so the app works without `ANTHROPIC_API_KEY`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the migration in `/drizzle`.
- UI: reuse `src/components/ui.tsx`; use color tokens from `src/app/globals.css` (paper, surface, ink, muted, line, pine, coral). Pages live in `src/app/(app)/<page>/page.tsx` with their UI in `src/components/<page>/`.
- Before finishing: `npm run lint && npm run typecheck && npm run build`.
