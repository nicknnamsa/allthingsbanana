// Builds the "where exactly do bananas grow" layer for Banana World from MapSPAM 2020
// (IFPRI): harvested area of bananas and plantains on a ~10 km grid, made by combining
// satellite land-cover maps with farm statistics.
//
//   1. Download spam2020V2r2_global_harvested_area.csv.zip from https://doi.org/10.7910/DVN/SWPENT
//      (Harvard Dataverse asks for a short form first)
//   2. node scripts/build-spam.mjs ~/Downloads/spam2020V2r2_global_harvested_area.csv.zip
//
// Output:
//   public/world/spam-bananas.bin   cells merged to a 10′ (~20 km) grid, as four Uint16 arrays:
//                                   longitude index, latitude index (1/6° steps), banana ha, plantain ha
//   src/data/world/hotspots.json    the densest growing areas, spread around the world
// Data: IFPRI, MapSPAM 2020 v2.0 r2, CC BY 4.0.
import { createReadStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const zip = process.argv[2];
if (!zip) { console.error('Usage: node scripts/build-spam.mjs <path to spam2020V2r2_global_harvested_area.csv.zip>'); process.exit(1); }
const dir = join(tmpdir(), 'atb-spam');
execFileSync('unzip', ['-o', '-q', zip, '*_H_TA.csv', '-d', dir]);   // TA = all farming systems combined
const csv = execFileSync('find', [dir, '-name', '*_H_TA.csv']).toString().trim().split('\n')[0];

const STEP = 6;                    // grid cells per degree in the output (10 arc-minutes)
const merged = new Map();          // "lonIdx,latIdx" -> [banana ha, plantain ha]
const fine = [];                   // full-resolution cells, for picking hotspots
let header = null, ix, iy, ib, ip, i0, i1;
const rl = createInterface({ input: createReadStream(csv, { encoding: 'utf8' }) });
for await (const line of rl) {
  const f = line.split(',');
  if (!header) { header = f; [ix, iy, ib, ip, i0, i1] = ['x', 'y', 'bana', 'plnt', 'ADM0_NAME', 'ADM1_NAME'].map(k => f.indexOf(k)); continue; }
  const b = +f[ib] || 0, p = +f[ip] || 0;
  if (b <= 0 && p <= 0) continue;
  const lon = +f[ix], lat = +f[iy];
  const key = `${Math.floor((lon + 180) * STEP)},${Math.floor((lat + 90) * STEP)}`;
  const m = merged.get(key) || [0, 0];
  m[0] += b; m[1] += p;
  merged.set(key, m);
  fine.push([lon, lat, b, p, f[i0], f[i1]]);
}

// pack as binary
const n = merged.size, buf = new Uint16Array(n * 4);
let k = 0, totB = 0, totP = 0;
for (const [key, [b, p]] of merged) {
  const [x, y] = key.split(',').map(Number);
  buf[k] = x; buf[n + k] = y; buf[2 * n + k] = Math.min(65535, Math.round(b)); buf[3 * n + k] = Math.min(65535, Math.round(p));
  totB += b; totP += p; k++;
}
await mkdir(new URL('../public/world/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/world/spam-bananas.bin', import.meta.url), Buffer.from(buf.buffer));

// tidy a few region names as MapSPAM spells them
const NAMES = { 'Extre - Nord': 'Extrême-Nord', 'West/Iburengerazuba': 'Western Province', 'SNNPR': 'Southern Nations (SNNPR)',
  'Region IV (Southern Tagalog)': 'Southern Tagalog', 'Cordillera Administrative region (CAR)': 'Cordillera', 'Cote dIvoire': "Côte d'Ivoire" };
const nice = s => NAMES[s] ?? s;
// hotspots: the densest cells, at least 4° apart, so they cover different regions
function pick(idx, count) {
  const out = [];
  for (const c of [...fine].sort((a, b) => b[idx] - a[idx])) {
    if (out.length >= count) break;
    if (out.some(o => Math.hypot(o.lon - c[0], o.lat - c[1]) < 4)) continue;
    out.push({ lon: +c[0].toFixed(3), lat: +c[1].toFixed(3), ha: Math.round(c[idx]), country: nice(c[4]), region: nice(c[5]) });
  }
  return out;
}
const hotspots = { bananas: pick(2, 10), plantains: pick(3, 6) };
await writeFile(new URL('../src/data/world/hotspots.json', import.meta.url), JSON.stringify(hotspots, null, 1));
console.log(`${fine.length} cells → ${n} merged cells (${(buf.byteLength / 1024).toFixed(0)} KB). Bananas ${(totB / 1e6).toFixed(2)}m ha, plantains ${(totP / 1e6).toFixed(2)}m ha.`);
console.log('Banana hotspots:', hotspots.bananas.map(h => `${h.region}, ${h.country}`).join(' · '));
console.log('Plantain hotspots:', hotspots.plantains.map(h => `${h.region}, ${h.country}`).join(' · '));
