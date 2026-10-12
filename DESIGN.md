# Design direction: the crate label

**See it:** [`audit/specimen.html`](audit/specimen.html) (open it in a browser; add `?dark` to the address for the dark theme), or the screenshots `audit/specimen-light-1280.jpg`, `specimen-dark-1280.jpg`, `specimen-light-390.jpg` and `specimen-dark-390.jpg`.

## The idea

Every banana you've eaten crossed the sea in a labelled crate: printed with heavy wood type, stamped with a number and a date, and sorted by ripeness. The site becomes that packing house.

- **Today's puzzle is a crate label:** "Bananadle · Mon 12 Oct · No. 6", with a double-ruled border and notched corners.
- **Results are rubber stamps:** BIRDIE, PAR, BOGEY, MISS.
- **Prices are chalked on the market board.**
- **Everything is sorted from green to brown.**

It's one idea, used everywhere. It fixes the audit's tells:
- **Type:** wood-type slab and a working sans replace Inter.
- **Icons:** a hand-drawn banana mark and a few line icons replace emoji.
- **Shapes:** straight ruled boxes replace identical rounded cards, with exactly one round thing: the sticker.
- **Colour:** paper, ink and banana replace purple and blue.

## Palette

Light is the "crate in daylight", dark the "warehouse at night". The site follows the visitor's system setting and has a toggle. Every text colour passes WCAG AA (4.5:1) on its background; the measured ratios are in the comments.

```css
:root {                      /* light */
  --paper:  #FBF4E2;  /* kraft cream background */
  --card:   #FFFDF6;  /* label stock */
  --ink:    #231A10;  /* stamp ink: text, rules, borders      15.6:1 */
  --ink-2:  #5A4730;  /* secondary text                        8.1:1 */
  --ink-3:  #7A6548;  /* captions, meta                        5.1:1 */
  --line:   #E2D3AE;  /* hairlines only (decoration)               */
  --banana: #FFD23F;  /* fills only: buttons, stickers, highlights,
                         always with ink text (11.9:1). Never text on paper. */
  --leaf:   #2F6B22;  /* unripe green: "up", correct moves         5.9:1 */
  --spot:   #7A4520;  /* ripe brown                                7.1:1 */
  --stamp:  #B42E1A;  /* crate-stamp red: "down", misses           5.7:1 */
  /* the ripeness scale (signature, see below) */
  --r1: #4E8A2E; --r2: #8DB33A; --r3: #C9CC3F; --r4: #FFD23F; --r5: #F4BC2C; --r6: #D9952B; --r7: #7A4520;
}
:root[data-theme="dark"] {
  --paper: #16110A; --card: #211910;
  --ink:   #F7ECD2;  /* 16.0:1 */  --ink-2: #D3C09A;  /* 10.5:1 */  --ink-3: #A99572;  /* 6.5:1 */
  --line:  #3B2F1F;
  --leaf:  #86CC72;  /*  9.7:1 */  --spot:  #D29A66;  /*  7.7:1 */  --stamp: #FF8266;  /*  7.7:1 */
}
```

No blue anywhere. Links are ink, underlined in banana yellow.

## Type

| Face | Used for | Why |
|---|---|---|
| **Alfa Slab One** | headings, puzzle start pages, prices, scores, stamps | A heavy slab serif cut like the wood type on fruit-crate labels and market posters. It's loud and a little absurd, which suits "a serious website about bananas". It has one weight only, which keeps everyone honest. |
| **IBM Plex Sans** (400 / 500 / 600 / 700) | body text, inputs, buttons, labels, tables | It reads cleanly at 14px on a phone and has tabular figures, so prices and scores line up. Its slightly industrial feel ("shipping manifest") pairs with the wood type without copying it. |

**Type scale** (mobile → desktop; nothing below 12px):

| Token | Size | Use |
|---|---|---|
| `--t-hero` | 40 → 68px | today's start page on the crate label |
| `--t-1` | 30 → 46px | page titles |
| `--t-2` | 23 → 30px | section headings |
| `--t-3` | 19px | card titles (Plex Bold) |
| `--t-body` | 16.5px | body |
| `--t-small` | 14px | meta, captions |
| `--t-label` | 12.5px | Plex Bold, letter-spaced labels. Used sparingly, max one per block |

## Shapes, rules and motion

- **Rules, not cards.** Blocks are separated by 2px ink rules and ruled boxes, like a printed label.
  - The crate label (double rule, notched corners) is used for **one** thing per page: the main thing.
- **Three corner sizes only:**
  - 0 for boxes and labels
  - 8px for inputs and buttons
  - fully round for the sticker
- **Two buttons:**
  - ink (the main action)
  - banana (the secondary action, or the main one on dark sections)
- **No emoji as icons.** A small banana mark (SVG) is the logo and favicon, plus a handful of simple line icons drawn to match. Emoji stay where they're content, like the share grid.
- **Motion:** stamps thump down on results, and the ripeness bar fills step by step. With reduced-motion on, everything simply appears. That includes the existing animations that ignore it today.

## The signature: the ripeness scale

There's one detail only this site has: **a 7-step ripeness scale, green → yellow → brown with sugar spots**, used as the progress bar wherever progress happens:

- **Bananadle:** each step ripens the banana. **Par 4 lands on perfect yellow.** Go over par and it gets spotty, then brown. You can see how you're doing without reading a number.
- **Banana Clicker:** levels and hype stages ripen through the same scale.
- **Recipes:** "What are your bananas like?" picks a point on the same scale (it already uses green, yellow, spotty and brown).
- **Loading:** the same bar fills while Wikipedia answers.

Only one signature: the price board and stamps are part of the crate idea, not separate gimmicks.

## Navigation

The logo goes home. There are four tabs, each with a one-line descriptor on desktop:

| Tab | Descriptor | Contains |
|---|---|---|
| **Bananadle** | daily puzzle | the game (unchanged) |
| **Clicker** | world league | the Banana Clicker |
| **Recipes** | 90 + 5,203 | Banacipes (the name stays as the page title, the tab says Recipes) |
| **Prices** | & the map | Bananalytics + Banana World as two views of one section |

Everything else stays and is still linked from the home page and footer: news, topics, the Banana Cube, About and Privacy. On mobile the search box becomes an icon, and the price ticker only appears on the home page and Prices. Nothing is removed.

## Home page wireframe

Phone (390px). Today's Bananadle is playable without a click:

```
┌──────────────────────────────────────┐
│ 🍌mark   Bananadle Clicker Recipes  ⌕│  ← 56px header (was 226px)
├──────────────────────────────────────┤
│ ╔══════════════════════════ (PAR 4) ╗│  ← the crate label, sticker on the corner
│ ║ BANANADLE · MON 12 OCT      No. 6 ║│
│ ║───────────────────────────────────║│
│ ║ Queen Victoria                    ║│  ← start page in wood type
│ ║ Get to Banana by naming pages it  ║│
│ ║ links to. 41 people tried today.  ║│
│ ║ [ England? Albert? Biscuits?  ][Go]║│  ← type here, straight away
│ ║ ▓▓░░░░░  ripeness: 0 steps        ║│  ← signature progress bar
│ ║ How to play ›                     ║│
│ ╚═══════════════════════════════════╝│
│ CLICKER LEAGUE                        │
│ 🇬🇧 United Kingdom  6,806   you're #1  │  ← rivalry strip, one tap to play
│ 🇪🇸 Spain           787    [Peel ›]    │
├──────────────────────────────────────┤
│ RECIPE OF THE DAY                     │
│ [photo] Banoffee pie · 2h 30 · 3 🍌    │
├──────────────────────────────────────┤
│ MARKET BOARD                          │
│ Bananas $1,135/t ▲2.7 │ US shops 65¢  │
├──────────────────────────────────────┤
│ BANANA NEWS (5, small thumbnails)     │
│ More news ›                           │
├──────────────────────────────────────┤
│ footer: Topics · Cube · About · Privacy│
└──────────────────────────────────────┘
```

Desktop (1280px): the crate label takes the left two-thirds of the first screen. The clicker league and the market board stack on the right. Recipe of the day and news sit below.

When today's puzzle is done, the crate label shows the stamped result and a countdown ("Next crate in 6h 12m"), plus Share and Practice.

## Copy (examples of the voice)

Short, specific, and dry rather than wacky:

- **Home crate label:** "Get to Banana by naming pages it links to. 41 people tried today."
- **Result:** stamped **BIRDIE**, "3 steps. Queen Victoria → Jamaica → Banana. Next crate in 6h 12m."
- **Miss:** "Queen Victoria never mentions biscuits. Bold, though."
- **Clicker strip:** "Spain is 120 bananas behind you. They know."
- **Market board footnote:** "Monthly averages. Not financial advice, obviously."
- **Gone:** "Explore", "Everything banana in one place", "our banana lab", "coming soon" tiles.

## Build order (once you approve)

1. **The design tokens, fonts, header and footer** in `Base.astro`. These are shared by every page, so this step alone retires Inter, the emoji tiles and the purple gradients.
2. **Home page**, with the playable Bananadle crate label (the "135 → 3" fix).
3. **Bananadle page:** same crate label, rules pop-up on first visit only, ripeness progress, stamped results, the countdown.

Then the Clicker, Recipes, Prices + Map, and the rest. After each page: screenshots at 390px and 1280px in both themes, checked against AUDIT.md.

## Decisions for you

1. **Tab names:** Bananadle · Clicker · Recipes · Prices. The pun names stay as page titles. OK?
2. **Light theme by default** (following the visitor's system setting), with a dark toggle. Today the site is dark-only.
3. **The price ticker only on the home page and Prices,** instead of on every page.
