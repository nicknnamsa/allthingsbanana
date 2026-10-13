// BanaDAW's sound: every drum and synth is built from oscillators and noise with Web Audio.
// The same graph and voices play live (AudioContext) and render the WAV export (OfflineAudioContext).
import { type Song, type Track, type Crate, type DrumLane, type Kit, type Synth, LANES, RIPE_GAIN, midiOf, stepsOf } from './song';

type Ctx = BaseAudioContext;
type Bus = { input: GainNode; fader: GainNode; pan: StereoPannerNode; rev: GainNode; dly: GainNode };
type Graph = { buses: Map<string, Bus>; duck: GainNode; master: GainNode; warmth: BiquadFilterNode; drive: WaveShaperNode; delay: DelayNode; noise: AudioBuffer };

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const curve = (k: number) => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; };

function impulse(ctx: Ctx, secs: number) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2; }
  return b;
}

// ---------- the mixing desk ----------
function buildGraph(ctx: Ctx, song: Song): Graph {
  const master = ctx.createGain(), warmth = ctx.createBiquadFilter(), drive = ctx.createWaveShaper(), comp = ctx.createDynamicsCompressor(), out = ctx.createGain();
  warmth.type = 'lowpass'; warmth.Q.value = 0.5;
  drive.oversample = '2x';
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
  out.gain.value = 0.9;
  master.connect(warmth).connect(drive).connect(comp).connect(out).connect(ctx.destination);
  // reverb and tempo-synced delay (a dotted eighth), both returning to the master
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.6);
  const verbIn = ctx.createGain(); verbIn.connect(verb).connect(master);
  const delay = ctx.createDelay(2), fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), dIn = ctx.createGain();
  fb.gain.value = 0.38; dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  dIn.connect(delay).connect(dlp).connect(fb).connect(delay); dlp.connect(master);
  // synths go through the "pump", which ducks on every kick for that pumping rave feel
  const duck = ctx.createGain(); duck.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const buses = new Map<string, Bus>();
  for (const t of song.tracks) {
    const input = ctx.createGain(), fader = ctx.createGain(), pan = ctx.createStereoPanner(), rev = ctx.createGain(), dly = ctx.createGain();
    input.connect(fader).connect(pan);
    pan.connect(t.kind === 'drums' ? master : duck);
    pan.connect(rev).connect(verbIn);
    pan.connect(dly).connect(dIn);
    buses.set(t.id, { input, fader, pan, rev, dly });
  }
  const g: Graph = { buses, duck, master, warmth, drive, delay, noise };
  applyMix(ctx, g, song, true);
  return g;
}

// volumes, pans, sends and master settings (called whenever the song changes)
function applyMix(ctx: Ctx, g: Graph, song: Song, now = false) {
  const t = ctx.currentTime, set = (p: AudioParam, v: number) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.03));
  const solo = song.tracks.some(x => x.solo);
  for (const tr of song.tracks) {
    const b = g.buses.get(tr.id);
    if (!b) continue;
    const audible = !tr.mute && (!solo || tr.solo);
    set(b.fader.gain, audible ? tr.vol * tr.vol : 0);
    set(b.pan.pan, tr.pan);
    set(b.rev.gain, tr.rev * 0.9);
    set(b.dly.gain, tr.dly * 0.7);
  }
  set(g.warmth.frequency, 20000 * (900 / 20000) ** song.warmth);
  g.drive.curve = curve(1 + song.drive * 5);
  set(g.delay.delayTime, (60 / song.bpm) * 0.75);
}

// ---------- drums ----------
function drum(ctx: Ctx, g: Graph, dest: AudioNode, kit: Kit, lane: DrumLane, t: number, v: number) {
  const noiseSrc = (start = 0) => { const n = ctx.createBufferSource(); n.buffer = g.noise; n.start(t, start); return n; };
  const env = (peak: number, len: number, attack = 0.002) => { const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * v), t + attack); e.gain.exponentialRampToValueAtTime(0.0001, t + len); return e; };
  if (lane === 'kick') {
    const k = { chill: [95, 48, 0.32, 1, 0.8], house: [150, 50, 0.38, 1.5, 0.95], rave: [280, 46, 0.48, 3.2, 1] }[kit];
    const o = ctx.createOscillator(), sh = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), e = env(k[4], k[2], 0.003);
    o.frequency.setValueAtTime(k[0], t); o.frequency.exponentialRampToValueAtTime(k[1], t + 0.09); o.frequency.exponentialRampToValueAtTime(k[1] * 0.85, t + k[2]);
    sh.curve = curve(k[3]); lp.type = 'lowpass'; lp.frequency.value = 3500;
    o.connect(sh).connect(lp).connect(e).connect(dest); o.start(t); o.stop(t + k[2] + 0.02);
    if (kit !== 'chill') { const n = noiseSrc(Math.random() * 0.5), bp = ctx.createBiquadFilter(), ce = env(kit === 'rave' ? 0.5 : 0.25, 0.012); bp.type = 'bandpass'; bp.frequency.value = 3500; n.connect(bp).connect(ce).connect(dest); n.stop(t + 0.02); }
  } else if (lane === 'snare') {
    const n = noiseSrc(Math.random() * 0.5), f = ctx.createBiquadFilter(), e = env(kit === 'chill' ? 0.35 : 0.55, kit === 'chill' ? 0.22 : 0.17);
    f.type = kit === 'chill' ? 'lowpass' : 'bandpass'; f.frequency.value = kit === 'chill' ? 3200 : 1900; f.Q.value = 0.8;
    n.connect(f).connect(e).connect(dest); n.stop(t + 0.25);
    const o = ctx.createOscillator(), oe = env(kit === 'chill' ? 0.18 : 0.35, 0.09);
    o.frequency.setValueAtTime(kit === 'rave' ? 230 : 190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    o.connect(oe).connect(dest); o.start(t); o.stop(t + 0.1);
  } else if (lane === 'clap') {
    const n = noiseSrc(Math.random() * 0.5), f = ctx.createBiquadFilter(), e = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9;
    e.gain.setValueAtTime(0.0001, t);
    for (const d of [0, 0.011, 0.023]) { e.gain.setValueAtTime(0.6 * v, t + d); e.gain.exponentialRampToValueAtTime(0.12 * v, t + d + 0.009); }
    e.gain.exponentialRampToValueAtTime(0.0001, t + (kit === 'chill' ? 0.14 : 0.22));
    n.connect(f).connect(e).connect(dest); n.stop(t + 0.25);
  } else if (lane === 'hat' || lane === 'open') {
    const n = noiseSrc(Math.random() * 0.5), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), len = lane === 'open' ? 0.32 : kit === 'chill' ? 0.06 : 0.045;
    hp.type = 'highpass'; hp.frequency.value = kit === 'chill' ? 5500 : 7500; lp.type = 'lowpass'; lp.frequency.value = kit === 'chill' ? 9000 : 16000;
    const e = env(kit === 'chill' ? 0.18 : 0.26, len);
    n.connect(hp).connect(lp).connect(e).connect(dest); n.stop(t + len + 0.02);
  } else if (lane === 'perc') {
    if (kit === 'chill') {   // rimshot
      const o = ctx.createOscillator(), e = env(0.3, 0.05); o.type = 'triangle'; o.frequency.value = 1150; o.connect(e).connect(dest); o.start(t); o.stop(t + 0.06);
    } else if (kit === 'house') {   // conga
      const o = ctx.createOscillator(), e = env(0.45, 0.22); o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.2); o.connect(e).connect(dest); o.start(t); o.stop(t + 0.23);
    } else {   // metallic hit
      for (const f of [540, 815]) { const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), e = env(0.18, 0.12); o.type = 'square'; o.frequency.value = f; bp.type = 'bandpass'; bp.frequency.value = 2400; o.connect(bp).connect(e).connect(dest); o.start(t); o.stop(t + 0.13); }
    }
  } else if (lane === 'shaker') {
    const n = noiseSrc(Math.random() * 0.5), bp = ctx.createBiquadFilter(), e = env(0.22, 0.08, 0.02);
    bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 1.2;
    n.connect(bp).connect(e).connect(dest); n.stop(t + 0.1);
  }
}

// ---------- synths ----------
function synthVoice(ctx: Ctx, dest: AudioNode, synth: Synth, midi: number, t: number, dur: number, v: number, tone: number) {
  const f = hz(midi), out = ctx.createGain();
  out.connect(dest);
  const osc = (type: OscillatorType, freq: number, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; return o; };
  const adsr = (a: number, d: number, s: number, r: number, peak: number) => {
    const g = out.gain, end = t + Math.max(dur, a + 0.01);
    g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak * v, t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak * v * s), t + a + d);
    g.setValueAtTime(Math.max(0.0002, peak * v * s), end); g.exponentialRampToValueAtTime(0.0001, end + r);
    return end + r + 0.02;
  };
  const run = (nodes: OscillatorNode[], stop: number) => nodes.forEach(n => { n.start(t); n.stop(stop); });
  if (synth === 'keys') {   // a two-operator FM electric piano
    const car = osc('sine', f), mod = osc('sine', f), mg = ctx.createGain(), bell = osc('sine', f * 2), bg = ctx.createGain();
    mg.gain.setValueAtTime(f * (1 + tone * 3), t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9);
    bg.gain.setValueAtTime(0.12, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    mod.connect(mg).connect(car.frequency); car.connect(out); bell.connect(bg).connect(out);
    run([car, mod, bell], adsr(0.004, 1.1, 0.35, 0.35, 0.32));
  } else if (synth === 'pad') {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(500 + tone * 3500, t + 0.6);
    lp.connect(out);
    const ns = [osc('sawtooth', f, -11), osc('sawtooth', f, 0), osc('sawtooth', f, 11), osc('sine', f / 2)];
    ns.forEach(n => n.connect(lp));
    run(ns, adsr(0.45, 0.6, 0.75, 1.1, 0.13));
  } else if (synth === 'pluck') {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(600 + tone * 6500, t); lp.frequency.exponentialRampToValueAtTime(350, t + 0.3);
    lp.connect(out);
    const ns = [osc('sawtooth', f, -6), osc('sawtooth', f, 6)]; ns.forEach(n => n.connect(lp));
    run(ns, adsr(0.003, 0.35, 0.05, 0.12, 0.28));
  } else if (synth === 'bass') {
    const lp = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(), sub = osc('sine', f), saw = osc('sawtooth', f), sg = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(220 + tone * 2400, t); lp.frequency.exponentialRampToValueAtTime(180 + tone * 600, t + 0.25);
    sh.curve = curve(1 + tone * 3); sg.gain.value = 0.5 + tone * 0.3;
    saw.connect(sh).connect(lp).connect(sg).connect(out); sub.connect(out);
    run([sub, saw], adsr(0.004, 0.2, 0.75, 0.06, 0.42));
  } else if (synth === 'lead') {   // supersaw
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(900 + tone * 8000, t); lp.connect(out);
    const ns = [-24, -12, 0, 12, 24].map(d => osc('sawtooth', f, d)); ns.forEach(n => n.connect(lp));
    run(ns, adsr(0.008, 0.2, 0.8, 0.18, 0.1));
  } else if (synth === 'bell') {
    const parts: [number, number, number][] = [[1, 0.35, 2.2], [2.76, 0.15, 0.9], [5.4, 0.06, 0.4]];
    const ns = parts.map(([ratio, amp, len]) => {
      const o = osc('sine', f * ratio), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp * v * (0.6 + tone * 0.6), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(out); return o;
    });
    out.gain.value = 0.8;
    run(ns, t + 2.4);
  } else {   // the squeaky rubber banana
    const o = osc('triangle', f * 0.7), o2 = osc('square', f * 0.7), lfo = osc('sine', 24), lg = ctx.createGain(), o2g = ctx.createGain(), bp = ctx.createBiquadFilter();
    for (const x of [o, o2]) { x.frequency.exponentialRampToValueAtTime(f, t + 0.035); x.frequency.setValueAtTime(f, t + dur * 0.75); x.frequency.exponentialRampToValueAtTime(f * 1.1, t + dur); }
    lg.gain.value = 30 + tone * 40; lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
    o2g.gain.value = 0.25; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.1;
    o.connect(bp).connect(out); o2.connect(o2g).connect(bp); o.connect(out);
    run([o, o2, lfo], adsr(0.01, 0.1, 0.8, 0.06, 0.16));
  }
}

// ---------- what plays on one step of one crate ----------
function playStep(ctx: Ctx, g: Graph, song: Song, crate: Crate, step: number, t: number, stepDur: number) {
  let kicked = false;
  for (const tr of song.tracks) {
    const bus = g.buses.get(tr.id);
    if (!bus) continue;
    if (tr.kind === 'drums') {
      const lanes = crate.drums[tr.id] || {};
      for (const { id } of LANES) {
        const r = lanes[id]?.[step] || 0;
        if (!r) continue;
        drum(ctx, g, bus.input, tr.kit, id, t, RIPE_GAIN[r]);
        if (id === 'kick') kicked = true;
      }
    } else {
      for (const n of crate.notes[tr.id] || []) if (n.s === step) synthVoice(ctx, bus.input, tr.synth, midiOf(song, tr.oct, n.d), t, n.l * stepDur * 0.98, RIPE_GAIN[n.v], tr.tone);
    }
  }
  // the pump: synths dip on the kick and swell back
  if (kicked && song.pump > 0) {
    const d = g.duck.gain;
    d.cancelScheduledValues(t);
    d.setValueAtTime(1 - song.pump * 0.8, t);
    d.linearRampToValueAtTime(1, t + stepDur * 3);
  }
}
const swingOffset = (song: Song, step: number, stepDur: number) => (step % 2 ? song.swing * stepDur * 0.45 : 0);

// ---------- the live player ----------
export class Engine {
  ctx: AudioContext | null = null;
  song!: Song;
  private g: Graph | null = null;
  private trackKey = '';
  playing = false;
  mode: 'crate' | 'song' = 'crate';
  crate = 0;            // which crate is playing (or looping)
  private step = 0; private rep = 0; private next = 0; private timer: number | null = null;
  private queue: { t: number; crate: number; step: number }[] = [];

  private ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const key = this.song.tracks.map(t => t.id + t.kind).join('|');
    if (!this.g || key !== this.trackKey) { this.g?.master.disconnect(); this.g = buildGraph(this.ctx, this.song); this.trackKey = key; }
  }
  setSong(song: Song) {
    this.song = song;
    if (this.crate >= song.crates.length) this.crate = song.crates.length - 1;
    if (!this.ctx) return;
    const key = song.tracks.map(t => t.id + t.kind).join('|');
    if (key !== this.trackKey) this.ensure(); else if (this.g) applyMix(this.ctx, this.g, song);
  }
  play(mode: 'crate' | 'song', crate: number) {
    this.ensure();
    this.mode = mode; this.crate = mode === 'song' ? 0 : crate; this.step = 0; this.rep = 0;
    this.next = this.ctx!.currentTime + 0.06; this.queue = [];
    this.playing = true;
    if (this.timer == null) this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() { this.playing = false; if (this.timer != null) clearInterval(this.timer); this.timer = null; this.queue = []; }
  private schedule() {
    if (!this.ctx || !this.g || !this.playing) return;
    const stepDur = 60 / this.song.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.12) {
      const crate = this.song.crates[this.crate];
      if (!crate) { this.stop(); return; }
      const t = this.next + swingOffset(this.song, this.step, stepDur);
      playStep(this.ctx, this.g, this.song, crate, this.step, t, stepDur);
      this.queue.push({ t, crate: this.crate, step: this.step });
      if (this.queue.length > 64) this.queue.shift();
      this.next += stepDur;
      this.step++;
      if (this.step >= stepsOf(crate)) {
        this.step = 0;
        if (this.mode === 'song') {
          this.rep++;
          if (this.rep >= crate.times) { this.rep = 0; this.crate = (this.crate + 1) % this.song.crates.length; }
        }
      }
    }
  }
  // where the playhead is right now, for the screen
  position() {
    if (!this.ctx || !this.playing) return null;
    let last = null;
    for (const q of this.queue) if (q.t <= this.ctx.currentTime) last = q;
    return last;
  }
  // hear one note or drum straight away (when you click the grid)
  preview(track: Track, value: { lane?: DrumLane; d?: number; v?: number }) {
    this.ensure();
    const bus = this.g!.buses.get(track.id), t = this.ctx!.currentTime + 0.01;
    if (!bus) return;
    const v = RIPE_GAIN[value.v ?? 3];
    if (track.kind === 'drums' && value.lane) drum(this.ctx!, this.g!, bus.input, track.kit, value.lane, t, v);
    if (track.kind === 'synth' && value.d != null) synthVoice(this.ctx!, bus.input, track.synth, midiOf(this.song, track.oct, value.d), t, 0.35, v, track.tone);
  }
}

// ---------- export: render the whole song (every crate, each repeated) to a WAV file ----------
export async function renderWav(song: Song) {
  const stepDur = 60 / song.bpm / 4;
  const total = song.crates.reduce((a, c) => a + stepsOf(c) * c.times, 0) * stepDur + 2.5;
  const rate = 44100, ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  const g = buildGraph(ctx, song);
  let t = 0.05;
  for (const c of song.crates) for (let r = 0; r < c.times; r++) for (let s = 0; s < stepsOf(c); s++) {
    playStep(ctx, g, song, c, s, t + swingOffset(song, s, stepDur), stepDur);
    t += stepDur;
  }
  const buf = await ctx.startRendering();
  return wav(buf);
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
