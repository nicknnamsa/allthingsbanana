// Shared data loading and formatting for every page (header ticker, search, home, markets).
import type { Pt } from './charts';

export type Item = { id: string; type: 'news' | 'video'; title: string; url: string; source: string; published: number; thumb?: string };
export type Stock = { symbol: string; name: string; price: number; change: number; changePct: number; time: number };
export type Feed = { items: Item[]; stocks: Stock[]; updated: number };
export type Series = { code: string; name: string; desc: string; cur: string; per: string; dec: number; source: string; points: [string, number][] };
export type Market = { commodities?: Record<string, Series>; retail?: Record<string, Series>; history?: Record<string, [string, number][]>; updated: number };
export type Sel = Series & { pts: Pt[]; daily: boolean; kind: 'World price' | 'US shop price' | 'Stock' };

export const STOCK_NAMES: Record<string, string> = { DOLE: 'Dole plc', FDP: 'Fresh Del Monte Produce' };
export const COMMODITY_ORDER = ['PBANSOP', 'PORANG', 'PAPPLE', 'PCOCO', 'PCOFFOTM', 'PSUGAISA', 'PTEA', 'PRICENPQ'];
export const YEAR = 365.25 * 864e5;

// One request per page load, shared by everything on the page. The last answer is kept in
// sessionStorage for a few minutes so the next page you open can show it straight away.
function cached<T>(key: string, maxAge: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < maxAge) return Promise.resolve(hit.data as T);
  } catch {}
  return load().then(data => {
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  });
}
let marketP: Promise<Market> | null = null;
export const getMarket = () => (marketP ??= cached('atb-market', 10 * 60e3, () => fetch('/api/market').then(r => r.json())));
let feedP: Promise<Feed> | null = null;
export const getFeed = (fresh = false) =>
  fresh || !feedP
    ? (feedP = cached('atb-feed', fresh ? 0 : 2 * 60e3, () => fetch('/api/feed', { cache: 'no-store' }).then(r => r.json())))
    : feedP;

export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const num = (v: number, d: number) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = (s: { cur: string; dec: number }, v: number, d = s.dec) => (s.cur === '¢' ? `${num(v, d)}¢` : `${s.cur}${num(v, d)}`);
export const signed = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), d)}`;
export const pctHtml = (v: number | null, d = 2) =>
  v == null || !isFinite(v) ? '<span class="muted">—</span>' : `<span class="${v >= 0 ? 'up' : 'down'}">${signed(v, d)}%</span>`;
export const monthTs = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d || 1); };
export const fmtDate = (x: number, daily = false) =>
  new Date(x).toLocaleDateString('en-GB', { ...(daily ? { day: 'numeric' } : {}), month: daily ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' });
export const shortDate = (x: number) => new Date(x).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const monthOnly = (x: number) => new Date(x).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
export function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const toPts = (s: Series) => s.points.map(([k, v]) => ({ x: monthTs(k), y: v }));
export function at(pts: Pt[], x: number) {   // last value on or before x
  if (!pts.length || x < pts[0].x) return null;
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].x <= x) lo = m; else hi = m - 1; }
  return pts[lo];
}
// % change over a period, looked up by date (some months are missing from the data)
export function change(pts: Pt[], back: number) {
  const last = pts[pts.length - 1], then = at(pts, last.x - back + 864e5 * 3);
  return then && then !== last ? ((last.y - then.y) / then.y) * 100 : null;
}
export const lastChange = (pts: Pt[]) => (pts.length > 1 ? ((pts[pts.length - 1].y - pts[pts.length - 2].y) / pts[pts.length - 2].y) * 100 : null);
export const lastYear = (pts: Pt[]) => pts.filter(p => p.x > pts[pts.length - 1].x - YEAR + 864e5 * 3);
export const sliceYears = (pts: Pt[], y: number) => (y ? pts.filter(p => p.x >= pts[pts.length - 1].x - y * YEAR) : pts);

export function lookup(market: Market | null, code: string): Sel | null {
  const c = market?.commodities?.[code];
  if (c) return { ...c, pts: toPts(c), daily: false, kind: 'World price' };
  const r = market?.retail?.[code];
  if (r) return { ...r, pts: toPts(r), daily: false, kind: 'US shop price' };
  const h = market?.history?.[code];
  if (h?.length) return {
    code, name: STOCK_NAMES[code] || code, desc: 'Daily closing price, NYSE', cur: '$', per: 'share', dec: 2,
    source: 'Alpha Vantage', points: h, pts: h.map(([d, v]) => ({ x: monthTs(d), y: v })), daily: true, kind: 'Stock',
  };
  return null;
}
// every chartable series, bananas first
export function allSeries(market: Market | null) {
  const com = Object.keys(market?.commodities || {}).sort((a, b) => COMMODITY_ORDER.indexOf(a) - COMMODITY_ORDER.indexOf(b));
  return [...com, ...Object.keys(market?.retail || {}), ...Object.keys(market?.history || {})]
    .map(c => lookup(market, c)).filter(Boolean) as Sel[];
}
export const label = (s: Sel) => (s.kind === 'US shop price' ? `${s.name}, US shops` : s.name);
export const tickerCode = (s: Sel) =>
  s.kind === 'Stock' ? s.code : s.kind === 'US shop price' ? `US:${s.name.split(' ').pop()!.slice(0, 6).toUpperCase()}` : s.name.slice(0, 6).toUpperCase();
export const marketLink = (code: string) => `/bananalytics/#${code}`;
