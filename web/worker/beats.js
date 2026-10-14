// BanaDAW board: loops people post, and their upvotes.
// No accounts. To keep votes to one per person and stop flooding, we store a salted hash of the
// connection's IP address (never the address itself). Three reports hide a loop until we look at it.
import { DurableObject } from 'cloudflare:workers';
import { BLOCKED_WORDS } from './filter.js';

const PAGE = 24;
const POSTS_PER_DAY = 8;
const HIDE_AT_REPORTS = 3;
const WEEK = 7 * 864e5;
// names people can't use for a loop or themselves
const RUDE = [...BLOCKED_WORDS, /n[i1!]gg/i, /f[a@4]gg?[o0]t/i, /\bfag\b/i, /retard/i, /\bk[i1]ke\b/i, /\bch[i1]nk\b/i, /\bsp[i1]c\b/i, /tr[a@]nn(y|ie)/i,
  /\bcunt/i, /\bwhore/i, /\brap(e|ist)\b/i, /\bnazi/i, /hitler/i, /\bkys\b/i, /kill\s*yourself/i, /https?:|www\.|\.com\b/i];

export class BeatBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS beats (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT NOT NULL, code TEXT NOT NULL, bpm INTEGER, bars INTEGER, chans INTEGER,
      created INTEGER NOT NULL, votes INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, poster TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS votes (beat TEXT NOT NULL, voter TEXT NOT NULL, PRIMARY KEY (beat, voter))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS reports (beat TEXT NOT NULL, voter TEXT NOT NULL, PRIMARY KEY (beat, voter))`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS beats_top ON beats (hidden, votes DESC, created DESC)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS beats_new ON beats (hidden, created DESC)`);
  }
  post(b) {
    const now = Date.now();
    const same = this.sql.exec(`SELECT id FROM beats WHERE code = ?`, b.code).toArray()[0];
    if (same) return { id: same.id, existing: true };
    const recent = this.sql.exec(`SELECT COUNT(*) AS n FROM beats WHERE poster = ? AND created > ?`, b.poster, now - 864e5).one().n;
    if (recent >= POSTS_PER_DAY) return { error: `That's ${POSTS_PER_DAY} loops today. Come back tomorrow with more.` };
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    this.sql.exec(`INSERT INTO beats (id, name, author, code, bpm, bars, chans, created, poster) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, b.name, b.author, b.code, b.bpm, b.bars, b.chans, now, b.poster);
    // posting counts as liking your own loop
    this.vote(id, b.poster, true);
    return { id };
  }
  list(sort, voter, offset) {
    const cols = `b.id, b.name, b.author, b.bpm, b.bars, b.chans, b.created, b.votes, EXISTS (SELECT 1 FROM votes v WHERE v.beat = b.id AND v.voter = ?) AS mine, (b.poster = ?) AS own`;
    const rows = sort === 'new'
      ? this.sql.exec(`SELECT ${cols} FROM beats b WHERE hidden = 0 ORDER BY created DESC LIMIT ? OFFSET ?`, voter, voter, PAGE + 1, offset).toArray()
      : sort === 'week'
        ? this.sql.exec(`SELECT ${cols} FROM beats b WHERE hidden = 0 AND created > ? ORDER BY votes DESC, created DESC LIMIT ? OFFSET ?`, voter, voter, Date.now() - WEEK, PAGE + 1, offset).toArray()
        : this.sql.exec(`SELECT ${cols} FROM beats b WHERE hidden = 0 ORDER BY votes DESC, created DESC LIMIT ? OFFSET ?`, voter, voter, PAGE + 1, offset).toArray();
    const total = this.sql.exec(`SELECT COUNT(*) AS n FROM beats WHERE hidden = 0`).one().n;
    return { beats: rows.slice(0, PAGE).map(r => ({ ...r, mine: !!r.mine, own: !!r.own })), more: rows.length > PAGE, total };
  }
  get(id, voter) {
    const r = this.sql.exec(`SELECT id, name, author, code, bpm, bars, chans, created, votes, hidden, EXISTS (SELECT 1 FROM votes v WHERE v.beat = beats.id AND v.voter = ?) AS mine FROM beats WHERE id = ?`, voter, id).toArray()[0];
    if (!r || r.hidden) return null;
    const { hidden, ...pub } = r;
    return { ...pub, mine: !!r.mine };
  }
  vote(id, voter, on) {
    const beat = this.sql.exec(`SELECT hidden FROM beats WHERE id = ?`, id).toArray()[0];
    if (!beat || beat.hidden) return null;
    if (on) this.sql.exec(`INSERT OR IGNORE INTO votes (beat, voter) VALUES (?, ?)`, id, voter);
    else this.sql.exec(`DELETE FROM votes WHERE beat = ? AND voter = ?`, id, voter);
    const votes = this.sql.exec(`SELECT COUNT(*) AS n FROM votes WHERE beat = ?`, id).one().n;
    this.sql.exec(`UPDATE beats SET votes = ? WHERE id = ?`, votes, id);
    return { votes, mine: on };
  }
  report(id, voter) {
    this.sql.exec(`INSERT OR IGNORE INTO reports (beat, voter) VALUES (?, ?)`, id, voter);
    const n = this.sql.exec(`SELECT COUNT(*) AS n FROM reports WHERE beat = ?`, id).one().n;
    this.sql.exec(`UPDATE beats SET reports = ?, hidden = CASE WHEN ? >= ? THEN 1 ELSE hidden END WHERE id = ?`, n, n, HIDE_AT_REPORTS, id);
    return { ok: true };
  }
  // for us: hide or bring back a loop
  setHidden(id, hidden) { this.sql.exec(`UPDATE beats SET hidden = ? WHERE id = ?`, hidden ? 1 : 0, id); return { ok: true }; }
}

// ---------- checking what people send ----------
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const rude = s => RUDE.some(re => re.test(s.replace(/[\s._-]+/g, '')) || re.test(s));

async function decodeSong(code) {
  if (typeof code !== 'string' || code.length > 24000 || !/^[zj][\w-]+$/.test(code)) return null;
  try {
    const b64 = code.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    let bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), c => c.charCodeAt(0));
    if (code[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    if (bytes.length > 400000) return null;
    const s = JSON.parse(new TextDecoder().decode(bytes));
    const ok = s && s.v === 2 && Array.isArray(s.ch) && s.ch.length >= 1 && s.ch.length <= 40 && [1, 2, 4, 8].includes(s.bars) && s.bpm >= 60 && s.bpm <= 200
      && s.ch.every(c => (c.kind === 'drum' && Array.isArray(c.steps) && c.steps.length <= 128) || (c.kind === 'synth' && Array.isArray(c.notes) && c.notes.length <= 2000));
    if (!ok) return null;
    const notes = s.ch.reduce((a, c) => a + (c.kind === 'drum' ? c.steps.filter(Boolean).length : c.notes.length), 0);
    return notes > 0 ? s : 'empty';
  } catch { return null; }
}

async function who(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const data = new TextEncoder().encode(`${env.VOTE_SALT || 'atb-banadaw-board'}:${ip}`);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const json = (data, status = 200, cache = 'no-store') => Response.json(data, { status, headers: { 'cache-control': cache } });

export async function handleBeats(request, env, url) {
  const board = env.BEATS.get(env.BEATS.idFromName('board'));
  const parts = url.pathname.split('/').filter(Boolean);   // api, beats, id?, action?
  const id = parts[2], action = parts[3];
  if (id && !/^[a-f0-9]{10}$/.test(id)) return json({ error: 'No such loop' }, 404);
  const voter = await who(request, env);

  if (!id && request.method === 'GET') {
    const sort = ['week', 'all', 'new'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'week';
    const offset = Math.max(0, Math.min(2000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
    return json(await board.list(sort, voter, offset));
  }
  if (!id && request.method === 'POST') {
    const b = await request.json().catch(() => null);
    if (!b) return json({ error: 'Bad request' }, 400);
    const name = clean(b.name, 40), author = clean(b.author, 24) || 'Anonymous banana';
    if (!name) return json({ error: 'Give your loop a name.' }, 400);
    if (rude(name) || rude(author)) return json({ error: 'Let’s keep the names friendly (and no links).' }, 400);
    const song = await decodeSong(b.code);
    if (song === 'empty') return json({ error: 'That loop is empty. Add some notes first.' }, 400);
    if (!song) return json({ error: 'That loop couldn’t be read.' }, 400);
    const r = await board.post({ name, author, code: b.code, bpm: Math.round(song.bpm), bars: song.bars, chans: song.ch.length, poster: voter });
    return json(r, r.error ? 429 : 200);
  }
  if (id && !action && request.method === 'GET') {
    const r = await board.get(id, voter);
    return r ? json(r) : json({ error: 'That loop isn’t on the board (any more).' }, 404);
  }
  if (id && action === 'vote' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const r = await board.vote(id, voter, b.on !== false);
    return r ? json(r) : json({ error: 'No such loop' }, 404);
  }
  if (id && action === 'report' && request.method === 'POST') return json(await board.report(id, voter));
  // for us: /api/beats/<id>/hide with the admin key
  if (id && (action === 'hide' || action === 'unhide') && request.method === 'POST') {
    if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) return json({ error: 'Not allowed' }, 403);
    return json(await board.setHidden(id, action === 'hide'));
  }
  return json({ error: 'Not found' }, 404);
}
