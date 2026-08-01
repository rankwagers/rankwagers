# RankWagers — Visual Removal Audit

> **Type:** Creative-direction audit. **Visual design only.** No engineering, no architecture, no
> redesign. The mission is subtraction: remove what is amateur, keep what is timeless, consolidate
> what is duplicated.
> **Date:** 2026-08-01. **Companion to:** `[[design-review]]` (which audited the *system*). This
> audits the *surface* — decoration, ornament, and the things that betray the product.
> **Benchmarks:** Stripe · Linear · Bloomberg · Financial Times · The Athletic.

---

## The diagnosis

**Two products are wearing one skin.**

Underneath, there is a warm-paper editorial product: canvas `#f6f3ec`, a serif display face, forest
green, tabular numerals, semantic status color. That is the Financial Times' salmon and The Athletic's
long-form typography. It is a legitimate, timeless, expensive-feeling foundation, and it was
deliberately designed.

On top of it sits an affiliate coupon site: gradient CTAs that pulse and sweep on infinite loops, star
ratings built from `★` text characters, a ticker bar with a shine animation, neon emerald glows, gold
badges, and 38 emoji used as icons.

The second product is destroying the first. Nothing needs to be designed. **Things need to be
deleted.**

---

## What each benchmark would notice in the first ten seconds

**Stripe** — "You have four letter-spacing values for one label style and nine greens. Restraint is
the product." Stripe's authority comes from *one* accent used sparingly against enormous calm. Here
the accent is used decoratively (glows, gradients, pulses) in exactly the places Stripe would leave
empty.

**Linear** — "Where is the component library?" Linear's signature is that every button, row and chip
is visibly from the same hand. 189 hand-rolled button strings and 12 radius values is the precise
opposite. Linear also uses almost no shadow — borders carry structure. Here there are ten shadow
treatments including four *glows*.

**Bloomberg** — "Your density is accidental, not authored." Bloomberg earns density with monospace
numerics, rigid column alignment, and severe color coding used only for state. RankWagers has the
tabular-nums instinct (`font-mono tabular-nums`) but spends its color on ornament instead of meaning.

**Financial Times** — "You already have our best idea and you're apologising for it." The warm
off-white canvas plus serif display is genuinely FT-class. FT would delete every gradient on the page
and let the paper do the work. FT's authority is that nothing glows.

**The Athletic** — "Where is the human?" The Athletic's premium feel is bylines, generous measure, and
photography. Here there is no author, no portrait, no measure discipline — and the reading size is
`text-sm` (750 uses) against `text-base` (40 uses).

**The uncomfortable synthesis:** the foundation is FT/Athletic. The surface is a 2013 casino affiliate.
Every item on the kill list below belongs to the second product.

---

## THE KILL LIST

Ranked by damage. Each is a deletion, not a redesign.

### 1. `.btn-play-now` — the slot-machine button

`globals.css:366-391` stacks **five decorations on a single control**:

| Layer | Value |
|---|---|
| gradient | `linear-gradient(105deg, #1a8566, #0e6b4f, #174c3c)` — 3 stops, diagonal |
| animation | `play-now-pulse 2.4s ease-in-out infinite` on a 200%-wide background |
| sweep | `.btn-play-now-shine` — white 40% diagonal, `play-now-sweep 2.8s infinite` |
| glow | `box-shadow: 0 0 12px rgba(14,107,79,0.25)` |
| hover | lift `-translate-y-0.5` **and the sweep accelerates to 1.6s** |

A button that pulses, sweeps, glows, and speeds up when you approach it is a slot machine. It is also
the only element on the site introducing `#1a8566` — a sixth green that exists solely to make the
gradient.

**Remove:** the gradient, the pulse, the sweep, the glow, the hover acceleration.
**Keep:** a solid `--green-primary` fill, the rounded-full geometry, the `-translate-y-0.5` lift.
A confident product's primary CTA does not move until you touch it.

### 2. `StarRating` — text characters pretending to be a component

`components/StarRating.tsx` renders `★★★★★` as **text**, overlaid by a second `★★★★★` clipped to a
percentage width.

- Text dingbats render differently on every platform, do not inherit stroke weight, and cannot be
  optically aligned to the baseline.
- The percentage clip cuts a star **mid-glyph**, so a 4.9 produces a ragged partial shape determined
  by whatever the user's font does with U+2605.
- It uses `text-slate-700` (cold grey, wrong temperature) and `text-slate-200` for the numeral —
  which on the cream canvas measures **≈1.2 : 1**. **The rating number is invisible.**

**Remove:** the star row entirely. **Keep:** the numeral — set in the display face with
`tabular-nums`, at readable contrast. Bloomberg does not draw stars. A number is more credible than
five glyphs, and it is the honest presentation of a number.

### 3. All 38 emoji and dingbats used as icons

Measured across components: **✓ ×14, ★ ×12, ✕ ×5, ✅ ×2, ⚠ ×2, 🏆, ⚡, ✈**.

Two failures at once: emoji are not an icon system (no stroke weight, no optical sizing, no baseline
alignment, platform-dependent rendering — ✅ is full-colour on Apple and monochrome elsewhere), and
**✓ and ✅ are used for the same meaning**, which is a straight inconsistency.

`🏆` and `⚡` are the tells. No premium product ships a trophy emoji.

**Remove:** every one. **Keep:** `lucide-react` — which is already a dependency, already
tree-shaken in config, and currently used in **3 files with 4 icons** (`Info`, `MapPin`,
`ShieldCheck`, `Target`). The icon system already exists and is 95% unused.

### 4. `WorldCupTickerBar` — the shine sweep and the glowing badge

`.wc-ticker-shine` is an animated gradient sweep; `.wc-ticker-badge` is a `145deg` gradient with
`box-shadow: 0 0 20px -8px` — a glow. Combined with `border-emerald-500/40 bg-emerald-500/[0.1]` and
an `inset 0 0 0 1px rgba(16,185,129,0.15)` ring.

A scrolling ticker with a light sweep is 2012 sports-portal furniture, and the emerald is not the
brand green.

**Remove:** the shine, the badge gradient, the glow ring, the emerald.
**Keep:** the ticker's information. Bloomberg has the most famous ticker in the world and it does not
shimmer.

### 5. The live-feed neon treatment

`components/predictions/LiveFeedParts.tsx:75` —

```
border-2 border-emerald-400/55
bg-gradient-to-br from-emerald-950/90 via-ink-card to-emerald-800/25
shadow-[0_0_28px_rgba(16,185,129,0.22)]
```

plus a `radial-gradient` overlay at `:84` and a second glow at `:187`.

A 2px neon border, a three-stop gradient that passes **through cream** between two near-black greens,
and a 28px emission glow. This is streamer-overlay aesthetics. It is also the single loudest surface
on the site, on the page most likely to be screenshotted.

**Remove:** the 2px neon border, both gradients, the radial overlay, all three glows.
**Keep:** state communicated by the existing `--status-live-fg/bg` tokens, which already exist and are
correct.

### 6. Gradient text

`bg-clip-text` + `text-transparent` on the hero title. Gradient headline text is the most dated
web-design trope of the last decade, and none of the five benchmarks uses it anywhere.

**Remove.** **Keep:** the serif display face at full ink. The typeface is the idea; the gradient hides it.

### 7. Every glow shadow

Measured: `shadow-glow` ×3, plus `shadow-[0_0_16px_rgba(16,185,129,0.12)]`,
`shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]`, `0 0 12px` on the CTA, `0 0 20px -8px` on the ticker
badge.

**Glow is emission; elevation is offset.** Expensive software casts shadows downward because objects
sit above a surface. Light-emitting UI belongs to gaming and crypto. `--shadow-card` and
`--shadow-elevated` are already correctly authored with negative spread and downward offset — the
glows are the exception, and they are the tell.

**Remove:** every `0 0 Npx` shadow. **Keep:** the two elevation tokens. Note that `--shadow-focus`
(`0 0 0 3px`) is a *ring*, not a glow — that one stays.

### 8. `badge-gold`

Gold badges on a cream-and-green palette signal "featured operator". Combined with the star rating and
sticky CTA, it completes the coupon grammar.

**Remove.** **Keep:** the amber token for *state* (`--status-void`, `--risk-aggressive`) where it
carries meaning rather than promotion.

### 9. `bg-mesh` — the two-radial page wash

`tailwind.config.ts` defines a background of two radial gradients (green and amber) over the canvas.
On a warm paper canvas this reads as a slightly dirty screen. FT's salmon is flat. The Athletic's
white is flat. Paper does not have a light source.

**Remove.** **Keep:** the flat `--canvas-primary`.

---

## THE KEEP LIST — what is already timeless

Protect these. They are the reason the product can become expensive rather than merely clean.

1. **The warm canvas `#f6f3ec`.** This is the single best decision in the product. It is FT's
   territory, it is instantly distinguishing in a category of black-and-neon, and it cannot be copied
   without looking like an imitation of you.
2. **The serif display face against system sans.** Editorial authority in one decision.
3. **`font-mono tabular-nums` for figures.** The Bloomberg instinct, already present.
4. **The semantic color system** — `--status-*`, `--risk-*`, `--confidence-*`. Color that means
   something instead of color that decorates. This is the most sophisticated thing in the codebase.
5. **The elevation tokens** — `--shadow-card` / `--shadow-elevated`, correct negative-spread, downward.
6. **The 11px uppercase micro-label.** Used 197 times, it is the closest thing to a signature the
   product has. It is genuinely FT-ish. It needs one letter-spacing value, not eight.
7. **`prefers-reduced-motion` with a global kill-switch**, and the `:focus-visible` treatment.
   Invisible, expensive, correct.
8. **`--touch-min: 2.75rem`.** 44px targets, respected.
9. **Honest empty states** — the odds chart's written empty message rather than a blank frame.
10. **The 4px spacing rhythm** and the `max-w-[1440px]` container. Sound, when obeyed.

---

## CONSOLIDATE — improvement without redesign

Every row is a subtraction. No new component is proposed.

| Element | Today | Should be | Evidence |
|---|---|---|---|
| **Greens** | **9** — `#0E6B4F`, `#174C3C`, `#15966A`, `#1A8566`, `#0F766E`, + the entire Tailwind `emerald-400/500/800/900/950` ramp | **3** — primary, deep, positive | measured across css + tsx |
| **Letter-spacing** | **8** — `tracking-wide` (154), `[0.14em]` (35), `[0.12em]` (29), `[0.16em]` (24), `wider` (14), `widest` (12), `[0.1em]` (6), `tight` (20) | **2** — one for micro-labels, one for display | measured |
| **Shadows** | **10** treatments incl. 4 glows | **3** — card, elevated, focus ring | measured |
| **Radii** | **12** values; same token in two syntaxes | **4** — the `--radius-*` set, one syntax | prior review |
| **Type sizes** | **15**, incl. `text-[7px]`, `[8px]`, `[9px]` | **7** — the `--text-*` scale that already exists | prior review |
| **Icon sources** | **3** — lucide (3 files), inline SVG (6 files), emoji (38) | **1** — lucide | measured |
| **Uppercase** | **309** occurrences | keep the micro-label; remove from buttons, headings and body | measured |
| **Gradients** | **8** CSS definitions + **16** utility uses | **0** | measured |
| **Color sources** | **3** — `globals.css`, `bible.ts`, `design/` project | **1** — `globals.css` | prior review |

---

## Category notes (only where this audit adds to the prior review)

**Borders & dividers.** Three border tokens exist (`--border-subtle`, `--border-default`,
`--border-strong`) and are a genuinely good three-step ramp — but components reach for
`border-white/10` (invisible on cream, 62 files) and `border-2 border-emerald-400/55` instead. Linear
proves borders alone can carry an entire interface; this product has the ramp and doesn't use it.
**A 2px border is almost always a mistake.** Hairlines read as expensive; 2px reads as a warning.

**Contrast.** Covered in the prior review, but the removal lens sharpens it: every contrast failure
found traces to a *cold* class (`text-slate-*`, `border-white/`, `bg-white/[`) applied to a *warm*
canvas. The palette collision and the accessibility failure are the same defect.

**Icons.** Beyond the emoji: four lucide icons across three files is not an icon language. Nothing
establishes stroke weight, corner radius, or optical size. This is the largest *unbuilt* visual system
— and unlike everything else on this list, it is a gap rather than an excess.

**Footer.** 17 links, two columns, one weight. "Acca Builder" and "Privacy" are typographically
identical. FT and The Athletic both use a clear label/link hierarchy in the footer; the ingredients
here (the micro-label style) already exist and simply aren't applied.

**Loading & animation.** Six animation instances across 201 components — yet three of them are
infinite decorative loops (`play-now-pulse`, `play-now-sweep`, `wc-ticker-shine`). **The product
animates its advertising and nothing else.** Meanwhile 31 of 34 routes have no loading state. That
ratio is the whole critique in one number: motion is spent on persuasion, not on feedback.

**Dark mode.** Do not build it to fix the 62 dark-authored files. Those files are wrong on a light
canvas today and would still be wrong tomorrow, because they were authored against Tailwind's cold
slate ramp rather than against these tokens. Correct them to the warm palette first. Dark mode, if it
ever ships, should be a deliberate second theme of the *same* system — not an amnesty for the drift.

---

## The test

Screenshot any page. Remove the logo. Show it to someone who does not know the category.

Today, three things answer "gambling site" before any word is read: **the pulsing gradient CTA, the
star rating, and the emerald glow.** All three are on the kill list. None of them is load-bearing.
Nothing about the layout, the grid, or the information design has to change to remove them.

What remains — warm paper, a serif headline, green used only for meaning, tabular figures, hairline
rules, and no light sources — reads as a research terminal.

**That product already exists underneath. It is being hidden by roughly forty lines of CSS.**

---

_Visual design only. No architecture, layout, or component structure proposed. Companion to
`[[design-review]]`._
