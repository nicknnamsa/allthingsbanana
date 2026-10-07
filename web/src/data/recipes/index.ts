// Every Banacipes recipe. Add new ones to any of these files (or a new file) and they appear
// on the site with their own page, in search and in all the filters automatically.
import { breakfast } from './breakfast';
import { savoury } from './savoury';
import { desserts } from './desserts';
import { drinks } from './drinks';
import { slugify, type Recipe } from './types';

export * from './types';

export const recipes: Recipe[] = [...breakfast, ...savoury, ...desserts, ...drinks]
  .map(r => ({ ...r, slug: slugify(r.name) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// catch copy-paste mistakes when building
const seen = new Set<string>();
for (const r of recipes) {
  if (seen.has(r.slug)) throw new Error(`Two recipes are called "${r.name}"`);
  seen.add(r.slug);
}

// the same recipe all day, a different one tomorrow
export function recipeOfTheDay(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 864e5);
  return recipes[(day * 7919) % recipes.length];
}

export const formatTime = (mins: number) =>
  mins < 60 ? `${mins} min` : mins % 60 === 0 ? `${mins / 60} h` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
