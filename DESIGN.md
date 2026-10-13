# Design System — words

This project uses the **shadcn/ui design system** as its source of truth. There
is no separate Figma file to manage — Claude Design already knows shadcn/ui, and
the tokens live in code (`src/index.css`). To brand the project, change the
token values there; everything Claude generates inherits them.

## Tokens (source of truth: `src/index.css`)

Semantic tokens defined as CSS variables and mapped to Tailwind via
`@theme inline`. Light values in `:root`, dark overrides in `.dark`.

| Token                                    | Role                  |
| ---------------------------------------- | --------------------- |
| `--background` / `--foreground`          | page surface + text   |
| `--card` / `--card-foreground`           | raised surfaces       |
| `--popover` / `--popover-foreground`     | overlays              |
| `--primary` / `--primary-foreground`     | primary actions       |
| `--secondary` / `--secondary-foreground` | secondary actions     |
| `--muted` / `--muted-foreground`         | subdued fills + text  |
| `--accent` / `--accent-foreground`       | hover — not the brand |
| `--destructive`                          | dangerous actions     |
| `--border` / `--input` / `--ring`        | strokes + focus rings |
| `--highlight` / `--highlight-foreground` | **the brand colour**  |
| `--highlight-subtle`                     | the brand as a wash   |
| `--radius`                               | corner-radius scale   |

**`--accent` is not the brand.** shadcn spends it on hover states — ghost
buttons, menu rows, command items — so a brand colour there turns every hover
into the brand. The brand lives in `--highlight`, spent deliberately: a mark, a
link hover, one accent per screen.

Component names follow shadcn/ui conventions (`Button`, `Card`, …).

## Typography & spacing

Inherit shadcn/ui defaults unless overridden here.
