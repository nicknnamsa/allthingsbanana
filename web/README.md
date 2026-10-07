# All Things Banana

The website for allthingsbanana.com.

- `src/pages/`: site pages (Astro): Home (`index.astro`), Bananalytics (`bananalytics/`), Latest News (`news/`) and More Bananas (`more/`, including the Banana Cube and Banana Clicker).
- `src/scripts/`: shared code for charts, market data and news.
- `src/data/recipes/`: the Peelicious banana recipes. To add one, copy any recipe in these files and change it; it gets its own page, search entry and filters automatically.
- `worker/`: the Cloudflare Worker. It serves the site and refreshes the feed every 10 minutes.
  - `worker/index.js`: fetches news, YouTube videos and stock prices, and stores them in KV.
  - `worker/filter.js`: decides what counts as "about bananas". Edit the lists to tune it.
  - `worker/peel.js`: the Banana Clicker's shared tally of peeled bananas per country (a Durable Object).

## Run it locally

```sh
npm install
cp .dev.vars.example .dev.vars   # optional: add API keys
npm run dev                      # http://localhost:8787
```

## First deploy

1. **Log in to Cloudflare** (opens your browser):
   ```sh
   npx wrangler login
   ```
2. **Create the feed storage**, then paste the `id` it prints into `wrangler.jsonc` (replace `REPLACE_WITH_YOUR_KV_ID`):
   ```sh
   npx wrangler kv namespace create FEED
   ```
3. **Deploy:**
   ```sh
   npm run deploy
   ```
   You get a `*.workers.dev` link. Open it to check that everything works.

## Connect allthingsbanana.com

1. In the Cloudflare dashboard, choose **Add a domain**, enter `allthingsbanana.com` and pick the **Free** plan.
2. Cloudflare shows you two nameservers. In GoDaddy, go to the domain → **DNS** → **Nameservers** → **Change** → "I'll use my own nameservers", and enter the two Cloudflare ones. This can take from a few minutes to a few hours.
3. When Cloudflare says the domain is active, add this to `wrangler.jsonc` and run `npm run deploy` again:
   ```jsonc
   "routes": [
     { "pattern": "allthingsbanana.com", "custom_domain": true },
     { "pattern": "www.allthingsbanana.com", "custom_domain": true }
   ],
   ```

## Optional: stocks and videos

Without these keys the site shows banana prices and news only. All three are free.

- **Stock prices (Dole, Fresh Del Monte):** sign up at finnhub.io and copy your API key.
- **Stock price charts (sparklines):** sign up at alphavantage.co for a free API key.
- **US shop prices (recommended):** register at data.bls.gov/registrationEngine for a free BLS key. Without one, the BLS often refuses Cloudflare's shared servers and the site falls back to the copy saved at build time.
- **YouTube videos:** in Google Cloud Console, create a project, enable **YouTube Data API v3**, then create an API key.

Add them to the live site (each command asks you to paste the key):

```sh
npx wrangler secret put FINNHUB_API_KEY
npx wrangler secret put ALPHAVANTAGE_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put BLS_API_KEY
```

The price charts use the IMF and the US Bureau of Labor Statistics. If the Worker can't reach either, it uses a copy saved at build time in `worker/snapshot/` (`npm run snapshot` refreshes it; `npm run build` does it automatically). Commit the refreshed snapshot files so automatic builds have them too.

News comes from Google News plus publishers' own feeds (FreshPlaza, FreshFruitPortal, AndNowUKnow, Hortidaily, Banana Link), listed in `worker/index.js`. Google News sometimes refuses Cloudflare's servers, so the publisher feeds keep the site supplied.

For local development, put them in `.dev.vars` instead. That file is never committed or deployed.

## Updating the site

Make changes, then run `npm run deploy`. The feed keeps running between deploys.
