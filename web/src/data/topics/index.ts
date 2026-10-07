// All topic hubs. A hub goes live when its data file is added to `topics`;
// until then it can sit in `upcoming` so the Topics page shows what's on the way.
import { bananaBread } from './banana-bread';
import type { Topic, TopicStub } from './types';

export * from './types';

export const topics: Topic[] = [bananaBread];

export const upcoming: TopicStub[] = [
  { slug: 'plantains', title: 'Plantains', emoji: '🫓', tagline: 'Tostones, maduros, mofongo, and how plantains differ from bananas.' },
  { slug: 'ripening-and-storing', title: 'Ripening & storing', emoji: '⏳', tagline: 'Ripen them fast, slow them down, freeze them, and why they go brown.' },
  { slug: 'banana-varieties', title: 'Banana varieties', emoji: '🌱', tagline: 'Cavendish, Gros Michel, red bananas, saba and more, and why we all eat one kind.' },
  { slug: 'banana-industry', title: 'The banana industry', emoji: '🚢', tagline: 'Prices, trade, Fairtrade, workers and the disease threatening the Cavendish.' },
  { slug: 'banana-culture', title: 'Banana culture', emoji: '📏', tagline: 'Banana for scale, the Savannah Bananas, records and the internet\'s banana obsession.' },
];

export const topicBySlug = (slug: string) => topics.find(t => t.slug === slug);
export const anyTopic = (slug: string): TopicStub | undefined => topics.find(t => t.slug === slug) ?? upcoming.find(t => t.slug === slug);
