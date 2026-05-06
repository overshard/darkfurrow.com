# Dark Furrow

## What is this project?

Dark Furrow is a seasonal almanac for the modern web. It surfaces forgotten
rhythms that humans used to live by: what's growing right now, what's ready
to harvest, what the sky is doing, what our ancestors called this week.

The project is an art piece as much as it is a tool. It is a single living
page that breathes with the seasons.

This is a Rust port of the original Flask version (now deleted). Performance:
~30-50x lower memory, ~10-20x higher RPS, sub-millisecond per-request latency
in release mode.

## Design philosophy

- Text-forward, minimal, dark aesthetic. Like reading by firelight.
- Clean, simple text-based UI. No flashy components or frameworks.
- No external API dependencies. All data is encoded by hand or calculated
  with simple math (moon phases, sunrise/sunset, daylight changes).
- No feeds, no accounts, no engagement patterns.
- The page should feel quiet, warm, and cozy.

## Commands

- **Dev server:** `make run` (Vite watch + cargo run concurrently on port 8000)
- **Production build:** `make build` (Vite assets + release binary)
- **Run release binary:** `make start`
- **Tests:** `cargo test` (parity tests for rng, moon math, sun math, markdown)
- **Docker build:** `sudo docker build .`

There are no linters configured.

## Architecture

**Backend:** Single-binary axum app (`src/main.rs`). Two routes: `/` renders
the page, `/api/content` returns the same content as JSON for the client-side
auto-refresh. Both accept `?season=` for previewing other seasons. Data is
loaded once at startup from `data/` and held in `AppState`.

**Frontend pipeline:** Vite (run from `frontend/`) builds `frontend/static_src/`
into `dist/`. Entry point is `frontend/static_src/index.js` which imports SCSS
and JS. Output filenames are content-hashed (`base-[hash].js`, `base-[hash].css`)
and a Vite manifest (`dist/.vite/manifest.json`) is read at runtime so templates
resolve hashed names via `{{ vite_asset(...) }}`. Files in
`frontend/static_src/public/` (favicon, og.svg, sw.js, woff2 fonts) are copied
to `dist/` unchanged and served at `/static/`.

**Templates:** `templates/index.html` is rendered by minijinja with a custom
formatter (`src/templates.rs::jinja2_html_formatter`) that matches Jinja2's
HTML escape (does NOT escape `/`), so Vite asset URLs come through as
`/static/base-[hash].js` rather than `&#x2f;static&#x2f;...`.

**Manifest reload:** `templates::build_env` re-reads `dist/.vite/manifest.json`
per `vite_asset()` call in debug builds (so Vite watcher rebuilds are picked
up immediately). Release builds load it once at startup. Gated on
`cfg(debug_assertions)`.

**Markdown:** Rendered through comrak (`src/markdown.rs`). `render_inline`
strips a single wrapping `<p>...</p>` for inline contexts (matches Mistune's
output for the original flask version); `render_block` keeps block tags.

**Astronomical math:** `src/astro.rs`. Moon phase + illumination via Meeus's
lunar series (table 47.A perturbations). Sunrise/sunset/daylight via NOAA's
Spencer fourier series. Locked to zone 7a (lat 35.78, lon -78.64). Local-tz
handling uses chrono-tz with America/New_York. Accurate to ~1 minute.

**Daily-stable seeded RNG:** `src/rng.rs` is a mulberry32 PRNG with
JS-Math.imul-compatible semantics. Keyed by day-of-year so picks shift day
to day but are stable across refreshes within a day. Locked against the
original python implementation in unit tests.

**Section assembly:** `src/almanac.rs` is the engine. Builds five sections
(sky, garden, kitchen, foraging, folklore), pulls bullets and prose from
the relevant `data/<topic>/<season>.md` files, picks items via the seeded
RNG, and renders to a single HTML string for the template + JSON API.

**Request logging:** custom middleware in `src/main.rs::log_requests` prints
`time METHOD STATUS latency path` per request, with ANSI-colored status codes
(green 2xx, cyan 3xx, yellow 4xx, red 5xx). Always-on, costs sub-microsecond
per request. The `.layer()` is applied after all routes so it covers the
`nest_service` static-file mount too.

**Content:** `data/` holds markdown for every topic-season combination plus
seasons, haiku, moods, and moon-tips. The `data/wisdom/` files exist on disk
but are not read by anything (they were tied to the removed time rotation).

## Page structure

The page is one column of clearly-labeled sections so a visitor can scan to the
part they care about. The current sections, in order, are:

1. **sky**  - calculated sun/moon/daylight + moon-phase gardening tip + a sky
   lore line + a storms lore line. The italic intro is the season's mood for
   the current time of day (from `data/moods/`).
2. **garden** - planting picks ("in the ground now"), indoor starts when the
   season has them, and a couple of weekly chores ("this week").
3. **kitchen** - what's "in season" plus one "tonight" highlight.
4. **foraging** - what the land is offering, with the closing prose line as
   italic lore beneath.
5. **folklore** - a short paragraph each from old names, remedies, and bugs.

The time-of-day rotation that used to swap which categories appeared was
removed. Time of day still tints the background palette (in `static_src/scripts/almanac.js`)
but no longer hides content.

## Layout

```
darkfurrow.com/
├── Cargo.toml, Cargo.lock        # rust deps
├── Makefile, README.md           # top-level
├── src/                          # rust source
│   ├── main.rs       # axum routes, AppState
│   ├── almanac.rs    # assemble_content + section builders
│   ├── astro.rs      # moon + sun math
│   ├── content.rs    # frontmatter, list parsers, data loaders
│   ├── markdown.rs   # comrak wrappers (inline + block)
│   ├── rng.rs        # mulberry32 with imul/signed32 semantics
│   └── templates.rs  # minijinja env, vite_asset, Jinja2-compat formatter
├── frontend/                     # JS pipeline (package.json, vite.config.js, static_src/, node_modules/)
│   └── static_src/
│       ├── index.js              # entry: imports styles + scripts
│       ├── scripts/almanac.js    # client-side palette + animations
│       ├── styles/base.scss      # @font-face + the whole stylesheet
│       └── public/               # copied as-is to dist/ (favicon, og, sw, fonts/)
├── templates/                    # minijinja-compatible jinja2
├── data/                         # markdown content (one file per topic-season)
├── dist/                         # vite build output (gitignored, served at /static/)
├── target/                       # cargo build output (gitignored)
└── samplefiles/                  # Caddyfile.sample, env.sample, post-receive.sample
```

The binary reads `templates/`, `dist/`, and `data/` from the current working
directory by default. Override the project root with `DARKFURROW_ROOT=<path>`.

## Content the page should surface

- What's in season to plant and harvest right now
- Seasonal food and simple cooking ideas (no fish or seafood)
- Moon phase, sunrise/sunset, daylight length changes
- Old folk names for storms, stars, and time periods
- Practical wisdom that used to be passed down but no longer is

## Voice and tone

- Poetic but not pretentious
- Warm but not sentimental
- The writing should feel like it belongs in an old book you found
  in a quiet shop

## Formatting preferences

- Avoid em dashes and en dashes in all writing
- Keep things lowercase where it feels right

## Tooling

- **Rust deps:** managed with `cargo` (see `Cargo.toml`, `Cargo.lock`)
- **JS deps:** managed with `bun`, run from `frontend/` (see `frontend/package.json`, `frontend/bun.lock`)
- **Production:** Docker (Alpine-based multi-stage, `rust:alpine` builder +
  `alpine:3.23` runtime), deployed via `docker-compose`. No external runtime
  deps (no Chromium, no fonts apk; woff2 are self-hosted from
  `frontend/static_src/public/fonts/`).

## Development tools

- Playwright MCP is available for browser testing. Use it to take
  screenshots and verify visual changes after modifying styles,
  templates, or content. Start the dev server first with `make run`.
- Clean up screenshot files (*.png) after reviewing them. Delete them
  once you have confirmed the result to avoid clutter in the project
  directory.
- The dev environment runs inside a Docker container with port 8000
  mapped to the host.

## Targeting

- Target planting zone is 7a (North Carolina) to start, but the structure
  should allow for expansion to other zones later.
- The site lives at darkfurrow.com.
