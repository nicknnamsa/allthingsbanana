// BanaDAW's sound. Every drum and synth is built from oscillators and noise with Web Audio, no samples.
// The same graph and voices play live (AudioContext) and render the WAV export (OfflineAudioContext).
import { type Song, type Channel, type DrumChannel, type SynthChannel, SYNTHS, stepsOf } from './song';

type Ctx = BaseAudioContext;
type Strip = { input: GainNode; fader: GainNode; pan: StereoPannerNode; duck: GainNode; rev: GainNode; dly: GainNode };
type Graph = {
  key: string; strips: Map<string, Strip>; sum: GainNode; hp: BiquadFilterNode; lp: BiquadFilterNode; pre: GainNode; shaper: WaveShaperNode; post: GainNode;
  out: GainNode; meter: AnalyserNode; dl: DelayNode; dr: DelayNode; noise: AudioBuffer;
};

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const curves = new Map<number, Float32Array>();
function curve(k: number) {
  k = Math.round(k * 10) / 10;
  let c = curves.get(k);
  if (!c) { c = new Float32Array(2048); for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } curves.set(k, c); }
  return c;
}
const keyOf = (song: Song) => song.ch.map(c => c.id).join('|');

function impulse(ctx: Ctx, secs: number) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const f = i / len, k = 0.35 + 0.6 * (1 - f); lp = lp * (1 - k) + (Math.random() * 2 - 1) * k; d[i] = lp * (1 - f) ** 2.6; }   // darker as it fades
  }
  return b;
}

// ---------- the mixer: a strip per channel, two sends, then the master chain ----------
function buildGraph(ctx: Ctx, song: Song, raw = false): Graph {
  const sum = ctx.createGain(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), pre = ctx.createGain(), shaper = ctx.createWaveShaper(), post = ctx.createGain();
  const glue = ctx.createDynamicsCompressor(), limit = ctx.createDynamicsCompressor(), out = ctx.createGain(), clip = ctx.createWaveShaper(), meter = ctx.createAnalyser();
  hp.type = 'highpass'; lp.type = 'lowpass'; shaper.oversample = '2x'; clip.curve = curve(1.1);
  glue.threshold.value = -16; glue.knee.value = 6; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.14;
  limit.threshold.value = -2; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.08;
  meter.fftSize = 1024;
  if (raw) { glue.ratio.value = 1; limit.ratio.value = 1; limit.threshold.value = 0; clip.curve = null; }   // for measuring levels
  sum.connect(hp).connect(lp).connect(pre).connect(shaper).connect(post).connect(glue).connect(out).connect(limit).connect(clip);
  clip.connect(meter); clip.connect(ctx.destination);
  // reverb (filtered so it never muddies the low end) and a ping-pong delay, both back into the master
  const revIn = ctx.createGain(), revHp = ctx.createBiquadFilter(), verb = ctx.createConvolver();
  revHp.type = 'highpass'; revHp.frequency.value = 280; verb.buffer = impulse(ctx, 2.6);
  revIn.connect(revHp).connect(verb).connect(sum);
  const dIn = ctx.createGain(), dHp = ctx.createBiquadFilter(), dl = ctx.createDelay(2), dr = ctx.createDelay(2), dLp = ctx.createBiquadFilter(), fbA = ctx.createGain(), fbB = ctx.createGain(), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner();
  dHp.type = 'highpass'; dHp.frequency.value = 350; dLp.type = 'lowpass'; dLp.frequency.value = 4500;
  fbA.gain.value = 0.42; fbB.gain.value = 0.42; pl.pan.value = -0.85; pr.pan.value = 0.85;
  dIn.connect(dHp).connect(dLp).connect(dl);
  dl.connect(pl).connect(sum); dl.connect(fbA).connect(dr);
  dr.connect(pr).connect(sum); dr.connect(fbB).connect(dl);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const strips = new Map<string, Strip>();
  for (const c of song.ch) {
    const input = ctx.createGain(), fader = ctx.createGain(), pan = ctx.createStereoPanner(), duck = ctx.createGain(), rev = ctx.createGain(), dly = ctx.createGain();
    input.connect(fader).connect(pan).connect(duck).connect(sum);
    duck.connect(rev).connect(revIn); duck.connect(dly).connect(dIn);
    strips.set(c.id, { input, fader, pan, duck, rev, dly });
  }
  const g: Graph = { key: keyOf(song), strips, sum, hp, lp, pre, shaper, post, out, meter, dl, dr, noise };
  applyMix(ctx, g, song, true);
  return g;
}

const audible = (song: Song, c: Channel) => !c.mix.mute && (!song.ch.some(x => x.mix.solo) || c.mix.solo);

function applyMix(ctx: Ctx, g: Graph, song: Song, now = false) {
  const t = ctx.currentTime, set = (p: AudioParam, v: number) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.02));
  for (const c of song.ch) {
    const s = g.strips.get(c.id);
    if (!s) continue;
    set(s.fader.gain, audible(song, c) ? c.mix.vol * c.mix.vol : 0);
    set(s.pan.pan, c.mix.pan);
    set(s.rev.gain, c.mix.rev * 0.8);
    set(s.dly.gain, c.mix.dly * 0.6);
  }
  const m = song.master, f = m.filter;
  set(g.lp.frequency, f < 0 ? 20000 * (180 / 20000) ** -f : 20000);
  set(g.hp.frequency, f > 0 ? 18 * (2600 / 18) ** f : 18);
  set(g.lp.Q, f < 0 ? 0.7 + -f * 3 : 0.7); set(g.hp.Q, f > 0 ? 0.7 + f * 3 : 0.7);
  set(g.pre.gain, 1 + m.drive * 2.5);
  g.shaper.curve = curve(1 + m.drive * 3);
  set(g.post.gain, 1 / (1 + m.drive * 1.6));
  set(g.out.gain, m.vol * m.vol * 1.25);
  const d = (60 / song.bpm) * 0.75;   // dotted eighth, the delay everyone uses
  set(g.dl.delayTime, d); set(g.dr.delayTime, d);
}

// ---------- drums ----------
// how loud each drum sits in the mix at full velocity (set by measuring the starter loops)
const TRIM: Record<DrumChannel['sound'], number> = { kick: 1, clap: 1.6, snare: 0.85, hat: 2.5, open: 1.8, ride: 2.5, crash: 1.25, rim: 1.8, tom: 2, cowbell: 2.5, shaker: 2.5, impact: 0.9 };
function drum(ctx: Ctx, g: Graph, dest: AudioNode, c: DrumChannel, t: number, v: number) {
  const p = c.p, tune = 2 ** ((p.tune - 0.5) * 1.4), dm = 0.35 + p.decay * 1.3;
  const out = ctx.createGain(); out.gain.value = v * v * TRIM[c.sound];
  let into: AudioNode = out;
  if (p.drive > 0.02) { const sh = ctx.createWaveShaper(), pg = ctx.createGain(); sh.curve = curve(1 + p.drive * 10); sh.oversample = '2x'; pg.gain.value = 1 / (1 + p.drive * 1.1); sh.connect(pg).connect(out); into = sh; }
  out.connect(dest);
  const stopAll: AudioScheduledSourceNode[] = [];
  const noise = () => { const n = ctx.createBufferSource(); n.buffer = g.noise; n.loop = true; n.start(t, Math.random() * 1.5); stopAll.push(n); return n; };
  const osc = (type: OscillatorType, f: number) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); stopAll.push(o); return o; };
  const env = (peak: number, len: number, attack = 0.0015) => {
    const e = ctx.createGain(), q = e.gain;
    q.setValueAtTime(0, t); q.linearRampToValueAtTime(peak, t + attack); q.exponentialRampToValueAtTime(0.0005, t + attack + len); q.setValueAtTime(0, t + attack + len + 0.005);
    return e;
  };
  const filt = (type: BiquadFilterType, f: number, Q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = Math.min(f, 20000); b.Q.value = Q; return b; };
  let len = 0.5;
  const metal = (base: number, ratios = [2, 3, 4.16, 5.43, 6.79, 8.21]) => { const mix = ctx.createGain(); mix.gain.value = 0.22; for (const r of ratios) osc('square', base * r).connect(mix); return mix; };

  switch (c.sound) {
    case 'kick': {
      const f0 = 48 * tune, dec = 0.42 * dm, o = osc('sine', f0), e = ctx.createGain(), lp = filt('lowpass', 9000);
      o.frequency.setValueAtTime(f0 * 9, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.011); o.frequency.exponentialRampToValueAtTime(f0, t + 0.075);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.002); e.gain.setValueAtTime(1, t + dec * 0.22); e.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      o.connect(e).connect(lp).connect(into);
      if (p.tone > 0.02) {   // the click on top
        noise().connect(filt('highpass', 2800)).connect(env(0.55 * p.tone, 0.006)).connect(into);
        osc('triangle', 1500 * tune).connect(env(0.35 * p.tone, 0.008)).connect(into);
      }
      len = dec;
      break;
    }
    case 'clap': {
      const e = ctx.createGain(), q = e.gain, tail = 0.17 * dm;
      q.setValueAtTime(0, t);
      for (const d of [0, 0.0095, 0.019, 0.029]) { q.setValueAtTime(1, t + d); q.exponentialRampToValueAtTime(0.18, t + d + 0.0085); }
      q.exponentialRampToValueAtTime(0.0005, t + 0.03 + tail); q.setValueAtTime(0, t + 0.035 + tail);
      noise().connect(filt('bandpass', (1050 + p.tone * 1300) * tune, 1.6)).connect(filt('highpass', 650)).connect(e).connect(into);
      len = 0.04 + tail;
      break;
    }
    case 'snare': {
      const body = osc('triangle', 195 * tune), b2 = osc('sine', 335 * tune);
      body.frequency.setValueAtTime(240 * tune, t); body.frequency.exponentialRampToValueAtTime(180 * tune, t + 0.05);
      body.connect(env(0.75 * (1 - p.tone * 0.5), 0.12 * dm)).connect(into);
      b2.connect(env(0.3, 0.06 * dm)).connect(into);
      noise().connect(filt('highpass', 1700)).connect(filt('lowpass', 9500)).connect(env(0.55 * (0.5 + p.tone), 0.2 * dm)).connect(into);
      len = 0.25 * dm;
      break;
    }
    case 'hat': case 'open': {
      const open = c.sound === 'open', dec = (open ? 0.33 : 0.05) * dm;
      const bus = ctx.createGain();
      metal(40 * tune).connect(bus);
      const nz = ctx.createGain(); nz.gain.value = 0.25 + p.tone * 0.6; noise().connect(nz).connect(bus);
      bus.connect(filt('bandpass', 10000, 0.9)).connect(filt('highpass', 6500 + p.tone * 2000)).connect(env(0.5, dec)).connect(into);
      len = dec;
      break;
    }
    case 'ride': {
      const dec = 1.1 * dm, bus = ctx.createGain();
      metal(60 * tune, [2, 3, 4.16, 5.43, 6.79, 8.21, 11.3]).connect(bus);
      bus.connect(filt('bandpass', 7600, 1.2)).connect(filt('highpass', 3500)).connect(env(0.45, dec)).connect(into);
      osc('sine', 620 * tune).connect(env(0.06 + p.tone * 0.1, dec * 0.6)).connect(into);
      len = dec;
      break;
    }
    case 'crash': {
      const dec = 2 * dm, bus = ctx.createGain();
      metal(55 * tune).connect(bus);
      const nz = ctx.createGain(); nz.gain.value = 0.9; noise().connect(nz).connect(bus);
      const lp = filt('lowpass', 12000); lp.frequency.setValueAtTime(14000, t); lp.frequency.exponentialRampToValueAtTime(4000 + p.tone * 6000, t + dec);
      bus.connect(filt('highpass', 2400)).connect(lp).connect(env(0.5, dec, 0.003)).connect(into);
      len = dec;
      break;
    }
    case 'rim': {
      const bus = ctx.createGain();
      osc('triangle', 1700 * tune).connect(bus); osc('square', 470 * tune).connect(bus);
      noise().connect(filt('highpass', 4000)).connect(env(0.2 + p.tone * 0.3, 0.008)).connect(into);
      bus.connect(filt('bandpass', 2200, 1.4)).connect(env(0.7, 0.03 * dm)).connect(into);
      len = 0.06;
      break;
    }
    case 'tom': {
      const f = 105 * tune, o = osc('sine', f), dec = 0.38 * dm;
      o.frequency.setValueAtTime(f * (1.4 + p.tone), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      o.connect(env(0.9, dec)).connect(into);
      noise().connect(filt('bandpass', 3000)).connect(env(0.12, 0.02)).connect(into);
      len = dec;
      break;
    }
    case 'cowbell': {
      const bus = ctx.createGain(), e = ctx.createGain(), q = e.gain, dec = 0.32 * dm;
      osc('square', 587 * tune).connect(bus); osc('square', 845 * tune).connect(bus);
      q.setValueAtTime(0, t); q.linearRampToValueAtTime(0.6, t + 0.001); q.exponentialRampToValueAtTime(0.25, t + 0.03); q.exponentialRampToValueAtTime(0.0005, t + dec); q.setValueAtTime(0, t + dec + 0.005);
      bus.connect(filt('bandpass', 2640 * tune, 1.1 + p.tone)).connect(e).connect(into);
      len = dec;
      break;
    }
    case 'shaker': {
      const dec = 0.07 * dm;
      noise().connect(filt('bandpass', (6500 + p.tone * 3500) * tune, 2.4)).connect(env(0.7, dec, 0.014)).connect(into);
      len = dec + 0.02;
      break;
    }
    case 'impact': {
      const dec = 1.8 * dm, o = osc('sine', 70 * tune);
      o.frequency.setValueAtTime(90 * tune, t); o.frequency.exponentialRampToValueAtTime(30 * tune, t + dec * 0.6);
      o.connect(env(1, dec)).connect(into);
      const lp = filt('lowpass', 8000); lp.frequency.setValueAtTime(7000 + p.tone * 6000, t); lp.frequency.exponentialRampToValueAtTime(140, t + dec);
      noise().connect(lp).connect(env(0.5, dec)).connect(into);
      len = dec;
      break;
    }
  }
  for (const s of stopAll) s.stop(t + len + 0.1);
}

// ---------- synths ----------
type Voice = { legato: (m: number, at: number, end: number) => void; cut: (at: number) => void };
function synth(ctx: Ctx, g: Graph, dest: AudioNode, c: SynthChannel, m: number, t: number, dur: number, v: number, bpm: number): Voice {
  const pt = SYNTHS[c.preset], p = c.p;
  const cut = 30 * 2 ** (p.cutoff * 9.3), Q = 0.5 + p.res * p.res * 20, envOct = p.env * 6 * (0.35 + 0.65 * v);
  const atk = 0.0015 + p.attack ** 3 * 2.5, rel = 0.015 + p.release ** 2 * 2.5, glide = 0.035 + p.glide ** 2 * 0.4;
  const level = pt.lvl * (0.3 + 0.7 * v);
  const amp = ctx.createGain(); amp.connect(dest);
  const srcs: AudioScheduledSourceNode[] = [], freqs: { p: AudioParam; ratio: number }[] = [];
  let end = t + Math.max(dur, atk + 0.005);
  const stopAt = () => srcs.forEach(s => s.stop(end + rel * 1.6 + 0.05));
  const ampEnv = (lvl: number, sus: number, dec: number) => {
    const q = amp.gain;
    q.setValueAtTime(0, t); q.linearRampToValueAtTime(lvl, t + atk);
    q.setTargetAtTime(lvl * sus, t + atk, Math.max(0.01, dec / 3));
    q.setTargetAtTime(0, end, rel / 4);
  };
  const handle: Voice = {
    legato(m2, at, end2) {   // mono: slide to the next note without starting again
      for (const f of freqs) f.p.setTargetAtTime(hz(m2) * f.ratio, at, glide / 3);
      amp.gain.cancelScheduledValues(at);
      end = end2; amp.gain.setTargetAtTime(0, end, rel / 4);
      stopAt();
    },
    cut(at) { amp.gain.cancelScheduledValues(at); amp.gain.setTargetAtTime(0, at, 0.004); end = at; srcs.forEach(s => s.stop(at + 0.05)); },
  };
  const f = hz(m);

  if (pt.special === 'fm' || pt.special === 'bell') {
    const bell = pt.special === 'bell';
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), idx = ctx.createGain();
    const ratio = bell ? 3.5 : 1;
    car.frequency.value = f; mod.frequency.value = f * ratio;
    const i0 = f * (bell ? 1.2 + p.cutoff * 3 : 0.4 + p.cutoff * 3.5) * (0.5 + v * 0.7);
    idx.gain.setValueAtTime(i0, t); idx.gain.exponentialRampToValueAtTime(Math.max(1, i0 * 0.08), t + (bell ? 1.6 : 0.9));
    mod.connect(idx).connect(car.frequency); car.connect(amp);
    srcs.push(car, mod);
    if (!bell && p.env > 0.02) {   // the tine "bark" at the start of each note
      const tine = ctx.createOscillator(), tg = ctx.createGain(); tine.frequency.value = f * 14;
      tg.gain.setValueAtTime(f * 2 * p.env, t); tg.gain.exponentialRampToValueAtTime(1, t + 0.05);
      tine.connect(tg).connect(car.frequency); srcs.push(tine);
    }
    if (bell) { const q = amp.gain, ring = 1 + p.release * 4; q.setValueAtTime(0, t); q.linearRampToValueAtTime(level, t + atk); q.exponentialRampToValueAtTime(0.0005, t + atk + ring); end = t + atk + ring; }
    else ampEnv(level, pt.sus, pt.dec);
    srcs.forEach(s => s.start(t)); stopAt();
    return handle;
  }

  if (pt.special === 'riser') {   // noise and a saw sweeping up for the length of the note
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), saw = ctx.createOscillator(), sg = ctx.createGain();
    n.buffer = g.noise; n.loop = true; bp.type = 'bandpass'; bp.Q.value = 1 + p.res * 10;
    const top = Math.min(16000, cut * 2 ** (p.env * 6) + 400);
    bp.frequency.setValueAtTime(Math.max(80, cut), t); bp.frequency.exponentialRampToValueAtTime(top, end);
    saw.type = 'sawtooth'; saw.frequency.setValueAtTime(f / 2, t); saw.frequency.exponentialRampToValueAtTime(f * 2, end); sg.gain.value = 0.12;
    n.connect(bp).connect(amp); saw.connect(sg).connect(bp);
    const q = amp.gain; q.setValueAtTime(0.0005, t); q.exponentialRampToValueAtTime(level, end); q.setTargetAtTime(0, end, 0.01 + rel * 0.15);
    n.start(t, Math.random()); saw.start(t); srcs.push(n, saw); stopAt();
    return handle;
  }

  if (pt.special === 'squeak') {   // the squeaky rubber banana
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), o2g = ctx.createGain(), bp = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'square';
    for (const x of [o, o2]) { x.frequency.setValueAtTime(f * 0.7, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.035); x.frequency.setValueAtTime(f, t + dur * 0.75); x.frequency.exponentialRampToValueAtTime(f * 1.1, t + dur); }
    lfo.frequency.value = 24; lg.gain.value = 30 + p.env * 40; lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
    o2g.gain.value = 0.25; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.1;
    o.connect(bp).connect(amp); o2.connect(o2g).connect(bp); o.connect(amp);
    srcs.push(o, o2, lfo); ampEnv(level, pt.sus, pt.dec);
    srcs.forEach(s => s.start(t)); stopAt();
    return handle;
  }

  // the subtractive synth: oscillators (with unison), a resonant low-pass with its own envelope, drive, then the amp
  const wide = pt.osc.some(o => (o.n ?? 1) > 1);
  const sides = wide ? [-0.7, 0.7] : [0];
  const chains = sides.map(pan => {
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = Q;
    const peak = Math.min(18000, cut * 2 ** envOct), floor = Math.min(18000, cut);
    flt.frequency.setValueAtTime(peak, t);
    if (envOct > 0.01) flt.frequency.setTargetAtTime(floor, t + atk * 0.5, Math.max(0.01, pt.fdec / 2.2));
    let last: AudioNode = flt;
    if (p.drive > 0.02) { const sh = ctx.createWaveShaper(), pg = ctx.createGain(); sh.curve = curve(1 + p.drive * 10); pg.gain.value = 1 / (1 + p.drive * 2); last.connect(sh).connect(pg); last = pg; }
    if (wide) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; last.connect(pn); last = pn; }
    last.connect(amp);
    return flt;
  });
  for (const o of pt.osc) {
    const n = o.n ?? 1, ratio = 2 ** ((o.o ?? 0) / 12);
    // unison voices alternate left and right; a single oscillator feeds both sides (so it sits in the middle)
    const sideGains = chains.map(ch => { const gn = ctx.createGain(); gn.gain.value = ((o.g ?? 1) / Math.sqrt(n)) * (n === 1 && chains.length > 1 ? 0.6 : chains.length > 1 ? 1.3 : 1); gn.connect(ch); return gn; });
    for (let i = 0; i < n; i++) {
      const osc = ctx.createOscillator(); osc.type = o.w;
      osc.detune.value = n > 1 ? ((i / (n - 1)) * 2 - 1) * (o.spr ?? 0) : 0;
      osc.frequency.value = f * ratio;
      if (n === 1) sideGains.forEach(sg => osc.connect(sg)); else osc.connect(sideGains[i % sideGains.length]);
      srcs.push(osc); freqs.push({ p: osc.frequency, ratio });
    }
  }
  if (pt.sub) { const s = ctx.createOscillator(), sg = ctx.createGain(); s.frequency.value = f / 2; sg.gain.value = pt.sub * 0.55; s.connect(sg).connect(amp); srcs.push(s); freqs.push({ p: s.frequency, ratio: 0.5 }); }
  ampEnv(level, pt.sus, pt.dec);
  srcs.forEach(s => s.start(t)); stopAt();
  return handle;
}

// ---------- what plays on one step: shared by live playback and the WAV export ----------
class Player {
  mono = new Map<string, { h: Voice; end: number }>();
  constructor(public ctx: Ctx, public g: Graph, public song: Song) {}
  step(step: number, t: number, stepDur: number) {
    const song = this.song;
    let kick = 0;
    for (const c of song.ch) {
      const s = this.g.strips.get(c.id);
      if (!s || !audible(song, c)) continue;
      if (c.kind === 'drum') {
        const v = c.steps[step] || 0;
        if (!v) continue;
        drum(this.ctx, this.g, s.input, c, t, v);
        if (c.sound === 'kick') kick = Math.max(kick, v);
      } else {
        const pt = SYNTHS[c.preset];
        for (const n of c.notes) {
          if (Math.floor(n.s) !== step) continue;
          const at = t + (n.s - step) * stepDur, end = at + n.l * stepDur * 0.97;
          if (pt.mono) {
            const prev = this.mono.get(c.id);
            if (prev && prev.end > at + 0.003) { prev.h.legato(n.m, at, end); prev.end = end; continue; }
            if (prev && prev.end + 0.3 > at) prev.h.cut(at);
            this.mono.set(c.id, { h: synth(this.ctx, this.g, s.input, c, n.m, at, end - at, n.v, song.bpm), end });
          } else synth(this.ctx, this.g, s.input, c, n.m, at, end - at, n.v, song.bpm);
        }
      }
    }
    // sidechain: everything with "duck" dips on the kick and swells back
    if (kick) for (const c of song.ch) {
      if (!c.mix.duck) continue;
      const q = this.g.strips.get(c.id)?.duck.gain;
      if (!q) continue;
      q.cancelScheduledValues(t);
      q.setTargetAtTime(1 - c.mix.duck * 0.92 * kick, t, 0.003);
      q.setTargetAtTime(1, t + 0.03, (60 / song.bpm) * 0.13);
    }
  }
}
const swingAt = (song: Song, step: number, stepDur: number) => (step % 2 ? song.swing * stepDur * 0.5 : 0);

// ---------- the live player ----------
export class Engine {
  ctx: AudioContext | null = null;
  song!: Song;
  private g: Graph | null = null;
  private player: Player | null = null;
  playing = false;
  private step = 0; private next = 0; private timer: number | null = null;
  private queue: { t: number; step: number }[] = [];
  private buf: Float32Array<ArrayBuffer> | null = null;

  private ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.g || this.g.key !== keyOf(this.song)) this.rebuild();
  }
  private rebuild() {
    const old = this.g;
    this.g = buildGraph(this.ctx!, this.song);
    this.player = new Player(this.ctx!, this.g, this.song);
    if (old) { const q = old.out.gain; q.setTargetAtTime(0, this.ctx!.currentTime, 0.02); setTimeout(() => old.out.disconnect(), 300); }
  }
  setSong(song: Song) {
    this.song = song;
    if (!this.ctx || !this.g) return;
    if (this.g.key !== keyOf(song)) this.rebuild();
    else { applyMix(this.ctx, this.g, song); this.player!.song = song; }
  }
  play() {
    this.ensure();
    this.step = 0; this.next = this.ctx!.currentTime + 0.05; this.queue = [];
    this.playing = true;
    if (this.timer == null) this.timer = window.setInterval(() => this.schedule(), 20);
    this.schedule();
  }
  stop() { this.playing = false; if (this.timer != null) clearInterval(this.timer); this.timer = null; this.queue = []; this.player?.mono.clear(); }
  private schedule() {
    if (!this.ctx || !this.player || !this.playing) return;
    const stepDur = 60 / this.song.bpm / 4, steps = stepsOf(this.song);
    while (this.next < this.ctx.currentTime + 0.12) {
      this.step %= steps;
      const t = this.next + swingAt(this.song, this.step, stepDur);
      this.player.step(this.step, t, stepDur);
      this.queue.push({ t: this.next, step: this.step });
      if (this.queue.length > 32) this.queue.shift();
      this.next += stepDur;
      this.step++;
    }
  }
  // where the playhead is, in steps (with a fraction, so it moves smoothly)
  position(): number | null {
    if (!this.ctx || !this.playing) return null;
    const now = this.ctx.currentTime - (this.ctx.outputLatency || 0), stepDur = 60 / this.song.bpm / 4;
    let last = null;
    for (const q of this.queue) if (q.t <= now) last = q;
    return last ? last.step + Math.min(1, (now - last.t) / stepDur) : null;
  }
  // the output level, 0..1, for the meter
  level() {
    if (!this.g || !this.ctx) return 0;
    const a = this.g.meter;
    if (!this.buf || this.buf.length !== a.fftSize) this.buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(this.buf);
    let peak = 0; for (const x of this.buf) peak = Math.max(peak, Math.abs(x));
    return peak;
  }
  // hear one note or hit straight away (clicking the piano roll, a key or a pad)
  preview(c: Channel, m = 60, v = 0.8) {
    this.ensure();
    const s = this.g!.strips.get(c.id), t = this.ctx!.currentTime + 0.005;
    if (!s) return;
    if (c.kind === 'drum') drum(this.ctx!, this.g!, s.input, c, t, v);
    else synth(this.ctx!, this.g!, s.input, c, m, t, c.preset === 'riser' ? 1.2 : 0.3, v, this.song.bpm);
  }
}

// ---------- export: the loop, a few times round, as a WAV file ----------
export async function renderWav(song: Song, loops = 4) {
  const stepDur = 60 / song.bpm / 4, steps = stepsOf(song);
  const total = steps * loops * stepDur + 3;
  const rate = 44100, ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  const g = buildGraph(ctx, song), player = new Player(ctx, g, song);
  let t = 0.05;
  for (let r = 0; r < loops; r++) for (let s = 0; s < steps; s++) { player.step(s, t + swingAt(song, s, stepDur), stepDur); t += stepDur; }
  return wav(await ctx.startRendering());
}
function wav(buf: AudioBuffer) {
  const ch = buf.numberOfChannels, len = buf.length, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}

// for testing: render the loop once and measure each channel on its own
export async function measure(song: Song, raw = true) {
  const res: Record<string, { peak: number; rms: number }> = {};
  const run = async (s: Song) => {
    const stepDur = 60 / s.bpm / 4, steps = stepsOf(s), ctx = new OfflineAudioContext(2, Math.ceil((steps * stepDur + 1.5) * 44100), 44100);
    const g = buildGraph(ctx, s, raw), p = new Player(ctx, g, s);
    for (let i = 0; i < steps; i++) p.step(i, 0.05 + i * stepDur + swingAt(s, i, stepDur), stepDur);
    const b = await ctx.startRendering(), d = b.getChannelData(0);
    let peak = 0, sq = 0; for (const x of d) { peak = Math.max(peak, Math.abs(x)); sq += x * x; }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sq / d.length).toFixed(4) };
  };
  res.all = await run(song);
  for (const c of song.ch) res[c.name] = await run({ ...song, ch: song.ch.map(x => ({ ...x, mix: { ...x.mix, solo: x.id === c.id } })) });
  return res;
}
