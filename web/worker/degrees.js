// Bananadle: anonymous daily results (how many steps people took, how long),
// so players can see how they did against everyone else. Nothing about the visitor is stored.
import { DurableObject } from 'cloudflare:workers';

export const EPOCH = Date.UTC(2026, 9, 7);   // puzzle #1
export const dayNumber = (ms = Date.now()) => Math.floor((ms - EPOCH) / 864e5) + 1;

export class DegreesStats extends DurableObject {
  async add(day, r) {
    const key = 'd' + day;
    const s = (await this.ctx.storage.get(key)) || { played: 0, solved: 0, steps: {}, secs: 0, best: null };
    s.played++;
    if (r.solved) {
      s.solved++;
      const k = Math.min(r.steps, 10);   // 10 means "10 or more"
      s.steps[k] = (s.steps[k] || 0) + 1;
      s.secs += r.secs;
      if (s.best === null || r.secs < s.best) s.best = r.secs;
    }
    await this.ctx.storage.put(key, s);
    return s;
  }
  async get(day) {
    return (await this.ctx.storage.get('d' + day)) || { played: 0, solved: 0, steps: {}, secs: 0, best: null };
  }
}

export async function handleDegrees(request, env) {
  const stats = env.DEGREES.get(env.DEGREES.idFromName('global'));
  const today = dayNumber();
  const url = new URL(request.url);
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const day = Math.floor(Number(b.day)), steps = Math.floor(Number(b.steps)), secs = Math.floor(Number(b.secs));
    // players' clocks can be a day either side of ours
    if (!(Math.abs(day - today) <= 1) || !(steps >= 1 && steps < 1000) || !(secs >= 1 && secs < 86400 * 2))
      return Response.json({ error: 'bad result' }, { status: 400 });
    return Response.json(await stats.add(day, { solved: !!b.solved, steps, secs }), { headers: { 'cache-control': 'no-store' } });
  }
  if (request.method === 'GET') {
    const day = Math.floor(Number(url.searchParams.get('day'))) || today;
    return Response.json(await stats.get(day), { headers: { 'cache-control': 'public, max-age=30' } });
  }
  return new Response('Method not allowed', { status: 405 });
}
