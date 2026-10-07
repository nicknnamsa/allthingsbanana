// Builds the data for Bananadle from live Wikipedia:
//   public/games/banana-links-in.json   every article that links to Banana (one step from winning; used for hints)
//   src/data/games/degrees.json         the daily start pages, each with its par (fewest steps) and a shortest route
//
//   npm run build-degrees
//
// Rule of the game: you may only move to an article that the current article links to.
// Wikipedia text and titles: CC BY-SA 4.0. Credited on the game page.
import { writeFile, mkdir } from 'node:fs/promises';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'AllThingsBananaBot/1.0 (https://allthingsbanana.com/about/; Bananadle)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TARGET = 'Banana';

// Start pages: well-known articles from all walks of life. Add more any time; the daily order
// is shuffled once so neighbouring days differ.
const STARTS = [
  'George W. Bush', 'Albert Einstein', 'Taylor Swift', 'Tyrannosaurus', 'The Beatles', 'Moon', 'Leonardo da Vinci', 'Football',
  'Napoleon', 'Pikachu', 'Mount Everest', 'Shakespeare', 'Elon Musk', 'Titanic', 'Cleopatra', 'Minecraft', 'Eiffel Tower',
  'Barack Obama', 'Penguin', 'Harry Potter', 'Volcano', 'Michael Jackson', 'Olympic Games', 'Pizza', 'Tokyo', 'Bitcoin',
  'Queen Victoria', 'Sherlock Holmes', 'Great Wall of China', 'Jupiter', 'Mozart', 'Lionel Messi', 'Coffee', 'Vikings',
  'Star Wars', 'Charles Darwin', 'Ancient Egypt', 'Basketball', 'Shark', 'Marilyn Monroe', 'Chess', 'Mars', 'The Simpsons',
  'Julius Caesar', 'Iceland', 'Beyoncé', 'Dinosaur', 'Isaac Newton', 'Super Mario', 'Antarctica', 'Elvis Presley',
  'Mona Lisa', 'Frida Kahlo', 'Lego', 'Honey bee', 'Winston Churchill', 'Sushi', 'Tennis', 'Rome', 'Dracula',
];

async function api(params) {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let t = 0; ; t++) {
    try {
      const res = await fetch(`${API}?${q}`, { headers: UA });
      if (res.ok) return await res.json();
      throw new Error(res.status);
    } catch (e) { if (t > 3) throw e; await sleep(2000 * (t + 1)); }
  }
}

// the articles a page links to, with redirects followed to the real article
async function linksOf(title) {
  const out = new Set();
  let cont = {};
  do {
    const d = await api({ action: 'query', generator: 'links', titles: title, gplnamespace: '0', gpllimit: 'max', redirects: '1', ...cont });
    for (const p of d.query?.pages || []) if (!p.missing && p.ns === 0) out.add(p.title);
    cont = d.continue || null;
    await sleep(150);
  } while (cont);
  return out;
}

// every article that links to Banana (directly, or through a redirect such as "Bananas")
async function linksIn(title) {
  const out = new Set();
  let cont = {};
  do {
    const d = await api({ action: 'query', list: 'backlinks', bltitle: title, blnamespace: '0', bllimit: 'max', blredirect: '1', ...cont });
    for (const b of d.query?.backlinks || []) {
      if (!b.redirect) out.add(b.title);
      for (const r of b.redirlinks || []) out.add(r.title);
    }
    cont = d.continue || null;
    await sleep(150);
  } while (cont);
  return out;
}

async function canonical(title) {
  const d = await api({ action: 'query', titles: title, redirects: '1' });
  const p = d.query?.pages?.[0];
  return p && !p.missing ? p.title : null;
}

console.log('Reading the articles that link to Banana…');
const into = await linksIn(TARGET);
console.log(`${into.size} articles link to Banana.`);

const starts = [];
for (const s of STARTS) {
  const title = await canonical(s);
  if (!title) { console.log('  not found:', s); continue; }
  const links = await linksOf(title);
  let par = null, route = null, routes = 0;
  if (links.has(TARGET)) { par = 1; route = [title, TARGET]; routes = 1; }
  else {
    const via = [...links].filter(x => into.has(x));
    if (via.length) { par = 2; routes = via.length; route = [title, via[(title.length * 7) % via.length], TARGET]; }
    else {
      // three steps: look through the pages this one links to for one that links to a Banana neighbour
      for (const x of [...links].slice(0, 200)) {
        const second = [...await linksOf(x)].filter(y => into.has(y));
        if (second.length) { par = 3; route = [title, x, second[0], TARGET]; routes = null; break; }
      }
    }
  }
  if (!par) { console.log('  no route within 3 steps:', title); continue; }
  starts.push({ title, par, route, routes, links: links.size });
  console.log(`  ${title}: par ${par} via ${route.slice(1, -1).join(' → ') || '(direct)'}${routes > 1 ? ` (${routes} two-step routes)` : ''}`);
}

// shuffle once with a fixed seed, so the daily order is stable between rebuilds of the same list
let seed = 20261008;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (let i = starts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [starts[i], starts[j]] = [starts[j], starts[i]]; }

await mkdir(new URL('../public/games/', import.meta.url), { recursive: true });
await mkdir(new URL('../src/data/games/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/games/banana-links-in.json', import.meta.url), JSON.stringify([...into].sort()));
await writeFile(new URL('../src/data/games/degrees.json', import.meta.url),
  JSON.stringify({ built: new Date().toISOString().slice(0, 10), linksIn: into.size, starts }, null, 1));
console.log(`Saved ${starts.length} start pages.`);
