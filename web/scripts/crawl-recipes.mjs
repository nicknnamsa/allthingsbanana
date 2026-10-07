// Finds banana recipes on other recipe sites and saves them as links for Peelicious.
//
//   npm run crawl-recipes            (takes a while: we go slowly on purpose)
//
// How it behaves:
//   - reads each site's robots.txt, skips anything it disallows, and waits between requests
//   - finds candidate pages from the site's sitemaps (pages with banana/plantain in the address)
//   - reads the schema.org Recipe data the page publishes for search engines
//   - keeps only facts and the link: name, picture, time, rating, publisher. Never their method or text.
//   - remembers what it has seen in scripts/.recipe-crawl-cache.json, so re-runs only visit new pages
// Output: public/recipes/web.json, loaded by the Peelicious page.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const UA = 'Mozilla/5.0 (compatible; AllThingsBananaBot/1.0; +https://allthingsbanana.com/about/)';
const MIN_DELAY_MS = 1500;         // per site, at least this long between requests
const MAX_SITEMAPS_PER_SITE = 80;
const MAX_PAGES_PER_SITE = Number(process.env.MAX_PAGES) || 400;   // raise for a big run: MAX_PAGES=5000 npm run crawl-recipes
const REFRESH_DAYS = 30;           // re-check a page after this long

// Sites to read. Add more here: `name` is shown on the card.
const SITES = [
  ['Allrecipes', 'www.allrecipes.com'], ['BBC Good Food', 'www.bbcgoodfood.com'], ['Simply Recipes', 'www.simplyrecipes.com'],
  ['Serious Eats', 'www.seriouseats.com'], ['Minimalist Baker', 'minimalistbaker.com'], ['Budget Bytes', 'www.budgetbytes.com'],
  ['Cookie and Kate', 'cookieandkate.com'], ["Sally's Baking Addiction", 'sallysbakingaddiction.com'], ['King Arthur Baking', 'www.kingarthurbaking.com'],
  ['Taste of Home', 'www.tasteofhome.com'], ['Epicurious', 'www.epicurious.com'], ['Delish', 'www.delish.com'],
  ['Love and Lemons', 'www.loveandlemons.com'], ['RecipeTin Eats', 'www.recipetineats.com'], ['Jamie Oliver', 'www.jamieoliver.com'],
  ['BBC Food', 'www.bbc.co.uk'], ['Food.com', 'www.food.com'], ['EatingWell', 'www.eatingwell.com'],
  ['Panlasang Pinoy', 'panlasangpinoy.com'], ['Kawaling Pinoy', 'www.kawalingpinoy.com'], ["Dassana's Veg Recipes", 'www.vegrecipesofindia.com'],
  ['Mexico in My Kitchen', 'www.mexicoinmykitchen.com'], ['The Kitchn', 'www.thekitchn.com'], ['Inspired Taste', 'www.inspiredtaste.net'],
  ['Well Plated', 'www.wellplated.com'], ['Ambitious Kitchen', 'www.ambitiouskitchen.com'], ["Chelsea's Messy Apron", 'www.chelseasmessyapron.com'],
  ['Spend With Pennies', 'www.spendwithpennies.com'], ["Natasha's Kitchen", 'natashaskitchen.com'], ['Gimme Some Oven', 'www.gimmesomeoven.com'],
  ['Precious Core', 'www.preciouscore.com'], ['African Bites', 'www.africanbites.com'], ['My Forking Life', 'www.myforkinglife.com'],
  ['Dominican Cooking', 'www.dominicancooking.com'], ['The Spruce Eats', 'www.thespruceeats.com'], ['Cafe Delites', 'cafedelites.com'],
].map(([name, host]) => ({ name, host }));

const CANDIDATE = /banana|plantain|platano|plátano|saging|turon|banoffee|maduro|tostone|mofongo|matoke|mangu|pastelon|kluay|kela/i;
const SKIP_SITEMAP = /(category|tag|author|video|image|web-?stor|product|page-sitemap|attachment|shop|collection|topic|glossary|news)/i;
// banana peppers, banana shallots and banana leaves aren't bananas
const NOT_FRUIT = /banana\s+(peppers?|shallots?|leaf|leaves|squash)/gi;
const IS_BANANA = /\b(bananas?|plantains?|pl[aá]tanos?|saba|matoke)\b/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = Date.now();

// ---------- robots.txt ----------
function parseRobots(txt) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  const sitemaps = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, k, v] = m, key = k.toLowerCase();
    if (key === 'sitemap') { sitemaps.push(v.trim()); continue; }
    if (key === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [], delay: 0 }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'allow' || key === 'disallow') cur.rules.push({ allow: key === 'allow', path: v });
    if (key === 'crawl-delay') cur.delay = Number(v) || 0;
  }
  const mine = groups.find(g => g.agents.some(a => a.includes('allthingsbanana'))) || groups.find(g => g.agents.includes('*')) || { rules: [], delay: 0 };
  return { rules: mine.rules.filter(r => r.path), delay: mine.delay, sitemaps };
}
function allowed(robots, url) {
  const path = new URL(url).pathname + new URL(url).search;
  let best = null;
  for (const r of robots.rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
}

// ---------- fetching, one request at a time per site ----------
function makeFetcher(delay) {
  let last = 0;
  return async (url, binary = false) => {
    const wait = last + delay - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: binary ? '*/*' : 'text/html,application/xml;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${res.status}`);
    if (url.endsWith('.gz')) return gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
    return res.text();
  };
}
const locs = xml => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));

// ---------- reading a recipe page ----------
const isRecipe = o => o && (o['@type'] === 'Recipe' || (Array.isArray(o['@type']) && o['@type'].includes('Recipe')));
function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if (isRecipe(node)) return node;
  if (node['@graph']) return findRecipe(node['@graph']);
  if (node.mainEntity) return findRecipe(node.mainEntity);
  return null;
}
function minutes(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(iso || ''));
  if (!m) return null;
  const t = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return t > 0 && t < 60 * 24 * 3 ? t : null;
}
const text = v => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
const clean = s => String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function imageOf(img, base) {
  let u = Array.isArray(img) ? img[0] : img;
  if (u && typeof u === 'object') u = u.url || u.contentUrl;
  if (!u || typeof u !== 'string') return null;
  try { u = new URL(u, base).href; } catch { return null; }
  return u.startsWith('https://') ? u : null;
}

function classify(name, r) {
  const hay = `${name} ${text(r.recipeCategory)} ${text(r.keywords)} ${text(r.recipeCuisine)}`.toLowerCase();
  const meals = new Set();
  if (/smoothie|shake|lassi|latte|cocktail|daiquiri|colada|drink|juice|batido|milk\b/.test(hay)) meals.add('drink');
  if (/pancake|waffle|oat|porridge|granola|breakfast|brunch|french toast|crepe|crêpe|scone|chia|parfait|banana bread|muffin|mangu|mangú/.test(hay)) meals.add('breakfast');
  if (/cake|pie\b|pudding|cookie|brownie|blondie|ice cream|cheesecake|tart\b|dessert|crumble|cobbler|split|foster|cupcake|fudge|truffle|nice cream|banoffee|custard|trifle|sweet/.test(hay)) meals.add('dessert');
  if (/chips|bites|bar\b|bars\b|balls|energy|snack|fritter|turon|banana cue|appetizer|bread\b|muffin/.test(hay)) meals.add('snack');
  if (/curry|chicken|pork|beef|fish|shrimp|stew|soup|salad|sandwich|taco|rice|mofongo|tostones|maduros|plantain|salsa|chutney|ketchup|side dish|main|dinner|lunch|matoke|pastel/.test(hay)) { meals.add('lunch'); meals.add('dinner'); }
  // a drink is a drink, whatever else the site's keywords say
  if (meals.has('drink')) { meals.delete('dessert'); meals.delete('snack'); meals.delete('lunch'); meals.delete('dinner'); }
  if (!meals.size) meals.add('dessert');
  const diet = [];
  const dietHay = `${hay} ${text(r.suitableForDiet)}`.toLowerCase();
  if (/vegan/.test(dietHay)) diet.push('vegan');
  if (/gluten[- ]?free|glutenfree/.test(dietHay)) diet.push('gluten-free');
  if (/dairy[- ]?free/.test(dietHay)) diet.push('dairy-free');
  if (/no[- ]bake/.test(dietHay)) diet.push('no-bake');
  return { meals: [...meals], diet };
}
// how banana-heavy: bananas named in the title count most, then how many go in
function bananaLevel(name, ings) {
  const inName = IS_BANANA.test(name.replace(NOT_FRUIT, ''));
  let qty = 0;
  for (const line of ings) {
    const l = line.replace(NOT_FRUIT, '');
    if (!IS_BANANA.test(l)) continue;
    const n = /(\d+(?:\.\d+)?|½|one|two|three|four|five|six)\s*(?:\(\w+\)\s*)?(?:large|medium|small|ripe|very|overripe|green|frozen|mashed|\s)*\s*(?:bananas?|plantains?)/i.exec(l);
    const words = { '½': 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    qty += n ? (words[n[1].toLowerCase()] ?? parseFloat(n[1])) : 1;
  }
  const level = inName ? Math.min(5, 2 + Math.ceil(qty)) : Math.min(3, 1 + Math.ceil(qty));
  return { level: Math.max(1, level), relevant: inName || qty > 0 };
}

async function readRecipe(fetchText, site, url) {
  const html = await fetchText(url);
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let r = null;
  for (const b of blocks) { try { r = findRecipe(JSON.parse(b.trim())); } catch {} if (r) break; }
  if (!r || !r.name) return null;
  const name = clean(r.name);
  const ings = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(clean);
  const { level, relevant } = bananaLevel(name, ings);
  if (!relevant) return null;
  const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i.exec(html)?.[1];
  const mins = minutes(r.totalTime) ?? ((minutes(r.prepTime) || 0) + (minutes(r.cookTime) || 0) || null);
  const rating = r.aggregateRating ? { v: Math.round(parseFloat(r.aggregateRating.ratingValue) * 10) / 10, c: parseInt(r.aggregateRating.ratingCount || r.aggregateRating.reviewCount) || 0 } : null;
  const { meals, diet } = classify(name, r);
  return {
    n: name, u: canonical && canonical.startsWith('https://') ? canonical : url, s: site.name,
    i: imageOf(r.image, url), m: mins, meals, d: diet, l: level,
    ...(rating && rating.v > 0 ? { r: rating.v, c: rating.c } : {}),
    k: clean(text(r.recipeCuisine)).slice(0, 40) || undefined,
  };
}

// ---------- one site ----------
async function crawlSite(site, cache, log) {
  let robots = { rules: [], delay: 0, sitemaps: [] };
  try { robots = parseRobots(await (await fetch(`https://${site.host}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) })).text()); } catch {}
  const fetchText = makeFetcher(Math.max(MIN_DELAY_MS, robots.delay * 1000));
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`https://${site.host}/sitemap.xml`, `https://${site.host}/sitemap_index.xml`];
  const seenMaps = new Set(), pages = new Set();
  let maps = 0;
  while (queue.length && maps < MAX_SITEMAPS_PER_SITE) {
    let sm = queue.shift();
    if (!/^https?:\/\//.test(sm) || seenMaps.has(sm)) continue;
    seenMaps.add(sm);
    if (!allowed(robots, sm)) continue;
    let xml;
    try { xml = await fetchText(sm); maps++; } catch { continue; }
    const found = locs(xml);
    if (/<sitemapindex/i.test(xml)) {
      // recipe and post sitemaps first; skip ones that obviously aren't recipes
      const children = found.filter(u => !SKIP_SITEMAP.test(u));
      children.sort((a, b) => (/recipe/i.test(b) ? 1 : 0) - (/recipe/i.test(a) ? 1 : 0));
      queue.push(...children);
    } else {
      for (const u of found) if (CANDIDATE.test(decodeURIComponent(u)) && u.includes(site.host.replace(/^www\./, ''))) pages.add(u);
    }
  }
  const out = [];
  let visited = 0, fresh = 0;
  for (const url of [...pages].slice(0, MAX_PAGES_PER_SITE)) {
    const hit = cache[url];
    if (hit && now - hit.at < REFRESH_DAYS * 864e5) { if (hit.recipe) out.push(hit.recipe); continue; }
    if (!allowed(robots, url)) continue;
    visited++;
    try {
      const recipe = await readRecipe(fetchText, site, url);
      cache[url] = { at: now, recipe };
      if (recipe) { out.push(recipe); fresh++; }
    } catch (e) {
      cache[url] = { at: now - (REFRESH_DAYS - 3) * 864e5, recipe: hit?.recipe ?? null };   // try again in a few days
      if (hit?.recipe) out.push(hit.recipe);
    }
  }
  log(`${site.name.padEnd(26)} ${String(maps).padStart(3)} sitemaps, ${String(pages.size).padStart(4)} candidate pages, ${String(visited).padStart(4)} visited, ${String(out.length).padStart(4)} banana recipes (${fresh} new)`);
  return out;
}

// Sites stuff catch-all keywords into every recipe, so a banana bread can arrive tagged "dinner".
// Final say from the name: lunch/dinner only for savoury dishes, and baking is never a main meal.
const SAVOURY = /\b(chicken|pork|beef|fish|shrimp|prawn|curry|stew|soup|salad|sandwich|taco|rice|mofongo|tostones?|maduros?|plantains?|salsa|chutney|ketchup|matoke|pastel[oó]n|burger|pizza|bacon|ham|turkey|lamb|chili|quesadilla|wrap|tagine|sauce|side)\b/i;
const BAKE = /\b(bread|cake|muffins?|cookies?|brownies?|blondies?|pancakes?|waffles?|pie|pudding|loaf|scones?|cupcakes?|cheesecake|bars?|smoothie|shake|ice cream|split|foster|crumble|cobbler|tart|fudge|oats?|oatmeal|granola)\b/i;
function tidyMeals(r) {
  r = { ...r, n: r.n.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim() };   // drop "[Video+Recipe]" and similar
  const meals = new Set(r.meals);
  const savoury = SAVOURY.test(r.n) && !/\b(bread|cake|muffin|pudding|pie)\b/i.test(r.n);
  if (!savoury || BAKE.test(r.n)) { meals.delete('lunch'); meals.delete('dinner'); }
  if (savoury && !BAKE.test(r.n)) { meals.add('lunch'); meals.add('dinner'); meals.delete('dessert'); }
  if (!meals.size) meals.add(/smoothie|shake|lassi|drink/i.test(r.n) ? 'drink' : 'dessert');
  return { ...r, meals: [...meals] };
}

// `node scripts/crawl-recipes.mjs --tidy` re-applies the meal rules to web.json without crawling
if (process.argv[2] === '--tidy') {
  const f = new URL('../public/recipes/web.json', import.meta.url);
  const list = JSON.parse(await readFile(f, 'utf8')).map(tidyMeals);
  await writeFile(f, JSON.stringify(list));
  console.log(`Tidied ${list.length} recipes`);
  process.exit(0);
}

// ---------- main ----------
const cacheFile = new URL('./.recipe-crawl-cache.json', import.meta.url);
const outFile = new URL('../public/recipes/web.json', import.meta.url);
let cache = {};
try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch {}
const only = process.argv[2];   // optionally: node scripts/crawl-recipes.mjs bbcgoodfood
const sites = only ? SITES.filter(s => s.host.includes(only)) : SITES;
console.log(`Crawling ${sites.length} sites for banana recipes, politely (this takes a while)…`);
const results = (await Promise.all(sites.map(s => crawlSite(s, cache, console.log).catch(e => { console.log(`${s.name}: failed (${e.message})`); return []; })))).flat();

// merge with what other sites already found when crawling a single site
let all = results;
if (only) {
  try { const prev = JSON.parse(await readFile(outFile, 'utf8')); all = [...prev.filter(p => !sites.some(s => s.name === p.s)), ...results]; } catch {}
}
const byUrl = new Map(), byName = new Set();
for (const r of all) {
  const key = `${r.s}|${r.n.toLowerCase()}`;
  if (byUrl.has(r.u) || byName.has(key)) continue;
  byUrl.set(r.u, r); byName.add(key);
}
const list = [...byUrl.values()].map(tidyMeals).sort((a, b) => (b.c || 0) - (a.c || 0) || a.n.localeCompare(b.n));
await mkdir(new URL('../public/recipes/', import.meta.url), { recursive: true });
await writeFile(outFile, JSON.stringify(list));
await writeFile(cacheFile, JSON.stringify(cache));
console.log(`\nSaved ${list.length} banana recipes from ${new Set(list.map(r => r.s)).size} sites to public/recipes/web.json`);
