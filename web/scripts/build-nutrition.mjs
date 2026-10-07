// Estimates nutrition per serving for every Banacipes recipe from USDA FoodData Central
// (SR Legacy, public domain), and writes src/data/recipes/nutrition.json.
//
//   npm run build-nutrition      (downloads the USDA tables the first time, ~7 MB)
//
// Each ingredient line is turned into grams of one USDA food: metric amounts first, then
// spoons, cups and counts (eggs, bananas, onions…) using standard weights. Spices, salt-free
// seasonings, optional items, toppings "to serve" and frying oil are left out, and the page says so.
// Lines it can't understand are listed at the end so they can be added to FOODS below.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

// ---------- USDA data ----------
const dir = join(tmpdir(), 'atb-usda');
const csvDir = join(dir, 'FoodData_Central_sr_legacy_food_csv_2018-04');
if (!existsSync(join(csvDir, 'food_nutrient.csv'))) {
  await mkdir(dir, { recursive: true });
  console.log('Downloading USDA FoodData Central (SR Legacy)…');
  const res = await fetch('https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip');
  await writeFile(join(dir, 'sr.zip'), Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', join(dir, 'sr.zip'), '-d', dir]);
}
const NUTRIENTS = { 1008: 'kcal', 1003: 'protein', 1004: 'fat', 1258: 'sat', 1005: 'carbs', 2000: 'sugars', 1079: 'fibre', 1093: 'sodium' };

// Foods we use, matched in order (first match wins). per: grams for one "each" (an egg, a banana…),
// cup / tbsp: grams per cup or tablespoon (tsp = tbsp ÷ 3), ml: grams per millilitre.
// fdc: null means "leave out" (spices, water, decoration).
const FOODS = [
  // left out
  [/\b(water|ice|ice cubes|stock|lolly sticks|skewers|cocktail sticks|foil|bamboo|sticks)\b(?!.*(milk|melon))/, null],
  [/peels? of|banana peel/, null, { note: 'Banana peel is not in the USDA database, so it is left out.' }],
  [/\b(cinnamon|nutmeg|allspice|cardamom|cumin|turmeric|paprika|curry powder|chilli powder|chilli flakes|ginger|oregano|mustard seeds|curry leaves|bay|pepper,? to|black pepper|vanilla|sea salt flakes|flaky|coriander|parsley|basil|mint|nori|sofrito|urad dal|food colouring|sprinkles)\b/, null],
  // bananas and plantains
  [/green cooking banana|matoke/, 168215, { per: 100, note: 'Green cooking bananas are counted as green plantains, about 100 g each.' }],
  [/green plantain|raw green banana|raw (green )?bananas?|nendran/, 168215, { per: 179 }],
  [/saba/, 169130, { per: 100, note: 'Saba bananas are counted as ripe plantains (about 100 g each).' }],
  [/plantains?/, 169130, { per: 179 }],
  [/banana chips/, 168849, { cup: 70 }],
  [/banana blossom/, 168569, { note: 'Banana blossom is counted as hearts of palm, the closest food in the USDA database.' }],
  [/bananas?/, 173944, { per: 118 }],
  // flours, grains
  [/tortillas?/, 167535, { per: 30 }],
  [/self-raising flour/, 168895, { cup: 125, tbsp: 8 }],
  [/wholemeal flour|whole wheat flour/, 168893, { cup: 120, tbsp: 8 }],
  [/rice flour/, 168877, { tbsp: 10 }],
  [/cassava flour|farinha/, 169717, { cup: 150 }],
  [/cornflour|cornstarch/, 169695, { tbsp: 8 }],
  [/plain flour|all-purpose flour|\bflour\b/, 168894, { cup: 125, tbsp: 8 }],
  [/porridge oats|rolled oats|\boats\b/, 173904, { cup: 90, tbsp: 5 }],
  [/quinoa/, 168874, { cup: 170 }],
  [/cooked rice/, 168878, { cup: 160 }],
  [/\brice\b/, 168877, { cup: 185 }],
  [/tapioca/, 169717, { note: 'Tapioca pearls are counted dry.' }],
  // sugars and syrups
  [/icing sugar|powdered sugar/, 169656, { cup: 120, tbsp: 7.8 }],
  [/brown sugar/, 168833, { cup: 200, tbsp: 13.8 }],
  [/sugar syrup/, 169655, { ml: 0.65, note: 'Sugar syrup is counted as half sugar, half water.' }],
  [/sugar/, 169655, { cup: 200, tbsp: 12.5 }],
  [/maple syrup/, 169661, { tbsp: 20, ml: 1.32 }],
  [/honey/, 169640, { tbsp: 21, ml: 1.42 }],
  [/caramel|dulce de leche/, 173461, {}],
  [/condensed milk/, 171275, { tbsp: 19, ml: 1.3 }],
  // dairy and eggs
  [/egg yolks?/, 172184, { per: 17 }],
  [/egg whites?/, 172183, { per: 33 }],
  [/\beggs?\b/, 171287, { per: 50 }],
  [/peanut butter/, 174266, { tbsp: 16 }],
  [/almond butter|nut butter/, 168603, { tbsp: 16 }],
  [/chocolate (hazelnut )?spread|nutella/, 168000, { tbsp: 18.5 }],
  [/milk chocolate|dark or milk chocolate/, 167587, {}],
  [/buttermilk/, 170874, { cup: 245 }],
  [/coconut milk/, 170173, { cup: 226 }],
  [/almond milk|oat milk|plant milk|soya milk|soy milk/, 174832, { cup: 240 }],
  [/milk or plant milk|milk or water/, 171265, { cup: 244 }],
  [/\bmilk\b/, 171265, { cup: 244, tbsp: 15 }],
  [/double cream|heavy cream|whipping cream|\bcream\b(?! cheese)(?! of)/, 170859, { cup: 238, tbsp: 15 }],
  [/whipped cream/, 170860, { cup: 60, tbsp: 4 }],
  [/soured cream|sour cream|crème fraîche/, 171257, { cup: 230, tbsp: 12 }],
  [/greek yogurt/, 171304, { cup: 245, tbsp: 15 }],
  [/yogurt|yoghurt/, 171284, { cup: 245, tbsp: 15 }],
  [/cream cheese/, 173418, { tbsp: 14.5 }],
  [/mozzarella|queso blanco|frying cheese|queso de freír/, 170845, {}],
  [/cheddar/, 173414, {}],
  [/coconut oil/, 171412, { tbsp: 13.6, ml: 0.92 }],
  [/olive oil/, 171413, { tbsp: 13.5, ml: 0.92 }],
  [/\boil\b/, 172336, { tbsp: 13.6, ml: 0.92 }],
  [/\bbutter\b/, 173410, { cup: 227, tbsp: 14.2 }],
  [/ice cream/, 167575, { scoop: 66, per: 66 }],
  // nuts, seeds, fruit
  [/chia/, 170554, { tbsp: 12 }],
  [/pumpkin|sunflower|mixed seeds|seeds/, 170556, { tbsp: 9 }],
  [/sesame/, 170150, { tbsp: 9 }],
  [/flax/, 169414, { tbsp: 7 }],
  [/walnut/, 170187, { cup: 117, handful: 30 }],
  [/pecan/, 170182, { cup: 110, handful: 30 }],
  [/peanuts/, 174262, { cup: 146 }],
  [/mixed nuts|nuts|almonds/, 170187, { cup: 120, handful: 30 }],
  [/desiccated coconut|coconut flakes|grated coconut|\bcoconut\b/, 170170, { cup: 80, tbsp: 5 }],
  [/dates/, 168191, {}],
  [/raisins/, 168165, { cup: 145 }],
  [/cocoa/, 169593, { cup: 86, tbsp: 5.4 }],
  [/milk chocolate/, 167587, {}],
  [/chocolate chips|chocolate, chopped|dark chocolate|chocolate/, 167976, { cup: 170 }],
  [/marshmallow/, 167995, { handful: 25 }],
  [/maraschino|cherr/, 167766, { per: 5 }],
  [/chocolate sauce/, 168835, { tbsp: 20 }],
  [/strawberry sauce|pineapple sauce/, 168758, { tbsp: 20 }],
  [/crushed pineapple|pineapple/, 169126, {}],
  [/strawberr/, 167762, { per: 12 }],
  [/berries|blueberr/, 171711, { cup: 148 }],
  [/mango/, 169910, {}],
  [/jackfruit/, 174687, { per: 15 }],
  [/lime juice|juice of (\d+|a|one|two) limes?|juice of \d+ limes?/, 168156, { per: 30 }],
  [/lemon juice|juice of (\d+|a|one|two) lemons?/, 167747, { per: 48, tbsp: 15 }],
  [/cider vinegar|vinegar/, 173469, { cup: 239, tbsp: 15 }],
  // vegetables, beans
  [/red onion|onions?/, 170000, { per: 110, small: 70 }],
  [/garlic/, 169230, { per: 3 }],
  [/tomato paste/, 170459, { tbsp: 16 }],
  [/tomato sauce|tomate frito/, 170054, { cup: 245, tbsp: 15 }],
  [/tinned tomatoes|canned tomatoes/, 170051, {}],
  [/tomatoes?/, 170457, { per: 123 }],
  [/green pepper|red pepper|bell pepper/, 170427, { per: 119 }],
  [/chill?i(?! sauce)/, 170106, { per: 15 }],
  [/sweet potato/, 168482, { per: 130 }],
  [/spinach/, 168462, { handful: 30 }],
  [/cabbage|coleslaw/, 169975, {}],
  [/avocado/, 171705, { per: 150 }],
  [/chickpeas/, 173800, { tin: 240 }],
  [/black beans/, 175238, { tin: 240 }],
  [/olives/, 170457, { per: 4, note: 'Olives are a small amount and counted roughly.' }],
  // meat and fish
  [/chicken/, 171054, {}],
  [/minced beef|ground beef/, 171796, {}],
  [/\bbeef\b/, 171796, {}],
  [/pork belly|lard/, 167812, {}],
  [/crackling|chicharr/, 167961, {}],
  [/bacon/, 168277, { per: 25 }],
  [/\bham\b/, 173864, {}],
  [/salami|cecina|cured smoked pork|pork chops/, 172936, {}],
  [/white fish|cod|fish fillets/, 171955, {}],
  // bread, pastry, biscuits
  [/tortillas?/, 167535, { per: 30 }],
  [/pizza base/, 174924, { per: 250, note: 'The pizza base is counted as white bread dough (about 250 g).' }],
  [/spring-roll wrappers|spring roll wrappers|wrappers/, 172802, { per: 32 }],
  [/brioche|bread/, 174924, { per: 35 }],
  [/pie shell/, 175065, { per: 180 }],
  [/puff pastry/, 172790, {}],
  [/digestive biscuits|graham crackers/, 174957, {}],
  [/gingernut/, 174956, {}],
  [/vanilla wafers|shortbread/, 174974, {}],
  [/granola/, 171646, { tbsp: 7 }],
  // condiments and drinks
  [/soy sauce/, 174277, { tbsp: 16 }],
  [/barbecue sauce|bbq sauce/, 171827, { cup: 280 }],
  [/chilli sauce|chili sauce/, 171827, { cup: 280, note: 'Sweet chilli sauce is counted like barbecue sauce.' }],
  [/rum|banana liqueur/, 174817, { tbsp: 14 }],
  [/beer|sparkling water/, null],
  [/coconut water/, 174831, { cup: 240 }],
  [/baking powder/, 172803, { tbsp: 13.8 }],
  [/bicarbonate|baking soda/, 175040, { tbsp: 13.8 }],
  [/\bsalt\b/, 173468, { tbsp: 18, pinch: 0.4 }],
];

// lines written in a way the parser can't read, spelled out
const OVERRIDES = {
  'Cream cheese frosting (as for banana cake), doubled': ['400 g cream cheese', '150 g butter', '500 g icing sugar'],
  'Frosting: 200 g cream cheese, 75 g butter, 250 g icing sugar, 1 tsp vanilla': ['200 g cream cheese', '75 g butter', '250 g icing sugar'],
  'Frosting: 100 g butter (browned and cooled until set), 200 g icing sugar, 1 tbsp milk': ['100 g butter', '200 g icing sugar', '1 tbsp milk'],
  '60 g butter + 100 g brown sugar (for the caramel)': ['60 g butter', '100 g brown sugar'],
  '1 egg + 120 ml water (for the dough)': ['1 egg'],
  '1 scoop each of vanilla, chocolate and strawberry ice cream': ['3 scoops ice cream'],
  'Chocolate sauce, strawberry sauce and pineapple sauce': ['3 tbsp chocolate sauce'],
  'Frying oil': [],
  'Chocolate hazelnut spread': ['120 g chocolate spread'],
  'Whipped cream': ['30 g whipped cream'],
  'Chopped nuts': ['15 g mixed nuts'],
  'Grated dark chocolate': ['20 g dark chocolate'],
  'Desiccated coconut, to roll': ['30 g desiccated coconut'],
  'Toppings: granola, sliced banana, coconut flakes, seeds': ['30 g granola', '60 g banana', '5 g coconut flakes', '1 tbsp mixed seeds'],
};
// unmeasured seasonings and cooking fat ("Salt", "Olive oil") aren't counted
const UNMEASURED = /^(salt( and pepper)?|olive oil|oil|butter|squeeze of lime|1 lime|salt and black pepper)$/i;
const SKIP = /\b(optional|to serve|to top|to finish|to dust|for dusting|for frying|deep frying|for the pan|for the dishes|for the tin|to glaze|to garnish|to taste|toppings?:|sprinkles or|crème fraîche, to)\b/i;
const FRYING = /\b(for frying|deep frying|frying)\b/i;

// ---------- parsing ----------
const FRAC = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
function number(s) {
  s = s.trim();
  const m = /^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔⅛])?/.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? FRAC[m[2]] : 0);
}
const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

// returns { grams, food } or { skip, reason } or { unknown }
function parseLine(line) {
  const low = line.toLowerCase();
  const hit = FOODS.find(([re]) => re.test(low));
  if (!hit) return { unknown: true };
  const [, fdc, o = {}] = hit;
  if (fdc === null) return { skip: true, note: o.note };
  // metric amounts anywhere in the line win: "190 g (1½ cups) plain flour", "1 tin (about 500 g) …"
  const metric = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|litres?|l)\b/i.exec(line);
  if (metric) {
    let v = parseFloat(metric[1].replace(',', '.'));
    const u = metric[2].toLowerCase();
    if (u === 'kg') v *= 1000;
    if (u === 'ml') v *= o.ml ?? 1;
    if (u === 'l' || u.startsWith('litre')) v *= 1000 * (o.ml ?? 1);
    return { grams: v, fdc, note: o.note };
  }
  // juice of 2 limes
  const juice = /juice of (\d+|a|one|two)/i.exec(line);
  if (juice) return { grams: (WORDNUM[juice[1]] ?? +juice[1]) * (o.per ?? 30), fdc, note: o.note };
  // leading amount and unit
  const m = /^\s*(\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(tbsp|tsp|cups?|pinch|handfuls?|scoops?|sheets?|cloves?|rashers?|slices?|tins?|cans?|small|large|medium)?\b/i.exec(line);
  let amount = m ? number(m[1]) : null;
  if (m && m[2]) amount = (amount + parseFloat(m[2])) / 2;   // "3–4 tbsp" → 3.5
  const unit = (m?.[3] || '').toLowerCase().replace(/s$/, '');
  if (amount == null) {
    if (/^(a )?pinch/i.test(line)) return { grams: o.pinch ?? 0.4, fdc, note: o.note };
    if (/^(a )?handful/i.test(line)) return { grams: o.handful ?? 30, fdc, note: o.note };
    if (/^(a )?few|^squeeze|^splash/i.test(line)) return { skip: true };
    return { unknown: true };
  }
  const g = {
    tbsp: (o.tbsp ?? 15 * (o.ml ?? 1)), tsp: (o.tbsp ?? 15 * (o.ml ?? 1)) / 3, cup: o.cup ?? 240 * (o.ml ?? 1),
    pinch: o.pinch ?? 0.4, handful: o.handful ?? 30, scoop: o.scoop ?? 66, clove: 3, rasher: 25, slice: o.per ?? 35,
    tin: o.tin ?? 400, can: o.tin ?? 400, small: o.small ?? (o.per ?? 100) * 0.7, large: (o.per ?? 100) * 1.25, medium: o.per ?? 100,
    sheet: o.per ?? 2,
  }[unit] ?? o.per;
  if (g == null) return { unknown: true };
  return { grams: amount * g, fdc, note: o.note };
}

// ---------- servings ----------
function servings(r, totalGrams) {
  const s = r.serves;
  if (/jar|bottle/.test(s)) return { n: Math.max(1, totalGrams / 15), per: 'tablespoon' };
  const loaf = /loaf \((\d+) slices\)/.exec(s);
  if (loaf) return { n: +loaf[1], per: 'slice' };
  const each = /^(\d+)\s+(cookies|muffins|bars|squares|balls|cupcakes|scones|rolls|bites|skewers)/.exec(s);
  if (each) return { n: +each[1], per: { cookies: 'cookie', muffins: 'muffin', bars: 'bar', squares: 'square', balls: 'ball', cupcakes: 'cupcake', scones: 'scone', rolls: 'roll', bites: 'bite', skewers: 'skewer' }[each[2]] };
  const range = /^(\d+)\s*[–-]\s*(\d+)/.exec(s);
  if (range) return { n: (+range[1] + +range[2]) / 2, per: 'serving' };
  const lead = /^(\d+)/.exec(s);
  return { n: lead ? +lead[1] : 1, per: 'serving' };
}

// ---------- main ----------
const need = new Set(FOODS.map(f => f[1]).filter(Boolean).map(String));
const per100 = {};
const rl = createInterface({ input: createReadStream(join(csvDir, 'food_nutrient.csv')) });
let head = null;
for await (const line of rl) {
  const f = line.split(',').map(x => x.replace(/"/g, ''));
  if (!head) { head = Object.fromEntries(f.map((h, i) => [h, i])); continue; }
  const fdc = f[head.fdc_id], key = NUTRIENTS[f[head.nutrient_id]];
  if (!key || !need.has(fdc)) continue;
  (per100[fdc] ||= {})[key] = parseFloat(f[head.amount]) || 0;
}

const tmp = join(dir, 'recipes.mjs');
await build({ entryPoints: [new URL('../src/data/recipes/index.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'warning' });
const { recipes } = await import(tmp + '?' + Date.now());

const out = {}, unknown = [];
for (const r of recipes) {
  const tot = { kcal: 0, protein: 0, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, sodium: 0 };
  const notes = new Set();
  let grams = 0, excluded = false, fried = false, unmeasured = false;
  for (const raw of r.ingredients) {
    const lines = OVERRIDES[raw] ?? [raw];
    for (let line of lines) {
      line = line.replace(/,?\s*plus (extra|more)\b.*$/i, '');   // "60 g sugar, plus extra for the dishes" → count the 60 g
      if (FRYING.test(line) && /oil|lard/i.test(line)) { fried = true; continue; }
      if (UNMEASURED.test(line.trim())) { unmeasured = true; continue; }
      if (SKIP.test(line)) { excluded = true; continue; }
      const p = parseLine(line);
      if (p.note) notes.add(p.note);
      if (p.skip) continue;
      if (p.unknown) { unknown.push(`${r.slug}: ${line}`); continue; }
      const n = per100[p.fdc];
      if (!n) { unknown.push(`${r.slug}: no USDA data for ${p.fdc} (${line})`); continue; }
      grams += p.grams;
      for (const k of Object.keys(tot)) tot[k] += ((n[k] || 0) * p.grams) / 100;
    }
  }
  if (fried) notes.add('Doesn\'t include oil absorbed during frying, which adds calories and fat.');
  if (excluded) notes.add('Optional extras and toppings "to serve" aren\'t included.');
  if (unmeasured) notes.add('Seasoning and cooking fat without a set amount aren\'t included.');
  const { n, per } = servings(r, grams);
  const one = k => tot[k] / n;
  out[r.slug] = {
    per, servings: Math.round(n * 10) / 10,
    kcal: Math.round(one('kcal')), protein: +one('protein').toFixed(1), carbs: +one('carbs').toFixed(1), sugars: +one('sugars').toFixed(1),
    fat: +one('fat').toFixed(1), sat: +one('sat').toFixed(1), fibre: +one('fibre').toFixed(1), salt: +((one('sodium') * 2.5) / 1000).toFixed(2),
    notes: [...notes],
  };
}
await writeFile(new URL('../src/data/recipes/nutrition.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`Nutrition for ${Object.keys(out).length} recipes saved.`);
const list = Object.entries(out).sort((a, b) => b[1].kcal - a[1].kcal);
for (const [slug, v] of list) console.log(`${String(v.kcal).padStart(5)} kcal per ${v.per.padEnd(10)} ${slug}`);
if (unknown.length) { console.log(`\n${unknown.length} lines not understood:`); unknown.forEach(u => console.log('  ' + u)); }
