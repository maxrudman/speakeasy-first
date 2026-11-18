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
