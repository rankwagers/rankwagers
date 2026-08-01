import { siteBrand } from "../brand";
import type { Dictionary } from "../dictionaries";
import type { Locale } from "../i18n";

/** Ana site meta/nav — tam çeviri olmayan diller için EN üzerine katman */
function shell(
  tagline: string,
  homeTitle: string,
  homeDescription: string,
  nav: Dictionary["nav"],
  home: Pick<
    Dictionary["home"],
    "heroTitle" | "heroSubtitle" | "ctaTelegram" | "topListTitle" | "visit" | "review" | "bonusLabel" | "ratingLabel" | "topPick"
  >,
  blocked: Dictionary["blocked"],
  telegram: Dictionary["telegram"]
): Partial<Dictionary> {
  const brand = siteBrand();
  return {
    meta: {
      siteName: brand,
      tagline,
      homeTitle,
      homeDescription,
      bestBettingTitle: homeTitle,
      bestBettingDescription: homeDescription,
    },
    nav,
    home: {
      ...home,
      bettingHeroTitle: home.heroTitle,
      bettingHeroSubtitle: home.heroSubtitle,
    },
    telegram,
    blocked,
  };
}

const overlays: Partial<Record<Locale, Partial<Dictionary>>> = {
  it: shell(
    "Confronta i migliori siti di scommesse e crypto",
    "Migliori siti crypto — Recensioni, bonus e confronto",
    "Confronto indipendente dei migliori siti di scommesse e crypto. Bonus aggiornati e recensioni.",
    {
      bestCrypto: "Migliori siti crypto",
      bestBetting: "Migliori siti scommesse",
      bonuses: "Bonus",
      reviews: "Recensioni",
      guides: "Guide",
    },
    {
      heroTitle: "Trova i migliori siti crypto",
      heroSubtitle: "Selezionati e recensiti in modo indipendente. Confronta bonus e pagamenti.",
      ctaTelegram: "Canale bonus gratuito",
      topListTitle: "Siti top del mese",
      visit: "Visita sito",
      review: "Leggi recensione",
      bonusLabel: "Bonus di benvenuto",
      ratingLabel: "La nostra valutazione",
      topPick: "Scelta migliore",
    },
    {
      title: "Non disponibile nella tua regione",
      body: "Questo sito non è accessibile dalla tua posizione.",
    },
    {
      title: "Bonus giornalieri gratis su Telegram",
      body: "Codici promo, free spin e reload — ogni giorno sul canale.",
      button: "Apri canale Telegram",
    }
  ),
  nl: {
    ...shell(
    "Vergelijk de beste wed- en crypto-sites",
    "Beste crypto sites — Reviews, bonussen & vergelijking",
    "Onafhankelijke vergelijking van wed- en crypto-sites. Actuele bonussen en reviews.",
    {
      bestCrypto: "Beste crypto sites",
      bestBetting: "Beste wed sites",
      bonuses: "Bonussen",
      reviews: "Reviews",
      guides: "Gidsen",
    },
    {
      heroTitle: "Vind de beste crypto sites",
      heroSubtitle: "Handgepicked en onafhankelijk beoordeeld. Vergelijk bonussen en uitbetalingen.",
      ctaTelegram: "Gratis bonuskanaal",
      topListTitle: "Top sites deze maand",
      visit: "Bezoek site",
      review: "Lees review",
      bonusLabel: "Welkomstbonus",
      ratingLabel: "Onze score",
      topPick: "Topkeuze",
    },
    {
      title: "Niet beschikbaar in uw regio",
      body: "Deze site is niet toegankelijk vanaf uw locatie.",
    },
    {
      title: "Dagelijkse gratis bonussen op Telegram",
      body: "Exclusieve codes en reload — dagelijks op ons kanaal.",
      button: "Open Telegram-kanaal",
    }
  ),
    ageGate: {
      badge: "18+",
      title: "Ben je 18 jaar of ouder?",
      body: "Deze site bevat content over gokken en is alleen voor volwassenen. Je moet minimaal 18 jaar zijn om verder te gaan.",
      yes: "Ja, ik ben 18 of ouder",
      no: "Nee, site verlaten",
    },
  },
  pl: shell(
    "Porównaj najlepsze strony bukmacherskie i crypto",
    "Najlepsze strony crypto — Recenzje, bonusy i porównanie",
    "Niezależne porównanie stron bukmacherskich i crypto. Aktualne bonusy i recenzje.",
    {
      bestCrypto: "Najlepsze strony crypto",
      bestBetting: "Najlepsze strony bukmacherskie",
      bonuses: "Bonusy",
      reviews: "Recenzje",
      guides: "Poradniki",
    },
    {
      heroTitle: "Znajdź najlepsze strony crypto",
      heroSubtitle: "Wybrane i ocenione niezależnie. Porównaj bonusy i wypłaty.",
      ctaTelegram: "Darmowy kanał bonusów",
      topListTitle: "Top strony w tym miesiącu",
      visit: "Odwiedź stronę",
      review: "Czytaj recenzję",
      bonusLabel: "Bonus powitalny",
      ratingLabel: "Nasza ocena",
      topPick: "Najlepszy wybór",
    },
    {
      title: "Niedostępne w Twoim regionie",
      body: "Ta strona nie jest dostępna z Twojej lokalizacji.",
    },
    {
      title: "Darmowe codzienne bonusy na Telegram",
      body: "Ekskluzywne kody i reload — codziennie na kanale.",
      button: "Otwórz kanał Telegram",
    }
  ),
  sv: shell(
    "Jämför de bästa bettingsajterna och crypto",
    "Bästa crypto-sajter — Recensioner, bonusar & jämförelse",
    "Oberoende jämförelse av betting- och crypto-sajter. Uppdaterade bonusar.",
    {
      bestCrypto: "Bästa crypto-sajter",
      bestBetting: "Bästa bettingsajter",
      bonuses: "Bonusar",
      reviews: "Recensioner",
      guides: "Guider",
    },
    {
      heroTitle: "Hitta de bästa crypto-sajterna",
      heroSubtitle: "Handplockade och oberoende granskade. Jämför bonusar och uttag.",
      ctaTelegram: "Gratis bonuskanal",
      topListTitle: "Toppsajter denna månad",
      visit: "Besök sajt",
      review: "Läs recension",
      bonusLabel: "Välkomstbonus",
      ratingLabel: "Vår betyg",
      topPick: "Topval",
    },
    {
      title: "Ej tillgänglig i din region",
      body: "Denna webbplats är inte tillgänglig från din plats.",
    },
    {
      title: "Dagliga gratisbonusar på Telegram",
      body: "Exklusiva koder och reload — dagligen på kanalen.",
      button: "Öppna Telegram-kanal",
    }
  ),
  ja: shell(
    "最高のブックメーカーと暗号資産サイトを比較",
    "最高の暗号資産ブックメーカー — レビュー・ボーナス・比較",
    "ブックメーカーと暗号資産サイトの独立比較。最新ボーナスと専門レビュー。",
    {
      bestCrypto: "暗号資産ブックメーカー",
      bestBetting: "ブックメーカー",
      bonuses: "ボーナス",
      reviews: "レビュー",
      guides: "ガイド",
    },
    {
      heroTitle: "最高の暗号資産サイトを探す",
      heroSubtitle: "厳選・独立評価。ボーナスと出金を一括比較。",
      ctaTelegram: "無料ボーナスチャンネル",
      topListTitle: "今月のトップサイト",
      visit: "サイトへ",
      review: "レビューを読む",
      bonusLabel: "ウェルカムボーナス",
      ratingLabel: "当社評価",
      topPick: "おすすめ",
    },
    {
      title: "お住まいの地域では利用できません",
      body: "このサイトは現在地からアクセスできません。",
    },
    {
      title: "Telegramで毎日無料ボーナス",
      body: "限定コードとリロード — チャンネルで毎日配信。",
      button: "Telegramチャンネルを開く",
    }
  ),
  hi: shell(
    "सर्वश्रेष्ठ बेटिंग और क्रिप्टो साइटें तुलना करें",
    "सर्वश्रेष्ठ क्रिप्टो बेटिंग — समीक्षा, बोनस और तुलना",
    "बेटिंग और क्रिप्टो साइटों की स्वतंत्र तुलना। अपडेट बोनस और विशेषज्ञ समीक्षा।",
    {
      bestCrypto: "सर्वश्रेष्ठ क्रिप्टो साइटें",
      bestBetting: "सर्वश्रेष्ठ बेटिंग साइटें",
      bonuses: "बोनस",
      reviews: "समीक्षा",
      guides: "गाइड",
    },
    {
      heroTitle: "सर्वश्रेष्ठ क्रिप्टो साइटें खोजें",
      heroSubtitle: "चुनी गई और स्वतंत्र रूप से रेट की गई। बोनस और भुगतान तुलना करें।",
      ctaTelegram: "मुफ्त बोनस चैनल",
      topListTitle: "इस महीने की टॉप साइटें",
      visit: "साइट पर जाएं",
      review: "समीक्षा पढ़ें",
      bonusLabel: "वेलकम बोनस",
      ratingLabel: "हमारी रेटिंग",
      topPick: "टॉप पिक",
    },
    {
      title: "आपके क्षेत्र में उपलब्ध नहीं",
      body: "यह वेबसाइट आपके स्थान से एक्सेस नहीं है।",
    },
    {
      title: "Telegram पर दैनिक मुफ्त बोनस",
      body: "विशेष कोड और रीलोड — हर दिन चैनल पर।",
      button: "Telegram चैनल खोलें",
    }
  ),
  zh: shell(
    "比较最佳博彩与加密货币网站",
    "最佳加密货币博彩 — 评测、奖金与对比",
    "博彩与加密货币网站的独立对比。最新奖金与专家评测。",
    {
      bestCrypto: "最佳加密货币博彩",
      bestBetting: "最佳博彩网站",
      bonuses: "奖金",
      reviews: "评测",
      guides: "指南",
    },
    {
      heroTitle: "找到最佳加密货币博彩网站",
      heroSubtitle: "精选独立评测。一站式对比奖金与提款。",
      ctaTelegram: "免费奖金频道",
      topListTitle: "本月热门网站",
      visit: "访问网站",
      review: "阅读评测",
      bonusLabel: "欢迎奖金",
      ratingLabel: "我们的评分",
      topPick: "首选",
    },
    {
      title: "您所在地区不可用",
      body: "无法从您当前位置访问本网站。",
    },
    {
      title: "Telegram每日免费奖金",
      body: "独家代码与再存优惠 — 每日推送至频道。",
      button: "打开Telegram频道",
    }
  ),
  ko: shell(
    "최고의 베팅·암호화폐 사이트 비교",
    "최고의 암호화폐 베팅 — 리뷰, 보너스 및 비교",
    "베팅 및 암호화폐 사이트의 독립 비교. 최신 보너스와 전문 리뷰.",
    {
      bestCrypto: "최고 암호화폐 사이트",
      bestBetting: "최고 베팅 사이트",
      bonuses: "보너스",
      reviews: "리뷰",
      guides: "가이드",
    },
    {
      heroTitle: "최고의 암호화폐 사이트 찾기",
      heroSubtitle: "엄선 및 독립 평가. 보너스와 출금을 한곳에서 비교.",
      ctaTelegram: "무료 보너스 채널",
      topListTitle: "이달의 인기 사이트",
      visit: "사이트 방문",
      review: "리뷰 읽기",
      bonusLabel: "웰컴 보너스",
      ratingLabel: "우리 평점",
      topPick: "추천",
    },
    {
      title: "해당 지역에서 이용 불가",
      body: "현재 위치에서는 이 사이트에 접속할 수 없습니다.",
    },
    {
      title: "Telegram 매일 무료 보너스",
      body: "독점 코드와 리로드 — 채널에서 매일.",
      button: "Telegram 채널 열기",
    }
  ),
};

export function getDictionaryOverlay(locale: Locale): Partial<Dictionary> {
  return overlays[locale] ?? {};
}
