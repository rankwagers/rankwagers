import type { Brand } from "./brands";

const DEFAULT_PAYMENTS = [
  "Bitcoin (BTC)",
  "USDT",
  "Visa / Mastercard",
  "Skrill",
  "Neteller",
];

const DEFAULT_LICENSES = ["Curaçao eGaming"];

/** First-deposit welcome lines for key affiliate markets (ISO alpha-2). */
function marketFtd(pct: string, cap: string): Record<string, string> {
  return {
    NG: `${pct} up to ₦150,000 on first deposit`,
    GH: `${pct} up to ₵2,500 on first deposit`,
    ZA: `${pct} up to R3,000 welcome on FTD`,
    BR: `${pct} até ${cap} no 1º depósito`,
    FR: `${pct} jusqu'à ${cap} (1er dépôt)`,
    PE: `${pct} hasta S/500 en primer depósito`,
    MX: `${pct} hasta $3,000 en primer depósito`,
    DE: `${pct} bis zu ${cap} Willkommensbonus`,
    IT: `${pct} fino a ${cap} sul primo deposito`,
    MA: `${pct} بونص ترحيبي للإيداع الأول`,
    KW: `${pct} بونص أول إيداع`,
    US: `${pct} welcome up to ${cap} on first deposit`,
    CA: `${pct} welcome up to ${cap} on first deposit`,
  };
}

const FTD_FAQ = (name: string, bonusHint: string) => [
  {
    q: `Is ${name} legit and safe?`,
    a: `${name} operates under international gaming licences and uses SSL encryption for payments and account data.`,
  },
  {
    q: `What welcome bonus does ${name} offer?`,
    a: `${bonusHint} Exact amounts and wagering depend on your country — the offer shown on this page or at registration is indicative.`,
  },
  {
    q: `Does ${name} accept crypto?`,
    a: `Yes — ${name} supports cryptocurrency deposits alongside cards and e-wallets in most supported regions.`,
  },
  {
    q: `How do I claim the first-deposit bonus at ${name}?`,
    a: `Open an account via our link, complete registration, opt in to the welcome offer if prompted, then make a qualifying first deposit. The bonus is credited per the operator's terms for your region.`,
  },
];

function reviewPack(
  name: string,
  opts: {
    rating: number;
    description: string;
    pros: string[];
    cons: string[];
    founded?: string;
    localizedCap?: string;
    localizedBonus?: Record<string, string>;
  }
): Partial<Brand> {
  const r = opts.rating;
  const scores = {
    bonus: Math.min(10, r * 2 - 0.5),
    odds: Math.min(10, r * 2 - 0.8),
    payments: Math.min(10, r * 2),
    app: Math.min(10, r * 2 - 1),
    support: Math.min(10, r * 2 - 1.2),
  };
  const cap = opts.localizedCap ?? "€150";
  return {
    description: opts.description,
    founded: opts.founded ?? "2018",
    minDeposit: "from €1 / ~$1 (crypto or e-wallet where available)",
    payoutTime: "Crypto: often within hours • E-wallets: up to 24–48h",
    payments: DEFAULT_PAYMENTS,
    licenses: DEFAULT_LICENSES,
    pros: opts.pros,
    cons: opts.cons,
    localizedBonus: opts.localizedBonus ?? marketFtd("100%", cap),
    scores,
    faq: FTD_FAQ(
      name,
      "New players usually get a first-deposit (FTD) matched welcome; see the headline offer on this page."
    ),
  };
}

export const BRAND_DETAILS: Record<string, Partial<Brand>> = {
  "bet-and-you": reviewPack("Bet&You", {
    rating: 4.8,
    description:
      "Bet&You is a full sportsbook and casino with crypto-friendly banking. The standard offer is a matched first-deposit welcome bonus on sports or casino, with amounts set by your country at registration.",
    pros: ["Strong sports & casino mix", "Crypto deposits", "24/7 live chat"],
    cons: ["Wagering applies to welcome offers", "Some markets restricted"],
    founded: "2019",
    localizedCap: "€130",
  }),
  melbet: reviewPack("Melbet", {
    rating: 4.7,
    description:
      "Melbet is a major international bookmaker with deep pre-match and live lines, esports and quick signup. The flagship FTD promotion is a 100% sports welcome bonus up to a regional cap.",
    pros: ["Huge event coverage", "Live betting & streams", "Low minimum deposit"],
    cons: ["Busy interface for beginners", "Bonus caps vary by country"],
    founded: "2012",
    localizedCap: "€100",
  }),
  megapari: reviewPack("Megapari", {
    rating: 4.7,
    description:
      "Megapari combines sports, casino and live dealers. New users can access a large welcome package on the first deposit (sports and/or casino tiers), often including free spins on casino routes.",
    pros: ["Casino + sports combo", "Large welcome package", "Crypto-friendly"],
    cons: ["High welcome packages have wagering", "KYC on larger withdrawals"],
    founded: "2019",
    localizedCap: "€1,500",
    localizedBonus: {
      ...marketFtd("100%", "€1,500"),
      NG: "100% up to ₦200,000 welcome package on FTD",
      BR: "Pacote de boas-vindas até €1,500 no 1º depósito",
    },
  }),
  fansport: reviewPack("FanSport", {
    rating: 4.6,
    description:
      "FanSport is sports-first: competitive football and tennis odds, mobile-friendly bet slip and a straightforward 100% first-deposit sports welcome in most regions.",
    pros: ["Sports-first platform", "Competitive odds", "Lightweight app"],
    cons: ["Smaller casino section", "Fewer niche sports"],
    founded: "2020",
    localizedCap: "€100",
  }),
  topbet: reviewPack("TopBet", {
    rating: 4.6,
    description:
      "TopBet offers easy registration, live casino and a tiered welcome on first deposit — often up to €500 for combined sports and casino, depending on your location.",
    pros: ["Fast registration", "Live casino", "Clear promotions page"],
    cons: ["Limited streaming", "Support hours vary"],
    localizedCap: "€500",
  }),
  dbbet: reviewPack("DBBet", {
    rating: 4.5,
    description:
      "DBBet mixes sports, slots and instant games with low entry deposits. New accounts usually qualify for a 100% first-deposit bonus on the sports or casino product you select at signup.",
    pros: ["Low min deposit", "Sports + slots", "Quick withdrawals"],
    cons: ["Newer brand vs giants", "Regional bonus caps"],
    founded: "2021",
    localizedCap: "€150",
  }),
  bizbet: reviewPack("Bizbet", {
    rating: 4.5,
    description:
      "Bizbet covers wide in-play markets and regular promos. First-time depositors can claim a standard matched welcome bonus; percentage and cap are confirmed in the cashier for your country.",
    pros: ["In-play focus", "Promo calendar", "Multi-sport coverage"],
    cons: ["Casino smaller than specialists", "Terms vary by locale"],
    founded: "2020",
    localizedCap: "€150",
  }),
  betroller: reviewPack("Betroller", {
    rating: 4.4,
    description:
      "Betroller pairs casino and sportsbook with VIP rewards. The FTD offer is typically a matched deposit welcome on first funding, plus ongoing reload deals for active players.",
    pros: ["VIP programme", "Casino variety", "Crypto options"],
    cons: ["VIP tiers need volume", "Sports depth moderate"],
    founded: "2021",
    localizedCap: "€150",
  }),
  wepari: reviewPack("WePari", {
    rating: 4.4,
    description:
      "WePari targets mobile users with clean UX and live betting. New players see a 100% first-deposit welcome up to roughly €200 (or local equivalent) after registration.",
    pros: ["Modern UI", "Fast KYC", "Live betting"],
    cons: ["Fewer legacy features", "Regional payment gaps"],
    founded: "2022",
    localizedCap: "€200",
  }),
  "888starz": reviewPack("888Starz", {
    rating: 4.3,
    description:
      "888Starz is crypto-oriented: sports and casino under one wallet, token-style loyalty and a welcome package on first deposit (often 100% match plus free bet or spin elements).",
    pros: ["Crypto-first", "Loyalty rewards", "Sports + casino"],
    cons: ["Less fiat focus", "Reward rules can be detailed"],
    founded: "2020",
    localizedCap: "€300",
    localizedBonus: {
      ...marketFtd("100%", "€300"),
      NG: "Crypto welcome package on first deposit",
      BR: "Pacote cripto de boas-vindas no 1º depósito",
    },
  }),
  betwinner: reviewPack("Betwinner", {
    rating: 4.3,
    description:
      "Betwinner is a global bookmaker with streaming on top events and broad payments. The usual FTD deal is 100% on the first deposit up to about €100, or local currency equivalent.",
    pros: ["Live streaming", "Global coverage", "Many payments"],
    cons: ["Standard wagering on welcome", "Busy desktop layout"],
    founded: "2018",
    localizedCap: "€100",
  }),
  paripulse: reviewPack("PariPulse", {
    rating: 4.2,
    description:
      "PariPulse is a newer sports and casino brand with crypto support. New users are offered a first-deposit welcome bonus — typically a 100% match up to a modest regional cap.",
    pros: ["Modern platform", "Crypto payments", "Sports & casino"],
    cons: ["Smaller market depth", "Fewer long-term promos"],
    founded: "2023",
    localizedCap: "€100",
  }),
};

export function applyBrandDetails(brands: Brand[]): Brand[] {
  return brands.map((b) => ({
    ...b,
    ...(BRAND_DETAILS[b.slug] ?? {}),
  }));
}
