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

## Stage 4: AI Coach

A floating **Coach** button sits on every logged-in page (bottom right, above the phone tab bar). It opens a chat panel: full screen on phones, a 26rem panel on desktop.

- **Streams replies** through the AI cascade (`streamText()` in `src/lib/ai-cascade.ts`): mock → `ANTHROPIC_MODEL` → fallbacks → OpenAI → built-in. A tier that fails before its first word is retried once on 429, 5xx or timeout, then the next tier answers. A reply cut off mid-stream ends with a short note instead of breaking.
- **Knows the user:** level, field, audience, vocabulary progress (counts, often-missed and recently mastered terms), practice settings, the question on screen, the latest answer and how long it took, the revealed flashcard, and the 4 most recent journal entries. These are sent as context in the system prompt and treated as information, not instructions.
- **Can:** critique an answer (structure/STAR, specificity, concision, filler words, pacing in words per minute), rewrite it in the user's voice without inventing achievements, give harder or easier questions, explain a word, and run a one-question-at-a-time mock interview. It works for any field and format.
- **Shortcuts** adapt to the page: *Critique my answer* and *Rewrite it* when there's a transcript, *Explain "term"* when a card is revealed, plus *Mock interview*, *Harder* and *Easier questions*. A **Get coach feedback** button sits next to the Practice transcript.
- Every reply has **Save to journal** (the prompt is the question on screen, or your message) and **Copy**.
- **Stays on topic:** off-topic requests are redirected to speaking practice, with no legal, medical or financial advice. Messages are capped at 6,000 characters and 60 per user per 10 minutes.
- **History per user** in the new `coach_messages` table (migration `0003_coach_messages`). The last 20 turns go to the model. **Clear** deletes it after a confirmation, and account deletion cascades.
- **Offline coach:** with every provider down, a critique still measures length, pace, filler words, sentence length, specifics and STAR structure, and other requests get practical next steps.

**Tested** against a local fake streaming Anthropic server. The primary model failed with 500 and was retried, then the fallback model streamed a reply that mentioned the user's field. Explain-the-card, Save to journal, history after reload and Clear all worked at desktop and phone sizes. With all models down, the built-in critique was correct (5 fillers, 124 wpm).

## Stage 5: reminders, calendar, installable app and push

Everything here is **optional and off by default**. With no keys set, each feature hides itself or explains that it isn't set up, without errors.

**Email reminders**
- Account → **Reminders**: how often (off, daily, or weekly on a chosen day), plus an optional email address with explicit consent ("Email me practice reminders. I can unsubscribe anytime."). Login stays username-only. Without consent, no address is stored. The user's time zone is saved automatically.
- Sent through **Resend** (`RESEND_API_KEY`) or **SendGrid** (`SENDGRID_API_KEY`) from `EMAIL_FROM`, with `List-Unsubscribe` and one-click (RFC 8058) headers.
- **Vercel Cron** (`vercel.json`) calls `/api/cron/reminders` daily at 15:00 UTC with `Authorization: Bearer $CRON_SECRET`. No secret means no run. Daily is used because Vercel's Hobby plan only allows daily cron jobs. Users are never reminded twice within 20 hours. A failed send is retried at the next run.
- **Unsubscribe:** a signed link opens a confirm page (so link scanners can't unsubscribe people), and mail apps can use one-click POST. Unsubscribing turns reminders off and deletes the address. Forged tokens are rejected.
- Reminder content: how many terms are waiting plus a question from the bank. Journal text is never included.

**Add to calendar**
- On Account ("Schedule practice", "Add an interview date") and Practice. Choose a practice session or interview, title, date, time, length and repeat (daily for 30 days or weekly for 12 weeks). You get a downloadable **.ics** (with a 15-minute alert and the repeat rule), a **Google Calendar** link (with the repeat rule) and an **Outlook.com** link. Works with no server keys.

**Installable app (PWA)**
- `manifest.webmanifest` with name, colours, shortcuts and 192/512/maskable icons, an Apple touch icon, `viewport-fit=cover`, and Apple web-app meta tags.
- A service worker (`public/sw.js`) that always loads pages from the network (so deploys show up immediately) and shows `/offline` when there's no connection. It caches only hashed build files and icons, never API responses or user data.
- Account → **Install the app** shows a one-tap Install button where the browser offers it (Android and desktop Chrome or Edge), plus step-by-step guides for iPhone (Safari → Share → Add to Home Screen), Android and desktop.

**Web Push**
- Account → **Notifications on this device**: turn on or off, and send a test. Push uses VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); subscriptions are stored in `push_subscriptions` and removed when a browser reports them gone.
- On iPhone, Web Push only works in the installed app (iOS 16.4+). The page detects this and points to the install guide, with email as the fallback. Blocked and unsupported cases are explained.
- Reminders go to devices first and fall back to email when no device can be reached.

**Schema:** migration `0004_reminders_push` adds `email`, `email_consent_at`, `reminder_frequency`, `reminder_weekday`, `timezone` and `last_reminder_at` to `users`, plus the new `push_subscriptions` table.

**New env vars** (optional): `APP_URL`, `EMAIL_FROM`, `RESEND_API_KEY` or `SENDGRID_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Tested:**
- With no keys: reminders show "not set up", the cron job skips, and the manifest, service worker, icons, `/offline` and `/unsubscribe` load without a login.
- With keys: settings validate and save, the cron job rejects a wrong secret and finds the due user, and a failed Resend call (blocked in the sandbox) is logged without the address and not marked as sent.
- Unsubscribe: the confirm page works, one-click unsubscribe clears the email and consent, and a forged token is rejected.
- In the browser: the .ics download is a valid weekly event and the Google link carries the repeat rule.
- Not tested: a real push delivery. Headless browsers can't receive notifications.

## Stage 6: every device

- **Touch targets:** every button, field, select, tab and summary is at least 44×44px on touch screens. Sidebar links are 44px everywhere. Desktop mouse layouts stay compact. The device audit went from 3–19 undersized targets per page to 0.
- **iPhone:** 16px form text on touch screens (no zoom on focus), `viewport-fit=cover`, and safe-area padding on all four sides for the header, content, tab bar, Coach button and panels, in portrait and landscape.
- **Landscape and short screens:** the Coach opens full screen when the screen is 520px tall or less.
- **Content never hides** behind the tab bar or Coach button (bottom padding accounts for both plus the home indicator). Long words wrap instead of causing sideways scroll.
- **Recording fixes:**
  - iPhone Safari: the audio context is created inside the tap so the level meter works.
  - Silence is only judged when the meter really ran, so there's no false "we didn't hear anything".
  - Chrome/Edge: WebM playback now shows the real duration (was Infinity, which broke seeking).
  - The troubleshooting mic test got the same Safari fix.
- **Old browsers:** dialogs fall back to the `open` attribute where `showModal()` is missing.
- New `docs/DEVICES.md`: what's feature-detected, the fallbacks, the browser quirks we handle, and the test matrix.

**Tested:** Chromium with Playwright device emulation on 7 screen sizes (audit) and 9 browser/device profiles (full flow), including simulated no-captions and no-`MediaRecorder` browsers. Real Safari (WebKit) and Firefox (Gecko) engines weren't available, so please check a real iPhone and Android phone before the demo.

## Stage 7: polish and tests

**Progress**
- New `practice_days` table (migration `0005_practice_days`) counts daily reviews, correct answers, mastered terms and saved answers in the user's own time zone. The browser sends `X-Timezone`. This gives a real, persistent **day streak**: the vocabulary "Streak" was an in-memory right-answers count that reset on reload, and is now labelled "Right in a row".
- Account → **Your progress**: tiles for day streak, best streak, terms mastered and journal entries, plus two single-series charts (flashcards reviewed per day for 30 days, and terms mastered over time). Charts have hover, touch and arrow-key tooltips, a screen-reader summary and a "Show as table" view. The colour was validated for light and dark. The mastered line is counted back from the real total so it always matches the tile.

**Polish**
- Design system documented in `docs/DESIGN.md`. Fonts are self-hosted and preloaded with `next/font/local` (the `@fontsource` packages were removed).
- **Dark mode:** Account → Appearance (Match my device, Light or Dark), applied before first paint with no flash. `dark:` utilities follow it.
- **Toasts** for saves and deletes (journal, coach, practice), announced to screen readers.
- **Skeleton loaders** shaped like the flashcard and journal entries, and smooth page and dialog transitions that respect reduced motion.
- **Welcome tour** (5 steps), offered with a small banner on first visit and replayable from Account.
- **Faster first paint:** Vocabulary, Journal and Account render their first data on the server. zod no longer ships to the browser. The troubleshooting panel and Coach chat load on first open.
- **SEO kept and extended:** descriptions, Open Graph and Twitter tags, canonical URLs, `robots.txt`, a sitemap for the public pages, and `noindex` on every logged-in page.

**Accessibility (WCAG 2.1 AA):** axe-core finds 0 violations on every page in light and dark mode. Fixed: list semantics in the install and troubleshooting step lists.

**Lighthouse (mobile, local production build):**

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Login | 100 | 100 | 100 | 100 |
| Vocabulary | 92 | 100 | 100 | 63* |
| Practice | 91 | 100 | 100 | 63* |
| Journal | 92 | 100 | 100 | 63* |
| Account | 90 | 100 | 100 | 63* |

\*Logged-in pages are intentionally `noindex`, which Lighthouse's SEO score penalizes. The public pages score 100.

**Tests**
- `npm test`: 39 Vitest unit tests covering:
  - the AI cascade (primary to fallback model, backoff on 5xx, re-ask on bad JSON, no retry on 4xx, cache, built-in, refusals, mock mode, no keys)
  - the transcription cascade (Whisper confidence mapping, retry then fallback to Deepgram, no-speech, no retry on 400)
  - retry, backoff, timeouts and the circuit breaker
  - strict schemas, model order and log redaction
  - spaced repetition, streaks and time zones, calendar files, reminder rules and the offline coach
- **Bug found by the tests:** `withTimeout` aborted before rejecting, so work that settles on abort could win the race and count as success. Fixed.
- `npm run test:e2e`: a Playwright smoke test on desktop and Pixel 7 (sign up → onboarding → flashcards → practice, record and transcript → delete-on-next → journal → coach → account progress → log out and in), a health and redirect test, and the axe accessibility test in light and dark.
- CI runs the unit tests in the existing job, plus a new `e2e` job with Postgres.
