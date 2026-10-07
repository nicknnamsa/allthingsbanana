// Banana Clicker: one shared tally of peeled bananas per country.
// A Durable Object handles every update one at a time, so no clicks get lost when many
// people peel at once. Only country totals are stored, never anything about the visitor.
import { DurableObject } from 'cloudflare:workers';

export class PeelCounter extends DurableObject {
  async add(country, n) {
    const counts = (await this.ctx.storage.get('counts')) || {};
    counts[country] = (counts[country] || 0) + n;
    await this.ctx.storage.put('counts', counts);
    return counts;
  }
  async counts() {
    return (await this.ctx.storage.get('counts')) || {};
  }
}

const MAX_PER_REQUEST = 60;   // the page sends clicks in batches every couple of seconds

export async function handlePeel(request, env) {
  const country = /^[A-Z]{2}$/.test(request.cf?.country || '') ? request.cf.country : 'XX';
  const counter = env.PEELS.get(env.PEELS.idFromName('global'));
  let counts;
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const n = Math.floor(Number(body.n));
    if (!(n >= 1)) return Response.json({ error: 'n must be a positive number' }, { status: 400 });
    counts = await counter.add(country, Math.min(n, MAX_PER_REQUEST));
  } else if (request.method === 'GET') {
    counts = await counter.counts();
  } else {
    return new Response('Method not allowed', { status: 405 });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Response.json({ country, total, countries: counts }, { headers: { 'cache-control': 'no-store' } });
}
