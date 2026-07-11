# Design-systeem (fase 27)

Gekozen richting: **"Warm Atelier op A-skelet"** — strak data-eerst skelet
met warme kringloop-kleuren (keuze uit 3 voorgelegde richtingen).

## Tokens

Alle tokens staan in `apps/web/app/globals.css` (`@theme`, licht + donker
via `prefers-color-scheme`). Kern:

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `--color-background` | `#FAF9F7` | `#171412` | pagina-achtergrond (warm steen) |
| `--color-foreground` | `#292524` | `#EDEAE6` | tekst |
| `--color-card` | `#FFFFFF` | `#201C19` | kaarten/tabellen |
| `--color-accent` | `#C2410C` | `#FB923C` | terracotta — CTA's, links, actieve nav |
| `--color-accent-soft` | `#FDF0E7` | `#33200E` | badges, actieve chips |
| `--color-muted` / `-foreground` | `#F2EFEB` / `#78716C` | `#282320` / `#A8A29E` | subtiele vlakken/tekst |
| `--color-border` | `#E7E2DC` | `#35302B` | alle borders |
| `--color-warning(-soft)` | `#B45309` | `#FBBF24` | analyzing/pending states |

**Fonts** (via `next/font` in `apps/web/app/layout.tsx`):
- Koppen: **Outfit** (`font-heading`, h1–h4 automatisch)
- Body: **Work Sans** (`font-sans`)
- Data: **Fira Code** (`font-mono`) — sticker-ID's, prijzen

## Gedeelde utilities (globals.css `@utility`)

- `card` — kaart (bg-card, border, rounded-xl, shadow-xs)
- `btn` + `btn-accent` / `btn-primary` / `btn-outline` / `btn-ghost` / `btn-danger`
- `input` — alle inputs/selects/textareas
- `badge` — pill-badges (combineer met bg/text-kleuren)
- `section-title` — uppercase sectiekopjes

Conventies: primaire CTA per scherm = `btn-accent`; links in lijsten =
`text-accent hover:underline`; statusbadge-kleuren via
`statusBadgeClass()` in `inventory/virtual-table.tsx`; icons = lucide-react
(geen emoji als icon).

## Design-skills (.claude/skills)

De `ui-ux-pro-max` skill (+ design/brand/ui-styling e.a., MIT,
[bron](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)) is in de
repo geïnstalleerd; TTF-fonts zijn bewust weggelaten. Doorzoekbare database
voor stijl/kleur/typografie-beslissingen:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain color|typography|style|ux
```

Bij nieuwe schermen: gebruik bovenstaande tokens/utilities, check de
pre-delivery checklist in `.claude/skills/ui-ux-pro-max/SKILL.md`
(contrast 4.5:1, focus-states, touch-targets 44px, reduced-motion).
