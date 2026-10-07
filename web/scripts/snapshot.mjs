// Saves the IMF commodity price history into the Worker bundle, as a fallback for
// when the Worker can't reach the IMF directly. Runs before every build.
import { writeFile } from 'node:fs/promises';
import { IMF_URL, parseImf } from '../worker/market.js';

const file = new URL('../worker/snapshot/imf.json', import.meta.url);
try {
  const res = await fetch(IMF_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`IMF ${res.status}`);
  const data = parseImf(await res.json());
  await writeFile(file, JSON.stringify(data));
  console.log(`snapshot: ${Object.keys(data).length} commodities, bananas to ${data.PBANSOP.points.at(-1)[0]}`);
} catch (e) {
  console.warn(`snapshot: couldn't update (${e.message}); keeping the previous one`);
}
