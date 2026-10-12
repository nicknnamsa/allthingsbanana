# allthingsbanana.com audit

Stage 1 of the redesign: what's wrong today, with evidence. No code was changed.

**How this was done:**
- I read the whole codebase, ran the site locally with live news and prices, and loaded all 15 page types in Chrome at **390px** (phone) and **1280px** (desktop).
- For each page and width there's a first-screen shot (what you see before scrolling) and a full-page shot, all in [`audit/screens/`](audit/screens), e.g. `home-390-first-screen.jpg`.
- Each page was also measured for page weight, tap-target sizes, text sizes and sideways overflow.

---

## 1. The "AI-made" tells

### Type
- **One typeface everywhere: Inter**, the most common default on generated and template sites. Every heading, label, number and button uses it. Hierarchy comes only from weight (800/900) and size, so headings, prices, game titles and tags all feel like the same voice turned up or down.
- **The uppercase-label pattern has 28 separate style rules.** Small, bold, letter-spaced labels appear above almost everything ("DAILY PUZZLE", "RECIPE OF THE DAY", "TOPIC", "WHAT ARE YOUR BANANAS LIKE?", "YOUR STREAK", "BANANA POPULARITY"). It reads as a component library, not an editor's choices.
- **Text is too small in places.** Many visible text elements are under 12px: 720 on Banacipes at phone width (the recipe card tags), 53–73 on Bananalytics, 58 on the Cube page. The Cube's solution tree uses 9px text.

### Emoji used as icons and section markers
About 30 different emoji do the work of icons, including:
- **Tile art:** 🧠 Bananadle, 🍌 Clicker, 🧩 Cube, 🎲 Random twisters, 🍞 Banana bread, 🍳 Recipe of the day, each sitting in the middle of a gradient square.
- **Rule and button icons:** 🔗 🧭 ⛳ in the Bananadle intro; 🎲 "Surprise me"; 🌍 "Banana World"; 🔊 sound; 💡 hint; 🔥 badge.
- **Section titles:** "🍌 Banana popularity", "🍌 Banana Cube".

Emoji render differently on every phone. Big emoji on a soft gradient is the most recognisable "generated" look there is (see `more-1280-full.jpg`).

### Same card, same corners, everywhere
- **Almost every block is the same card:** dark surface, 1px border, rounded corners, sometimes a soft shadow. That covers news, tiles, stats, recipe facts, the leaderboard, streak boxes and charts. Nothing looks more important than anything else.
- **20 different corner radii are used:** 999px, 50%, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18, 20, 24, 26 and 28px. Each page made its own choices.
- **About 12 different button styles,** each defined locally (`.big`, `.ghost`, `.primary`, `.sd-primary`, `.peel-btn`, `.more-btn`, `.layer-btn`…), with no shared button.
- **110 different hex colours and 28 gradients** across the pages.

### Colours with no link to bananas
- **Purple and blue appear in 13 places with no banana reason:** the More Bananas tiles (purple brain, blue cube, grey dice), recipe-meal tiles (purple desserts, blue drinks, green lunch) and the clicker's purple rave.
- **Links are a generic UI blue** (#1f63c6 / light blue) on every page.
- **The site is locked to dark mode.** The light colour set exists in the CSS but is never used, and the price-ticker look (dark, red and green numbers) reads as a stock site.
- **Bananadle has its own cream "paper" style.** It's nicer, but now the site has two visual systems that don't match.

### Filler copy
- **Home description:** "Everything banana in one place…". **About page:** "everything banana-related from around the web in one place".
- **"Explore"** is the heading of the home page's games section, the one section that matters most.
- **More Bananas:** "Games, puzzles and experiments. This is our banana lab: new things land here first."
- **"Coming soon"** tile for "10,000 random twisters": a dead tile in the main games grid.
- **The Bananadle tile is inaccurate:** "Start on a random Wikipedia article" when it's a hand-picked daily page.

Good copy exists and should be the model: the clicker's "Keep going and see what happens. Gets loud and flashy.", "Illustrative photo, not made from this recipe", and the Bananadle golf scoring.

### Equal tiles, no priority
- **Home (desktop)** is four columns of equal weight: a news lead, "Banana business", "Latest" and a price panel. Then a 2×2 grid of four equal "Explore" tiles. The games, the only things that bring people back, get the same size as "Everything banana bread".
- **More Bananas** is three equal tiles plus a "coming soon" tile. Bananadle (the daily game) looks no more important than a solver for a puzzle almost nobody owns.

### Inconsistent between pages
- **Page titles are different on every page:**
  - Banacipes, Bananalytics and Banana World use a yellow first letter
  - More Bananas and Topics are plain white
  - the Cube has an emoji and a pill badge
  - Bananadle has a cream card with a rotated logo tile
  - the clicker has a breadcrumb and no title
- **Bananadle uses a cream, light layout; every other page is dark.**
- **The price ticker sits under the tabs on every page,** including the games, recipes, About and the 404 page.

---

## 2. What the home page is for

**The data:** in 24 hours, 135 visits landed on the home page and 3 reached Bananadle (2%).

**Why visitors don't get to the games:**
1. **The games aren't on the first screen, on any device.**
   - On a phone, the first screen shows the header, search, tabs, a price ticker, and then a news photo (`home-390-first-screen.jpg`). The Bananadle card is about **1,600px down**, below 15 news stories (`home-390-full.jpg`). Few people scroll that far.
   - On desktop the first screen is news and prices, and the games grid starts below the fold.
2. **The home page looks like a news portal, not a games site.** The first impression is "banana industry news". Anyone who came from Reddit for a game sees the wrong product and leaves.
3. **The tab name doesn't say "game".** "Bananadle" sits between "Home" and "Banana Clicker" with no hint that it's a daily puzzle, and the "-dle" suggests a word game. On a 390px phone only about four tabs fit before the bar scrolls sideways.
4. **Even after a click, there's another click.** Bananadle opens with a rules pop-up on *every* visit (`bananadle-390-first-screen.jpg`), so a curious visitor faces two clicks and a block of rules before seeing the puzzle.
5. **About a quarter of the phone screen is used up before any content:** header, search box, tabs and ticker take ~226px of 844 on every page.

**The single most important thing on the home page:** today's Bananadle, **playable right there**. The start page in big type, the input box, and "Par 4 · #6 · 3 people played today". No pop-up and no click needed.

Everything else (clicker leaderboard, recipe of the day, prices, news) should come after it, in that order.

---

## 3. Navigation and naming

Can a first-time visitor tell what each tab is without clicking?

| Tab | Clear? | Notes |
|---|---|---|
| Home | Yes, but redundant | The logo already goes home. On a phone it uses up one of the four visible tab slots. |
| **Bananadle** | **No** | It reads as a Wordle clone (a word game). Nothing says it's a daily Wikipedia puzzle. Needs a descriptor, e.g. "Bananadle · daily puzzle". |
| Banana Clicker | Yes | The clearest name on the site. Its address is still under `/more/` while it's a top-level tab. |
| Banacipes | Mostly | A fun pun, but "Recipes" is what people scan for. The search box says "recipes", the tab says "Banacipes". |
| **Bananalytics** | **Unclear** | People can guess "analytics", but not that it means *prices*. |
| **Banana World** | **Unclear** | Sounds like a game or theme park. It's a farming map, and it lives at `/bananalytics/world/`, so it's really part of Bananalytics. |
| **More Bananas** | **No** | Says nothing. It holds the Banana Cube and a "coming soon" tile, plus duplicates of Bananadle and the clicker. |

**Overlaps and dead ends:**
- **Bananalytics and Banana World** are both "banana data" and link to each other: two tabs for one idea.
- **The price ticker on every page** duplicates Bananalytics and costs ~80px on phones.
- **News and Topics** were removed from the tabs but still show up as footer links and on the home page. Topics has only one hub (Banana bread), so on its own it isn't worth a tab.
- **More Bananas** repeats two items that are already tabs. Without them it's just the Cube and a placeholder.

**Worth keeping as top-level:** Bananadle, Banana Clicker, Recipes, and one data tab (prices + map). The Cube, news and topics can be reached from the home page and the footer.

---

## 4. Reasons to come back

✅ = exists · ⚠️ = partly · ❌ = missing

| | Daily reset | Streak | Score | Share | Countdown to next | Leaderboard | Progress |
|---|---|---|---|---|---|---|---|
| **Bananadle** | ✅ new page each day | ✅ day streak, played, on par (this device only) | ✅ steps vs par 4, golf names | ✅ copies result text | ❌ | ⚠️ "Everyone today" chart of steps (no ranking) | ✅ played and on-par counts |
| **Banana Clicker** | ❌ | ❌ | ✅ your total, levels | ❌ | ❌ | ✅ countries, live | ⚠️ levels; but no "your country is #3, 120 behind Spain" |
| **Banana Cube** | ❌ no daily scramble | ❌ | ⚠️ moves to solved, but no score for you | ❌ | ❌ | ❌ | ❌ |
| **Banacipes** | ⚠️ recipe of the day (home page only) | ❌ | — | ❌ | ❌ | — | ⚠️ ingredient ticks remembered per recipe |
| **Bananalytics** | ⚠️ prices update monthly | — | — | ❌ | ❌ | — | — |
| **Banana World** | ❌ data changes yearly | — | — | ❌ | — | ⚠️ top producers list | — |
| **News** | ✅ every 10 minutes | — | — | ❌ | — | — | — |

**The biggest gaps:**
1. **No countdown or "come back tomorrow" on Bananadle.** The finished screen ends with Share and Practice, and never says when the next puzzle arrives.
2. **The clicker has no personal stake:** no rank or gap to the next country, no share, no daily goal. This is the feature that made popcat spread.
3. **Nothing is shared outside Bananadle,** so the clicker, cube and recipes never get passed around.
4. **Streaks live only in the browser,** which is fine for now. But there's no gentle reminder to come back (e.g. "add to home screen").

---

## 5. Mobile (390px)

**Space**
- **~226px of every page goes to the header** (logo, a full-width search box, tabs, ticker) before any content. That's 27% of an 844px screen.
- **The tab bar scrolls sideways** with no visual hint. Banacipes is cut off and Bananalytics, Banana World and More Bananas are hidden off-screen.
- **The ticker shows two of six prices,** with the rest cut off.

**Tap targets.** 9–48 tap targets per page are under 44px tall, and 6–33 are under 24px (the minimum in accessibility guidelines). The worst:
- footer links (About · Privacy · News · Recipes…) on every page
- ticker items and price chips in news stories ("BANANAS +2.73%")
- source numbers in the topic page (33 under 24px)
- recipe tags, and the photo credit links on recipe pages
- "Satellite view ↗" links and the year controls in Banana World

**Length**
- **Banacipes is 13,863px tall** at phone width (90 recipe cards, then more), with 720 bits of text under 12px.
- **The home page is 4,043px,** with the games at around 1,600px.

**Slow parts**
- **The home page loads 1.2 MB** (17 requests), mostly full-size news photos from publishers, shown at thumbnail size. News is 1 MB, and Banacipes is 850 KB to 1.1 MB.
- **Most pages are 60–400 KB,** which is fine.
- **Load times measured locally were 84–325 ms,** which isn't representative of real networks. Page weight is the better guide.

**Layout**
- **Banana World:** the map legend ("No data") overlaps the zoom buttons at phone width (`world-390-first-screen.jpg`).
- **No page scrolls sideways** at 390px (measured: 0px overflow everywhere).

**Motion**
- **Only the clicker respects reduced-motion.** These ignore it:
  - Bananadle's pop and shake animations
  - the home page's pulsing "live" dot
  - the Cube's animations
  - the page transitions
  - the Banana World running counter

---

## Top 10 changes, ranked by impact ÷ effort

| # | Change | Impact | Effort |
|---|---|---|---|
| 1 | **Make today's Bananadle playable at the top of the home page**: start page, input box, par and players today. No click, no pop-up. | Very high | Medium |
| 2 | **Show the Bananadle rules pop-up only on a first visit.** After that, a small "How to play" link. | High | Very low |
| 3 | **Add "Next puzzle in 6h 12m" and "come back tomorrow"** to the Bananadle result, next to the streak and the share button. | High | Low |
| 4 | **Slim the mobile header:** search becomes an icon, drop the "Home" tab, keep the price ticker on Bananalytics and the home page only. That wins back ~120px per page. | High | Low |
| 5 | **Rename and merge the tabs:** "Bananadle" with a "daily puzzle" descriptor, "Recipes", "Prices & Map" (Bananalytics plus Banana World). Fold More Bananas into the home page and footer, and drop the "coming soon" tile. | High | Low |
| 6 | **Clicker rivalry:** your country's rank, "120 behind Spain", a share button and a daily goal. | High | Medium |
| 7 | **Tap targets and small text:** at least 44px tap areas on phones, nothing under 12px, bigger footer links, ticker chips and tags. | Medium | Low |
| 8 | **Cut the filler copy:** replace "Explore", "Everything banana in one place" and "our banana lab" with short, specific and funny lines. Fix the inaccurate Bananadle description. | Medium | Very low |
| 9 | **Lighter home page:** load news photos at thumbnail size and only when scrolled to (1.2 MB → roughly 400 KB). Respect reduced-motion everywhere. | Medium | Medium |
| 10 | **A real visual identity** (Stage 2) to replace Inter-only type, emoji tiles, purple and blue gradients, 20 corner sizes and 12 button styles with one banana-rooted system, in light and dark. | Very high | High |

Items 1–5 together tackle the "135 visits, 3 games" problem directly, and none of them needs the new design to land first. Item 10 is the Stage 2 work, and items 1, 3 and 6 fit naturally into it.

---

## After the redesign (Stage 2)

The same measurements, on the same pages, after the crate-label redesign. Screenshots of every page at both widths and in both themes are in [`audit/after/`](audit/after).

| | Before | After |
|---|---|---|
| Typefaces | Inter only | Alfa Slab One (headings, prices, scores) + IBM Plex Sans |
| Themes | dark only | light by default, dark from the system setting or the toggle |
| Header on a phone | ~226px (logo, search box, scrolling tabs, ticker) | ~100px (logo, icons, four tabs that fit); ticker only on home and Prices |
| Where Bananadle is on the home page (phone) | ~1,600px down | at the top, playable: the input is on the first screen |
| Bananadle rules | pop-up on every visit | inline "How to play", open on the first visit only |
| Home page weight | 1.2–1.4 MB | 242 KB |
| Recipes page length (phone) | 13,863px | 5,750px |
| Text under 12px, recipes page (phone) | 720 | 24 |
| Text under 12px, Prices (desktop) | 73 | 3 |
| Tap targets under 24px, news (desktop) | 47 | 0 |
| Emoji used as icons, gradient tiles, "coming soon" tiles | yes | gone (emoji stay in shared results, where they're content) |

**What each game's loop has now**

| | Daily reset | Streak | Score | Share | Countdown | Leaderboard |
|---|---|---|---|---|---|---|
| Bananadle | ✅ | ✅ | ✅ stamped golf score, ripeness bar | ✅ | ✅ "Next crate in 6h 12m" | ✅ everyone today |
| Banana Clicker | ✅ daily crate of 100 | ❌ | ✅ | ✅ "Rally your country" | ✅ resets at midnight | ✅ with "X behind Y" |

**Still open**
- The Banana Cube keeps its own dark 3D workbench. Its solution tree and key hints still use small text (58 elements under 12px). It's the least-used page, so it was left for later.
- On recipe and topic pages, the remaining small tap targets are inline links inside sentences (citations, photo credits), which the tap-size guidelines exempt, plus checkboxes inside full-height labels.
- The Banana Clicker has no multi-day streak yet.
