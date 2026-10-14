import type { Extra } from './types';

export const drinks: Record<string, Extra> = {
  'classic-banana-smoothie': {
    intro: 'The smoothie everyone starts with: banana, milk, yogurt and a little honey. Freeze the bananas first and it comes out thick, cold and milkshake-like, with no ice watering it down.',
    prep: 5, cook: 0,
    method: [
      ['Load the blender', 'Put the milk and yogurt in the blender first, then the bananas, honey and ice. Liquids at the bottom help the blades get going.'],
      ['Blend', 'Blend on high for 45–60 seconds until completely smooth and frothy.'],
      ['Pour and serve', 'Taste and add a little more honey if you like, then pour into glasses and drink straight away.'],
    ],
    tips: ['Frozen bananas make it thicker. Peel and slice them before freezing.', 'Spotty bananas give the sweetest smoothie.'],
    swaps: ['Add a handful of oats for a breakfast smoothie that keeps you full.', 'Add a pinch of cinnamon or a few dates.'],
  },
  'peanut-butter-banana-smoothie': {
    intro: 'Thick, creamy and filling enough to count as breakfast. Peanut butter and banana is one of the best pairings there is, and the oats make it last until lunch.',
    prep: 5, cook: 0,
    method: [
      ['Blend', 'Put the milk, peanut butter, oats, cocoa (if using) and frozen banana in the blender. Blend on high for a full minute until completely smooth.'],
      ['Adjust', 'If it is too thick to drink, add a splash more milk and blend again.'],
      ['Serve', 'Pour into a glass and drink straight away.'],
    ],
    tips: ['Blending for a full minute breaks the oats down so they are not gritty.'],
    swaps: ['Add a scoop of protein powder after a workout.', 'Add a pitted date or two for extra sweetness.'],
  },
  'strawberry-banana-smoothie': {
    intro: 'The classic combination: sweet banana, bright strawberries and a little yogurt. Use frozen strawberries in winter and you will get a thicker, colder smoothie than with fresh.',
    prep: 5, cook: 0,
    method: [
      ['Load the blender', 'Put the milk and yogurt in the blender, then the banana, strawberries and honey.'],
      ['Blend', 'Blend on high for 45–60 seconds until smooth.'],
      ['Serve', 'Pour into glasses and top each with a strawberry.'],
    ],
    tips: ['If using fresh strawberries, add a few ice cubes.'],
    swaps: ['Swap half the strawberries for raspberries.', 'Use orange juice instead of milk for a dairy-free, zingy version.'],
  },
  'green-banana-smoothie': {
    intro: 'A green smoothie that does not taste like a salad. The banana and mango cover up the spinach completely, and the lime keeps it fresh. Blend the greens first for a smooth result.',
    prep: 5, cook: 0,
    method: [
      ['Blend the greens', 'Blend the spinach with the coconut water or almond milk first, for 30 seconds, until completely smooth with no flecks of leaf.'],
      ['Add the fruit', 'Add the banana, mango, chia seeds and a squeeze of lime and blend again until smooth.'],
      ['Serve', 'Pour into a glass and drink straight away.'],
    ],
    tips: ['Baby spinach is milder than kale. Start there.'],
    swaps: ['Add a few slices of cucumber or a small piece of fresh ginger.', 'Use frozen pineapple instead of mango.'],
  },
  'banana-milkshake': {
    intro: 'An American diner milkshake: ripe bananas, vanilla ice cream and very cold milk, blended until thick enough that the straw stands up. Top with whipped cream and a little nutmeg.',
    prep: 5, cook: 0,
    method: [
      ['Chill the glasses', 'Put two tall glasses in the freezer for a few minutes.'],
      ['Blend', 'Blend the bananas, ice cream and milk for 30 seconds until smooth and frothy. Do not over-blend, or it gets thin.'],
      ['Serve', 'Pour into the cold glasses, top with whipped cream and a pinch of nutmeg.'],
    ],
    tips: ['For a thicker shake, use less milk. For thinner, add more.'],
    swaps: ['Add a spoon of peanut butter or a drizzle of caramel.', 'Use chocolate ice cream for a chocolate-banana shake.'],
  },
  'korean-banana-milk': {
    intro: 'Banana milk is one of South Korea’s best-loved drinks, sold in a little pot-bellied carton since 1974. This homemade version is sweet, creamy and tastes of real banana instead of flavouring. Straining it makes it silky.',
    prep: 5, cook: 0,
    method: [
      ['Blend', 'Put the banana, milk, sugar or honey, salt and vanilla in a blender and blend for a full minute until very smooth.'],
      ['Strain', 'For the silkiest version, pour through a fine sieve into a jug, pressing with a spoon.'],
      ['Chill and serve', 'Serve very cold, over ice if you like.'],
    ],
    tips: ['The pinch of salt brings out the banana flavour.', 'The riper the banana, the more it tastes like the real thing.'],
    keep: 'Keeps in the fridge for a day. Shake before drinking; it may darken a little.',
    swaps: ['Use oat milk for a dairy-free version.'],
  },
  'banana-lassi': {
    intro: 'A thick, cool yogurt drink from India, sweetened with banana and scented with cardamom. It is the perfect thing to drink with a spicy curry, or on its own on a hot afternoon.',
    prep: 5, cook: 0,
    method: [
      ['Blend', 'Blend the banana, yogurt, milk or water, sugar and cardamom until smooth and frothy, about 30 seconds.'],
      ['Serve', 'Pour over ice and dust with a little more cardamom.'],
    ],
    tips: ['Use full-fat yogurt for the creamiest lassi.'],
    swaps: ['Add a few strands of saffron soaked in a spoon of warm milk.', 'Swap half the banana for mango.'],
  },
  'frozen-banana-daiquiri': {
    intro: 'The daiquiri was born in Cuba with rum, lime and sugar. Blended with banana and ice, it becomes a thick, slushy beach-bar cocktail. Make it for people who say they do not like cocktails.',
    prep: 5, cook: 0,
    method: [
      ['Chill the glasses', 'Put two glasses in the freezer for a few minutes.'],
      ['Blend', 'Blend the banana, rum, lime juice, sugar syrup and ice until smooth and slushy.'],
      ['Serve', 'Pour into the chilled glasses and garnish with a banana slice on the rim.'],
    ],
    tips: ['For an alcohol-free version, swap the rum for pineapple juice.', 'Quick sugar syrup: dissolve equal amounts of sugar and hot water, then cool.'],
    swaps: ['Add a dash of dark rum on top for a deeper flavour.', 'Add 30 ml banana liqueur for an extra-banana version.'],
  },
  'banana-hot-chocolate': {
    intro: 'A rich hot chocolate with a whole banana blended in, which makes it naturally thicker and creamier. It is like a warm chocolate milkshake, and the best thing to do with a very ripe banana on a cold night.',
    prep: 5, cook: 5,
    method: [
      ['Heat the milk', 'Heat the milk in a saucepan until steaming, with small bubbles at the edges.'],
      ['Melt the chocolate', 'Take off the heat and whisk in the chopped chocolate and cocoa until melted and smooth.'],
      ['Blend', 'Pour into a blender with the banana and cinnamon. Hold the lid down with a tea towel, leaving a small gap for steam, and blend until smooth and frothy.'],
      ['Serve', 'Pour into mugs and serve hot.'],
    ],
    tips: ['Take care blending hot liquids: vent the lid and start on a low speed.', 'A stick blender in the pan is easier and safer.'],
    swaps: ['Top with whipped cream or a marshmallow.', 'Add a pinch of chilli for a Mexican-style hot chocolate.'],
  },
};
