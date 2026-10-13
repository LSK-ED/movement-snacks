# words

A Claude design project scaffolded by **appa**. The UI is built on the
shadcn/ui design system so anything Claude generates inherits the same tokens,
typography, and components automatically.

## Design system

The source of truth for visual design is **DESIGN.md** and the tokens in
`src/index.css`. Read DESIGN.md before generating or modifying any UI.

- Component library: shadcn/ui (new-york style, neutral base)
- Tokens are CSS variables in `src/index.css` (`:root` = light, `.dark` = dark),
  mapped to Tailwind via `@theme inline`
- Add components with `npx shadcn@latest add <name>` — don't hand-roll a
  primitive shadcn already provides
- Compose from `@/components/ui/*`; merge classes with `cn()` from `@/lib/utils`

## Icons & branding

- **UI icons:** use `lucide-react` (already installed, shadcn's default) — e.g.
  `import { Send } from 'lucide-react'`. Keep to one icon family for consistency.
- **More icons when Lucide falls short:** the shadcn.io registry exposes 200+
  libraries (Heroicons, Tabler, Material Symbols, …). Connect it once with your
  Pro MCP URL — `claude mcp add shadcnio` — then each icon's page gives a CLI
  command that drops a typed component into `src/components`. Reach for this only
  when Lucide genuinely lacks the glyph.
- **The logo is NOT an icon.** Never use a stock Lucide/Heroicon inside a colored
  or gradient rounded square as a brand mark — that reads as templated. Draw a
  small custom SVG mark (a monogram, aperture, or subject-specific glyph) in
  `src/components/brand/`, put the accent colour on the mark itself, and keep the
  wordmark quiet (solid text). Spend the colour in one place: the mark.

## Conventions

- React 19 + Vite + TypeScript, Tailwind v4 (CSS-first — there is no
  `tailwind.config`; theme lives in `src/index.css`)
- Import alias: `@/` → `src/`
- Dark mode via the `.dark` class on `<html>`; the theme is applied pre-paint in
  `index.html` and persisted to `localStorage` under `theme`
- **Responsive by default** — mobile-first, working from 320px to large desktop.
  Use fluid layouts and Tailwind breakpoints; never hard-code fixed widths
  (design artboards are fixed-size — the code must not be)

## Tooling

- **stylelint** (`.stylelintrc.json`, Tailwind-v4-aware) — `npm run lint:css`
- **prettier** (`.prettierrc.json`: no semicolons, single quotes) — `npm run format`
- **husky + lint-staged** — a pre-commit hook auto-fixes staged CSS (stylelint)
  and formats staged files (prettier). Runs on `git commit`.

## What to build

See **PROMPT.md** for the current brief.

## Run

```bash
npm install
npm run dev
```
