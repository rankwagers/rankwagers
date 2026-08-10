import type { Locale } from "../i18n";
import type { PredictionStrings } from "./predictionsEn";
import { predictionsEn } from "./predictionsEn";
import { mergePredictions } from "./mergePredictions";
import * as europe from "./predictionsLocalesEurope";
import * as asia from "./predictionsLocalesAsia";

const pt: PredictionStrings = mergePredictions({
  metaTitle: "Pronósticos de hoje — Mais de 1,5, 2,5 e gols por tempo",
  metaDescription:
    "Listas diárias com model: gols no 1º tempo, mais de 1,5, mais de 2,5 e probabilidades no 2º tempo.",
  heroBadge: "Palpites do dia",
  heroTitle: "Pronósticos de mercados de gols hoje",
  heroSubtitle:
    "Jogos que passam nossos filtros para gols no 1T, mais de 1,5 e mais de 2,5 — atualizados ao longo do dia.",
  dateLabel: "Data",
  timezoneNote: "Horários de início em Istambul (TR)",
  timezoneLocalNote: "Horários e contagem no seu fuso local",
  tabFh: "1º tempo 0,5+",
  tabOver15: "Mais de 1,5",
  tabOver25: "Mais de 2,5",
  tabSh: "2º tempo 0,5+",
  colTime: "Hora",
  colMatch: "Jogo",
  colLeague: "Liga",
  colPct: "Prob.",
  colStatus: "Status",
  empty: "Nenhum jogo atinge o limite para este mercado hoje.",
  apiError: "Não foi possível carregar as listas de hoje. Tente mais tarde.",
  liveSoonTitle: "Sinais ao vivo",
  liveSoonBody:
    "Alertas de gols em tempo real do nosso motor Telegram. Um palpite grátis por hora — desbloqueie mais com bookmakers parceiros ou Telegram.",
  liveSoonBodyStats:
    "Motor ao vivo quieto — ainda mostramos jogos de alto potencial das listas de hoje. Alertas completos voltam no Telegram nos horários de pico.",
  liveFeedHourlyNote: "Palpite grátis da hora (reinicia na hora UTC)",
  liveFeaturedLabel: "Palpite da hora",
  liveFeaturedMoreCta: "Toque para mais pronósticos",
  liveFeaturedWonBadge: "GANHOU",
  liveFeaturedWinPendingBadge: "GOL",
  liveFeaturedWonLine: "Pronóstico certo — belo palpite",
  liveFeaturedWinPendingLine: "Gol marcado — confirmando a vitória",
  liveUnlockTitle: "Desbloquear este palpite ao vivo",
  liveUnlockBody:
    "Este pronóstico é para jogadores verificados. Cadastre e deposite com um bookmaker parceiro ou entre no fluxo VIP do Telegram — depois receba o link do grupo privado.",
  liveUnlockAffiliate: "Ver sites de apostas parceiros",
  liveUnlockTelegram: "Abrir bot do Telegram",
  liveUnlockTelegramChannel: "Abrir canal do Telegram",
  liveUnlockTelegramSoon: "Link do Telegram não configurado",
  liveEmpty: "Sem sinais ao vivo agora. Volte nos horários de jogos.",
  liveEmptySoft:
    "Sem palpite ao vivo nesta hora — veja as listas de hoje abaixo ou os próximos jogos.",
  liveNewBadge: "Novo",
  liveTapUnlock: "Toque para desbloquear",
  upcomingSectionLabel: "Próximos (2–3 h)",
  upcomingFeaturedLabel: "Próximo palpite",
  upcomingStartsIn: "Começa em {mins} min",
  upcomingTapMore: "Clique para mais jogos próximos",
  upcomingTapSeePick: "Clique para ver o pronóstico",
  upcomingUnlockTitle: "Mais jogos próximos no Telegram",
  upcomingUnlockBody:
    "Publicamos listas completas no bot do Telegram algumas horas antes do jogo. Abra o bot para ver todos os sinais.",
  bannerLabel: "Banner",
  bannerPlaceholder: "Espaço publicitário — formato vertical",
  statusLive: "Ao vivo",
  statusFt: "Fim",
  statusScheduled: "Próximo",
  playNow: "Ver operadores",
  playNowAria: "Ver melhores sites de apostas",
  navTodayLists: "Listas de hoje",
  heroCtaPrimary: "Comparar sites de apostas",
  heroCtaSecondary: "Resgatar bônus",
  colPctTooltip:
    "% de potencial para este mercado — indicador estatístico, não garantia.",
  promoTopSitesTitle: "Operadores",
  promoTopSitesBody: "Análises independentes, bônus de boas-vindas e saques rápidos.",
  promoTopSitesCta: "Ver rankings",
  promoBonusesTitle: "Promoções de operadores",
  promoBonusesBody: "Ofertas anunciadas dos operadores listados, com os seus termos declarados.",
  promoBonusesCta: "Ver bônus",
  promoTelegramTitle: "Promoções de operadores no Telegram",
  promoTelegramBody: "Ofertas promocionais de operadores listados. Conteúdo comercial.",
  promoTelegramCta: "Abrir Telegram",
  matchDetailTapHint: "Toque no jogo para estatísticas",
  matchDetailVenueHome: "Em casa",
  matchDetailVenueAway: "Fora",
  matchDetailGoalsTitle: "Gols por jogo (casa/fora)",
  matchDetailScoredAvg: "Marcados",
  matchDetailConcededAvg: "Sofridos",
  matchDetailBlendNote:
    "Médias do lado {blend}% · Potencial do jogo {match}%",
  matchDetailAiTitle: "Visão IA",
  matchDetailAiReason: "Por quê",
  matchDetailPlayedNote: "Amostra da temporada: {home} jogos em casa · {away} fora",
  matchDetailError: "Não foi possível carregar os detalhes do jogo.",
  /* Fixture page — the five-level architecture (fx*), translated in the close-out pass. */
  fxLeadEyebrow: "Achado principal",
  fxSupportsTitle: "Sinais de apoio",
  fxSupportsDescription:
    "Cada linha segue a mesma gramática: o achado, a frequência, o número de jogos e a taxa da liga como referência.",
  fxExplainerLabel: "Como classificamos",
  fxExplainerBody:
    "Cada sinal é pontuado pela distância entre a sua taxa e a taxa da liga nesta competição, ponderada pelo tamanho da amostra (n/(n+5)). Menos de cinco jogos nunca entra no ranking — uma sequência curta é contexto, não um achado. Um mercado sem referência da liga nunca é comparado a um número inventado; fica no detalhe completo abaixo. O sinal mais forte só lidera a página quando supera um limiar fixo; quando nenhum supera, a página fica sem achado principal em vez de fabricar um.",
  fxSignalLine: "{finding}: {count} de {scope} ({rate}%) — média da liga {baseline}%.",
  fxSignalLineNoBaseline: "{finding}: {count} de {scope} ({rate}%) — sem referência da liga.",
  fxScopeHomeVenue: "{n} jogos em casa do {team} nesta temporada",
  fxScopeAwayVenue: "{n} jogos fora do {team} nesta temporada",
  fxScopeRecentHome: "últimos {n} jogos do {team} em casa",
  fxScopeRecentAway: "últimos {n} jogos do {team} fora",
  fxScopeH2h: "últimos {n} confrontos diretos",
  fxFindingOver15Up: "Os gols continuam saindo",
  fxFindingOver15Down: "Gols estão escassos",
  fxFindingOver25Up: "Jogos de muitos gols continuam",
  fxFindingOver25Down: "Jogos de muitos gols são raros",
  fxFindingOver35Up: "Jogos de quatro gols continuam",
  fxFindingOver35Down: "Jogos de quatro gols são raros",
  fxFindingFh05Up: "Gols no primeiro tempo continuam",
  fxFindingFh05Down: "Primeiros tempos começam quietos",
  fxFindingSh05Up: "Gols no segundo tempo continuam",
  fxFindingSh05Down: "Segundos tempos ficam quietos",
  fxFindingBttsUp: "As duas equipes seguem marcando",
  fxFindingBttsDown: "Um lado segue sem marcar",
  fxFindingCleanSheetsUp: "Jogos sem sofrer gols continuam",
  fxFindingCleanSheetsDown: "Jogos sem sofrer gols são raros",
  fxFindingFailedToScoreUp: "Jogos sem marcar continuam",
  fxFindingFailedToScoreDown: "Jogos sem marcar são raros",
  fxModelTitle: "A visão do modelo",
  fxModelPotentialLine:
    "Potencial do provedor {pct}% em {market} — o número publicado pelo provedor. Não é confiança, não é preço e não carrega amostra.",
  fxWhyTitle: "Por quê",
  fxWhyIntro:
    "Como os sinais classificados acima se encontram com a leitura do próprio modelo para este jogo.",
  fxWhyAgrees:
    "Os sinais classificados e a evidência pontuada do modelo apontam na mesma direção: {supporting} de {total} sinais apoiam a direção do mercado.",
  fxWhyCaution:
    "A forma recente diz “{finding}”, mas o modelo é cauteloso: {opposing} de {total} sinais pontuados se opõem, e este jogo não superou o limiar de qualificação do modelo.",
  fxWhyModelCounts:
    "Dos {total} sinais pontuados do modelo, {supporting} apoiam e {opposing} se opõem.",
  fxWhyArchiveLine:
    "Snapshot {seq}, capturado {time} · modelo {version} · pontuação de evidência {score} · {signals} sinais: {supporting} a favor, {opposing} contra.",
  fxWhyArchiveNone:
    "Nenhum snapshot de evidência foi capturado para este jogo ainda. A leitura acima é derivada ao vivo das mesmas taxas de mando e da referência da liga que o modelo lê — nada além disso é afirmado.",
  fxDetailTitle: "Detalhe completo da pesquisa",
  fxDetailDescription:
    "Todas as taxas de mercado e mando por trás dos níveis acima — denso de propósito. Cada taxa carrega sua amostra; uma taxa ausente está ausente, não é zero.",
  fxOperatorsTitle: "Opções de operadores",
  fxOperatorsNote:
    "A pesquisa editorial acima é separada das ofertas comerciais. Os links usam redirecionamentos assinados no servidor.",

  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Número do provedor",
  fxProviderOnlyRate: "número do provedor — sem amostra",
  fxWhyWindowNote:
    "Cada taxa abaixo é da temporada no mando indicado — uma janela diferente das frases de forma recente acima.",
  fxRateHomeSeason: "Mandante em casa — esta temporada",
  fxRateAwaySeason: "Visitante fora — esta temporada",
  fxRateLeagueSeason: "Liga — esta temporada",
  fxRecordAfterKickoff: "Capturado após o pontapé inicial — excluído da liquidação.",
  fxLiveUnavailable: "atualizações ao vivo indisponíveis para esta competição",

  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Mercados de pesquisa",
  mktIndexLede:
    "Referências de mercado ligando jogos, evidência e odds observadas. Estrutura de pesquisa, nunca dicas.",
  mktLeadEyebrow: "Concentração de cobertura",
  mktLeadLine:
    "A cobertura concentra-se em {league}: {count} de {total} jogos qualificados ({pct}%).",
  mktSupportsTitle: "Sinais de cobertura",
  mktSupportsNote:
    "Contagens do conjunto de pesquisa atual — as listas qualificadas de hoje. Contagens de cobertura, não taxas de ocorrência.",
  mktQualifiedLine: "{n} jogos qualificados no conjunto de pesquisa atual",
  mktLeagueCoverageLine: "{n} competições cobertas",
  mktTopLeagueRow: "{league} — {count} de {total} ({pct}%)",
  mktProviderAvgLine:
    "Potencial médio do provedor {pct}% no conjunto qualificado — número do provedor, não uma taxa medida.",
  mktFixturesTitle: "Jogos qualificados hoje",
  mktFixturesEmpty: "Nenhum jogo qualificado para este mercado no conjunto de pesquisa atual.",
  mktDetailTitle: "Detalhe do mercado",
  mktFaqTitle: "Perguntas",
  mktRelatedTitle: "Mercados relacionados",
  mktOddsTitle: "Odds observadas",
  mktOddsEmpty:
    "Ainda não há observações de odds armazenadas para este mercado — os números aparecem só após observações verificadas.",
  mktOddsBest: "Melhor observada",
  mktOddsAverage: "Média observada",
  mktOddsLowest: "Menor observada",
  mktOddsMovements: "Movimentos",
  mktOddsClv: "Média de CLV",
  mktOddsWindowNote:
    "Todos os números vêm do conjunto de observações armazenado — nunca um preço ao vivo.",
  mktIndicatorsTitle: "Indicadores de evidência",
  mktIndicatorsShow: "Expandir definições",
  mktIndicatorsHide: "Ocultar definições",
  mktIndicatorsNote:
    "Definições de métricas deste mercado — não são valores ao vivo nem notas de confiança.",
  mktIndicatorUsed: "usado na pesquisa",
  mktIndicatorConceptual: "conceitual",

  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Competições de pesquisa",
  cmpIndexTitle: "Competições",
  cmpIndexLede:
    "Competições como polos de pesquisa — jogos qualificados, mercados, operadores e odds observadas. Estrutura de pesquisa, nunca palpites.",
  cmpLeadLine:
    "A cobertura de hoje concentra-se em {market}: {count} de {total} linhas qualificadas ({pct}%).",
  cmpQualifiedRowsLine: "{n} linhas de mercado qualificadas no conjunto de pesquisa atual",
  cmpUniqueFixturesLine: "{n} jogos únicos",
  cmpMarketRow: "{market} — {count} de {total} ({pct}%)",
  cmpUpcomingTitle: "Próximos jogos qualificados",
  cmpUpcomingEmpty:
    "Nenhum jogo qualificado próximo correspondeu a esta competição no conjunto de pesquisa atual.",
  cmpRecentTitle: "Linhas de maior sinal",
  cmpRecentNote:
    "As linhas qualificadas mais fortes do conjunto de pesquisa atual — entradas de pesquisa, não resultados.",
  cmpRecentEmpty:
    "Nenhum jogo analisado correspondeu a esta competição no conjunto de pesquisa atual.",
  cmpDetailTitle: "Detalhe da competição",
  cmpSeasonsTitle: "Temporadas",
  cmpSeasonCurrent: "atual",
  cmpMarketActivityTitle: "Atividade de mercado na amostra",
  cmpMarketActivityEmpty:
    "As linhas de mercado aparecem quando jogos qualificados correspondem a esta competição.",
  cmpRowsProviderMeta: "{n} linhas · média do fornecedor {pct}%",
  cmpRelatedCompetitions: "Competições relacionadas",
  cmpRelatedTeams: "Equipas relacionadas",
  cmpRelatedTeamsNote:
    "Com ligação quando existe uma entidade canónica da equipa; caso contrário, mostradas como rótulos de pesquisa.",
  cmpMethodologyLink: "Metodologia e evidência",
  ssnEyebrow: "Pesquisa da temporada",
  ssnCurrent: "Atual",
  ssnArchived: "Arquivada",
  ssnWindowLine: "Janela da temporada {start} → {end}",
  ssnLeadLine:
    "O conjunto de pesquisa desta temporada contém {count} linhas qualificadas em {fixtures} jogos.",
  ssnTeamsTitle: "Equipas participantes",
  ssnTeamsEmpty:
    "As equipas aparecem apenas quando presentes em jogos qualificados desta temporada.",
  ssnTeamsCountLine: "{n} equipas participantes",
  ssnUpcomingRowsLine: "{n} linhas por disputar",
  ssnCompletedRowsLine: "{n} linhas concluídas",
  ssnHomeAwayLine: "{home} linhas em casa · {away} linhas fora",
  ssnEnrichmentAbsent:
    "As taxas de golos e xG ao nível da temporada só aparecem quando existe enriquecimento de detalhe do jogo — esta página não as inventa.",
  ssnDetailTitle: "Detalhe da temporada",
  ssnOperatorsTitle: "Operadores disponíveis",
  ssnOperatorsEmpty: "Nenhum operador com afiliação ativa para o país do visitante resolvido.",

  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Equipas de pesquisa",
  tmIndexTitle: "Equipas",
  tmIndexLede:
    "Polos canónicos de pesquisa de equipas — competições, jogos qualificados, mercados e operadores. Apenas relações factuais, nunca classificações.",
  tmLeadLine:
    "O conjunto de pesquisa desta equipa contém {count} linhas qualificadas em {fixtures} jogos.",
  tmUpcomingEmpty: "Nenhum jogo qualificado próximo para esta equipa no conjunto de pesquisa atual.",
  tmRecentEmpty: "Nenhum jogo analisado para esta equipa no conjunto de pesquisa atual.",
  tmCompetitionsTitle: "Competições atuais",
  tmDetailTitle: "Detalhe da equipa",
  tmMarketProfileTitle: "Perfil de mercados de golos",
  tmMarketProfileEmpty:
    "Nenhuma linha de mercado qualificada para esta equipa na amostra de pesquisa atual.",
  tmHomeAwayNote:
    "As contagens refletem linhas de pesquisa qualificadas em que {team} joga em casa ou fora — não é uma tabela de forma nem uma classificação.",
  tmEnrichmentAbsent:
    "As taxas de golos e xG da equipa só aparecem quando existe enriquecimento de detalhe do jogo — esta página não as inventa.",
  tmRelatedTeams: "Equipas relacionadas",
  tmSearchLabel: "Pesquisar",
  tmSearchPlaceholder: "Nome da equipa",
  tmFilterCompetition: "Competição",
  tmFilterCountry: "País",
  tmAllCompetitions: "Todas as competições",
  tmAllCountries: "Todos os países",
  tmApplyFilters: "Aplicar filtros",
  tmFiltersEmpty: "Nenhuma equipa corresponde a estes filtros.",
  tmResetFilters: "Repor filtros",
  tmInternational: "Internacional",

  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Países de pesquisa",
  ctIndexTitle: "Polos de pesquisa por país",
  ctIndexLede:
    "Um polo existe apenas quando é possível reunir competições, operadores e contexto de pesquisa únicos para a região — nunca como porta geográfica vazia.",
  ctIndexEmpty: "Nenhum polo de país passa atualmente o critério de qualidade.",
  ctEyebrow: "Polo do país",
  ctLeadLine:
    "Este polo liga {competitions} competições, {operators} operadores e {fixtures} jogos arquivados.",
  ctCompetitionsCount: "{n} competições ligadas",
  ctOperatorsCount: "{n} operadores disponíveis",
  ctFixturesCount: "{n} amostras de jogos arquivados",
  ctCompetitionsTitle: "Competições relevantes",
  ctCompetitionsEmpty: "Ainda nenhuma competição do registo resolvida para este perfil.",
  ctFixturesTitle: "Jogos relacionados",
  ctFixturesEmpty: "Nenhum jogo arquivado recente correspondeu a este país.",
  ctContinueTitle: "Continuar a explorar",
  ctOperatorsTitle: "Descoberta de casas de apostas",
  ctOperatorsEmpty: "Nenhum operador verificado disponível para este contexto de país.",
  ctNoindexNote: "Este polo não está atualmente indexado ({reason}).",
  ctLinkMarkets: "Mercados de pesquisa",
  ctLinkCompetitions: "Todas as competições",
  ctLinkOperators: "Todas as casas de apostas",
  ctLinkPerformance: "Desempenho verificado",
  ctLinkAcca: "Acca Studio",

  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Verificação",
  arcIndexTitle: "Arquivo de previsões",
  arcIndexLede:
    "Cada previsão publicada das listas qualificadas e o seu resultado liquidado — vitórias e derrotas mostradas, resultados nunca reescritos.",
  arcLeadLine: "De {settled} previsões liquidadas, {won} ganharam e {lost} perderam ({pct}%).",
  arcRecordTitle: "Registo verificado do arquivo",
  arcTotalLine: "{n} previsões registadas",
  arcSettledLine: "{n} liquidadas",
  arcPendingLine: "{n} pendentes",
  arcVoidLine: "{n} anuladas",
  arcPairedRate: "{won} de {settled} ({pct}%)",
  arcOddsUnavailable:
    "Odds médias e ROI ficam indisponíveis até as odds de publicação serem armazenadas de forma durável — esta página não as inventa.",
  arcLastUpdateLabel: "Última atualização do arquivo",
  arcByMarketTitle: "Por mercado",
  arcByMarketRow: "{won} ganhas · {lost} perdidas · {pending} pendentes · {void} anuladas",
  arcByCompetitionTitle: "Principais competições na amostra",
  arcRowsN: "{n} linhas",
  arcTableMatch: "Jogo",
  arcTableMarket: "Mercado",
  arcTableResult: "Resultado",
  arcTableScore: "Marcador",
  arcTableTiming: "Tempos",
  arcTableEmpty: "Nenhuma previsão arquivada corresponde a estes filtros.",
  arcSettlementSummary: "Liquidação e evidência",
  arcOddsRowUnavailable: "Odds originais e P/L unitário indisponíveis para esta linha.",
  arcArchiveLabel: "Arquivado",
  arcKickoffLabel: "Pontapé de saída",
  arcPublishedLabel: "Publicado",
  arcFilterMarket: "Mercado",
  arcFilterStatus: "Estado",
  arcFilterCompetition: "Competição",
  arcFilterTeam: "Equipa",
  arcFilterSearch: "Pesquisar",
  arcAllMarkets: "Todos os mercados",
  arcAllStatuses: "Todos os estados",
  arcSearchPlaceholder: "Jogo ou liga",
  arcPageOf: "Página {page} de {total}",
  arcPrev: "Anterior",
  arcNext: "Seguinte",
  arcDaysTitle: "Dias de arquivo",
  arcDaysEmpty:
    "Ainda sem arquivos diários — os jogos liquidados são arquivados permanentemente e aparecem aqui.",
  arcBrowseTitle: "Percorrer previsões",
  arcShowingLine: "A mostrar {shown} de {total} linhas correspondentes",
  arcDayEyebrow: "Arquivo diário",
  arcDayLede:
    "Instantâneo histórico deste dia de pesquisa — os resultados não são reescritos após a liquidação.",
  arcDayPredictionsTitle: "Previsões de {date}",

  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Descoberta de entidades",
  srchTitle: "Pesquisa",
  srchResultsFor: "Resultados para \u201c{q}\u201d",
  srchCountLine: "{n} entidades correspondentes do registo validado",
  srchLede:
    "Pesquise no registo validado — competições, temporadas, equipas, mercados e operadores por país.",
  srchAllFilter: "Todos",
  srchEmptyNoQueryTitle: "Pesquise jogos, equipas, competições e operadores",
  srchEmptyNoQueryDesc:
    "Escreva o nome de uma competição, equipa, mercado, temporada ou operador para encontrar entidades de pesquisa validadas.",
  srchEmptyFilteredTitle: "Nenhuma entidade corresponde a estes filtros.",
  srchEmptyFilteredDesc:
    "Existem correspondências, mas nenhuma com o filtro atual de tipo ou país — limpe os filtros ou amplie a consulta.",
  srchEmptyLocaleTitle: "Idioma não disponível",
  srchEmptyLocaleDesc:
    "Este idioma não está disponível para pesquisa. Mude para um idioma suportado e tente novamente.",
  srchEmptyNoneTitle: "Sem correspondências para esta pesquisa.",
  srchEmptyNoneDesc:
    "Nada no registo validado correspondeu à consulta. Tente outra grafia, um nome alternativo da equipa ou explore a pesquisa popular abaixo.",

  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Página não encontrada",
  nfBody:
    "Este URL não faz parte do registo de pesquisa. Verifique o endereço ou continue por uma das superfícies abaixo.",
  nfHome: "Ir para o início",

  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Inteligência de operadores",
  opIndexTitle: "Operadores",
  opIndexLede:
    "Operadores de apostas como perfis de pesquisa — cobertura de mercados, disponibilidade, verificação e histórico de odds observadas. Avaliação segundo critérios publicados, nunca recomendação.",
  opVerified: "verificado",
  opUnverified: "não verificado",
  opRowMarketsCount: "{n} mercados",
  opLeadAvailable: "{operator} consta como disponível para o seu país ({country}).",
  opLeadUnavailable: "{operator} não consta como disponível para o seu país ({country}).",
  opVerificationRow: "Verificação: {status}",
  opSupportsMarketsLine: "{n} mercados suportados",
  opSupportsCountriesLine: "{n} países listados",
  opSamplesLine: "{n} observações de odds armazenadas",
  opCoverageLine: "{market} — {n} observações",
  opEvidenceNote:
    "Todos os números abaixo vêm do conjunto de observações armazenado — nada é um preço em direto, e vazio significa não observado.",
  opMarketsTitle: "Mercados suportados",
  opCountriesTitle: "Países listados",
  opCountriesNone: "Nenhuma lista de países está configurada para este operador.",
  opRecentFixtures: "Jogos observados recentemente",
  opFixtureN: "Jogo #{id}",
  opTermsTitle: "Termos declarados pelo operador",
  opTermsNote:
    "As declarações abaixo são afirmações do próprio operador — registadas para referência, não verificadas pela RankWagers.",
  opFoundedRow: "Fundado em {year}",
  opHqRow: "Sede: {hq}",
  opLicensesRow: "Licenças: {list}",
  opContinueTitle: "Continuar para este operador",
  opContinueBody:
    "Se a evidência acima for útil, a ligação comercial abaixo abre a casa de apostas. A RankWagers ganha comissão por registos e não opera serviços de jogo.",
  opContinueCta: "Continuar para {operator}",
  opContinueUnavailable: "Nenhuma ligação comercial disponível para o seu país.",
  opRelatedOperators: "Operadores relacionados",

});

const es: PredictionStrings = mergePredictions({
  metaTitle: "Pronósticos de hoy — Más de 1,5, 2,5 y goles por tiempo",
  metaDescription:
    "Listas diarias con model: goles en 1ª parte, más de 1,5, más de 2,5 y probabilidades en 2ª parte.",
  heroBadge: "Picks del día",
  heroTitle: "Pronósticos de mercados de goles hoy",
  heroSubtitle:
    "Partidos que pasan nuestros filtros para goles en 1T, más de 1,5 y más de 2,5 — actualizados durante el día.",
  dateLabel: "Fecha",
  timezoneNote: "Horarios de inicio en Estambul (TR)",
  timezoneLocalNote: "Horarios y cuenta atrás en tu zona horaria",
  tabFh: "1ª parte 0,5+",
  tabOver15: "Más de 1,5",
  tabOver25: "Más de 2,5",
  tabSh: "2ª parte 0,5+",
  colTime: "Hora",
  colMatch: "Partido",
  colLeague: "Liga",
  colPct: "Prob.",
  colStatus: "Estado",
  empty: "Hoy ningún partido alcanza el umbral para este mercado.",
  apiError: "No se pudieron cargar las listas de hoy. Inténtalo más tarde.",
  liveSoonTitle: "Señales en vivo",
  liveSoonBody:
    "Alertas de goles en tiempo real desde Telegram. Un tip gratis cada hora — desbloquea más con casas asociadas o Telegram.",
  liveSoonBodyStats:
    "Motor en vivo en silencio — seguimos mostrando partidos de alto potencial de las listas de hoy. Alertas completas vuelven en Telegram en horas pico.",
  liveFeedHourlyNote: "Tip gratis de la hora (se reinicia a la hora UTC)",
  liveFeaturedLabel: "Tip de la hora",
  liveFeaturedMoreCta: "Toca para más pronósticos",
  liveFeaturedWonBadge: "GANADO",
  liveFeaturedWinPendingBadge: "¡GOL",
  liveFeaturedWonLine: "Pronóstico acertado — buen pick",
  liveFeaturedWinPendingLine: "Gol marcado — confirmando el acierto",
  liveUnlockTitle: "Desbloquear este tip en vivo",
  liveUnlockBody:
    "Este pronóstico es para jugadores verificados. Regístrate y deposita con una casa asociada o entra al flujo VIP de Telegram para el enlace del grupo privado.",
  liveUnlockAffiliate: "Ver casas de apuestas asociadas",
  liveUnlockTelegram: "Abrir bot de Telegram",
  liveUnlockTelegramChannel: "Abrir canal de Telegram",
  liveUnlockTelegramSoon: "Enlace de Telegram no configurado",
  liveEmpty: "Sin señales en vivo ahora. Vuelve en horario de partidos.",
  liveEmptySoft:
    "Sin tip destacado esta hora — revisa las listas de hoy abajo o los próximos partidos.",
  liveNewBadge: "Nuevo",
  liveTapUnlock: "Toca para desbloquear",
  upcomingSectionLabel: "Próximos (2–3 h)",
  upcomingFeaturedLabel: "Siguiente pick",
  upcomingStartsIn: "Empieza en {mins} min",
  upcomingTapMore: "Clic para más partidos próximos",
  upcomingTapSeePick: "Clic para ver el pronóstico",
  upcomingUnlockTitle: "Más próximos en Telegram",
  upcomingUnlockBody:
    "Publicamos listas completas en el bot de Telegram horas antes del partido. Abre el bot para ver todas las señales.",
  bannerLabel: "Banner",
  bannerPlaceholder: "Espacio publicitario — formato vertical",
  statusLive: "En vivo",
  statusFt: "Final",
  statusScheduled: "Próximo",
  playNow: "Ver operadores",
  playNowAria: "Ver mejores casas de apuestas",
  navTodayLists: "Listas de hoy",
  heroCtaPrimary: "Comparar casas de apuestas",
  heroCtaSecondary: "Reclamar bonos",
  colPctTooltip:
    "% de potencial para este mercado — indicador estadístico, no garantía.",
  promoTopSitesTitle: "Operadores",
  promoTopSitesBody: "Reseñas independientes, bonos de bienvenida y pagos rápidos.",
  promoTopSitesCta: "Ver rankings",
  promoBonusesTitle: "Promociones de operadores",
  promoBonusesBody: "Ofertas anunciadas de los operadores listados, con sus términos declarados.",
  promoBonusesCta: "Ver bonos",
  promoTelegramTitle: "Promociones de operadores en Telegram",
  promoTelegramBody: "Ofertas promocionales de operadores listados. Contenido comercial.",
  promoTelegramCta: "Abrir Telegram",
  matchDetailTapHint: "Toca el partido para estadísticas",
  matchDetailVenueHome: "En casa",
  matchDetailVenueAway: "Fuera",
  matchDetailGoalsTitle: "Goles por partido (local/visitante)",
  matchDetailScoredAvg: "Marcados",
  matchDetailConcededAvg: "Recibidos",
  matchDetailBlendNote:
    "Medias del lado {blend}% · Potencial del partido {match}%",
  matchDetailAiTitle: "Perspectiva IA",
  matchDetailAiReason: "Por qué",
  matchDetailPlayedNote: "Muestra de temporada: {home} en casa · {away} fuera",
  matchDetailError: "No se pudieron cargar los detalles del partido.",
  /* Fixture page — the five-level architecture (fx*), translated in the close-out pass. */
  fxLeadEyebrow: "Hallazgo principal",
  fxSupportsTitle: "Señales de apoyo",
  fxSupportsDescription:
    "Cada fila sigue la misma gramática: el hallazgo, la frecuencia, el número de partidos y la tasa de la liga como referencia.",
  fxExplainerLabel: "Cómo se clasifican",
  fxExplainerBody:
    "Cada señal se puntúa por la distancia entre su tasa y la tasa de la liga en esta competición, ponderada por el tamaño de la muestra (n/(n+5)). Menos de cinco partidos nunca entra en el ranking — una racha corta es contexto, no un hallazgo. Un mercado sin referencia de liga nunca se compara con un número inventado; vive en el detalle completo de abajo. La señal más fuerte solo lidera la página cuando supera un umbral fijo; cuando ninguna lo hace, la página queda sin hallazgo principal en lugar de fabricarlo.",
  fxSignalLine: "{finding}: {count} de {scope} ({rate}%) — media de la liga {baseline}%.",
  fxSignalLineNoBaseline: "{finding}: {count} de {scope} ({rate}%) — sin referencia de la liga.",
  fxScopeHomeVenue: "{n} partidos en casa del {team} esta temporada",
  fxScopeAwayVenue: "{n} partidos fuera del {team} esta temporada",
  fxScopeRecentHome: "últimos {n} partidos del {team} en casa",
  fxScopeRecentAway: "últimos {n} partidos del {team} fuera",
  fxScopeH2h: "últimos {n} enfrentamientos directos",
  fxFindingOver15Up: "Los goles siguen llegando",
  fxFindingOver15Down: "Los goles escasean",
  fxFindingOver25Up: "Los partidos con muchos goles continúan",
  fxFindingOver25Down: "Los partidos con muchos goles son raros",
  fxFindingOver35Up: "Los partidos de cuatro goles continúan",
  fxFindingOver35Down: "Los partidos de cuatro goles son raros",
  fxFindingFh05Up: "Los goles en la primera parte continúan",
  fxFindingFh05Down: "Las primeras partes empiezan tranquilas",
  fxFindingSh05Up: "Los goles en la segunda parte continúan",
  fxFindingSh05Down: "Las segundas partes siguen tranquilas",
  fxFindingBttsUp: "Ambos equipos siguen marcando",
  fxFindingBttsDown: "Un lado sigue sin marcar",
  fxFindingCleanSheetsUp: "Las porterías a cero continúan",
  fxFindingCleanSheetsDown: "Las porterías a cero son raras",
  fxFindingFailedToScoreUp: "Los partidos sin marcar continúan",
  fxFindingFailedToScoreDown: "Los partidos sin marcar son raros",
  fxModelTitle: "La visión del modelo",
  fxModelPotentialLine:
    "Potencial del proveedor {pct}% en {market} — la cifra publicada por el proveedor. No es confianza, no es un precio y no lleva muestra.",
  fxWhyTitle: "Por qué",
  fxWhyIntro:
    "Cómo las señales clasificadas de arriba se encuentran con la lectura del propio modelo para este partido.",
  fxWhyAgrees:
    "Las señales clasificadas y la evidencia puntuada del modelo apuntan en la misma dirección: {supporting} de {total} señales apoyan la dirección del mercado.",
  fxWhyCaution:
    "La forma reciente dice «{finding}», pero el modelo es cauto: {opposing} de {total} señales puntuadas se oponen, y este partido no ha superado el umbral de calificación del modelo.",
  fxWhyModelCounts:
    "De las {total} señales puntuadas del modelo, {supporting} apoyan y {opposing} se oponen.",
  fxWhyArchiveLine:
    "Snapshot {seq}, capturado {time} · modelo {version} · puntuación de evidencia {score} · {signals} señales: {supporting} a favor, {opposing} en contra.",
  fxWhyArchiveNone:
    "Aún no se ha capturado ningún snapshot de evidencia para este partido. La lectura de arriba se deriva en vivo de las mismas tasas por sede y la referencia de la liga que lee el modelo — no se afirma nada más.",
  fxDetailTitle: "Detalle completo de la investigación",
  fxDetailDescription:
    "Todas las tasas de mercado y sede detrás de los niveles de arriba — denso a propósito. Cada tasa lleva su muestra; una tasa ausente está ausente, no es cero.",
  fxOperatorsTitle: "Opciones de operadores",
  fxOperatorsNote:
    "La investigación editorial de arriba está separada de las ofertas comerciales. Los enlaces usan redirecciones firmadas en el servidor.",

  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Cifra del proveedor",
  fxProviderOnlyRate: "cifra del proveedor — sin muestra",
  fxWhyWindowNote:
    "Cada tasa de abajo es de la temporada en la sede indicada — una ventana distinta de las frases de forma reciente de arriba.",
  fxRateHomeSeason: "Local en casa — esta temporada",
  fxRateAwaySeason: "Visitante fuera — esta temporada",
  fxRateLeagueSeason: "Liga — esta temporada",
  fxRecordAfterKickoff: "Capturado tras el inicio — excluido de la liquidación.",
  fxLiveUnavailable: "actualizaciones en vivo no disponibles para esta competición",

  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Mercados de investigación",
  mktIndexLede:
    "Referencias de mercado que conectan partidos, evidencia y cuotas observadas. Estructura de investigación, nunca pronósticos.",
  mktLeadEyebrow: "Concentración de cobertura",
  mktLeadLine:
    "La cobertura se concentra en {league}: {count} de {total} partidos calificados ({pct}%).",
  mktSupportsTitle: "Señales de cobertura",
  mktSupportsNote:
    "Recuentos del conjunto de investigación actual — las listas calificadas de hoy. Recuentos de cobertura, no tasas de ocurrencia.",
  mktQualifiedLine: "{n} partidos calificados en el conjunto de investigación actual",
  mktLeagueCoverageLine: "{n} competiciones cubiertas",
  mktTopLeagueRow: "{league} — {count} de {total} ({pct}%)",
  mktProviderAvgLine:
    "Potencial medio del proveedor {pct}% en el conjunto calificado — cifra del proveedor, no una tasa medida.",
  mktFixturesTitle: "Partidos calificados hoy",
  mktFixturesEmpty:
    "No hay partidos calificados para este mercado en el conjunto de investigación actual.",
  mktDetailTitle: "Detalle del mercado",
  mktFaqTitle: "Preguntas",
  mktRelatedTitle: "Mercados relacionados",
  mktOddsTitle: "Cuotas observadas",
  mktOddsEmpty:
    "Aún no hay observaciones de cuotas almacenadas para este mercado — las cifras aparecen solo tras observaciones verificadas.",
  mktOddsBest: "Mejor observada",
  mktOddsAverage: "Media observada",
  mktOddsLowest: "Mínima observada",
  mktOddsMovements: "Movimientos",
  mktOddsClv: "Media de CLV",
  mktOddsWindowNote:
    "Todas las cifras provienen del conjunto de observaciones almacenado — nunca un precio en vivo.",
  mktIndicatorsTitle: "Indicadores de evidencia",
  mktIndicatorsShow: "Ampliar definiciones",
  mktIndicatorsHide: "Ocultar definiciones",
  mktIndicatorsNote:
    "Definiciones de métricas de este mercado — no son valores en vivo ni puntuaciones de confianza.",
  mktIndicatorUsed: "usado en la investigación",
  mktIndicatorConceptual: "conceptual",

  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Competiciones de investigación",
  cmpIndexTitle: "Competiciones",
  cmpIndexLede:
    "Competiciones como núcleos de investigación — partidos calificados, mercados, operadores y cuotas observadas. Estructura de investigación, nunca pronósticos.",
  cmpLeadLine:
    "La cobertura de hoy se concentra en {market}: {count} de {total} filas calificadas ({pct}%).",
  cmpQualifiedRowsLine: "{n} filas de mercado calificadas en el conjunto de investigación actual",
  cmpUniqueFixturesLine: "{n} partidos únicos",
  cmpMarketRow: "{market} — {count} de {total} ({pct}%)",
  cmpUpcomingTitle: "Próximos partidos calificados",
  cmpUpcomingEmpty:
    "Ningún partido calificado próximo coincidió con esta competición en el conjunto de investigación actual.",
  cmpRecentTitle: "Filas de mayor señal",
  cmpRecentNote:
    "Las filas calificadas más fuertes del conjunto de investigación actual — entradas de investigación, no resultados.",
  cmpRecentEmpty:
    "Ningún partido analizado coincidió con esta competición en el conjunto de investigación actual.",
  cmpDetailTitle: "Detalle de la competición",
  cmpSeasonsTitle: "Temporadas",
  cmpSeasonCurrent: "actual",
  cmpMarketActivityTitle: "Actividad de mercado en la muestra",
  cmpMarketActivityEmpty:
    "Las filas de mercado aparecen cuando hay partidos calificados que coinciden con esta competición.",
  cmpRowsProviderMeta: "{n} filas · media del proveedor {pct}%",
  cmpRelatedCompetitions: "Competiciones relacionadas",
  cmpRelatedTeams: "Equipos relacionados",
  cmpRelatedTeamsNote:
    "Con enlace cuando existe una entidad canónica del equipo; de lo contrario, se muestran como etiquetas de investigación.",
  cmpMethodologyLink: "Metodología y evidencia",
  ssnEyebrow: "Investigación de temporada",
  ssnCurrent: "Actual",
  ssnArchived: "Archivada",
  ssnWindowLine: "Ventana de la temporada {start} → {end}",
  ssnLeadLine:
    "El conjunto de investigación de esta temporada contiene {count} filas calificadas en {fixtures} partidos.",
  ssnTeamsTitle: "Equipos participantes",
  ssnTeamsEmpty:
    "Los equipos aparecen solo cuando están presentes en partidos calificados de esta temporada.",
  ssnTeamsCountLine: "{n} equipos participantes",
  ssnUpcomingRowsLine: "{n} filas por disputar",
  ssnCompletedRowsLine: "{n} filas completadas",
  ssnHomeAwayLine: "{home} filas en casa · {away} filas fuera",
  ssnEnrichmentAbsent:
    "Las tasas de goles y xG a nivel de temporada solo se muestran cuando existe enriquecimiento de detalle del partido — esta página no las inventa.",
  ssnDetailTitle: "Detalle de la temporada",
  ssnOperatorsTitle: "Operadores disponibles",
  ssnOperatorsEmpty: "Ningún operador con afiliación activa para el país del visitante resuelto.",

  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Equipos de investigación",
  tmIndexTitle: "Equipos",
  tmIndexLede:
    "Núcleos canónicos de investigación de equipos — competiciones, partidos calificados, mercados y operadores. Solo relaciones factuales, nunca clasificaciones.",
  tmLeadLine:
    "El conjunto de investigación de este equipo contiene {count} filas calificadas en {fixtures} partidos.",
  tmUpcomingEmpty:
    "Ningún partido calificado próximo para este equipo en el conjunto de investigación actual.",
  tmRecentEmpty:
    "Ningún partido analizado para este equipo en el conjunto de investigación actual.",
  tmCompetitionsTitle: "Competiciones actuales",
  tmDetailTitle: "Detalle del equipo",
  tmMarketProfileTitle: "Perfil de mercados de goles",
  tmMarketProfileEmpty:
    "Ninguna fila de mercado calificada para este equipo en la muestra de investigación actual.",
  tmHomeAwayNote:
    "Los recuentos reflejan filas de investigación calificadas donde {team} juega en casa o fuera — no es una tabla de forma ni una clasificación.",
  tmEnrichmentAbsent:
    "Las tasas de goles y xG del equipo solo se muestran cuando existe enriquecimiento de detalle del partido — esta página no las inventa.",
  tmRelatedTeams: "Equipos relacionados",
  tmSearchLabel: "Buscar",
  tmSearchPlaceholder: "Nombre del equipo",
  tmFilterCompetition: "Competición",
  tmFilterCountry: "País",
  tmAllCompetitions: "Todas las competiciones",
  tmAllCountries: "Todos los países",
  tmApplyFilters: "Aplicar filtros",
  tmFiltersEmpty: "Ningún equipo coincide con estos filtros.",
  tmResetFilters: "Restablecer filtros",
  tmInternational: "Internacional",

  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Países de investigación",
  ctIndexTitle: "Núcleos de investigación por país",
  ctIndexLede:
    "Un núcleo existe solo cuando se pueden reunir competiciones, operadores y contexto de investigación únicos para la región — nunca como puerta geográfica vacía.",
  ctIndexEmpty: "Ningún núcleo de país supera actualmente el filtro de calidad.",
  ctEyebrow: "Núcleo del país",
  ctLeadLine:
    "Este núcleo conecta {competitions} competiciones, {operators} operadores y {fixtures} partidos archivados.",
  ctCompetitionsCount: "{n} competiciones vinculadas",
  ctOperatorsCount: "{n} operadores disponibles",
  ctFixturesCount: "{n} muestras de partidos archivados",
  ctCompetitionsTitle: "Competiciones relevantes",
  ctCompetitionsEmpty: "Aún no hay competiciones del registro resueltas para este perfil.",
  ctFixturesTitle: "Partidos relacionados",
  ctFixturesEmpty: "Ningún partido archivado reciente coincidió con este país.",
  ctContinueTitle: "Seguir explorando",
  ctOperatorsTitle: "Descubrimiento de casas de apuestas",
  ctOperatorsEmpty: "Ningún operador verificado disponible para este contexto de país.",
  ctNoindexNote: "Este núcleo no está indexado actualmente ({reason}).",
  ctLinkMarkets: "Mercados de investigación",
  ctLinkCompetitions: "Todas las competiciones",
  ctLinkOperators: "Todas las casas de apuestas",
  ctLinkPerformance: "Rendimiento verificado",
  ctLinkAcca: "Acca Studio",

  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Verificación",
  arcIndexTitle: "Archivo de predicciones",
  arcIndexLede:
    "Cada predicción publicada de las listas calificadas y su resultado liquidado — victorias y derrotas mostradas, resultados nunca reescritos.",
  arcLeadLine: "De {settled} predicciones liquidadas, {won} ganaron y {lost} perdieron ({pct}%).",
  arcRecordTitle: "Registro verificado del archivo",
  arcTotalLine: "{n} predicciones registradas",
  arcSettledLine: "{n} liquidadas",
  arcPendingLine: "{n} pendientes",
  arcVoidLine: "{n} anuladas",
  arcPairedRate: "{won} de {settled} ({pct}%)",
  arcOddsUnavailable:
    "Las cuotas medias y el ROI no están disponibles hasta que las cuotas de publicación se almacenen de forma duradera — esta página no las inventa.",
  arcLastUpdateLabel: "Última actualización del archivo",
  arcByMarketTitle: "Por mercado",
  arcByMarketRow: "{won} ganadas · {lost} perdidas · {pending} pendientes · {void} anuladas",
  arcByCompetitionTitle: "Principales competiciones en la muestra",
  arcRowsN: "{n} filas",
  arcTableMatch: "Partido",
  arcTableMarket: "Mercado",
  arcTableResult: "Resultado",
  arcTableScore: "Marcador",
  arcTableTiming: "Tiempos",
  arcTableEmpty: "Ninguna predicción archivada coincide con estos filtros.",
  arcSettlementSummary: "Liquidación y evidencia",
  arcOddsRowUnavailable: "Cuotas originales y P/L unitario no disponibles para esta fila.",
  arcArchiveLabel: "Archivado",
  arcKickoffLabel: "Inicio",
  arcPublishedLabel: "Publicado",
  arcFilterMarket: "Mercado",
  arcFilterStatus: "Estado",
  arcFilterCompetition: "Competición",
  arcFilterTeam: "Equipo",
  arcFilterSearch: "Buscar",
  arcAllMarkets: "Todos los mercados",
  arcAllStatuses: "Todos los estados",
  arcSearchPlaceholder: "Partido o liga",
  arcPageOf: "Página {page} de {total}",
  arcPrev: "Anterior",
  arcNext: "Siguiente",
  arcDaysTitle: "Días de archivo",
  arcDaysEmpty:
    "Aún sin archivos diarios — los partidos liquidados se archivan permanentemente y aparecen aquí.",
  arcBrowseTitle: "Explorar predicciones",
  arcShowingLine: "Mostrando {shown} de {total} filas coincidentes",
  arcDayEyebrow: "Archivo diario",
  arcDayLede:
    "Instantánea histórica de este día de investigación — los resultados no se reescriben tras la liquidación.",
  arcDayPredictionsTitle: "Predicciones del {date}",

  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Descubrimiento de entidades",
  srchTitle: "Búsqueda",
  srchResultsFor: "Resultados para \u201c{q}\u201d",
  srchCountLine: "{n} entidades coincidentes del registro validado",
  srchLede:
    "Busca en el registro validado — competiciones, temporadas, equipos, mercados y operadores por país.",
  srchAllFilter: "Todos",
  srchEmptyNoQueryTitle: "Busca partidos, equipos, competiciones y operadores",
  srchEmptyNoQueryDesc:
    "Escribe el nombre de una competición, equipo, mercado, temporada u operador para encontrar entidades de investigación validadas.",
  srchEmptyFilteredTitle: "Ninguna entidad coincide con estos filtros.",
  srchEmptyFilteredDesc:
    "Hay coincidencias, pero ninguna con el filtro actual de tipo o país — limpia los filtros o amplía la consulta.",
  srchEmptyLocaleTitle: "Idioma no disponible",
  srchEmptyLocaleDesc:
    "Este idioma no está disponible para la búsqueda. Cambia a un idioma compatible e inténtalo de nuevo.",
  srchEmptyNoneTitle: "Sin coincidencias para esta búsqueda.",
  srchEmptyNoneDesc:
    "Nada en el registro validado coincidió con la consulta. Prueba otra grafía, un alias del equipo o explora la investigación popular abajo.",

  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Página no encontrada",
  nfBody:
    "Esta URL no forma parte del registro de investigación. Comprueba la dirección o continúa por una de las superficies de abajo.",
  nfHome: "Ir al inicio",

  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Inteligencia de operadores",
  opIndexTitle: "Operadores",
  opIndexLede:
    "Operadores de apuestas como perfiles de investigación — cobertura de mercados, disponibilidad, verificación e historial de cuotas observadas. Evaluación según criterios publicados, nunca recomendación.",
  opVerified: "verificado",
  opUnverified: "no verificado",
  opRowMarketsCount: "{n} mercados",
  opLeadAvailable: "{operator} figura como disponible para tu país ({country}).",
  opLeadUnavailable: "{operator} no figura como disponible para tu país ({country}).",
  opVerificationRow: "Verificación: {status}",
  opSupportsMarketsLine: "{n} mercados soportados",
  opSupportsCountriesLine: "{n} países listados",
  opSamplesLine: "{n} observaciones de cuotas almacenadas",
  opCoverageLine: "{market} — {n} observaciones",
  opEvidenceNote:
    "Todas las cifras de abajo proceden del conjunto de observaciones almacenado — nada es un precio en vivo, y vacío significa no observado.",
  opMarketsTitle: "Mercados soportados",
  opCountriesTitle: "Países listados",
  opCountriesNone: "No hay lista de países configurada para este operador.",
  opRecentFixtures: "Partidos observados recientemente",
  opFixtureN: "Partido #{id}",
  opTermsTitle: "Términos declarados por el operador",
  opTermsNote:
    "Las declaraciones de abajo son afirmaciones del propio operador — registradas como referencia, no verificadas por RankWagers.",
  opFoundedRow: "Fundado en {year}",
  opHqRow: "Sede: {hq}",
  opLicensesRow: "Licencias: {list}",
  opContinueTitle: "Continuar a este operador",
  opContinueBody:
    "Si la evidencia de arriba resulta útil, el enlace comercial de abajo abre la casa de apuestas. RankWagers gana comisión por registros y no opera servicios de juego.",
  opContinueCta: "Continuar a {operator}",
  opContinueUnavailable: "No hay enlace comercial disponible para tu país.",
  opRelatedOperators: "Operadores relacionados",

});

const esEs: PredictionStrings = {
  ...es,
  heroBadge: "Selecciones del día",
  statusFt: "Fin",
};

const de: PredictionStrings = mergePredictions({
  metaTitle: "Spieltage-Tipps — Über 1,5, 2,5 & Halbzeit-Tore",
  metaDescription:
    "Tägliche Fußballlisten mit model: Tore 1. Halbzeit, Über 1,5, Über 2,5 und 2. Halbzeit.",
  heroBadge: "Tagespicks",
  heroTitle: "Tipp-Tore-Märkte heute",
  heroSubtitle:
    "Spiele mit Model-Filtern für 1H-Tore, Über 1,5 und Über 2,5 — den Tag aktualisiert.",
  dateLabel: "Datum",
  timezoneNote: "Anstoßzeiten Istanbul (TR)",
  timezoneLocalNote: "Zeiten & Countdown in Ihrer lokalen Zeitzone",
  tabFh: "1. HZ 0,5+",
  tabOver15: "Über 1,5",
  tabOver25: "Über 2,5",
  tabSh: "2. HZ 0,5+",
  colTime: "Zeit",
  colMatch: "Spiel",
  colLeague: "Liga",
  colPct: "Prob.",
  colStatus: "Status",
  empty: "Heute kein Spiel erreicht den Schwellenwert für diesen Markt.",
  apiError: "Heutige Listen konnten nicht geladen werden. Bitte später erneut versuchen.",
  liveSoonTitle: "Live-Signale",
  liveSoonBody:
    "Echtzeit-Toralarme aus unserem Telegram-Engine. Ein gratis Tipp pro Stunde — mehr über Partner-Buchmacher oder Telegram.",
  liveSoonBodyStats:
    "Live-Engine ruhig — wir zeigen weiter High-Potential-Spiele aus den heutigen Listen. Volle Alerts auf Telegram zu Stoßzeiten.",
  liveFeedHourlyNote: "Gratis-Tipp der Stunde (Reset zur vollen UTC-Stunde)",
  liveFeaturedLabel: "Tipp der Stunde",
  liveFeaturedMoreCta: "Tippen für mehr Prognosen",
  liveFeaturedWonBadge: "GEWONNEN",
  liveFeaturedWinPendingBadge: "TOR",
  liveFeaturedWonLine: "Tipp gewonnen — guter Pick",
  liveFeaturedWinPendingLine: "Tor gefallen — Gewinn wird bestätigt",
  liveUnlockTitle: "Diesen Live-Tipp freischalten",
  liveUnlockBody:
    "Dieser Tipp ist für verifizierte Spieler. Registrieren und einzahlen bei einem Partner oder Telegram-VIP — dann Link zur privaten Gruppe.",
  liveUnlockAffiliate: "Partner-Wettseiten ansehen",
  liveUnlockTelegram: "Telegram-Bot öffnen",
  liveUnlockTelegramChannel: "Telegram-Kanal öffnen",
  liveUnlockTelegramSoon: "Telegram-Link nicht konfiguriert",
  liveEmpty: "Keine Live-Signale gerade. Während Spielzeiten wieder vorbeischauen.",
  liveEmptySoft:
    "Kein Live-Tipp diese Stunde — scrollen Sie die Listen unten oder offene Spiele.",
  liveNewBadge: "Neu",
  liveTapUnlock: "Tippen zum Freischalten",
  upcomingSectionLabel: "Demnächst (2–3 Std.)",
  upcomingFeaturedLabel: "Nächster Tipp",
  upcomingStartsIn: "Beginnt in {mins} Min.",
  upcomingTapMore: "Klick für mehr kommende Spiele",
  upcomingTapSeePick: "Klick um den Tipp zu sehen",
  upcomingUnlockTitle: "Mehr Vor-Spiele auf Telegram",
  upcomingUnlockBody:
    "Vollständige Listen im Telegram-Bot einige Stunden vor Anstoß. Bot öffnen für alle Signale.",
  bannerLabel: "Banner",
  bannerPlaceholder: "Werbefläche — vertikal",
  statusLive: "Live",
  statusFt: "Ende",
  statusScheduled: "Demnächst",
  playNow: "Anbieter ansehen",
  playNowAria: "Top-Wettseiten ansehen",
  navTodayLists: "Heutige Listen",
  heroCtaPrimary: "Wettseiten vergleichen",
  heroCtaSecondary: "Boni sichern",
  colPctTooltip:
    "Model-Potenzial % für diesen Markt — statistischer Indikator, keine Garantie.",
  promoTopSitesTitle: "Anbieter",
  promoTopSitesBody: "Unabhängige Tests, Willkommensboni und schnelle Auszahlungen.",
  promoTopSitesCta: "Rankings ansehen",
  promoBonusesTitle: "Anbieter-Aktionen",
  promoBonusesBody: "Beworbene Angebote der gelisteten Anbieter, mit ihren angegebenen Bedingungen.",
  promoBonusesCta: "Boni durchsuchen",
  promoTelegramTitle: "Anbieter-Aktionen auf Telegram",
  promoTelegramBody: "Werbeangebote gelisteter Anbieter. Kommerzieller Inhalt.",
  promoTelegramCta: "Telegram öffnen",
  matchDetailTapHint: "Spiel antippen für Stats",
  matchDetailVenueHome: "Heim",
  matchDetailVenueAway: "Auswärts",
  matchDetailGoalsTitle: "Tore pro Spiel (Heim/Auswärts)",
  matchDetailScoredAvg: "Erzielt",
  matchDetailConcededAvg: "Kassiert",
  matchDetailBlendNote:
    "Seiten-Durchschnitt {blend}% · Model-Spielpotenzial {match}%",
  matchDetailAiTitle: "KI-Ausblick",
  matchDetailAiReason: "Warum",
  matchDetailPlayedNote: "Saisonstichprobe: {home} Heim · {away} Auswärts",
  matchDetailError: "Spieldetails konnten nicht geladen werden.",
  /* Fixture page — the five-level architecture (fx*), translated in the close-out pass. */
  fxLeadEyebrow: "Zentraler Befund",
  fxSupportsTitle: "Stützende Signale",
  fxSupportsDescription:
    "Jede Zeile folgt derselben Grammatik: der Befund, die Häufigkeit, die Zahl der Spiele und der Ligaschnitt als Referenz.",
  fxExplainerLabel: "So wird sortiert",
  fxExplainerBody:
    "Jedes Signal wird nach dem Abstand seiner Quote zum Ligaschnitt dieser Liga bewertet, gewichtet mit der Stichprobengröße (n/(n+5)). Weniger als fünf Spiele kommen nie in die Rangliste — eine kurze Serie ist Kontext, kein Befund. Ein Markt ohne Liga-Referenz wird nie mit einer erfundenen Zahl verglichen; er steht im vollständigen Detail unten. Das stärkste Signal führt die Seite nur an, wenn es eine feste Schwelle überschreitet; schafft das keines, bleibt die Seite ohne zentralen Befund, statt einen zu erfinden.",
  fxSignalLine: "{finding}: {count} von {scope} ({rate}%) — Ligaschnitt {baseline}%.",
  fxSignalLineNoBaseline: "{finding}: {count} von {scope} ({rate}%) — keine Liga-Referenz.",
  fxScopeHomeVenue: "{n} Heimspielen von {team} in dieser Saison",
  fxScopeAwayVenue: "{n} Auswärtsspielen von {team} in dieser Saison",
  fxScopeRecentHome: "den letzten {n} Heimspielen von {team}",
  fxScopeRecentAway: "den letzten {n} Auswärtsspielen von {team}",
  fxScopeH2h: "den letzten {n} Duellen",
  fxFindingOver15Up: "Die Tore fallen weiter",
  fxFindingOver15Down: "Tore sind Mangelware",
  fxFindingOver25Up: "Torreiche Spiele halten an",
  fxFindingOver25Down: "Torreiche Spiele sind selten",
  fxFindingOver35Up: "Spiele mit vier Toren halten an",
  fxFindingOver35Down: "Spiele mit vier Toren sind selten",
  fxFindingFh05Up: "Tore vor der Pause halten an",
  fxFindingFh05Down: "Erste Halbzeiten beginnen ruhig",
  fxFindingSh05Up: "Tore nach der Pause halten an",
  fxFindingSh05Down: "Zweite Halbzeiten bleiben ruhig",
  fxFindingBttsUp: "Beide Teams treffen weiter",
  fxFindingBttsDown: "Eine Seite bleibt weiter ohne Tor",
  fxFindingCleanSheetsUp: "Zu-null-Spiele halten an",
  fxFindingCleanSheetsDown: "Zu-null-Spiele sind selten",
  fxFindingFailedToScoreUp: "Torlose Auftritte halten an",
  fxFindingFailedToScoreDown: "Torlose Auftritte sind selten",
  fxModelTitle: "Die Sicht des Modells",
  fxModelPotentialLine:
    "Anbieter-Potenzial {pct}% auf {market} — die veröffentlichte Zahl des Anbieters. Keine Konfidenz, kein Preis, und ohne Stichprobe.",
  fxWhyTitle: "Warum",
  fxWhyIntro:
    "Wie die oben gereihten Signale auf die eigene Lesart des Modells für dieses Spiel treffen.",
  fxWhyAgrees:
    "Die gereihten Signale und die bewertete Evidenz des Modells zeigen in dieselbe Richtung: {supporting} von {total} Signalen stützen die Marktrichtung.",
  fxWhyCaution:
    "Die jüngste Form sagt „{finding}“, doch das Modell bleibt vorsichtig: {opposing} von {total} bewerteten Signalen sprechen dagegen, und dieses Spiel hat die Qualifikationsschwelle des Modells nicht überschritten.",
  fxWhyModelCounts:
    "Von den {total} bewerteten Signalen des Modells stützen {supporting}, {opposing} sprechen dagegen.",
  fxWhyArchiveLine:
    "Snapshot {seq}, erfasst {time} · Modell {version} · Evidenz-Score {score} · {signals} Signale: {supporting} dafür, {opposing} dagegen.",
  fxWhyArchiveNone:
    "Für dieses Spiel wurde noch kein Evidenz-Snapshot erfasst. Die Lesart oben wird live aus denselben Heim-/Auswärtsquoten und der Liga-Referenz abgeleitet, die das Modell liest — mehr wird nicht behauptet.",
  fxDetailTitle: "Vollständiges Recherche-Detail",
  fxDetailDescription:
    "Alle Markt- und Heim-/Auswärtsquoten hinter den Ebenen oben — bewusst dicht. Jede Quote trägt ihre Stichprobe; eine fehlende Quote fehlt, sie ist nicht null.",
  fxOperatorsTitle: "Anbieter-Optionen",
  fxOperatorsNote:
    "Die redaktionelle Recherche oben ist von kommerziellen Angeboten getrennt. Links nutzen serversignierte Weiterleitungen.",

  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Anbieter-Zahl",
  fxProviderOnlyRate: "Anbieter-Zahl — ohne Stichprobe",
  fxWhyWindowNote:
    "Jede Quote unten ist eine Saisonquote am genannten Ort — ein anderes Fenster als die Letzte-N-Formsätze oben.",
  fxRateHomeSeason: "Heimteam zu Hause — diese Saison",
  fxRateAwaySeason: "Auswärtsteam auswärts — diese Saison",
  fxRateLeagueSeason: "Liga — diese Saison",
  fxRecordAfterKickoff: "Nach Anpfiff erfasst — von der Abrechnung ausgeschlossen.",
  fxLiveUnavailable: "Live-Updates für diesen Wettbewerb nicht verfügbar",

  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Recherche-Märkte",
  mktIndexLede:
    "Marktreferenzen, die Spiele, Evidenz und beobachtete Quoten verbinden. Recherche-Struktur, niemals Tipps.",
  mktLeadEyebrow: "Abdeckungs-Schwerpunkt",
  mktLeadLine:
    "Die Abdeckung konzentriert sich auf {league}: {count} von {total} qualifizierten Spielen ({pct}%).",
  mktSupportsTitle: "Abdeckungssignale",
  mktSupportsNote:
    "Zählungen aus dem aktuellen Recherche-Satz — den heutigen qualifizierten Listen. Abdeckungszählungen, keine Häufigkeitsraten.",
  mktQualifiedLine: "{n} qualifizierte Spiele im aktuellen Recherche-Satz",
  mktLeagueCoverageLine: "{n} Wettbewerbe abgedeckt",
  mktTopLeagueRow: "{league} — {count} von {total} ({pct}%)",
  mktProviderAvgLine:
    "Mittleres Anbieter-Potenzial {pct}% über den qualifizierten Satz — eine Anbieter-Zahl, keine gemessene Rate.",
  mktFixturesTitle: "Heute qualifizierte Spiele",
  mktFixturesEmpty: "Keine qualifizierten Spiele für diesen Markt im aktuellen Recherche-Satz.",
  mktDetailTitle: "Marktdetail",
  mktFaqTitle: "Fragen",
  mktRelatedTitle: "Verwandte Märkte",
  mktOddsTitle: "Beobachtete Quoten",
  mktOddsEmpty:
    "Noch keine gespeicherten Quotenbeobachtungen für diesen Markt — Zahlen erscheinen erst nach verifizierten Beobachtungen.",
  mktOddsBest: "Beste beobachtet",
  mktOddsAverage: "Durchschnitt beobachtet",
  mktOddsLowest: "Niedrigste beobachtet",
  mktOddsMovements: "Bewegungen",
  mktOddsClv: "CLV-Durchschnitt",
  mktOddsWindowNote: "Alle Zahlen stammen aus dem gespeicherten Beobachtungssatz — nie ein Live-Preis.",
  mktIndicatorsTitle: "Evidenz-Indikatoren",
  mktIndicatorsShow: "Definitionen aufklappen",
  mktIndicatorsHide: "Definitionen verbergen",
  mktIndicatorsNote: "Metrik-Definitionen für diesen Markt — keine Live-Werte, keine Konfidenzwerte.",
  mktIndicatorUsed: "in der Recherche genutzt",
  mktIndicatorConceptual: "konzeptionell",

  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Recherche-Wettbewerbe",
  cmpIndexTitle: "Wettbewerbe",
  cmpIndexLede:
    "Wettbewerbe als Recherche-Knoten — qualifizierte Spiele, Märkte, Anbieter und beobachtete Quoten. Recherche-Struktur, niemals Tipps.",
  cmpLeadLine:
    "Die heutige Abdeckung konzentriert sich auf {market}: {count} von {total} qualifizierten Zeilen ({pct}%).",
  cmpQualifiedRowsLine: "{n} qualifizierte Marktzeilen im aktuellen Recherche-Satz",
  cmpUniqueFixturesLine: "{n} einzelne Spiele",
  cmpMarketRow: "{market} — {count} von {total} ({pct}%)",
  cmpUpcomingTitle: "Kommende qualifizierte Spiele",
  cmpUpcomingEmpty:
    "Keine kommenden qualifizierten Spiele entsprachen diesem Wettbewerb im aktuellen Recherche-Satz.",
  cmpRecentTitle: "Zeilen mit dem stärksten Signal",
  cmpRecentNote:
    "Die stärksten qualifizierten Zeilen aus dem aktuellen Recherche-Satz — Recherche-Einträge, keine Ergebnisse.",
  cmpRecentEmpty:
    "Keine analysierten Spiele entsprachen diesem Wettbewerb im aktuellen Recherche-Satz.",
  cmpDetailTitle: "Wettbewerbsdetail",
  cmpSeasonsTitle: "Saisons",
  cmpSeasonCurrent: "aktuell",
  cmpMarketActivityTitle: "Marktaktivität in der Stichprobe",
  cmpMarketActivityEmpty: "Marktzeilen erscheinen, wenn qualifizierte Spiele diesem Wettbewerb entsprechen.",
  cmpRowsProviderMeta: "{n} Zeilen · Anbieter-Durchschnitt {pct}%",
  cmpRelatedCompetitions: "Verwandte Wettbewerbe",
  cmpRelatedTeams: "Verwandte Teams",
  cmpRelatedTeamsNote:
    "Verlinkt, wenn eine kanonische Team-Entität existiert; andernfalls als Recherche-Etiketten angezeigt.",
  cmpMethodologyLink: "Methodik und Evidenz",
  ssnEyebrow: "Saison-Recherche",
  ssnCurrent: "Aktuell",
  ssnArchived: "Archiviert",
  ssnWindowLine: "Saisonfenster {start} → {end}",
  ssnLeadLine:
    "Der Recherche-Satz dieser Saison enthält {count} qualifizierte Zeilen über {fixtures} Spiele.",
  ssnTeamsTitle: "Teilnehmende Teams",
  ssnTeamsEmpty:
    "Teams erscheinen nur, wenn sie in qualifizierten Spielen dieser Saison vorkommen.",
  ssnTeamsCountLine: "{n} teilnehmende Teams",
  ssnUpcomingRowsLine: "{n} anstehende Zeilen",
  ssnCompletedRowsLine: "{n} abgeschlossene Zeilen",
  ssnHomeAwayLine: "{home} Heimzeilen · {away} Auswärtszeilen",
  ssnEnrichmentAbsent:
    "Tor- und xG-Raten auf Saisonebene erscheinen nur, wenn eine Spieldetail-Anreicherung existiert — diese Seite erfindet sie nicht.",
  ssnDetailTitle: "Saisondetail",
  ssnOperatorsTitle: "Verfügbare Anbieter",
  ssnOperatorsEmpty: "Keine affiliierten Anbieter für das ermittelte Besucherland.",

  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Recherche-Teams",
  tmIndexTitle: "Teams",
  tmIndexLede:
    "Kanonische Team-Recherche-Knoten — Wettbewerbe, qualifizierte Spiele, Märkte und Anbieter. Nur faktische Beziehungen, niemals Bewertungen.",
  tmLeadLine:
    "Der Recherche-Satz dieses Teams enthält {count} qualifizierte Zeilen über {fixtures} Spiele.",
  tmUpcomingEmpty:
    "Keine kommenden qualifizierten Spiele für dieses Team im aktuellen Recherche-Satz.",
  tmRecentEmpty: "Keine analysierten Spiele für dieses Team im aktuellen Recherche-Satz.",
  tmCompetitionsTitle: "Aktuelle Wettbewerbe",
  tmDetailTitle: "Teamdetail",
  tmMarketProfileTitle: "Tormarkt-Profil",
  tmMarketProfileEmpty:
    "Keine qualifizierten Marktzeilen für dieses Team in der aktuellen Recherche-Stichprobe.",
  tmHomeAwayNote:
    "Die Zählungen spiegeln qualifizierte Recherche-Zeilen wider, in denen {team} heim oder auswärts spielt — keine Formtabelle, keine Bewertung.",
  tmEnrichmentAbsent:
    "Tor- und xG-Raten des Teams erscheinen nur, wenn eine Spieldetail-Anreicherung existiert — diese Seite erfindet sie nicht.",
  tmRelatedTeams: "Verwandte Teams",
  tmSearchLabel: "Suchen",
  tmSearchPlaceholder: "Teamname",
  tmFilterCompetition: "Wettbewerb",
  tmFilterCountry: "Land",
  tmAllCompetitions: "Alle Wettbewerbe",
  tmAllCountries: "Alle Länder",
  tmApplyFilters: "Filter anwenden",
  tmFiltersEmpty: "Kein Team entspricht diesen Filtern.",
  tmResetFilters: "Filter zurücksetzen",
  tmInternational: "International",

  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Recherche-Länder",
  ctIndexTitle: "Länder-Recherche-Knoten",
  ctIndexLede:
    "Ein Knoten existiert nur, wenn sich für die Region eigene Wettbewerbe, Anbieter und Recherche-Kontext zusammenstellen lassen — niemals als dünne Geo-Türseite.",
  ctIndexEmpty: "Kein Länder-Knoten besteht derzeit die Qualitätsprüfung.",
  ctEyebrow: "Länder-Knoten",
  ctLeadLine:
    "Dieser Knoten verbindet {competitions} Wettbewerbe, {operators} Anbieter und {fixtures} archivierte Spiele.",
  ctCompetitionsCount: "{n} verknüpfte Wettbewerbe",
  ctOperatorsCount: "{n} verfügbare Anbieter",
  ctFixturesCount: "{n} archivierte Spielbeispiele",
  ctCompetitionsTitle: "Relevante Wettbewerbe",
  ctCompetitionsEmpty: "Noch keine Registry-Wettbewerbe für dieses Profil aufgelöst.",
  ctFixturesTitle: "Verwandte Spiele",
  ctFixturesEmpty: "Keine kürzlich archivierten Spiele entsprachen diesem Land.",
  ctContinueTitle: "Weiter erkunden",
  ctOperatorsTitle: "Buchmacher-Entdeckung",
  ctOperatorsEmpty: "Keine verifizierten Anbieter für diesen Länderkontext verfügbar.",
  ctNoindexNote: "Dieser Knoten ist derzeit nicht indexiert ({reason}).",
  ctLinkMarkets: "Recherche-Märkte",
  ctLinkCompetitions: "Alle Wettbewerbe",
  ctLinkOperators: "Alle Buchmacher",
  ctLinkPerformance: "Verifizierte Ergebnisse",
  ctLinkAcca: "Acca Studio",

  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Verifizierung",
  arcIndexTitle: "Vorhersage-Archiv",
  arcIndexLede:
    "Jede veröffentlichte Vorhersage der qualifizierten Listen und ihr abgerechnetes Ergebnis — Siege und Niederlagen gezeigt, Ergebnisse nie umgeschrieben.",
  arcLeadLine:
    "Von {settled} abgerechneten Vorhersagen gewannen {won} und verloren {lost} ({pct}%).",
  arcRecordTitle: "Verifiziertes Archiv-Register",
  arcTotalLine: "{n} erfasste Vorhersagen",
  arcSettledLine: "{n} abgerechnet",
  arcPendingLine: "{n} ausstehend",
  arcVoidLine: "{n} ungültig",
  arcPairedRate: "{won} von {settled} ({pct}%)",
  arcOddsUnavailable:
    "Durchschnittsquoten und ROI bleiben nicht verfügbar, bis Veröffentlichungsquoten dauerhaft gespeichert sind — diese Seite erfindet sie nicht.",
  arcLastUpdateLabel: "Letzte Archiv-Aktualisierung",
  arcByMarketTitle: "Nach Markt",
  arcByMarketRow: "{won} gewonnen · {lost} verloren · {pending} ausstehend · {void} ungültig",
  arcByCompetitionTitle: "Top-Wettbewerbe in der Stichprobe",
  arcRowsN: "{n} Zeilen",
  arcTableMatch: "Spiel",
  arcTableMarket: "Markt",
  arcTableResult: "Ergebnis",
  arcTableScore: "Spielstand",
  arcTableTiming: "Zeiten",
  arcTableEmpty: "Keine archivierten Vorhersagen entsprechen diesen Filtern.",
  arcSettlementSummary: "Abrechnung und Evidenz",
  arcOddsRowUnavailable: "Originalquoten und Einheiten-G/V für diese Zeile nicht verfügbar.",
  arcArchiveLabel: "Archiviert",
  arcKickoffLabel: "Anstoß",
  arcPublishedLabel: "Veröffentlicht",
  arcFilterMarket: "Markt",
  arcFilterStatus: "Status",
  arcFilterCompetition: "Wettbewerb",
  arcFilterTeam: "Team",
  arcFilterSearch: "Suchen",
  arcAllMarkets: "Alle Märkte",
  arcAllStatuses: "Alle Status",
  arcSearchPlaceholder: "Spiel oder Liga",
  arcPageOf: "Seite {page} von {total}",
  arcPrev: "Zurück",
  arcNext: "Weiter",
  arcDaysTitle: "Archivtage",
  arcDaysEmpty:
    "Noch keine Tagesarchive — abgerechnete Spiele werden dauerhaft archiviert und erscheinen hier.",
  arcBrowseTitle: "Vorhersagen durchsuchen",
  arcShowingLine: "{shown} von {total} passenden Zeilen angezeigt",
  arcDayEyebrow: "Tagesarchiv",
  arcDayLede:
    "Historische Momentaufnahme dieses Recherche-Tags — Ergebnisse werden nach der Abrechnung nicht umgeschrieben.",
  arcDayPredictionsTitle: "Vorhersagen vom {date}",

  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Entitäten-Entdeckung",
  srchTitle: "Suche",
  srchResultsFor: "Ergebnisse für \u201c{q}\u201d",
  srchCountLine: "{n} passende Entitäten aus dem validierten Register",
  srchLede:
    "Durchsuchen Sie das validierte Register — Wettbewerbe, Saisons, Teams, Märkte und länderspezifische Anbieter.",
  srchAllFilter: "Alle",
  srchEmptyNoQueryTitle: "Spiele, Teams, Wettbewerbe und Anbieter suchen",
  srchEmptyNoQueryDesc:
    "Geben Sie den Namen eines Wettbewerbs, Teams, Marktes, einer Saison oder eines Anbieters ein, um validierte Recherche-Entitäten zu finden.",
  srchEmptyFilteredTitle: "Keine Entitäten entsprechen diesen Filtern.",
  srchEmptyFilteredDesc:
    "Treffer existieren, aber keiner unter dem aktuellen Typ- oder Länderfilter — Filter löschen oder Anfrage erweitern.",
  srchEmptyLocaleTitle: "Sprache nicht verfügbar",
  srchEmptyLocaleDesc:
    "Diese Sprache ist für die Suche nicht verfügbar. Wechseln Sie zu einer unterstützten Sprache und versuchen Sie es erneut.",
  srchEmptyNoneTitle: "Keine Treffer für diese Suche.",
  srchEmptyNoneDesc:
    "Nichts im validierten Register entsprach der Anfrage. Versuchen Sie eine andere Schreibweise, einen Team-Alias, oder stöbern Sie unten in der beliebten Recherche.",

  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Seite nicht gefunden",
  nfBody:
    "Diese URL gehört nicht zum Recherche-Register. Prüfen Sie die Adresse oder fahren Sie über eine der Flächen unten fort.",
  nfHome: "Zur Startseite",

  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Anbieter-Intelligenz",
  opIndexTitle: "Anbieter",
  opIndexLede:
    "Wettanbieter als Recherche-Profile — Marktabdeckung, Verfügbarkeit, Verifizierung und beobachtete Quotenhistorie. Bewertung nach veröffentlichten Kriterien, niemals Empfehlung.",
  opVerified: "verifiziert",
  opUnverified: "nicht verifiziert",
  opRowMarketsCount: "{n} Märkte",
  opLeadAvailable: "{operator} ist für Ihr Land ({country}) als verfügbar gelistet.",
  opLeadUnavailable: "{operator} ist für Ihr Land ({country}) nicht als verfügbar gelistet.",
  opVerificationRow: "Verifizierung: {status}",
  opSupportsMarketsLine: "{n} unterstützte Märkte",
  opSupportsCountriesLine: "{n} gelistete Länder",
  opSamplesLine: "{n} gespeicherte Quotenbeobachtungen",
  opCoverageLine: "{market} — {n} Beobachtungen",
  opEvidenceNote:
    "Alle Zahlen unten stammen aus dem gespeicherten Beobachtungssatz — nichts ist ein Live-Preis, und leer bedeutet nicht beobachtet.",
  opMarketsTitle: "Unterstützte Märkte",
  opCountriesTitle: "Gelistete Länder",
  opCountriesNone: "Für diesen Anbieter ist keine Länderliste konfiguriert.",
  opRecentFixtures: "Zuletzt beobachtete Spiele",
  opFixtureN: "Spiel #{id}",
  opTermsTitle: "Vom Anbieter angegebene Bedingungen",
  opTermsNote:
    "Die Angaben unten sind die eigenen Aussagen des Anbieters — zur Referenz erfasst, nicht von RankWagers verifiziert.",
  opFoundedRow: "Gegründet {year}",
  opHqRow: "Hauptsitz: {hq}",
  opLicensesRow: "Lizenzen: {list}",
  opContinueTitle: "Weiter zu diesem Anbieter",
  opContinueBody:
    "Wenn die Evidenz oben nützlich ist, öffnet der kommerzielle Link unten das Wettportal. RankWagers verdient eine Provision an Anmeldungen und betreibt keine Glücksspieldienste.",
  opContinueCta: "Weiter zu {operator}",
  opContinueUnavailable: "Für Ihr Land ist kein kommerzieller Link verfügbar.",
  opRelatedOperators: "Verwandte Anbieter",

});

const it: PredictionStrings = mergePredictions({
  metaTitle: "Pronostici di oggi — Over 1,5, 2,5 e gol per tempo",
  metaDescription:
    "Liste giornaliere model: gol 1° tempo, over 1,5, over 2,5 e 2° tempo.",
  heroBadge: "Picks del giorno",
  heroTitle: "Pronostici mercati gol oggi",
  heroSubtitle:
    "Partite che passano i filtri per gol 1T, over 1,5 e over 2,5 — aggiornate durante il giorno.",
  dateLabel: "Data",
  timezoneNote: "Orari di inizio Istanbul (TR)",
  timezoneLocalNote: "Orari e countdown nel tuo fuso",
  tabFh: "1° tempo 0,5+",
  tabOver15: "Over 1,5",
  tabOver25: "Over 2,5",
  tabSh: "2° tempo 0,5+",
  colTime: "Ora",
  colMatch: "Partita",
  colLeague: "Lega",
  colPct: "Prob.",
  colStatus: "Stato",
  empty: "Oggi nessuna partita raggiunge la soglia per questo mercato.",
  apiError: "Impossibile caricare le liste di oggi. Riprova più tardi.",
  liveSoonTitle: "Segnali live",
  liveSoonBody:
    "Avvisi gol in tempo reale dal nostro engine Telegram. Un tip gratis ogni ora — altro con bookmaker partner o Telegram.",
  liveSoonBodyStats:
    "Engine live fermo — mostriamo ancora partite ad alto potenziale dalle liste di oggi. Alert completi su Telegram nelle ore di punta.",
  liveFeedHourlyNote: "Tip gratis dell'ora (reset all'ora UTC)",
  liveFeaturedLabel: "Tip dell'ora",
  liveFeaturedMoreCta: "Tocca per più pronostici",
  liveFeaturedWonBadge: "VINTO",
  liveFeaturedWinPendingBadge: "GOL",
  liveFeaturedWonLine: "Pronostico vincente — ottimo pick",
  liveFeaturedWinPendingLine: "Gol segnato — vittoria in arrivo",
  liveUnlockTitle: "Sblocca questo tip live",
  liveUnlockBody:
    "Questo pronostico è per giocatori verificati. Registrati e deposita con un partner o entra nel flusso VIP Telegram.",
  liveUnlockAffiliate: "Vedi siti partner",
  liveUnlockTelegram: "Apri bot Telegram",
  liveUnlockTelegramChannel: "Apri canale Telegram",
  liveUnlockTelegramSoon: "Link Telegram non configurato",
  liveEmpty: "Nessun segnale live ora. Torna nelle ore di partita.",
  liveEmptySoft:
    "Nessun tip live quest'ora — scorri le liste di oggi o i prossimi match.",
  liveNewBadge: "Nuovo",
  liveTapUnlock: "Tocca per sbloccare",
  upcomingSectionLabel: "Prossimi (2–3 h)",
  upcomingFeaturedLabel: "Prossimo pick",
  upcomingStartsIn: "Inizia tra {mins} min",
  upcomingTapMore: "Clic per più partite in arrivo",
  upcomingTapSeePick: "Clic per vedere il pronostico",
  upcomingUnlockTitle: "Altri prossimi su Telegram",
  upcomingUnlockBody:
    "Liste complete sul bot Telegram ore prima del kick-off. Apri il bot per tutti i segnali.",
  bannerLabel: "Banner",
  bannerPlaceholder: "Spazio pubblicitario — verticale",
  statusLive: "Live",
  statusFt: "Fin",
  statusScheduled: "Prossimo",
  playNow: "Vedi operatori",
  playNowAria: "Vedi i migliori siti",
  navTodayLists: "Liste di oggi",
  heroCtaPrimary: "Confronta siti di scommesse",
  heroCtaSecondary: "Riscuoti bonus",
  colPctTooltip:
    "% potenziale per questo mercato — indicatore statistico, non garanzia.",
  promoTopSitesTitle: "Operatori",
  promoTopSitesBody: "Recensioni indipendenti, bonus e pagamenti rapidi.",
  promoTopSitesCta: "Vedi ranking",
  promoBonusesTitle: "Promozioni degli operatori",
  promoBonusesBody: "Offerte pubblicizzate dagli operatori elencati, con i termini dichiarati.",
  promoBonusesCta: "Sfoglia bonus",
  promoTelegramTitle: "Promozioni degli operatori su Telegram",
  promoTelegramBody: "Offerte promozionali di operatori elencati. Contenuto commerciale.",
  promoTelegramCta: "Apri Telegram",
  matchDetailTapHint: "Tocca la partita per le stats",
  matchDetailVenueHome: "In casa",
  matchDetailVenueAway: "Fuori",
  matchDetailGoalsTitle: "Gol per partita (casa/trasferta)",
  matchDetailScoredAvg: "Segnati",
  matchDetailConcededAvg: "Subiti",
  matchDetailBlendNote:
    "Medie squadra {blend}% · Potenziale {match}%",
  matchDetailAiTitle: "Prospettiva IA",
  matchDetailAiReason: "Perché",
  matchDetailPlayedNote: "Campione stagione: {home} casa · {away} trasferta",
  matchDetailError: "Impossibile caricare i dettagli della partita.",
  /* Fixture page — the five-level architecture (fx*), translated in the close-out pass. */
  fxLeadEyebrow: "Riscontro principale",
  fxSupportsTitle: "Segnali a supporto",
  fxSupportsDescription:
    "Ogni riga segue la stessa grammatica: il riscontro, la frequenza, il numero di partite e il tasso della lega come riferimento.",
  fxExplainerLabel: "Come vengono ordinati",
  fxExplainerBody:
    "Ogni segnale è valutato in base alla distanza tra il suo tasso e il tasso della lega in questa competizione, ponderata per la dimensione del campione (n/(n+5)). Meno di cinque partite non entra mai in classifica — una serie breve è contesto, non un riscontro. Un mercato senza riferimento di lega non viene mai confrontato con un numero inventato; vive nel dettaglio completo qui sotto. Il segnale più forte guida la pagina solo se supera una soglia fissa; quando nessuno la supera, la pagina resta senza riscontro principale invece di fabbricarne uno.",
  fxSignalLine: "{finding}: {count} su {scope} ({rate}%) — media della lega {baseline}%.",
  fxSignalLineNoBaseline: "{finding}: {count} su {scope} ({rate}%) — nessun riferimento di lega.",
  fxScopeHomeVenue: "{n} partite in casa del {team} in questa stagione",
  fxScopeAwayVenue: "{n} partite in trasferta del {team} in questa stagione",
  fxScopeRecentHome: "le ultime {n} partite del {team} in casa",
  fxScopeRecentAway: "le ultime {n} partite del {team} in trasferta",
  fxScopeH2h: "gli ultimi {n} scontri diretti",
  fxFindingOver15Up: "I gol continuano ad arrivare",
  fxFindingOver15Down: "I gol scarseggiano",
  fxFindingOver25Up: "Le partite ricche di gol continuano",
  fxFindingOver25Down: "Le partite ricche di gol sono rare",
  fxFindingOver35Up: "Le partite da quattro gol continuano",
  fxFindingOver35Down: "Le partite da quattro gol sono rare",
  fxFindingFh05Up: "I gol nel primo tempo continuano",
  fxFindingFh05Down: "I primi tempi partono quieti",
  fxFindingSh05Up: "I gol nel secondo tempo continuano",
  fxFindingSh05Down: "I secondi tempi restano quieti",
  fxFindingBttsUp: "Entrambe le squadre continuano a segnare",
  fxFindingBttsDown: "Una parte resta a secco",
  fxFindingCleanSheetsUp: "Le porte inviolate continuano",
  fxFindingCleanSheetsDown: "Le porte inviolate sono rare",
  fxFindingFailedToScoreUp: "Le partite senza segnare continuano",
  fxFindingFailedToScoreDown: "Le partite senza segnare sono rare",
  fxModelTitle: "La lettura del modello",
  fxModelPotentialLine:
    "Potenziale del provider {pct}% su {market} — la cifra pubblicata dal provider. Non è confidenza, non è un prezzo e non porta campione.",
  fxWhyTitle: "Perché",
  fxWhyIntro:
    "Come i segnali ordinati sopra incontrano la lettura del modello stesso per questa partita.",
  fxWhyAgrees:
    "I segnali ordinati e l'evidenza valutata del modello puntano nella stessa direzione: {supporting} dei suoi {total} segnali sostengono la direzione del mercato.",
  fxWhyCaution:
    "La forma recente dice “{finding}”, ma il modello resta cauto: {opposing} dei suoi {total} segnali valutati si oppongono, e questa partita non ha superato la soglia di qualificazione del modello.",
  fxWhyModelCounts:
    "Dei {total} segnali valutati del modello, {supporting} sostengono e {opposing} si oppongono.",
  fxWhyArchiveLine:
    "Snapshot {seq}, catturato {time} · modello {version} · punteggio di evidenza {score} · {signals} segnali: {supporting} a favore, {opposing} contrari.",
  fxWhyArchiveNone:
    "Per questa partita non è stato ancora catturato alcuno snapshot di evidenza. La lettura sopra è derivata dal vivo dagli stessi tassi per sede e dal riferimento di lega che il modello legge — nulla oltre viene affermato.",
  fxDetailTitle: "Dettaglio completo della ricerca",
  fxDetailDescription:
    "Tutti i tassi di mercato e di sede dietro i livelli sopra — denso di proposito. Ogni tasso porta il suo campione; un tasso assente è assente, non è zero.",
  fxOperatorsTitle: "Opzioni operatori",
  fxOperatorsNote:
    "La ricerca editoriale sopra è separata dalle offerte commerciali. I link usano redirect firmati lato server.",

  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Cifra del provider",
  fxProviderOnlyRate: "cifra del provider — senza campione",
  fxWhyWindowNote:
    "Ogni tasso qui sotto è stagionale nella sede indicata — una finestra diversa dalle frasi di forma recente sopra.",
  fxRateHomeSeason: "Squadra di casa in casa — questa stagione",
  fxRateAwaySeason: "Squadra ospite in trasferta — questa stagione",
  fxRateLeagueSeason: "Lega — questa stagione",
  fxRecordAfterKickoff: "Catturato dopo il fischio d'inizio — escluso dal regolamento.",
  fxLiveUnavailable: "aggiornamenti live non disponibili per questa competizione",

  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Mercati di ricerca",
  mktIndexLede:
    "Riferimenti di mercato che collegano partite, evidenza e quote osservate. Struttura di ricerca, mai pronostici.",
  mktLeadEyebrow: "Concentrazione di copertura",
  mktLeadLine:
    "La copertura si concentra su {league}: {count} di {total} partite qualificate ({pct}%).",
  mktSupportsTitle: "Segnali di copertura",
  mktSupportsNote:
    "Conteggi dal set di ricerca attuale — le liste qualificate di oggi. Conteggi di copertura, non tassi di occorrenza.",
  mktQualifiedLine: "{n} partite qualificate nel set di ricerca attuale",
  mktLeagueCoverageLine: "{n} competizioni coperte",
  mktTopLeagueRow: "{league} — {count} di {total} ({pct}%)",
  mktProviderAvgLine:
    "Potenziale medio del provider {pct}% sul set qualificato — cifra del provider, non un tasso misurato.",
  mktFixturesTitle: "Partite qualificate oggi",
  mktFixturesEmpty: "Nessuna partita qualificata per questo mercato nel set di ricerca attuale.",
  mktDetailTitle: "Dettaglio del mercato",
  mktFaqTitle: "Domande",
  mktRelatedTitle: "Mercati correlati",
  mktOddsTitle: "Quote osservate",
  mktOddsEmpty:
    "Ancora nessuna osservazione di quote archiviata per questo mercato — le cifre appaiono solo dopo osservazioni verificate.",
  mktOddsBest: "Migliore osservata",
  mktOddsAverage: "Media osservata",
  mktOddsLowest: "Minima osservata",
  mktOddsMovements: "Movimenti",
  mktOddsClv: "Media CLV",
  mktOddsWindowNote: "Tutte le cifre vengono dal set di osservazioni archiviato — mai un prezzo live.",
  mktIndicatorsTitle: "Indicatori di evidenza",
  mktIndicatorsShow: "Espandi definizioni",
  mktIndicatorsHide: "Nascondi definizioni",
  mktIndicatorsNote:
    "Definizioni delle metriche di questo mercato — non valori live né punteggi di fiducia.",
  mktIndicatorUsed: "usato nella ricerca",
  mktIndicatorConceptual: "concettuale",

  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Competizioni di ricerca",
  cmpIndexTitle: "Competizioni",
  cmpIndexLede:
    "Le competizioni come nodi di ricerca — partite qualificate, mercati, operatori e quote osservate. Struttura di ricerca, mai pronostici.",
  cmpLeadLine:
    "La copertura di oggi si concentra su {market}: {count} su {total} righe qualificate ({pct}%).",
  cmpQualifiedRowsLine: "{n} righe di mercato qualificate nell'insieme di ricerca attuale",
  cmpUniqueFixturesLine: "{n} partite uniche",
  cmpMarketRow: "{market} — {count} su {total} ({pct}%)",
  cmpUpcomingTitle: "Prossime partite qualificate",
  cmpUpcomingEmpty:
    "Nessuna partita qualificata in arrivo corrisponde a questa competizione nell'insieme di ricerca attuale.",
  cmpRecentTitle: "Righe con il segnale più forte",
  cmpRecentNote:
    "Le righe qualificate più forti dell'insieme di ricerca attuale — voci di ricerca, non risultati.",
  cmpRecentEmpty:
    "Nessuna partita analizzata corrisponde a questa competizione nell'insieme di ricerca attuale.",
  cmpDetailTitle: "Dettaglio della competizione",
  cmpSeasonsTitle: "Stagioni",
  cmpSeasonCurrent: "in corso",
  cmpMarketActivityTitle: "Attività di mercato nel campione",
  cmpMarketActivityEmpty:
    "Le righe di mercato compaiono quando partite qualificate corrispondono a questa competizione.",
  cmpRowsProviderMeta: "{n} righe · media fornitore {pct}%",
  cmpRelatedCompetitions: "Competizioni correlate",
  cmpRelatedTeams: "Squadre correlate",
  cmpRelatedTeamsNote:
    "Con collegamento quando esiste un'entità canonica della squadra; altrimenti mostrate come etichette di ricerca.",
  cmpMethodologyLink: "Metodologia ed evidenza",
  ssnEyebrow: "Ricerca di stagione",
  ssnCurrent: "In corso",
  ssnArchived: "Archiviata",
  ssnWindowLine: "Finestra della stagione {start} → {end}",
  ssnLeadLine:
    "L'insieme di ricerca di questa stagione contiene {count} righe qualificate su {fixtures} partite.",
  ssnTeamsTitle: "Squadre partecipanti",
  ssnTeamsEmpty:
    "Le squadre compaiono solo quando presenti in partite qualificate di questa stagione.",
  ssnTeamsCountLine: "{n} squadre partecipanti",
  ssnUpcomingRowsLine: "{n} righe in arrivo",
  ssnCompletedRowsLine: "{n} righe completate",
  ssnHomeAwayLine: "{home} righe in casa · {away} righe in trasferta",
  ssnEnrichmentAbsent:
    "I tassi di gol e xG a livello di stagione compaiono solo quando esiste l'arricchimento del dettaglio partita — questa pagina non li inventa.",
  ssnDetailTitle: "Dettaglio della stagione",
  ssnOperatorsTitle: "Operatori disponibili",
  ssnOperatorsEmpty: "Nessun operatore affiliato attivo per il paese del visitatore risolto.",

  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Squadre di ricerca",
  tmIndexTitle: "Squadre",
  tmIndexLede:
    "Nodi canonici di ricerca sulle squadre — competizioni, partite qualificate, mercati e operatori. Solo relazioni fattuali, mai valutazioni.",
  tmLeadLine:
    "L'insieme di ricerca di questa squadra contiene {count} righe qualificate su {fixtures} partite.",
  tmUpcomingEmpty:
    "Nessuna partita qualificata in arrivo per questa squadra nell'insieme di ricerca attuale.",
  tmRecentEmpty: "Nessuna partita analizzata per questa squadra nell'insieme di ricerca attuale.",
  tmCompetitionsTitle: "Competizioni attuali",
  tmDetailTitle: "Dettaglio della squadra",
  tmMarketProfileTitle: "Profilo dei mercati gol",
  tmMarketProfileEmpty:
    "Nessuna riga di mercato qualificata per questa squadra nel campione di ricerca attuale.",
  tmHomeAwayNote:
    "I conteggi riflettono righe di ricerca qualificate in cui {team} gioca in casa o in trasferta — non è una tabella di forma né una valutazione.",
  tmEnrichmentAbsent:
    "I tassi di gol e xG della squadra compaiono solo quando esiste l'arricchimento del dettaglio partita — questa pagina non li inventa.",
  tmRelatedTeams: "Squadre correlate",
  tmSearchLabel: "Cerca",
  tmSearchPlaceholder: "Nome della squadra",
  tmFilterCompetition: "Competizione",
  tmFilterCountry: "Paese",
  tmAllCompetitions: "Tutte le competizioni",
  tmAllCountries: "Tutti i paesi",
  tmApplyFilters: "Applica filtri",
  tmFiltersEmpty: "Nessuna squadra corrisponde a questi filtri.",
  tmResetFilters: "Reimposta filtri",
  tmInternational: "Internazionale",

  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Paesi di ricerca",
  ctIndexTitle: "Nodi di ricerca per paese",
  ctIndexLede:
    "Un nodo esiste solo quando è possibile riunire competizioni, operatori e contesto di ricerca unici per la regione — mai come porta geografica vuota.",
  ctIndexEmpty: "Nessun nodo paese supera attualmente il filtro di qualità.",
  ctEyebrow: "Nodo del paese",
  ctLeadLine:
    "Questo nodo collega {competitions} competizioni, {operators} operatori e {fixtures} partite archiviate.",
  ctCompetitionsCount: "{n} competizioni collegate",
  ctOperatorsCount: "{n} operatori disponibili",
  ctFixturesCount: "{n} campioni di partite archiviate",
  ctCompetitionsTitle: "Competizioni rilevanti",
  ctCompetitionsEmpty: "Nessuna competizione del registro risolta per questo profilo, per ora.",
  ctFixturesTitle: "Partite correlate",
  ctFixturesEmpty: "Nessuna partita archiviata recente corrisponde a questo paese.",
  ctContinueTitle: "Continua a esplorare",
  ctOperatorsTitle: "Scoperta dei bookmaker",
  ctOperatorsEmpty: "Nessun operatore verificato disponibile per questo contesto paese.",
  ctNoindexNote: "Questo nodo non è attualmente indicizzato ({reason}).",
  ctLinkMarkets: "Mercati di ricerca",
  ctLinkCompetitions: "Tutte le competizioni",
  ctLinkOperators: "Tutti i bookmaker",
  ctLinkPerformance: "Rendimento verificato",
  ctLinkAcca: "Acca Studio",

  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Verifica",
  arcIndexTitle: "Archivio delle previsioni",
  arcIndexLede:
    "Ogni previsione pubblicata delle liste qualificate e il suo esito regolato — vittorie e sconfitte mostrate, esiti mai riscritti.",
  arcLeadLine: "Su {settled} previsioni regolate, {won} vinte e {lost} perse ({pct}%).",
  arcRecordTitle: "Registro verificato dell'archivio",
  arcTotalLine: "{n} previsioni registrate",
  arcSettledLine: "{n} regolate",
  arcPendingLine: "{n} in sospeso",
  arcVoidLine: "{n} annullate",
  arcPairedRate: "{won} su {settled} ({pct}%)",
  arcOddsUnavailable:
    "Quote medie e ROI restano indisponibili finché le quote di pubblicazione non sono archiviate in modo durevole — questa pagina non le inventa.",
  arcLastUpdateLabel: "Ultimo aggiornamento dell'archivio",
  arcByMarketTitle: "Per mercato",
  arcByMarketRow: "{won} vinte · {lost} perse · {pending} in sospeso · {void} annullate",
  arcByCompetitionTitle: "Principali competizioni nel campione",
  arcRowsN: "{n} righe",
  arcTableMatch: "Partita",
  arcTableMarket: "Mercato",
  arcTableResult: "Esito",
  arcTableScore: "Punteggio",
  arcTableTiming: "Orari",
  arcTableEmpty: "Nessuna previsione archiviata corrisponde a questi filtri.",
  arcSettlementSummary: "Regolamento ed evidenza",
  arcOddsRowUnavailable: "Quote originali e P/L unitario non disponibili per questa riga.",
  arcArchiveLabel: "Archiviato",
  arcKickoffLabel: "Calcio d'inizio",
  arcPublishedLabel: "Pubblicato",
  arcFilterMarket: "Mercato",
  arcFilterStatus: "Stato",
  arcFilterCompetition: "Competizione",
  arcFilterTeam: "Squadra",
  arcFilterSearch: "Cerca",
  arcAllMarkets: "Tutti i mercati",
  arcAllStatuses: "Tutti gli stati",
  arcSearchPlaceholder: "Partita o campionato",
  arcPageOf: "Pagina {page} di {total}",
  arcPrev: "Precedente",
  arcNext: "Successiva",
  arcDaysTitle: "Giorni di archivio",
  arcDaysEmpty:
    "Ancora nessun archivio giornaliero — le partite regolate vengono archiviate permanentemente e compaiono qui.",
  arcBrowseTitle: "Sfoglia le previsioni",
  arcShowingLine: "Mostrate {shown} di {total} righe corrispondenti",
  arcDayEyebrow: "Archivio giornaliero",
  arcDayLede:
    "Istantanea storica di questo giorno di ricerca — gli esiti non vengono riscritti dopo il regolamento.",
  arcDayPredictionsTitle: "Previsioni del {date}",

  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Scoperta di entità",
  srchTitle: "Ricerca",
  srchResultsFor: "Risultati per \u201c{q}\u201d",
  srchCountLine: "{n} entità corrispondenti dal registro validato",
  srchLede:
    "Cerca nel registro validato — competizioni, stagioni, squadre, mercati e operatori per paese.",
  srchAllFilter: "Tutti",
  srchEmptyNoQueryTitle: "Cerca partite, squadre, competizioni e operatori",
  srchEmptyNoQueryDesc:
    "Digita il nome di una competizione, squadra, mercato, stagione o operatore per trovare entità di ricerca validate.",
  srchEmptyFilteredTitle: "Nessuna entità corrisponde a questi filtri.",
  srchEmptyFilteredDesc:
    "Esistono corrispondenze, ma nessuna con il filtro attuale di tipo o paese — azzera i filtri o amplia la ricerca.",
  srchEmptyLocaleTitle: "Lingua non disponibile",
  srchEmptyLocaleDesc:
    "Questa lingua non è disponibile per la ricerca. Passa a una lingua supportata e riprova.",
  srchEmptyNoneTitle: "Nessun risultato per questa ricerca.",
  srchEmptyNoneDesc:
    "Nulla nel registro validato corrisponde alla ricerca. Prova un'altra grafia, un alias della squadra o esplora la ricerca popolare qui sotto.",

  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Pagina non trovata",
  nfBody:
    "Questo URL non fa parte del registro di ricerca. Controlla l'indirizzo o prosegui da una delle superfici qui sotto.",
  nfHome: "Vai alla home",

  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Intelligence degli operatori",
  opIndexTitle: "Operatori",
  opIndexLede:
    "Operatori di scommesse come profili di ricerca — copertura dei mercati, disponibilità, verifica e storico delle quote osservate. Valutazione secondo criteri pubblicati, mai raccomandazione.",
  opVerified: "verificato",
  opUnverified: "non verificato",
  opRowMarketsCount: "{n} mercati",
  opLeadAvailable: "{operator} risulta disponibile per il tuo paese ({country}).",
  opLeadUnavailable: "{operator} non risulta disponibile per il tuo paese ({country}).",
  opVerificationRow: "Verifica: {status}",
  opSupportsMarketsLine: "{n} mercati supportati",
  opSupportsCountriesLine: "{n} paesi elencati",
  opSamplesLine: "{n} osservazioni di quote archiviate",
  opCoverageLine: "{market} — {n} osservazioni",
  opEvidenceNote:
    "Tutte le cifre qui sotto provengono dall'insieme di osservazioni archiviato — nulla è un prezzo live, e vuoto significa non osservato.",
  opMarketsTitle: "Mercati supportati",
  opCountriesTitle: "Paesi elencati",
  opCountriesNone: "Nessuna lista di paesi configurata per questo operatore.",
  opRecentFixtures: "Partite osservate di recente",
  opFixtureN: "Partita #{id}",
  opTermsTitle: "Condizioni dichiarate dall'operatore",
  opTermsNote:
    "Le dichiarazioni qui sotto sono affermazioni dell'operatore stesso — registrate come riferimento, non verificate da RankWagers.",
  opFoundedRow: "Fondato nel {year}",
  opHqRow: "Sede: {hq}",
  opLicensesRow: "Licenze: {list}",
  opContinueTitle: "Continua verso questo operatore",
  opContinueBody:
    "Se l'evidenza qui sopra è utile, il collegamento commerciale in basso apre il bookmaker. RankWagers guadagna una commissione sulle iscrizioni e non gestisce servizi di gioco.",
  opContinueCta: "Continua verso {operator}",
  opContinueUnavailable: "Nessun collegamento commerciale disponibile per il tuo paese.",
  opRelatedOperators: "Operatori correlati",

});

const fr: PredictionStrings = mergePredictions({
  metaTitle: "Pronostics du jour — Plus de 1,5, 2,5 et buts par mi-temps",
  metaDescription:
    "Listes quotidiennes : buts en 1ère mi-temps, plus de 1,5, plus de 2,5 et 2ème mi-temps.",
  heroBadge: "Picks du jour",
  heroTitle: "Pronostics marchés de buts aujourd'hui",
  heroSubtitle:
    "Matchs qui passent nos filtres pour buts 1T, plus de 1,5 et plus de 2,5 — mis à jour dans la journée.",
  dateLabel: "Date",
  timezoneNote: "Heures de coup d'envoi à Istanbul (TR)",
  timezoneLocalNote: "Heures et compte à rebours dans votre fuseau",
  tabFh: "1ère MT 0,5+",
  tabOver15: "Plus de 1,5",
  tabOver25: "Plus de 2,5",
  tabSh: "2ème MT 0,5+",
  colTime: "Heure",
  colMatch: "Match",
  colLeague: "Ligue",
  colPct: "Prob.",
  colStatus: "Statut",
  empty: "Aucun match atteint le seuil pour ce marché aujourd'hui.",
  apiError: "Impossible de charger les listes du jour. Réessayez plus tard.",
  liveSoonTitle: "Signaux en direct",
  liveSoonBody:
    "Alertes buts en temps réel via Telegram. Un tip gratuit par heure — débloquez plus via bookmakers partenaires ou Telegram.",
  liveSoonBodyStats:
    "Moteur live calme — nous affichons encore les matchs à fort potentiel des listes du jour. Alertes complètes sur Telegram aux heures de pointe.",
  liveFeedHourlyNote: "Tip gratuit de l'heure (reset à l'heure UTC)",
  liveFeaturedLabel: "Tip de l'heure",
  liveFeaturedMoreCta: "Touchez pour plus de pronostics",
  liveFeaturedWonBadge: "GAGNÉ",
  liveFeaturedWinPendingBadge: "BUT ",
  liveFeaturedWonLine: "Pronostic gagnant — bon choix",
  liveFeaturedWinPendingLine: "But marqué — victoire en cours",
  liveUnlockTitle: "Débloquer ce tip live",
  liveUnlockBody:
    "Ce pronostic est pour joueurs vérifiés. Inscrivez-vous et déposez avec un partenaire, ou rejoignez le flux VIP Telegram pour le lien du groupe privé.",
  liveUnlockAffiliate: "Voir les sites partenaires",
  liveUnlockTelegram: "Ouvrir le bot Telegram",
  liveUnlockTelegramChannel: "Ouvrir le canal Telegram",
  liveUnlockTelegramSoon: "Lien Telegram non configuré",
  liveEmpty: "Pas de signaux live pour l'instant. Revenez aux heures de match.",
  liveEmptySoft:
    "Pas de tip live cette heure — parcourez les listes du jour ou les matchs à venir.",
  liveNewBadge: "Nouveau",
  liveTapUnlock: "Touchez pour débloquer",
  upcomingSectionLabel: "À venir (2–3 h)",
  upcomingFeaturedLabel: "Prochain pick",
  upcomingStartsIn: "Début dans {mins} min",
  upcomingTapMore: "Cliquez pour plus de matchs à venir",
  upcomingTapSeePick: "Cliquez pour voir le pronostic",
  upcomingUnlockTitle: "Plus de matchs à venir sur Telegram",
  upcomingUnlockBody:
    "Nous publions les listes complètes sur le bot Telegram quelques heures avant le coup d'envoi.",
  bannerLabel: "Bannière",
  bannerPlaceholder: "Espace publicitaire — format vertical",
  statusLive: "En direct",
  statusFt: "Terminé",
  statusScheduled: "À venir",
  playNow: "Voir les opérateurs",
  playNowAria: "Voir les meilleurs sites de paris",
  navTodayLists: "Listes du jour",
  heroCtaPrimary: "Comparer les sites de paris",
  heroCtaSecondary: "Réclamer les bonus",
  colPctTooltip:
    "% potentiel pour ce marché — indicateur statistique, pas une garantie.",
  promoTopSitesTitle: "Opérateurs",
  promoTopSitesBody: "Avis indépendants, bonus de bienvenue et retraits rapides.",
  promoTopSitesCta: "Voir le classement",
  promoBonusesTitle: "Promotions des opérateurs",
  promoBonusesBody: "Offres annoncées des opérateurs référencés, avec leurs conditions déclarées.",
  promoBonusesCta: "Parcourir les bonus",
  promoTelegramTitle: "Promotions des opérateurs sur Telegram",
  promoTelegramBody: "Offres promotionnelles d'opérateurs référencés. Contenu commercial.",
  promoTelegramCta: "Ouvrir Telegram",
  matchDetailTapHint: "Touchez le match pour les stats",
  matchDetailVenueHome: "À domicile",
  matchDetailVenueAway: "Extérieur",
  matchDetailGoalsTitle: "Buts par match (dom./ext.)",
  matchDetailScoredAvg: "Marqués",
  matchDetailConcededAvg: "Encaissés",
  matchDetailBlendNote:
    "Moyennes côté {blend}% · Potentiel du match {match}%",
  matchDetailAiTitle: "Perspective IA",
  matchDetailAiReason: "Pourquoi",
  matchDetailPlayedNote: "Échantillon saison : {home} à domicile · {away} extérieur",
  matchDetailError: "Impossible de charger le détail du match.",
  /* Fixture page — the five-level architecture (fx*), translated in the close-out pass. */
  fxLeadEyebrow: "Constat principal",
  fxSupportsTitle: "Signaux à l'appui",
  fxSupportsDescription:
    "Chaque ligne suit la même grammaire : le constat, la fréquence, le nombre de matchs et le taux de la ligue en référence.",
  fxExplainerLabel: "Comment ils sont classés",
  fxExplainerBody:
    "Chaque signal est noté selon l'écart entre son taux et le taux de la ligue dans cette compétition, pondéré par la taille de l'échantillon (n/(n+5)). Moins de cinq matchs n'entre jamais au classement — une série courte est du contexte, pas un constat. Un marché sans référence de ligue n'est jamais comparé à un chiffre inventé ; il vit dans le détail complet ci-dessous. Le signal le plus fort ne mène la page que s'il franchit un seuil fixe ; quand aucun n'y parvient, la page reste sans constat principal plutôt que d'en fabriquer un.",
  fxSignalLine: "{finding} : {count} sur {scope} ({rate}%) — moyenne de la ligue {baseline}%.",
  fxSignalLineNoBaseline: "{finding} : {count} sur {scope} ({rate}%) — pas de référence de ligue.",
  fxScopeHomeVenue: "les {n} matchs à domicile de {team} cette saison",
  fxScopeAwayVenue: "les {n} matchs à l'extérieur de {team} cette saison",
  fxScopeRecentHome: "les {n} derniers matchs de {team} à domicile",
  fxScopeRecentAway: "les {n} derniers matchs de {team} à l'extérieur",
  fxScopeH2h: "les {n} dernières confrontations",
  fxFindingOver15Up: "Les buts continuent de tomber",
  fxFindingOver15Down: "Les buts se font rares",
  fxFindingOver25Up: "Les matchs à buts se poursuivent",
  fxFindingOver25Down: "Les matchs à buts sont rares",
  fxFindingOver35Up: "Les matchs à quatre buts se poursuivent",
  fxFindingOver35Down: "Les matchs à quatre buts sont rares",
  fxFindingFh05Up: "Les buts en première période continuent",
  fxFindingFh05Down: "Les premières périodes démarrent calmes",
  fxFindingSh05Up: "Les buts en seconde période continuent",
  fxFindingSh05Down: "Les secondes périodes restent calmes",
  fxFindingBttsUp: "Les deux équipes continuent de marquer",
  fxFindingBttsDown: "Un camp reste muet",
  fxFindingCleanSheetsUp: "Les clean sheets se poursuivent",
  fxFindingCleanSheetsDown: "Les clean sheets sont rares",
  fxFindingFailedToScoreUp: "Les matchs sans marquer se poursuivent",
  fxFindingFailedToScoreDown: "Les matchs sans marquer sont rares",
  fxModelTitle: "La lecture du modèle",
  fxModelPotentialLine:
    "Potentiel du fournisseur {pct}% sur {market} — le chiffre publié par le fournisseur. Ni une confiance, ni un prix, et sans échantillon.",
  fxWhyTitle: "Pourquoi",
  fxWhyIntro:
    "Comment les signaux classés ci-dessus rencontrent la propre lecture du modèle pour ce match.",
  fxWhyAgrees:
    "Les signaux classés et l'évidence notée du modèle pointent dans la même direction : {supporting} de ses {total} signaux soutiennent la direction du marché.",
  fxWhyCaution:
    "La forme récente dit « {finding} », mais le modèle reste prudent : {opposing} de ses {total} signaux notés s'y opposent, et ce match n'a pas franchi le seuil de qualification du modèle.",
  fxWhyModelCounts:
    "Sur les {total} signaux notés du modèle, {supporting} soutiennent et {opposing} s'opposent.",
  fxWhyArchiveLine:
    "Snapshot {seq}, capturé {time} · modèle {version} · score d'évidence {score} · {signals} signaux : {supporting} pour, {opposing} contre.",
  fxWhyArchiveNone:
    "Aucun snapshot d'évidence n'a encore été capturé pour ce match. La lecture ci-dessus est dérivée en direct des mêmes taux par lieu et de la référence de ligue que lit le modèle — rien de plus n'est affirmé.",
  fxDetailTitle: "Détail complet de la recherche",
  fxDetailDescription:
    "Tous les taux de marché et de lieu derrière les niveaux ci-dessus — dense à dessein. Chaque taux porte son échantillon ; un taux absent est absent, pas zéro.",
  fxOperatorsTitle: "Options d'opérateurs",
  fxOperatorsNote:
    "La recherche éditoriale ci-dessus est séparée des offres commerciales. Les liens utilisent des redirections signées côté serveur.",

  /* Fixture truth pass — provider demotion, windows, freeze, live copy. */
  fxProviderFigureTitle: "Chiffre du fournisseur",
  fxProviderOnlyRate: "chiffre du fournisseur — sans échantillon",
  fxWhyWindowNote:
    "Chaque taux ci-dessous est un taux de saison au lieu indiqué — une fenêtre différente des phrases de forme récente ci-dessus.",
  fxRateHomeSeason: "Équipe à domicile — cette saison",
  fxRateAwaySeason: "Équipe à l'extérieur — cette saison",
  fxRateLeagueSeason: "Ligue — cette saison",
  fxRecordAfterKickoff: "Capturé après le coup d'envoi — exclu du règlement.",
  fxLiveUnavailable: "mises à jour en direct indisponibles pour cette compétition",

  /* Market pages — form-guide conversion (mkt*). */
  mktIndexEyebrow: "Marchés de recherche",
  mktIndexLede:
    "Références de marché reliant matchs, évidence et cotes observées. Structure de recherche, jamais de pronostics.",
  mktLeadEyebrow: "Concentration de couverture",
  mktLeadLine:
    "La couverture se concentre sur {league} : {count} des {total} matchs qualifiés ({pct}%).",
  mktSupportsTitle: "Signaux de couverture",
  mktSupportsNote:
    "Comptes du jeu de recherche actuel — les listes qualifiées du jour. Des comptes de couverture, pas des taux d'occurrence.",
  mktQualifiedLine: "{n} matchs qualifiés dans le jeu de recherche actuel",
  mktLeagueCoverageLine: "{n} compétitions couvertes",
  mktTopLeagueRow: "{league} — {count} sur {total} ({pct}%)",
  mktProviderAvgLine:
    "Potentiel moyen du fournisseur {pct}% sur le jeu qualifié — chiffre du fournisseur, pas un taux mesuré.",
  mktFixturesTitle: "Matchs qualifiés aujourd'hui",
  mktFixturesEmpty: "Aucun match qualifié pour ce marché dans le jeu de recherche actuel.",
  mktDetailTitle: "Détail du marché",
  mktFaqTitle: "Questions",
  mktRelatedTitle: "Marchés liés",
  mktOddsTitle: "Cotes observées",
  mktOddsEmpty:
    "Pas encore d'observations de cotes stockées pour ce marché — les chiffres n'apparaissent qu'après des observations vérifiées.",
  mktOddsBest: "Meilleure observée",
  mktOddsAverage: "Moyenne observée",
  mktOddsLowest: "Plus basse observée",
  mktOddsMovements: "Mouvements",
  mktOddsClv: "Moyenne CLV",
  mktOddsWindowNote:
    "Tous les chiffres viennent du jeu d'observations stocké — jamais un prix en direct.",
  mktIndicatorsTitle: "Indicateurs d'évidence",
  mktIndicatorsShow: "Déplier les définitions",
  mktIndicatorsHide: "Masquer les définitions",
  mktIndicatorsNote:
    "Définitions des métriques de ce marché — ni valeurs en direct, ni scores de confiance.",
  mktIndicatorUsed: "utilisé dans la recherche",
  mktIndicatorConceptual: "conceptuel",

  /* Competition + season pages — form-guide conversion (cmp / ssn keys). */
  cmpIndexEyebrow: "Compétitions de recherche",
  cmpIndexTitle: "Compétitions",
  cmpIndexLede:
    "Les compétitions comme pôles de recherche — matchs qualifiés, marchés, opérateurs et cotes observées. Structure de recherche, jamais de pronostics.",
  cmpLeadLine:
    "La couverture du jour se concentre sur {market} : {count} sur {total} lignes qualifiées ({pct}%).",
  cmpQualifiedRowsLine: "{n} lignes de marché qualifiées dans l'ensemble de recherche actuel",
  cmpUniqueFixturesLine: "{n} matchs uniques",
  cmpMarketRow: "{market} — {count} sur {total} ({pct}%)",
  cmpUpcomingTitle: "Prochains matchs qualifiés",
  cmpUpcomingEmpty:
    "Aucun match qualifié à venir ne correspond à cette compétition dans l'ensemble de recherche actuel.",
  cmpRecentTitle: "Lignes au signal le plus fort",
  cmpRecentNote:
    "Les lignes qualifiées les plus fortes de l'ensemble de recherche actuel — des entrées de recherche, pas des résultats.",
  cmpRecentEmpty:
    "Aucun match analysé ne correspond à cette compétition dans l'ensemble de recherche actuel.",
  cmpDetailTitle: "Détail de la compétition",
  cmpSeasonsTitle: "Saisons",
  cmpSeasonCurrent: "en cours",
  cmpMarketActivityTitle: "Activité de marché dans l'échantillon",
  cmpMarketActivityEmpty:
    "Les lignes de marché apparaissent lorsque des matchs qualifiés correspondent à cette compétition.",
  cmpRowsProviderMeta: "{n} lignes · moyenne fournisseur {pct}%",
  cmpRelatedCompetitions: "Compétitions liées",
  cmpRelatedTeams: "Équipes liées",
  cmpRelatedTeamsNote:
    "Lien affiché lorsqu'une entité canonique d'équipe existe ; sinon, affichées comme libellés de recherche.",
  cmpMethodologyLink: "Méthodologie et preuves",
  ssnEyebrow: "Recherche de saison",
  ssnCurrent: "En cours",
  ssnArchived: "Archivée",
  ssnWindowLine: "Fenêtre de la saison {start} → {end}",
  ssnLeadLine:
    "L'ensemble de recherche de cette saison contient {count} lignes qualifiées sur {fixtures} matchs.",
  ssnTeamsTitle: "Équipes participantes",
  ssnTeamsEmpty:
    "Les équipes n'apparaissent que lorsqu'elles figurent dans des matchs qualifiés de cette saison.",
  ssnTeamsCountLine: "{n} équipes participantes",
  ssnUpcomingRowsLine: "{n} lignes à venir",
  ssnCompletedRowsLine: "{n} lignes terminées",
  ssnHomeAwayLine: "{home} lignes à domicile · {away} lignes à l'extérieur",
  ssnEnrichmentAbsent:
    "Les taux de buts et de xG au niveau de la saison ne s'affichent que lorsqu'un enrichissement du détail des matchs existe — cette page ne les invente pas.",
  ssnDetailTitle: "Détail de la saison",
  ssnOperatorsTitle: "Opérateurs disponibles",
  ssnOperatorsEmpty: "Aucun opérateur affilié actif pour le pays du visiteur résolu.",

  /* Team pages — form-guide conversion (tm keys). */
  tmIndexEyebrow: "Équipes de recherche",
  tmIndexTitle: "Équipes",
  tmIndexLede:
    "Pôles canoniques de recherche d'équipes — compétitions, matchs qualifiés, marchés et opérateurs. Relations factuelles uniquement, jamais de notes.",
  tmLeadLine:
    "L'ensemble de recherche de cette équipe contient {count} lignes qualifiées sur {fixtures} matchs.",
  tmUpcomingEmpty:
    "Aucun match qualifié à venir pour cette équipe dans l'ensemble de recherche actuel.",
  tmRecentEmpty: "Aucun match analysé pour cette équipe dans l'ensemble de recherche actuel.",
  tmCompetitionsTitle: "Compétitions actuelles",
  tmDetailTitle: "Détail de l'équipe",
  tmMarketProfileTitle: "Profil des marchés de buts",
  tmMarketProfileEmpty:
    "Aucune ligne de marché qualifiée pour cette équipe dans l'échantillon de recherche actuel.",
  tmHomeAwayNote:
    "Les décomptes reflètent les lignes de recherche qualifiées où {team} joue à domicile ou à l'extérieur — ce n'est ni un tableau de forme ni une note.",
  tmEnrichmentAbsent:
    "Les taux de buts et de xG de l'équipe ne s'affichent que lorsqu'un enrichissement du détail des matchs existe — cette page ne les invente pas.",
  tmRelatedTeams: "Équipes liées",
  tmSearchLabel: "Rechercher",
  tmSearchPlaceholder: "Nom de l'équipe",
  tmFilterCompetition: "Compétition",
  tmFilterCountry: "Pays",
  tmAllCompetitions: "Toutes les compétitions",
  tmAllCountries: "Tous les pays",
  tmApplyFilters: "Appliquer les filtres",
  tmFiltersEmpty: "Aucune équipe ne correspond à ces filtres.",
  tmResetFilters: "Réinitialiser les filtres",
  tmInternational: "International",

  /* Country pages — form-guide conversion (ct keys). */
  ctIndexEyebrow: "Pays de recherche",
  ctIndexTitle: "Pôles de recherche par pays",
  ctIndexLede:
    "Un pôle n'existe que lorsqu'on peut assembler des compétitions, opérateurs et un contexte de recherche uniques pour la région — jamais comme porte géographique vide.",
  ctIndexEmpty: "Aucun pôle pays ne passe actuellement le filtre de qualité.",
  ctEyebrow: "Pôle pays",
  ctLeadLine:
    "Ce pôle relie {competitions} compétitions, {operators} opérateurs et {fixtures} matchs archivés.",
  ctCompetitionsCount: "{n} compétitions liées",
  ctOperatorsCount: "{n} opérateurs disponibles",
  ctFixturesCount: "{n} échantillons de matchs archivés",
  ctCompetitionsTitle: "Compétitions pertinentes",
  ctCompetitionsEmpty: "Aucune compétition du registre résolue pour ce profil pour l'instant.",
  ctFixturesTitle: "Matchs liés",
  ctFixturesEmpty: "Aucun match archivé récent ne correspond à ce pays.",
  ctContinueTitle: "Continuer l'exploration",
  ctOperatorsTitle: "Découverte de bookmakers",
  ctOperatorsEmpty: "Aucun opérateur vérifié disponible pour ce contexte pays.",
  ctNoindexNote: "Ce pôle n'est actuellement pas indexé ({reason}).",
  ctLinkMarkets: "Marchés de recherche",
  ctLinkCompetitions: "Toutes les compétitions",
  ctLinkOperators: "Tous les bookmakers",
  ctLinkPerformance: "Performance vérifiée",
  ctLinkAcca: "Acca Studio",

  /* Archive pages — form-guide conversion (arc keys). */
  arcIndexEyebrow: "Vérification",
  arcIndexTitle: "Archive des prédictions",
  arcIndexLede:
    "Chaque prédiction publiée des listes qualifiées et son résultat réglé — victoires et défaites affichées, résultats jamais réécrits.",
  arcLeadLine: "Sur {settled} prédictions réglées, {won} gagnées et {lost} perdues ({pct}%).",
  arcRecordTitle: "Registre vérifié de l'archive",
  arcTotalLine: "{n} prédictions enregistrées",
  arcSettledLine: "{n} réglées",
  arcPendingLine: "{n} en attente",
  arcVoidLine: "{n} annulées",
  arcPairedRate: "{won} sur {settled} ({pct}%)",
  arcOddsUnavailable:
    "Les cotes moyennes et le ROI restent indisponibles tant que les cotes de publication ne sont pas stockées durablement — cette page ne les invente pas.",
  arcLastUpdateLabel: "Dernière mise à jour de l'archive",
  arcByMarketTitle: "Par marché",
  arcByMarketRow: "{won} gagnées · {lost} perdues · {pending} en attente · {void} annulées",
  arcByCompetitionTitle: "Principales compétitions de l'échantillon",
  arcRowsN: "{n} lignes",
  arcTableMatch: "Match",
  arcTableMarket: "Marché",
  arcTableResult: "Résultat",
  arcTableScore: "Score",
  arcTableTiming: "Horaires",
  arcTableEmpty: "Aucune prédiction archivée ne correspond à ces filtres.",
  arcSettlementSummary: "Règlement et preuves",
  arcOddsRowUnavailable: "Cotes d'origine et P/L unitaire indisponibles pour cette ligne.",
  arcArchiveLabel: "Archivé",
  arcKickoffLabel: "Coup d'envoi",
  arcPublishedLabel: "Publié",
  arcFilterMarket: "Marché",
  arcFilterStatus: "Statut",
  arcFilterCompetition: "Compétition",
  arcFilterTeam: "Équipe",
  arcFilterSearch: "Rechercher",
  arcAllMarkets: "Tous les marchés",
  arcAllStatuses: "Tous les statuts",
  arcSearchPlaceholder: "Match ou ligue",
  arcPageOf: "Page {page} sur {total}",
  arcPrev: "Précédent",
  arcNext: "Suivant",
  arcDaysTitle: "Jours d'archive",
  arcDaysEmpty:
    "Pas encore d'archives quotidiennes — les matchs réglés sont archivés définitivement et apparaissent ici.",
  arcBrowseTitle: "Parcourir les prédictions",
  arcShowingLine: "Affichage de {shown} sur {total} lignes correspondantes",
  arcDayEyebrow: "Archive quotidienne",
  arcDayLede:
    "Instantané historique de cette journée de recherche — les résultats ne sont pas réécrits après le règlement.",
  arcDayPredictionsTitle: "Prédictions du {date}",

  /* Search page — form-guide conversion (srch keys). */
  srchEyebrow: "Découverte d'entités",
  srchTitle: "Recherche",
  srchResultsFor: "Résultats pour \u201c{q}\u201d",
  srchCountLine: "{n} entités correspondantes du registre validé",
  srchLede:
    "Cherchez dans le registre validé — compétitions, saisons, équipes, marchés et opérateurs par pays.",
  srchAllFilter: "Tous",
  srchEmptyNoQueryTitle: "Cherchez matchs, équipes, compétitions et opérateurs",
  srchEmptyNoQueryDesc:
    "Saisissez le nom d'une compétition, d'une équipe, d'un marché, d'une saison ou d'un opérateur pour trouver des entités de recherche validées.",
  srchEmptyFilteredTitle: "Aucune entité ne correspond à ces filtres.",
  srchEmptyFilteredDesc:
    "Des correspondances existent, mais aucune avec le filtre actuel de type ou de pays — effacez les filtres ou élargissez la requête.",
  srchEmptyLocaleTitle: "Langue non disponible",
  srchEmptyLocaleDesc:
    "Cette langue n'est pas disponible pour la recherche. Passez à une langue prise en charge et réessayez.",
  srchEmptyNoneTitle: "Aucun résultat pour cette recherche.",
  srchEmptyNoneDesc:
    "Rien dans le registre validé ne correspond à la requête. Essayez une autre orthographe, un alias d'équipe, ou parcourez la recherche populaire ci-dessous.",

  /* Global 404 — form-guide conversion (nf keys). */
  nfTitle: "Page introuvable",
  nfBody:
    "Cette URL ne fait pas partie du registre de recherche. Vérifiez l'adresse ou poursuivez via l'une des surfaces ci-dessous.",
  nfHome: "Retour à l'accueil",

  /* Operator pages — commercial conversion (op keys). */
  opIndexEyebrow: "Intelligence des opérateurs",
  opIndexTitle: "Opérateurs",
  opIndexLede:
    "Les opérateurs de paris comme profils de recherche — couverture des marchés, disponibilité, vérification et historique des cotes observées. Évaluation selon des critères publiés, jamais une recommandation.",
  opVerified: "vérifié",
  opUnverified: "non vérifié",
  opRowMarketsCount: "{n} marchés",
  opLeadAvailable: "{operator} est indiqué comme disponible pour votre pays ({country}).",
  opLeadUnavailable: "{operator} n'est pas indiqué comme disponible pour votre pays ({country}).",
  opVerificationRow: "Vérification : {status}",
  opSupportsMarketsLine: "{n} marchés pris en charge",
  opSupportsCountriesLine: "{n} pays listés",
  opSamplesLine: "{n} observations de cotes stockées",
  opCoverageLine: "{market} — {n} observations",
  opEvidenceNote:
    "Tous les chiffres ci-dessous proviennent de l'ensemble d'observations stocké — rien n'est un prix en direct, et vide signifie non observé.",
  opMarketsTitle: "Marchés pris en charge",
  opCountriesTitle: "Pays listés",
  opCountriesNone: "Aucune liste de pays n'est configurée pour cet opérateur.",
  opRecentFixtures: "Matchs observés récemment",
  opFixtureN: "Match n°{id}",
  opTermsTitle: "Conditions déclarées par l'opérateur",
  opTermsNote:
    "Les déclarations ci-dessous sont celles de l'opérateur lui-même — consignées pour référence, non vérifiées par RankWagers.",
  opFoundedRow: "Fondé en {year}",
  opHqRow: "Siège : {hq}",
  opLicensesRow: "Licences : {list}",
  opContinueTitle: "Continuer vers cet opérateur",
  opContinueBody:
    "Si les éléments ci-dessus vous sont utiles, le lien commercial ci-dessous ouvre le site de paris. RankWagers touche une commission sur les inscriptions et n'exploite aucun service de jeu.",
  opContinueCta: "Continuer vers {operator}",
  opContinueUnavailable: "Aucun lien commercial disponible pour votre pays.",
  opRelatedOperators: "Opérateurs liés",

});

export const predictionsByLocale: Record<Locale, PredictionStrings> = {
  en: predictionsEn,
  pt,
  es,
  "es-es": esEs,
  fr,
  de,
  it,
  nl: europe.nl,
  pl: europe.pl,
  cs: europe.cs,
  da: europe.da,
  sv: europe.sv,
  no: europe.no,
  fi: europe.fi,
  ro: europe.ro,
  el: europe.el,
  hu: europe.hu,
  ar: asia.ar,
  hi: asia.hi,
  bn: asia.bn,
  ta: asia.ta,
  te: asia.te,
  mr: asia.mr,
  ja: asia.ja,
  th: asia.th,
  ko: asia.ko,
  vi: asia.vi,
  id: asia.id,
  zh: asia.zh,
  sw: asia.sw,
};

export function getPredictionsForLocale(locale: Locale): PredictionStrings {
  return predictionsByLocale[locale] ?? predictionsEn;
}
