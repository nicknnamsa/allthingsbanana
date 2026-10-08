// Builds the data for Bananadle from live Wikipedia (takes about a minute):
//   public/games/banana-links-in.json   every article that links to Banana (one step from winning; used for
//                                       hints and the "this page links to Banana" badge)
//   src/data/games/degrees.json         the daily start pages, in the order they're played
//
//   npm run build-degrees
//
// Par is a flat 4 for every puzzle (like a golf hole), so nothing here has to work out shortest routes.
// Wikipedia text and titles: CC BY-SA 4.0. Credited on the game page.
import { writeFile, mkdir } from 'node:fs/promises';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'AllThingsBananaBot/1.0 (https://allthingsbanana.com/about/; Bananadle)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TARGET = 'Banana';

// The daily start pages, in play order: puzzle #1 (7 October 2026) is the first, #2 the second, and so on.
// Add new ones at the end; when the list runs out it starts again from the top.
const STARTS = [
  'Pizza', 'Bitcoin', 'Wolfgang Amadeus Mozart', 'Dracula', 'Eiffel Tower', 'Queen Victoria', 'Antarctica', 'Mount Everest',
  'Iceland', 'Frida Kahlo', 'Beyoncé', 'Titanic', 'Tennis', 'Volcano', 'Lionel Messi', 'Basketball', 'Lego', 'Harry Potter',
  'Star Wars', 'Chess', 'Penguin', 'Vikings', 'Coffee', 'William Shakespeare', 'Sherlock Holmes', 'Moon', 'Minecraft',
  'Jupiter', 'Olympic Games', 'The Simpsons', 'Pikachu', 'Dinosaur', 'Cleopatra', 'Isaac Newton', 'Albert Einstein',
  'Leonardo da Vinci', 'Tyrannosaurus', 'The Beatles', 'Napoleon', 'Ancient Egypt', 'Tokyo', 'George W. Bush',
  'Charles Darwin', 'Shark', 'Michael Jackson', 'Taylor Swift', 'Sushi', 'Super Mario', 'Mars', 'Rome', 'Winston Churchill',
  'Elvis Presley', 'Honey bee', 'Great Wall of China', 'Football', 'Mona Lisa', 'Julius Caesar', 'Elon Musk',
  'Marilyn Monroe', 'Barack Obama',
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

// the real title of each start page (following redirects like "Shakespeare" → "William Shakespeare"), 50 at a time
async function canonical(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const d = await api({ action: 'query', titles: batch.join('|'), redirects: '1' });
    const to = new Map([...(d.query?.normalized || []), ...(d.query?.redirects || [])].map(r => [r.from, r.to]));
    for (const t of batch) {
      let x = t;
      for (let n = 0; n < 5 && to.has(x); n++) x = to.get(x);
      const p = (d.query?.pages || []).find(p => p.title === x);
      if (p && !p.missing) out.set(t, x);
    }
    await sleep(150);
  }
  return out;
}

console.log('Reading the articles that link to Banana…');
const into = await linksIn(TARGET);
console.log(`${into.size} articles link to Banana.`);

const real = await canonical(STARTS);
const starts = [];
for (const s of STARTS) {
  if (!real.has(s)) { console.log('  not on Wikipedia, skipped:', s); continue; }
  starts.push({ title: real.get(s) });
}

await mkdir(new URL('../public/games/', import.meta.url), { recursive: true });
await mkdir(new URL('../src/data/games/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/games/banana-links-in.json', import.meta.url), JSON.stringify([...into].sort()));
await writeFile(new URL('../src/data/games/degrees.json', import.meta.url),
  JSON.stringify({ built: new Date().toISOString().slice(0, 10), linksIn: into.size, starts }, null, 1));
console.log(`Saved ${starts.length} start pages. First up: ${starts.slice(0, 4).map(s => s.title).join(', ')}…`);
