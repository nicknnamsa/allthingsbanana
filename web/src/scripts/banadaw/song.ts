// BanaDAW: one loop, many channels. The song format, instruments, scales and starter loops.
// A song is plain JSON, small enough to live in a share link.

export const STEPS_PER_BAR = 16;
export type Bars = 1 | 2 | 4 | 8;
export const BAR_CHOICES: Bars[] = [1, 2, 4, 8];

export type DrumSound = 'kick' | 'clap' | 'snare' | 'hat' | 'open' | 'ride' | 'crash' | 'rim' | 'tom' | 'cowbell' | 'shaker' | 'impact';
export type SynthPreset = 'reese' | 'rolling' | 'acid' | 'sub808' | 'deep' | 'stab' | 'supersaw' | 'grit' | 'pluck' | 'arp' | 'pad' | 'keys' | 'bell' | 'riser' | 'squeak';

export type Mix = { vol: number; pan: number; rev: number; dly: number; duck: number; mute: boolean; solo: boolean };
export type DrumParams = { tune: number; decay: number; tone: number; drive: number };   // 0..1 (0.5 = as designed)
export type SynthParams = { cutoff: number; res: number; env: number; attack: number; release: number; drive: number; glide: number };   // 0..1
export type Note = { s: number; l: number; m: number; v: number };   // start step, length in steps, MIDI note, velocity 0..1

type Base = { id: string; name: string; color: number; mix: Mix };
export type DrumChannel = Base & { kind: 'drum'; sound: DrumSound; p: DrumParams; steps: number[] };   // one velocity per 16th, 0 = off
export type SynthChannel = Base & { kind: 'synth'; preset: SynthPreset; p: SynthParams; notes: Note[] };
export type Channel = DrumChannel | SynthChannel;

export type Song = {
  v: 2; name: string; bpm: number; swing: number; root: number; scale: ScaleId; bars: Bars;
  master: { vol: number; filter: number; drive: number };   // filter: -1 (dark) .. 0 (open) .. 1 (thin)
  ch: Channel[];
};

// the site's pastels, a shade stronger so notes stand out on light and dark
export const COLORS = ['#F5C93E', '#F2A57C', '#EE8FB0', '#B79CF0', '#7DB6E8', '#6FCDB8', '#8CC56A', '#D9B07A'];

// ---------- drums ----------
export const DRUMS: Record<DrumSound, { label: string }> = {
  kick: { label: 'Kick' }, clap: { label: 'Clap' }, snare: { label: 'Snare' }, hat: { label: 'Closed hat' }, open: { label: 'Open hat' },
  ride: { label: 'Ride' }, crash: { label: 'Crash' }, rim: { label: 'Rim' }, tom: { label: 'Tom' }, cowbell: { label: 'Cowbell' },
  shaker: { label: 'Shaker' }, impact: { label: 'Impact (boom)' },
};
export const DRUM_KNOBS: { k: keyof DrumParams; label: string }[] = [
  { k: 'tune', label: 'Tune' }, { k: 'decay', label: 'Decay' }, { k: 'tone', label: 'Tone' }, { k: 'drive', label: 'Drive' },
];
export const drumDefaults = (): DrumParams => ({ tune: 0.5, decay: 0.5, tone: 0.5, drive: 0 });

// ---------- synths: oscillators and envelopes, then the knobs' starting positions ----------
export type Osc = { w: OscillatorType; o?: number; n?: number; spr?: number; g?: number };   // wave, semitone offset, unison voices, spread in cents, level
export type Patch = {
  label: string; group: 'Bass' | 'Lead' | 'Chords' | 'Keys' | 'FX';
  osc: Osc[]; sub?: number; dec: number; sus: number; fdec: number; lvl: number; mono?: boolean;
  special?: 'fm' | 'bell' | 'riser' | 'squeak';
  p: SynthParams; low: number;   // low: the lowest MIDI note the piano roll scrolls to for this sound
};
const P = (cutoff: number, res: number, env: number, attack: number, release: number, drive: number, glide = 0): SynthParams => ({ cutoff, res, env, attack, release, drive, glide });
export const SYNTHS: Record<SynthPreset, Patch> = {
  rolling: { label: 'Rolling bass', group: 'Bass', osc: [{ w: 'sawtooth' }, { w: 'square', o: 0.07, g: 0.5 }], sub: 0.8, dec: 0.16, sus: 0.3, fdec: 0.09, lvl: 0.62, p: P(0.4, 0.38, 0.5, 0, 0.1, 0.62), low: 33 },
  reese: { label: 'Reese bass', group: 'Bass', osc: [{ w: 'sawtooth', n: 2, spr: 24 }], sub: 0.6, dec: 0.3, sus: 1, fdec: 0.3, lvl: 0.42, mono: true, p: P(0.5, 0.22, 0.15, 0, 0.14, 0.5, 0.2), low: 28 },
  acid: { label: 'Acid 303', group: 'Bass', osc: [{ w: 'sawtooth' }], dec: 0.25, sus: 0.6, fdec: 0.16, lvl: 0.58, mono: true, p: P(0.33, 0.78, 0.62, 0, 0.05, 0.4, 0.25), low: 33 },
  sub808: { label: '808', group: 'Bass', osc: [{ w: 'sine' }, { w: 'triangle', g: 0.16 }], dec: 1.5, sus: 0, fdec: 0.5, lvl: 0.7, mono: true, p: P(0.78, 0, 0, 0, 0.25, 0.35, 0.35), low: 24 },
  deep: { label: 'Deep bass', group: 'Bass', osc: [{ w: 'sine' }, { w: 'sawtooth', g: 0.35 }], dec: 0.25, sus: 0.6, fdec: 0.12, lvl: 0.6, p: P(0.42, 0.15, 0.25, 0, 0.12, 0.1), low: 28 },
  grit: { label: 'Grit lead', group: 'Lead', osc: [{ w: 'square', n: 2, spr: 16 }, { w: 'sawtooth', o: 12, g: 0.35 }], dec: 0.3, sus: 0.7, fdec: 0.2, lvl: 0.34, mono: true, p: P(0.62, 0.3, 0.3, 0, 0.14, 0.72, 0.08), low: 48 },
  supersaw: { label: 'Supersaw', group: 'Lead', osc: [{ w: 'sawtooth', n: 7, spr: 38 }, { w: 'sawtooth', o: -12, g: 0.4 }], dec: 0.4, sus: 0.8, fdec: 0.4, lvl: 0.16, p: P(0.78, 0.12, 0.12, 0.04, 0.3, 0.1), low: 48 },
  arp: { label: 'Arp', group: 'Lead', osc: [{ w: 'square' }, { w: 'sawtooth', o: 12, g: 0.25 }], dec: 0.15, sus: 0.1, fdec: 0.08, lvl: 0.22, p: P(0.5, 0.45, 0.5, 0, 0.1, 0.2), low: 48 },
  pluck: { label: 'Pluck', group: 'Lead', osc: [{ w: 'sawtooth', n: 2, spr: 12 }, { w: 'square', o: 12, g: 0.3 }], dec: 0.35, sus: 0, fdec: 0.18, lvl: 0.25, p: P(0.45, 0.3, 0.55, 0, 0.25, 0), low: 48 },
  stab: { label: 'Dark stab', group: 'Chords', osc: [{ w: 'sawtooth', n: 5, spr: 28 }], dec: 0.22, sus: 0.15, fdec: 0.12, lvl: 0.16, p: P(0.52, 0.3, 0.5, 0, 0.22, 0.3), low: 45 },
  pad: { label: 'Pad', group: 'Chords', osc: [{ w: 'sawtooth', n: 5, spr: 30 }, { w: 'triangle', o: -12, g: 0.5 }], dec: 1, sus: 0.85, fdec: 1.2, lvl: 0.1, p: P(0.45, 0.15, 0.2, 0.55, 0.6, 0), low: 40 },
  keys: { label: 'Electric piano', group: 'Keys', osc: [], dec: 1.2, sus: 0.3, fdec: 0, lvl: 0.18, special: 'fm', p: P(0.5, 0, 0.4, 0, 0.35, 0), low: 40 },
  bell: { label: 'Bell', group: 'Keys', osc: [], dec: 2, sus: 0, fdec: 0, lvl: 0.26, special: 'bell', p: P(0.6, 0, 0.4, 0, 0.5, 0), low: 52 },
  riser: { label: 'Noise riser', group: 'FX', osc: [], dec: 0, sus: 1, fdec: 0, lvl: 1, special: 'riser', p: P(0.4, 0.5, 0.75, 0, 0.3, 0), low: 48 },
  squeak: { label: 'Squeaky banana', group: 'FX', osc: [], dec: 0.1, sus: 0.8, fdec: 0, lvl: 0.28, special: 'squeak', p: P(0.5, 0, 0.5, 0, 0.1, 0), low: 60 },
};
export const SYNTH_KNOBS: { k: keyof SynthParams; label: string }[] = [
  { k: 'cutoff', label: 'Cutoff' }, { k: 'res', label: 'Reso' }, { k: 'env', label: 'Env' }, { k: 'attack', label: 'Attack' },
  { k: 'release', label: 'Release' }, { k: 'drive', label: 'Drive' }, { k: 'glide', label: 'Glide' },
];
export const mixDefaults = (o: Partial<Mix> = {}): Mix => ({ vol: 0.78, pan: 0, rev: 0.1, dly: 0, duck: 0, mute: false, solo: false, ...o });

// ---------- scales ----------
export type ScaleId = 'minor' | 'major' | 'dorian' | 'phrygian' | 'harmonic' | 'penta-minor' | 'penta-major' | 'blues' | 'chromatic';
export const SCALES: { id: ScaleId; label: string; steps: number[] }[] = [
  { id: 'minor', label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian (dark)', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'harmonic', label: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'penta-minor', label: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'penta-major', label: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  { id: 'blues', label: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'chromatic', label: 'Chromatic', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const noteName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
export const inScale = (song: Song, m: number) => SCALES.find(s => s.id === song.scale)!.steps.includes((((m - song.root) % 12) + 12) % 12);
// the note `n` scale steps above (or below) m, staying in the scale
export function scaleStep(song: Song, m: number, n: number) {
  let x = m, left = Math.abs(n);
  const dir = Math.sign(n);
  while (left > 0) { x += dir; if (inScale(song, x)) left--; }
  return x;
}
// the nearest note in the scale
export function snapToScale(song: Song, m: number) {
  for (let d = 0; d < 12; d++) { if (inScale(song, m - d)) return m - d; if (inScale(song, m + d)) return m + d; }
  return m;
}
export type Chord = 'note' | 'triad' | 'seventh' | 'power' | 'octave';
export const CHORDS: { id: Chord; label: string }[] = [
  { id: 'note', label: 'Single note' }, { id: 'triad', label: 'Chord (3 notes)' }, { id: 'seventh', label: 'Chord (4 notes)' },
  { id: 'power', label: 'Power chord' }, { id: 'octave', label: 'Octave' },
];
// the notes a click places: chords are built from the scale, so they always fit
export function chordAt(song: Song, m: number, c: Chord): number[] {
  if (c === 'power') return [m, m + 7];
  if (c === 'octave') return [m, m + 12];
  if (c === 'note') return [m];
  const base = inScale(song, m) ? m : snapToScale(song, m);
  const out = [base, scaleStep(song, base, 2), scaleStep(song, base, 4)];
  if (c === 'seventh') out.push(scaleStep(song, base, 6));
  return out;
}

let uid = 0;
export const newId = () => `${Date.now().toString(36)}${(uid++).toString(36)}`;
export const stepsOf = (song: Song) => song.bars * STEPS_PER_BAR;

// make the loop longer (repeating what is there) or shorter (dropping what no longer fits)
export function setBars(song: Song, bars: Bars) {
  const old = stepsOf(song), now = bars * STEPS_PER_BAR;
  for (const c of song.ch) {
    if (c.kind === 'drum') c.steps = Array.from({ length: now }, (_, i) => c.steps[i % old] || 0);
    else {
      const keep = c.notes.filter(n => n.s < now).map(n => ({ ...n, l: Math.min(n.l, now - n.s) }));
      const copies: Note[] = [];
      for (let off = old; off < now; off += old) for (const n of c.notes) if (n.s + off < now) copies.push({ ...n, s: n.s + off, l: Math.min(n.l, now - n.s - off) });
      c.notes = [...keep, ...copies];
    }
  }
  song.bars = bars;
}

// ---------- share links: the song, compressed, in the address ----------
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function squash(way: 'compress' | 'decompress', data: Uint8Array): Promise<Uint8Array> {
  const S = way === 'compress' ? CompressionStream : DecompressionStream;
  const stream = new Blob([data]).stream().pipeThrough(new S('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// rounding keeps links short
const tidy = (song: Song) => JSON.stringify(song, (_, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
export async function encodeSong(song: Song) {
  const raw = new TextEncoder().encode(tidy(song));
  try { return 'z' + b64(await squash('compress', raw)); } catch { return 'j' + b64(raw); }
}
export function validSong(s: any): s is Song {
  return !!s && s.v === 2 && Array.isArray(s.ch) && BAR_CHOICES.includes(s.bars) && s.ch.every((c: any) =>
    (c.kind === 'drum' && c.sound in DRUMS && Array.isArray(c.steps)) || (c.kind === 'synth' && c.preset in SYNTHS && Array.isArray(c.notes)));
}
export async function decodeSong(code: string): Promise<Song | null> {
  try {
    const bytes = unb64(code.slice(1));
    const raw = code[0] === 'z' ? await squash('decompress', bytes) : bytes;
    const s = JSON.parse(new TextDecoder().decode(raw));
    return validSong(s) ? s : null;
  } catch { return null; }
}

// ---------- building channels and patterns ----------
let colorAt = 0;
export function drumChannel(sound: DrumSound, steps: number[], o: { p?: Partial<DrumParams>; mix?: Partial<Mix>; name?: string; color?: number } = {}): DrumChannel {
  return { id: newId(), kind: 'drum', name: o.name ?? DRUMS[sound].label, color: o.color ?? colorAt++ % COLORS.length, sound, steps, p: { ...drumDefaults(), ...o.p }, mix: mixDefaults(o.mix) };
}
export function synthChannel(preset: SynthPreset, notes: Note[], o: { p?: Partial<SynthParams>; mix?: Partial<Mix>; name?: string; color?: number } = {}): SynthChannel {
  return { id: newId(), kind: 'synth', name: o.name ?? SYNTHS[preset].label, color: o.color ?? colorAt++ % COLORS.length, preset, notes, p: { ...SYNTHS[preset].p, ...o.p }, mix: mixDefaults(o.mix) };
}
// a drum pattern from a string, repeated to fill the loop: . off, - ghost, o soft, x hit, X accent
const VEL: Record<string, number> = { '.': 0, '-': 0.35, o: 0.6, x: 0.85, X: 1 };
export const beat = (p: string, bars: number) => Array.from({ length: bars * STEPS_PER_BAR }, (_, i) => VEL[p[i % p.length]] ?? 0);
// a mono line from tokens, one per 16th: a MIDI number starts a note, _ holds it, ~ slides into the next note, . rests; ! accents
export function line(tokens: string, from = 0, v = 0.75): Note[] {
  const out: Note[] = [];
  tokens.trim().split(/\s+/).forEach((t, i) => {
    const last = out[out.length - 1];
    if (t === '_' && last) last.l++;
    else if (t === '~' && last) last.l += 1.5;   // overlaps the next note: mono sounds glide into it
    else if (/^\d+!?$/.test(t)) out.push({ s: from + i, l: 1, m: parseInt(t), v: t.endsWith('!') ? 1 : v });
  });
  for (const n of out) n.l = Math.ceil(n.l * 2) / 2;
  return out;
}
// chords: [start step, length, notes]
export const chords = (list: [number, number, number[]][], v = 0.7): Note[] => list.flatMap(([s, l, ms]) => ms.map(m => ({ s, l, m, v })));
const repeat = (notes: Note[], every: number, times: number) => Array.from({ length: times }, (_, i) => notes.map(n => ({ ...n, s: n.s + i * every }))).flat();

// ---------- starter loops ----------
export type Starter = { id: string; label: string; blurb: string; make: () => Song };
const song = (name: string, bpm: number, root: number, scale: ScaleId, bars: Bars, ch: Channel[], o: Partial<Song> = {}): Song =>
  ({ v: 2, name, bpm, swing: 0, root, scale, bars, master: { vol: 0.8, filter: 0, drive: 0.15 }, ch, ...o });

export const STARTERS: Starter[] = [
  {
    id: 'club', label: 'Red Circle', blurb: 'Dark club, 128 BPM: the gunfight-on-the-dance-floor one',
    make: () => {
      colorAt = 0;
      const bars = 4, B = 16;
      // F minor. Bass rolls on the off-16ths of every beat, the kick sits alone on the beat
      const roots = [41, 41, 37, 39];
      const bass = roots.flatMap((r, bar) => [0, 4, 8, 12].flatMap(b => [{ s: bar * B + b + 1, l: 1, m: r, v: 0.62 }, { s: bar * B + b + 2, l: 1, m: r, v: 1 }, { s: bar * B + b + 3, l: 1, m: r + (b === 12 && bar % 2 ? 12 : 0), v: 0.75 }]));
      const riffA = line('65! . 65 68 . 65 . 72 _ 70 . 68 _ 67 . .');
      const riffB = line('65! _ . 65 63 . 65 . 61 _ _ . 60 _ 63 .', B);
      const lead = repeat([...riffA, ...riffB], 2 * B, 2);
      const stabRhythm = [2, 7, 10];
      const stabChords = [[53, 56, 60], [53, 56, 60], [49, 53, 56], [51, 55, 58]];
      const stab = stabChords.flatMap((ch, bar) => stabRhythm.flatMap(s => ch.map(m => ({ s: bar * B + s, l: 1.5, m, v: s === 2 ? 0.85 : 0.65 }))));
      const pad = chords([[0, 32, [65, 68, 72]], [32, 16, [61, 65, 68]], [48, 16, [63, 67, 70]]], 0.6);
      return song('Red Circle', 128, 5, 'minor', bars, [
        drumChannel('kick', beat('X...X...X...X...', bars), { p: { tune: 0.42, decay: 0.62, tone: 0.65, drive: 0.6 } }),
        drumChannel('clap', beat('....x.......x...', bars), { mix: { rev: 0.28 } }),
        drumChannel('hat', beat('.o.-.o.-.o.-.o.o', bars), { mix: { vol: 0.62, pan: 0.15 } }),
        drumChannel('open', beat('..x...x...x...x.', bars), { p: { decay: 0.35 }, mix: { vol: 0.62, duck: 0.4, pan: -0.1 } }),
        drumChannel('rim', beat('...........o..o....o.......o..o.', bars), { mix: { vol: 0.5, dly: 0.3, pan: -0.3 } }),
        drumChannel('crash', beat('X' + '.'.repeat(63), bars), { mix: { vol: 0.5, rev: 0.2 } }),
        synthChannel('rolling', bass, { mix: { duck: 0.55, vol: 0.8 } }),
        synthChannel('stab', stab, { mix: { duck: 0.5, rev: 0.25, dly: 0.25, vol: 0.7 } }),
        synthChannel('grit', lead, { mix: { duck: 0.3, dly: 0.18, rev: 0.15, vol: 0.62 } }),
        synthChannel('pad', pad, { mix: { duck: 0.75, rev: 0.4, vol: 0.5 } }),
        synthChannel('riser', [{ s: 48, l: 16, m: 72, v: 0.8 }], { mix: { rev: 0.35, vol: 0.55 } }),
      ], { master: { vol: 0.8, filter: 0, drive: 0.25 } });
    },
  },
  {
    id: 'acid', label: 'Acid', blurb: 'Squelchy 303 line over a warehouse kick, 132 BPM',
    make: () => {
      colorAt = 1;
      const bars = 2;
      const acid = line('45! 45 57 . 48 45 ~ 43 45 . 52! 50 . 45 57 ~ 48 45! 45 . 57 55 . 52 ~ 50 45 . 60! 57 . 55 52 .');
      return song('Acid peel', 132, 9, 'minor', bars, [
        drumChannel('kick', beat('X...X...X...X...', bars), { p: { tune: 0.45, decay: 0.55, drive: 0.45, tone: 0.55 } }),
        drumChannel('clap', beat('....x.......x...', bars), { mix: { rev: 0.2 } }),
        drumChannel('hat', beat('xoxoxoxoxoxoxoxo', bars), { p: { decay: 0.4 }, mix: { vol: 0.5 } }),
        drumChannel('open', beat('..x...x...x...x.', bars), { mix: { vol: 0.58, duck: 0.4 } }),
        drumChannel('cowbell', beat('.......o.........o.....o......o.', bars), { mix: { vol: 0.35, dly: 0.35, pan: 0.35 } }),
        synthChannel('acid', acid, { mix: { duck: 0.45, dly: 0.22, vol: 0.8 } }),
        synthChannel('pad', chords([[0, 32, [57, 60, 64]]], 0.5), { mix: { duck: 0.8, rev: 0.45, vol: 0.42 } }),
      ], { master: { vol: 0.8, filter: 0, drive: 0.2 } });
    },
  },
  {
    id: 'house', label: 'Deep house', blurb: 'Warm keys, rolling bass, shaker, 122 BPM',
    make: () => {
      colorAt = 2;
      const bars = 4, B = 16;
      const prog = [[57, 60, 64, 67], [55, 58, 62, 65], [53, 57, 60, 64], [55, 58, 62, 65]];
      const keys = prog.flatMap((ch, bar) => [[3, 3], [10, 4]].flatMap(([s, l]) => ch.map(m => ({ s: bar * B + s, l, m, v: 0.7 }))));
      const roots = [45, 43, 41, 43];
      const bass = roots.flatMap((r, bar) => line(`${r} _ . ${r} . . ${r + 12} . ${r} _ . . ${r + 7} . ${r} .`, bar * B, 0.8));
      return song('Late at the market', 122, 9, 'dorian', bars, [
        drumChannel('kick', beat('X...X...X...X...', bars), { p: { tune: 0.5, decay: 0.45, drive: 0.15, tone: 0.45 } }),
        drumChannel('clap', beat('....x.......x...', bars), { mix: { rev: 0.25 } }),
        drumChannel('hat', beat('..x...x...x...x.', bars), { mix: { vol: 0.62 } }),
        drumChannel('shaker', beat('-o-x-o-x', bars), { mix: { vol: 0.42, pan: 0.25 } }),
        drumChannel('tom', beat('..........o....-' + '...............o', bars), { mix: { vol: 0.45, rev: 0.2 } }),
        synthChannel('deep', bass, { mix: { duck: 0.45 } }),
        synthChannel('keys', keys, { mix: { duck: 0.35, rev: 0.3, dly: 0.2, vol: 0.7 } }),
        synthChannel('pad', chords(prog.map((ch, i) => [i * B, B, ch.map(m => m + 12)] as [number, number, number[]]), 0.45), { mix: { duck: 0.7, rev: 0.45, vol: 0.38 } }),
      ], { swing: 0.12 });
    },
  },
  {
    id: 'chill', label: 'Lo-fi', blurb: 'Dusty keys, lazy drums, 82 BPM',
    make: () => {
      colorAt = 3;
      const bars = 4, B = 16;
      const prog = [[52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 66]];
      const keys = prog.flatMap((ch, bar) => ch.map((m, i) => ({ s: bar * B, l: 14, m, v: 0.55 + i * 0.05 })));
      const bass = [40, 45, 38, 43].flatMap((r, bar) => line(`${r} _ _ _ _ _ . ${r} _ _ ${r + 7} _ _ _ . .`, bar * B, 0.75));
      const bell = line('. . . . 71 _ 69 _ . . 67 _ _ _ . . . . . . 74 _ 72 _ 71 _ _ _ _ _ . . . . . . 71 _ 69 _ . . 67 _ 64 _ _ _ . . . . 66 _ 67 _ 69 _ _ _ _ _ _ _', 0, 0.55);
      return song('Sunday afternoon peel', 82, 4, 'minor', bars, [
        drumChannel('kick', beat('x......o..x.....', bars), { p: { tune: 0.4, decay: 0.4, tone: 0.2 }, mix: { vol: 0.8 } }),
        drumChannel('snare', beat('....x.......x...', bars), { p: { tone: 0.35, decay: 0.45 }, mix: { rev: 0.25, vol: 0.7 } }),
        drumChannel('hat', beat('o-o-o-o-o-o-o-o-', bars), { p: { tune: 0.4, tone: 0.3 }, mix: { vol: 0.45 } }),
        drumChannel('rim', beat('..............o.' + '...o............', bars), { mix: { vol: 0.4, rev: 0.3 } }),
        synthChannel('keys', keys, { p: { cutoff: 0.38 }, mix: { rev: 0.4, dly: 0.15 } }),
        synthChannel('deep', bass, { p: { cutoff: 0.32 }, mix: { vol: 0.75 } }),
        synthChannel('bell', bell, { mix: { rev: 0.5, dly: 0.35, vol: 0.55, pan: 0.2 } }),
      ], { swing: 0.35, master: { vol: 0.8, filter: -0.18, drive: 0.25 } });
    },
  },
  {
    id: 'trap', label: 'Trap', blurb: 'Sliding 808s, rolling hats, 140 BPM',
    make: () => {
      colorAt = 4;
      const bars = 2;
      const b808 = line('38! _ _ _ _ _ ~ 41 _ _ 38 _ _ . 36 ~ 38 _ _ _ _ _ . . 38 _ 45 ~ 43 _ _ _');
      const arp = repeat(line('62 . 65 . 69 . 65 . 62 . 65 . 70 . 69 .', 0, 0.6), 16, 2);
      return song('Peel gang', 140, 2, 'minor', bars, [
        drumChannel('kick', beat('X.........X..x..' + 'X......x..X.....', bars), { p: { tune: 0.45, decay: 0.3, tone: 0.6 } }),
        drumChannel('snare', beat('........X.......', bars), { p: { tone: 0.65, tune: 0.55 }, mix: { rev: 0.15 } }),
        drumChannel('clap', beat('........x.......', bars), { mix: { vol: 0.55 } }),
        drumChannel('hat', beat('x.x.x.x.x.xxx.x.' + 'x.x.x.xxxxx.x.x.', bars), { p: { decay: 0.35 }, mix: { vol: 0.55 } }),
        drumChannel('open', beat('..............x.' + '......x.........', bars), { mix: { vol: 0.45 } }),
        synthChannel('sub808', b808, { mix: { vol: 0.85 } }),
        synthChannel('bell', arp, { mix: { rev: 0.35, dly: 0.25, vol: 0.5 } }),
      ]);
    },
  },
  {
    id: 'rave', label: 'Rave', blurb: 'Supersaws and a hard kick, 150 BPM',
    make: () => {
      colorAt = 5;
      const bars = 4, B = 16;
      const prog = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
      const saws = prog.flatMap((ch, bar) => [2, 6, 10, 14].flatMap(s => ch.map(m => ({ s: bar * B + s, l: 2, m: m + 12, v: 0.8 }))));
      const hook = repeat(line('81! . 79 . 76 . 79 _ . 76 . 74 _ . 72 . 76! . 74 . 72 . 71 _ _ _ . . . . . .', 0, 0.8), 32, 2);
      const bass = [45, 41, 43, 40].flatMap((r, bar) => [2, 6, 10, 14].map(s => ({ s: bar * B + s, l: 2, m: r, v: 0.9 })));
      return song('BANANAGEDDON', 150, 9, 'minor', bars, [
        drumChannel('kick', beat('X...X...X...X...', bars), { p: { tune: 0.38, decay: 0.55, tone: 0.8, drive: 0.85 } }),
        drumChannel('clap', beat('....x.......x...', bars), { mix: { rev: 0.25 } }),
        drumChannel('open', beat('..x...x...x...x.', bars), { mix: { vol: 0.6, duck: 0.3 } }),
        drumChannel('ride', beat('o-x-o-x-o-x-o-x-', bars), { mix: { vol: 0.32 } }),
        synthChannel('reese', bass, { p: { cutoff: 0.55 }, mix: { duck: 0.65 } }),
        synthChannel('supersaw', saws, { mix: { duck: 0.65, rev: 0.25, vol: 0.62 } }),
        synthChannel('supersaw', hook, { name: 'Hook', p: { attack: 0 }, mix: { duck: 0.3, rev: 0.3, dly: 0.2, vol: 0.75 } }),
        synthChannel('squeak', line('. . . . . . . . . . . . . . 84 86', 3 * B), { mix: { vol: 0.5, rev: 0.25 } }),
      ], { master: { vol: 0.8, filter: 0, drive: 0.3 } });
    },
  },
];

export function blankSong(): Song {
  colorAt = 0;
  const bars = 2;
  return song('Untitled bunch', 124, 0, 'minor', bars, [
    drumChannel('kick', beat('.', bars)), drumChannel('clap', beat('.', bars)), drumChannel('hat', beat('.', bars)), drumChannel('open', beat('.', bars)),
    synthChannel('rolling', []), synthChannel('pluck', []), synthChannel('pad', []),
  ]);
}
