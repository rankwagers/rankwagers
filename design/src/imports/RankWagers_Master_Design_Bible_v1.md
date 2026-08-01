
# RankWagers Master Design Bible

Version: 1.0  
Status: Single Source of Truth  
Primary use: Figma Make, product design, frontend implementation, QA review

---

# 1. Purpose

This document governs the visual, structural, verbal, and interaction language of RankWagers.

RankWagers is a football intelligence platform that screens fixtures against statistical thresholds, explains why a fixture qualifies, exposes supporting and contradicting evidence, and presents operator comparison only after research.

This document is not inspiration.

It is the permanent design standard.

Every future screen, component, layout, asset, interaction, chart, label, animation, and content decision must comply with it.

When a screen conflicts with this document, the screen is wrong.

---

# 2. Product Definition

RankWagers is:

- A football intelligence platform
- A fixture qualification system
- A research workspace
- An evidence inspection tool
- A transparent decision-support product
- A statistical analysis interface
- A neutral operator comparison layer

RankWagers is not:

- A sportsbook
- A casino
- A tipster product
- A prediction-selling service
- A gambling community
- A Telegram betting channel
- A trading terminal
- A developer console
- A generic SaaS dashboard

The product must never look, sound, or behave like any of those categories.

---

# 3. Positioning

RankWagers should feel like:

- The editorial restraint of the Financial Times
- The product clarity of Apple
- The structural precision of Linear
- The research seriousness of The Athletic
- The analytical utility of TradingView
- The trustworthy comparison discipline of Stripe

It must not imitate any one of these products directly.

The intended positioning is:

> The research desk for football intelligence.

The user should think:

- “I understand why this fixture appeared.”
- “I can inspect the evidence.”
- “The product is not hiding uncertainty.”
- “This feels credible.”
- “This is a real analytical product.”

The user should never think:

- “This is a betting landing page.”
- “This is trying to sell me a result.”
- “This is a casino interface.”
- “This looks like a terminal that requires training.”
- “This is another generic AI dashboard.”

---

# 4. Brand Principles

## 4.1 Evidence Before Persuasion

Evidence always appears before any commercial element.

Every claim must be supported by observable facts.

Never ask the user to trust the system without showing the reasoning.

## 4.2 Confidence Is Not Certainty

Confidence expresses agreement across evidence groups.

It is not a promise.

It is not a guaranteed outcome.

It is not a win probability unless explicitly labeled as model probability.

## 4.3 Uncertainty Is Visible

Counter-evidence is mandatory.

The system must show what weakens, contradicts, or limits the qualification.

## 4.4 Research Before Conversion

Operator comparison appears after:

1. Fixture context
2. Qualified market
3. Confidence
4. Supporting evidence
5. Counter-evidence
6. Methodology

Never place operator content above evidence.

## 4.5 Calm Intelligence

The product should feel precise and approachable.

Never cold.

Never aggressive.

Never futuristic.

Never promotional.

## 4.6 Restraint Creates Premium Quality

Premium does not come from:

- Gold
- Glassmorphism
- Neon
- Heavy gradients
- Excessive shadows
- Oversized logos
- Cinematic effects

Premium comes from:

- Typography
- Spacing
- Clear hierarchy
- High-quality data presentation
- Consistency
- Controlled color
- Strong editorial judgment

---

# 5. Design Constitution

The following laws override all lower-level component decisions.

## Law 01 — Evidence Leads

The strongest visual emphasis must be placed on the evidence, not the CTA, operator, logo, or confidence badge.

## Law 02 — Every Number Is Explainable

Every score, percentage, threshold, probability, and model output must provide a route to explanation.

## Law 03 — Counter-Evidence Is Not Hidden

Counter-evidence must be visible without requiring deep navigation.

## Law 04 — Light Mode Defines the Brand

The primary RankWagers experience uses a warm ivory light theme.

Dark mode may exist later, but it must not define the brand.

Never use pure black as the default canvas.

Never make the product resemble:

- Bloomberg Terminal
- Reuters Eikon
- VS Code
- Trading dashboards
- Security consoles

## Law 05 — Typography Carries Hierarchy

Use typography, spacing, and grouping before relying on color, cards, or shadows.

## Law 06 — Containers Must Justify Their Existence

Do not create cards because cards are common.

A container must group meaningful information.

## Law 07 — Color Has Semantic Meaning

Color is never decorative.

Green, amber, red, and neutral tones must correspond to explicit product states.

## Law 08 — Whitespace Is Functional

Whitespace must improve scanning, comprehension, and grouping.

Do not add empty space only to appear premium.

Do not remove necessary space to increase density.

## Law 09 — Marketing Never Interrupts Research

No banners, popups, promotions, countdowns, urgency, or commercial badges may interrupt analysis.

## Law 10 — Accessibility Is Not Optional

All information must remain understandable without relying on color alone.

Focus states, keyboard navigation, readable contrast, and semantic structure are mandatory.

---

# 6. Emotional Direction

The product should communicate:

- Trust
- Clarity
- Calm
- Precision
- Transparency
- Editorial judgment
- Analytical depth

The product should not communicate:

- Excitement
- Urgency
- Fear of missing out
- Risk-taking
- Celebration
- Winning
- Luxury
- Exclusivity
- Complexity for its own sake

Preferred emotional response:

> “This is serious, clear, and useful.”

Not:

> “This is exciting.”

Not:

> “This looks expensive.”

Not:

> “This looks technical.”

---

# 7. Visual Grammar

## 7.1 Canvas

Primary canvas:

- Warm ivory
- Soft paper-like tone
- Slightly warmer than pure white

Recommended token:

`--canvas-primary: #F6F3EC`

Secondary canvas:

`--canvas-secondary: #FBF9F4`

Never use pure white for large backgrounds.

Never use pure black.

## 7.2 Primary Ink

Primary text:

`--ink-primary: #13251F`

Secondary text:

`--ink-secondary: #53615C`

Muted metadata:

`--ink-muted: #7D8782`

## 7.3 Brand Green

Primary green:

`--green-primary: #0E6B4F`

Deep green:

`--green-deep: #174C3C`

Soft green surface:

`--green-surface: #EAF3ED`

Positive indicator:

`--green-positive: #15966A`

Do not use neon green.

Do not use casino green.

## 7.4 Amber

Muted amber:

`--amber-primary: #A96E12`

Amber surface:

`--amber-surface: #FBF2DF`

Use amber for:

- Counter-evidence
- Watch states
- Caution
- Data limitations
- Market disagreement

## 7.5 Red

Red is reserved for genuine contradiction, unavailable data, or severe conflict.

Recommended:

`--red-primary: #B5473E`

Use sparingly.

Do not use red for normal counter-evidence.

## 7.6 Borders

Default border:

`--border-default: #D8D5CC`

Subtle border:

`--border-subtle: #E5E1D8`

Strong border:

`--border-strong: #BFC4BE`

Use 1px borders.

Avoid double borders.

Avoid heavy separators.

## 7.7 Shadows

Default: none.

Use subtle elevation only for:

- Dropdowns
- Tooltips
- Temporary overlays
- Floating feedback controls

Never use shadows for primary hierarchy.

## 7.8 Radius

Base container radius: 8px

Controls: 6px

Pills: only for compact semantic markers and filters

Avoid excessive rounding.

Avoid soft playful cards.

## 7.9 Density

RankWagers is information-rich but not visually dense.

Preferred balance:

- More data than Apple
- Less density than Bloomberg
- More restraint than TradingView
- More structure than Notion

---

# 8. Typography

## 8.1 Typography Roles

Use three typography families:

### Editorial Display

Use for:

- Page titles
- Major section titles
- Editorial statements
- Fixture headline

Recommended categories:

- Canela
- Noe Display
- Saol Display
- Editorial New

### Interface Sans

Use for:

- Navigation
- Body copy
- Filters
- Buttons
- Helper text
- Tables

Recommended:

- Geist
- Inter Variable
- Suisse International
- SF Pro Text

### Monospace

Use sparingly for:

- Model versions
- Timestamps
- Technical metadata
- Token names
- Compact provenance labels
- Data refresh information

Do not use monospace as the dominant body style.

## 8.2 Type Scale

Recommended desktop scale:

- Display XL: 56 / 60
- Display L: 44 / 50
- Heading 1: 36 / 42
- Heading 2: 28 / 34
- Heading 3: 22 / 28
- Body L: 18 / 28
- Body M: 16 / 24
- Body S: 14 / 20
- Caption: 12 / 16
- Metadata: 11 / 14

## 8.3 Numeric Typography

Use tabular numerals for:

- Confidence
- Probabilities
- Odds
- Edge
- xG
- Percentages
- Scores
- Time
- Samples

Numbers should be visually stronger than their labels.

## 8.4 Tracking

Use modest positive tracking for:

- Uppercase metadata
- Section labels
- League labels
- Model labels

Do not over-space headings.

## 8.5 Typography Rules

Do:

- Use sentence case for most UI copy
- Use uppercase only for compact metadata
- Let editorial headings carry character
- Use strong contrast for key numbers

Do not:

- Use oversized hero text on product screens
- Use all caps for body copy
- Use monospace everywhere
- Use multiple display fonts
- Use decorative type for data

---

# 9. Layout and Grid

## 9.1 Base Unit

Base spacing unit: 4px

Primary rhythm:

- 8
- 12
- 16
- 24
- 32
- 40
- 48
- 64
- 80

## 9.2 Desktop Grid

- 12 columns
- 24px gutters
- 64px outer margin
- Max content width: 1440px
- Reading column: 680–760px
- Analysis layout: 8 + 4 columns
- Research workspace: 3 + 6 + 3 columns where necessary

## 9.3 Tablet

- 8 columns
- 24px side margin
- Preserve information order
- Sidebars become stacked modules

## 9.4 Mobile

- 4 columns
- 16px side margin
- Single-column reading flow
- Evidence remains above operators
- No horizontal data clipping
- Accordions may be used for secondary evidence

## 9.5 Alignment

Align:

- Numeric columns
- Evidence labels
- Threshold markers
- Timestamps
- Operator odds

Do not center-align analytical content.

Center alignment is reserved for:

- Empty states
- Small score summaries
- Minimal loading states

---

# 10. Information Architecture

Every match analysis follows this order:

1. Fixture identity
2. Competition and kickoff
3. Qualified market
4. Qualification status
5. Confidence
6. Supporting evidence
7. Counter-evidence
8. Methodology
9. Operator comparison
10. Related fixtures
11. Disclosures

Never reverse this hierarchy.

## 10.1 Fixture Identity

Always show:

- League
- Home team
- Away team
- Kickoff
- Venue
- Data freshness
- Model update

## 10.2 Qualification

Show:

- Qualified market
- Qualification status
- Confidence tier
- Supporting signal count
- Counter-evidence count
- Sample quality

## 10.3 Evidence

Group evidence by hypothesis:

- Team process
- Attack
- Defence
- Home/away split
- Historical matchup
- Sample quality
- Statistical threshold
- Market context

Never show an unstructured list if grouping is possible.

## 10.4 Progressive Disclosure

Show core evidence first.

Allow users to expand:

- Detailed metrics
- Historical breakdown
- Source notes
- Calculation details
- Methodology

Do not hide counter-evidence.

## 10.5 Operators

Operator comparison appears after methodology.

Operator data includes:

- Operator
- Odds
- Implied probability
- Model edge
- Updated timestamp
- Availability
- Licensing status where applicable

No large promotional banners.

No deposit messages.

No urgency.

---

# 11. Research Language

## 11.1 Tone

RankWagers speaks like an analyst.

Use:

- Precise language
- Measured claims
- Observable facts
- Neutral descriptions
- Explicit limitations

Avoid:

- Excitement
- Promotional language
- Guarantees
- Emotional claims
- Urgency
- Speculation presented as fact

## 11.2 Approved Terms

Preferred:

- Qualified fixture
- Qualified market
- Supporting evidence
- Counter-evidence
- Confidence score
- Evidence agreement
- Statistical threshold
- Sample quality
- Data coverage
- Model update
- Market context
- Statistical edge
- Research note
- Methodology
- Related signal
- Qualification marker

Avoid:

- Best bet
- Safe bet
- Lock
- Guaranteed
- Banker
- Winning tip
- Hot pick
- Sure win
- Free money
- Strong bet

## 11.3 Confidence Language

Use:

- Confidence score
- Evidence agreement
- Agreement level
- Supporting signal count

Never use:

- Chance to win
- Guaranteed outcome
- Certainty
- Safe outcome

## 11.4 Example Copy

Good:

> Arsenal scored in 9 of their last 10 home league matches.

Good:

> Combined xG exceeds the qualification threshold by 0.41.

Good:

> Market movement has reduced the statistical edge since the previous model update.

Bad:

> Arsenal will definitely score.

Bad:

> This is a safe pick.

Bad:

> Do not miss this opportunity.

---

# 12. Confidence System

## 12.1 Definition

Confidence measures agreement across independent evidence groups.

Confidence is not:

- A promise
- A guarantee
- A binary recommendation
- A standalone decision

## 12.2 Tiers

High:

- Score: 72–100
- Label: High agreement
- Meaning: Multiple independent evidence groups align

Moderate:

- Score: 45–71
- Label: Moderate agreement
- Meaning: Evidence supports the signal but limitations remain

Watch:

- Score: 0–44
- Label: Watch
- Meaning: Evidence is incomplete, mixed, or contradictory

## 12.3 Required Context

Every confidence display must include:

- Numeric score
- Tier
- Supporting signal count
- Counter-evidence count
- Sample quality
- Last updated time
- Link to explanation

## 12.4 Visual Rules

Confidence may use:

- Circular ring
- Horizontal meter
- Compact numerical summary

The score must not appear more visually dominant than the evidence.

Avoid:

- Animated score counters
- Bright gradients
- Neon rings
- Celebration
- Fire icons
- Starbursts

---

# 13. Evidence Model

## 13.1 Evidence Unit

Every evidence unit contains:

1. Observation
2. Metric
3. Time window
4. Comparison context
5. Source or provenance
6. Optional limitation

Example:

Observation: Home scoring consistency  
Metric: 9/10  
Time window: Last 10 home league matches  
Comparison: +14pp above league median  
Source: FootyStats  
Limitation: Two promoted opponents included

## 13.2 Evidence Groups

Recommended groups:

- Team Form
- Attack Quality
- Defensive Profile
- Home/Away Context
- Historical Matchup
- Statistical Thresholds
- Sample Quality
- Market Context
- Squad Availability

## 13.3 Counter-Evidence

Counter-evidence uses muted amber.

It should describe:

- Contradicting form
- Small sample
- Injuries
- Rotation risk
- Weather
- Tactical mismatch
- Market movement
- Data freshness issues

Counter-evidence is not an error state.

## 13.4 Comparison Context

Whenever possible, show:

- League average
- Threshold
- Previous period
- Home/away split
- Model baseline
- Market implied probability

Raw numbers without context are incomplete.

---

# 14. Match Surface

The primary match surface is the central research object.

It is not a promotional card.

## 14.1 Required Content

- League
- Fixture
- Kickoff
- Venue
- Qualified market
- Confidence
- Signal count
- Evidence summary
- Counter-evidence indicator
- Expand action

## 14.2 Collapsed State

Show:

- Teams
- League
- Kickoff
- Market
- Confidence
- Tier
- Signal count
- Counter-evidence count

## 14.3 Expanded State

Show:

- Evidence groups
- Supporting metrics
- Comparison bars
- Sample quality
- Counter-evidence
- Methodology
- Related markets
- Operators after research

## 14.4 Asset Use

Use realistic football assets.

Preferred:

- Realistic mock club crests
- Realistic mock league identity
- Stadium imagery when contextually useful
- Team colors used in tiny controlled accents
- Player silhouette or licensed photography where available

Do not use:

- Initials in generic circles as final assets
- Lorem ipsum
- Team A / Team B
- Generic placeholder shields
- Cartoon football icons
- Casino imagery

---

# 15. Asset Policy

## 15.1 Team Crests

Use high-quality mock crests that feel production-ready.

They must:

- Be clearly distinct
- Reflect club-like visual identity
- Use restrained colors
- Work at 24px, 32px, and 48px
- Avoid copying copyrighted marks exactly unless licensed assets are available

## 15.2 League Identity

Use realistic neutral mock league marks.

Avoid fake oversized sponsor logos.

## 15.3 Stadium Photography

Use only when it adds context.

Photography should be:

- Documentary
- Natural
- Unstaged
- Desaturated or softly treated
- Secondary to data

Do not use celebration imagery.

Do not use cheering fans as conversion decoration.

## 15.4 Player Assets

Use:

- Neutral portraits
- Tactical silhouettes
- Training imagery
- Matchday editorial photography

Avoid:

- Victory celebrations
- Betting-like hero shots
- Exaggerated gestures
- Promotional poses

## 15.5 Icons

Use simple outline icons.

Recommended size:

- 16px for metadata
- 20px for controls
- 24px for module anchors

Avoid colorful icon sets.

## 15.6 Flags

Use flags only for:

- Country context
- League filtering
- International competition

Do not use flags decoratively.

---

# 16. Charts and Data Visualization

## 16.1 Purpose

Charts answer questions.

Every chart must explain:

- What changed?
- How strong is the difference?
- How does the value compare to a baseline?
- How reliable is the sample?

## 16.2 Preferred Chart Types

- Comparison bars
- Probability bars
- Trend lines
- Small multiples
- Distribution grids
- Threshold markers
- Form sequences
- Compact radar only when groups are meaningfully comparable

## 16.3 Avoid

- Decorative donuts
- 3D charts
- Pie charts with many slices
- Unlabeled sparklines
- Rainbow palettes
- Animated charts without purpose
- Dense terminal-like plots

## 16.4 Chart Context

Every chart should show at least one of:

- League average
- Threshold
- Previous period
- Market implied probability
- Confidence band
- Sample size

## 16.5 Color

Use brand green for supporting evidence.

Use amber for counter-evidence.

Use neutral grey for baseline.

Use red only for strong contradiction.

---

# 17. Operator Comparison

Operator comparison is a neutral research record.

It is not an advertisement.

## 17.1 Required Fields

- Operator name
- Licensing or status marker
- Odds
- Implied probability
- Statistical edge
- Last updated
- Availability
- Neutral action

## 17.2 CTA Language

Preferred:

- View operator record
- Compare terms
- Open operator
- Review availability

Avoid:

- Bet now
- Claim bonus
- Get started
- Hurry
- Exclusive
- Best offer

## 17.3 Hierarchy

Operator content must never visually dominate evidence.

Use restrained borders.

Avoid large logos.

Avoid bright brand colors.

Avoid promotional cards.

---

# 18. Navigation

## 18.1 Primary Navigation

Recommended:

- Today
- Qualified Fixtures
- Live Signals
- Methodology
- Operators
- Research Notes
- Saved

## 18.2 Naming

Use product language.

Avoid generic dashboard labels where more precise research language exists.

## 18.3 Sidebars

Sidebars may contain:

- Related fixtures
- Watchlist
- Similar signals
- Saved analyses
- Data freshness
- Model status

Sidebars must not duplicate primary evidence.

## 18.4 Search

Search supports:

- Team
- League
- Market
- Date
- Qualification status

Use direct, concise placeholder text.

Example:

> Search team, league, or market

---

# 19. Forms and Controls

## 19.1 Buttons

Primary buttons are rare.

Use primary buttons for:

- Inspect reasoning
- View methodology
- Open operator record
- Apply filters

Secondary buttons:

- Save
- Compare
- Expand
- Reset

Avoid oversized CTA buttons.

## 19.2 Filters

Use filters for:

- League
- Market
- Confidence tier
- Time range
- Data freshness
- Qualification status

Filters should remain compact.

## 19.3 Inputs

Use clear labels.

Do not rely only on placeholders.

Show helper text where the meaning is technical.

## 19.4 Focus

All interactive controls require visible focus states.

---

# 20. Feedback States

## 20.1 Loading

Use skeletons that preserve layout.

Do not use large spinners unless necessary.

## 20.2 Empty States

Good:

> No fixture currently satisfies today’s qualification thresholds.

Good:

> No similar active signal is available at this confidence tier.

Bad:

> No winning bets today.

## 20.3 Error States

Explain:

- What happened
- What remains available
- How to recover

## 20.4 Toasts

Toasts are compact and factual.

Examples:

- Saved to research notes.
- Filters updated.
- Operator data refreshed.
- Model output unavailable.

---

# 21. Motion

Motion explains cause and effect.

Use:

- 150ms for quick controls
- 200ms for standard transitions
- 320ms for spatial reveals

Preferred easing:

- Ease-out for entry
- Ease-in for exit
- Standard ease for control state changes

Use motion for:

- Accordion expansion
- Filter updates
- Detail reveal
- Saved-state confirmation

Avoid:

- Bounce
- Elastic motion
- Animated score counters
- Celebration
- Looping decorative animation
- Parallax
- Background motion

Respect reduced-motion preferences.

---

# 22. Accessibility

## 22.1 Contrast

Meet WCAG AA minimum.

Important data should exceed minimum contrast where possible.

## 22.2 Color Independence

Never rely on green, amber, or red alone.

Always pair color with:

- Label
- Icon
- Pattern
- Text state

## 22.3 Keyboard

All controls must support keyboard interaction.

Tab order must follow reading order.

## 22.4 Screen Readers

Use semantic headings.

Name controls clearly.

Describe confidence and evidence relationships.

## 22.5 Data Tables

Provide clear column headers.

Use logical reading order.

Do not encode essential meaning only through position.

---

# 23. Responsive Behavior

## Desktop

Use multi-column research layout where it improves comparison.

## Tablet

Stack secondary modules below primary research.

## Mobile

Order:

1. Fixture
2. Qualification
3. Confidence
4. Evidence
5. Counter-evidence
6. Methodology
7. Operators
8. Related fixtures

Do not move operators above evidence.

Use accordions for long secondary evidence groups.

Avoid horizontal scrolling.

---

# 24. Page Templates

## 24.1 Today / Qualified Fixtures

Structure:

1. App navigation
2. Date and update status
3. Filter bar
4. Qualified fixture list
5. Expanded evidence preview
6. Methodology note
7. Operator comparison
8. Footer

## 24.2 Match Detail

Structure:

1. Breadcrumb
2. Fixture identity
3. Qualified market
4. Confidence
5. Evidence summary
6. Detailed evidence groups
7. Counter-evidence
8. Probability comparison
9. Methodology
10. Operator comparison
11. Related fixtures
12. Disclosure

## 24.3 Live Signals

Structure:

1. Live status
2. Fixture
3. Signal type
4. Change since previous update
5. Evidence
6. Market movement
7. Timestamp
8. Methodology

Avoid trading-terminal styling.

## 24.4 Operator Page

Structure:

1. Operator identity
2. Licensing
3. Markets
4. Availability
5. Payment methods
6. Odds quality
7. Record history
8. Neutral CTA
9. Affiliate disclosure

## 24.5 Methodology

Structure:

1. What qualifies
2. Data sources
3. Thresholds
4. Confidence
5. Counter-evidence
6. Model update cadence
7. Limitations
8. Responsible-use statement

---

# 25. Copywriting Rules

## 25.1 Headlines

Headlines are editorial and specific.

Good:

- Evidence behind today’s qualified fixtures
- Why this fixture cleared the threshold
- What supports the signal
- Factors that challenge the signal

Bad:

- Today’s winning picks
- Best bets
- Guaranteed selections
- Hot opportunities

## 25.2 Helper Copy

Explain technical terms.

Keep helper copy short.

## 25.3 Disclosures

Disclosures must be visible and plain.

Example:

> RankWagers presents statistical evidence and operator comparison for informational purposes. It does not guarantee outcomes.

## 25.4 Affiliate Separation

Clearly distinguish:

- Research content
- Operator content
- Affiliate disclosure

---

# 26. Do and Do Not

## Do

- Show why a fixture qualified
- Show counter-evidence
- Show sample size
- Show data freshness
- Show comparison context
- Use realistic football assets
- Use warm ivory canvas
- Use restrained green
- Use editorial typography
- Keep operators secondary
- Use believable mock data
- Make every score inspectable
- Keep language neutral

## Do Not

- Use dark terminal styling as default
- Use pure black backgrounds
- Use neon
- Use casino graphics
- Use oversized CTA buttons
- Use countdowns
- Use “best bet”
- Use “safe”
- Use “guaranteed”
- Hide uncertainty
- Show odds before evidence
- Use fake celebratory football imagery
- Use generic initials as final logos
- Use lorem ipsum
- Use glassmorphism
- Use heavy shadows
- Use decorative charts
- Use red for normal caution
- Use UI density that resembles a trading terminal

---

# 27. Figma Make Operating Instructions

Treat this document as the complete and permanent RankWagers design system.

Do not summarize it.

Do not reinterpret it.

Do not invent a new visual direction.

Do not switch to dark mode unless explicitly requested.

Do not create sportsbook, casino, trading-terminal, developer-console, or generic SaaS aesthetics.

Use realistic production-ready mock football assets.

Use believable data.

Preserve the information order.

When designing a new screen:

1. Identify the user’s research task.
2. Select the relevant page template.
3. Use the approved information hierarchy.
4. Use the visual grammar.
5. Use the research language.
6. Use realistic mock football assets.
7. Keep operator content secondary.
8. Make every score inspectable.
9. Include counter-evidence.
10. Review against the final quality checklist.

---

# 28. Final Quality Checklist

Before approving any RankWagers screen, verify:

- Does the screen feel like football intelligence?
- Does it avoid sportsbook aesthetics?
- Does it avoid terminal aesthetics?
- Is the default canvas warm ivory?
- Is the visual hierarchy editorial?
- Is evidence more prominent than confidence?
- Is confidence explained?
- Is counter-evidence visible?
- Is sample quality shown?
- Is data freshness shown?
- Are realistic football assets used?
- Are mock statistics believable?
- Is the operator section secondary?
- Is the language neutral?
- Are charts meaningful?
- Is the page usable by keyboard?
- Does the design remain understandable without color?
- Can a new visitor understand the page within 10 seconds?
- Can the user explain why the fixture qualified?
- Does the screen feel unmistakably RankWagers?

If any answer is no, revise the design.

---

# 29. Permanent Summary

RankWagers is a calm, editorial, evidence-first football intelligence product.

The brand is defined by:

- Warm paper-like surfaces
- Deep green typography
- Measured data presentation
- Transparent confidence
- Visible counter-evidence
- Realistic football assets
- Research before operator comparison
- Neutral language
- Inspectable methodology
- Restraint

The interface must help the user understand.

It must never attempt to excite, pressure, or persuade.

Evidence is the product.
