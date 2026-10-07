// News helpers shared by the home page and the Latest News page.
import { lookup, lastChange, pctHtml, marketLink, esc, ago, type Market, type Item } from './market';

// stories about trade, prices and the industry
export const BUSINESS = /\b(price|prices|market|markets|export|exports|import|imports|supply|industry|tariffs?|fairtrade|growers?|farms?|farmers|crops?|disease|shipments?|trade|retailers?|supermarkets?|sales|investors?|company|deal|workers?|unions?|plantations?)\b/i;

// price chips under headlines that mention something we have data for
const CHIPS: [RegExp, string][] = [
  [/\bdole\b/i, 'DOLE'], [/del monte/i, 'FDP'],
  [/\b(price|prices|priced|cost|costs|cheap|cheaper|expensive|tariffs?|inflation)\b/i, 'PBANSOP'],
  [/cocoa|chocolate/i, 'PCOCO'], [/coffee/i, 'PCOFFOTM'], [/sugar/i, 'PSUGAISA'], [/orange/i, 'PORANG'],
  [/strawberr/i, 'APU0000711415'], [/lemon/i, 'APU0000711412'], [/\bapples?\b/i, 'PAPPLE'], [/\brice\b/i, 'PRICENPQ'], [/\btea\b/i, 'PTEA'],
];
export function chips(market: Market | null, title: string) {
  const out: string[] = [];
  for (const [re, code] of CHIPS) {
    if (out.length === 2 || !re.test(title)) continue;
    const s = lookup(market, code);
    if (!s) continue;
    const name = s.code === 'PBANSOP' ? 'BANANAS' : s.kind === 'Stock' ? s.code : s.name.toUpperCase();
    out.push(`<a class="chip" href="${marketLink(code)}">${esc(name)} ${pctHtml(lastChange(s.pts))}</a>`);
  }
  return out.length ? `<div class="chips">${out.join('')}</div>` : '';
}

export const meta = (it: Item) =>
  `<div class="meta">${it.type === 'video' ? '<span class="vid">Video</span> · ' : ''}${esc(it.source)} · <time datetime="${new Date(it.published).toISOString()}">${ago(it.published)}</time></div>`;
export const link = (it: Item) => `<a class="hl" href="${esc(it.url)}" target="_blank" rel="noopener nofollow">${esc(it.title)}</a>`;
export const thumb = (it: Item, cls = 'thumb') =>
  it.thumb ? `<a class="${cls}" href="${esc(it.url)}" target="_blank" rel="noopener nofollow" tabindex="-1"><img src="${esc(it.thumb)}" alt="" loading="lazy"></a>` : '';

// stories per day for the last 7 days, for the "Banana buzz" chart
export function buzzDays(items: Item[]) {
  const days = [], today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const n = items.filter(it => it.published >= d.getTime() && it.published < d.getTime() + 864e5).length;
    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }), value: n,
      tip: `<b>${n} ${n === 1 ? 'story' : 'stories'}</b><span>${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`,
    });
  }
  return days;
}

// keep "3 h ago" labels current
export function tickTimes() {
  setInterval(() => document.querySelectorAll('time[datetime]').forEach(el => (el.textContent = ago(Date.parse(el.getAttribute('datetime')!)))), 30_000);
}
