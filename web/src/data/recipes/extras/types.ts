// The long version of a recipe: a short intro, prep and cook times, a fuller method with a name
// for every step, tips, how to keep it and ways to change it. Keyed by the recipe's slug.
// The ingredient lists stay in the main recipe files (the nutrition numbers are worked out from them).
export interface Extra {
  intro: string;               // two to four sentences: what it is, why it works
  prep: number;                // minutes of hands-on work
  cook: number;                // minutes on the heat or in the oven; anything left of `mins` is resting or chilling
  method: [string, string][];  // [step name, step]
  tips?: string[];
  keep?: string;               // storing, freezing, reheating
  swaps?: string[];            // variations
}
