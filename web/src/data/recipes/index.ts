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

// freely licensed photos (public/recipes/img/<slug>.jpg, credits in photos.json, picked by hand);
// recipes without one keep their emoji art
import photoCredits from './photos.json';
export interface Photo { src: string; thumb: string; w: number; h: number; title: string; author: string; license: string; licenseUrl: string; page: string; source: string }
export function recipePhoto(slug: string): Photo | undefined {
  const p = (photoCredits as Record<string, Omit<Photo, 'src' | 'thumb'>>)[slug];
  return p && { ...p, src: `/recipes/img/${slug}.jpg`, thumb: `/recipes/img/sm/${slug}.jpg` };
}

// estimated nutrition from USDA FoodData Central (built by scripts/build-nutrition.mjs)
import nutritionData from './nutrition.json';
export interface Nutrition { per: string; servings: number; kcal: number; protein: number; carbs: number; sugars: number; fat: number; sat: number; fibre: number; salt: number; notes: string[] }
export const recipeNutrition = (slug: string): Nutrition | undefined => (nutritionData as Record<string, Nutrition>)[slug];
