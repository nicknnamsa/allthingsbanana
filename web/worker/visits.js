// Banana popularity: an anonymous count of page views per day, shown as a small chart on the site.
// Each page load adds one to today's total. Nothing about the visitor is stored (no IP, no cookie, no ID).
import { DurableObject } from 'cloudflare:workers';

const dayKey = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);   // UTC date, e.g. 2026-10-08

export class VisitCounter extends DurableObject {
  async add() {
    const k = 'v' + dayKey();
    const n = ((await this.ctx.storage.get(k)) || 0) + 1;
    await this.ctx.storage.put(k, n);
    return n;
  }
  // the last `days` days, oldest first
  async recent(days) {
    const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - (days - 1 - i) * 864e5));
    const got = await this.ctx.storage.get(keys.map(k => 'v' + k));
    return keys.map(day => ({ day, views: got.get('v' + day) || 0 }));
  }
}

export async function handleVisits(request, env) {
  const counter = env.VISITS.get(env.VISITS.idFromName('global'));
  if (request.method === 'POST') {
    await counter.add();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
  if (request.method === 'GET') {
    const days = Math.min(60, Math.max(1, Math.floor(Number(new URL(request.url).searchParams.get('days'))) || 14));
    return Response.json(await counter.recent(days), { headers: { 'cache-control': 'public, max-age=60' } });
  }
  return new Response('Method not allowed', { status: 405 });
}
