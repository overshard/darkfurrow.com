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
  for the client-side auto-refresh. Both accept `?season=` and `?time=`
  query-string overrides for previewing other times of day or year.
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
