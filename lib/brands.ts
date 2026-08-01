import { applyBrandDetails } from "./brandDetails";

export type Brand = {
  slug: string;
  name: string;
  // Affiliate çıkış URL'i. {subid} yer tutucusu tıklama kaynağıyla doldurulur.
  affiliateUrl: string;
  bonus: string;
  rating: number; // 0-5
  // /public altındaki logo yolu (ör. "/brands/1xbet.svg"). Yoksa baş harf rozeti.
  logo?: string;
  // Bu brand'in kabul ettiği ülkeler (ISO alpha-2). Boş => tümü.
  acceptedCountries?: string[];
  highlights: string[];
  crypto: boolean;
  // Opsiyonel detaylar (inceleme sayfasında "quick facts" olarak gösterilir).
  description?: string;
  founded?: string;
  minDeposit?: string;
  payoutTime?: string;
  payments?: string[];
  licenses?: string[];
  pros?: string[];
  cons?: string[];
  // FTD / dönüşüm alanları
  promoCode?: string;
  // Ülkeye göre yerel para birimiyle bonus (ISO alpha-2 -> metin).
  localizedBonus?: Record<string, string>;
  scores?: {
    bonus: number;
    odds: number;
    payments: number;
    app: number;
    support: number;
  };
  faq?: { q: string; a: string }[];
};

// affiliateUrl: partner kayıt linki + {subid} tıklama takibi (buildAffiliateUrl).
export const BRANDS: Brand[] = applyBrandDetails([
  {
    slug: "1xbet",
    name: "1xBet",
    logo: "/brands/1xbet.png",
    // Gerçek 1xBet (reffpa) affiliate linki. {subid} bizim tıklama takibimiz için.
    affiliateUrl:
      "https://reffpa.com/L?tag=d_5713800m_97c_&site=5713800&ad=97&subid={subid}",
    bonus: "100% up to €130 welcome on first deposit",
    rating: 4.9,
    highlights: [
      "1000+ sports markets daily",
      "Crypto & 50+ payment methods",
      "Live streaming & cash out",
      "Fast crypto withdrawals",
      "Award-winning mobile app",
    ],
    crypto: true,
    description:
      "1xBet is one of the world's largest sportsbooks and crypto betting sites, offering thousands of daily markets, in-play betting, live streaming and one of the widest payment ranges in the industry — including Bitcoin, USDT and many other cryptocurrencies. New players get a 100% welcome bonus on their first deposit.",
    founded: "2007",
    minDeposit: "€1 / ~$1 in crypto",
    payoutTime: "Crypto: minutes • E-wallets: up to 24h",
    payments: [
      "Bitcoin (BTC)",
      "Tether (USDT)",
      "Ethereum (ETH)",
      "Visa / Mastercard",
      "Skrill",
      "Neteller",
    ],
    licenses: ["Curaçao eGaming"],
    pros: [
      "Huge sportsbook with 1000+ markets",
      "Wide crypto & payment support",
      "Live streaming and cash out",
      "Generous welcome bonus",
    ],
    cons: ["Bonus wagering requirements apply", "Not available in all countries"],
    localizedBonus: {
      NG: "100% up to ₦150,000 on first deposit",
      GH: "100% up to ₵2,500 on first deposit",
      ZA: "100% up to R3,000 welcome on FTD",
      BR: "100% até R$1.200 no 1º depósito",
      FR: "100% jusqu'à 130€ (1er dépôt)",
      PE: "100% hasta S/430 en primer depósito",
      MX: "100% hasta $2,600 en primer depósito",
      MA: "100% بونص أول إيداع",
      KW: "100% بونص ترحيبي للإيداع الأول",
      DE: "100% bis zu 130€ Willkommensbonus",
      US: "100% welcome up to $130 on first deposit",
      CA: "100% welcome up to $130 on first deposit",
    },
    scores: { bonus: 9.5, odds: 9.0, payments: 9.8, app: 9.2, support: 8.8 },
    faq: [
      {
        q: "Is 1xBet a safe and legit betting site?",
        a: "Yes. 1xBet operates under a Curaçao eGaming license, uses SSL encryption and has paid out millions of players worldwide since 2007.",
      },
      {
        q: "What is the minimum deposit at 1xBet?",
        a: "You can start with as little as €1 (or roughly $1 in crypto), one of the lowest minimums in the industry.",
      },
      {
        q: "How long do crypto withdrawals take?",
        a: "Crypto withdrawals are usually processed within minutes. E-wallets and cards can take up to 24 hours.",
      },
      {
        q: "How do I claim the 1xBet welcome bonus?",
        a: "Register through our link, complete sign-up, select the sports or casino welcome if asked, then make a qualifying first deposit. The 100% FTD bonus is applied per 1xBet rules for your country.",
      },
    ],
  },
  {
    slug: "bet-and-you",
    name: "Bet&You",
    logo: "/brands/bet-and-you.png",
    affiliateUrl:
      "https://refpa19084.pro/L?tag=d_5714321m_15787c_&site=5714321&ad=15787&r=registration/&subid={subid}",
    bonus: "100% up to €130 on first deposit",
    rating: 4.8,
    highlights: ["Sports & casino", "Crypto deposits", "24/7 support"],
    crypto: true,
  },
  {
    slug: "melbet",
    name: "Melbet",
    affiliateUrl:
      "https://refpa3665.com/L?tag=d_5714326m_18757c_&site=5714326&ad=18757&r=registration/&subid={subid}",
    bonus: "100% up to €100 welcome bonus",
    rating: 4.7,
    highlights: ["Huge sportsbook", "Live betting", "Fast payouts"],
    crypto: true,
  },
  {
    slug: "megapari",
    name: "Megapari",
    logo: "/brands/megapari.png",
    affiliateUrl:
      "https://refpazitag.top/L?tag=d_5714334m_25437c_&site=5714334&ad=25437&r=registration/&subid={subid}",
    bonus: "Welcome package up to €1,500 on first deposit",
    rating: 4.7,
    highlights: ["Casino & sports", "Crypto-friendly", "Weekly promos"],
    crypto: true,
  },
  {
    slug: "fansport",
    name: "FanSport",
    logo: "/brands/fansport.png",
    affiliateUrl:
      "https://lxzsdfgw.xyz/L?tag=d_5714345m_126304c_&site=5714345&ad=126304&r=registration/&subid={subid}",
    bonus: "100% sports welcome on first deposit",
    rating: 4.6,
    highlights: ["Sports-focused", "Competitive odds", "Mobile app"],
    crypto: true,
  },
  {
    slug: "topbet",
    name: "TopBet",
    logo: "/brands/topbet.png",
    affiliateUrl:
      "https://uikljhlytujyuk.xyz/L?tag=d_5714352m_129196c_&site=5714352&ad=129196&r=registration/&subid={subid}",
    bonus: "Up to €500 welcome on first deposit",
    rating: 4.6,
    highlights: ["Easy signup", "Multiple payments", "Live casino"],
    crypto: true,
  },
  {
    slug: "dbbet",
    name: "DBBet",
    logo: "/brands/dbbet.png",
    affiliateUrl:
      "https://refpa96317.com/L?tag=d_5714349m_72325c_&site=5714349&ad=72325&r=registration/&subid={subid}",
    bonus: "100% matched bonus on first deposit",
    rating: 4.5,
    highlights: ["Sports & slots", "Low min deposit", "Quick withdrawals"],
    crypto: true,
  },
  {
    slug: "bizbet",
    name: "Bizbet",
    logo: "/brands/bizbet.png",
    affiliateUrl:
      "https://refpa80613.pro/L?tag=d_2574597m_62079c_&site=2574597&ad=62079&r=registration/&subid={subid}",
    bonus: "100% welcome on first deposit",
    rating: 4.5,
    highlights: ["Wide market coverage", "In-play betting", "Promo offers"],
    crypto: true,
  },
  {
    slug: "betroller",
    name: "Betroller",
    logo: "/brands/betroller.png",
    affiliateUrl:
      "https://btrllrlink.xyz/L?tag=d_5714343m_65731c_&site=5714343&ad=65731&r=registration/&subid={subid}",
    bonus: "100% matched welcome on first deposit",
    rating: 4.4,
    highlights: ["Casino & sportsbook", "VIP rewards", "Crypto options"],
    crypto: true,
  },
  {
    slug: "wepari",
    name: "WePari",
    logo: "/brands/wepari.png",
    affiliateUrl:
      "https://refpa59139.com/L?tag=d_5714348m_118422c_&site=5714348&ad=118422&r=registration/&subid={subid}",
    bonus: "100% up to €200 welcome bonus",
    rating: 4.4,
    highlights: ["Modern platform", "Fast registration", "Live betting"],
    crypto: true,
  },
  {
    slug: "888starz",
    name: "888Starz",
    logo: "/brands/888starz.png",
    affiliateUrl:
      "https://top100bonus.com/L?tag=d_5714385m_64133c_&site=5714385&ad=64133&subid={subid}",
    bonus: "100% welcome package on first deposit (crypto)",
    rating: 4.3,
    highlights: ["Crypto-first", "Sports & casino", "Loyalty program"],
    crypto: true,
  },
  {
    slug: "betwinner",
    name: "Betwinner",
    logo: "/brands/betwinner.png",
    affiliateUrl:
      "https://bwref-zxzq9fsn.com/14ZT?p=%2Fregistration%2F&subid={subid}",
    bonus: "100% up to €100 on first deposit",
    rating: 4.3,
    highlights: ["Global sportsbook", "Live streaming", "Many payment methods"],
    crypto: true,
  },
  {
    slug: "paripulse",
    name: "PariPulse",
    logo: "/brands/paripulse.png",
    affiliateUrl:
      "https://refpa00186.com/L?tag=d_5714350m_64499c_&site=5714350&ad=64499&r=registration/&subid={subid}",
    bonus: "100% welcome on first deposit",
    rating: 4.2,
    highlights: ["Sports & casino", "Modern platform", "Crypto payments"],
    crypto: true,
  },
]);

export function getBrand(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug);
}

export function brandsForCountry(country: string | null | undefined): Brand[] {
  const cc = (country ?? "").toUpperCase();
  return BRANDS.filter(
    (b) => !b.acceptedCountries || (cc && b.acceptedCountries.includes(cc))
  );
}

export function bonusForCountry(
  brand: Brand,
  country: string | null | undefined
): string {
  const cc = (country ?? "").toUpperCase();
  if (cc && brand.localizedBonus && brand.localizedBonus[cc]) {
    return brand.localizedBonus[cc];
  }
  return brand.bonus;
}

export function buildAffiliateUrl(brand: Brand, subid: string): string {
  const safeSub = encodeURIComponent(subid || "direct");
  if (brand.affiliateUrl.includes("{subid}")) {
    return brand.affiliateUrl.replace("{subid}", safeSub);
  }
  const sep = brand.affiliateUrl.includes("?") ? "&" : "?";
  return `${brand.affiliateUrl}${sep}subid=${safeSub}`;
}
