import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  AlertTriangle,
  Info,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ── Club crest SVGs ────────────────────────────────────────────────────────────

function CrestArsenal({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="Arsenal">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="#CC0007" />
      <rect x="5" y="19" width="30" height="10" fill="white" />
      <rect x="11" y="21.5" width="14" height="4" rx="2" fill="#CC0007" />
      <ellipse cx="25.5" cy="23.5" rx="3" ry="3" fill="#9A0005" />
      <rect x="9.5" y="20.5" width="3.5" height="6" rx="1" fill="#9A0005" />
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#880004" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CrestChelsea({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="Chelsea">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="#034694" />
      <circle cx="20" cy="24" r="11" fill="#C8A951" />
      <circle cx="20" cy="24" r="8" fill="#034694" />
      {/* Simplified lion body */}
      <path d="M16 20 Q14 21 14.5 23.5 Q15 26 17 26.5 L17 29 Q17 30 18 30 L18 29 Q19 30 21 30 L21 29 Q22 30 23 30 L23 26.5 Q25 26 25.5 23.5 Q26 21 24 20 Q22 19 20 19 Q18 19 16 20Z" fill="#C8A951" />
      <path d="M18 20 Q20 18.5 22 20" stroke="#C8A951" strokeWidth="1.5" fill="none" />
      <circle cx="18" cy="21.5" r="0.8" fill="#034694" />
      <circle cx="22" cy="21.5" r="0.8" fill="#034694" />
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#022F63" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CrestBayern({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="Bayern Munich">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="#DC052D" />
      <circle cx="20" cy="24" r="11" fill="white" />
      <path d="M20 13 A11 11 0 0 1 31 24 L20 24 Z" fill="#0066B2" />
      <path d="M20 35 A11 11 0 0 1 9 24 L20 24 Z" fill="#0066B2" />
      <path d="M9 24 A11 11 0 0 1 20 13 L20 24 Z" fill="#DC052D" />
      <path d="M31 24 A11 11 0 0 1 20 35 L20 24 Z" fill="#DC052D" />
      <circle cx="20" cy="24" r="5.5" fill="white" />
      <text x="20" y="26.5" textAnchor="middle" fill="#1A1A1A" fontSize="5" fontWeight="700" fontFamily="sans-serif">FCB</text>
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#A5001F" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CrestDortmund({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="Borussia Dortmund">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="#FDE100" />
      <path d="M4 9L20 2L36 9L36 22L4 22Z" fill="#1A1A1A" />
      <text x="20" y="19.5" textAnchor="middle" fill="#FDE100" fontSize="8.5" fontWeight="700" fontFamily="sans-serif" letterSpacing="-0.5">BVB</text>
      {/* Subtle bee silhouette */}
      <ellipse cx="20" cy="33" rx="5" ry="3.5" fill="#1A1A1A" opacity="0.15" />
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#C8B500" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CrestBarcelona({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="FC Barcelona">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="#A50044" />
      {/* Blue vertical bands */}
      <rect x="4" y="9" width="9" height="37" fill="#004D98" />
      <rect x="27" y="9" width="9" height="37" fill="#004D98" />
      {/* Yellow and red horizontal stripes center */}
      <rect x="13" y="9" width="14" height="5" fill="#EDBB00" />
      <rect x="13" y="14" width="14" height="5" fill="#A50044" />
      <rect x="13" y="19" width="14" height="5" fill="#EDBB00" />
      <rect x="13" y="24" width="14" height="5" fill="#A50044" />
      <rect x="13" y="29" width="14" height="5" fill="#EDBB00" />
      <rect x="13" y="34" width="14" height="12" fill="#A50044" />
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#7A0032" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function CrestAtletico({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 40 48" fill="none" aria-label="Atletico Madrid">
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" fill="white" />
      {/* Red and white vertical stripes */}
      <rect x="4" y="9" width="5.3" height="37" fill="#CE3524" />
      <rect x="9.3" y="9" width="5.3" height="37" fill="white" />
      <rect x="14.6" y="9" width="5.3" height="37" fill="#CE3524" />
      <rect x="19.9" y="9" width="5.3" height="37" fill="white" />
      <rect x="25.2" y="9" width="5.3" height="37" fill="#CE3524" />
      <rect x="30.5" y="9" width="5.5" height="37" fill="white" />
      {/* Blue top band */}
      <rect x="4" y="9" width="32" height="8.5" fill="#003082" />
      <text x="20" y="17" textAnchor="middle" fill="white" fontSize="6" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.5">ATM</text>
      <path d="M20 2L4 9L4 27Q4 40 20 46Q36 40 36 27L36 9Z" stroke="#9A2017" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

// ── Evidence comparison bar ────────────────────────────────────────────────────

function EvidenceBar({ rate, threshold }: { rate: number; threshold: number }) {
  return (
    <div className="relative h-1.5 bg-[#E5E1D8] rounded-full overflow-visible mt-1.5">
      <div
        className="absolute left-0 top-0 h-full bg-[#0E6B4F] rounded-full"
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-[#7D8782]"
        style={{ left: `${threshold}%` }}
        title={`Threshold: ${threshold}%`}
      />
    </div>
  );
}

// ── Tier badge ─────────────────────────────────────────────────────────────────

function TierBadge({ tierKey }: { tierKey: string }) {
  const styles: Record<string, string> = {
    high: "text-[#0E6B4F] bg-[#EAF3ED] border-[#0E6B4F]/25",
    moderate: "text-[#53615C] bg-[#F0EDE6] border-[#D8D5CC]",
    watch: "text-[#A96E12] bg-[#FBF2DF] border-[#A96E12]/25",
  };
  const labels: Record<string, string> = {
    high: "High",
    moderate: "Mod.",
    watch: "Watch",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${styles[tierKey]}`}>
      {labels[tierKey]}
    </span>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const fixtures = [
  {
    id: "ars-che",
    league: "Premier League",
    leagueCode: "PL",
    home: "Arsenal",
    away: "Chelsea",
    HomeCrest: CrestArsenal,
    AwayCrest: CrestChelsea,
    kickoff: "Thu 24 Jul · 20:00 BST",
    venue: "Emirates Stadium, London",
    market: "Both Teams to Score",
    marketCode: "BTTS",
    confidence: 78,
    tier: "High agreement",
    tierKey: "high",
    signals: 6,
    counterSignals: 2,
    sample: 10,
    updatedAt: "2h ago",
    modelVersion: "v2.4.1",
  },
  {
    id: "bay-bvb",
    league: "Bundesliga",
    leagueCode: "BUN",
    home: "Bayern Munich",
    away: "Borussia Dortmund",
    HomeCrest: CrestBayern,
    AwayCrest: CrestDortmund,
    kickoff: "Thu 24 Jul · 18:30 CET",
    venue: "Allianz Arena, Munich",
    market: "Over 2.5 Goals",
    marketCode: "O2.5",
    confidence: 65,
    tier: "Moderate agreement",
    tierKey: "moderate",
    signals: 4,
    counterSignals: 3,
    sample: 10,
    updatedAt: "4h ago",
    modelVersion: "v2.4.1",
  },
  {
    id: "bar-atm",
    league: "La Liga",
    leagueCode: "LAL",
    home: "FC Barcelona",
    away: "Atletico Madrid",
    HomeCrest: CrestBarcelona,
    AwayCrest: CrestAtletico,
    kickoff: "Thu 24 Jul · 21:00 CET",
    venue: "Estadi Olímpic Lluís Companys",
    market: "Home Win",
    marketCode: "1X2",
    confidence: 41,
    tier: "Watch",
    tierKey: "watch",
    signals: 3,
    counterSignals: 4,
    sample: 8,
    updatedAt: "6h ago",
    modelVersion: "v2.4.1",
  },
];

const evidenceGroups = [
  {
    id: "form",
    label: "Team Form",
    items: [
      {
        observation: "Arsenal home scoring consistency",
        metric: "9 of 10",
        metricLabel: "home PL matches: scored",
        rate: 90,
        threshold: 76,
        thresholdLabel: "League median: 76%",
        comparisonLabel: "+14pp above league median",
        source: "FootyStats",
        sample: "10-match sample",
      },
      {
        observation: "Chelsea away attacking output",
        metric: "8 of 10",
        metricLabel: "away PL matches: scored",
        rate: 80,
        threshold: 71,
        thresholdLabel: "League median: 71%",
        comparisonLabel: "+9pp above league median",
        source: "FootyStats",
        sample: "10-match sample",
      },
    ],
  },
  {
    id: "attack",
    label: "Attack Quality",
    items: [
      {
        observation: "Combined expected goals per 90",
        metric: "3.41 xG",
        metricLabel: "per 90 (home 1.84 + away 1.57)",
        rate: (3.41 / 4.5) * 100,
        threshold: (2.8 / 4.5) * 100,
        thresholdLabel: "Qualification threshold: 2.80",
        comparisonLabel: "+0.61 above qualification threshold",
        source: "StatsBomb",
        sample: "8-match sample",
      },
      {
        observation: "Mutual defensive exposure",
        metric: "8 of 10",
        metricLabel: "matches: both teams conceded",
        rate: 80,
        threshold: 65,
        thresholdLabel: "Threshold: 65%",
        comparisonLabel: "Both sides in mutual exposure zone",
        source: "FootyStats",
        sample: "10-match sample",
      },
    ],
  },
  {
    id: "h2h",
    label: "Historical Matchup",
    items: [
      {
        observation: "Head-to-head BTTS rate",
        metric: "7 of 10",
        metricLabel: "Premier League H2H meetings: BTTS",
        rate: 70,
        threshold: 54,
        thresholdLabel: "H2H league median: 54%",
        comparisonLabel: "+16pp above H2H median",
        source: "FootyStats",
        sample: "10 H2H records",
      },
    ],
  },
  {
    id: "market",
    label: "Market Context",
    items: [
      {
        observation: "Operator implied probability agreement",
        metric: "6 of 8",
        metricLabel: "tracked operators imply BTTS above 60%",
        rate: 75,
        threshold: 60,
        thresholdLabel: "Agreement threshold: 60%",
        comparisonLabel: "Range: 57.1%–61.3% implied probability",
        source: "Operator monitoring",
        sample: "Updated 3h ago",
      },
    ],
  },
];

const counterEvidence = [
  {
    id: "ce1",
    observation: "Chelsea recent defensive improvement",
    detail:
      "Chelsea conceded 0 goals in their last 2 away matches, suggesting a possible tactical adjustment. The sample is insufficient to override the 10-match trend but warrants monitoring.",
    sample: "2 matches",
  },
  {
    id: "ce2",
    observation: "Match significance and defensive discipline",
    detail:
      "In high-stakes fixtures, reduced rotation risk may increase both teams' defensive organisation. The magnitude of this effect is contextual — no direct statistical measure is available.",
    sample: "Contextual",
  },
  {
    id: "ce3",
    observation: "Data coverage note",
    detail:
      "2 of Arsenal's 10 home matches included promoted-side opponents. This may moderately inflate the home scoring rate relative to a top-six-weighted baseline.",
    sample: "2 of 10 matches",
  },
];

const operators = [
  { name: "Bet365", odds: "1.72", implied: "58.1%", edge: "+4.8%", updated: "3h ago", status: "Available" },
  { name: "William Hill", odds: "1.70", implied: "58.8%", edge: "+4.1%", updated: "3h ago", status: "Available" },
  { name: "Paddy Power", odds: "1.75", implied: "57.1%", edge: "+5.8%", updated: "3h ago", status: "Available" },
  { name: "Betfair Exchange", odds: "1.80", implied: "55.6%", edge: "+7.3%", updated: "1h ago", status: "Available" },
];

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [expandedId, setExpandedId] = useState<string>("ars-che");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [activeLeague, setActiveLeague] = useState("All");
  const [activeMarket, setActiveMarket] = useState("All");
  const [activeTier, setActiveTier] = useState("All");
  const [activeNav, setActiveNav] = useState("Qualified Fixtures");

  const leagues = ["All", "Premier League", "La Liga", "Bundesliga"];
  const markets = ["All", "BTTS", "Over 2.5", "Home Win", "Away Win"];
  const tiers = ["All", "High", "Moderate", "Watch"];
  const navItems = [
    "Today",
    "Qualified Fixtures",
    "Live Signals",
    "Methodology",
    "Operators",
    "Research Notes",
    "Saved",
  ];

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tierScoreColor = (tierKey: string) =>
    ({ high: "text-[#0E6B4F]", moderate: "text-[#53615C]", watch: "text-[#A96E12]" })[tierKey] ??
    "text-[#53615C]";

  return (
    <div
      className="min-h-screen bg-[#F6F3EC] text-[#13251F]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-[#FBF9F4] border-b border-[#D8D5CC]">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <span
              className="text-[#0E6B4F] font-semibold text-lg tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              RankWagers
            </span>
            <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary navigation">
              {navItems.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeNav === item
                      ? "bg-[#EAF3ED] text-[#0E6B4F] font-medium"
                      : "text-[#53615C] hover:text-[#13251F] hover:bg-[#F0EDE6]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7D8782]" aria-hidden />
            <input
              className="pl-8 pr-3 py-1.5 text-sm bg-[#F0EDE6] border border-[#D8D5CC] rounded-md text-[#13251F] placeholder-[#7D8782] focus:outline-none focus:border-[#0E6B4F] w-52 transition-colors"
              placeholder="Search team, league, or market"
              aria-label="Search team, league, or market"
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8">
        {/* Page heading + model status */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1
              className="text-[26px] font-semibold text-[#13251F] leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Evidence behind today's qualified fixtures
            </h1>
            <p className="text-[12px] text-[#7D8782] mt-1 font-mono tracking-tight">
              Thursday, 24 July 2025 &nbsp;·&nbsp; 3 qualified fixtures &nbsp;·&nbsp; Model v2.4.1
              &nbsp;·&nbsp; Updated 06:14 UTC &nbsp;·&nbsp; FootyStats · StatsBomb
            </p>
          </div>
          <button className="hidden md:flex items-center gap-1.5 text-sm text-[#53615C] hover:text-[#13251F] transition-colors mt-1">
            <Clock className="w-4 h-4" aria-hidden />
            Data freshness
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-6 border-b border-[#E5E1D8]">
          <span className="flex items-center gap-1.5 text-[10px] text-[#7D8782] uppercase tracking-widest font-medium mr-1">
            <Filter className="w-3 h-3" aria-hidden />
            Filter
          </span>

          {leagues.map((l) => (
            <button
              key={l}
              onClick={() => setActiveLeague(l)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                activeLeague === l
                  ? "bg-[#13251F] text-white border-[#13251F]"
                  : "bg-transparent text-[#53615C] border-[#D8D5CC] hover:border-[#BFC4BE] hover:text-[#13251F]"
              }`}
            >
              {l}
            </button>
          ))}

          <div className="w-px h-4 bg-[#D8D5CC] mx-1" />

          {markets.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMarket(m)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                activeMarket === m
                  ? "bg-[#13251F] text-white border-[#13251F]"
                  : "bg-transparent text-[#53615C] border-[#D8D5CC] hover:border-[#BFC4BE] hover:text-[#13251F]"
              }`}
            >
              {m}
            </button>
          ))}

          <div className="w-px h-4 bg-[#D8D5CC] mx-1" />

          {tiers.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTier(t)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                activeTier === t
                  ? "bg-[#13251F] text-white border-[#13251F]"
                  : "bg-transparent text-[#53615C] border-[#D8D5CC] hover:border-[#BFC4BE] hover:text-[#13251F]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Fixture list */}
        <div className="space-y-3">
          {fixtures.map((fixture) => {
            const isExpanded = expandedId === fixture.id;
            const isSaved = savedIds.has(fixture.id);
            const { HomeCrest, AwayCrest } = fixture;

            return (
              <article key={fixture.id} className="bg-[#FBF9F4] border border-[#D8D5CC] rounded-lg overflow-hidden">
                {/* Collapsed row */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-[#F6F3EC] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? "" : fixture.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`fixture-${fixture.id}`}
                >
                  <span className="text-[10px] uppercase tracking-widest text-[#7D8782] font-medium w-10 shrink-0">
                    {fixture.leagueCode}
                  </span>

                  {/* Teams */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HomeCrest size={28} />
                      <span className="font-medium text-[#13251F] text-sm leading-none">{fixture.home}</span>
                    </div>
                    <span className="text-[#BFC4BE] text-xs font-mono">vs</span>
                    <div className="flex items-center gap-2">
                      <AwayCrest size={28} />
                      <span className="font-medium text-[#13251F] text-sm leading-none">{fixture.away}</span>
                    </div>
                  </div>

                  {/* Kickoff */}
                  <span className="hidden xl:block text-[11px] text-[#7D8782] font-mono shrink-0 w-40">
                    {fixture.kickoff}
                  </span>

                  {/* Market pill */}
                  <span className="hidden md:inline text-[11px] text-[#53615C] border border-[#D8D5CC] px-2 py-0.5 rounded bg-[#F6F3EC] shrink-0 font-mono">
                    {fixture.marketCode}
                  </span>

                  {/* Confidence + tier */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={`font-mono font-bold text-lg tabular-nums leading-none ${tierScoreColor(fixture.tierKey)}`}
                      >
                        {fixture.confidence}
                      </div>
                      <div className="text-[9px] text-[#7D8782] uppercase tracking-wider mt-0.5 whitespace-nowrap">
                        {fixture.tier}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#0E6B4F] bg-[#EAF3ED] px-1.5 py-0.5 rounded font-mono">
                        {fixture.signals}s
                      </span>
                      <span className="text-[10px] text-[#A96E12] bg-[#FBF2DF] px-1.5 py-0.5 rounded font-mono">
                        {fixture.counterSignals}c
                      </span>
                    </div>
                  </div>

                  <div className="ml-1 text-[#7D8782] shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded: Arsenal vs Chelsea (full evidence) */}
                <AnimatePresence initial={false}>
                  {isExpanded && fixture.id === "ars-che" && (
                    <motion.div
                      id={`fixture-${fixture.id}`}
                      key="expanded-main"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[#E5E1D8] px-5 py-6 lg:px-8 lg:py-8">

                        {/* 1. Fixture identity */}
                        <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-10">
                          <div className="flex-1">
                            <p className="text-[11px] uppercase tracking-widest text-[#7D8782] font-medium mb-3">
                              {fixture.league} &nbsp;·&nbsp; {fixture.kickoff} &nbsp;·&nbsp; {fixture.venue}
                            </p>
                            <div className="flex items-center gap-5 mb-5">
                              <div className="flex flex-col items-center gap-2">
                                <HomeCrest size={52} />
                                <span className="text-xs text-[#53615C] font-medium">{fixture.home}</span>
                              </div>
                              <span className="text-[#BFC4BE] text-sm font-mono">vs</span>
                              <div className="flex flex-col items-center gap-2">
                                <AwayCrest size={52} />
                                <span className="text-xs text-[#53615C] font-medium">{fixture.away}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs border border-[#D8D5CC] px-3 py-1 rounded bg-[#F6F3EC] text-[#53615C]">
                                Qualified market:{" "}
                                <span className="font-semibold text-[#13251F]">{fixture.market}</span>
                              </span>
                              <span className="text-[11px] text-[#7D8782] font-mono">
                                Data: {fixture.updatedAt} &nbsp;·&nbsp; Model {fixture.modelVersion}
                              </span>
                            </div>
                          </div>

                          {/* 2. Confidence panel */}
                          <div className="lg:w-68 shrink-0 bg-[#F6F3EC] border border-[#E5E1D8] rounded-lg p-5">
                            <p className="text-[10px] uppercase tracking-widest text-[#7D8782] font-medium mb-3">
                              Confidence
                            </p>
                            <div className="flex items-end gap-3 mb-3">
                              <span
                                className="font-mono font-bold text-[44px] text-[#0E6B4F] tabular-nums leading-none"
                                aria-label="Confidence score 78"
                              >
                                {fixture.confidence}
                              </span>
                              <div className="mb-1.5">
                                <TierBadge tierKey={fixture.tierKey} />
                                <div className="text-[11px] text-[#7D8782] mt-1">Evidence agreement</div>
                              </div>
                            </div>
                            {/* Meter */}
                            <div className="h-1.5 bg-[#D8D5CC] rounded-full mb-4" role="meter" aria-valuenow={fixture.confidence} aria-valuemin={0} aria-valuemax={100}>
                              <div
                                className="h-full bg-[#0E6B4F] rounded-full"
                                style={{ width: `${fixture.confidence}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <div className="font-mono font-semibold text-sm text-[#0E6B4F] tabular-nums">
                                  {fixture.signals}
                                </div>
                                <div className="text-[10px] text-[#7D8782] uppercase tracking-wider mt-0.5">
                                  Supporting
                                </div>
                              </div>
                              <div>
                                <div className="font-mono font-semibold text-sm text-[#A96E12] tabular-nums">
                                  {fixture.counterSignals}
                                </div>
                                <div className="text-[10px] text-[#7D8782] uppercase tracking-wider mt-0.5">
                                  Counter
                                </div>
                              </div>
                              <div>
                                <div className="font-mono font-semibold text-sm text-[#53615C] tabular-nums">
                                  {fixture.sample}
                                </div>
                                <div className="text-[10px] text-[#7D8782] uppercase tracking-wider mt-0.5">
                                  Sample
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[#E5E1D8] flex items-center justify-between">
                              <span className="text-[10px] text-[#7D8782] font-mono">
                                Updated {fixture.updatedAt}
                              </span>
                              <button className="text-[11px] text-[#0E6B4F] hover:underline flex items-center gap-1 transition-colors">
                                Inspect <ExternalLink className="w-3 h-3" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3. Supporting evidence */}
                        <section aria-label="Supporting evidence" className="mb-8">
                          <h2 className="text-[11px] uppercase tracking-widest text-[#7D8782] font-medium mb-5">
                            Supporting Evidence
                          </h2>
                          <div className="space-y-7">
                            {evidenceGroups.map((group) => (
                              <div key={group.id}>
                                {/* Group label */}
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="text-[10px] uppercase tracking-wider text-[#53615C] font-semibold">
                                    {group.label}
                                  </span>
                                  <div className="flex-1 h-px bg-[#E5E1D8]" />
                                </div>

                                <div className="space-y-5">
                                  {group.items.map((item, i) => (
                                    <div key={i} className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-2">
                                      <div>
                                        <div className="flex items-start gap-2 mb-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-[#0E6B4F] mt-[5px] shrink-0" />
                                          <div className="flex-1">
                                            <span className="text-sm font-medium text-[#13251F]">
                                              {item.observation}
                                            </span>
                                            <span className="text-sm text-[#7D8782] mx-1.5">—</span>
                                            <span className="text-sm font-mono font-semibold text-[#0E6B4F] tabular-nums">
                                              {item.metric}
                                            </span>
                                            <span className="text-sm text-[#53615C] ml-1.5">
                                              {item.metricLabel}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="pl-3.5">
                                          <EvidenceBar rate={item.rate} threshold={item.threshold} />
                                          <div className="flex items-center justify-between mt-1">
                                            <span className="text-[11px] text-[#0E6B4F]">
                                              {item.comparisonLabel}
                                            </span>
                                            <span className="text-[11px] text-[#7D8782]">
                                              {item.thresholdLabel}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="pl-3.5 lg:pl-0 flex lg:flex-col items-start lg:items-end gap-2 lg:gap-1 pt-1">
                                        <span className="text-[11px] text-[#7D8782]">
                                          Source: {item.source}
                                        </span>
                                        <span className="text-[11px] text-[#7D8782]">{item.sample}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* 4. Counter-evidence */}
                        <section aria-label="Counter-evidence" className="mb-8">
                          <h2 className="text-[11px] uppercase tracking-widest text-[#A96E12] font-medium mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                            Counter-Evidence
                          </h2>
                          <div className="bg-[#FBF2DF] border border-[#A96E12]/20 rounded-lg divide-y divide-[#A96E12]/10">
                            {counterEvidence.map((ce) => (
                              <div key={ce.id} className="px-4 py-3.5">
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#A96E12] mt-[5px] shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="text-sm font-medium text-[#6B4608]">
                                        {ce.observation}
                                      </span>
                                      <span className="text-[10px] text-[#A96E12] font-mono shrink-0 mt-0.5">
                                        {ce.sample}
                                      </span>
                                    </div>
                                    <p className="text-sm text-[#8B5E0E] mt-1 leading-relaxed">{ce.detail}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* 5. Methodology (collapsible) */}
                        <section aria-label="Methodology" className="mb-8">
                          <button
                            onClick={() => setMethodologyOpen((o) => !o)}
                            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#53615C] font-medium hover:text-[#13251F] transition-colors"
                            aria-expanded={methodologyOpen}
                          >
                            <Info className="w-3.5 h-3.5" aria-hidden />
                            Methodology
                            {methodologyOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <AnimatePresence>
                            {methodologyOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 p-4 bg-[#F6F3EC] border border-[#E5E1D8] rounded-lg">
                                  <p className="text-sm text-[#53615C] leading-relaxed">
                                    This signal was generated by the RankWagers qualification engine v2.4.1
                                    using thresholds derived from a three-season Premier League baseline.
                                    Both Teams to Score qualification requires a combined xG ≥ 2.80 per 90
                                    and a scoring rate ≥ 70% in at least one team's recent home or away
                                    record. Counter-evidence is systematically collected and weighted but does
                                    not automatically disqualify a fixture. Confidence reflects agreement
                                    across independent evidence groups, not outcome probability.
                                  </p>
                                  <button className="mt-3 text-[12px] text-[#0E6B4F] hover:underline flex items-center gap-1 transition-colors">
                                    View full methodology <ExternalLink className="w-3 h-3" aria-hidden />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </section>

                        {/* 6. Operator comparison — secondary, after all evidence */}
                        <section
                          aria-label="Operator comparison"
                          className="border-t border-[#E5E1D8] pt-6"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
                            <h2 className="text-[11px] uppercase tracking-widest text-[#7D8782] font-medium">
                              Research Record — Operator Comparison
                            </h2>
                            <span className="text-[11px] text-[#7D8782]">
                              Statistical edge = model probability − implied probability. Not expected profit.
                            </span>
                          </div>
                          <div className="border border-[#D8D5CC] rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-[#F6F3EC] border-b border-[#E5E1D8]">
                                  {["Operator", "Odds", "Implied", "Stat. edge", "Updated", ""].map(
                                    (col, i) => (
                                      <th
                                        key={col + i}
                                        scope="col"
                                        className={`px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#7D8782] font-medium ${i === 0 ? "text-left" : i === 5 ? "" : "text-right"}`}
                                      >
                                        {col}
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E5E1D8]">
                                {operators.map((op) => (
                                  <tr
                                    key={op.name}
                                    className="hover:bg-[#F6F3EC] transition-colors"
                                  >
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-[#13251F]">{op.name}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#13251F]">
                                      {op.odds}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#53615C]">
                                      {op.implied}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0E6B4F]">
                                      {op.edge}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[11px] text-[#7D8782] font-mono">
                                      {op.updated}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button className="text-[11px] text-[#53615C] hover:text-[#0E6B4F] border border-[#D8D5CC] hover:border-[#0E6B4F] px-2 py-1 rounded transition-colors">
                                        View record
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[11px] text-[#7D8782] mt-3 leading-relaxed">
                            Operator availability varies by jurisdiction. Licensing status has not been
                            independently verified for all operators in all regions. This comparison is a
                            research record, not a recommendation.
                          </p>
                        </section>

                        {/* Footer actions */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E5E1D8]">
                          <button
                            onClick={() => toggleSave(fixture.id)}
                            className="flex items-center gap-1.5 text-sm text-[#53615C] hover:text-[#13251F] transition-colors"
                            aria-pressed={isSaved}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkCheck className="w-4 h-4 text-[#0E6B4F]" aria-hidden />
                                <span className="text-[#0E6B4F]">Saved to research notes</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-4 h-4" aria-hidden />
                                Save to research notes
                              </>
                            )}
                          </button>
                          <button className="text-sm text-[#0E6B4F] hover:underline flex items-center gap-1.5 transition-colors">
                            View full match detail{" "}
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Expanded stubs for other fixtures */}
                  {isExpanded && fixture.id !== "ars-che" && (
                    <motion.div
                      id={`fixture-${fixture.id}`}
                      key="expanded-stub"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[#E5E1D8] px-5 py-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                          <div>
                            <p className="text-[11px] uppercase tracking-widest text-[#7D8782] font-medium mb-1">
                              {fixture.league} &nbsp;·&nbsp; {fixture.kickoff} &nbsp;·&nbsp; {fixture.venue}
                            </p>
                            <p className="text-sm text-[#53615C]">
                              Qualified market:{" "}
                              <span className="font-semibold text-[#13251F]">{fixture.market}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono font-bold text-3xl tabular-nums leading-none ${tierScoreColor(fixture.tierKey)}`}
                            >
                              {fixture.confidence}
                            </span>
                            <div>
                              <TierBadge tierKey={fixture.tierKey} />
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-[#0E6B4F] bg-[#EAF3ED] px-1.5 py-0.5 rounded font-mono">
                                  {fixture.signals}s
                                </span>
                                <span className="text-[10px] text-[#A96E12] bg-[#FBF2DF] px-1.5 py-0.5 rounded font-mono">
                                  {fixture.counterSignals}c
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-[#F6F3EC] border border-[#E5E1D8] rounded-lg text-center">
                          <p className="text-sm text-[#7D8782]">
                            Full evidence analysis for this fixture is being prepared.
                          </p>
                          <p className="text-[11px] text-[#7D8782] mt-1 font-mono">
                            {fixture.signals} supporting signals &nbsp;·&nbsp; {fixture.counterSignals} counter-evidence indicators
                            &nbsp;·&nbsp; Sample: {fixture.sample} matches &nbsp;·&nbsp; Updated {fixture.updatedAt}
                          </p>
                        </div>
                        <div className="flex items-center justify-end mt-4">
                          <button className="text-sm text-[#0E6B4F] hover:underline flex items-center gap-1.5 transition-colors">
                            View full match detail <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>

        {/* Methodology note */}
        <div className="mt-10 pt-8 border-t border-[#E5E1D8]">
          <p className="text-[12px] text-[#7D8782] leading-relaxed max-w-2xl">
            Qualified fixtures are identified by the RankWagers qualification engine using statistical
            thresholds, historical match data, and market signals. Confidence scores reflect evidence
            agreement, not outcome probability. Counter-evidence is systematically collected and displayed.
            No qualification constitutes a recommendation to place a wager.{" "}
            <a href="#" className="text-[#0E6B4F] hover:underline">
              Read the full methodology →
            </a>
          </p>
        </div>

        {/* Disclosure */}
        <div className="mt-4 pb-16">
          <p className="text-[11px] text-[#7D8782] leading-relaxed max-w-2xl">
            RankWagers presents statistical evidence and operator comparison for informational purposes
            only. It does not guarantee outcomes. Statistical edge is calculated from model probability
            minus implied probability and does not represent expected profit. Gambling involves financial
            risk. Please refer to applicable regulations and operator terms before acting on any
            information presented here.
          </p>
        </div>
      </main>
    </div>
  );
}
