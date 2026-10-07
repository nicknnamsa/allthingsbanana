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
    this.filter.connect(this.master).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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

  // a little "pop" on every click; the pitch climbs with your combo
  pop(combo: number) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    o.type = 'triangle';
    o.frequency.value = 440 * 2 ** (scale[Math.min(combo, scale.length - 1) % scale.length] / 12) * (combo >= scale.length ? 2 : 1);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.13);
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
  private drops: Drop[] = [];
  private w = 0; private h = 0; private dpr = 1;
  level = 0;          // smoothly follows the stage, 0..5
  target = 0;
  calm = false;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.g = cv.getContext('2d')!;
    // draw the banana emoji once and reuse it
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = 64;
    const s = this.sprite.getContext('2d')!;
    s.font = '52px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillText('🍌', 32, 36);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth; this.h = innerHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
  }

  // a burst of bananas from where you clicked
  burst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
      this.drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, size: 20 + Math.random() * 18, burst: true });
    }
  }

  frame(now: number, beat: { phase: number; n: number }) {
    const { g, w, h } = this;
    this.level += (this.target - this.level) * 0.04;
    const L = this.level, pulse = Math.max(0, 1 - beat.phase * 3);   // 1 on the beat, fading
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (L < 0.02 && !this.drops.length) { this.cv.style.opacity = '0'; return; }
    this.cv.style.opacity = '1';

    // the page dims and fills with colour from stage 3
    if (L > 2) {
      const a = Math.min(1, (L - 2) / 1.6);
      // club colours: drift between deep purple, magenta and electric blue
      const hue = 275 + Math.sin(now / 2600) * 45;
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
      const a = Math.min(1, L - 2.5) * 0.45;
      for (let k = 0; k < 3; k++) {
        const x = w / 2 + Math.sin(now / 900 + k * 2.1) * w * 0.4, y = h * 0.55 + Math.cos(now / 1300 + k) * h * 0.2;
        const grd = g.createRadialGradient(x, y, 0, x, y, 260);
        grd.addColorStop(0, `hsla(${(now / 20 + k * 120) % 360}, 100%, 60%, ${a})`);
        grd.addColorStop(1, 'transparent');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
    }

    // lasers from stage 4
    if (L > 3.5 && !this.calm) {
      const a = Math.min(1, L - 3.5);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const fromLeft = k % 2 === 0, ox = fromLeft ? 0 : w, oy = 0;
        const ang = Math.PI / 2 + (fromLeft ? -1 : 1) * (0.35 + 0.3 * Math.sin(now / 700 + k));
        const col = `hsla(${(now / 15 + k * 60) % 360}, 100%, 62%, ${0.7 * a})`;
        g.strokeStyle = col;
        g.shadowColor = col; g.shadowBlur = 14;
        g.lineWidth = 3 + pulse * 4;
        g.beginPath(); g.moveTo(ox, oy);
        g.lineTo(ox + Math.cos(ang) * (fromLeft ? 1 : -1) * h * 2, oy + Math.sin(ang) * h * 2);
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      g.shadowBlur = 0;
    }

    // banana rain from stage 2
    const want = [0, 0, 30, 70, 130, 220][Math.round(Math.min(5, L))] * (this.calm ? 0.4 : 1);
    let falling = this.drops.filter(d => !d.burst).length;
    while (falling < want) {
      this.drops.push({ x: Math.random() * w, y: -40 - Math.random() * h * 0.5, vx: (Math.random() - .5) * .6, vy: 1.5 + Math.random() * 2.5 + L * .4,
        r: Math.random() * 6, vr: (Math.random() - .5) * .06, size: 22 + Math.random() * 22 });
      falling++;
    }
    const scale = 1 + (L > 3.5 ? pulse * 0.25 : 0);
    this.drops = this.drops.filter(d => {
      d.x += d.vx; d.y += d.vy; d.r += d.vr;
      if (d.burst) { d.vy += 0.35; d.vx *= 0.99; }
      const s = d.size * scale;
      g.save(); g.translate(d.x, d.y); g.rotate(d.r);
      g.drawImage(this.sprite, -s / 2, -s / 2, s, s);
      g.restore();
      if (d.y > h + 50) return d.burst ? false : falling-- > want ? false : (d.y = -40, d.x = Math.random() * w, true);
      return true;
    });

    // a dancing banana crowd along the bottom from stage 3
    if (L > 2.8) {
      const a = Math.min(1, L - 2.8), n = Math.ceil(w / 46);
      g.globalAlpha = a;
      for (let k = 0; k < n; k++) {
        const hop = (this.calm ? 0 : Math.abs(Math.sin((beat.phase + k * 0.13) * Math.PI))) * 16;
        const s = 42;
        g.save(); g.translate(k * 46 + 23, h - 26 - hop); g.rotate(Math.sin(now / 200 + k) * 0.3);
        g.drawImage(this.sprite, -s / 2, -s / 2, s, s);
        g.restore();
      }
      g.globalAlpha = 1;
    }
  }
}
