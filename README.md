# SpeakEasy

A web app for building vocabulary and practicing spoken answers.

- **Vocabulary**: flashcards tailored to your level, field, and audience, with spaced repetition. Terms you keep getting right are retired and replaced with new ones. You can also add terms from a vocabulary list you already have (a link or pasted words).
- **Practice**: describe your audience, get tailored interview questions, record your answer, play it back, and copy the transcript.
- **Journal**: save your best answers. Includes a bank of about 100 common questions.
- **Account**: username and password login. Every user's data is private to them.

Built with Next.js 16, TypeScript, Tailwind CSS, Drizzle ORM, and Postgres. Deploys to Vercel.

---

## Setup (each teammate, about 10 minutes)

You need [Node.js 20+](https://nodejs.org) and [Git](https://git-scm.com).

```bash
git clone https://github.com/<your-org>/speak-ready.git
cd speak-ready
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your own free database at [neon.tech](https://neon.tech). Create a project, then copy the pooled connection string. Each teammate should use their **own** database (or their own Neon branch) so you don't overwrite each other's test data. |
| `SESSION_SECRET` | Run `openssl rand -base64 32` and paste the result. Any random string of 32+ characters works. |
| `ANTHROPIC_API_KEY` | Optional. From [console.anthropic.com](https://console.anthropic.com). Without it, the app uses its built-in word and question lists. |
| `SPEAKEASY_MOCK_AI` | Optional. Set to `1` to try tailored vocabulary locally without an API key (sample terms, same mix rules). |

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
4. In **Settings → Environment Variables**, add `SESSION_SECRET` (a new random value, not the one from your laptop) and, if you have one, `ANTHROPIC_API_KEY`.
5. Deploy. Database migrations run automatically before each build (the `vercel-build` script).

After that, every push to `main` deploys to production, and every pull request gets its own preview URL that teammates can click and test.

To give teammates access to the Vercel project, add them under **Team Settings → Members**.

## First push to GitHub

```bash
# Create an empty repo on github.com first (no README, no .gitignore), then:
git remote add origin https://github.com/<your-org>/speak-ready.git
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
| `npm run vocab:sample` | Print sample vocabulary batches for a few profiles and check the mix (no database needed) |

## Project map

```
src/
  app/
    (auth)/login, signup        Login and sign-up pages (public)
    (app)/vocabulary            Page 1: Vocabulary
    (app)/practice              Page 2: Practice
    (app)/journal               Page 3: Journal
    (app)/account               Page 4: Account
    api/                        Server routes the pages call
  components/
    vocabulary/ practice/ journal/ account/   UI for each page
    ui.tsx                      Shared buttons, inputs, dialogs
    app-shell.tsx               Navigation (add new pages here)
  data/
    fallback-terms.ts           Built-in vocabulary (used without an API key)
    fallback-questions.ts       Built-in practice questions
    question-bank.ts            Journal's common questions list
  db/schema.ts                  Database tables
  lib/
    ai.ts                       All Claude API calls, with fallbacks
    vocab-tailoring.ts          How terms are tailored: prompts, the 60/20/20 mix, de-duplication
    vocab-mock.ts               SPEAKEASY_MOCK_AI sample terms (data in data/mock-terms.ts)
    list-source.ts              Safely fetches a vocabulary list from a link
    vocab-rules.ts              Spaced repetition rules (tweak the numbers here)
    auth.ts, session.ts         Login sessions
  proxy.ts                      Redirects logged-out visitors to /login
drizzle/                        Database migrations (commit these)
```

## How some things work

**Spaced repetition.** Each term sits in a box from 0 to 5. A check moves it up one box, and an X sends it back to 0. Lower boxes show up far more often. At box 5 the term is "mastered": it's retired, replaced with a new term, and comes back for review about 1 in 15 cards. All the numbers live in `src/lib/vocab-rules.ts`.

**Recording and transcripts.** Audio is recorded in the browser and never leaves the device. Live transcription uses the browser's built-in speech recognition, which works best in Chrome and Edge. In other browsers, users can type or paste into the transcript box.

**Tailored vocabulary.** Each batch of new terms is about 60% field terms (spread across every field you list, with at least one "bridge" term connecting them), 20% terms that land well with your audience, and 20% broad professional vocabulary, pitched at your level. A batch of 10 is 6/2/2 and the 5 added on a settings change are 3/1/1. A term you've had before, including removed ones, never comes back.

**Importing your own list.** In the Preferences menu (and as an optional last step of setup), you can paste a link to a vocabulary list or the words themselves. Only terms that appear in the list are added, up to 30 at a time, each with a plain definition and an example for your audience. Links must be public http(s) pages; private and internal addresses are refused, and the link isn't saved.

**AI fallbacks.** Every Claude call in `src/lib/ai.ts` falls back to the built-in lists if there's no API key or the request fails, so the app never breaks because of the API.
