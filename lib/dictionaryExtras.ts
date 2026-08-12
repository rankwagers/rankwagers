import type { Locale } from "./i18n";
import {
  getPredictionsForLocale,
} from "./translations/predictionsLocales";
import {
  predictionsEn,
  type PredictionStrings,
} from "./translations/predictionsEn";

export type { PredictionStrings };

export type DictionaryExtras = {
  home: { filterAll: string; filterCrypto: string; popularCompares: string };
  trust: {
    review: string;
    payouts: string;
    licensed: string;
    bonuses: string;
    socialProof: string;
  };
  compare: {
    vsTitle: string;
    metaDescription: string;
    fullComparison: string;
    winner: string;
    tie: string;
    cryptoYes: string;
    cryptoNo: string;
    highlights: string;
    readReview: string;
    crypto: string;
  };
  review: {
    founded: string;
    minDeposit: string;
    payoutTime: string;
    licenses: string;
    payments: string;
    pros: string;
    cons: string;
  };
  methodology: {
    title: string;
    step1: string;
    step2: string;
    step3: string;
  };
  footer: {
    affiliateNotice: string;
    copyright: string;
    eligibilityTitle: string;
    eligibilityBody: string;
    availabilityBody: string;
  };
  a11y: { skipToContent: string };
  predictions: PredictionStrings;
};

const en: DictionaryExtras = {
  home: {
    filterAll: "All sites",
    filterCrypto: "Crypto only",
    popularCompares: "Popular comparisons",
  },
  trust: {
    review: "Assessed against published criteria",
    payouts: "Payout terms recorded",
    licensed: "Licensing recorded",
    bonuses: "Advertised offers",
    socialProof: "{count} operators assessed · Criteria published · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription:
      "{a} and {b} assessed against the same published criteria: advertised offers, payout terms, crypto support and market coverage.",
    fullComparison: "Side-by-side comparison",
    winner: "Higher assessment score",
    tie: "Equal assessment score — compare terms below",
    cryptoYes: "Yes",
    cryptoNo: "No",
    highlights: "Key features",
    readReview: "Full assessment",
    crypto: "Crypto payments",
  },
  review: {
    founded: "Founded",
    minDeposit: "Min. deposit",
    payoutTime: "Payout time",
    licenses: "Licence",
    payments: "Payment methods",
    pros: "Pros",
    cons: "Cons",
  },
  methodology: {
    title: "How we rate sites",
    step1: "We test signup, deposits and bonus activation on real accounts.",
    step2: "Odds, app quality and payout speed are scored against market leaders.",
    step3: "Ratings are updated monthly; affiliate partnerships never change scores.",
  },
  footer: {
    affiliateNotice: "Affiliate disclosure",
    copyright: "© {year} RankWagers. All rights reserved.",
    eligibilityTitle: "Eligibility & availability",
    eligibilityBody:
      "We compare betting operators but do not provide gambling services. Bonuses and registration depend on your country and are confirmed only by the operator when you sign up. Each brand has its own rules; restricted regions cannot register even if listed here. You must be 18+ and follow local laws. This website is not available from Turkey.",
    availabilityBody:
      "RankWagers is open to visitors worldwide except Turkey. The country list below only sets the default language we show — it does not mean other regions are blocked on this site. Whether you can register and play is decided solely by each operator. We do not operate gambling; we publish comparisons and affiliate links.",
  },
  a11y: { skipToContent: "Skip to main content" },
  predictions: predictionsEn,
};

const fr: DictionaryExtras = {
  home: {
    filterAll: "Tous les sites",
    filterCrypto: "Crypto uniquement",
    popularCompares: "Comparaisons populaires",
  },
  trust: {
    review: "Avis indépendants",
    payouts: "Paiements rapides vérifiés",
    licensed: "Opérateurs licenciés",
    bonuses: "Bonus exclusifs",
    socialProof:
      "{count}+ opérateurs passés en revue · Notes indépendantes · Listes mises à jour",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription:
      "Comparez {a} et {b} : bonus, notes, crypto et fonctionnalités clés.",
    fullComparison: "Comparaison côte à côte",
    winner: "Meilleur choix dans ce duel",
    tie: "Égalité — comparez les bonus ci-dessous",
    cryptoYes: "Oui",
    cryptoNo: "Non",
    highlights: "Points clés",
    readReview: "Avis complet",
    crypto: "Paiements crypto",
  },
  review: {
    founded: "Fondé en",
    minDeposit: "Dépôt min.",
    payoutTime: "Délai de paiement",
    licenses: "Licence",
    payments: "Moyens de paiement",
    pros: "Avantages",
    cons: "Inconvénients",
  },
  methodology: {
    title: "Comment nous notons",
    step1: "Nous testons inscription, dépôts et activation des bonus sur de vrais comptes.",
    step2: "Cotes, app et rapidité des retraits sont comparés aux leaders du marché.",
    step3: "Notes mises à jour chaque mois ; les partenariats n'influencent pas les scores.",
  },
  footer: {
    affiliateNotice: "Transparence affiliée",
    copyright: "© {year} RankWagers. Tous droits réservés.",
    eligibilityTitle: "Éligibilité et disponibilité",
    eligibilityBody:
      "Nous comparons des opérateurs mais ne proposons pas de jeux d'argent. Bonus et inscription dépendent de votre pays et sont confirmés uniquement par l'opérateur. Chaque marque a ses règles ; les régions restreintes ne peuvent pas s'inscrire. 18+ et lois locales. Site inaccessible depuis la Turquie.",
    availabilityBody:
      "RankWagers est ouvert dans le monde entier sauf en Turquie. La liste de pays ci-dessous définit seulement la langue par défaut, pas un blocage. L'inscription et le jeu sont décidés par chaque opérateur. Nous ne gérons pas de paris ; nous publions des comparatifs et des liens affiliés.",
  },
  a11y: { skipToContent: "Aller au contenu principal" },
  predictions: {
    ...predictionsEn,
    metaTitle: "Pronostics du jour — Plus de 1,5, 2,5 et mi-temps",
    metaDescription:
      "Listes quotidiennes : buts en 1ère mi-temps, plus de 1,5, plus de 2,5 et 2ème mi-temps.",
    heroTitle: "Pronostics du jour",
    heroSubtitle: "Marchés de buts filtrés par probabilité — mis à jour dans la journée.",
    tabFh: "1ère MT 0,5+",
    tabOver15: "Plus de 1,5",
    tabOver25: "Plus de 2,5",
    tabSh: "2ème MT 0,5+",
    navTodayLists: "Listes du jour",
  },
};

const es: DictionaryExtras = {
  home: {
    filterAll: "Todos los sitios",
    filterCrypto: "Solo cripto",
    popularCompares: "Comparativas populares",
  },
  trust: {
    review: "Reseñas independientes",
    payouts: "Pagos rápidos verificados",
    licensed: "Operadores con licencia",
    bonuses: "Bonos exclusivos",
    socialProof:
      "{count}+ operadores revisados · Valoraciones independientes · Listas actualizadas",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription:
      "Compara {a} y {b}: bonos, valoraciones, cripto y características clave.",
    fullComparison: "Comparación lado a lado",
    winner: "Mejor opción en este duelo",
    tie: "Empate — compara los bonos abajo",
    cryptoYes: "Sí",
    cryptoNo: "No",
    highlights: "Características clave",
    readReview: "Reseña completa",
    crypto: "Pagos con cripto",
  },
  review: {
    founded: "Fundado",
    minDeposit: "Depósito mín.",
    payoutTime: "Tiempo de pago",
    licenses: "Licencia",
    payments: "Métodos de pago",
    pros: "Ventajas",
    cons: "Desventajas",
  },
  methodology: {
    title: "Cómo valoramos",
    step1: "Probamos registro, depósitos y activación de bonos con cuentas reales.",
    step2: "Cuotas, app y velocidad de cobro se comparan con los líderes del mercado.",
    step3: "Valoraciones mensuales; los acuerdos de afiliación no cambian las notas.",
  },
  footer: {
    affiliateNotice: "Aviso de afiliación",
    copyright: "© {year} RankWagers. Todos los derechos reservados.",
    eligibilityTitle: "Elegibilidad y disponibilidad",
    eligibilityBody:
      "Comparamos operadores pero no ofrecemos juego. Bonos y registro dependen de tu país y los confirma solo el operador. Cada marca tiene sus reglas; regiones restringidas no pueden registrarse. +18 y leyes locales. Este sitio no está disponible desde Turquía.",
    availabilityBody:
      "RankWagers está abierto en todo el mundo excepto Turquía. La lista de países solo define el idioma por defecto, no un bloqueo. El registro lo decide cada operador. No operamos apuestas; publicamos comparativas y enlaces de afiliación.",
  },
  a11y: { skipToContent: "Saltar al contenido principal" },
  predictions: predictionsEn,
};

const pt: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Todos os sites",
    filterCrypto: "Só cripto",
    popularCompares: "Comparações populares",
  },
  trust: {
    review: "Análises independentes",
    payouts: "Pagamentos rápidos verificados",
    licensed: "Operadores licenciados",
    bonuses: "Bônus exclusivos",
    socialProof:
      "{count}+ operadores analisados · Notas independentes · Listas atualizadas",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Compare {a} e {b}: bônus, notas, cripto e recursos principais.",
    fullComparison: "Comparação lado a lado",
    winner: "Melhor escolha neste duelo",
    tie: "Empate — compare os bônus abaixo",
    cryptoYes: "Sim",
    cryptoNo: "Não",
    highlights: "Destaques",
    readReview: "Análise completa",
    crypto: "Pagamentos cripto",
  },
  review: {
    founded: "Fundado",
    minDeposit: "Depósito mín.",
    payoutTime: "Tempo de saque",
    licenses: "Licença",
    payments: "Pagamentos",
    pros: "Prós",
    cons: "Contras",
  },
  methodology: {
    title: "Como avaliamos",
    step1: "Testamos cadastro, depósitos e bônus em contas reais.",
    step2: "Odds, app e saques são comparados aos líderes do mercado.",
    step3: "Notas atualizadas mensalmente; parcerias não alteram as pontuações.",
  },
  footer: {
    affiliateNotice: "Divulgação de afiliados",
    copyright: "© {year} RankWagers. Todos os direitos reservados.",
    eligibilityTitle: "Elegibilidade e disponibilidade",
    eligibilityBody:
      "Comparamos operadores, mas não oferecemos jogos de azar. Bônus e cadastro dependem do seu país e são confirmados apenas pelo operador. Cada marca tem regras próprias; regiões restritas não podem se registrar. 18+ e leis locais. Site indisponível na Turquia.",
    availabilityBody:
      "O RankWagers está aberto no mundo todo, exceto na Turquia. A lista de países define só o idioma padrão, não um bloqueio. O cadastro é decidido por cada operador. Não operamos apostas; publicamos comparações e links de afiliados.",
  },
  a11y: { skipToContent: "Ir para o conteúdo principal" },
  predictions: predictionsEn,
};

const de: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Alle Seiten",
    filterCrypto: "Nur Krypto",
    popularCompares: "Beliebte Vergleiche",
  },
  trust: {
    review: "Unabhängig bewertet",
    payouts: "Schnelle Auszahlungen geprüft",
    licensed: "Lizenzierte Anbieter",
    bonuses: "Exklusive Boni",
    socialProof:
      "{count}+ Wettanbieter geprüft · Unabhängige Bewertungen · Täglich aktualisierte Listen",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription:
      "Vergleiche {a} und {b}: Boni, Bewertungen, Krypto und Funktionen.",
    fullComparison: "Direktvergleich",
    winner: "Top-Wahl in diesem Duell",
    tie: "Unentschieden — vergleiche die Boni unten",
    cryptoYes: "Ja",
    cryptoNo: "Nein",
    highlights: "Highlights",
    readReview: "Vollständige Bewertung",
    crypto: "Krypto-Zahlungen",
  },
  review: {
    founded: "Gegründet",
    minDeposit: "Min. Einzahlung",
    payoutTime: "Auszahlungszeit",
    licenses: "Lizenz",
    payments: "Zahlungsmethoden",
    pros: "Vorteile",
    cons: "Nachteile",
  },
  methodology: {
    title: "So bewerten wir",
    step1: "Wir testen Registrierung, Einzahlungen und Bonusaktivierung mit echten Konten.",
    step2: "Quoten, App und Auszahlungen werden mit Marktführern verglichen.",
    step3: "Monatliche Updates; Partnerschaften beeinflussen die Scores nicht.",
  },
  footer: {
    affiliateNotice: "Affiliate-Hinweis",
    copyright: "© {year} RankWagers. Alle Rechte vorbehalten.",
    eligibilityTitle: "Teilnahme & Verfügbarkeit",
    eligibilityBody:
      "Wir vergleichen Anbieter, bieten aber kein Glücksspiel an. Boni und Registrierung hängen vom Land ab und werden nur vom Anbieter bestätigt. Jede Marke hat eigene Regeln; gesperrte Regionen können sich nicht anmelden. 18+, lokale Gesetze beachten. Website aus der Türkei nicht erreichbar.",
    availabilityBody:
      "RankWagers ist weltweit erreichbar außer in der Türkei. Die Länderliste legt nur die Standardsprache fest, keinen Zugangssperre. Registrierung entscheidet der jeweilige Anbieter. Wir betreiben kein Glücksspiel; wir veröffentlichen Vergleiche und Affiliate-Links.",
  },
  a11y: { skipToContent: "Zum Hauptinhalt springen" },
  predictions: predictionsEn,
};

const ar: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "كل المواقع",
    filterCrypto: "كريبتو فقط",
    popularCompares: "مقارنات شائعة",
  },
  trust: {
    review: "مراجعات مستقلة",
    payouts: "سحوبات سريعة مُختبرة",
    licensed: "مشغّلون مرخّصون",
    bonuses: "بونصات حصرية",
    socialProof: "{count}+ مواقع مراجعة · تقييمات مستقلة · قوائم محدّثة يومياً",
  },
  compare: {
    vsTitle: "{a} مقابل {b}",
    metaDescription: "قارن {a} و{b}: البونص والتقييم والكريبتو والميزات.",
    fullComparison: "مقارنة جنباً إلى جنب",
    winner: "الأفضل في هذه المقارنة",
    tie: "تعادل — قارن البونص أدناه",
    cryptoYes: "نعم",
    cryptoNo: "لا",
    highlights: "أبرز الميزات",
    readReview: "مراجعة كاملة",
    crypto: "مدفوعات كريبتو",
  },
  review: {
    founded: "تأسس",
    minDeposit: "الحد الأدنى للإيداع",
    payoutTime: "وقت السحب",
    licenses: "الترخيص",
    payments: "طرق الدفع",
    pros: "الإيجابيات",
    cons: "السلبيات",
  },
  methodology: {
    title: "كيف نقيّم المواقع",
    step1: "نختبر التسجيل والإيداع وتفعيل البونص على حسابات حقيقية.",
    step2: "الاحتمالات والتطبيق وسرعة السحب تُقارن بقادة السوق.",
    step3: "تحديث شهري؛ الشراكات لا تغيّر التقييمات.",
  },
  footer: {
    affiliateNotice: "إفصاح الشراكة",
    copyright: "© {year} RankWagers. جميع الحقوق محفوظة.",
    eligibilityTitle: "الأهلية والتوفر",
    eligibilityBody:
      "نقارن المشغّلين ولا نقدّم خدمات قمار. المكافآت والتسجيل تعتمد على بلدك ويؤكدها المشغّل فقط. لكل علامة قواعدها؛ المناطق المحظورة لا يمكنها التسجيل. +18 والقوانين المحلية. الموقع غير متاح من تركيا.",
    availabilityBody:
      "RankWagers مفتوح عالمياً ما عدا تركيا. قائمة البلدان تحدد اللغة الافتراضية فقط وليست حظراً. التسجيل يقرره كل مشغّل. لا نشغّل قماراً؛ ننشر مقارنات وروابط إحالة.",
  },
  a11y: { skipToContent: "انتقل إلى المحتوى الرئيسي" },
  predictions: predictionsEn,
};

const it: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Tutti i siti",
    filterCrypto: "Solo crypto",
    popularCompares: "Confronti popolari",
  },
  trust: {
    review: "Recensioni indipendenti",
    payouts: "Pagamenti rapidi verificati",
    licensed: "Operatori con licenza",
    bonuses: "Bonus esclusivi",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Confronta {a} e {b}: bonus, valutazioni, crypto e funzioni.",
    fullComparison: "Confronto affiancato",
    winner: "Scelta migliore in questo match",
    tie: "Pareggio — confronta i bonus sotto",
    cryptoYes: "Sì",
    cryptoNo: "No",
    highlights: "Punti chiave",
    readReview: "Recensione completa",
    crypto: "Pagamenti crypto",
  },
  review: {
    founded: "Fondato",
    minDeposit: "Deposito min.",
    payoutTime: "Tempi di prelievo",
    licenses: "Licenza",
    payments: "Pagamenti",
    pros: "Pro",
    cons: "Contro",
  },
  methodology: {
    title: "Come valutiamo",
    step1: "Testiamo registrazione, depositi e bonus su account reali.",
    step2: "Quote, app e prelievi sono confrontati con i leader di mercato.",
    step3: "Aggiornamento mensile; le partnership non cambiano i punteggi.",
  },
  footer: {
    affiliateNotice: "Informativa affiliati",
    copyright: "© {year} RankWagers. Tutti i diritti riservati.",
    eligibilityTitle: "Idoneità e disponibilità",
    eligibilityBody:
      "Confrontiamo operatori ma non offriamo gioco d'azzardo. Bonus e registrazione dipendono dal paese e sono confermati solo dall'operatore. Ogni brand ha regole diverse; le regioni limitate non possono registrarsi. 18+ e leggi locali. Sito non disponibile dalla Turchia.",
    availabilityBody:
      "RankWagers è aperto in tutto il mondo tranne la Turchia. L'elenco paesi imposta solo la lingua predefinita. La registrazione è decisa da ogni operatore. Non gestiamo scommesse; pubblichiamo confronti e link affiliati.",
  },
  a11y: { skipToContent: "Vai al contenuto principale" },
  predictions: predictionsEn,
};

const nl: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Alle sites",
    filterCrypto: "Alleen crypto",
    popularCompares: "Populaire vergelijkingen",
  },
  trust: {
    review: "Onafhankelijk beoordeeld",
    payouts: "Snelle uitbetalingen gecontroleerd",
    licensed: "Gelicentieerde operators",
    bonuses: "Exclusieve bonussen",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Vergelijk {a} en {b}: bonussen, scores, crypto en features.",
    fullComparison: "Vergelijking naast elkaar",
    winner: "Topkeuze in deze match",
    tie: "Gelijk — vergelijk bonussen hieronder",
    cryptoYes: "Ja",
    cryptoNo: "Nee",
    highlights: "Belangrijkste punten",
    readReview: "Volledige review",
    crypto: "Cryptobetalingen",
  },
  review: {
    founded: "Opgericht",
    minDeposit: "Min. storting",
    payoutTime: "Uitbetalingstijd",
    licenses: "Licentie",
    payments: "Betaalmethoden",
    pros: "Voordelen",
    cons: "Nadelen",
  },
  methodology: {
    title: "Hoe we beoordelen",
    step1: "We testen registratie, stortingen en bonusactivatie op echte accounts.",
    step2: "Odds, app en uitbetalingen worden vergeleken met marktleiders.",
    step3: "Maandelijks bijgewerkt; partnerships beïnvloeden scores niet.",
  },
  footer: {
    affiliateNotice: "Affiliate-mededeling",
    copyright: "© {year} RankWagers. Alle rechten voorbehouden.",
    eligibilityTitle: "Geschiktheid en beschikbaarheid",
    eligibilityBody:
      "Wij vergelijken aanbieders maar bieden geen kansspelen. Bonussen en registratie hangen af van uw land en worden alleen door de aanbieder bevestigd. Elk merk heeft eigen regels; beperkte regio's kunnen niet registreren. 18+ en lokale wetten. Website niet beschikbaar vanuit Turkije.",
    availabilityBody:
      "RankWagers is wereldwijd open behalve Turkije. De landenlijst bepaalt alleen de standaardtaal. Registratie beslist elke aanbieder. Wij exploiteren geen gokken; wij publiceren vergelijkingen en affiliatelinks.",
  },
  a11y: { skipToContent: "Ga naar hoofdinhoud" },
  predictions: predictionsEn,
};

const pl: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Wszystkie strony",
    filterCrypto: "Tylko krypto",
    popularCompares: "Popularne porównania",
  },
  trust: {
    review: "Niezależne recenzje",
    payouts: "Szybkie wypłaty zweryfikowane",
    licensed: "Licencjonowani operatorzy",
    bonuses: "Ekskluzywne bonusy",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Porównaj {a} i {b}: bonusy, oceny, krypto i funkcje.",
    fullComparison: "Porównanie obok siebie",
    winner: "Najlepszy wybór w tym pojedynku",
    tie: "Remis — porównaj bonusy poniżej",
    cryptoYes: "Tak",
    cryptoNo: "Nie",
    highlights: "Kluczowe cechy",
    readReview: "Pełna recenzja",
    crypto: "Płatności krypto",
  },
  review: {
    founded: "Założono",
    minDeposit: "Min. depozyt",
    payoutTime: "Czas wypłaty",
    licenses: "Licencja",
    payments: "Płatności",
    pros: "Zalety",
    cons: "Wady",
  },
  methodology: {
    title: "Jak oceniamy",
    step1: "Testujemy rejestrację, depozyty i bonusy na prawdziwych kontach.",
    step2: "Kursy, aplikacja i wypłaty porównujemy z liderami rynku.",
    step3: "Aktualizacja co miesiąc; partnerstwa nie zmieniają ocen.",
  },
  footer: {
    affiliateNotice: "Ujawnienie afiliacji",
    copyright: "© {year} RankWagers. Wszelkie prawa zastrzeżone.",
    eligibilityTitle: "Kwalifikacja i dostępność",
    eligibilityBody:
      "Porównujemy operatorów, ale nie świadczymy usług hazardowych. Bonusy i rejestracja zależą od kraju i są potwierdzane tylko przez operatora. Każda marka ma własne zasady; ograniczone regiony nie mogą się zarejestrować. 18+ i prawo lokalne. Strona niedostępna z Turcji.",
    availabilityBody:
      "RankWagers jest otwarty na świecie poza Turcją. Lista krajów ustawia tylko domyślny język. Rejestrację decyduje operator. Nie prowadzimy hazardu; publikujemy porównania i linki partnerskie.",
  },
  a11y: { skipToContent: "Przejdź do treści" },
  predictions: predictionsEn,
};

const cs: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Všechny stránky",
    filterCrypto: "Jen krypto",
    popularCompares: "Oblíbená srovnání",
  },
  trust: {
    review: "Nezávislé recenze",
    payouts: "Rychlé výběry ověřeny",
    licensed: "Licencovaní operátoři",
    bonuses: "Exkluzivní bonusy",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Porovnejte {a} a {b}: bonusy, hodnocení, krypto a funkce.",
    fullComparison: "Srovnání vedle sebe",
    winner: "Nejlepší volba v tomto duelu",
    tie: "Remíza — porovnejte bonusy níže",
    cryptoYes: "Ano",
    cryptoNo: "Ne",
    highlights: "Klíčové funkce",
    readReview: "Celá recenze",
    crypto: "Krypto platby",
  },
  review: {
    founded: "Založeno",
    minDeposit: "Min. vklad",
    payoutTime: "Čas výběru",
    licenses: "Licence",
    payments: "Platby",
    pros: "Výhody",
    cons: "Nevýhody",
  },
  methodology: {
    title: "Jak hodnotíme",
    step1: "Testujeme registraci, vklady a bonusy na reálných účtech.",
    step2: "Kurzy, aplikace a výběry porovnáváme s lídry trhu.",
    step3: "Měsíční aktualizace; partnerství nemění skóre.",
  },
  footer: {
    affiliateNotice: "Affiliate upozornění",
    copyright: "© {year} RankWagers. Všechna práva vyhrazena.",
    eligibilityTitle: "Způsobilost a dostupnost",
    eligibilityBody:
      "Porovnáváme provozovatele, ale neposkytujeme hazard. Bonusy a registrace závisí na zemi a potvrzuje je provozovatel. Každá značka má vlastní pravidla; omezené regiony se nemohou registrovat. 18+ a místní zákony. Web není dostupný z Turecka.",
    availabilityBody:
      "RankWagers je otevřený celosvětově kromě Turecka. Seznam zemí určuje jen výchozí jazyk. Registraci rozhoduje provozovatel. Neposkytujeme sázení; publikujeme srovnání a affiliate odkazy.",
  },
  a11y: { skipToContent: "Přeskočit na obsah" },
  predictions: predictionsEn,
};

const da: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Alle sider",
    filterCrypto: "Kun krypto",
    popularCompares: "Populære sammenligninger",
  },
  trust: {
    review: "Uafhængigt anmeldt",
    payouts: "Hurtige udbetalinger tjekket",
    licensed: "Licenserede operatører",
    bonuses: "Eksklusive bonusser",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} vs {b}",
    metaDescription: "Sammenlign {a} og {b}: bonusser, ratings, krypto og funktioner.",
    fullComparison: "Sammenligning side om side",
    winner: "Topvalg i denne match",
    tie: "Uafgjort — sammenlign bonusser nedenfor",
    cryptoYes: "Ja",
    cryptoNo: "Nej",
    highlights: "Nøglefunktioner",
    readReview: "Fuld anmeldelse",
    crypto: "Kryptobetalinger",
  },
  review: {
    founded: "Grundlagt",
    minDeposit: "Min. indskud",
    payoutTime: "Udbetalingstid",
    licenses: "Licence",
    payments: "Betalinger",
    pros: "Fordele",
    cons: "Ulemper",
  },
  methodology: {
    title: "Sådan vurderer vi",
    step1: "Vi tester tilmelding, indskud og bonus på rigtige konti.",
    step2: "Odds, app og udbetalinger sammenlignes med markedsledere.",
    step3: "Månedlige opdateringer; partnerskaber ændrer ikke scores.",
  },
  footer: {
    affiliateNotice: "Affiliate-oplysning",
    copyright: "© {year} RankWagers. Alle rettigheder forbeholdes.",
    eligibilityTitle: "Berettigelse og tilgængelighed",
    eligibilityBody:
      "Vi sammenligner operatører men tilbyder ikke gambling. Bonusser og tilmelding afhænger af land og bekræftes kun af operatøren. Hvert brand har egne regler; begrænsede regioner kan ikke tilmelde sig. 18+ og lokale love. Websted ikke tilgængeligt fra Tyrkiet.",
    availabilityBody:
      "RankWagers er åbent worldwide undtagen Tyrkiet. Landelisten sætter kun standardsprog. Tilmelding afgøres af operatøren. Vi driver ikke væddemål; vi publicerer sammenligninger og affiliatelinks.",
  },
  a11y: { skipToContent: "Spring til indhold" },
  predictions: predictionsEn,
};

const sw: DictionaryExtras = {
  ...en,
  home: {
    filterAll: "Tovuti zote",
    filterCrypto: "Kripto tu",
    popularCompares: "Ulinganisho maarufu",
  },
  trust: {
    review: "Ukaguzi huru",
    payouts: "Malipo ya haraka yamethibitishwa",
    licensed: "Waendeshaji wenye leseni",
    bonuses: "Bonasi za kipekee",
    socialProof:
      "{count}+ bookmakers reviewed · Independent scores · Lists updated daily",
  },
  compare: {
    vsTitle: "{a} dhidi ya {b}",
    metaDescription: "Linganisha {a} na {b}: bonasi, ukadiriaji, kripto na vipengele.",
    fullComparison: "Ulinganisho kwa upande",
    winner: "Chaguo bora katika mechi hii",
    tie: "Sare — linganisha bonasi hapa chini",
    cryptoYes: "Ndiyo",
    cryptoNo: "Hapana",
    highlights: "Vipengele muhimu",
    readReview: "Ukaguzi kamili",
    crypto: "Malipo ya kripto",
  },
  review: {
    founded: "Ilianzishwa",
    minDeposit: "Amana ya chini",
    payoutTime: "Muda wa malipo",
    licenses: "Leseni",
    payments: "Njia za malipo",
    pros: "Faida",
    cons: "Hasara",
  },
  methodology: {
    title: "Jinsi tunavyokadiria",
    step1: "Tunajaribu usajili, amana na bonasi kwenye akaunti halisi.",
    step2: "Odds, app na malipo yanalinganishwa na viongozi wa soko.",
    step3: "Sasisho la kila mwezi; ushirikiano haubadilishi alama.",
  },
  footer: {
    affiliateNotice: "Taarifa ya ushirika",
    copyright: "© {year} RankWagers. Haki zote zimehifadhiwa.",
    eligibilityTitle: "Kustahili na upatikanaji",
    eligibilityBody:
      "Tunalinganisha waendeshaji lakini hatutoi kamari. Bonasi na usajili hutegemea nchi yako na waendeshaji ndiye anayethibitisha. Kila chapa ina sheria zake; maeneo yaliyozuiliwa hawawezi kusajili. 18+ na sheria za ndani. Tovuti haipatikani kutoka Uturuki.",
    availabilityBody:
      "RankWagers imefunguliwa ulimwenguni isipokuwa Uturuki. Orodha ya nchi inaweka lugha ya msingi tu. Usajili unaamuliwa na waendeshaji. Hatuendeshi kamari; tunachapisha ulinganisho na viungo vya ushirika.",
  },
  a11y: { skipToContent: "Ruka kwenye maudhui" },
  predictions: predictionsEn,
};

const extras: Partial<Record<Locale, DictionaryExtras>> = {
  en,
  fr,
  es,
  pt,
  de,
  ar,
  it,
  nl,
  pl,
  cs,
  da,
  sw,
};

export function getDictionaryExtras(locale: Locale): DictionaryExtras {
  const hit =
    extras[locale] ?? (locale === "es-es" ? extras.es : undefined) ?? extras.en!;
  const predictions = getPredictionsForLocale(locale);
  return { ...hit, predictions };
}

/* Moved to lib/formatDict.ts (pure, dependency-free) so client components can
   use it WITHOUT dragging this module's 30-locale dictionary graph into the
   client bundle. Re-exported here for the existing server-side callers. */
export { formatDict } from "./formatDict";
