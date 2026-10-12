// Bananadle: get from today's Wikipedia page to Banana by naming pages each one links to or mentions.
// One engine for every place the game appears (the home page and /bananadle/); progress is shared
// through localStorage, so a puzzle started on the home page carries on at /bananadle/.

type Start = { t: string };
type State = { day: number; start: string; path: string[]; misses: number; hints: number; secs: number; done: boolean; gaveUp: boolean; posted?: boolean };
type World = { played: number; solved: number; steps: Record<string, number>; secs: number; best: number | null };
type Record_ = Record<number, { steps: number; solved: boolean; par: number }>;

// par is the same for every puzzle, like a golf hole
const PAR = 4;
const golf = (n: number) => n === 1 ? 'Hole in one' : n === 2 ? 'Eagle' : n === 3 ? 'Birdie' : n === 4 ? 'Par' : n === 5 ? 'Bogey' : n === 6 ? 'Double bogey' : `${n - PAR} over par`;
const shareEmoji = (n: number) => n <= 1 ? '🎯' : n === 2 ? '🦅' : n === 3 ? '🐦' : n === 4 ? '🏆' : '🍌';
const TARGET = 'Banana';
const EPOCH = Date.UTC(2026, 9, 7);   // puzzle #1 (must match worker/degrees.js)
const W = 'https://en.wikipedia.org/w/api.php';
const QUIPS = ['', 'Bold, though.', 'Noted.', 'The banana remains unimpressed.', 'Worth a try.'];

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const wikiUrl = (t: string) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_'));
// compare titles loosely: case, accents, punctuation and underscores don't matter
const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\s]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// today's puzzle number, by the player's own calendar day
const now = new Date();
export const today = Math.max(1, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH) / 864e5) + 1);

// ---------- talking to Wikipedia ----------
async function api(params: Record<string, string>) {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const res = await fetch(`${W}?${q}`);
  if (!res.ok) throw new Error('Wikipedia ' + res.status);
  return res.json();
}

// everything an article links to: loose key -> real title (also under the names it was linked by)
const linkCache = new Map<string, Promise<Map<string, string>>>();
function linksOf(title: string) {
  if (!linkCache.has(title)) linkCache.set(title, (async () => {
    const m = new Map<string, string>();
    let cont: Record<string, string> | null = {};
    while (cont) {
      const d = await api({ action: 'query', generator: 'links', titles: title, gplnamespace: '0', gpllimit: 'max', redirects: '1', ...cont });
      for (const p of d.query?.pages || []) if (!p.missing) m.set(key(p.title), p.title);
      for (const r of d.query?.redirects || []) m.set(key(r.from), r.to);
      cont = d.continue || null;
    }
    return m;
  })().catch(e => { linkCache.delete(title); throw e; }));
  return linkCache.get(title)!;
}

// articles one step from Banana, for hints and the "links to Banana" note (built by scripts/build-degrees.mjs)
let intoBanana: Promise<Set<string>> | null = null;
const nearBanana = () => (intoBanana ??= fetch('/games/banana-links-in.json').then(r => r.json()).then((a: string[]) => new Set(a)));

async function summary(title: string) {
  try {
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
    if (!r.ok) return null;
    const d = await r.json();
    return { desc: d.description as string | undefined, extract: d.extract as string | undefined };
  } catch { return null; }
}

// edit distance where swapping two neighbouring letters ("napels") counts as one mistake
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

// the article's plain text, to check what it mentions (Wikipedia doesn't link very common things like England)
const textCache = new Map<string, Promise<string>>();
function textOf(title: string) {
  if (!textCache.has(title)) textCache.set(title, api({ action: 'query', prop: 'extracts', explaintext: '1', titles: title })
    .then(d => (d.query?.pages?.[0]?.extract as string) || '')
    .catch(e => { textCache.delete(title); throw e; }));
  return textCache.get(title)!;
}
// does the text name this article? One-word names must be capitalised ("England" counts, "water" doesn't),
// so ordinary words only count when they're actually linked
function mentions(text: string, names: string[]) {
  return names.some(n => {
    n = n.replace(/\s*\([^)]*\)$/, '').trim();
    if (n.length < 3) return false;
    const one = !/\s/.test(n);
    const word = one ? n[0].toUpperCase() + n.slice(1) : n;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, one ? 'gu' : 'giu');
    // a capital at the start of a sentence doesn't make a name ("Money is…"), so one-word names must appear mid-sentence
    for (const m of text.matchAll(re)) if (!one || !/(^|[.!?:;]\s*|\n\s*)$/.test(text.slice(Math.max(0, m.index! - 4), m.index))) return true;
    return false;
  });
}
// other names for an article (its redirects: "U.S." and "USA" for United States), so mentions by those count too
async function otherNames(title: string) {
  const d = await api({ action: 'query', titles: title, prop: 'redirects', rdnamespace: '0', rdlimit: 'max' });
  return ((d.query?.pages?.[0]?.redirects || []) as { title: string }[]).map(x => x.title);
}
// does the other page link back to this one?
async function linksBack(other: string, here: string) {
  const d = await api({ action: 'query', titles: other, prop: 'links', pltitles: here, redirects: '1' });
  return !!d.query?.pages?.[0]?.links?.length;
}
// the meanings of an ambiguous word that the current page links to or mentions: the articles listed on its
// disambiguation page, plus titles that only add a qualifier ("Mercury" -> "Mercury (planet)")
async function meaningsOf(g: string, real: string | null, ambiguous: boolean, links: Map<string, string>, from: string) {
  const k = key(g), linked = new Set(links.values()), out = new Set<string>();
  for (const t of linked) if (key(t.replace(/\s*\([^)]*\)$/, '')) === k) out.add(t);
  if (real && ambiguous) {
    const text = await textOf(from);
    // (a bare mention of "Greek" can't tell "Greek (play)" from "Greek (opera)", so those need a real link)
    const base = (t: string) => key(t.replace(/\s*\([^)]*\)$/, ''));
    for (const t of new Set((await linksOf(real)).values())) if (t !== TARGET && (linked.has(t) || (base(t) !== k && mentions(text, [t])))) out.add(t);
  }
  // drop options that are themselves "may refer to" pages; shortest (usually the main meaning) first
  const list = [...out].filter(t => !/\(disambiguation\)$/.test(t)).sort((a, b) => a.length - b.length).slice(0, 12);
  if (!list.length) return list;
  const d = await api({ action: 'query', titles: list.join('|'), prop: 'pageprops', ppprop: 'disambiguation' });
  const vague = new Set((d.query?.pages || []).filter((p: any) => p.pageprops?.disambiguation !== undefined).map((p: any) => p.title));
  return list.filter(t => !vague.has(t)).slice(0, 6);
}

// ---------- the game, mounted on a [data-bananadle] element ----------
export function mountBananadle(root: HTMLElement) {
  const variant = root.dataset.variant === 'page' ? 'page' : 'home';
  const q = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-bd="${name}"]`)!;
  const STARTS: Start[] = JSON.parse(q('starts').textContent || '[]');
  const dailyStart = STARTS[(today - 1) % STARTS.length];
  const input = q<HTMLInputElement>('input');

  let mode: 'daily' | 'practice' = 'daily';
  let start: Start = dailyStart;
  let s: State;
  let busy = false, running = false, shownTitle = '';
  const saveKey = () => `atb-deg-${today}`;
  const save = () => { if (mode === 'daily') store.set(saveKey(), s); };
  const current = () => s.path[s.path.length - 1];
  const steps = () => s.path.length - 1;
  const newState = (st: Start): State => ({ day: today, start: st.t, path: [st.t], misses: 0, hints: 0, secs: 0, done: false, gaveUp: false });

  function begin(m: 'daily' | 'practice') {
    mode = m;
    if (m === 'daily') {
      start = dailyStart;
      const saved = store.get<State | null>(saveKey(), null);
      s = saved && saved.start === start.t ? saved : newState(start);
    } else {
      const pool = STARTS.filter(x => x.t !== dailyStart.t && x.t !== s?.start);
      start = pool[Math.floor(Math.random() * pool.length)];
      s = newState(start);
    }
    const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    q('kick').textContent = m === 'daily' ? `Bananadle · ${date}` : 'Bananadle · practice crate';
    q('no').textContent = m === 'daily' ? `No. ${today}` : 'Practice';
    const modeBtn = root.querySelector<HTMLButtonElement>('[data-bd="modeBtn"]');
    if (modeBtn) modeBtn.textContent = m === 'daily' ? 'Practice round' : "Back to today's crate";
    q('feedback').innerHTML = '';
    q('hintBox').hidden = true;
    input.value = '';
    shownTitle = '';
    running = false;
    render();
    if (s.done) showDone(); else q('done').hidden = true;
  }

  function render() {
    const cur = current(), playing = !s.done;
    q('current').textContent = cur;
    q('where').textContent = s.path.length === 1 ? 'Start here' : "You're on";
    root.classList.toggle('is-done', s.done);
    // the route so far; tapping an earlier page rewinds to it
    q('path').innerHTML = s.path.map((t, i) => {
      const last = i === s.path.length - 1;
      return `<li>${last || s.done ? `<span class="${last ? 'here' : ''}">${esc(t)}</span>` : `<button type="button" data-i="${i}" title="Go back to ${esc(t)}">${esc(t)}</button>`}</li>`;
    }).join('') + (s.done ? '' : '<li class="goal"><span>Banana</span></li>');
    // the ripeness scale: one segment per step; par lands on perfect yellow
    const n = steps();
    q('scale').querySelectorAll('i').forEach((seg, i) => seg.classList.toggle('off', i >= Math.min(n, 7)));
    q('scale').setAttribute('aria-label', `${plural(n, 'step')} taken. Par is ${PAR}.`);
    q('stepsLine').textContent = s.done && !s.gaveUp ? `${plural(n, 'step')} · ${golf(n)}` : n === 0 ? 'Fresh off the boat' : plural(n, 'step');
    q('form').hidden = !playing;
    for (const name of ['hintBtn', 'giveUpBtn']) q(name).hidden = !playing;
    renderStats();
    if (cur !== shownTitle) {
      shownTitle = cur;
      q('desc').textContent = ''; q('extract').textContent = '';
      summary(cur).then(d => {
        if (shownTitle !== cur || !d) return;
        q('desc').textContent = d.desc ? d.desc[0].toUpperCase() + d.desc.slice(1) + '.' : '';
        // one sentence, as a reminder of what the page is about
        const ex = (d.extract || '').split(/(?<=\.)\s+/)[0] || '';
        q('extract').textContent = variant === 'page' ? (ex.length > 220 ? ex.slice(0, 217) + '…' : ex) : '';
      });
      if (playing) { linksOf(cur).catch(() => {}); textOf(cur).catch(() => {}); }   // start loading, so the first guess is quick
      // one step from winning? say so, so the last move isn't a blind guess
      q('warm').hidden = true;
      if (playing) nearBanana().then(set => { if (shownTitle === cur && !s.done) q('warm').hidden = !set.has(cur); }).catch(() => {});
    }
  }

  function renderStats() {
    const rec = store.get<Record_>('atb-deg-history', {});
    let streak = 0;
    for (let d = rec[today]?.solved ? today : today - 1; rec[d]?.solved; d--) streak++;
    q('stats').innerHTML = `Misses <b>${s.misses}</b> · <b data-bd="time">${fmtTime(s.secs)}</b> · Streak <b>${plural(streak, 'day')}</b>`;
    // the bigger record box, where the page has one
    const box = document.querySelector('[data-bd-record]');
    if (box) {
      const all = Object.values(rec);
      box.innerHTML = `<div><b>${streak}</b><span>day streak</span></div><div><b>${all.length}</b><span>played</span></div><div><b>${all.filter(h => h.solved && h.steps <= h.par).length}</b><span>at or under par</span></div>`;
    }
  }

  function say(html: string, kind: 'ok' | 'miss' | 'info' = 'info') {
    q('feedback').innerHTML = `<p class="msg ${kind}">${html}</p>`;
  }

  function move(to: string, how: 'link' | 'mention' | 'back' = 'link') {
    s.path.push(to);
    q('hintBox').hidden = true;
    if (to === TARGET) { s.done = true; save(); render(); finish(); return; }
    save(); render();
    const prev = esc(s.path[s.path.length - 2]), here = esc(to);
    say(how === 'mention' ? `✓ <b>${prev}</b> mentions <b>${here}</b>.` : how === 'back' ? `✓ <b>${here}</b> links to <b>${prev}</b>.` : `✓ <b>${prev}</b> links to <b>${here}</b>.`, 'ok');
  }

  // going back to an earlier page undoes the steps after it
  function rewind(i: number) {
    if (s.done || i >= s.path.length - 1) return;
    s.path = s.path.slice(0, i + 1);
    q('hintBox').hidden = true;
    save(); render();
    say(`↩ Back on <b>${esc(current())}</b>.`);
  }

  async function guess(raw: string) {
    const g = raw.trim();
    if (!g || busy || s.done) return;
    running = true;
    busy = true; q('go').textContent = '…';
    const from = current();
    try {
      const links = await linksOf(from);
      const k = key(g);
      if (k === key(from)) { say(`You're already on <b>${esc(from)}</b>.`); return; }
      // 1. one of this page's links, however it's capitalised or spelled with accents
      let hit = links.get(k);
      // 2. another name for an article (a redirect, like "Dubya")
      let real: string | null = null, ambiguous = false;
      if (!hit) {
        // Wikipedia titles are case-sensitive after the first letter, so also try Title Case ("satoshi nakamoto")
        const titleCase = g.replace(/(^|\s)(\p{Ll})/gu, (_, sp, c) => sp + c.toUpperCase());
        const d = await api({ action: 'query', titles: [...new Set([g, titleCase])].join('|'), redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' });
        let p = (d.query?.pages || []).find((x: any) => !x.missing && !x.invalid);
        if (!p) {
          // last try: a search result whose title is exactly what was typed, ignoring case and accents
          const sr = await api({ action: 'query', list: 'search', srsearch: g, srlimit: '5', srprop: '' });
          const exact = (sr.query?.search || []).find((x: any) => key(x.title) === k);
          if (exact) p = (await api({ action: 'query', titles: exact.title, redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' })).query?.pages?.[0];
        }
        if (p && !p.missing && !p.invalid) { real = p.title; ambiguous = p.pageprops?.disambiguation !== undefined; hit = links.get(key(p.title)); }
      }
      if (hit) { input.value = ''; move(hit); return; }
      // 3. not linked, but connected another way: the page mentions it, or it links back here.
      // (The last step must be a real link: Banana mentions or links back to far too much.)
      if (real && !ambiguous && real !== TARGET) {
        const text = await textOf(from);
        if (mentions(text, [real, g]) || mentions(text, await otherNames(real))) { input.value = ''; move(real, 'mention'); return; }
        if (await linksBack(real, from)) { input.value = ''; move(real, 'back'); return; }
      }
      // 4. a word with several meanings ("Greek", "Mercury"): offer the meanings this page uses (not a miss)
      const meanings = await meaningsOf(g, real, ambiguous, links, from);
      if (meanings.length) {
        say(`Which one? ${meanings.map(t => `<button type="button" class="sugg" data-t="${esc(t)}">${esc(t)}</button>`).join(' ')} <span class="free">No miss</span>`);
        return;
      }
      if (real && ambiguous) {
        say(`“${esc(g)}” means too many things, and none of them are on this page. Try something more specific. <span class="free">No miss</span>`);
        return;
      }
      if (real) {
        s.misses++; save(); render();
        const quip = QUIPS[s.misses % QUIPS.length];
        say(real === TARGET
          ? `✗ So close. To finish, the page has to <b>link</b> to Banana, and <b>${esc(from)}</b> doesn't.`
          : `✗ <b>${esc(from)}</b> doesn't link to or mention <b>${esc(real)}</b>. ${quip}`, 'miss');
        return;
      }
      // 5. not an article: suggest the nearest spelling (a typo isn't a miss)
      let near = '', best = 99;
      for (const [lk, title] of links) {
        if (Math.abs(lk.length - k.length) > 2) continue;
        const dist = distance(k, lk);
        if (dist < best) { best = dist; near = title; }
      }
      let suggest = best <= Math.max(1, Math.floor(k.length / 6)) ? near : '';
      if (!suggest) {
        // Wikipedia's own spelling suggestion first, otherwise the top search result if it looks like what was typed
        const d = await api({ action: 'query', list: 'search', srsearch: g, srlimit: '1', srinfo: 'suggestion', srprop: '' });
        const spelled = d.query?.searchinfo?.suggestion as string | undefined;
        const top = d.query?.search?.[0]?.title as string | undefined;
        if (spelled) {
          const sp = await api({ action: 'query', titles: spelled, redirects: '1' });
          const p = sp.query?.pages?.[0];
          if (p && !p.missing && !p.invalid) suggest = p.title;
        }
        if (!suggest && top && distance(key(top), k) <= Math.max(2, Math.floor(k.length / 3))) suggest = top;
      }
      say(suggest
        ? `No page called “${esc(g)}”. Did you mean <button type="button" class="sugg" data-t="${esc(suggest)}">${esc(suggest)}</button>? <span class="free">No miss</span>`
        : `No page called “${esc(g)}”. Check the spelling. <span class="free">No miss</span>`);
    } catch {
      say(`Couldn't reach Wikipedia just now. Try again in a moment.`, 'miss');
    } finally {
      busy = false; q('go').textContent = 'Go';
    }
  }

  async function hint() {
    if (s.done) return;
    const from = current(), box = q('hintBox');
    box.hidden = false;
    box.innerHTML = 'Looking…';
    try {
      const [links, near] = await Promise.all([linksOf(from), nearBanana()]);
      const all = [...new Set(links.values())].filter(t => t !== from);
      const pick = <T,>(a: T[]) => a.splice(Math.floor(Math.random() * a.length), 1)[0];
      // one of the three gets you closer to Banana, if this page has such a link
      const closer = all.filter(t => t === TARGET || near.has(t));
      const shown = closer.length ? [pick(closer)] : [];
      const rest = all.filter(t => !shown.includes(t));
      while (shown.length < 3 && rest.length) shown.push(pick(rest));
      shown.sort(() => Math.random() - 0.5);
      s.hints++; save();
      box.innerHTML = `${closer.length ? 'One of these gets you closer:' : 'This page links to:'} ${shown.map(t => `<button type="button" class="sugg" data-t="${esc(t)}">${esc(t)}</button>`).join(' ')}`;
    } catch {
      box.innerHTML = `Couldn't reach Wikipedia just now.`;
    }
  }

  function giveUp() {
    if (s.done || !confirm('Give up today’s crate?')) return;
    s.done = true; s.gaveUp = true; save(); render(); finish();
  }

  // ---------- results ----------
  function finish() {
    running = false;
    showDone();
    if (mode !== 'daily') return;
    const rec = store.get<Record_>('atb-deg-history', {});
    rec[today] = { steps: steps(), solved: !s.gaveUp, par: PAR };
    store.set('atb-deg-history', rec);
    renderStats();
    if (!s.posted) {
      s.posted = true; save();
      fetch('/api/degrees', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day: today, steps: Math.max(1, steps()), secs: Math.max(1, s.secs), solved: !s.gaveUp }) })
        .then(r => r.json()).then(showWorld).catch(() => {});
    }
  }

  function showDone() {
    q('done').hidden = false;
    q('feedback').innerHTML = '';
    const n = steps(), stamp = q('stamp');
    stamp.textContent = s.gaveUp ? 'Bruised' : golf(n);
    stamp.classList.toggle('good', !s.gaveUp && n <= PAR);
    q('doneTitle').textContent = s.gaveUp ? 'Banana got away.' : `Banana in ${plural(n, 'step')}.`;
    q('doneSub').textContent = s.gaveUp ? 'It happens to the best of us.' : `Par ${PAR} · ${plural(s.misses, 'miss', 'misses')} · ${plural(s.hints, 'hint')} · ${fmtTime(s.secs)}`;
    const route = s.path.map(t => `<a href="${wikiUrl(t)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' → ');
    q('route').innerHTML = `Your route: ${route}`;
    if (s.gaveUp) {
      // a nudge for next time: some pages that are one step from Banana
      nearBanana().then(near => {
        const from = [...near].filter(t => /^(Ecuador|Costa Rica|Colombia|Panama|Fruit|Banana republic|Caribbean|Jamaica|Uganda|Potassium|Smoothie|Plantain)$/.test(t));
        q('route').innerHTML = `Your route: ${route}<br>Tip: ${from.slice(0, 4).map(t => `<b>${esc(t)}</b>`).join(', ')} all link straight to Banana.`;
      }).catch(() => {});
    }
    q('next').hidden = mode !== 'daily';
    tick();
    if (mode === 'daily') fetch(`/api/degrees?day=${today}`).then(r => r.json()).then(showWorld).catch(() => {});
  }

  // countdown to the next daily crate (the player's midnight)
  function tick() {
    const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    const mins = Math.max(0, Math.ceil((+mid - +n) / 60000));
    q('countdown').textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }

  function showWorld(w: World) {
    if (!w || !w.played) { q('tried').textContent = 'Nobody has cracked it yet today.'; return; }
    q('tried').textContent = `${plural(w.played, 'person', 'people')} played today.`;
    const box = document.querySelector<HTMLElement>('[data-bd-world]');
    if (!box || !s.done || mode !== 'daily') return;
    box.hidden = false;
    const avg = w.solved ? Object.entries(w.steps).reduce((a, [k, n]) => a + +k * n, 0) / w.solved : 0;
    const max = Math.max(1, ...Object.values(w.steps));
    const mine = s.gaveUp ? -1 : Math.min(steps(), 10);
    const top = Math.max(6, mine, ...Object.keys(w.steps).map(Number));
    box.querySelector('[data-bd-world-sum]')!.innerHTML = `<div><b>${w.played.toLocaleString('en-US')}</b><span>played</span></div><div><b>${Math.round((w.solved / w.played) * 100)}%</b><span>made it</span></div><div><b>${w.solved ? avg.toFixed(1) : '–'}</b><span>avg steps</span></div><div><b>${w.best != null ? fmtTime(w.best) : '–'}</b><span>fastest</span></div>`;
    box.querySelector('[data-bd-world-hist]')!.innerHTML = Array.from({ length: top }, (_, i) => i + 1).map(k => {
      const c = w.steps[k] || 0;
      return `<div class="bar${k === mine ? ' me' : ''}"><span class="k">${k === 10 ? '10+' : k}${k === PAR ? ' <em>par</em>' : ''}</span><span class="track"><i class="r${Math.min(k, 7)}" style="width:${c ? Math.max(4, (c / max) * 100) : 0}%"></i></span><span class="n">${c}</span></div>`;
    }).join('');
  }

  function shareText() {
    const head = mode === 'daily' ? `🍌 Bananadle #${today}` : '🍌 Bananadle (practice)';
    const n = steps();
    const line = s.gaveUp ? `${start.t} → ❌ bruised` : `${start.t} → Banana in ${plural(n, 'step')} · ${golf(n)} ${shareEmoji(n)}`;
    const squares = s.gaveUp ? '' : '\n' + ['🟩', '🟩', '🟨', '🟨', '🟧', '🟫', '🟫'].slice(0, Math.max(0, Math.min(n, 7) - 1)).join('') + '🍌' + (s.misses ? ` ${'❌'.repeat(Math.min(s.misses, 8))}` : '') + (s.hints ? ` ${'💡'.repeat(Math.min(s.hints, 5))}` : '');
    return `${head}\n${line}${squares}\n⏱ ${fmtTime(s.secs)}\nhttps://allthingsbanana.com/bananadle/`;
  }

  async function share() {
    const text = shareText(), btn = q('share');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied. Paste it anywhere.';
      setTimeout(() => (btn.textContent = 'Share result'), 2200);
    } catch {}
  }

  // ---------- wiring ----------
  q('form').addEventListener('submit', e => { e.preventDefault(); guess(input.value); });
  input.addEventListener('focus', () => { if (!s.done) running = true; });
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.classList.contains('sugg') && b.dataset.t) { input.value = b.dataset.t; guess(b.dataset.t); }
    else if (b.dataset.i && b.closest('[data-bd="path"]')) rewind(+b.dataset.i);
  });
  q('hintBtn').addEventListener('click', hint);
  q('giveUpBtn').addEventListener('click', giveUp);
  q('share').addEventListener('click', share);
  // "How to play" opens in place; open by default the very first time on the game's own page
  const how = q('how'), howBtn = q('howBtn');
  const setHow = (open: boolean) => { how.hidden = !open; howBtn.setAttribute('aria-expanded', String(open)); };
  howBtn.addEventListener('click', () => { setHow(how.hidden); store.set('atb-bd-seen', 1); });
  if (variant === 'page' && !store.get('atb-bd-seen', 0)) { setHow(true); store.set('atb-bd-seen', 1); }
  root.querySelector<HTMLButtonElement>('[data-bd="modeBtn"]')?.addEventListener('click', () => begin(mode === 'daily' ? 'practice' : 'daily'));
  // the clock runs only while you're playing and the page is visible
  setInterval(() => {
    if (s?.done) { tick(); return; }
    if (!running || !s || document.hidden) return;
    s.secs++;
    const t = root.querySelector('[data-bd="time"]');
    if (t) t.textContent = fmtTime(s.secs);
    if (s.secs % 5 === 0) save();
  }, 1000);
  addEventListener('pagehide', () => s && save());

  begin('daily');
  fetch(`/api/degrees?day=${today}`).then(r => r.json()).then(showWorld).catch(() => {});
}
