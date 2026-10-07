// All Things Banana: serves the site, and every 10 minutes collects banana news
// (Google News and publishers' feeds), videos and stock prices into KV (/api/feed). Banana price history for the charts
// is refreshed every 6 hours (/api/market).
import { XMLParser } from 'fast-xml-parser';
import { isAboutBananas } from './filter.js';
import { refreshMarket, MARKET_EVERY_MS, MARKET_VERSION, STOCKS } from './market.js';

const MAX_ITEMS = 300;
const STALE_MS = 20 * 60 * 1000;          // refresh on request if the cron hasn't run for a while
const YOUTUBE_EVERY_MS = 30 * 60 * 1000;  // each search costs 100 of the 10,000 daily quota units
const PUBLISHER_EVERY_MS = 20 * 60 * 1000; // be polite to publishers' feeds

// Google News sometimes refuses requests from Cloudflare's servers, so we also read
// publishers' own feeds directly. Each feed is fetched on its own: one failing doesn't stop the rest.
// allBanana: every story in that feed is about bananas, even if the headline doesn't say so.
const NEWS_FEEDS = [
  { name: 'google-gb', google: true, url: 'https://news.google.com/rss/search?q=banana+OR+bananas+when:7d&hl=en-GB&gl=GB&ceid=GB:en' },
  { name: 'google-us', google: true, url: 'https://news.google.com/rss/search?q=banana+OR+bananas+when:7d&hl=en-US&gl=US&ceid=US:en' },
  { name: 'freshplaza', source: 'FreshPlaza', url: 'https://www.freshplaza.com/rss.xml' },
  { name: 'freshplaza-europe', source: 'FreshPlaza', url: 'https://www.freshplaza.com/europe/rss.xml' },
  { name: 'freshplaza-north-america', source: 'FreshPlaza', url: 'https://www.freshplaza.com/north-america/rss.xml' },
  { name: 'freshplaza-latin-america', source: 'FreshPlaza', url: 'https://www.freshplaza.com/latin-america/rss.xml' },
  { name: 'freshfruitportal', source: 'FreshFruitPortal', url: 'https://www.freshfruitportal.com/feed/' },
  { name: 'andnowuknow', source: 'AndNowUKnow', url: 'https://www.andnowuknow.com/rss.xml' },
  { name: 'hortidaily', source: 'Hortidaily', url: 'https://www.hortidaily.com/rss.xml' },
  { name: 'bananalink', source: 'Banana Link', url: 'https://www.bananalink.org.uk/feed/', allBanana: true },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/feed') {
      let data = await env.FEED.get('feed', 'json');
      if (!data) data = await refresh(env);
      else if (Date.now() - data.updated > STALE_MS) ctx.waitUntil(refresh(env));
      return Response.json(publicView(data), { headers: { 'cache-control': 'public, max-age=60' } });
    }
    if (url.pathname === '/api/market') {
      let market = await env.FEED.get('market', 'json');
      if (!market || market.v !== MARKET_VERSION) market = await updateMarket(env, market);
      else if (Date.now() - market.updated > MARKET_EVERY_MS) ctx.waitUntil(updateMarket(env, market));
      const { errors, v, ...pub } = market;
      return Response.json(pub, { headers: { 'cache-control': 'public, max-age=300' } });
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env));
    ctx.waitUntil((async () => {
      const market = await env.FEED.get('market', 'json');
      if (!market || market.v !== MARKET_VERSION || Date.now() - market.updated > MARKET_EVERY_MS) await updateMarket(env, market);
    })());
  },
};

async function updateMarket(env, old) {
  const market = await refreshMarket(env, old || {});
  await env.FEED.put('market', JSON.stringify(market));
  return market;
}

const publicView = ({ items, stocks, updated }) => ({ items, stocks, updated });

async function refresh(env) {
  const old = (await env.FEED.get('feed', 'json')) || { items: [], stocks: [], sources: {} };
  const now = Date.now();
  const sources = { ...old.sources };
  const fresh = [];

  const run = async (name, fn) => {
    try {
      const got = await fn();
      if (got) { fresh.push(...got); sources[name] = { ok: true, at: now, count: got.length }; }
    } catch (e) {
      sources[name] = { ok: false, at: now, error: String(e).slice(0, 200) };
    }
  };

  let stocks = old.stocks;
  const youtubeDue = env.YOUTUBE_API_KEY && now - (sources.youtube?.at || 0) > YOUTUBE_EVERY_MS;
  const due = f => f.google || now - (sources[f.name]?.at || 0) > PUBLISHER_EVERY_MS;
  await Promise.all([
    ...NEWS_FEEDS.filter(due).map(f => run(f.name, () => readFeed(f))),
    youtubeDue && run('youtube', () => youtube(env.YOUTUBE_API_KEY)),
    env.FINNHUB_API_KEY && run('stocks', async () => { stocks = await quotes(env.FINNHUB_API_KEY); }),
  ]);

  // merge, drop duplicates (the same story from many outlets), newest first
  const seen = new Set();
  const items = [...fresh, ...old.items]
    .filter(it => isAboutBananas(it.title, it.allBanana))
    .sort((a, b) => b.published - a.published)
    .filter(it => {
      const k = it.type + ':' + it.title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 70);
      if (seen.has(it.id) || seen.has(k)) return false;
      seen.add(it.id); seen.add(k);
      return true;
    })
    .slice(0, MAX_ITEMS);

  const data = { items, stocks, sources, updated: now };
  await env.FEED.put('feed', JSON.stringify(data));
  return data;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const asArray = x => (Array.isArray(x) ? x : x ? [x] : []);

const UA = { 'user-agent': 'AllThingsBanana/1.0 (+https://allthingsbanana.com)' };

async function readFeed(feed) {
  const res = await fetch(feed.url, { headers: UA });
  if (!res.ok) throw new Error(`${feed.name} ${res.status}`);
  const rss = xml.parse(await res.text());
  return asArray(rss?.rss?.channel?.item).map(it => {
    const source = feed.source || (typeof it.source === 'object' ? it.source['#text'] : it.source) || 'News';
    let title = decode(text(it.title));
    if (feed.google) title = title.replace(new RegExp(`\\s+-\\s+${escapeRe(source)}$`), '');
    const url = text(it.link);
    return {
      id: 'news:' + url,
      type: 'news',
      title,
      url,
      source,
      thumb: imageOf(it),
      published: Date.parse(it.pubDate) || Date.now(),
      ...(feed.allBanana ? { allBanana: true } : {}),
    };
  }).filter(it => it.title && it.url.startsWith('http'));
}

const text = v => String(typeof v === 'object' && v !== null ? v['#text'] ?? '' : v ?? '').trim();
// a picture for the story, if the feed has one (only https, so browsers will show it)
function imageOf(it) {
  const candidates = [
    ...asArray(it['media:content']).map(m => m.url),
    ...asArray(it['media:thumbnail']).map(m => m.url),
    ...asArray(it.enclosure).filter(e => !e.type || e.type.startsWith('image')).map(e => e.url),
  ];
  const html = text(it['content:encoded']) + text(it.description);
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (img) candidates.push(img[1]);
  return candidates.find(u => typeof u === 'string' && u.startsWith('https://')) || undefined;
}

async function youtube(key) {
  const q = new URLSearchParams({
    part: 'snippet', q: 'banana|bananas', type: 'video', order: 'date', maxResults: '25',
    relevanceLanguage: 'en', safeSearch: 'strict', key,
  });
  const res = await fetch('https://www.googleapis.com/youtube/v3/search?' + q);
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const json = await res.json();
  return json.items.map(v => ({
    id: 'yt:' + v.id.videoId,
    type: 'video',
    title: decode(v.snippet.title),
    url: 'https://www.youtube.com/watch?v=' + v.id.videoId,
    source: decode(v.snippet.channelTitle),
    thumb: v.snippet.thumbnails?.medium?.url,
    published: Date.parse(v.snippet.publishedAt),
  }));
}

async function quotes(key) {
  return Promise.all(STOCKS.map(async ({ symbol, name }) => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`);
    if (!res.ok) throw new Error(`Finnhub ${res.status}`);
    const q = await res.json();
    if (!q.c) throw new Error(`Finnhub: no price for ${symbol}`);
    return { symbol, name, price: q.c, change: q.d, changePct: q.dp, time: q.t * 1000 };
  }));
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, e) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
    if (named) return named;
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}
