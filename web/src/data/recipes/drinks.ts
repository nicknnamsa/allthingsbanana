import type { RecipeInput } from './types';

export const drinks: RecipeInput[] = [
  {
    name: 'Classic banana smoothie', emoji: '🥤', blurb: 'Banana, yogurt, milk and honey: the smoothie everyone starts with.',
    meals: ['drink', 'breakfast'], bananas: 2, level: 5, ripeness: ['spotty', 'brown'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'Worldwide',
    ingredients: ['2 ripe bananas (frozen for a thicker smoothie)', '250 ml (1 cup) milk', '120 g (½ cup) plain yogurt', '1 tsp honey', 'A few ice cubes'],
    steps: ['Put everything in a blender.', 'Blend until smooth and frothy.', 'Pour into glasses and drink straight away.'],
  },
  {
    name: 'Peanut butter banana smoothie', emoji: '🥜', blurb: 'Thick, filling and tastes like a milkshake.',
    meals: ['drink', 'breakfast'], bananas: 1, level: 4, ripeness: ['spotty', 'brown'], mins: 5, serves: '1', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'United States',
    ingredients: ['1 frozen ripe banana', '2 tbsp peanut butter', '250 ml (1 cup) milk or plant milk', '2 tbsp rolled oats', '1 tsp cocoa powder (optional)'],
    steps: ['Blend everything until completely smooth.', 'Add a splash more milk if it is too thick.'],
  },
  {
    name: 'Strawberry banana smoothie', emoji: '🍓', blurb: 'The pink classic: sweet strawberries and creamy banana.',
    meals: ['drink', 'breakfast'], bananas: 1, level: 3, ripeness: ['yellow', 'spotty'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'Worldwide',
    ingredients: ['1 banana', '200 g strawberries, hulled (fresh or frozen)', '200 ml milk', '100 g yogurt', '1 tsp honey'],
    steps: ['Blend everything until smooth.', 'Pour and serve, topped with a strawberry.'],
  },
  {
    name: 'Green banana smoothie', emoji: '🥬', blurb: 'Spinach you can\'t taste, thanks to banana and mango.',
    meals: ['drink', 'breakfast'], bananas: 1, level: 3, ripeness: ['spotty'], mins: 5, serves: '1', difficulty: 'easy',
    diet: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'no-bake'], origin: 'Worldwide',
    ingredients: ['1 ripe banana', '2 handfuls of baby spinach', '100 g frozen mango', '250 ml (1 cup) coconut water or almond milk', '1 tbsp chia seeds', 'Squeeze of lime'],
    steps: ['Blend the spinach with the liquid first until smooth.', 'Add the banana, mango, chia and lime and blend again.'],
  },
  {
    name: 'Banana milkshake', emoji: '🥛', blurb: 'Diner-style: banana, vanilla ice cream and cold milk.',
    meals: ['drink', 'dessert'], bananas: 2, level: 4, ripeness: ['spotty'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'United States',
    ingredients: ['2 ripe bananas', '3 scoops vanilla ice cream', '300 ml (1¼ cups) cold whole milk', 'Whipped cream and a pinch of nutmeg, to top'],
    steps: ['Blend the bananas, ice cream and milk until smooth and frothy.', 'Pour into tall glasses, top with whipped cream and a pinch of nutmeg.'],
  },
  {
    name: 'Korean banana milk', emoji: '🇰🇷', blurb: 'A homemade take on Korea\'s famous sweet banana-flavoured milk.',
    meals: ['drink'], bananas: 1, level: 4, ripeness: ['spotty', 'brown'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'South Korea',
    ingredients: ['1 very ripe banana', '400 ml cold whole milk', '1–2 tbsp sugar or honey', 'Pinch of salt', '¼ tsp vanilla extract'],
    steps: ['Blend everything for a full minute until very smooth.', 'For the silkiest version, strain through a fine sieve.', 'Serve very cold.'],
  },
  {
    name: 'Banana lassi', emoji: '🇮🇳', blurb: 'A cool Indian yogurt drink with banana and cardamom.',
    meals: ['drink', 'breakfast'], bananas: 1, level: 4, ripeness: ['spotty'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free', 'no-bake'], origin: 'India',
    ingredients: ['1 ripe banana', '250 g plain yogurt', '150 ml cold milk or water', '1 tbsp sugar or honey', 'Pinch of ground cardamom', 'Ice'],
    steps: ['Blend everything until smooth and frothy.', 'Pour over ice and dust with a little more cardamom.'],
  },
  {
    name: 'Frozen banana daiquiri', emoji: '🍹', blurb: 'A blended rum cocktail with banana, lime and ice.',
    meals: ['drink'], bananas: 1, level: 4, ripeness: ['spotty'], mins: 5, serves: '2', difficulty: 'easy',
    diet: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'alcohol'], origin: 'Cuba',
    ingredients: ['1 ripe banana', '100 ml white rum', '30 ml lime juice', '20 ml sugar syrup', '2 handfuls of ice'],
    steps: ['Blend everything until smooth and slushy.', 'Pour into chilled glasses and garnish with a banana slice.'],
    tip: 'For an alcohol-free version, swap the rum for pineapple juice.',
  },
  {
    name: 'Banana hot chocolate', emoji: '☕', blurb: 'Rich hot chocolate blended with banana for a velvety, naturally sweet mug.',
    meals: ['drink'], bananas: 1, level: 3, ripeness: ['brown'], mins: 10, serves: '2', difficulty: 'easy',
    diet: ['vegetarian', 'gluten-free'], origin: 'Worldwide',
    ingredients: ['1 very ripe banana', '400 ml milk', '50 g dark chocolate, chopped', '1 tbsp cocoa powder', 'Pinch of cinnamon'],
    steps: ['Heat the milk until steaming, then whisk in the chocolate and cocoa until melted.', 'Blend with the banana and cinnamon until smooth and frothy (take care blending hot liquids: vent the lid).', 'Pour into mugs.'],
  },
];
