// Builds src/data/world/fao-bananas.json from FAOSTAT (the UN Food and Agriculture Organization):
// area harvested, yield and production of bananas and of plantains, for every country, 1961 onwards.
//
//   npm run build-fao        (downloads ~34 MB, reads a 545 MB CSV; FAO updates it about once a year)
//
// FAOSTAT data: © FAO, licensed CC BY 4.0. Credited on the map page.
import { createReadStream, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ZIP = 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip';
const dir = join(tmpdir(), 'atb-fao');
const zip = join(dir, 'qcl.zip');
const csv = join(dir, 'Production_Crops_Livestock_E_All_Data_(Normalized).csv');
const ITEMS = { 486: 'banana', 489: 'plantain' };            // Bananas; Plantains and cooking bananas
const ELEMENTS = { 5312: 'area', 5412: 'yield', 5510: 'prod' };  // ha; kg/ha; tonnes

await mkdir(dir, { recursive: true });
if (!existsSync(csv)) {
  console.log('Downloading FAOSTAT crops data…');
  const res = await fetch(URL_ZIP);
  if (!res.ok) throw new Error(`FAOSTAT download failed: ${res.status}`);
  await writeFile(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
}

// a tiny CSV line parser (FAOSTAT quotes every field)
const parse = line => { const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out; };

const countries = {}, world = {};
let minYear = 9999, maxYear = 0;
const rl = createInterface({ input: createReadStream(csv, { encoding: 'utf8' }) });
let header = null;
for await (const line of rl) {
  const f = parse(line);
  if (!header) { header = Object.fromEntries(f.map((h, i) => [h, i])); continue; }
  const item = ITEMS[f[header['Item Code']]], el = ELEMENTS[f[header['Element Code']]];
  if (!item || !el || f[header['Value']] === '') continue;
  const code = +f[header['Area Code']], m49 = f[header['Area Code (M49)']].replace(/^'/, ''), year = +f[header['Year']];
  let v = +f[header['Value']];
  if (el === 'yield') v = Math.round(v / 100) / 10;            // kg/ha → t/ha, one decimal
  else v = Math.round(v);
  minYear = Math.min(minYear, year); maxYear = Math.max(maxYear, year);
  // FAO area codes above 5000 are regions; 351 is "China" (mainland + Taiwan etc.), which would double count
  const target = code === 5000 ? world : code < 5000 && code !== 351 ? (countries[m49] ||= { name: f[header['Area']] }) : null;
  if (!target) continue;
  ((target[item] ||= {})[el] ||= {})[year] = v;
}

// store each series as an array aligned to `years` (null where FAO has no figure)
const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
const pack = s => { const o = {}; for (const [k, byYear] of Object.entries(s)) o[k] = years.map(y => byYear[y] ?? null); return o; };
const out = { source: 'FAOSTAT, Crops and livestock products (QCL)', updated: new Date().toISOString().slice(0, 10), years, world: {}, countries: {} };
for (const [k, s] of Object.entries(world)) out.world[k] = pack(s);
for (const [m49, c] of Object.entries(countries)) {
  if (!c.banana && !c.plantain) continue;
  out.countries[m49] = { name: c.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() };
  for (const k of ['banana', 'plantain']) if (c[k]) out.countries[m49][k] = pack(c[k]);
}
await mkdir(new URL('../src/data/world/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/world/fao-bananas.json', import.meta.url), JSON.stringify(out));
const last = years.length - 1;
console.log(`Saved ${Object.keys(out.countries).length} countries, ${minYear}–${maxYear}. World ${maxYear}: bananas ${(out.world.banana.prod[last] / 1e6).toFixed(1)} Mt, plantains ${(out.world.plantain.prod[last] / 1e6).toFixed(1)} Mt.`);
