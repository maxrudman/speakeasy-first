# Speak Ready audit (Nov 17, before the Nov 19 demo)

Written before any code changes. It covers the README, `package.json`, the four pages, every API route and the database schema.

## What's there

- **Stack:** Next.js 16.4 App Router, React 19.3, TypeScript, Tailwind v4, Drizzle ORM on Postgres (Neon in production), deployed on Vercel. Migrations run in `vercel-build`.
- **Auth:** username + bcrypt password. A signed JWT (`jose`, HS256, 30 days) sits in an HTTP-only `sr_session` cookie. `src/proxy.ts` redirects logged-out page visits. API routes use `withUser()`.
- **Tables:** `users` (holds the vocab preferences too), `vocab_terms` (Leitner box 0 to 5, `active`/`retired`/`removed`), `journal_entries`. Every query is filtered by `user.id`.
- **AI:** `src/lib/ai.ts` calls Claude (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) and pulls JSON out of the reply with a regex. It falls back to built-in lists: 89 terms, 33 question templates, and a 96-question journal bank.
- **Recording:** `MediaRecorder` with default settings. Live transcript from the browser's Web Speech API, with a typed fallback. Audio stays in memory as a Blob URL.
- **Checks:** `npm run lint`, `npm run typecheck` and `npm run build` all pass with no errors or warnings. CI runs those plus a migration and schema-drift check against Postgres 17.

## Bugs found by click-testing (desktop 1280px and iPhone 13 emulation)

Every flow was clicked through: sign up, log in, onboarding, flashcards (reveal, right, wrong, keyboard, remove), preferences, practice questions, record / stop / playback, transcript copy and save, journal search / bank / new / edit / delete, change password, log out and back in, demo login.

| # | Bug | Severity |
|---|---|---|
| 1 | **Redirect loop.** A valid session cookie for a user who no longer exists (for example after a Neon preview branch is reset) bounces `/vocabulary` ↔ `/login` forever, and the browser shows "too many redirects". There's no way out without clearing cookies. | High |
| 2 | **Deleted recording comes back.** Clicking *Next question* while still recording, then confirming, shows the old recording on the next question, because `MediaRecorder.onstop` fires after `reset()`. | High (privacy promise) |
| 3 | **No error boundaries.** If the database is down, or any server component throws, users see Next's raw "Application error" page. No `error.tsx`, `global-error.tsx`, `loading.tsx` or `not-found.tsx` exists. | High |
| 4 | **Personal data can reach the logs.** `withUser()` logs the whole error object. Drizzle's "Failed query" errors include the query parameters, which can be a journal answer or transcript. | High |
| 5 | **Next on the last question silently deletes the take** and stays on the same question if more questions haven't loaded. | Medium |
| 6 | **Journal Edit and Delete are hidden** until you tap an entry, so most people never find them. | Medium |
| 7 | **Speech recognition can spin.** `onend` restarts recognition with no limit, so a repeating `network` or `audio-capture` error becomes a tight restart loop. | Medium |
| 8 | **Signup race.** Two sign-ups with the same username at the same moment hit the unique index and return "Couldn't create your account" instead of "That username is taken". | Low |
| 9 | **No offline state.** Requests fail with a generic message, there is no banner, and nothing times out, so a hung request spins forever. | Medium |
| 10 | **Demo password mismatch.** `scripts/seed.ts` creates `demo / demo1234`; the team brief says `demo / demo12345`. | Check with Max |

## Gaps against the polish brief

- No `/api/health`, no structured server logging, no rate limiting on login, sign-up or AI routes.
- The AI helper has one model, no fallback model, no timeout per attempt, no circuit breaker and no caching, and it parses JSON with a regex instead of structured outputs. `SPEAKEASY_MOCK_AI` is mentioned in the brief but doesn't exist in the code yet.
- Transcription is browser-only, so it fails for some voices and browsers (Firefox, and some Safari setups). There are no audio constraints (echo cancellation, noise suppression, auto gain), no level meter, no format detection and no length limit.
- The vocabulary "streak" only lives in memory and resets on reload; there is no history to chart.
- The practice audience lives in `localStorage` only, so it doesn't follow the user to another device.
- No public landing page and only page titles for SEO. There's no `sitemap`/`robots`; logged-in pages aren't marked `noindex`.
- No PWA, reminders, calendar export, coach or troubleshooting help.

## Plan

One pull request per stage, each stacked on the one before so Vercel builds a preview of each: 0 fixes, 1 transcription, 2 AI cascade, 3 troubleshooting, 4 coach, 5 reminders/PWA, 6 devices, 7 polish and tests. Merge them in order.
