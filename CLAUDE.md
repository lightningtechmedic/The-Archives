# CLAUDE.md — The Archive / The Vault

Persistent context for all Claude Code sessions in this project.

---

## Project Identity

**Name:** The Archive (live name in the UI) / The Vault (internal working name)
**Purpose:** A cinematic project showcase and idea center for a small trusted team. Not a public portfolio in the traditional sense — it's a curated record of products built with intention, precision, and a refusal to settle for ordinary.
**Owner:** Christian Kelley
**Tagline:** "Things I built." — Selected projects 2024/2025

---

## Current Stack

> IMPORTANT: This project is currently **pure static HTML/CSS/JS** — no framework, no build tool, no database, no backend. All four pages are self-contained `.html` files deployed as static assets (Vercel implied by project URLs).

| Layer | Current Reality |
|---|---|
| Markup | Vanilla HTML5 |
| Styling | Vanilla CSS (all inline in `<style>` tags per file) |
| Scripting | Vanilla JS (all inline in `<script>` tags per file) |
| Fonts | Google Fonts (Cormorant Garamond + Space Mono) |
| Hosting | Vercel (inferred from project live URLs) |
| Framework | None |
| Database | None |
| AI integration | None |

### Aspirational / Planned Stack (not yet implemented)
If the project evolves, the intended stack is:
- **Framework:** Next.js 14 (App Router)
- **Database / Auth:** Supabase
- **AI:** OpenAI API
- **Styling:** Tailwind CSS

Do not assume any of these are present until you see them in the codebase.

---

## File Structure

```
The-Archives/
├── index.html        # Landing page — 2x2 project grid
├── nesis.html        # Project detail — Nesis (Brand & Identity)
├── graphite.html     # Project detail — Graphite OS (Operating System)
├── apex.html         # Project detail — APEX (Platform / Intelligence)
├── mosignal.html     # Project detail — MO Signal (Communications)
└── CLAUDE.md         # This file
```

All CSS and JS lives inline within each HTML file. There are no external stylesheets, no `src/` directory, no `package.json`.

---

## Design System

The design language is cinematic, editorial, and dark — film noir meets brutalist editorial. Every detail is intentional.

### Color Palette

#### Index page (light mode)
| Token | Value | Role |
|---|---|---|
| `--ink` | `#0a0a0a` | Primary text, UI elements |
| `--paper` | `#f0ece4` | Page background (warm off-white) |
| `--ash` | `#c8c0b4` | Secondary text, nav, labels |
| `--ember` | `#d4541a` | Brand accent — hover states, eyebrows, italic highlights |
| `--ghost` | `rgba(10,10,10,0.04)` | Subtle fills |

#### Project detail pages (dark mode)
Each detail page has its own dark background and accent color:

| Project | Background | Accent |
|---|---|---|
| Nesis | `#0d0b08` (warm black) | `#d4541a` (ember / burnt orange) |
| Graphite OS | `#060912` (cold navy black) | `#4a8fff` (electric blue) |
| APEX | `#0e0402` (deep maroon black) | `#ff6030` (hot orange-red) |
| MO Signal | `#050905` (near-black green) | `#50c864` (signal green) |

Shared dark-mode tokens across detail pages:
- `--text`: `rgba(255,255,255,.88)` — primary text
- `--muted`: `rgba(255,255,255,.38)` — secondary / body text
- `--mid`: `rgba(255,255,255,.6)` — mid-weight text

### Typography

| Token | Font | Usage |
|---|---|---|
| `--serif` | `Cormorant Garamond`, Georgia, serif | Headings, body, hero titles |
| `--mono` | `Space Mono`, monospace | Labels, tags, eyebrows, nav, CTAs, footers |

**Type rules:**
- Hero titles: `font-weight: 300`, very tight leading (`.9`–`.92`), large negative letter-spacing (`-.02em` to `-.03em`)
- Italic `<em>` in headings always renders in the page accent color
- Eyebrows / labels: ALL CAPS, wide letter-spacing (`.18em`–`.28em`), mono font
- Body text: `font-weight: 300` throughout — no bold body copy

### Custom Cursor

Every page suppresses the native cursor (`cursor: none`) and renders a two-part custom cursor:

- **Dot** (`.cursor`): 10×10px filled circle, `z-index: 9999`, snaps directly to mouse position
- **Ring** (`.cursor-ring`): 36×36px unfilled circle with thin border, `z-index: 9998`, follows with lag (`rx += (mx - rx) * .12` — smooth RAF loop)
- **Hover state** (`.hovering` on `<body>`): dot shrinks to 6px and takes the accent color; ring expands to 56px and fades to 20% opacity
- Hover class is toggled on `mouseenter`/`mouseleave` of all `a` and `.card` / `.pillar` elements

### Noise Texture Overlay

Applied globally via `body::before` pseudo-element on every page:
```css
background-image: url("data:image/svg+xml,<SVG feTurbulence fractalNoise baseFrequency=0.9 numOctaves=4>");
opacity: .6;
position: fixed; inset: 0;
pointer-events: none;
z-index: 1000;
```
This sits above all content at z-index 1000 — it never blocks interaction because `pointer-events: none`.

### Animation System

Two keyframe animations used consistently:
- `fadeUp`: `opacity 0 → 1`, `translateY(24px → 0)` — for cards, sections, headers
- `fadeIn`: `opacity 0 → 1` — for dividers, footers, marquee

All elements animate in on page load with staggered `animation-delay` values. No JS required.

### Card Hover Mechanics (index.html)
- `.card-bg`: scales to `1.06` on hover (`transform: scale`)
- `.card-bottom`: slides up `8px → 0` on hover
- `.card-desc`: fades in with slight upward translate on hover
- `.card-cta`: slides in from left on hover
- `.card-accent`: bottom border line scales in from left (`scaleX(0 → 1)`)
- `.card-scan`: scanline sweep effect passes through card on hover
- `.card-grid`: subtle grid overlay intensifies on hover

---

## Projects

### 01 — Nesis
- **Tag:** Brand & Identity
- **Category:** Mortgage tech platform
- **Accent:** Ember (`#d4541a`)
- **Live URL:** `https://nesis-forge.vercel.app/`
- **What it is:** A platform for mortgage operators to manage, protect, and grow their LO (Loan Officer) network. Not a CRM. Core pillars: Live LO Pages, Compliance Monitoring, Retention Intelligence, Recruiting Pipeline.
- **Manifesto:** "Built for the operators who are tired of finding out about problems after they happen."

### 02 — Graphite OS
- **Tag:** Operating System
- **Category:** AI development / cinematic build interface
- **Accent:** Electric blue (`#4a8fff`)
- **Live URL:** Not yet live (CTA says "Cooking")
- **What it is:** An AI-powered development environment designed for people who *direct* work, not do it. Features a cinematic command center — agent bays, artifact drops, a central core that morphs through build phases: Intake > Clarification > Scoping > Fabrication > Assembly > Deployment.
- **Design principle:** "Every other AI dev tool is built for the person doing the work. Graphite OS is built for the person directing it."

### 03 — APEX
- **Tag:** Platform
- **Category:** Private intelligence / labor market signal
- **Accent:** Hot orange-red (`#ff6030`)
- **Live URL:** `https://apex-indol.vercel.app/`
- **What it is:** A private intelligence system that detects AI-driven layoffs before the market does. Reads earnings calls, scores language patterns, identifies companies quietly building the case to cut headcount. Core pillars: Earnings Call Analysis, Early Warning Flags, Signal Intelligence, Execution Layer.
- **Manifesto:** "It doesn't predict the future. It reads the present more carefully than anyone else is bothering to."

### 04 — MO Signal
- **Tag:** Communications
- **Category:** Sales intelligence / mortgage market
- **Accent:** Signal green (`#50c864`)
- **Live URL:** `https://mo-signal.vercel.app/dashboard`
- **What it is:** A sales intelligence platform monitoring 138 mortgage companies, scoring each by purchase intent using real signals — mobile performance pain, LO headcount movement, tech stack age, market conditions. Generates personalized outreach referencing warm connections and live market data.
- **Core principle:** "Instead of cold prospecting blind, you open your laptop and already know who's hurting, why, and exactly what to say to them."

---

## Conventions & Rules

### CSS
- All CSS is written inline per file inside `<style>` tags — no external stylesheet
- Use CSS custom properties (`--var`) for all colors and font stacks
- `box-sizing: border-box` and reset applied globally (`*, *::before, *::after`)
- Mobile breakpoints use `@media (max-width: 768px)` for the index grid, `@media (max-width: 640px)` for pillar grids
- `5vw` is the standard horizontal padding / gutter
- `2px` gaps are used deliberately throughout (grid gap, dividers) — this is a design choice, not an accident

### JS
- All JS is inline per file inside `<script>` tags
- No libraries, no modules, no imports
- The cursor animation uses `requestAnimationFrame` for the ring lag — do not replace with CSS `transition` alone, the lagged physics feel is intentional
- Keep JS minimal; this is a presentation site, not an app

### HTML structure (detail pages)
Every project detail page follows this structure:
```
body
  .cursor + .cursor-ring
  .wrap (max-width: 1200px, centered)
    header (.back-link + .header-tag)
    .hero (.hero-eyebrow + .hero-title + .hero-rule + .hero-desc)
    .divider
    .section (.section-label + .pillars[2x2 grid])
    .divider
    .quote-section (blockquote.quote + .quote-attr)
    .cta-section (.cta-text + .cta-btn)
    .footer-strip
```

### Tone
- Copy is terse, confident, declarative — never corporate
- Italics (`<em>`) are used for emphasis inside headings with accent color
- No exclamation points in primary copy
- Section labels are ALL CAPS monospace

---

## Vision

The Archive / The Vault is a cinematic idea center — a living document of products built for people who think before they ship. It is not a standard portfolio. Each project card is a window into a world: the card's visual language, color, and ambient texture tell the story before a word is read.

The audience is small and trusted. This is not optimized for virality or SEO — it's optimized for the impression it leaves on the right person, at the right moment.

Every design decision reinforces one principle: **restraint creates weight.**

---

## Vercel Deployment — Critical Rules

### How routing works in this monorepo
- `vercel.json` in the repo root uses a LEGACY `builds` array
- Vercel explicitly **BANS** `basePath` in `next.config.js` when `builds` is present
- Routing is handled by `vercel.json` routes, NOT by Next.js `basePath`
- The route `{ "src": "/vault/(.*)", "dest": "vault/$1" }` handles all `/vault/*` routing at the edge

### next.config.js must ONLY have:
```js
assetPrefix: '/vault'
```

### next.config.js must NEVER have:
```js
basePath: '/vault'  // ← BANNED — breaks build when builds array exists in vercel.json
```

### How it works
- Vercel routes `/vault/dashboard` → `vault/dashboard` via `vercel.json` routes rule
- `assetPrefix: '/vault'` ensures browser fetches `_next/static` bundles from the right path
- No `basePath` needed — `vercel.json` handles all path remapping at the edge

### If build fails, check in this order:
1. Check vercel.com — is the deployment red or green?
2. Read the EXACT error message — don't guess
3. Check every import in modified files resolves to a real exported component
4. Check `next.config.js` has NO `basePath`
5. Never add `basePath` to `next.config.js` in this project

---

## Supabase RLS Rules

### NEVER write self-referential policies
A policy on table X must NEVER query table X inside its own USING clause.
This causes infinite recursion and Postgres will throw:
`"infinite recursion detected in policy for relation X"`

Bad example — enclave_members policy querying enclave_members:
```sql
FOR SELECT USING (
  enclave_id IN (
    SELECT enclave_id FROM enclave_members  -- NEVER do this
    WHERE user_id = auth.uid()
  )
)
```

Fix — route through a different table to break the cycle:
```sql
FOR SELECT USING (
  user_id = auth.uid()
  OR enclave_id IN (
    SELECT id FROM enclaves WHERE created_by = auth.uid()
  )
)
```

### Always check column names before writing policies
- `enclaves` table uses `created_by` — NOT `owner_id`
- Before referencing any column in a policy, verify it exists:
  ```sql
  SELECT column_name FROM information_schema.columns WHERE table_name = 'X';
  ```

### RLS policy checklist before every migration
1. Does any policy query its own table? If yes — rewrite to use a parent table
2. Are all column names verified against `information_schema`?
3. Are `DROP POLICY IF EXISTS` statements included before every `CREATE POLICY`?
4. Is `ENABLE ROW LEVEL SECURITY` present for every new table?

---

## Migration Rules — Mandatory

### Never assume a migration ran
Before writing code that depends on a table or column, always check it exists.
Use: `SELECT column_name FROM information_schema.columns WHERE table_name = 'X'`

### Every migration file must:
1. Use `IF NOT EXISTS` for every `CREATE TABLE`
2. Use `IF NOT EXISTS` for every `ALTER TABLE ADD COLUMN`
3. Use `DROP POLICY IF EXISTS` before every `CREATE POLICY`
4. Never use `owner_id` — enclaves uses `created_by`
5. Never write self-referential RLS policies

### After every push that includes a migration:
Tell the user explicitly:
"⚠️ Run vault/migrations/[filename].sql in Supabase SQL editor before testing this feature"
Include the exact file path every time without exception.

### After user confirms migration ran:
Run: `npm run verify-db`
Report which tables pass and which fail before closing the task.

### Single source of truth for stickies
`vault/migrations/003_stickies_complete.sql` is the canonical stickies migration.
It supersedes `003_stickies.sql` and `003b_stickies_smart.sql`.
Never write partial stickies migrations — update `003_stickies_complete.sql` instead.

---

## Lattice Message Scoping Rules

**Critical privacy invariant: every message row must be scoped.**

### Schema
`messages` table has `user_id` and `enclave_id` (nullable UUID, added migration 005).

### Scoping rules
- Personal context: `user_id = currentUser.id`, `enclave_id = null`
- Enclave context: `user_id = currentUser.id`, `enclave_id = theEnclaveId`
- **NEVER insert with `user_id: null`** — AI messages must use the triggering user's ID

### All message inserts in `dashboard/page.js` must include both fields:
```js
{ user_id: userRef.current?.id, ..., enclave_id: activeEnclaveIdRef.current }
```

### Message fetching
- Personal: `.is('enclave_id', null).eq('user_id', u.id)`
- Enclave: `.eq('enclave_id', activeEnclaveId)`
- On enclave switch: `setMessages([])` then reload with correct scope

### Realtime subscription
The `messages-rt` channel receives all inserts, but the callback filters by `activeEnclaveIdRef.current` and `userRef.current?.id` — only messages matching the active context are appended to state.
