# Design system

## Tokens (`src/app/globals.css`)

| Token | Use | Light | Dark |
|---|---|---|---|
| `paper` | page background | #f3f5f7 | #12161c |
| `surface` | cards, panels, dialogs | #ffffff | #1a2029 |
| `ink` | main text | #18212f | #e7ebf0 |
| `muted` | secondary text (AA on paper and surface) | #5b6676 | #9aa4b2 |
| `line` | borders, gridlines | #dce1e7 | #2b333e |
| `pine` / `pine-strong` / `pine-soft` | primary actions, "right", selected | #2e6b57 … | #5fb394 … |
| `coral` / `coral-soft` | "wrong", destructive, errors | #b4504a … | #e07b70 … |
| `chart` | chart marks (validated: lightness, chroma, ≥3:1) | #16805a | #2fa877 |

Use the Tailwind names (`bg-surface`, `text-muted`, `border-line`, …), never raw hex. Dark mode follows the device, or the choice on Account → Appearance. `dark:` utilities follow the same rule.

## Components (`src/components/ui.tsx` and friends)

`Button` (primary, secondary, ghost, danger; sm and md), `TextField`, `TextArea`, `SelectField`, `Dialog`/`ConfirmDialog` (native `<dialog>`), `ErrorNote` (always with *Try again* when retrying makes sense), `Notice`, `Spinner`, `PageHeader`. Toasts: `useToast().toast("Saved")` from `src/components/toast.tsx`. Full-section errors: `ErrorState`.

## States every screen needs

- **Loading:** a skeleton shaped like the content (`loading.tsx`, the flashcard and journal skeletons). Use a spinner only for small inline waits.
- **Empty:** say what will appear and give the one action that fills it.
- **Error:** plain words plus *Try again*; never raw error text.
- **Offline:** the banner appears automatically; API calls fail with "You're offline".

## Accessibility (WCAG 2.1 AA)

- `npm run test:e2e` runs axe-core on every page in light and dark mode and must stay at 0 violations.
- Touch targets are at least 44×44px on touch screens. Visible focus rings use `:focus-visible`.
- Each page has one `h1` and headings in order. Icon-only buttons have `aria-label`. Live regions are used for recording status, transcription, toasts and coach replies.
- Charts have a text summary, keyboard navigation (← →) and a table view.
- Motion is short (≤ 220ms) and turned off under `prefers-reduced-motion`.
