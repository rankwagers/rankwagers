window.RW2 = window.RW2 || (() => {
  const form = (s) => [...s].map(c => ({ w: c === 'W', l: c !== 'W' }));
  const ops = [
    { name: '1xBet', mark: '1x', color: '#1f5fbf', ink: '#fff', offer: 'İlk yatırıma %100 — 130 €’ya kadar', short: '130 € bonus', odds: '1.29', tc: 'Yeni üyeler. Min. yatırım 1 €. 5x çevrim. Şartlar geçerli.', best: true },
    { name: 'Melbet', mark: 'M', color: '#f5b400', ink: '#1a1a1a', offer: 'RANK koduyla 100 €’ya kadar bonus', short: '100 € bonus', odds: '1.28', tc: 'Kayıtta kod gerekli. 5x çevrim. Şartlar geçerli.', best: false },
    { name: 'Bet and You', mark: 'B&Y', color: '#6a3de8', ink: '#fff', offer: '10 € yatır, 30 € bedava bahis al', short: '30 € bedava', odds: '1.27', tc: 'Min. oran 1.75. Bedava bahis 7 günde biter.', best: false },
    { name: '888Starz', mark: '888', color: '#e0322b', ink: '#fff', offer: 'İlk bahis kaybederse 40 € iade', short: '40 € iade', odds: '1.30', tc: 'Min. oran 1.40. Bonus 24 saatte yüklenir.', best: false },
  ];
  const matches = [
    { league: 'Premier League', time: '17:30', home: 'Liverpool', away: 'Brighton', hi: 'LIV', ai: 'BHA', h1: '#c8102e', h2: '#7a0b1c', a1: '#0057b8', a2: '#ffffff', market: '1.5 Üst', pct: '91', sample: '10/11', note: 'Anfield’da son 11 maçın 10’u 1.5 üst', op: ops[0], form: form('WWWWLWWWWWW') },
    { league: 'La Liga', time: '21:00', home: 'Real Madrid', away: 'Sevilla', hi: 'RMA', ai: 'SEV', h1: '#f0f0f0', h2: '#b8a15a', a1: '#d4021d', a2: '#ffffff', market: 'Ev sahibi', pct: '82', sample: '9/11', note: 'Sevilla deplasmanda 8 maçtır galibiyetsiz', op: ops[1], form: form('WWLWWWWWLWW') },
    { league: 'Serie A', time: '18:00', home: 'Inter', away: 'Torino', hi: 'INT', ai: 'TOR', h1: '#0b2265', h2: '#000000', a1: '#8a1538', a2: '#5a0d24', market: 'KG Yok', pct: '78', sample: '7/9', note: 'Torino son 7’nin 5’inde gol bulamadı', op: ops[3], form: form('WWWLWWLWW') },
    { league: 'Bundesliga', time: '15:30', home: 'Leverkusen', away: 'Freiburg', hi: 'B04', ai: 'SCF', h1: '#e32219', h2: '#000000', a1: '#111111', a2: '#e30613', market: '2.5 Üst', pct: '75', sample: '9/12', note: 'Maç başına 3.4 gol', op: ops[2], form: form('WLWWWWLWWWLW') },
    { league: 'Süper Lig', time: '19:00', home: 'Galatasaray', away: 'Sivasspor', hi: 'GS', ai: 'SVS', h1: '#a90432', h2: '#fdb912', a1: '#e2001a', a2: '#ffffff', market: '1.5 Üst', pct: '88', sample: '15/17', note: 'Galatasaray 17 maçın 15’inde 2+ gol', op: ops[0], form: form('WWWWWWLWWWWWWWLWW') },
    { league: 'Ligue 1', time: '20:45', home: 'Marseille', away: 'Lille', hi: 'OM', ai: 'LOSC', h1: '#2faee0', h2: '#ffffff', a1: '#e01e37', a2: '#1b2a4a', market: 'Ev yenilmez', pct: '73', sample: '8/11', note: 'Marseille evinde sezon boyu yenilgisiz', op: ops[1], form: form('WWLWWWLWWLW') },
    { league: 'Eredivisie', time: '16:45', home: 'PSV', away: 'Utrecht', hi: 'PSV', ai: 'UTR', h1: '#ed1c24', h2: '#ffffff', a1: '#c8102e', a2: '#ffffff', market: '2.5 Üst', pct: '80', sample: '12/15', note: 'PSV evinde maç başı 3.1 gol', op: ops[2], form: form('WWWLWWWWLWWWLWW') },
    { league: 'Primeira Liga', time: '21:15', home: 'Sporting', away: 'Braga', hi: 'SCP', ai: 'SCB', h1: '#008057', h2: '#ffffff', a1: '#c8102e', a2: '#ffffff', market: 'KG Var', pct: '70', sample: '7/10', note: 'Son 4 karşılaşmanın hepsi KG var', op: ops[3], form: form('WWLWWLWWLW') },
  ];
  const top3 = [
    { ...matches[0], lead: 'Liverpool Anfield’da son 11 maçın 10’unda 1.5’i geçti; Brighton deplasmanda erken gol yiyor. Bu maç sonuçta değil, gol pazarında yaşıyor.' },
    { ...matches[4], lead: 'Galatasaray evinde 17 maçın 15’inde iki ya da daha fazla gol attı. Sivasspor’un deplasman savunması buna cevap veremiyor.' },
    { ...matches[1], lead: 'Sevilla deplasmanda sekiz maçtır kazanamıyor; Real Madrid Bernabéu’da bu sezon puan bırakmadı. Basit okunan maçlar bazen gerçekten basittir.' },
  ];
  const lists = [
    { market: '1.5 Üst', pct: '91', count: 14, record: '32W 3L', form: form('WWWWWLWWWW') },
    { market: 'Karşılıklı gol', pct: '84', count: 9, record: '27W 5L', form: form('WWWLWWWWLW') },
    { market: 'Ev sahibi kazanır', pct: '79', count: 11, record: '41W 11L', form: form('WLWWWWLWWW') },
    { market: '8.5 Korner üst', pct: '76', count: 6, record: '19W 6L', form: form('WWLWWWWLWW') },
    { market: '3.5 Alt', pct: '71', count: 8, record: '22W 9L', form: form('WWWLLWWWWL') },
  ];
  return {
    ops, matches, top3, lists,
    season: form('WWLWWWWLWWWLWWWWWLWWWWLWWWWWWL'),
    live: [{ t: 'Galatasaray 1–0 Sivasspor', m: '34′' }, { t: 'PSV 2–1 Utrecht', m: '61′' }, { t: 'Inter 0–0 Torino', m: '12′' }],
    hero: matches[0],
    fixtureOps: ops,
  };
})();
