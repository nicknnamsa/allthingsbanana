// A topic hub: one banana subject, with everything the site knows about it gathered on one page.
// Rule for the written parts: every fact carries a source number, and every source is a real,
// checked link. If something can't be sourced, it doesn't go in.

export interface Source { title: string; publisher: string; url: string }
// text may contain [1], [2]… which become links to the numbered sources
export interface Topic {
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  updated: string;                 // when the written parts were last checked, e.g. '2026-10-07'
  intro: string[];                 // the short answer: a few paragraphs, every claim sourced
  facts: { label: string; value: string; source?: number }[];
  tip?: { title: string; text: string };
  faqs: { q: string; a: string }[];
  ourRecipes: string[];            // slugs of our Banacipes recipes
  webRecipeMatch: string;          // regex (as text) for recipes from other sites
  newsMatch: string;               // regex (as text) for the live news feed
  links: { title: string; publisher: string; url: string; why: string }[];   // the best of the internet
  sources: Source[];               // numbered from 1
  related: string[];               // other topic slugs
  showLoafCost?: boolean;          // banana bread: live cost of the bananas for one loaf
}

export interface TopicStub { slug: string; title: string; emoji: string; tagline: string }
