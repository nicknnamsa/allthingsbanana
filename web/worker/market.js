// Market data for the homepage. Refreshed every few hours into KV.
//   commodities: IMF Primary Commodity Prices, monthly world prices (no key needed)
//   retail:      US BLS average shop prices in US cities, monthly (no key needed)
//   history:     daily closes for banana companies from Alpha Vantage (optional ALPHAVANTAGE_API_KEY)
import snapshot from './snapshot/imf.json' with { type: 'json' };

export const MARKET_EVERY_MS = 6 * 60 * 60 * 1000;
// bump when the stored shape changes, so old data is replaced straight away after a deploy
export const MARKET_VERSION = 2;
export const STOCKS = [
  { symbol: 'DOLE', name: 'Dole plc' },
  { symbol: 'FDP', name: 'Fresh Del Monte Produce' },
];

// cur: how the price is quoted; per: the unit it's quoted per; dec: decimals to show
export const COMMODITIES = {
  PBANSOP: { name: 'Bananas', desc: 'Global benchmark, imports into the US', cur: '$', per: 'tonne', dec: 2 },
  PORANG: { name: 'Oranges', desc: 'Global, delivered to France', cur: '$', per: 'lb', dec: 3 },
  PAPPLE: { name: 'Apples', desc: 'Non-citrus fruit, Europe', cur: '€', per: 'kg', dec: 2 },
  PCOCO: { name: 'Cocoa', desc: 'ICCO average', cur: '$', per: 'tonne', dec: 0 },
  PCOFFOTM: { name: 'Coffee', desc: 'Other mild Arabica', cur: '¢', per: 'lb', dec: 1 },
  PSUGAISA: { name: 'Sugar', desc: 'No. 11, world', cur: '¢', per: 'lb', dec: 2 },
  PTEA: { name: 'Tea', desc: 'Kenyan, Mombasa auction', cur: '¢', per: 'kg', dec: 1 },
  PRICENPQ: { name: 'Rice', desc: 'Thai 5% broken', cur: '$', per: 'tonne', dec: 0 },
};
export const RETAIL = {
  APU0000711211: { name: 'Bananas', cur: '$', per: 'lb', dec: 3 },
  APU0000711311: { name: 'Navel oranges', cur: '$', per: 'lb', dec: 3 },
  APU0000711412: { name: 'Lemons', cur: '$', per: 'lb', dec: 3 },
  APU0000711411: { name: 'Grapefruit', cur: '$', per: 'lb', dec: 3 },
  APU0000711415: { name: 'Strawberries', cur: '$', per: '12 oz', dec: 3 },
};

const UA = { 'user-agent': 'AllThingsBanana/1.0 (+https://allthingsbanana.com)' };

export async function refreshMarket(env, old = {}) {
  const out = { ...(old?.v === MARKET_VERSION ? old : {}), v: MARKET_VERSION, errors: {} };
  const tryRun = async (name, fn) => {
    try { out[name] = await fn(); } catch (e) { out.errors[name] = String(e).slice(0, 200); }
  };
  await Promise.all([
    tryRun('commodities', imfPrices),
    tryRun('retail', blsPrices),
    env.ALPHAVANTAGE_API_KEY && tryRun('history', () => stockHistory(env.ALPHAVANTAGE_API_KEY)),
  ]);
  out.updated = Date.now();
  return out;
}

export const IMF_URL = `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.${Object.keys(COMMODITIES).join('+')}.USD.M?startPeriod=1990`;

export function parseImf(d) {
  const dims = d.structure.dimensions;
  const times = dims.observation[0].values.map(v => v.id);   // "2026-M09"
  const pos = dims.series.findIndex(x => x.id === 'INDICATOR');
  const codes = dims.series[pos].values.map(v => v.id);
  const out = {};
  for (const [key, s] of Object.entries(d.dataSets[0].series)) {
    const code = codes[+key.split(':')[pos]];
    if (!COMMODITIES[code]) continue;
    const points = Object.entries(s.observations)
      .filter(([, v]) => v[0] != null)
      .map(([k, v]) => [times[+k].replace('-M', '-'), Math.round(parseFloat(v[0]) * 1000) / 1000])
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (points.length) out[code] = { code, ...COMMODITIES[code], source: 'IMF Primary Commodity Prices', points };
  }
  if (!out.PBANSOP) throw new Error('IMF: no banana data');
  return out;
}

// The IMF server's certificate chain isn't trusted by every runtime, so if the live
// fetch fails we fall back to the snapshot taken at build time (scripts/snapshot.mjs).
async function imfPrices() {
  try {
    const res = await fetch(IMF_URL, { headers: { ...UA, accept: 'application/json' } });
    if (!res.ok) throw new Error(`IMF ${res.status}`);
    return parseImf(await res.json());
  } catch (e) {
    if (snapshot?.PBANSOP) return snapshot;
    throw e;
  }
}

async function blsPrices() {
  // without a key, BLS returns at most 10 years per request (but many series at once)
  const now = new Date().getUTCFullYear(), spans = [];
  for (let y = 1995; y <= now; y += 10) spans.push([y, Math.min(y + 9, now)]);
  const out = {};
  for (const [a, b] of spans) {
    const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
      method: 'POST',
      headers: { ...UA, 'content-type': 'application/json' },
      body: JSON.stringify({ seriesid: Object.keys(RETAIL), startyear: String(a), endyear: String(b) }),
    });
    const d = await res.json();
    if (d.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${d.status} ${d.message}`);
    for (const s of d.Results.series) {
      const pts = (out[s.seriesID] ||= []);
      for (const p of s.data) {
        if (!/^M(0[1-9]|1[0-2])$/.test(p.period) || isNaN(parseFloat(p.value))) continue;   // '-' = no data that month
        pts.push([`${p.year}-${p.period.slice(1)}`, parseFloat(p.value)]);
      }
    }
  }
  const result = {};
  for (const [code, pts] of Object.entries(out)) {
    if (!pts.length) continue;
    pts.sort((a, b) => a[0].localeCompare(b[0]));
    result[code] = { code, ...RETAIL[code], desc: 'Average shop price in US cities', source: 'US Bureau of Labor Statistics', points: pts };
  }
  if (!result.APU0000711211) throw new Error('BLS: no banana data');
  return result;
}

async function stockHistory(key) {
  const out = {};
  for (const { symbol } of STOCKS) {
    const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${key}`);
    const d = await res.json();
    const ts = d['Time Series (Daily)'];
    if (!ts) throw new Error(`Alpha Vantage ${symbol}: ${d.Note || d.Information || d['Error Message'] || 'no data'}`);
    out[symbol] = Object.entries(ts)
      .map(([day, v]) => [day, parseFloat(v['4. close'])])
      .sort((a, b) => a[0].localeCompare(b[0]));
  }
  return out;
}
