// Banana Sound Lab: a fast, bassy hard-dance loop synthesised live with Web Audio.
// Nothing is sampled: the kick, the off-beat "reverse" bass and the "oh-ee-ee-ah" chant voice
// (a buzzy tone pushed through vowel-shaped filters) are all built from oscillators and noise.

export type Settings = {
  bpm: number;        // 130..175
  drive: number;      // kick distortion 0..10
  bass: number;       // off-beat bass level 0..10
  voice: number;      // chant level 0..10
  pitch: number;      // chant pitch, semitones -12..12
  cutoff: number;     // master filter 0..10 (10 = wide open)
  reverb: number;     // 0..10
  parts: { kick: boolean; bass: boolean; hats: boolean; clap: boolean; voice: boolean };
};

export const DEFAULTS: Settings = {
  bpm: 155, drive: 6, bass: 6, voice: 6, pitch: 0, cutoff: 10, reverb: 3,
  parts: { kick: true, bass: true, hats: true, clap: true, voice: true },
};

// vowel shapes: the three strongest resonances (formants) of a voice saying each vowel, in Hz
const VOWELS: Record<string, [number, number, number]> = {
  o: [430, 820, 2700],
  i: [280, 2250, 3000],
  a: [760, 1150, 2500],
};

// the chant: one "oh-ee-ee-ah" per half bar. step (16ths), length in steps, notes in semitones
// above A3, and the vowel it moves through. An original melody that rises on "oi" and falls on "a".
const CHANT: { at: number; len: number; from: string; to: string; n0: number; n1: number }[] = [
  { at: 0, len: 2, from: 'o', to: 'i', n0: 3, n1: 7 },
  { at: 2, len: 1, from: 'i', to: 'i', n0: 10, n1: 10 },
  { at: 3, len: 3, from: 'i', to: 'a', n0: 12, n1: 5 },
  { at: 8, len: 2, from: 'o', to: 'i', n0: 3, n1: 7 },
  { at: 10, len: 1, from: 'i', to: 'i', n0: 10, n1: 10 },
  { at: 11, len: 3, from: 'i', to: 'a', n0: 15, n1: 7 },
];
// the key moves every bar: A minor, F, C, G (in semitones from A)
const ROOTS = [0, -4, 3, -2];

export class HardBass {
  ctx: AudioContext | null = null;
  s: Settings = structuredClone(DEFAULTS);
  playing = false;
  onKick: (() => void) | null = null;

  private master!: GainNode;
  private filter!: BiquadFilterNode;
  private duck!: GainNode;        // pumps the bass and voice out of the way of each kick
  private wet!: GainNode;
  private noise!: AudioBuffer;
  private curve!: Float32Array;
  private queue: { t: number; step: number }[] = [];   // when each recent step plays, for the visuals
  private next = 0;
  private step = 0;
  private timer: number | null = null;
  private build: { from: number; steps: number } | null = null;   // build-up in progress

  private get STEP() { return 60 / this.s.bpm / 4; }

  // must be called from a click (browsers only allow sound after the visitor interacts)
  private ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = 0.5;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1.2;
    this.duck = c.createGain();
    this.wet = c.createGain();
    const verb = c.createConvolver();
    verb.buffer = this.impulse(2.2);
    // a gentle limiter at the end so it can be loud without crackling
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.12;
    this.duck.connect(this.filter);
    this.filter.connect(this.master);
    this.filter.connect(verb).connect(this.wet).connect(this.master);
    this.master.connect(comp).connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
  }

  private impulse(secs: number) {
    const c = this.ctx!, len = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.5;
    }
    return b;
  }

  // push the current settings into the audio graph
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.s;
    if (!this.build) this.filter.frequency.setTargetAtTime(this.cutoffHz(), t, 0.05);
    this.wet.gain.setTargetAtTime(s.reverb / 10 * 0.5, t, 0.05);
    // kick distortion: a soft-clipping curve that gets harder with the drive knob
    const k = 1 + s.drive * 4, n = 2048;
    this.curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; this.curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  }
  private cutoffHz() { return 300 * (18000 / 300) ** (this.s.cutoff / 10); }

  start() {
    this.ensure();
    if (this.playing || !this.ctx) return;
    this.playing = true;
    this.next = this.ctx.currentTime + 0.06;
    this.step = 0;
    this.queue = [];
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() {
    this.playing = false;
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
    this.build = null;
    if (this.ctx) this.filter.frequency.setTargetAtTime(this.cutoffHz(), this.ctx.currentTime, 0.05);
  }

  // two bars of rising snare roll, riser and closing filter, then everything drops back in
  buildUp() {
    if (!this.playing || !this.ctx || this.build) return;
    const from = this.step + (16 - (this.step % 16)) % 16;   // start on the next bar line
    this.build = { from, steps: 32 };
    const t0 = this.next + (from - this.step) * this.STEP;
    const dur = 32 * this.STEP;
    this.filter.frequency.cancelScheduledValues(t0);
    this.filter.frequency.setValueAtTime(this.cutoffHz(), t0);
    this.filter.frequency.exponentialRampToValueAtTime(Math.min(this.cutoffHz(), 700), t0 + dur);
    this.riser(t0, dur);
  }

  // where we are in the beat, for the spinning banana
  beat() {
    if (!this.ctx || !this.playing) return { phase: 0, n: 0, playing: false };
    const now = this.ctx.currentTime;
    let last = this.queue[0];
    for (const q of this.queue) if (q.t <= now) last = q;
    if (!last) return { phase: 0, n: 0, playing: true };
    const steps = last.step + Math.min(1, (now - last.t) / this.STEP);
    return { phase: (steps % 4) / 4, n: Math.floor(steps / 4), playing: true };
  }

  private schedule() {
    if (!this.ctx) return;
    while (this.next < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.next);
      this.queue.push({ t: this.next, step: this.step });
      if (this.queue.length > 32) this.queue.shift();
      this.next += this.STEP;
      this.step++;
    }
  }

  private play(step: number, t: number) {
    const i = step % 16, bar = Math.floor(step / 16), p = this.s.parts;
    let b = this.build && step >= this.build.from ? step - this.build.from : -1;
    if (this.build && b >= this.build.steps) {
      b = -1;
      // the drop: filter slams open, a big crash-y noise hit
      this.build = null;
      this.filter.frequency.cancelScheduledValues(t);
      this.filter.frequency.setValueAtTime(this.cutoffHz(), t);
      this.impact(t);
    }
    const building = b >= 0;
    const root = ROOTS[bar % 4];

    if (building) {
      // snare roll: quarters, then eighths, then sixteenths
      const every = b < 16 ? 4 : b < 24 ? 2 : 1;
      if (b % every === 0) this.snare(t, 0.25 + (b / 32) * 0.5);
      if (p.kick && b < 16 && i % 4 === 0) this.kick(t, 0.55);
      if (p.voice && b >= 24 && i % 2 === 0) this.voiceNote(t, this.STEP * 1.6, 'o', 'i', 12 + root + (b - 24), 12 + root + (b - 24) + 2);
      return;
    }
    if (p.kick && i % 4 === 0) { this.kick(t, 1); this.pump(t); }
    if (p.bass && i % 4 !== 0) this.bass(t, root, i % 4);
    if (p.hats && i % 4 === 2) this.hat(t, 0.08, 0.09);
    if (p.hats && i % 2 === 1) this.hat(t, 0.025, 0.035);
    if (p.clap && (i === 4 || i === 12)) this.clap(t);
    if (p.voice) for (const n of CHANT) if (n.at === i) this.voiceNote(t, n.len * this.STEP, n.from, n.to, n.n0 + root, n.n1 + root);
  }

  // hardstyle kick: a click, then a punchy pitched body pushed through the distortion
  private kick(t: number, vol: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain(), pre = c.createGain(), lp = c.createBiquadFilter(), sh = c.createWaveShaper();
    sh.curve = this.curve; sh.oversample = '4x';
    o.type = 'sine';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(130, t + 0.025);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.28);
    pre.gain.value = 1 + this.s.drive * 0.6;
    lp.type = 'lowpass'; lp.frequency.value = 2200 + this.s.drive * 500;
    const len = Math.min(0.36, this.STEP * 3.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + len * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(pre).connect(sh).connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + len + 0.02);
    if (this.onKick) {
      const delay = Math.max(0, (t - c.currentTime) * 1000);
      setTimeout(() => this.onKick?.(), delay);
    }
  }

  // sidechain: the bass and voice dip on every kick and swell back
  private pump(t: number) {
    const g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.15, t);
    g.linearRampToValueAtTime(1, t + this.STEP * 3);
  }

  // off-beat "reverse" bass: three 16ths between kicks, each swelling up into the next
  private bass(t: number, root: number, sub: number) {
    const c = this.ctx!, s = this.s, vol = (s.bass / 10) * 0.32;
    if (!vol) return;
    const hz = 55 * 2 ** (root / 12) * (sub === 3 ? 2 : 1);
    const lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(1600 + s.drive * 150, t + this.STEP * 0.9);
    g.gain.setValueAtTime(vol * 0.3, t);
    g.gain.linearRampToValueAtTime(vol, t + this.STEP * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + this.STEP);
    for (const detune of [-9, 9]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = detune;
      o.connect(lp); o.start(t); o.stop(t + this.STEP + 0.01);
    }
    const sub0 = c.createOscillator();
    sub0.type = 'sine'; sub0.frequency.value = hz / (sub === 3 ? 2 : 1);
    sub0.connect(g); sub0.start(t); sub0.stop(t + this.STEP + 0.01);
    lp.connect(g).connect(this.duck);
  }

  // the chant voice: a buzzy tone through three vowel filters that glide from one vowel to the next
  private voiceNote(t: number, len: number, from: string, to: string, n0: number, n1: number) {
    const c = this.ctx!, s = this.s, vol = (s.voice / 10) * 0.5;
    if (!vol) return;
    const shift = s.pitch;
    const f0 = 220 * 2 ** ((n0 + shift) / 12), f1 = 220 * 2 ** ((n1 + shift) / 12);
    const src = c.createGain();
    const oscs: OscillatorNode[] = [];
    for (const [type, det, lvl] of [['sawtooth', -6, 0.6], ['sawtooth', 6, 0.6], ['square', 0, 0.25]] as const) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.detune.value = det; og.gain.value = lvl;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.7);
      o.connect(og).connect(src);
      oscs.push(o);
    }
    // a little vibrato, like a held sung note
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.frequency.value = 6.5; lfoG.gain.value = 18;
    lfo.connect(lfoG);
    for (const o of oscs) lfoG.connect(o.detune);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    out.gain.setValueAtTime(vol, t + len * 0.75);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const A = VOWELS[from], B = VOWELS[to];
    [1, 0.55, 0.3].forEach((amp, k) => {
      const bp = c.createBiquadFilter(), bg = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = [9, 12, 14][k];
      bp.frequency.setValueAtTime(A[k], t);
      bp.frequency.linearRampToValueAtTime(B[k], t + len * 0.6);
      bg.gain.value = amp * 3;
      src.connect(bp).connect(bg).connect(out);
    });
    out.connect(this.duck);
    for (const o of oscs) { o.start(t); o.stop(t + len + 0.02); }
    lfo.start(t); lfo.stop(t + len + 0.02);
  }

  private hat(t: number, len: number, vol: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass'; f.frequency.value = 8000;
    g.gain.setValueAtTime(vol * 3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f).connect(g).connect(this.filter);
    n.start(t, Math.random()); n.stop(t + len + 0.01);
  }
  private clap(t: number) {
    const c = this.ctx!, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9;
    f.connect(g).connect(this.filter);
    g.gain.setValueAtTime(0.0001, t);
    // three quick bursts, like several hands
    for (const d of [0, 0.012, 0.024]) { g.gain.setValueAtTime(0.7, t + d); g.gain.exponentialRampToValueAtTime(0.15, t + d + 0.01); }
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const n = c.createBufferSource(); n.buffer = this.noise;
    n.connect(f); n.start(t, Math.random()); n.stop(t + 0.22);
  }
  private snare(t: number, vol: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.7;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.1);
  }
  private riser(t: number, dur: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; n.loop = true;
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + dur + 0.05);
  }
  private impact(t: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'lowpass'; f.frequency.setValueAtTime(12000, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 1.35);
  }
}
