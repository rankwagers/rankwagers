import { siteBrand } from "./brand";
import { type Locale } from "./i18n";
import {
  getDictionaryExtras,
  type DictionaryExtras,
} from "./dictionaryExtras";
import { getDictionaryOverlay } from "./translations/dictionaryOverlays";

export type Dictionary = {
  meta: {
    siteName: string;
    tagline: string;
    homeTitle: string;
    homeDescription: string;
    bestBettingTitle?: string;
    bestBettingDescription?: string;
  };
  nav: {
    bestCrypto: string;
    bestBetting: string;
    bonuses: string;
    reviews: string;
    guides: string;
  };
  home: {
    heroTitle: string;
    heroSubtitle: string;
    bettingHeroTitle?: string;
    bettingHeroSubtitle?: string;
    ctaTelegram: string;
    topListTitle: string;
    visit: string;
    review: string;
    bonusLabel: string;
    ratingLabel: string;
    topPick: string;
  };
  table: {
    rank: string;
    brand: string;
    bonus: string;
    rating: string;
    action: string;
  };
  telegram: {
    title: string;
    body: string;
    button: string;
  };
  footer: {
    disclaimer: string;
    ageWarning: string;
    responsible: string;
    terms: string;
    privacy: string;
    geo: string;
  };
  blocked: {
    title: string;
    body: string;
  };
  ageGate?: {
    badge: string;
    title: string;
    body: string;
    yes: string;
    no: string;
  };
  cta: {
    claimBonus: string;
    getBonus: string;
    promoCode: string;
    copy: string;
    copied: string;
    noCodeNeeded: string;
    howToClaim: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    ourVerdict: string;
    scoreBonus: string;
    scoreOdds: string;
    scorePayments: string;
    scoreApp: string;
    scoreSupport: string;
    faqTitle: string;
    lastUpdated: string;
    termsApply: string;
    newPlayers: string;
    visitNow: string;
  };
};

const en: Dictionary = {
  meta: {
    siteName: siteBrand(),
    tagline: "Betting and crypto betting sites, assessed against published criteria",
    homeTitle: "RankWagers — football research and settled prediction records",
    homeDescription:
      "Independent comparison of betting and crypto betting sites against published criteria: bonuses, reviews, payout terms and market coverage.",
    bestBettingTitle: "Sportsbook operators — assessed against published criteria",
    bestBettingDescription:
      "Betting sites assessed against published criteria: licensing, welcome bonuses, payout times and market coverage. Reviews state what is not assessed.",
  },
  nav: {
    bestCrypto: "Crypto operators",
    bestBetting: "Operators",
    bonuses: "Promotions",
    reviews: "Assessments",
    guides: "Reference",
  },
  home: {
    /*
     * CONFLICT — UNRESOLVED, PENDING A BUSINESS DECISION.
     *
     * `heroTitle`, `bettingHeroTitle` and `topListTitle` are held at their Sprint 36 wording.
     * The editorial standard (docs/plans/editorial-copy-standard.md §2.4) bans the superlative;
     * the Sprint 36 guard in tests/claimPatternWidening.test.ts REQUIRES it, and its comment
     * states the intent explicitly: stripping the head term "would have surrendered the page's
     * primary search intent", and "a future edit that silences the guard by removing the keyword
     * fails here just as loudly as one that reinstates the unqualified claim".
     *
     * Both positions are legitimate and the trade is commercial (search visibility) against
     * editorial (institutional voice), so it is not a copy decision to take unilaterally. These
     * three strings are therefore unchanged; every other string in this file has moved to the
     * editorial standard. The five non-English dictionaries already carry the institutional
     * wording, so ratifying the standard means updating these three plus the guard, and rejecting
     * it means reverting the other locales.
     */
    heroTitle: "The best crypto betting sites, ranked by our published criteria",
    heroSubtitle:
      "Each operator is assessed against the same criteria, published in full — including what those criteria do not cover.",
    bettingHeroTitle: "The best betting sites, ranked by our published criteria",
    bettingHeroSubtitle:
      "Licensing, settlement terms, payout times and market coverage, recorded per operator and dated.",
    ctaTelegram: "Operator promotions on Telegram",
    topListTitle: "Top rated sites, by our published criteria",
    visit: "Open operator site",
    review: "Read assessment",
    bonusLabel: "Advertised offer",
    ratingLabel: "Assessment score",
    topPick: "Ranked first",
  },
  table: {
    rank: "#",
    brand: "Operator",
    bonus: "Advertised offer",
    rating: "Assessment",
    action: "",
  },
  telegram: {
    title: "Operator promotions on Telegram",
    body: "Promotional offers from listed operators, published as they are announced. Commercial content.",
    button: "Open Telegram channel",
  },
  footer: {
    disclaimer:
      "RankWagers earns a commission when a reader opens an account with an operator through a link on this site. The criteria used to order operators are published in full, including what they do not assess.",
    ageWarning: "18+ only. Gamble responsibly.",
    responsible: "Responsible gambling",
    terms: "Terms",
    privacy: "Privacy",
    geo: "Availability",
  },
  blocked: {
    title: "Not available in your region",
    body: "This website is not accessible from your location.",
  },
  ageGate: {
    badge: "18+",
    title: "Are you 18 or older?",
    body: "This website contains gambling-related content and is intended for adults only. You must be at least 18 years old to enter.",
    yes: "Yes, I am 18 or older",
    no: "No, leave this site",
  },
  cta: {
    claimBonus: "View offer terms",
    getBonus: "View offer terms",
    promoCode: "Offer code",
    copy: "Copy",
    copied: "Copied",
    noCodeNeeded: "No code required. The operator applies the offer at account opening.",
    howToClaim: "How the advertised offer is applied",
    step1Title: "Account opening",
    step1Body: "An account is opened with the operator through a RankWagers link. Some operators require the reader to opt in to the offer.",
    step2Title: "Qualifying deposit",
    step2Body: "The operator requires a qualifying first deposit, by card, e-wallet or cryptocurrency.",
    step3Title: "Offer credited",
    step3Body: "The operator credits the offer under its own terms for the reader's country.",
    ourVerdict: "Assessment summary",
    scoreBonus: "Offer terms",
    scoreOdds: "Odds",
    scorePayments: "Payments",
    scoreApp: "Mobile app",
    scoreSupport: "Support",
    faqTitle: "Common questions",
    lastUpdated: "Assessed",
    termsApply: "18+. New accounts only. Terms and conditions apply. Gamble responsibly.",
    newPlayers: "New accounts only",
    visitNow: "Open operator site",
  },
};

const fr: Dictionary = {
  meta: {
    siteName: siteBrand(),
    tagline: "Données de match, probabilité du modèle et résultats réglés.",
    homeTitle:
      "RankWagers — recherche football et historique des pronostics réglés",
    homeDescription:
      "Marchés football évalués avant le coup d'envoi, avec la probabilité du modèle, les données à l'appui et le résultat réglé de chaque pronostic publié.",
  },
  nav: {
    bestCrypto: "Opérateurs crypto",
    bestBetting: "Opérateurs",
    bonuses: "Promotions",
    reviews: "Évaluations",
    guides: "Référence",
  },
  home: {
    heroTitle: "Opérateurs acceptant les cryptomonnaies, évalués selon des critères publiés",
    heroSubtitle:
      "Chaque opérateur est évalué selon les mêmes critères, publiés intégralement — y compris ce que ces critères ne couvrent pas.",
    ctaTelegram: "Promotions des opérateurs sur Telegram",
    topListTitle: "Opérateurs, classés selon des critères publiés",
    visit: "Ouvrir le site de l'opérateur",
    review: "Lire l'évaluation",
    bonusLabel: "Offre annoncée",
    ratingLabel: "Note d'évaluation",
    topPick: "Classé premier",
  },
  table: {
    rank: "#",
    brand: "Opérateur",
    bonus: "Offre annoncée",
    rating: "Évaluation",
    action: "",
  },
  telegram: {
    title: "Promotions des opérateurs sur Telegram",
    body: "Offres promotionnelles des opérateurs référencés, publiées dès leur annonce. Contenu commercial.",
    button: "Ouvrir le canal Telegram",
  },
  footer: {
    disclaimer:
      "RankWagers perçoit une commission lorsqu'un lecteur ouvre un compte chez un opérateur via un lien de ce site. Les critères utilisés pour classer les opérateurs sont publiés intégralement, y compris ce qu'ils n'évaluent pas.",
    ageWarning: "18+ uniquement. Jouez de manière responsable.",
    responsible: "Jeu responsable",
    terms: "Conditions",
    privacy: "Confidentialité",
    geo: "Disponibilité",
  },
  blocked: {
    title: "Non disponible dans votre région",
    body: "Ce site n'est pas accessible depuis votre emplacement.",
  },
  ageGate: {
    badge: "18+",
    title: "Avez-vous 18 ans ou plus ?",
    body: "Ce site contient du contenu lié aux jeux d'argent et est réservé aux adultes. Vous devez avoir au moins 18 ans pour entrer.",
    yes: "Oui, j'ai 18 ans ou plus",
    no: "Non, quitter le site",
  },
  cta: {
    claimBonus: "Voir les conditions de l'offre",
    getBonus: "Voir les conditions de l'offre",
    promoCode: "Code de l'offre",
    copy: "Copier",
    copied: "Copié",
    noCodeNeeded: "Aucun code requis. L'opérateur applique l'offre à l'ouverture du compte.",
    howToClaim: "Comment l'offre annoncée est appliquée",
    step1Title: "Ouverture du compte",
    step1Body: "Un compte est ouvert chez l'opérateur via un lien RankWagers. Certains opérateurs exigent que le lecteur active l'offre.",
    step2Title: "Dépôt qualifiant",
    step2Body: "L'opérateur exige un premier dépôt qualifiant, par carte, portefeuille électronique ou cryptomonnaie.",
    step3Title: "Offre créditée",
    step3Body: "L'opérateur crédite l'offre selon ses propres conditions pour le pays du lecteur.",
    ourVerdict: "Synthèse de l'évaluation",
    scoreBonus: "Conditions de l'offre",
    scoreOdds: "Cotes",
    scorePayments: "Paiements",
    scoreApp: "Application",
    scoreSupport: "Support",
    faqTitle: "Questions courantes",
    lastUpdated: "Évalué le",
    termsApply: "18+. Nouveaux comptes uniquement. Conditions générales applicables. Jouez de manière responsable.",
    newPlayers: "Nouveaux comptes uniquement",
    visitNow: "Ouvrir le site de l'opérateur",
  },
};

const es: Dictionary = {
  meta: {
    siteName: siteBrand(),
    tagline: "Datos del partido, probabilidad del modelo y resultados liquidados.",
    homeTitle:
      "RankWagers — investigación de fútbol e historial de pronósticos liquidados",
    homeDescription:
      "Mercados de fútbol evaluados antes del saque inicial, con la probabilidad del modelo, los datos que la respaldan y el resultado liquidado de cada pronóstico publicado.",
  },
  nav: {
    bestCrypto: "Operadores cripto",
    bestBetting: "Operadores",
    bonuses: "Promociones",
    reviews: "Evaluaciones",
    guides: "Referencia",
  },
  home: {
    heroTitle: "Operadores que aceptan criptomonedas, evaluados con criterios publicados",
    heroSubtitle:
      "Cada operador se evalúa con los mismos criterios, publicados en su totalidad — incluido lo que esos criterios no cubren.",
    ctaTelegram: "Promociones de operadores en Telegram",
    topListTitle: "Operadores, ordenados según criterios publicados",
    visit: "Abrir el sitio del operador",
    review: "Leer la evaluación",
    bonusLabel: "Oferta anunciada",
    ratingLabel: "Puntuación de evaluación",
    topPick: "Primero por criterios",
  },
  table: {
    rank: "#",
    brand: "Operador",
    bonus: "Oferta anunciada",
    rating: "Evaluación",
    action: "",
  },
  telegram: {
    title: "Promociones de operadores en Telegram",
    body: "Ofertas promocionales de los operadores listados, publicadas cuando se anuncian. Contenido comercial.",
    button: "Abrir canal de Telegram",
  },
  footer: {
    disclaimer:
      "RankWagers recibe una comisión cuando un lector abre una cuenta con un operador a través de un enlace de este sitio. Los criterios usados para ordenar a los operadores se publican en su totalidad, incluido lo que no evalúan.",
    ageWarning: "Solo +18. Juega con responsabilidad.",
    responsible: "Juego responsable",
    terms: "Términos",
    privacy: "Privacidad",
    geo: "Disponibilidad",
  },
  blocked: {
    title: "No disponible en tu región",
    body: "Este sitio web no es accesible desde tu ubicación.",
  },
  cta: {
    claimBonus: "Ver condiciones de la oferta",
    getBonus: "Ver condiciones de la oferta",
    promoCode: "Código de la oferta",
    copy: "Copiar",
    copied: "Copiado",
    noCodeNeeded: "No se requiere código. El operador aplica la oferta al abrir la cuenta.",
    howToClaim: "Cómo se aplica la oferta anunciada",
    step1Title: "Apertura de cuenta",
    step1Body: "Se abre una cuenta con el operador a través de un enlace de RankWagers. Algunos operadores exigen que el lector active la oferta.",
    step2Title: "Depósito cualificado",
    step2Body: "El operador exige un primer depósito cualificado, por tarjeta, monedero electrónico o criptomoneda.",
    step3Title: "Oferta acreditada",
    step3Body: "El operador acredita la oferta según sus propias condiciones para el país del lector.",
    ourVerdict: "Resumen de la evaluación",
    scoreBonus: "Condiciones de la oferta",
    scoreOdds: "Cuotas",
    scorePayments: "Pagos",
    scoreApp: "App móvil",
    scoreSupport: "Soporte",
    faqTitle: "Preguntas comunes",
    lastUpdated: "Evaluado el",
    termsApply: "+18. Solo cuentas nuevas. Se aplican los términos y condiciones. Juega con responsabilidad.",
    newPlayers: "Solo cuentas nuevas",
    visitNow: "Abrir el sitio del operador",
  },
};

const pt: Dictionary = {
  ...en,
  meta: {
    siteName: siteBrand(),
    tagline: "Dados da partida, probabilidade do modelo e resultados liquidados.",
    homeTitle:
      "RankWagers — pesquisa de futebol e histórico de previsões liquidadas",
    homeDescription:
      "Mercados de futebol avaliados antes do apito inicial, com a probabilidade do modelo, os dados que a sustentam e o resultado liquidado de cada previsão publicada.",
  },
  nav: {
    bestCrypto: "Operadores cripto",
    bestBetting: "Operadores",
    bonuses: "Promoções",
    reviews: "Avaliações",
    guides: "Referência",
  },
  home: {
    heroTitle: "Operadores que aceitam criptomoedas, avaliados segundo critérios publicados",
    heroSubtitle:
      "Cada operador é avaliado segundo os mesmos critérios, publicados na íntegra — incluindo o que esses critérios não cobrem.",
    ctaTelegram: "Promoções de operadores no Telegram",
    topListTitle: "Operadores, ordenados segundo critérios publicados",
    visit: "Abrir o site do operador",
    review: "Ler a avaliação",
    bonusLabel: "Oferta anunciada",
    ratingLabel: "Pontuação da avaliação",
    topPick: "Primeiro por critérios",
  },
  telegram: {
    title: "Promoções de operadores no Telegram",
    body: "Ofertas promocionais dos operadores listados, publicadas quando são anunciadas. Conteúdo comercial.",
    button: "Abrir canal do Telegram",
  },
  blocked: {
    title: "Não disponível na sua região",
    body: "Este site não está acessível a partir da sua localização.",
  },
};

const de: Dictionary = {
  ...en,
  meta: {
    siteName: siteBrand(),
    tagline: "Spieldaten, Modellwahrscheinlichkeit und abgerechnete Ergebnisse.",
    homeTitle:
      "RankWagers — Fußballanalyse und abgerechnete Prognosehistorie",
    homeDescription:
      "Fußballmärkte, vor dem Anpfiff bewertet — mit Modellwahrscheinlichkeit, zugrunde liegenden Daten und dem abgerechneten Ergebnis jeder veröffentlichten Prognose.",
  },
  nav: {
    bestCrypto: "Krypto-Anbieter",
    bestBetting: "Anbieter",
    bonuses: "Aktionen",
    reviews: "Bewertungen",
    guides: "Referenz",
  },
  home: {
    heroTitle: "Krypto-akzeptierende Anbieter, bewertet nach veröffentlichten Kriterien",
    heroSubtitle:
      "Jeder Anbieter wird nach denselben Kriterien bewertet, vollständig veröffentlicht — einschließlich dessen, was diese Kriterien nicht abdecken.",
    ctaTelegram: "Anbieter-Aktionen auf Telegram",
    topListTitle: "Anbieter, geordnet nach veröffentlichten Kriterien",
    visit: "Anbieterseite öffnen",
    review: "Bewertung lesen",
    bonusLabel: "Beworbenes Angebot",
    ratingLabel: "Bewertungspunktzahl",
    topPick: "Erster nach Kriterien",
  },
  telegram: {
    title: "Anbieter-Aktionen auf Telegram",
    body: "Werbeangebote der gelisteten Anbieter, veröffentlicht sobald sie angekündigt werden. Kommerzieller Inhalt.",
    button: "Telegram-Kanal öffnen",
  },
  blocked: {
    title: "In deiner Region nicht verfügbar",
    body: "Diese Website ist von deinem Standort aus nicht zugänglich.",
  },
  ageGate: {
    badge: "18+",
    title: "Bist du 18 Jahre oder älter?",
    body: "Diese Website enthält Inhalte zum Glücksspiel und richtet sich nur an Erwachsene. Du musst mindestens 18 Jahre alt sein.",
    yes: "Ja, ich bin 18 oder älter",
    no: "Nein, Seite verlassen",
  },
};

const ar: Dictionary = {
  ...en,
  meta: {
    siteName: siteBrand(),
    tagline: "بيانات المباريات واحتمالية النموذج والنتائج المسوّاة.",
    homeTitle: "RankWagers — أبحاث كرة القدم وسجل التوقعات المسوّاة",
    homeDescription:
      "أسواق كرة القدم مقيّمة قبل صافرة البداية، مع احتمالية النموذج والبيانات الداعمة والنتيجة المسوّاة لكل توقع منشور.",
  },
  nav: {
    bestCrypto: "مشغّلو الكريبتو",
    bestBetting: "المشغّلون",
    bonuses: "العروض الترويجية",
    reviews: "التقييمات",
    guides: "المرجع",
  },
  home: {
    heroTitle: "المشغّلون الذين يقبلون العملات الرقمية، مقيّمون وفق معايير منشورة",
    heroSubtitle:
      "يُقيَّم كل مشغّل وفق المعايير نفسها، منشورة بالكامل — بما في ذلك ما لا تغطيه هذه المعايير.",
    ctaTelegram: "عروض المشغّلين على تيليجرام",
    topListTitle: "المشغّلون، مرتّبون وفق معايير منشورة",
    visit: "فتح موقع المشغّل",
    review: "اقرأ التقييم",
    bonusLabel: "العرض المُعلن",
    ratingLabel: "درجة التقييم",
    topPick: "الأول وفق المعايير",
  },
  table: {
    rank: "#",
    brand: "المشغّل",
    bonus: "العرض المُعلن",
    rating: "التقييم",
    action: "",
  },
  telegram: {
    title: "عروض المشغّلين على تيليجرام",
    body: "عروض ترويجية من المشغّلين المدرجين، تُنشر عند الإعلان عنها. محتوى تجاري.",
    button: "افتح قناة تيليجرام",
  },
  footer: {
    disclaimer:
      "يتقاضى RankWagers عمولة عند فتح القارئ حساباً لدى مشغّل عبر رابط في هذا الموقع. المعايير المستخدمة لترتيب المشغّلين منشورة بالكامل، بما في ذلك ما لا تُقيّمه.",
    ageWarning: "للأعمار +18 فقط. العب بمسؤولية.",
    responsible: "اللعب المسؤول",
    terms: "الشروط",
    privacy: "الخصوصية",
    geo: "التوفر",
  },
  blocked: {
    title: "غير متاح في منطقتك",
    body: "هذا الموقع غير متاح من موقعك.",
  },
};

export type FullDictionary = Dictionary & DictionaryExtras & {
  ageGate: NonNullable<Dictionary["ageGate"]>;
  meta: Dictionary["meta"] & {
    bestBettingTitle: string;
    bestBettingDescription: string;
  };
  home: Dictionary["home"] & {
    bettingHeroTitle: string;
    bettingHeroSubtitle: string;
  };
};

// Henüz tam çevrilmemiş diller → İngilizce taban
const dictionaries: Partial<Record<Locale, Dictionary>> = {
  en,
  fr,
  es,
  pt,
  de,
  ar,
};

export function getDictionary(locale: Locale): FullDictionary {
  const enDict = dictionaries.en!;
  const baseRaw =
    dictionaries[locale] ??
    (locale === "es-es" ? dictionaries.es : undefined) ??
    enDict;
  const overlay = getDictionaryOverlay(locale);
  const ageGate: NonNullable<Dictionary["ageGate"]> = {
    badge:
      overlay.ageGate?.badge ??
      baseRaw.ageGate?.badge ??
      enDict.ageGate!.badge,
    title:
      overlay.ageGate?.title ??
      baseRaw.ageGate?.title ??
      enDict.ageGate!.title,
    body:
      overlay.ageGate?.body ??
      baseRaw.ageGate?.body ??
      enDict.ageGate!.body,
    yes:
      overlay.ageGate?.yes ??
      baseRaw.ageGate?.yes ??
      enDict.ageGate!.yes,
    no: overlay.ageGate?.no ?? baseRaw.ageGate?.no ?? enDict.ageGate!.no,
  };
  const base: Dictionary = {
    ...baseRaw,
    ...overlay,
    meta: { ...baseRaw.meta, ...overlay.meta },
    nav: { ...baseRaw.nav, ...overlay.nav },
    home: { ...baseRaw.home, ...overlay.home },
    telegram: { ...baseRaw.telegram, ...overlay.telegram },
    blocked: { ...baseRaw.blocked, ...overlay.blocked },
    ageGate,
    footer: { ...baseRaw.footer, ...overlay.footer },
    table: { ...baseRaw.table, ...overlay.table },
    cta: { ...baseRaw.cta, ...overlay.cta },
  };
  const extras = getDictionaryExtras(locale);
  const brand = siteBrand();
  return {
    ...base,
    ...extras,
    ageGate,
    meta: {
      ...base.meta,
      siteName: brand,
      bestBettingTitle:
        base.meta.bestBettingTitle ??
        enDict.meta.bestBettingTitle ??
        "Sportsbook operators — assessed against published criteria",
      bestBettingDescription:
        base.meta.bestBettingDescription ??
        enDict.meta.bestBettingDescription ??
        enDict.meta.homeDescription,
    },
    home: {
      ...base.home,
      ...extras.home,
      bettingHeroTitle:
        base.home.bettingHeroTitle ??
        enDict.home.bettingHeroTitle ??
        "Find the best betting sites",
      bettingHeroSubtitle:
        base.home.bettingHeroSubtitle ??
        enDict.home.bettingHeroSubtitle ??
        enDict.home.heroSubtitle,
    },
    footer: { ...base.footer, ...extras.footer },
  };
}
