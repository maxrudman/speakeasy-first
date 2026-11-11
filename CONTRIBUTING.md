# Working together

Five people editing the same app works smoothly with a few habits.

## The flow

1. **Pick or create an issue** on GitHub so others know what you're working on. Assign it to yourself.
2. **Make a branch** from the latest `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b journal-tags      # short name describing the change
   ```
3. **Make your change.** Commit often, with messages that say what changed ("Add tags to journal entries").
4. **Push and open a pull request:**
   ```bash
   git push -u origin journal-tags
   ```
   GitHub shows a link to open the PR. Fill in the template.
5. **Check the preview.** Vercel comments on the PR with a preview URL. Click through your change there.
6. **Get one review.** A teammate looks it over and approves.
7. **Merge.** Use "Squash and merge". The change goes live on the production URL in a minute or two.

Never push straight to `main`. Pull requests are how everyone sees changes before they go live.

## Avoiding conflicts

- **Pull `main` often**, especially before starting something new: `git checkout main && git pull`, then `git checkout your-branch && git merge main`.
- **Keep PRs small.** One feature or fix per PR. Small PRs get reviewed faster and rarely conflict.
- **Split work by page.** The code is organized so each page has its own folder in `src/components/`. Two people working on different pages almost never collide.
- **Talk before touching shared files**: `src/db/schema.ts`, `src/components/ui.tsx`, `src/app/globals.css`, `src/lib/ai.ts`.

## Changing the database

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate`. This creates a new file in `/drizzle`.
3. Run `npm run db:migrate` to apply it to your own database.
4. **Commit the new `/drizzle` file with your change.** CI fails if you forget.

Vercel applies migrations automatically when your PR merges. If two people change the schema at the same time, whoever merges second should merge `main` into their branch, delete their generated migration, and run `npm run db:generate` again.

## Recommended GitHub settings (repo owner)

In **Settings → Branches → Add branch protection rule** for `main`:

- Require a pull request before merging, with 1 approval
- Require status checks to pass, and select **CI / check**

## Using Claude Code or Claude on this repo

`AGENTS.md` and `CLAUDE.md` give AI assistants the project conventions. Review AI-written changes like any other PR.

## Code style

- TypeScript everywhere. Run `npm run lint` and `npm run typecheck` before pushing.
- Use the shared components in `src/components/ui.tsx` (`Button`, `TextField`, `Dialog`, and so on) rather than styling new ones from scratch.
- Use the color tokens (`bg-pine`, `text-muted`, `border-line`, and so on) defined in `src/app/globals.css`, not raw hex colors.
- Every API route checks the logged-in user with `withUser(...)` and filters every query by `user.id`.
