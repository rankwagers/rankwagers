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
  liveFeaturedWonLine: "Prediction won — nice pick",
  liveFeaturedWinPendingLine: "Goal scored — locking in the win",
  liveUnlockTitle: "Unlock this live observation",
  liveUnlockBody:
    "This prediction is for verified players only. Register and deposit with a partner bookmaker, or join our Telegram VIP flow when the bot is live — then get the private group link for full signals.",
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
  bibleMethodologyNote:
    "Qualified fixtures are identified by the RankWagers qualification engine using statistical thresholds and historical match data. Confidence scores reflect model agreement, not outcome probability. No qualification constitutes a recommendation to place a wager.",
  bibleMethodologyLink: "Read operator methodology →",
  bibleOperatorsEyebrow: "Operators",
  bibleOperatorsTitle: "Compare licensed bookmakers",
  bibleOperatorsCompareLink: "Full operator rankings →",
  navQualified: "Qualified lists",
  navLiveSignals: "Live signals",
  navMethodology: "Methodology",
  navOperators: "Operators",
};

export type PredictionStrings = typeof predictionsEn;
