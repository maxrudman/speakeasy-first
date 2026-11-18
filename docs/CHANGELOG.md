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
