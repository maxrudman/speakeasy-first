# SpeakEasy

A web app for building vocabulary and practicing spoken answers.

- **Vocabulary**: flashcards tailored to your level, field, and audience, with spaced repetition. Terms you keep getting right are retired and replaced with new ones.
- **Practice**: describe your audience and pick a difficulty (Easy, Medium, Hard), get questions written for that exact setting, record your answer, play it back, copy the transcript, and get a graded analysis of your answer and delivery.
- **Pitch Room**: an elevator pitch game. Pick a one-on-one interview, a panel, an actual elevator or a conference stage, beat the clock, and watch a cartoon audience react live to your pitch. You get a score out of 100, a grade and quick tips, plus a best score and daily streak.
- **Journal**: save your best answers. Includes a bank of about 100 common questions.
- **Account**: username and password login. Every user's data is private to them.

Built with Next.js 16, TypeScript, Tailwind CSS, Drizzle ORM, and Postgres. Deploys to Vercel.

---

## Setup (each teammate, about 10 minutes)

You need [Node.js 20+](https://nodejs.org) and [Git](https://git-scm.com).

```bash
git clone https://github.com/maxrudman/speakeasy-first.git
cd speakeasy-first
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your own free database at [neon.tech](https://neon.tech). Create a project, then copy the pooled connection string. Each teammate should use their **own** database (or their own Neon branch) so you don't overwrite each other's test data. |
| `SESSION_SECRET` | Run `openssl rand -base64 32` and paste the result. Any random string of 32+ characters works. |
| `GROQ_API_KEY` | Strongly recommended, and free (no credit card). From [console.groq.com/keys](https://console.groq.com/keys). Powers tailored vocabulary, setting-specific practice questions, and full speech feedback. Without an AI key, the app uses built-in lists and a basic rules-based grader. |
| `ANTHROPIC_API_KEY` | Optional, paid. Uses Claude instead of Groq when set. From [console.anthropic.com](https://console.anthropic.com). |

Then:

```bash
npm run db:migrate   # create the tables
npm run db:seed      # optional: demo account, username "demo", password "demo1234"
npm run dev          # http://localhost:3000
```

## Deploying to Vercel (one person, once)

1. Push the repo to GitHub (see *First push* below).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo. Leave the framework settings as they are.
3. Add a database: in the Vercel project go to **Storage → Create → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL` for you.
4. In **Settings → Environment Variables**, add `SESSION_SECRET` (a new random value, not the one from your laptop) and `GROQ_API_KEY` (free, see above).
5. Deploy. Database tables are created and updated automatically during each Vercel build (see `scripts/migrate.ts`).

After that, every push to `main` deploys to production, and every pull request gets its own preview URL that teammates can click and test.

To give teammates access to the Vercel project, add them under **Team Settings → Members**.

## First push to GitHub

```bash
# Create an empty repo on github.com first (no README, no .gitignore), then:
git remote add origin https://github.com/maxrudman/speakeasy-first.git
git push -u origin main
```

Then add your teammates under **Settings → Collaborators** on GitHub. See [CONTRIBUTING.md](CONTRIBUTING.md) for how the team works together.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally with hot reload |
| `npm run build` | Production build (what Vercel runs) |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check TypeScript types |
| `npm run db:generate` | Create a migration after you edit `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to your database |
| `npm run db:seed` | Create the demo account |
| `npm run db:studio` | Browse your database in the browser |

## Project map

```
src/
  app/
    (auth)/login, signup        Login and sign-up pages (public)
    (app)/vocabulary            Page 1: Vocabulary
    (app)/practice              Page 2: Practice
    (app)/pitch                 Page 3: Pitch Room (elevator pitch game)
    (app)/journal               Page 4: Journal
    (app)/account               Page 5: Account
    api/                        Server routes the pages call
  components/
    vocabulary/ practice/ pitch/ journal/ account/   UI for each page
    pitch/scenes.ts             Pitch Room settings, prompts and audience seats
    pitch/audience.tsx          Cartoon audience and backdrops (one SVG per scene)
    ui.tsx                      Shared buttons, inputs, dialogs
    app-shell.tsx               Navigation (add new pages here)
    logo.tsx, deck-shapes.tsx   SpeakEasy logo and the class deck's decorative shapes
  data/
    fallback-terms.ts           Built-in vocabulary (used without an API key)
    fallback-questions.ts       Built-in practice questions
    question-bank.ts            Journal's common questions list
  db/schema.ts                  Database tables
  lib/
    ai.ts                       All AI calls (Claude or Groq), with fallbacks
    vocab-rules.ts              Spaced repetition rules (tweak the numbers here)
    pitch.ts                    Pitch Room scoring: parts, filler words, pace, live mood
    auth.ts, session.ts         Login sessions
  proxy.ts                      Redirects logged-out visitors to /login
drizzle/                        Database migrations (commit these)
```

## How some things work

**Spaced repetition.** Each term sits in a box from 0 to 5. A check moves it up one box, and an X sends it back to 0. Lower boxes show up far more often. At box 5 the term is "mastered": it's retired, replaced with a new term, and comes back for review about 1 in 15 cards. All the numbers live in `src/lib/vocab-rules.ts`.

**Recording and transcripts.** Audio is recorded in the browser and never leaves the device. Live transcription uses the browser's built-in speech recognition, which works best in Chrome and Edge. In other browsers, users can type or paste into the transcript box.

**Speech analysis.** While you record, the browser measures pace, pauses, pitch variation and volume (`src/components/practice/voice-meter.ts`). Only those numbers and the transcript are sent for grading; the audio never leaves the device. Claude grades six categories (clarity and relevance, substance, structure, word choice, professionalism, vocal delivery) against the expectations of the setting, and the difficulty sets how strict it is. The rubric and the built-in backup grader live in `src/lib/speech-analysis.ts`.

**AI providers and fallbacks.** All AI calls are in `src/lib/ai.ts`. It uses Claude if `ANTHROPIC_API_KEY` is set, otherwise Groq's free plan if `GROQ_API_KEY` is set. Every call falls back to the built-in lists if there's no API key or the request fails, so the app never breaks because of the API.
