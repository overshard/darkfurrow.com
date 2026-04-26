# Dark Furrow

## What is this project?

Dark Furrow is a seasonal almanac for the modern web. It surfaces forgotten
rhythms that humans used to live by: what's growing right now, what's ready
to harvest, what the sky is doing, what our ancestors called this week.

The project is an art piece as much as it is a tool. It is a single living
page that breathes with the seasons.

## Design philosophy

- Text-forward, minimal, dark aesthetic. Like reading by firelight.
- Clean, simple text-based UI. No flashy components or frameworks.
- No external API dependencies. All data is encoded by hand or calculated
  with simple math (moon phases, sunrise/sunset, daylight changes).
- No feeds, no accounts, no engagement patterns.
- The page should feel quiet, warm, and cozy.

## Technical notes

- Flask backend with Jinja2 templates. Python handles all content
  assembly, calculations, and markdown rendering (via mistune).
- Client-side JavaScript is for presentation only: color palette,
  animations, navigation interactions, and auto-refresh.
- Dependencies managed with uv. See pyproject.toml.
- All content data lives in markdown files under data/. No hardcoded
  content in Python code.
- `make run` starts the Flask dev server on 0.0.0.0:8000.
- Production runs via `docker-compose` (Gunicorn, 2 workers) bound to
  `127.0.0.1:${PORT}` where `PORT` comes from `.env` (8500 on the deployed host).
- Routes: `/` renders the page; `/api/content` returns the same content as JSON
  for the client-side auto-refresh. Both accept `?season=` for previewing other
  seasons. There is no `?time=` override anymore.
- The site lives at darkfurrow.com.
- Target planting zone is 7a (North Carolina) to start, but the structure
  should allow for expansion to other zones later.

## Development tools

- Playwright MCP is available for browser testing. Use it to take
  screenshots and verify visual changes after modifying styles,
  templates, or content. Start the dev server first with `make run`.
- Clean up screenshot files (*.png) after reviewing them. Delete them
  once you have confirmed the result to avoid clutter in the project
  directory.
- The dev environment runs inside a Docker container with port 8000
  mapped to the host.

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

Daily-stable seeded RNG (`seeded_random` keyed by day-of-year) picks which
items surface per section, so content shifts day to day but is stable across
refreshes within a day.

The time-of-day rotation that used to swap which categories appeared was
removed. Time of day still tints the background palette (in `static/almanac.js`)
but no longer hides content.

## Content the page should surface

- What's in season to plant and harvest right now
- Seasonal food and simple cooking ideas (no fish or seafood)
- Moon phase, sunrise/sunset, daylight length changes
- Old folk names for storms, stars, and time periods
- Practical wisdom that used to be passed down but no longer is

The `data/wisdom/<time>.md` files are no longer rendered (they were tied to the
removed time rotation) but remain on disk in case they come back.

## Voice and tone

- Poetic but not pretentious
- Warm but not sentimental
- The writing should feel like it belongs in an old book you found
  in a quiet shop

## Formatting preferences

- Avoid em dashes and en dashes in all writing
- Keep things lowercase where it feels right
