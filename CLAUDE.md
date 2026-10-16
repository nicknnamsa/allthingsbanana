# CLAUDE.md: All Things Banana

Read this first. It is the hand-over for anyone (human or Claude) working on this repo, so a new session doesn't need the history of past chats.

## What this is

**allthingsbanana.com**: a website about bananas. A daily Wikipedia puzzle (Bananadle), a banana clicker world league, a loop studio (BanaDAW) with a community board, banana news and prices, a world production map, 90 recipes, topic hubs and a 3D puzzle solver (Banana Cube). The public README explains it for visitors and employers; this file explains how to work on it.

Everything that ships lives in `web/`. The repo root also has the original Python cube solver (`banana.py`), design and audit notes (`DESIGN.md`, `AUDIT.md`, `audit/`), screenshots for the README (`docs/`) and an old sound experiment (`sound-lab/`, not deployed).

## Working rules (from the owner)

- **Commits:** always use the local git config as-is (author `nicknnamsa <nicolas.asmann@gmail.com>`). Never set or override the author.
- **Pushing:** pushing to `main` deploys the live site. Push only when the owner says so ("push", "deploy"). Never force-push or rewrite history without asking.
- **Don't remove features** without asking.
- **Copy:** short, specific, a little funny. No filler or marketing slop. Plain English (British spelling in prose, e.g. "colour", "favourite").
- **Accessibility:** respect `prefers-reduced-motion`; text must stay readable in all three themes; touch targets about 44 px; real buttons and labels.
- After building something visible, **test it in a real browser** (see Testing) at 390 px and 1280–1440 px, in light, dark and banana themes, before calling it done.
- `web/worker/snapshot/bls.json` changes whenever `npm run build` runs (it re-downloads BLS prices). Leave it out of commits unless the owner wants it.

## Stack and deploy

- **Astro 7** static site (`web/src`), TypeScript in `<script>` blocks and `web/src/scripts/`.
- **Cloudflare Worker** `web/worker/index.js` serves `dist/` as static assets and everything under `/api/*`. Static files never pass through the worker (so redirects for static paths must be Cloudflare dashboard rules).
- **KV** `FEED` holds the news feed and market data (refreshed by a cron every 10 minutes).
- **Durable Objects** (SQLite-backed, migrations v1–v4 in `web/wrangler.jsonc`):
  - `PeelCounter` (`peel.js`): clicker totals per country.
  - `DegreesStats` (`degrees.js`): Bananadle daily results.
  - `VisitCounter` (`visits.js`): page views per day.
  - `BeatBoard` (`beats.js`): BanaDAW community loops and votes.
- **Secrets** (set with `npx wrangler secret put`): `VOTE_SALT` (hashes IPs for the board), `ADMIN_KEY` (owner's copy is in `~/.banadaw-admin-key`), plus API keys used by the cron: `FINNHUB_API_KEY`, `ALPHAVANTAGE_API_KEY`, `YOUTUBE_API_KEY`, `BLS_API_KEY`.
- **Deploy:** push to `github.com/nicknnamsa/allthingsbanana` `main` → Cloudflare Workers Builds runs `npm run build` and deploys. Usually live in 1–2 minutes, sometimes ~5. Check with `curl` against the live page.

## Commands (run in `web/`)

- `npx astro build`: build only (fast, ~1 s). `npm run build` also refreshes the price snapshot.
- `npx astro dev --port 4399`: dev server (no worker APIs; useful for profiling with readable function names and for `await import('/src/scripts/...')` in the console).
- Local test with the worker and Durable Objects: create a throwaway `wrangler.localtest.jsonc` (name `allthingsbanana-test`, KV id `local-audit`, same DO bindings and migrations, no routes), run `npx wrangler dev -c wrangler.localtest.jsonc --port 8788 --persist-to <scratch dir>`, and delete the config afterwards.
- Static-only test: `cd dist && python3 -m http.server 8790`. **Gotcha:** `astro build` deletes and recreates `dist/`, so a server started earlier keeps serving the deleted old files. Kill it (`pkill -f "http.server 8790"`) and restart after every build.
- Data scripts in `web/scripts/` (`build-fao`, `build-spam`, `build-nutrition`, `build-degrees`, `crawl-recipes`) regenerate data files; they're run by hand, rarely.

## Layout of `web/src`

- `layouts/Base.astro`: every page. Head/meta (props: `title`, `description`, `wide`, `section`, `image` for the share card in `public/og/`, `noindex`, `ticker`), header links with coloured dots (Bananadle, Clicker, Recipes, Prices, BanaDAW), search, footer, the phone bottom bar ("dock"), and the theme switcher (light → dark → banana, stored as `atb-theme`). Banana mode replaces every letter B with a banana glyph via `bananify()`; mark anything that must not be touched with `data-no-banana`.
- `styles/site.css`: the design system. Tokens on `:root` with dark (`prefers-color-scheme` and `[data-theme="dark"]`) and banana overrides. Fonts Fredoka (display) and Nunito (text). Pastels `--butter --mint --peach --sky --lilac` with stronger `-d` dot colours; `--banana`, `--banana-ink`; ripeness scale `--r1..--r7`; radii `--r-lg/md/sm`; components `.btn(.banana/.plain)`, `.tag`, `.dot`, `.box`, `.crate`, `.prose`. Banana mode = thick `#3A2A0E` borders and offset shadows.
- `pages/`: `index.astro` (home: Bananadle, news, clicker league, price, recipe of the day), `bananadle.astro`, `more/` (games list, Banana Clicker, Banana Cube), `recipes/` (index and `[slug]`), `bananalytics/` (prices and world map), `news/`, `topics/`, `about/`, `privacy/`, `banadaw.astro` and `banadaw/how-to.astro`.
- `components/`: `Bananadle.astro` (the puzzle UI), `RecipeCard`, `PopularityChart`, `PricesNav`.
- `scripts/`: `bananadle.ts` (puzzle engine), `market.ts` (feed and price helpers), `charts.ts`, `news.ts`, `rave.ts` (clicker rave), `banadaw/` (see below).
- `data/recipes/`: one file per meal group (`breakfast.ts`, `savoury.ts`, `desserts.ts`, `drinks.ts`), `extras/` (intro, prep/cook times, named method steps, tips, storage, swaps per slug), `photos.json`, `nutrition.json`. The build fails if a recipe has no extras entry or prep + cook exceeds its total time. Don't change ingredient lists without rebuilding nutrition (`npm run build-nutrition`).

## Gotchas

- Astro scoped styles don't reach HTML injected with `innerHTML`; use `:global(...)` or an `is:global` style block.
- zsh doesn't word-split variables in loops; use `${=var}`.
- `forEach(fn)` passes `(item, index)`. If `fn` has an optional second parameter, wrap it: `forEach(el => fn(el))`. (This once made every BanaDAW knob show the wrong value.)
- The cron writes KV; the page reads `/api/feed` and `/api/market` with short cache headers.

## BanaDAW (the loop studio)

Files: `src/pages/banadaw.astro` (all UI and page logic, one big script), `src/scripts/banadaw/song.ts` (data model, presets, starters), `engine.ts` (sound), `padstore.ts` (IndexedDB for pad recordings), `src/pages/banadaw/how-to.astro` (the user guide; keep it in step with features), `worker/beats.js` (the board API).

**Song format (`song.ts`, `v: 2`):** one loop of `bars` 1/2/4/8 (16 steps a bar). `ch[]` channels are `drum` (`sound`, `steps[]` velocities 0–1, `p` tune/decay/tone/drive) or `synth` (`preset`, `notes[]` `{s, l, m, v}` = start step, length in steps, MIDI note, velocity; `p` cutoff/res/env/attack/release/drive/glide). Each has `mix` (vol, pan, rev, dly, duck = sidechain, mute, solo) and a `color` index. `master` {vol, filter −1..1, drive}. Optional `auto`: automation lanes keyed `"<channelId>:<knob>"` or `"m:<knob>"`, each a list of `[step, value 0..1]` points (helpers `autoParams`, `autoAt`, `knobValue`). Starter loops are in `STARTERS` (Red Circle = the dark club / John Wick one). Songs travel compressed in share links (`#s=…`) and to the board.

**Engine (`engine.ts`):** everything is synthesised with Web Audio, no samples. Per channel a strip (fader → pan → duck → master, plus reverb and delay sends); master chain hp/lp filter → drive → glue compressor → volume → limiter → soft clip. `Player.step()` plays one step (applies automation first), used live and by the offline WAV render, so they match. 808 metallic hats/cymbals are pre-rendered once (`prepareMetal`); hat/cymbal/clap/shaker filters are shared per channel. Drum levels are balanced by the `TRIM` table (measured with `measure()`). `Engine` runs a 20 ms lookahead scheduler, the metronome (straight to the speakers, never in WAVs), and pads mode.

**Pads:** saving a loop to a pad renders it once to audio (`renderLoop`: one pass plus the reverb tail folded back onto the start, about 2 s for 4 bars) and stores it in IndexedDB with a fingerprint of the loop; on load, out-of-date or missing recordings are re-rendered. Playing a pad is a single looping `AudioBufferSourceNode` on its own filter/volume bus (`padIn → padHp → padLp → master volume → limiter`); the engine only restarts it (with a 4–6 ms crossfade) when the music jumps: launch (quantised to bar/beat/now), retrigger (pressing the playing pad restarts it), slices (hold Q–I: 8 slices), stutter (hold Z/X/C: 1 beat, 1/8, 1/16). "Same tempo" changes the playback rate, so pitch follows (like a sampler). Pad loops are in localStorage `banadaw-pads`, pad filter settings in `banadaw-padfx`.

**UI (`banadaw.astro`):** toolbar, channel rack ("the bunch"), editor with tabs Notes (canvas piano roll / drum roll with velocity "Ripeness" lane; Alt-drag box select, Shift-drag copy, selection shortcuts), Automation (a lane per channel plus master; pick a knob, click the line to add points), Pads (3×3 grid, keys 1–9). Every edit goes through `edit()` / `commit(before)` so undo (150 steps) and autosave (localStorage `banadaw2`) just work. Canvas colours come from CSS variables `--g-*` so they follow the theme. The playhead is an overlay element moved with `transform`; the grid only redraws when `dirty`. Knobs are SVG (`knobHTML` / `paintKnob`), and automated knobs get a pink dot and follow their line while playing. The whole studio is `data-no-banana`.

**The board:** `POST /api/beats` (name, author, encoded song; validated and decoded server-side; name filter; 8 posts a day per person), `GET /api/beats?sort=week|all|new`, `GET /api/beats/<id>`, `POST …/vote` (one per person via salted IP hash), `POST …/report` (3 reports hide it), `POST …/hide|unhide` with header `x-admin-key`. Links to a post are `/banadaw/#beat=<id>`.

## Other features in brief

- **Bananadle:** start on today's Wikipedia page, reach *Banana* by typing pages it links to or mentions (or that link back). Par 4, golf names, daily stats via `/api/degrees`. Day 1 = 7 Oct 2026 (`EPOCH` in `bananadle.ts` and `worker/degrees.js`). The plain-language rule box at the top hides once you start.
- **Banana Clicker:** clicks batched to `/api/peel`, tallied per country (from Cloudflare) in `PeelCounter`; the rave visuals are in `rave.ts`.
- **Recipes:** JSON-LD Recipe schema with named, linked steps; ripeness and meal filters on the index; photos credited from Wikimedia Commons.
- **Prices / world map:** IMF and BLS prices (`worker/market.js`, snapshot fallback), FAOSTAT production and MapSPAM layers built by the data scripts.

## Testing approach

There are no unit tests. Changes are checked by building and driving headless Chrome over the DevTools protocol from small Node scripts kept in the session scratchpad (they are not in the repo):

- screenshots at 390 and 1280/1440 px in light, dark and banana (set `localStorage['atb-theme']`), checking for horizontal overflow and page errors;
- interaction checks (dispatch mouse/keyboard events, read state through a temporary `window.__bdaw` hook, then **remove the hook before committing**: it's marked `// TEMP-TEST`);
- audio levels and CPU via `OfflineAudioContext` renders (`measure()`, `renderWav()`), timed in the dev server with `await import('/src/scripts/banadaw/engine.ts')`.

Chrome is at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (run with `--headless=new --autoplay-policy=no-user-gesture-required`).

## Ideas on the list (not built yet)

- A "Bananas" guide page aimed at the search term "banana" (what a banana is, varieties, nutrition, ripeness, history, Panama disease, linking the map and prices), a "how bananas spread" section on the world map, and a step-by-step Banana Cube guide. These came out of Search Console data (October 2026).
- BanaDAW: share or post a whole pad set; per-loop share previews by serving `/banadaw/beat/<id>` from the worker.
