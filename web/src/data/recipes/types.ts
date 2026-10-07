// The shape of a Banacipes recipe. To add one, copy any recipe in the other files in this folder.

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'drink';
// what the bananas should be like: green (firm, starchy), yellow (just ripe), spotty, brown (very ripe)
export type Ripeness = 'green' | 'yellow' | 'spotty' | 'brown';
export type Diet = 'vegan' | 'vegetarian' | 'gluten-free' | 'dairy-free' | 'no-bake' | 'alcohol';

export interface RecipeInput {
  name: string;
  emoji: string;            // shown on the recipe's card
  blurb: string;            // one sentence
  meals: Meal[];
  bananas: number;          // how many bananas (or plantains) the whole recipe uses
  bananaNote?: string;      // e.g. "2 green plantains"
  level: 1 | 2 | 3 | 4 | 5; // Banana-o-meter: how much the dish is about the banana
  ripeness: Ripeness[];
  mins: number;             // total time, including baking and chilling
  serves: string;
  difficulty: 'easy' | 'medium' | 'hard';
  diet: Diet[];
  origin: string;
  ingredients: string[];
  steps: string[];
  tip?: string;
}

export interface Recipe extends RecipeInput { slug: string }

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'dessert', label: 'Desserts' },
  { id: 'drink', label: 'Drinks' },
];
export const RIPENESS: { id: Ripeness; label: string; hint: string; colour: string }[] = [
  { id: 'green', label: 'Green', hint: 'firm and starchy: fry, boil or curry them', colour: '#8fbf3a' },
  { id: 'yellow', label: 'Yellow', hint: 'just ripe: slice, grill or caramelise', colour: '#f2d23a' },
  { id: 'spotty', label: 'Spotty', hint: 'sweet and soft: smoothies, pancakes, baking', colour: '#e3b01f' },
  { id: 'brown', label: 'Brown', hint: 'very sweet: perfect for banana bread', colour: '#8a5a1c' },
];
