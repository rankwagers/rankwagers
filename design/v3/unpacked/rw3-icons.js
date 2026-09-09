// RankWagers v3 icon set — 24-unit grid, 1.5px single stroke, round caps. Rendered at 16/20px.
window.RW3_ICONS = {
  // market
  over:      { d: ['M12 18V6', 'M7 11l5-5 5 5', 'M6 20h12'] },
  under:     { d: ['M12 6v12', 'M7 13l5 5 5-5', 'M6 4h12'] },
  btts:      { d: ['M8 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M16 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'] },
  bttsNo:    { d: ['M8 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M16 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M4 20L20 4'] },
  home:      { d: ['M4 11l8-7 8 7', 'M6 10v10h12V10', 'M10 20v-5h4v5'] },
  away:      { d: ['M4 11l8-7 8 7', 'M6 10v10h5', 'M14 16h6', 'M17 13l3 3-3 3'] },
  corner:    { d: ['M6 20V4', 'M6 4l9 3.5L6 11', 'M3 20a5 5 0 0 1 5-5'] },
  h1:        { d: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 4a8 8 0 0 0 0 16z'], fill: [1] },
  h2:        { d: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 4a8 8 0 0 1 0 16z'], fill: [1] },
  dnb:       { d: ['M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z', 'M9 12l2 2 4-4'] },
  // status
  live:      { d: ['M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7.5 7.5a6.5 6.5 0 0 0 0 9', 'M16.5 7.5a6.5 6.5 0 0 1 0 9'], fill: [0] },
  verified:  { d: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 12l3 3 5-6'] },
  locked:    { d: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5 11h14v9H5z', 'M12 15v2'] },
  sponsored: { d: ['M20 12l-8 8-9-9V4h7z', 'M8 8h.01'] },
  best:      { d: ['M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M9 13l-1 8 4-2 4 2-1-8'] },
  editor:    { d: ['M14 4l6 6L8 22H2v-6z', 'M12 6l6 6'] },
  snapshot:  { d: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M12 11v2h2'] },
  // action
  search:    { d: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'] },
  filter:    { d: ['M4 5h16l-6 7v6l-4 2v-8z'] },
  sort:      { d: ['M7 4v16', 'M4 17l3 3 3-3', 'M17 20V4', 'M14 7l3-3 3 3'] },
  follow:    { d: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'] },
  arrow:     { d: ['M5 12h14', 'M13 6l6 6-6 6'] },
  external:  { d: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v6H4V6h6'] },
  close:     { d: ['M6 6l12 12', 'M18 6L6 18'] },
  drag:      { d: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'] },
  // nav
  navPred:   { d: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'] },
  navSites:  { d: ['M4 10h16v10H4z', 'M3 10l2-5h14l2 5', 'M9 20v-5h6v5'] },
  navFree:   { d: ['M4 11h16v9H4z', 'M3 7h18v4H3z', 'M12 7v13', 'M12 7c-2-3-6-3-6 0', 'M12 7c2-3 6-3 6 0'] },
  navRecord: { d: ['M4 4h16v4H4z', 'M5 8v12h14V8', 'M10 12h4'] },
};
window.RW3_ICON_LABELS = {
  over: 'Üst', under: 'Alt', btts: 'KG Var', bttsNo: 'KG Yok', home: 'Ev sahibi', away: 'Deplasman', corner: 'Korner', h1: 'İlk yarı', h2: 'İkinci yarı', dnb: 'Ev yenilmez',
  live: 'Canlı', verified: 'Doğrulanmış', locked: 'Kilitli sonuç', sponsored: 'Sponsorlu', best: 'Best', editor: 'Editör seçkisi', snapshot: 'Snapshot',
  search: 'Ara', filter: 'Filtre', sort: 'Sırala', follow: 'Takip et', arrow: 'Devam', external: 'Dış bağlantı', close: 'Kapat', drag: 'Sürükle',
  navPred: 'Tahminler', navSites: 'Siteler', navFree: 'Bedava bahis', navRecord: 'Kayıt',
};
window.RW3Icon = function (name, size, color) {
  const R = window.React, ic = window.RW3_ICONS[name];
  if (!R || !ic) return null;
  size = size || 16;
  const paths = ic.d.map((d, i) => R.createElement('path', { key: i, d, fill: (ic.fill || []).includes(i) ? 'currentColor' : 'none' }));
  return R.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none', display: 'inline-block', verticalAlign: '-2px', color: color || 'currentColor' } }, paths);
};
window.RW3MarketIcon = function (market, size) {
  const m = market || '';
  const k = /Yok/.test(m) ? 'bttsNo' : /KG|Karşılıklı/.test(m) ? 'btts' : /Üst/i.test(m) ? 'over' : /Alt/.test(m) ? 'under' : /yenilmez/.test(m) ? 'dnb' : /Ev/.test(m) || /Galibiyet/.test(m) ? 'home' : /Deplasman/.test(m) ? 'away' : /Korner/.test(m) ? 'corner' : /İlk yarı/.test(m) ? 'h1' : /İkinci/.test(m) ? 'h2' : null;
  return k ? window.RW3Icon(k, size) : null;
};
