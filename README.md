> **Archived.** This project is no longer in use and no longer maintained.
> I no longer own `darkfurrow.com`, so anything served there is unrelated to this code.
> `templates/index.html` still hardcodes that domain in its canonical and social tags.

# Dark Furrow

The earth remembers what we forgot.

A living almanac of seasons, soil, and the quiet knowledge that used to be common.

## What is this?

Dark Furrow is a seasonal almanac for the modern web. It surfaces the slow, forgotten rhythms that humans used to live by: what's growing right now, what's ready to harvest, what the sky is doing, what our ancestors called this week.

Most people can't name what's in season. Most people don't know when to plant a seed or what phase the moon is in. This knowledge used to be ordinary. Now it's nearly gone.

This project is an attempt to tend that knowledge. To present it simply, quietly, and beautifully. It is an art piece as much as a tool.

## How it works

A single living page.

The page knows the date and the season. It calculates the moon phase, the sunrise and sunset, the lengthening or shortening of days. It holds planting calendars, seasonal food, old folk names for storms and stars, and the kind of practical wisdom that used to be passed down and no longer is.

Each day, the page draws a fresh handful of these from a seed tied to the day itself, so the words shift from one morning to the next but hold steady until the next sunrise.

The page reads as one column of plain sections you can scan: sky, garden, kitchen, foraging, folklore. The aesthetic is text-forward, minimal, and dark. Like reading by firelight. Like soil before dawn.

For now it is keyed to planting zone 7a (North Carolina) and the America/New_York sky. The structure leaves room to grow into other zones later.

## Philosophy

- No external APIs. The data is encoded by hand, the math is simple, the knowledge is old. Moon phases and the sun's comings and goings are computed in place.
- No feeds, no accounts, no engagement. Just a page that breathes with the year.
- It grows slowly, like the things it describes.

## Running it

You need Rust (cargo) and bun.

```
make run     # dev server with live-reloading assets, on port 8000
make build   # production assets and release binary
make start   # run the release binary
cargo test   # parity tests for the seeded picks, moon math, and sun math
```

## How the content is organized

The words live as Markdown under `content/`, one file per topic and season, as `content/<topic>/<season>.md`, alongside the seasons, moods, haiku, and moon tips. To add or change what the almanac says, edit those files. No database, no build step for the prose itself.

By default the app reads `content/`, `templates/`, and the built assets from the working directory. Point it elsewhere with `DARKFURROW_ROOT`.

## Tech

Rust (axum) serves the page and a small JSON twin of it at `/api/content`. minijinja renders the template, comrak renders the Markdown, and the astronomy is done in process. The frontend is built with Vite and Sass (managed with bun) into content-hashed assets. Fonts are self-hosted. It ships as a small Alpine Docker image with no external runtime dependencies.

## Status

Early. Planting season.
