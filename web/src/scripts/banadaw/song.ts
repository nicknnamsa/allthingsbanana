// BanaDAW: the song format, scales, instruments and starter songs.
// A song is plain JSON, small enough to live in a share link.

export type Ripe = 0 | 1 | 2 | 3 | 4;   // 0 = off; 1 green (soft) … 4 brown (loudest)
export type Note = { s: number; l: number; d: number; v: Ripe };   // start step, length in steps, scale degree, ripeness
export type DrumLane = 'kick' | 'snare' | 'clap' | 'hat' | 'open' | 'perc' | 'shaker';
export type Kit = 'chill' | 'house' | 'rave';
export type Synth = 'keys' | 'pad' | 'pluck' | 'bass' | 'lead' | 'bell' | 'squeak';

export type Track =
  | { id: string; kind: 'drums'; name: string; kit: Kit; vol: number; pan: number; rev: number; dly: number; mute: boolean; solo: boolean }
  | { id: string; kind: 'synth'; name: string; synth: Synth; oct: number; tone: number; vol: number; pan: number; rev: number; dly: number; mute: boolean; solo: boolean };

export type Crate = {
  id: string; name: string; bars: 1 | 2 | 4; times: number;
  drums: Record<string, Partial<Record<DrumLane, Ripe[]>>>;   // track id → lane → one ripeness per step
  notes: Record<string, Note[]>;                              // track id → notes
};

export type Song = {
  v: 1; name: string; bpm: number; swing: number; root: number; scale: ScaleId;
  warmth: number; drive: number; pump: number;   // master: 0..1 each
  tracks: Track[]; crates: Crate[];
};

export const STEPS_PER_BAR = 16;
export const LANES: { id: DrumLane; label: string }[] = [
  { id: 'kick', label: 'Kick' }, { id: 'snare', label: 'Snare' }, { id: 'clap', label: 'Clap' },
  { id: 'hat', label: 'Hat' }, { id: 'open', label: 'Open hat' }, { id: 'perc', label: 'Perc' }, { id: 'shaker', label: 'Shaker' },
];
export const KITS: { id: Kit; label: string }[] = [
  { id: 'chill', label: 'Chill (soft, dusty)' }, { id: 'house', label: 'House (round, punchy)' }, { id: 'rave', label: 'Rave (hard, loud)' },
];
export const SYNTHS: { id: Synth; label: string }[] = [
  { id: 'keys', label: 'Keys (electric piano)' }, { id: 'pad', label: 'Pad (slow and wide)' }, { id: 'pluck', label: 'Pluck' },
  { id: 'bass', label: 'Bass' }, { id: 'lead', label: 'Lead (supersaw)' }, { id: 'bell', label: 'Bell' }, { id: 'squeak', label: 'Squeaky banana' },
];

export type ScaleId = 'major' | 'minor' | 'dorian' | 'penta-minor' | 'penta-major' | 'blues' | 'harmonic' | 'chromatic';
export const SCALES: { id: ScaleId; label: string; steps: number[] }[] = [
  { id: 'minor', label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', label: 'Dorian (jazzy minor)', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'penta-minor', label: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'penta-major', label: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
  { id: 'blues', label: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'harmonic', label: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'chromatic', label: 'Chromatic (all notes)', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const scaleOf = (id: ScaleId) => SCALES.find(s => s.id === id)!.steps;
// how many piano-roll rows: two octaves plus the top root
export const rowsFor = (id: ScaleId) => scaleOf(id).length * 2 + 1;
// scale degree → MIDI note, for a track's octave
export function midiOf(song: Song, oct: number, d: number) {
  const sc = scaleOf(song.scale), n = sc.length;
  return 12 * (oct + 1) + song.root + sc[((d % n) + n) % n] + 12 * Math.floor(d / n);
}
export const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const RIPE_GAIN = [0, 0.38, 0.62, 0.82, 1];
export const RIPE_NAMES = ['', 'Green (soft)', 'Yellow', 'Spotty', 'Brown (loudest)'];

let uid = 0;
export const newId = () => `${Date.now().toString(36)}${(uid++).toString(36)}`;
export const stepsOf = (c: Crate) => c.bars * STEPS_PER_BAR;

// ---------- share links: the song, compressed, in the address ----------
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function squash(way: 'compress' | 'decompress', data: Uint8Array): Promise<Uint8Array> {
  const S = way === 'compress' ? CompressionStream : DecompressionStream;
  const stream = new Blob([data]).stream().pipeThrough(new S('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function encodeSong(song: Song) {
  const raw = new TextEncoder().encode(JSON.stringify(song));
  try { return 'z' + b64(await squash('compress', raw)); } catch { return 'j' + b64(raw); }
}
export async function decodeSong(code: string): Promise<Song | null> {
  try {
    const bytes = unb64(code.slice(1));
    const raw = code[0] === 'z' ? await squash('decompress', bytes) : bytes;
    const s = JSON.parse(new TextDecoder().decode(raw));
    return s && s.v === 1 && Array.isArray(s.tracks) && Array.isArray(s.crates) ? s : null;
  } catch { return null; }
}

// ---------- starter songs ----------
const drumsTrack = (kit: Kit): Track => ({ id: 'drums', kind: 'drums', name: 'Drums', kit, vol: 0.85, pan: 0, rev: 0.08, dly: 0, mute: false, solo: false });
const synthTrack = (id: string, name: string, synth: Synth, oct: number, o: Partial<Track> = {}): Track =>
  ({ id, kind: 'synth', name, synth, oct, tone: 0.6, vol: 0.7, pan: 0, rev: 0.2, dly: 0, mute: false, solo: false, ...o } as Track);
// steps from a pattern string: '.' off, 1-4 ripeness, repeated to fill
const pat = (p: string, steps: number): Ripe[] => Array.from({ length: steps }, (_, i) => (p[i % p.length] === '.' ? 0 : Number(p[i % p.length])) as Ripe);
// chords as notes: each chord is a list of degrees, one per bar (or half bar)
const chords = (prog: number[][], stepsEach: number, v: Ripe = 3): Note[] => prog.flatMap((ch, i) => ch.map(d => ({ s: i * stepsEach, l: stepsEach, d, v })));
const line = (degs: (number | null)[], len: number, v: Ripe = 3): Note[] => degs.flatMap((d, i) => (d == null ? [] : [{ s: i * len, l: len, d, v }]));

export type Style = { id: string; label: string; blurb: string; make: () => Song };
export const STYLES: Style[] = [
  {
    id: 'chill', label: 'Chill', blurb: 'Lo-fi keys, soft drums, 80 BPM',
    make: () => {
      const tracks = [drumsTrack('chill'), synthTrack('keys', 'Keys', 'keys', 3, { rev: 0.35, dly: 0.15 }), synthTrack('bass', 'Bass', 'bass', 2, { tone: 0.35 }), synthTrack('bell', 'Bell', 'bell', 4, { vol: 0.45, rev: 0.45, dly: 0.35 })];
      const a: Crate = { id: newId(), name: 'Verse', bars: 2, times: 2, drums: { drums: { kick: pat('3......2..3.....', 32), snare: pat('....3.......3...', 32), hat: pat('2.1.2.1.2.1.2.1.', 32), shaker: pat('..1...1...1...1.', 32) } },
        notes: { keys: chords([[0, 2, 4, 6], [3, 5, 7, 9]], 16, 2), bass: line([0, null, null, null, null, null, 0, null, 3, null, null, null, null, null, 4, null], 2, 3), bell: line([null, null, null, null, 9, null, 7, null, null, null, null, null, 11, null, 9, null], 2, 2) } };
      const b: Crate = { id: newId(), name: 'Chorus', bars: 2, times: 2, drums: { drums: { kick: pat('3......2..3.....', 32), snare: pat('....3.......3...', 32), hat: pat('2121212121212121', 32), open: pat('..............2.', 32), shaker: pat('1.1.1.1.1.1.1.1.', 32) } },
        notes: { keys: chords([[5, 7, 9, 11], [4, 6, 8, 10]], 16, 3), bass: line([5, null, null, null, null, null, 5, null, 4, null, null, null, null, null, 4, null], 2, 3), bell: line([12, null, 11, null, 9, null, null, null, 7, null, 9, null, null, null, null, null], 2, 2) } };
      return { v: 1, name: 'Sunday afternoon peel', bpm: 80, swing: 0.25, root: 9, scale: 'minor', warmth: 0.55, drive: 0, pump: 0, tracks, crates: [a, b] };
    },
  },
  {
    id: 'pop', label: 'Banana pop', blurb: 'Bright plucks, claps, 110 BPM',
    make: () => {
      const tracks = [drumsTrack('house'), synthTrack('pluck', 'Pluck', 'pluck', 4, { dly: 0.25 }), synthTrack('pad', 'Pad', 'pad', 3, { vol: 0.5, rev: 0.4 }), synthTrack('bass', 'Bass', 'bass', 2)];
      const prog = [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]];
      const a: Crate = { id: newId(), name: 'Main', bars: 4, times: 2, drums: { drums: { kick: pat('3...3...3...3...', 64), clap: pat('....3.......3...', 64), hat: pat('..2...2...2...2.', 64), shaker: pat('1111', 64) } },
        notes: { pluck: prog.flatMap((ch, i) => [0, 3, 6, 8, 10, 12].map((st, j) => ({ s: i * 16 + st, l: 2, d: ch[j % 3] + 7 * (j > 2 ? 1 : 0), v: 3 as Ripe }))), pad: chords(prog, 16, 2),
          bass: prog.flatMap((ch, i) => [0, 6, 10].map(st => ({ s: i * 16 + st, l: 3, d: ch[0], v: 3 as Ripe }))) } };
      return { v: 1, name: 'Bunch of fun', bpm: 110, swing: 0.1, root: 0, scale: 'major', warmth: 0.25, drive: 0.1, pump: 0.2, tracks, crates: [a] };
    },
  },
  {
    id: 'house', label: 'House', blurb: 'Four to the floor, 124 BPM',
    make: () => {
      const tracks = [drumsTrack('house'), synthTrack('stab', 'Stabs', 'keys', 4, { tone: 0.8, dly: 0.3, rev: 0.25 }), synthTrack('bass', 'Bass', 'bass', 2, { tone: 0.55 }), synthTrack('pad', 'Pad', 'pad', 3, { vol: 0.45, rev: 0.5 })];
      const a: Crate = { id: newId(), name: 'Groove', bars: 2, times: 4, drums: { drums: { kick: pat('3...3...3...3...', 32), clap: pat('....3.......3...', 32), hat: pat('..3...3...3...3.', 32), open: pat('..............2.', 32), perc: pat('...1.....1...1..', 32) } },
        notes: { stab: [[0, 2, 4], [0, 2, 4], [3, 5, 7], [3, 5, 7]].flatMap((ch, i) => ch.map(d => ({ s: [3, 11, 19, 27][i], l: 2, d, v: 3 as Ripe }))), bass: line([0, null, 0, null, null, 0, null, 7, 3, null, 3, null, null, 3, null, 4], 2, 3), pad: chords([[0, 2, 4, 6], [3, 5, 7]], 16, 2) } };
      return { v: 1, name: 'Peel the floor', bpm: 124, swing: 0.15, root: 5, scale: 'dorian', warmth: 0.2, drive: 0.15, pump: 0.35, tracks, crates: [a] };
    },
  },
  {
    id: 'rave', label: 'Rave', blurb: 'Hard kick, gritty bass, 150 BPM',
    make: () => {
      const tracks = [drumsTrack('rave'), synthTrack('bass', 'Gritty bass', 'bass', 2, { tone: 0.9, vol: 0.75 }), synthTrack('lead', 'Supersaw', 'lead', 4, { rev: 0.3, dly: 0.2 }), synthTrack('squeak', 'Squeak', 'squeak', 5, { vol: 0.5, rev: 0.25 })];
      const riff = [7, null, 7, 9, 7, null, 5, 7, 4, null, 4, 5, 7, 9, 11, 9];
      const drop: Crate = { id: newId(), name: 'Drop', bars: 2, times: 4, drums: { drums: { kick: pat('4...4...4...4...', 32), clap: pat('....4.......4...', 32), hat: pat('2.3.2.3.2.3.2.3.', 32), open: pat('..3...3...3...3.', 32) } },
        notes: { bass: Array.from({ length: 8 }, (_, b) => [1, 2, 3].map(o => ({ s: b * 4 + o, l: 1, d: [0, 0, 5, 4][Math.floor(b / 2)], v: (o === 2 ? 4 : 3) as Ripe }))).flat(),
          lead: line([...riff, ...riff], 1, 3), squeak: line([7, null, null, null, 9, null, null, null, 11, null, null, null, 9, null, 7, null], 2, 3) } };
      const build: Crate = { id: newId(), name: 'Build', bars: 1, times: 2, drums: { drums: { snare: pat('3.3.3.3.4444' + '4444', 16), kick: pat('4...4...4...4...', 16) } }, notes: { squeak: line([7, 7, 9, 9, 11, 11, 12, 12], 2, 4) } };
      return { v: 1, name: 'BANANAGEDDON', bpm: 150, swing: 0, root: 9, scale: 'minor', warmth: 0, drive: 0.45, pump: 0.6, tracks, crates: [build, drop] };
    },
  },
];

export function blankSong(): Song {
  const tracks = [drumsTrack('house'), synthTrack('keys', 'Keys', 'keys', 3), synthTrack('bass', 'Bass', 'bass', 2)];
  return { v: 1, name: 'Untitled bunch', bpm: 112, swing: 0.1, root: 0, scale: 'minor', warmth: 0.2, drive: 0.1, pump: 0.2, tracks, crates: [{ id: newId(), name: 'Crate 1', bars: 2, times: 1, drums: {}, notes: {} }] };
}
