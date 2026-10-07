// Small SVG charts for the market page: line (with crosshair + tooltip), sparkline, bars.
// Colours come from CSS variables so light and dark mode both work.

export type Pt = { x: number; y: number };
let uid = 0;

function niceTicks(min: number, max: number, n = 4) {
  const raw = (max - min) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw)), e = raw / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeTicks(x0: number, x1: number, width: number) {
  const a = new Date(x0), b = new Date(x1), out: { x: number; label: string }[] = [];
  const years = (x1 - x0) / (365.25 * 864e5), maxTicks = Math.max(2, Math.floor(width / 70));
  if (years > 1.6) {
    const step = [1, 2, 5, 10, 20, 50].find(n => years / n <= maxTicks) ?? 50;
    for (let y = a.getUTCFullYear() + 1; y <= b.getUTCFullYear(); y++)
      if (y % step === 0) out.push({ x: Date.UTC(y, 0, 1), label: String(y) });
  } else {
    const months = Math.max(1, Math.ceil((years * 12) / maxTicks));
    const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
    for (; d.getTime() <= x1; d.setUTCMonth(d.getUTCMonth() + 1))
      if (d.getUTCMonth() % months === 0)
        out.push({ x: d.getTime(), label: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : MONTHS[d.getUTCMonth()] });
  }
  return out;
}

type LineOpts = {
  height?: number;
  fmt: (v: number) => string;        // tooltip value
  axisFmt?: (v: number) => string;   // y-axis labels
  dateFmt: (x: number) => string;    // tooltip date
  label?: string;                    // accessible name
  color?: string;                    // CSS colour for line and fill (default var(--series))
  baseline?: boolean;                // dashed line at the first value
};

export function lineChart(el: HTMLElement, initial: Pt[], opts: LineOpts) {
  let pts = initial, o = opts;
  const id = `g${uid++}`;
  el.classList.add('chart');
  el.innerHTML = '';
  const svgWrap = document.createElement('div');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  el.append(svgWrap, tip);

  let X = (x: number) => x, Y = (y: number) => y, W = 0, H = 0;
  const m = { t: 10, r: 52, b: 26, l: 2 };

  function draw() {
    W = el.clientWidth; H = o.height ?? 260;
    if (!W || pts.length < 2) return;
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    const ys = pts.map(p => p.y);
    const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
    const ticks = niceTicks(lo - pad, hi + pad, H < 200 ? 3 : 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    X = x => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
    Y = y => m.t + (1 - (y - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    const area = `${line}L${X(x1).toFixed(1)},${H - m.b}L${X(x0).toFixed(1)},${H - m.b}Z`;
    const af = o.axisFmt ?? o.fmt, c = o.color ?? 'var(--series)';
    svgWrap.innerHTML = `
      <svg width="${W}" height="${H}" role="img" aria-label="${o.label ?? 'Line chart'}">
        <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${c}" stop-opacity=".18"/><stop offset="1" stop-color="${c}" stop-opacity="0"/>
        </linearGradient></defs>
        ${ticks.map(t => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/>
          <text class="axis" x="${W - m.r + 8}" y="${Y(t) + 4}">${af(t)}</text>`).join('')}
        ${timeTicks(x0, x1, W - m.r).map(t => `<text class="axis" x="${X(t.x)}" y="${H - 6}" text-anchor="middle">${t.label}</text>`).join('')}
        <path d="${area}" fill="url(#${id})"/>
        ${o.baseline ? `<line class="base" x1="${m.l}" x2="${W - m.r}" y1="${Y(pts[0].y)}" y2="${Y(pts[0].y)}"/>` : ''}
        <path d="${line}" class="line" style="stroke:${c}"/>
        <g class="hover" visibility="hidden">
          <line class="cross" y1="${m.t}" y2="${H - m.b}"/>
          <circle r="4.5" class="dot" style="fill:${c}"/>
        </g>
        <rect class="hit" x="0" y="0" width="${W - m.r}" height="${H}" fill="transparent"/>
      </svg>`;
    const svg = svgWrap.querySelector('svg')!, hov = svg.querySelector('.hover') as SVGGElement;
    const cross = svg.querySelector('.cross')!, dot = svg.querySelector('.dot')!;
    const show = (clientX: number) => {
      const r = svg.getBoundingClientRect(), px = clientX - r.left;
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (X(pts[mid].x) < px) lo = mid; else hi = mid; }
      const p = Math.abs(X(pts[lo].x) - px) < Math.abs(X(pts[hi].x) - px) ? pts[lo] : pts[hi];
      const cx = X(p.x), cy = Y(p.y);
      cross.setAttribute('x1', String(cx)); cross.setAttribute('x2', String(cx));
      dot.setAttribute('cx', String(cx)); dot.setAttribute('cy', String(cy));
      hov.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${o.fmt(p.y)}</b><span>${o.dateFmt(p.x)}</span>`;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(cx - tw / 2, 0), W - tw)}px`;
      tip.style.top = `${Math.max(cy - 58, 0)}px`;
    };
    const hide = () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', e => show(e.clientX));
    svg.addEventListener('pointerdown', e => show(e.clientX));
    svg.addEventListener('pointerleave', hide);
  }
  new ResizeObserver(draw).observe(el);
  draw();
  return { update(next: Pt[], patch?: Partial<LineOpts>) { pts = next; if (patch) o = { ...o, ...patch }; draw(); } };
}

// color: optional CSS colour; by default green if the series ended higher than it started, else red
export function sparkline(values: number[], w = 92, h = 30, area = false, color?: string) {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values);
  const X = (i: number) => (i / (values.length - 1)) * (w - 4) + 2, Y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6);
  const c = color ?? `var(${values[values.length - 1] >= values[0] ? '--up' : '--down'})`;
  const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const fill = area ? `<polygon points="${X(0)},${h} ${pts.join(' ')} ${X(values.length - 1)},${h}" fill="${c}" opacity=".12"/>` : '';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${fill}<polyline fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"
    points="${pts.join(' ')}"/></svg>`;
}

export function barChart(el: HTMLElement, bars: { label: string; value: number; tip: string }[], height = 140) {
  el.classList.add('chart');
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  const draw = () => {
    const W = el.clientWidth, H = height, m = { t: 8, b: 22 };
    if (!W || !bars.length) return;
    const max = Math.max(1, ...bars.map(b => b.value)), slot = W / bars.length, bw = Math.max(4, slot - 2);
    const labelEvery = Math.ceil(bars.length / Math.max(2, Math.floor(W / 48)));
    el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Bar chart">
      <line class="grid" x1="0" x2="${W}" y1="${H - m.b}" y2="${H - m.b}"/>
      ${bars.map((b, i) => {
        const bh = (b.value / max) * (H - m.t - m.b), x = i * slot + (slot - bw) / 2, y = H - m.b - bh;
        const r = Math.min(4, bw / 2, bh);
        const d = bh > 0 ? `M${x},${H - m.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${H - m.b}Z` : '';
        return `<g class="bar" data-i="${i}"><rect x="${i * slot}" y="0" width="${slot}" height="${H}" fill="transparent"/>
          <path d="${d}"/>${i % labelEvery === (bars.length - 1) % labelEvery ? `<text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${b.label}</text>` : ''}</g>`;
      }).join('')}</svg>`;
    el.append(tip);
    el.querySelectorAll<SVGGElement>('.bar').forEach(g => {
      g.addEventListener('pointerenter', () => {
        const b = bars[+g.dataset.i!];
        el.querySelectorAll('.bar').forEach(o => o.classList.toggle('on', o === g));
        tip.hidden = false;
        tip.innerHTML = b.tip;
        const tw = tip.offsetWidth, cx = (+g.dataset.i! + 0.5) * slot;
        tip.style.left = `${Math.min(Math.max(cx - tw / 2, 0), W - tw)}px`;
        tip.style.top = '0px';
      });
    });
    el.querySelector('svg')!.addEventListener('pointerleave', () => { tip.hidden = true; el.querySelectorAll('.bar').forEach(o => o.classList.remove('on')); });
  };
  new ResizeObserver(draw).observe(el);
  draw();
}
