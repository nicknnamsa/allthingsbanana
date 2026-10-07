// The Banana Clicker's descent into a banana rave: a techno track synthesised live with
// Web Audio, and a full-screen canvas of banana rain, spotlights, lasers and a dancing crowd.
// Both get more intense with the stage (0 = chill … 5 = BANANAGEDDON).

export const BPM = 128;
const STEP = 60 / BPM / 4;   // one 16th note, in seconds

// ---------- music ----------
export class Techno {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private filter!: BiquadFilterNode;
  private fade!: BiquadFilterNode;   // closes when you stop clicking
  private wet!: GainNode;            // reverb level, rises when you stop clicking
  private idle = 0;
  private notes = 0;                 // how far through the click riff we are
  private noise!: AudioBuffer;
  private next = 0;
  private step = 0;
  private timer: number | null = null;
  stage = 0;
  muted = false;
  startedAt = 0;   // ctx time of step 0, for syncing visuals to the beat

  // must be called from a click (browsers only allow sound after the visitor interacts)
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    // everything → master → fade (lowpass) → speakers, plus a reverb send that grows when you stop
    this.fade = this.ctx.createBiquadFilter();
    this.fade.type = 'lowpass';
    this.fade.frequency.value = 20000;
    this.fade.Q.value = 0.9;
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.04;
    const verb = this.ctx.createConvolver();
    verb.buffer = this.impulse(2.6);
    this.filter.connect(this.master).connect(this.fade);
    this.fade.connect(this.ctx.destination);
    this.fade.connect(verb).connect(this.wet).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // a simple reverb: a few seconds of stereo noise that dies away
  private impulse(secs: number) {
    const c = this.ctx!, len = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return b;
  }

  // 0 = clicking away, 1 = stopped for a while: the sound gets darker and more echoey as the rave winds down
  setIdle(x: number) {
    if (!this.ctx || Math.abs(x - this.idle) < 0.02) return;
    this.idle = x;
    const t = this.ctx.currentTime;
    this.fade.frequency.setTargetAtTime(20000 * (380 / 20000) ** x, t, 0.15);
    this.wet.gain.setTargetAtTime(0.04 + 0.6 * x, t, 0.2);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.05);
  }

  setStage(s: number) {
    this.stage = s;
    if (!this.ctx) return;
    // the filter opens up as the rave builds
    this.filter.frequency.setTargetAtTime([900, 1200, 2200, 5000, 9000, 14000][s], this.ctx.currentTime, 0.4);
    if (s >= 2 && this.timer == null) {
      this.next = this.ctx.currentTime + 0.05;
      this.step = 0;
      this.startedAt = this.next;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    if (s < 2 && this.timer != null) { clearInterval(this.timer); this.timer = null; }
  }

  // beat position for visuals: 0..1 through the current beat, and which beat it is
  beat(nowMs: number) {
    if (this.ctx && this.timer != null) {
      const t = (this.ctx.currentTime - this.startedAt) / (STEP * 4);
      return { phase: ((t % 1) + 1) % 1, n: Math.floor(t) };
    }
    const t = nowMs / 1000 / (STEP * 4);
    return { phase: t % 1, n: Math.floor(t) };
  }

  // every click plays the next note of a riff in the track's key (A minor), following its chords
  note() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const riff = [0, 3, 7, 10, 12, 10, 7, 3, 5, 7, 12, 15, 12, 10, 7, 5];
    const bar = this.timer != null ? Math.floor(this.step / 16) % 4 : Math.floor(this.notes / 16) % 4;
    const root = [0, 0, -2, -4][bar];                     // Am, Am, G, F, like the arpeggio
    const semi = riff[this.notes++ % riff.length] + root;
    const hz = 220 * 2 ** (semi / 12);
    if (this.stage < 2) {
      // a soft marimba-ish pluck while it's calm
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = hz * 2;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.26);
      return;
    }
    // in the rave: a squelchy saw lead, with a bass note an octave and a fifth below from stage 3
    const lead = c.createOscillator(), lf = c.createBiquadFilter(), lg = c.createGain();
    lead.type = 'sawtooth'; lead.frequency.value = hz;
    lf.type = 'lowpass'; lf.Q.value = 8;
    lf.frequency.setValueAtTime(600 + this.stage * 600, t);
    lf.frequency.exponentialRampToValueAtTime(5000 + this.stage * 1500, t + 0.02);
    lf.frequency.exponentialRampToValueAtTime(400, t + 0.22);
    lg.gain.setValueAtTime(0.13, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    lead.connect(lf).connect(lg).connect(this.master);
    lead.start(t); lead.stop(t + 0.27);
    if (this.stage >= 3) {
      const b = c.createOscillator(), bg = c.createGain();
      b.type = 'square'; b.frequency.value = 55 * 2 ** ((root + (semi % 12 === 0 ? 0 : 7)) / 12);
      bg.gain.setValueAtTime(0.12, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      b.connect(bg).connect(this.filter);
      b.start(t); b.stop(t + 0.21);
    }
  }

  private schedule() {
    if (!this.ctx) return;
    while (this.next < this.ctx.currentTime + 0.12) {
      this.play(this.step % 16, this.next);
      this.next += STEP;
      this.step++;
    }
  }

  private play(i: number, t: number) {
    const s = this.stage, bar = Math.floor(this.step / 16);
    if (i % 4 === 0) this.kick(t);
    if (s >= 3 && i % 4 === 2) this.hat(t, 0.09, 0.07);                 // offbeat open hat
    if (s >= 5 && i % 2 === 1) this.hat(t, 0.03, 0.04);                 // 16th hats
    if (s >= 3 && (i === 4 || i === 12)) this.clap(t);
    const bassline = [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 12, 3];
    if (i % 2 === 1 || s >= 4) this.bass(t, 55 * 2 ** (bassline[i] / 12));
    if (s >= 4) {
      const arp = [0, 3, 7, 12, 15, 12, 7, 3];
      const root = [0, 0, -2, -4][bar % 4];
      this.lead(t, 220 * 2 ** ((arp[(i + bar) % 8] + root) / 12));
    }
  }

  private kick(t: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.master);   // kick skips the filter so it always thumps
    o.start(t); o.stop(t + 0.36);
  }
  private hat(t: number, len: number, vol: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol * 3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + len + 0.01);
  }
  private clap(t: number) {
    const c = this.ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(this.filter);
    n.start(t, Math.random()); n.stop(t + 0.2);
  }
  private bass(t: number, hz: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
    o.connect(g).connect(this.filter);
    o.start(t); o.stop(t + STEP);
  }
  private lead(t: number, hz: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = hz;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.9);
    o.connect(g).connect(this.filter);
    o.start(t); o.stop(t + STEP);
  }
}

// ---------- visuals ----------
type Drop = { x: number; y: number; vy: number; vx: number; r: number; vr: number; size: number; burst?: boolean };

export class RaveCanvas {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private sprite: HTMLCanvasElement;
  private spots: HTMLCanvasElement[] = [];   // pre-coloured spotlights, one per 30° of hue
  private drops: Drop[] = [];
  private w = 0; private h = 0;
  private slow = 0;   // running average of frame time, to cut back on slower devices
  quality = 1;        // 0.35..1, scales how many bananas are drawn
  level = 0;          // smoothly follows the stage, 0..5
  target = 0;
  calm = false;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.g = cv.getContext('2d', { alpha: true })!;
    // draw the banana emoji once and reuse it
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = 64;
    const s = this.sprite.getContext('2d')!;
    s.font = '52px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillText('🍌', 32, 36);
    // spotlights: pre-drawn in 12 colours, so a frame only copies images instead of painting gradients
    for (let k = 0; k < 12; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const p = c.getContext('2d')!, grd = p.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, `hsla(${k * 30}, 100%, 60%, 1)`); grd.addColorStop(1, `hsla(${k * 30}, 100%, 60%, 0)`);
      p.fillStyle = grd; p.fillRect(0, 0, 256, 256);
      this.spots.push(c);
    }
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  // the rave is a blurry, busy background: drawing it at 1x is plenty and 4x cheaper on retina screens
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.cv.width = this.w; this.cv.height = this.h;
  }

  // a burst of bananas from where you clicked
  burst(x: number, y: number, n: number) {
    n = Math.round(n * this.quality);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
      this.drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, size: 20 + Math.random() * 18, burst: true });
    }
  }

  frame(now: number, dt: number, beat: { phase: number; n: number }) {
    const { g, w, h } = this;
    // automatic quality: if frames take longer than ~22 ms, draw fewer bananas
    this.slow = this.slow * 0.95 + dt * 1000 * 0.05;
    if (this.slow > 22 && this.quality > 0.35) this.quality -= 0.01;
    else if (this.slow < 17 && this.quality < 1) this.quality += 0.002;

    this.level += (this.target - this.level) * 0.04;
    const L = this.level, pulse = Math.max(0, 1 - beat.phase * 3);   // 1 on the beat, fading
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    if (L < 0.02 && !this.drops.length) { if (this.cv.style.opacity !== '0') this.cv.style.opacity = '0'; return; }
    if (this.cv.style.opacity !== '1') this.cv.style.opacity = '1';

    // the page dims and fills with club colours from stage 3
    if (L > 2) {
      const a = Math.min(1, (L - 2) / 1.6);
      const hue = 275 + Math.sin(now / 2600) * 45;   // deep purple, magenta and electric blue
      const grd = g.createRadialGradient(w / 2, h * 0.6, 50, w / 2, h / 2, Math.max(w, h));
      grd.addColorStop(0, `hsla(${hue}, 85%, 24%, ${0.88 * a})`);
      grd.addColorStop(1, `hsla(${hue - 40}, 90%, 7%, ${0.97 * a})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      // a gentle flash on the kick at the very top (about twice a second: under the 3-a-second limit)
      if (L > 4.5 && !this.calm) { g.fillStyle = `rgba(255, 240, 180, ${0.1 * pulse})`; g.fillRect(0, 0, w, h); }
    }

    // spotlights from stage 3
    if (L > 2.5) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, L - 2.5) * 0.45;
      for (let k = 0; k < 3; k++) {
        const x = w / 2 + Math.sin(now / 900 + k * 2.1) * w * 0.4, y = h * 0.55 + Math.cos(now / 1300 + k) * h * 0.2;
        g.drawImage(this.spots[Math.floor((now / 600 + k * 4) % 12)], x - 260, y - 260, 520, 520);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    // lasers from stage 4: a wide faint stroke under a thin bright one looks like a glow, without blur
    if (L > 3.5 && !this.calm) {
      const a = Math.min(1, L - 3.5);
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const fromLeft = k % 2 === 0, ox = fromLeft ? 0 : w;
        const ang = Math.PI / 2 + (fromLeft ? -1 : 1) * (0.35 + 0.3 * Math.sin(now / 700 + k));
        const ex = ox + Math.cos(ang) * (fromLeft ? 1 : -1) * h * 2, ey = Math.sin(ang) * h * 2;
        const hue = (now / 15 + k * 60) % 360;
        g.beginPath(); g.moveTo(ox, 0); g.lineTo(ex, ey);
        g.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.18 * a})`; g.lineWidth = 12 + pulse * 8; g.stroke();
        g.strokeStyle = `hsla(${hue}, 100%, 75%, ${0.8 * a})`; g.lineWidth = 2 + pulse * 2; g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }

    // banana rain from stage 2
    const want = Math.round([0, 0, 24, 55, 100, 160][Math.round(Math.min(5, L))] * (this.calm ? 0.4 : 1) * this.quality);
    let falling = 0;
    for (const d of this.drops) if (!d.burst) falling++;
    while (falling < want) {
      this.drops.push({ x: Math.random() * w, y: -40 - Math.random() * h * 0.5, vx: (Math.random() - .5) * .6, vy: 1.5 + Math.random() * 2.5 + L * .4,
        r: Math.random() * 6, vr: (Math.random() - .5) * .06, size: 22 + Math.random() * 22 });
      falling++;
    }
    const scale = 1 + (L > 3.5 ? pulse * 0.25 : 0), spr = this.sprite;
    let keep = 0;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.x += d.vx; d.y += d.vy; d.r += d.vr;
      if (d.burst) { d.vy += 0.35; d.vx *= 0.99; }
      if (d.y > h + 50) {
        if (d.burst || falling > want) { falling -= d.burst ? 0 : 1; continue; }
        d.y = -40; d.x = Math.random() * w;
      }
      const s = d.size * scale, cos = Math.cos(d.r), sin = Math.sin(d.r);
      g.setTransform(cos, sin, -sin, cos, d.x, d.y);
      g.drawImage(spr, -s / 2, -s / 2, s, s);
      this.drops[keep++] = d;
    }
    this.drops.length = keep;
    g.setTransform(1, 0, 0, 1, 0, 0);

    // a dancing banana crowd along the bottom from stage 3
    if (L > 2.8) {
      const a = Math.min(1, L - 2.8), n = Math.ceil(w / 46), s = 42;
      g.globalAlpha = a;
      for (let k = 0; k < n; k++) {
        const hop = (this.calm ? 0 : Math.abs(Math.sin((beat.phase + k * 0.13) * Math.PI))) * 16;
        const r = Math.sin(now / 200 + k) * 0.3, cos = Math.cos(r), sin = Math.sin(r);
        g.setTransform(cos, sin, -sin, cos, k * 46 + 23, h - 26 - hop);
        g.drawImage(spr, -s / 2, -s / 2, s, s);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    }
  }
}
