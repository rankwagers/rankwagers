export const predictionsEn = {
  metaTitle: "RankWagers — football predictions, live intelligence & transparent settlement",
  metaDescription:
    "Evidence-based football predictions with live match context, verified list performance, match detail pages, and bookmaker discovery. No guaranteed wins — transparent history only.",
  heroBadge: "Football decision support",
  heroTitle: "Football markets, assessed before kick-off.",
  heroSubtitle:
    "Every prediction is recorded before the match and scored against the result — including the ones that lose.",
  /** Dateline. House pattern: `Assessed {date}` (editorial standard §2.5, §4). */
  heroAssessed: "Assessed {date}",
  /**
   * Tier 1 of the trust hierarchy: how the money is made, stated before anything it could bias.
   * Carries no assurance about RankWagers' own character — it offers a pointer to check instead.
   */
  heroDisclosure:
    "RankWagers earns a commission when a reader opens an account with an operator through a link on this site. The criteria used to order operators are published in full, including what they do not assess.",
  dateLabel: "Date",
  timezoneNote: "Kick-off times in Istanbul (TR)",
  timezoneLocalNote: "Times & countdown in your local timezone",
  tabFh: "1st half 0.5+",
  tabOver15: "Over 1.5",
  tabOver25: "Over 2.5",
  tabSh: "2nd half 0.5+",
  colTime: "Time",
  colMatch: "Match",
  colLeague: "League",
  colPct: "Prob.",
  colStatus: "Status",
  empty: "No matches meet the threshold for this market today.",
  apiError: "Could not load today's lists. Please try again later.",
  liveSoonTitle: "Live signals",
  liveSoonBody:
    "Real-time goal alerts from our Telegram engine. One featured observation each hour — more via partner bookmakers or Telegram.",
  liveSoonBodyStats:
    "Live engine is quiet — we still surface high-potential matches from today's lists. Full real-time alerts return on Telegram during peak hours.",
  liveFeedHourlyNote: "Featured observation of the hour (resets on the hour UTC)",
  liveFeaturedLabel: "Observation of the hour",
  liveFeaturedMoreCta: "Tap for more predictions",
  liveFeaturedWonBadge: "WON",
  liveFeaturedWinPendingBadge: "GOAL",
  liveFeaturedWonLine: "Prediction won — confirmed by the result",
  liveFeaturedWinPendingLine: "Goal scored — settlement confirms at the final whistle",
  liveUnlockTitle: "Unlock this live observation",
  liveUnlockBody:
    "Full live observations are for verified players. Register with a partner bookmaker, or join the Telegram VIP flow when the bot is live — the private group carries the full signal detail.",
  liveUnlockAffiliate: "View partner betting sites",
  liveUnlockTelegram: "Open Telegram bot",
  liveUnlockTelegramChannel: "Open Telegram channel",
  liveUnlockTelegramSoon: "Telegram link not configured",
  liveEmpty: "No live signals right now. Check back during match hours.",
  liveEmptySoft:
    "No featured observation this hour — scroll today's lists below or open upcoming matches.",
  liveNewBadge: "New",
  liveTapUnlock: "Tap to unlock",
  liveTapTelegram: "Open Telegram for full signal",
  liveLockedTelegramTeaser: "More live observations on Telegram",
  liveHistoryLabel: "History",
  liveHistoryButton: "History",
  liveHistoryEmpty: "No live signals shared yet.",
  liveHistoryModalTitle: "Live signals history",
  listsPickDate: "Pick date",
  listsBackToToday: "Today",
  listsArchiveBadge: "Archive",
  listsArchiveTitle: "Lists for {date}",
  listsArchiveSubtitle: "Finished-day results — verify how our filtered lists performed.",
  listsResultsSummary: "Settled picks: {won} WON · {pct}% hit rate",
  listResultWon: "WON",
  listResultLost: "LOST",
  listResultPostponed: "POST",
  wcBarTitle: "World Cup",
  wcBarSeason: "{year}",
  wcBarLive: "LIVE",
  wcBarFt: "FT",
  wcBarNextIn: "Next kick-off",
  wcBarMore: "+{count} more",
  wcBarShowLess: "Show less",
  upcomingSectionLabel: "Upcoming (2–3h)",
  upcomingFeaturedLabel: "Next pick",
  upcomingStartsIn: "Starts in {mins} min",
  upcomingTapMore: "Click for more upcoming picks",
  upcomingTapSeePick: "Click to see the prediction",
  upcomingUnlockTitle: "More upcoming picks on Telegram",
  upcomingUnlockBody:
    "We publish full pre-match lists in our Telegram bot a few hours before kick-off. Open the bot to see every upcoming signal.",
  bannerLabel: "Banner",
  bannerPlaceholder: "Advertising space — vertical placement",
  statusLive: "Live",
  statusFt: "FT",
  statusScheduled: "Upcoming",
  playNow: "View operators",
  playNowAria: "View operators",
  navTodayLists: "Today's lists",
  heroCtaPrimary: "Review today's qualified markets",
  heroCtaSecondary: "See the settled record",
  heroSearchPlaceholder: "Search teams or leagues in today's lists",
  heroSearchSubmit: "Search",
  heroLiveCountLabel: "{count} live matches in today's lists",
  heroLiveCountEmpty: "No live matches in today's qualified lists right now",

  /*
   * Sprint 1 hero. Added to the English source only: `mergePredictions` spreads this object under
   * every locale override, so all thirty locales resolve these keys to the English wording until
   * they are translated. That is the established pattern in this file — a missing key would be a
   * type error, a missing translation is a fallback.
   *
   * The copy states only what the page can evidence. There is no claim about a count the model
   * does not expose and no freshness claim beyond the provider's own retrieval stamp.
   */
  heroStageEyebrow: "Football, read as evidence",
  heroStageUpdated: "Lists retrieved {time} UTC",
  heroStageUpdatedPending: "Retrieval time pending",
  heroStageTitle: "Today's football has already been researched.",
  heroStageLede: "Every fixture kicking off today was scored against the model.",
  heroStageLedeRest:
    "Only those that clear the qualification threshold reach this page — today, {count} of them.",
  heroStageLedeRestEmpty:
    "Only those that clear the qualification threshold reach this page. None have today.",
  heroFunnelTitle: "Today's research funnel",
  heroFunnelNote: "{count} cleared the threshold",
  heroFunnelAnalysed: "Fixtures",
  heroFunnelValidated: "Validated",
  heroFunnelInScope: "In scope",
  heroFunnelQualified: "Cleared threshold",
  heroFunnelFeatured: "Featured",
  /*
   * The † definition. "Cleared threshold" names the rule that actually runs — a market-potential
   * comparison — and this line says so, so the marker on the funnel is never a claim a reader
   * cannot check. It deliberately does NOT use the word "qualified": that belongs to the evidence
   * model alone (§18.4).
   */
  heroFunnelFootnote:
    "Cleared threshold counts fixtures whose provider potential met the published market threshold for the day. It is a filter, not a verdict on the fixture.",
  heroLeadTitle: "No. 01",
  heroLeadNote: "1 of {count} shown",
  heroSupportingTitle: "Supporting research",
  heroSupportingNote: "{count} of {total} shown",
  /*
   * THE SUPPORTING TABLE'S COLUMN HEADS.
   *
   * Mono, uppercase, and each naming exactly what its column holds. "Potential" rather than
   * "Probability" or "Confidence": the figure is FootyStats' market potential, and the vocabulary
   * rule (§ "Provider potential") reserves the other two words for things this column is not.
   */
  heroTableNo: "No.",
  heroTableFixture: "Fixture",
  heroTableLeague: "League",
  heroTableKickoff: "KO",
  heroTablePotential: "Potential",
  heroTableMarket: "Market",
  /*
   * THE APPROVED QUALIFIER FOR THE PROVIDER FIGURE.
   *
   * This replaces `colPctTooltip` on the hero, which read "Model probability for this market. A
   * statistical estimate, not a forecast of the outcome." Two things were wrong with it here. It
   * called the figure a MODEL PROBABILITY, which is the name the vocabulary reserves for our own
   * output and not for a provider's; and it said nothing about the sample, which this figure does
   * not have. The wording below is the one already used on the fixture panel and the acca detail
   * view, so the product states this figure the same way wherever it appears.
   *
   * `colPctTooltip` itself is left alone: it is shared with the prediction tables on unconverted
   * routes and carries translations in every locale, so re-pointing the whole site at this
   * vocabulary is a migration of its own rather than a line in a homepage pass.
   */
  heroProviderPotentialNote:
    "Provider potential — FootyStats' figure for this market as published. Not a confidence, and it carries no sample.",
  /*
   * The live desk's own heading, moved out of the component into the dictionary with the rest of
   * the page's copy. It was three hardcoded English strings passed to `SectionHeading` — the only
   * untranslated section heading on the page.
   */
  /*
   * The masthead's edition segment. `n` is the COUNT of archived days — the Nth issue is the Nth
   * one published — and the whole segment is omitted when the archive holds nothing rather than
   * printing "Edition 0". See `lib/homepage/edition.ts` for why the count beats the span.
   */
  mastheadEdition: "Edition {n}",
  /* ======================================================================
     PASS 2 — NEW KEYS FOR THE SIX CONVERTED ISLANDS
     ----------------------------------------------------------------------
     ENGLISH ONLY. Every key below is new, and none of them splits or reuses
     an existing key whose other locales carry a different sentence — that
     was the instruction and it is also the only safe move: re-pointing a
     translated key at new English leaves 20-odd locales asserting something
     the English no longer says.

     TRANSLATION DEBT, LOGGED HERE RATHER THAN IN A TICKET NOBODY READS.
     These keys have no locale entries. `mergePredictions` falls back to the
     English string, so a non-English reader sees English here until the
     locale files catch up. That is a visible, bounded gap on six section
     headings and a dozen labels — not a broken page, and not a silent one.
     ====================================================================== */
  rankedEyebrow: "Today",
  rankedTitle: "Highest provider potential today",
  rankedDescription:
    "Ranked by provider potential among today's qualified markets. A statistical estimate, not a forecast of the outcome.",
  rankedPotentialLabel: "provider potential",
  rankedOpenMatch: "Open match",
  rankedAddAcca: "Accumulator",
  /*
   * THE RANKED CARD'S WHY PANEL. Clause templates, filled from the card's own venue rates by
   * `rankedWhy.ts` — the "every rated match" wording only ever prints over a genuine 100% with
   * its sample attached; anything less states the real rate, and a missing rate omits its
   * clause. "can still lose" lives HERE and nowhere else: a kill test holds that the bound
   * reaches the page through this template only.
   */
  rankedWhyTitle: "Why {pct}%?",
  rankedWhyHomeAll: "home side cleared this market in every rated home match {sample}",
  rankedWhyHomeRate: "home side cleared this market in {rate} of rated home matches",
  rankedWhyAwayAll: "away side cleared this market in every rated away match {sample}",
  rankedWhyAwayRate: "away side cleared this market in {rate} of rated away matches",
  rankedWhyBound: "A past rate, not a certainty — a {pct}% line can still lose.",
  rankedWhyMore: "Full samples & reasoning:",
  deskEyebrow: "Research desk",
  deskTitle: "Recently qualified",
  deskDescription:
    "Fixtures that cleared the model's qualification threshold. Open a fixture for its full research sheet — drivers, venue evidence and recent history.",
  deskFilterLeague: "League",
  deskFilterMarket: "Market",
  deskColumnPotential: "Potential",
  deskColumnScore: "Score",
  deskColumnResult: "Result",
  resultsTitle: "Recent results — archived qualified-list outcomes",
  resultsNote: "Wins and losses both shown",
  resultsWon: "Won",
  resultsLost: "Lost",
  resultsVoid: "Void",
  resultsPending: "Pending",
  howRecordEyebrow: "Why RankWagers",
  howRecordTitle: "How the record is produced",
  howRecordDescription:
    "How this publication is produced — and how every figure above can be checked against the record rather than taken on trust.",
  archiveReadMethodology: "Read methodology",
  archiveUseDateControl: "Use date control",
  /*
   * The right-hand label on the supporting table and the ranked section. `N of M cleared†` — the
   * dagger points at the same footnote the funnel's cleared stage does, so the qualifier is
   * defined once for every surface that uses the word.
   */
  clearedOfTotal: "{shown} of {total} cleared†",
  /*
   * The live desk's derivation: how many more goals settle the market. Never a prediction that
   * they will arrive — it is arithmetic on the market line and the score already on the page.
   */
  liveGoalsToSettle: "{n} more goal settles it",
  liveGoalsToSettlePlural: "{n} more goals settle it",
  liveCleared: "cleared",
  livePending: "pending",
  liveNeedsN: "needs {n}",
  /** The desk's plain closing line — a stated destination, not a teaser about withheld content. */
  liveMoreVia: "More signals via Telegram",
  liveLatestScore: "Latest provider score",
  liveUpcomingTitle: "Upcoming — next picks",
  liveUpcomingNote: "Scores print once the provider reports",
  liveToKickoff: "to kick-off",
  /*
   * The lead's middle track. It labels the provider potential — the figure the numeral states —
   * standing between the two venue records it is read against. Deliberately the short form: the
   * qualifier under the numeral carries the full sentence, and repeating it on the track would
   * put two statements of the same bound in one picture.
   */
  heroVenuePotential: "potential",
  /** The bordered mono button at the foot of the lead. Uppercased by the type primitive. */
  heroOpenResearchCta: "Open match research",
  liveDeskEyebrow: "Live desk",
  liveDeskTitle: "Live signals",
  liveDeskDescription:
    "Automated observations of market and match activity. Live scores and events appear only when the data provider supplies them.",
  heroStageCta: "Explore today's research",
  heroStageEmpty:
    "No fixture cleared the qualification threshold for this date. The lists are published as they are — an empty day is a result, not an outage.",
  heroOpenResearch: "Open {home} v {away} research",
  heroProbabilityLabel: "Model probability",
  /*
   * The venue split beside the dial. Each label names WHERE the rate was observed, because a
   * side's home record and its overall record are different figures and that distinction is the
   * whole point of the pairing.
   */
  heroVenueHome: "At home",
  heroVenueAway: "Away",
  heroVenueLeague: "League",
  topPicksEyebrow: "Today",
  topPicksTitle: "Highest model probabilities today",
  topPicksDescription:
    "Ranked by model probability among today's qualified markets. A statistical estimate, not a forecast of the outcome.",
  /**
   * Shown only while a same-day archive is standing in for a failed provider. States the condition
   * and the capture time; makes no claim that the data is live and promises no restoration time.
   */
  staleArchiveNotice:
    "Live provider data is temporarily unavailable. Showing the last successful update from {time}.",
  topPicksEmpty: "No qualified fixtures are available for this date.",
  topPicksOpenMatch: "Open match",
  topPicksAddAcca: "Add to accumulator",
  topPicksAddAccaHint: "Adds this market to the accumulator",
  topPicksEvidence: "Model probability {pct}% on {market}",
  verifiedEyebrow: "Record",
  verifiedTitle: "Settled record",
  verifiedDescription:
    "Settled outcomes from qualified list markets only. Losses are included. ROI is omitted until publication odds are durably archived.",
  verifiedUnavailable: "Settled archive data is not available yet for this window.",
  verifiedTotal: "Total list markets",
  verifiedSettled: "Settled",
  verifiedWon: "Won",
  verifiedLost: "Lost",
  verifiedPending: "Pending",
  verifiedVoid: "Void / postponed",
  verifiedHitRate: "Hit rate (settled)",
  verifiedWonLost: "{won} won · {lost} lost",
  /*
   * S2 proof-band figures. Four labels and two audit sentences, each backed by a field on
   * `HomepageVerifiedPerformance`. Nothing here states a window, a rate basis or a price the
   * product does not compute — rwbible §3.2, and the reason ROI and average odds are absent.
   */
  verifiedPublished: "Published",
  verifiedOpen: "Open",
  verifiedHitRateShort: "Hit rate",
  verifiedStillOpen: "{count} still open",
  verifiedMethodology: "Settlement methodology",
  verifiedArchive: "Prediction archive entry",
  recentEyebrow: "Archive",
  recentTitle: "Recent results",
  recentDescription:
    "Latest archived qualified-list outcomes — wins and losses both shown, without selective filtering.",
  recentEmpty: "No recent settled archive rows are available yet.",
  leaguesEyebrow: "Explore",
  leaguesTitle: "Featured leagues",
  leaguesDescription: "Jump into competition hubs for fixtures, markets, and related research.",
  leaguesAll: "All competitions",
  whyEyebrow: "Why RankWagers",
  whyTitle: "How the record is produced",
  whyPublished: "Predictions are observed before or as lists are published — not rewritten after kickoff.",
  whyEvidence: "Evidence and model signals sit next to every qualified market.",
  whyLive: "Live scores and events appear only when the data provider supplies them.",
  whySettlement: "Settlement is server-authoritative with explicit void, pending, won, and lost states.",
  whyArchive: "Historical list archives support verification; a fuller prediction archive is planned.",
  archiveEyebrow: "History",
  archiveTitle: "Prediction archive",
  archiveBody:
    "Browse past research days with the date control above, or jump to methodology while the full searchable archive ships in a later sprint.",
  archiveCtaDate: "Use date control",
  archiveCtaMethod: "Read methodology",
  accaEntryTitle: "Build an accumulator from today's research",
  accaEntryBody:
    "Add selections from the ranked markets and match pages, review combined odds and risk class, then continue to a supported operator.",
  accaEntryCta: "Open accumulators",
  trustFooterNote: "18+ · Gamble responsibly · Affiliate disclosure in the footer",
  colPctTooltip:
    "Model probability for this market. A statistical estimate, not a forecast of the outcome.",
  promoTopSitesTitle: "Operators",
  promoTopSitesBody: "Assessments against published criteria, advertised offers and payout terms.",
  promoTopSitesCta: "View operators",
  promoBonusesTitle: "Operator promotions",
  promoBonusesBody: "Advertised offers from listed operators, with their stated terms.",
  promoBonusesCta: "View promotions",
  promoTelegramTitle: "Operator promotions on Telegram",
  promoTelegramBody: "Promotional offers from listed operators. Commercial content.",
  promoTelegramCta: "Open Telegram",
  matchDetailTapHint: "Tap match for stats",
  matchDetailVenueHome: "Home matches",
  matchDetailVenueAway: "Away matches",
  matchDetailGoalsTitle: "Goals per match (venue split)",
  matchDetailScoredAvg: "Scored",
  matchDetailConcededAvg: "Conceded",
  matchDetailHitLabel: "{hits} of {played} games",
  matchDetailHitPct: "Hit rate {pct}%",
  matchDetailMatchPotential: "Match potential {match}%",
  matchDetailBlendNote:
    "Team averages {blend}% · combined with match potential {match}%",
  matchDetailSampleLow: "Limited sample",
  matchDetailAiTitle: "Match outlook",
  matchDetailAiReason: "Why",
  matchDetailPlayedNote: "Season sample: {home} home games · {away} away games",
  matchDetailError: "Could not load match breakdown.",
  matchDetailProStats: "Pro stats",
  matchDetailTabGoals: "Goals",
  matchDetailTabAi: "AI",
  matchDetailTabGeneral: "General",
  matchDetailOver35: "Over 3.5",
  matchDetailBtts: "BTTS",
  matchDetailAvgGoals: "Avg. goals",
  bibleHeroTitle: "Evidence before the bet. Settlement after the whistle.",
  bibleHeroMeta:
    "{date} · {total} qualified fixtures · Times in your timezone · FootyStats",
  bibleFilterLabel: "Filter",
  bibleMarketsLabel: "Markets",
  /*
   * The banned sentence — "Confidence scores reflect model agreement, not outcome probability" —
   * is DELETED, not reworded: "confidence" is the word the vocabulary reserves elsewhere, and the
   * approved provider-potential qualifier (`heroProviderPotentialNote`) already bounds the figure
   * wherever it prints. It survived the first sweep because that sweep was scoped to the hero's
   * keys; the sweep now covers every homepage dictionary value.
   */
  bibleMethodologyNote:
    "Qualified fixtures are identified by the RankWagers qualification engine using statistical thresholds and historical match data. No qualification constitutes a recommendation to place a wager.",
  bibleMethodologyLink: "Read operator methodology →",
  bibleOperatorsEyebrow: "Operators",
  bibleOperatorsTitle: "Compare licensed bookmakers",
  /*
   * NO ARROW IN THE LABEL. The arrow is the template's property, never the label's (the
   * `V2Button` rule) — this label carried one and the strip appended a second, which shipped
   * "FULL OPERATOR RANKINGS → →".
   */
  bibleOperatorsCompareLink: "Full operator rankings",
  /* ======================================================================
     FIXTURE PAGE CONVERSION — the five-level architecture
     ----------------------------------------------------------------------
     L1 lead finding · L2 supporting signals + ⓘ · L3 model + why · L4 full
     detail · L5 operators. Sentence grammar is one template — finding,
     count, scope, rate, baseline — so every signal reads the same way in
     every language. Locale files carry all of these (fixture-pass debt is
     paid in the same pass that mints the keys).
     ====================================================================== */
  fxLeadEyebrow: "Lead finding",
  fxSupportsTitle: "Supporting signals",
  fxSupportsDescription:
    "Every row reads the same way: the finding, how often, over how many matches, against the league rate.",
  fxExplainerLabel: "How these are ranked",
  fxExplainerBody:
    "Each signal is scored by how far its rate sits from the league rate for this competition, weighted by sample size (n/(n+5)). Fewer than five matches never ranks — a short run is context, not a finding. A market with no league baseline is never ranked against an invented number; it lives in the full detail below. The strongest signal leads the page only when it clears a fixed bar; when nothing does, the page has no lead finding rather than a manufactured one.",
  fxSignalLine: "{finding}: {count} of {scope} ({rate}%) — league average {baseline}%.",
  fxSignalLineNoBaseline: "{finding}: {count} of {scope} ({rate}%) — no league baseline.",
  fxScopeHomeVenue: "{team}'s {n} home matches this season",
  fxScopeAwayVenue: "{team}'s {n} away matches this season",
  fxScopeRecentHome: "{team}'s last {n} at home",
  fxScopeRecentAway: "{team}'s last {n} away",
  fxScopeH2h: "the last {n} meetings",
  fxFindingOver15Up: "Goals keep coming",
  fxFindingOver15Down: "Goals are scarce",
  fxFindingOver25Up: "High-scoring matches keep coming",
  fxFindingOver25Down: "High-scoring matches are rare",
  fxFindingOver35Up: "Four-goal matches keep coming",
  fxFindingOver35Down: "Four-goal matches are rare",
  fxFindingFh05Up: "First-half goals keep coming",
  fxFindingFh05Down: "First halves start quiet",
  fxFindingSh05Up: "Second-half goals keep coming",
  fxFindingSh05Down: "Second halves stay quiet",
  fxFindingBttsUp: "Both teams keep scoring",
  fxFindingBttsDown: "One side keeps getting shut out",
  fxFindingCleanSheetsUp: "Clean sheets keep coming",
  fxFindingCleanSheetsDown: "Clean sheets are rare",
  fxFindingFailedToScoreUp: "Blanks keep coming",
  fxFindingFailedToScoreDown: "Blanks are rare",
  fxModelTitle: "The model's view",
  fxModelPotentialLine:
    "Provider potential {pct}% on {market} — the provider's published figure. Not a confidence, not a price, and it carries no sample.",
  fxWhyTitle: "Why",
  fxWhyIntro: "How the ranked signals above meet the model's own reading of this fixture.",
  fxWhyAgrees:
    "The ranked signals and the model's scored evidence point the same way: {supporting} of its {total} signals support the market direction.",
  fxWhyCaution:
    "Recent form says “{finding}”, but the model is cautious: {opposing} of its {total} scored signals oppose it, and this fixture has not cleared the model's qualification bar.",
  fxWhyModelCounts:
    "Of the model's {total} scored signals, {supporting} support and {opposing} oppose.",
  fxWhyArchiveLine:
    "Snapshot {seq}, captured {time} · model {version} · evidence score {score} · {signals} signals: {supporting} supporting, {opposing} opposing.",
  fxWhyArchiveNone:
    "No evidence snapshot has been captured for this fixture yet. The reading above is derived live from the same venue rates and league baseline the model reads — nothing beyond them is claimed.",
  fxDetailTitle: "Full research detail",
  fxDetailDescription:
    "Every market and venue rate behind the levels above — dense on purpose. Each rate carries its sample; a missing rate is missing, not zero.",
  fxOperatorsTitle: "Operator options",
  fxOperatorsNote:
    "Editorial research above is separate from commercial offers. Links use server-signed redirects.",
  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Provider figure",
  fxProviderOnlyRate: "provider figure — no sample",
  fxWhyWindowNote: "Every rate below is a season rate at the named venue — a different window from the last-N form sentences above.",
  fxRateHomeSeason: "Home side at home — this season",
  fxRateAwaySeason: "Away side away — this season",
  fxRateLeagueSeason: "League — this season",
  fxRecordAfterKickoff: "Captured after kickoff — excluded from settlement.",
  fxLiveUnavailable: "live updates unavailable for this competition",
  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Research markets",
  mktIndexLede:
    "Market references connecting fixtures, evidence and observed odds. Research structure, never tips.",
  mktLeadEyebrow: "Coverage lead",
  mktLeadLine:
    "Coverage concentrates in {league}: {count} of {total} qualified fixtures ({pct}%).",
  mktSupportsTitle: "Coverage signals",
  mktSupportsNote:
    "Counts from the current research set — today's qualified lists. Coverage counts, not occurrence rates.",
  mktQualifiedLine: "{n} qualified fixtures in the current research set",
  mktLeagueCoverageLine: "{n} competitions covered",
  mktTopLeagueRow: "{league} — {count} of {total} ({pct}%)",
  mktProviderAvgLine:
    "Average provider potential {pct}% across the qualified set — a provider figure, not a measured rate.",
  mktFixturesTitle: "Qualified fixtures today",
  mktFixturesEmpty: "No qualified fixtures for this market in the current research set.",
  mktDetailTitle: "Market detail",
  mktFaqTitle: "Questions",
  mktRelatedTitle: "Related markets",
  mktOddsTitle: "Observed odds",
  mktOddsEmpty:
    "No stored odds observations for this market yet — figures appear only after verified observations are appended.",
  mktOddsBest: "Best observed",
  mktOddsAverage: "Average observed",
  mktOddsLowest: "Lowest observed",
  mktOddsMovements: "Movements",
  mktOddsClv: "CLV average",
  mktOddsWindowNote: "All figures from the stored observation set — never a live price.",
  mktIndicatorsTitle: "Evidence indicators",
  mktIndicatorsShow: "Expand definitions",
  mktIndicatorsHide: "Hide definitions",
  mktIndicatorsNote: "Metric definitions for this market — not live values, not certainty scores.",
  mktIndicatorUsed: "used in research",
  mktIndicatorConceptual: "conceptual",
  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Research competitions",
  cmpIndexTitle: "Competitions",
  cmpIndexLede:
    "Competitions as research hubs — qualified fixtures, markets, operators and observed odds. Research structure, never tips.",
  cmpLeadLine:
    "Today's coverage concentrates in {market}: {count} of {total} qualified rows ({pct}%).",
  cmpQualifiedRowsLine: "{n} qualified market rows in the current research set",
  cmpUniqueFixturesLine: "{n} unique fixtures",
  cmpMarketRow: "{market} — {count} of {total} ({pct}%)",
  cmpUpcomingTitle: "Upcoming qualified fixtures",
  cmpUpcomingEmpty:
    "No upcoming qualified fixtures matched this competition in the current research set.",
  cmpRecentTitle: "Highest-signal rows",
  cmpRecentNote:
    "The strongest qualified rows from the current research set — research entries, not results.",
  cmpRecentEmpty:
    "No analyzed fixtures matched this competition in the current research set.",
  cmpDetailTitle: "Competition detail",
  cmpSeasonsTitle: "Seasons",
  cmpSeasonCurrent: "current",
  cmpMarketActivityTitle: "Market activity in sample",
  cmpMarketActivityEmpty:
    "Market rows appear when qualified fixtures match this competition.",
  cmpRowsProviderMeta: "{n} rows · provider avg {pct}%",
  cmpRelatedCompetitions: "Related competitions",
  cmpRelatedTeams: "Related teams",
  cmpRelatedTeamsNote:
    "Linked when a canonical team entity exists; otherwise shown as research labels.",
  cmpMethodologyLink: "Methodology & evidence",
  ssnEyebrow: "Season research",
  ssnCurrent: "Current",
  ssnArchived: "Archived",
  ssnWindowLine: "Season window {start} → {end}",
  ssnLeadLine:
    "This season's research set holds {count} qualified rows across {fixtures} fixtures.",
  ssnTeamsTitle: "Participating teams",
  ssnTeamsEmpty:
    "Teams appear only when present in qualified fixtures for this season.",
  ssnTeamsCountLine: "{n} participating teams",
  ssnUpcomingRowsLine: "{n} upcoming rows",
  ssnCompletedRowsLine: "{n} completed rows",
  ssnHomeAwayLine: "{home} home rows · {away} away rows",
  ssnEnrichmentAbsent:
    "Season-level goal and xG rates render only when match-detail enrichment exists — this page does not invent them.",
  ssnDetailTitle: "Season detail",
  ssnOperatorsTitle: "Available operators",
  ssnOperatorsEmpty:
    "No affiliate-enabled operators for the resolved visitor country.",
  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Research teams",
  tmIndexTitle: "Teams",
  tmIndexLede:
    "Canonical team research hubs — competitions, qualified fixtures, markets and operators. Factual relationships only, never ratings.",
  tmLeadLine:
    "This team's research set holds {count} qualified rows across {fixtures} fixtures.",
  tmUpcomingEmpty:
    "No upcoming qualified fixtures for this team in the current research set.",
  tmRecentEmpty: "No analyzed fixtures for this team in the current research set.",
  tmCompetitionsTitle: "Current competitions",
  tmDetailTitle: "Team detail",
  tmMarketProfileTitle: "Goal-market profile",
  tmMarketProfileEmpty:
    "No qualified market rows for this team in the current research sample.",
  tmHomeAwayNote:
    "Counts reflect qualified research rows where {team} appears home or away — not a form table, not a rating.",
  tmEnrichmentAbsent:
    "Team-level goal and xG rates render only when match-detail enrichment exists — this page does not invent them.",
  tmRelatedTeams: "Related teams",
  tmSearchLabel: "Search",
  tmSearchPlaceholder: "Team name",
  tmFilterCompetition: "Competition",
  tmFilterCountry: "Country",
  tmAllCompetitions: "All competitions",
  tmAllCountries: "All countries",
  tmApplyFilters: "Apply filters",
  tmFiltersEmpty: "No teams match these filters.",
  tmResetFilters: "Reset filters",
  tmInternational: "International",
  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Research countries",
  ctIndexTitle: "Country research hubs",
  ctIndexLede:
    "A hub exists only when unique competitions, operators and research context can be assembled for the region — never as a thin geo doorway.",
  ctIndexEmpty: "No country hubs currently pass the quality gate.",
  ctEyebrow: "Country hub",
  ctLeadLine:
    "This hub connects {competitions} competitions, {operators} operators and {fixtures} archived fixtures.",
  ctCompetitionsCount: "{n} competitions linked",
  ctOperatorsCount: "{n} operators available",
  ctFixturesCount: "{n} archived fixture samples",
  ctCompetitionsTitle: "Relevant competitions",
  ctCompetitionsEmpty: "No registry competitions resolved for this profile yet.",
  ctFixturesTitle: "Related fixtures",
  ctFixturesEmpty: "No recent archived fixtures matched this country.",
  ctContinueTitle: "Continue exploring",
  ctOperatorsTitle: "Bookmaker discovery",
  ctOperatorsEmpty: "No verified operators are available for this country context.",
  ctNoindexNote: "This hub is currently not indexed ({reason}).",
  ctLinkMarkets: "Research markets",
  ctLinkCompetitions: "All competitions",
  ctLinkOperators: "All bookmakers",
  ctLinkPerformance: "Verified performance",
  ctLinkAcca: "Acca Studio",
  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Verification",
  arcIndexTitle: "Prediction archive",
  arcIndexLede:
    "Every published qualified-list prediction and its settled result — wins and losses both shown, outcomes never rewritten.",
  arcLeadLine: "Of {settled} settled predictions, {won} won and {lost} lost ({pct}%).",
  arcRecordTitle: "Verified archive record",
  arcTotalLine: "{n} predictions recorded",
  arcSettledLine: "{n} settled",
  arcPendingLine: "{n} pending",
  arcVoidLine: "{n} void",
  arcPairedRate: "{won} of {settled} ({pct}%)",
  arcOddsUnavailable:
    "Odds averages and ROI are unavailable until publication odds are durably stored — this page does not invent them.",
  arcLastUpdateLabel: "Last archive update",
  arcByMarketTitle: "By market",
  arcByMarketRow: "{won} won · {lost} lost · {pending} pending · {void} void",
  arcByCompetitionTitle: "Top competitions in sample",
  arcRowsN: "{n} rows",
  arcTableMatch: "Match",
  arcTableMarket: "Market",
  arcTableResult: "Result",
  arcTableScore: "Score",
  arcTableTiming: "Timing",
  arcTableEmpty: "No archived predictions match these filters.",
  arcSettlementSummary: "Settlement & evidence",
  arcOddsRowUnavailable: "Original odds and unit P/L unavailable for this row.",
  arcArchiveLabel: "Archived",
  arcKickoffLabel: "Kickoff",
  arcPublishedLabel: "Published",
  arcFilterMarket: "Market",
  arcFilterStatus: "Status",
  arcFilterCompetition: "Competition",
  arcFilterTeam: "Team",
  arcFilterSearch: "Search",
  arcAllMarkets: "All markets",
  arcAllStatuses: "All statuses",
  arcSearchPlaceholder: "Match or league",
  arcPageOf: "Page {page} of {total}",
  arcPrev: "Previous",
  arcNext: "Next",
  arcDaysTitle: "Archive days",
  arcDaysEmpty:
    "No daily archives yet — settled fixtures are archived permanently and appear here.",
  arcBrowseTitle: "Browse predictions",
  arcShowingLine: "Showing {shown} of {total} matching rows",
  arcDayEyebrow: "Daily archive",
  arcDayLede:
    "Historical snapshot for this research day — outcomes are not rewritten after settlement.",
  arcDayPredictionsTitle: "Predictions on {date}",
  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Entity discovery",
  srchTitle: "Search",
  srchResultsFor: "Results for \u201c{q}\u201d",
  srchCountLine: "{n} matching entities from the validated registry",
  srchLede:
    "Search the validated registry — competitions, seasons, teams, markets and country-aware operators.",
  srchAllFilter: "All",
  srchEmptyNoQueryTitle: "Search fixtures, teams, competitions and operators",
  srchEmptyNoQueryDesc:
    "Type a competition, team, market, season or operator name to find validated research entities.",
  srchEmptyFilteredTitle: "No entities match these filters.",
  srchEmptyFilteredDesc:
    "Matches exist, but none under the current type or country filter — clear filters or broaden the query.",
  srchEmptyLocaleTitle: "Language not available",
  srchEmptyLocaleDesc:
    "This locale is not available for search. Switch to a supported language and try again.",
  srchEmptyNoneTitle: "No matches for this search.",
  srchEmptyNoneDesc:
    "Nothing in the validated registry matched that query. Try another spelling, a team alias, or browse popular research below.",
  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Page not found",
  nfBody:
    "This URL is not part of the research record. Check the address, or continue from one of the surfaces below.",
  nfHome: "Go home",
  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Operator intelligence",
  opIndexTitle: "Operators",
  opIndexLede:
    "Sportsbook operators as research profiles — market coverage, availability, verification and observed odds history. Assessment against published criteria, never endorsement.",
  opVerified: "verified",
  opUnverified: "unverified",
  opRowMarketsCount: "{n} markets",
  opLeadAvailable: "{operator} is listed as available for your country ({country}).",
  opLeadUnavailable: "{operator} is not listed as available for your country ({country}).",
  opVerificationRow: "Verification: {status}",
  opSupportsMarketsLine: "{n} supported markets",
  opSupportsCountriesLine: "{n} listed countries",
  opSamplesLine: "{n} stored odds observations",
  opCoverageLine: "{market} — {n} observations",
  opEvidenceNote:
    "Every figure below comes from the stored observation set — nothing is a live price, and empty means not observed.",
  opMarketsTitle: "Supported markets",
  opCountriesTitle: "Listed countries",
  opCountriesNone: "No country list is configured for this operator.",
  opRecentFixtures: "Recently observed fixtures",
  opFixtureN: "Fixture #{id}",
  opTermsTitle: "Operator-stated terms",
  opTermsNote:
    "The statements below are the operator's own claims — recorded for reference, not verified by RankWagers.",
  opFoundedRow: "Founded {year}",
  opHqRow: "Headquarters: {hq}",
  opLicensesRow: "Licenses: {list}",
  opContinueTitle: "Continue to this operator",
  opContinueBody:
    "If the evidence above is useful, the commercial link below opens the sportsbook. RankWagers earns a commission on sign-ups and does not operate gambling services.",
  opContinueCta: "Continue to {operator}",
  opContinueUnavailable: "No commercial link is available for your country.",
  opRelatedOperators: "Related operators",
  /* Acca family — commercial conversion (ac keys). */
  acStudioEyebrow: "Research workspace",
  acStudioTitle: "Acca Studio",
  acStudioLede:
    "Combine published research selections, review combined odds and an explainable risk class, then choose an operator through a visible, server-signed commercial step. A research workspace — never a bookmaker bet slip.",
  acBuilderTitle: "Acca Builder",
  acBuilderLede:
    "Ranked combinations generated from published list predictions — evidence and observed odds where stored, then a transfer into the Studio. Research only.",
  acPublishedTitle: "Published accas",
  acPublishedLede:
    "Editorially published combinations with their evidence and settled outcomes — wins and losses alike, never rewritten.",
  acOperatorsTitle: "Choose an operator",
  acOperatorsNote:
    "Ordered by availability for your country, then verification. RankWagers never places bets — Continue opens the operator through a visible, server-signed commercial redirect.",
  acOperatorsLoading: "Loading operators…",
  acOperatorsError: "Operator offers are unavailable right now.",
  acAvailable: "available for your country",
  acUnavailable: "not listed for your country",
  acDetailLink: "Operator page",
  navQualified: "Qualified lists",
  navLiveSignals: "Live signals",
  navMethodology: "Methodology",
  navOperators: "Operators",
};

export type PredictionStrings = typeof predictionsEn;
