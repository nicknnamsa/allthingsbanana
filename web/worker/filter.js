// Decides whether an item is really about bananas. Edit these lists freely.
// v2 will add an AI relevance check on top; this keyword pass stays as the first gate.

// The title must mention bananas at all.
const MUST_MATCH = /\bbananas?\b/i;

// Things called "banana" that aren't about bananas.
export const NOT_BANANAS = [
  /banana\s*republic/i,          // the clothing brand, and the political phrase
  /banana\s*boat/i,              // sunscreen brand
  /bananagrams/i,                // word game
  /bananarama/i,                 // the band
  /nano[\s-]*banana/i,           // Google's image model
  /banana\s*pi\b/i,              // single-board computer
  /\b(go|goes|going|gone|went|been)\s+bananas\b/i,   // "fans go bananas", "it's been bananas"
  /\bdriv(e|es|ing|en)\s+\w+\s+bananas\b/i,     // "driving me bananas"
  /banana\s*skins?\b/i,          // UK idiom for a political blunder
  /blue\s*banana/i,              // fashion brand
];

// Never show these, whatever the context. Extend as needed.
export const BLOCKED_WORDS = [/\bporn/i, /\bnsfw\b/i, /\bnude/i, /\bsex(ual|y)?\b/i, /\bonlyfans\b/i];

// trusted: the story comes from a banana-only source, so the headline needn't say "banana"
export function isAboutBananas(title, trusted = false) {
  if (!trusted && !MUST_MATCH.test(title)) return false;
  if (NOT_BANANAS.some(re => re.test(title))) return false;
  if (BLOCKED_WORDS.some(re => re.test(title))) return false;
  return true;
}
