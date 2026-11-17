# Changelog

## Stage 0: find and fix errors

Lint, type-check and build were already clean; every bug below was found by clicking through each flow at desktop (1280px) and phone (iPhone 13) sizes.

**Bugs fixed**
- **Redirect loop** after a database reset: a cookie for a user that no longer exists bounced between `/vocabulary` and `/login` forever. Pages now clear the cookie (`GET /api/auth/logout?reason=expired`) and the login page says "Your session ended."
- **Deleted recording reappeared**: pressing *Next question* mid-recording brought the old take back on the next question. A stopped take that was deleted is now discarded.
- **Next on the last question** silently deleted the take and stayed put. It now loads more questions and moves on, or shows an error with *Try again*.
- **Journal Edit and Delete** were hidden until an entry was tapped. They're always visible now, with descriptive labels for screen readers.
- **Speech recognition restart loop**: it now gives up after 8 restarts in 10 seconds and falls back to typing.
- **Signup race**: two sign-ups for the same name now get "That username is taken" instead of a server error.
- **"1 entry" wrapped** onto two lines on phones.

**Error, loading, empty and offline states**
- `error.tsx` for the app pages and the root, `global-error.tsx`, `not-found.tsx` and a skeleton `loading.tsx`. Every failure shows a plain-language message, *Try again*, a link home and a short reference code that matches the server log. No raw error text.
- An offline banner on every page. Browser requests time out (30 s, 70 s for AI) and explain offline, slow-server, rate-limit and server errors in plain words.

**Logging**
- New `src/lib/log.ts` writes one JSON line per event. It removes database query parameters (which can contain journal text), masks keys, tokens, JWTs and connection strings, and never logs request bodies. All API failures, sign-in and sign-up failures and AI fallbacks go through it.

**Health check**
- `GET /api/health` checks the database and each AI and transcription provider that has a key (Anthropic, OpenAI, Deepgram, AssemblyAI) with a cheap authenticated request and short timeouts. Providers without a key show `not_configured`. Results are cached for 60 seconds and include no user data. It returns 503 only when the database is down.

## Stage 1: transcription that works for every voice

**Cascade** (falls through automatically; any tier without a key is skipped)
1. **Browser live captions**, auto-restarted when they pause (capped so errors can't spin).
2. **OpenAI Whisper** on the server (`OPENAI_API_KEY`). It runs when the browser has no captions or they fell behind the speech (fewer than about 0.8 words per spoken second).
3. **Deepgram**, then **AssemblyAI** (`DEEPGRAM_API_KEY`, `ASSEMBLYAI_API_KEY`).
4. **Manual:** "We couldn't transcribe this one. Type or paste your answer."

Each server tier gets a timeout and one retry with backoff, and a circuit breaker skips a provider that keeps failing. The browser also retries the upload once.

**Recording**
- Picks a supported format by feature detection: WebM/Opus or Ogg/Opus in Chrome, Edge and Firefox; MP4/AAC in Safari. Records at 32 kbps so 5 minutes is about 1.2 MB, under Vercel's 4.5 MB body limit.
- Requests echo cancellation, noise suppression, auto gain and mono, and falls back to plain audio on devices that reject them.
- Live input-level meter, plus "You sound quiet. Move closer…" after 3 seconds of soft input.
- Silent or empty takes get "We didn't hear anything…". Takes under 1 second get a tip. Recording stops at 5 minutes with a notice, and the upload limit is 4 MB.
- Low-confidence words (from Whisper segments, Deepgram, AssemblyAI or the browser) show as chips. Tapping one selects it in the transcript to fix.
- "Not right? Transcribe again" re-sends the in-memory take to the server tiers.

**Privacy**
- Audio is sent as multipart form data and held in memory for that request only. It is never written to disk, the database or logs. Deepgram is asked to opt out of model improvement, and AssemblyAI transcripts are deleted right after.

**Server**
- `POST /api/transcribe` (login required, 30 per user per 10 minutes) and `GET /api/transcribe` (is server transcription available?).
- New `rate_limits` table (migration `0001_rate_limits`) used by a shared Postgres rate limiter. It fails open if the table is unavailable.
- New helpers in `src/lib/resilience.ts`: timeouts, retry with exponential backoff and jitter, and a circuit breaker. Stage 2 reuses them.

**New env vars** (all optional): `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL`, `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL`, `ASSEMBLYAI_API_KEY`, `SPEAKEASY_MOCK_TRANSCRIPTION` (tests only).

**Tested** in Chromium with a fake microphone: a tone goes through the server tier (mock) and shows a low-confidence chip; a silent file shows the no-speech message; a soft tone shows the "too quiet" tip; with no keys you get the manual message. The 30th upload in a window returns 429. Uploads over 4 MB and non-audio files are rejected with plain messages.

## Stage 2: AI backups (cascade)

**One helper for every AI call:** `runJson()` in `src/lib/ai-cascade.ts`. Vocabulary terms and practice questions use it now; the Stage 4 coach will too. Order:
1. `SPEAKEASY_MOCK_AI=1`: no network calls, built-in content (labelled `mock`).
2. `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`).
3. Each model in `ANTHROPIC_MODEL_FALLBACKS` (for example `claude-haiku-5-5`).
4. OpenAI (`OPENAI_MODEL`, default `gpt-4o-mini`) when `OPENAI_API_KEY` exists.
5. Earlier results for the same profile from the new `ai_cache` table (migration `0002_ai_cache`).
6. Built-in content: 89 terms, question templates and the journal bank.

**Per model tier:** 25 s timeout inside a 45 s overall budget; exponential backoff with jitter on 429, 5xx and timeouts (two retries); a circuit breaker that skips the tier for 60 s after three failures in a row; and structured outputs with zod validation, one re-ask quoting the exact problem, then fall-through. Refusals and cut-off replies fall through to the next model. Models that reject `output_config` (older ones) automatically switch to plain mode. Low effort keeps these short generations fast.

**Caching and limits:** each successful result is cached per user and profile (level/field/audience, or purpose/role/specifications), keeping the newest 5 and clearing entries older than 30 days. Each user gets 40 AI generations per 10 minutes; beyond that they get cached or built-in content instead of an error. Login is limited to 10 attempts per username and network per 10 minutes, and sign-up to 10 per network.

**Logging:** `ai.answered` records the task, source, tier, attempt count and time, plus `ai.retry`, `ai.reask`, `ai.tier_failed` and `ai.skipped_open_circuit`. Prompts and replies are never logged. `/api/health` now lists the cascade order as `aiTiers`.

**UI:** Vocabulary and Practice say plainly when content came from earlier sets or the built-in list.

**New env vars** (optional): `ANTHROPIC_MODEL_FALLBACKS`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `SPEAKEASY_MOCK_AI`.

**Tested** against a local fake Anthropic server. A 429 model was retried twice then skipped, a 500 model the same, and a bad-JSON model was re-asked and answered. With every model down, the same audience was served from cache and a new audience from the built-in list. Mock mode made no calls. The 11th bad login returned 429. The full click-test passes at desktop and phone sizes.

## Stage 3: in-app troubleshooting

A **"Having trouble?"** button on Practice and Vocabulary (icon-only on narrow phones) opens a side panel:
- **What we found:** problems detected automatically, each with its exact fix. It covers: offline; non-https pages; browsers or in-app webviews that can't record; microphone blocked; silent or very quiet test recordings (including Mac and Windows privacy settings); the mic held by another app; no live captions (and whether server transcription will cover it); cookies off; a slow connection; and our servers being down or degraded.
- **Microphone:** permission status (allowed, blocked, not decided, or unknown) and a 3-second test recording with a live level bar, a verdict ("We heard you clearly", "very quietly", "didn't hear anything") and playback. The test audio stays on the device and is freed when the panel closes.
- **Allow the microphone:** step-by-step fixes for Chrome, Safari on iPhone (including Screen Time and "Open in Safari"), Android, Safari on Mac, Firefox and Edge. The likely platform opens first and you can switch tabs.
- **Connection and services:** round-trip time to the app plus live status of the database and each AI and transcription provider from `/api/health`, with "Test again".
- **Browser and device details:** a feature-detection checklist (https, getUserMedia, MediaRecorder and chosen format, live captions, level meter, cookies, clipboard, screen size, touch, language).
- **Copy diagnostic info:** device and service checks as JSON, with no username, ids, answers or recordings.

Detection uses feature checks. The user-agent string is used only to choose which instructions to open first.

**Tested** in Chromium at desktop size (all clear, mic test "heard you clearly") and on an emulated Pixel 7 with a silent microphone (silent problem and fix shown, Android steps preselected). The copied diagnostics contain no username.
