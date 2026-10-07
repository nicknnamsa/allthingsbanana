// Saves price history into the Worker bundle, as a fallback for when the Worker can't
// reach the IMF or the US BLS (the BLS limits how often shared server addresses may ask).
// Runs before every build; if a source can't be reached, the previous copy is kept.
import { writeFile } from 'node:fs/promises';
import { IMF_URL, parseImf, blsPrices } from '../worker/market.js';

async function save(name, fn, describe) {
  const file = new URL(`../worker/snapshot/${name}.json`, import.meta.url);
  try {
    const data = await fn();
    await writeFile(file, JSON.stringify(data));
    console.log(`snapshot ${name}: ${describe(data)}`);
  } catch (e) {
    console.warn(`snapshot ${name}: couldn't update (${e.message}); keeping the previous one`);
  }
}

await save('imf', async () => {
  const res = await fetch(IMF_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`IMF ${res.status}`);
  return parseImf(await res.json());
}, d => `${Object.keys(d).length} commodities, bananas to ${d.PBANSOP.points.at(-1)[0]}`);

await save('bls', () => blsPrices(process.env.BLS_API_KEY),
  d => `${Object.keys(d).length} shop prices, bananas to ${d.APU0000711211.points.at(-1)[0]}`);
