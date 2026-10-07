import type { Topic } from './types';

// Sources checked on 7 October 2026. Numbers in [brackets] refer to `sources` below.
export const bananaBread: Topic = {
  slug: 'banana-bread',
  title: 'Banana bread',
  emoji: '🍞',
  tagline: 'The world\'s favourite thing to do with brown bananas: its history, the science of ripeness, and the best recipes on the internet.',
  updated: '2026-10-07',
  intro: [
    'Banana bread is a quick bread: it rises with baking soda or baking powder instead of yeast, so it goes from bowl to oven in a few minutes.[1]',
    'It is older than you might think. Bananas reached the United States in the 1870s, and banana bread was on sale in Lawrence, Kansas, by January 1881.[1] Recipes only became common in American cookbooks in the 1930s, once baking powder was easy to buy, with versions published by Better Homes and Gardens, the United Fruit Company and Pillsbury.[1][3] Historians still argue over whether it was thrifty Depression-era baking or clever marketing by flour and baking soda companies.[1]',
    'The brown bananas matter. As a banana ripens, its starch turns into sugar. When America\'s Test Kitchen baked loaves with bananas at different stages, the very ripe ones gave the sweetest, moistest and most banana-flavoured bread, while yellow or green bananas made a drier loaf they described as "vegetal" and "astringent".[2]',
    'In spring 2020 it became the comfort bake of lockdown: for 30 days it was the most searched-for recipe in every US state, with searches up 54%.[3]',
  ],
  facts: [
    { label: 'Type', value: 'Quick bread (no yeast)', source: 1 },
    { label: 'On sale since', value: '1881, Lawrence, Kansas', source: 1 },
    { label: 'Best bananas', value: 'Brown and spotty', source: 2 },
    { label: 'National Banana Bread Day', value: '23 February (US)', source: 1 },
    { label: 'Lockdown peak', value: 'Most-searched recipe in every US state, spring 2020', source: 3 },
  ],
  tip: {
    title: 'Bananas not brown yet?',
    text: 'Close them in a paper bag for a couple of days: it traps the ethylene gas that ripens them while letting moisture escape. Roasting them in the oven turns the skins black but does not make them any sweeter, because the starch has not turned into sugar.[4]',
  },
  faqs: [
    { q: 'Does banana bread need yeast?', a: 'No. It is a quick bread, raised with baking soda or baking powder.[1]' },
    { q: 'Can I use yellow bananas?', a: 'You can, but the loaf will be less sweet, less moist and less banana-y. If you can wait, ripen them in a paper bag first.[2][4]' },
    { q: 'Can I ripen bananas in the oven?', a: 'It blackens the skins, but the starch does not turn into sugar, so they are not really riper.[4]' },
    { q: 'When is National Banana Bread Day?', a: 'February 23rd, in the United States.[1]' },
  ],
  ourRecipes: ['classic-banana-bread', 'chocolate-chip-banana-bread', 'vegan-banana-bread'],
  webRecipeMatch: 'banana.{0,30}(bread|loaf)',
  newsMatch: 'banana bread|banana loaf',
  links: [
    { title: 'Banana bread', publisher: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Banana_bread', why: 'The history, with sources, including the 1881 Kansas sighting and the 1930s cookbook boom.' },
    { title: 'Banana ripeness in banana bread', publisher: 'America\'s Test Kitchen', url: 'https://www.americastestkitchen.com/how_tos/8420-banana-ripeness-in-banana-bread', why: 'A side-by-side test of loaves made with yellow, spotty and very ripe bananas.' },
    { title: 'The best way to ripen bananas', publisher: 'America\'s Test Kitchen', url: 'https://www.americastestkitchen.com/how_tos/5746-the-best-way-to-ripen-bananas', why: 'Why the paper bag works and the oven trick does not.' },
    { title: 'Why banana bread became the comfort bake of the pandemic', publisher: 'CNN', url: 'https://www.cnn.com/2020/05/02/health/banana-bread-pandemic-baking-wellness-trnd/index.html', why: 'The 2020 lockdown craze, with a food historian on where the recipe came from.' },
    { title: 'The easiest banana bread (3 ingredients)', publisher: 'Joshua Weissman', url: 'https://www.joshuaweissman.com/recipes/best-easy-banana-bread-recipe', why: 'Bananas, eggs and a box of cake mix: for when you want banana bread with almost no effort.' },
    { title: 'Banana bread on Google Trends', publisher: 'Google', url: 'https://trends.google.com/trends/explore?date=all&q=banana%20bread', why: 'See the April 2020 spike, and the smaller one every February, for yourself.' },
  ],
  sources: [
    { title: 'Banana bread', publisher: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Banana_bread' },
    { title: 'Banana ripeness in banana bread', publisher: 'America\'s Test Kitchen', url: 'https://www.americastestkitchen.com/how_tos/8420-banana-ripeness-in-banana-bread' },
    { title: 'Banana bread is the unofficial snack of the coronavirus pandemic (2 May 2020)', publisher: 'CNN', url: 'https://www.cnn.com/2020/05/02/health/banana-bread-pandemic-baking-wellness-trnd/index.html' },
    { title: 'The best way to ripen bananas', publisher: 'America\'s Test Kitchen', url: 'https://www.americastestkitchen.com/how_tos/5746-the-best-way-to-ripen-bananas' },
  ],
  related: ['ripening-and-storing', 'plantains', 'banana-industry'],
  showLoafCost: true,
};
