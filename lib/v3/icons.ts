/* The rw3 icon set — the ONLY icon family allowed on v3 routes (Bible V3,
   icon law). Transcribed from the approved mock's rw3-icons.js: 24-unit grid,
   1.5px single stroke, round caps/joins, currentColor. Rendered at 16/20px
   (smaller inside pills/buttons where the mock shows it).

   Paths listed in `fill` render filled with currentColor instead of stroked
   (the half-circle of h1/h2, the live dot). Adding an icon here is a design
   decision, not a convenience — the icon-set probe counts on this module
   being the set's single boundary. */

export const RW3_ICON_NAMES = [
  // market
  "over",
  "under",
  "btts",
  "bttsNo",
  "home",
  "away",
  "corner",
  "h1",
  "h2",
  "dnb",
  // status
  "live",
  "verified",
  "locked",
  "sponsored",
  "best",
  "editor",
  "snapshot",
  // action
  "search",
  "filter",
  "sort",
  "follow",
  "arrow",
  "external",
  "close",
  "drag",
  // mobile bottom nav
  "navPred",
  "navSites",
  "navFree",
  "navRecord",
] as const;

export type Rw3IconName = (typeof RW3_ICON_NAMES)[number];

export type Rw3IconDef = {
  d: readonly string[];
  /** Indices into `d` that render filled rather than stroked. */
  fill?: readonly number[];
};

export const RW3_ICONS: Record<Rw3IconName, Rw3IconDef> = {
  over: { d: ["M12 18V6", "M7 11l5-5 5 5", "M6 20h12"] },
  under: { d: ["M12 6v12", "M7 13l5 5 5-5", "M6 4h12"] },
  btts: {
    d: [
      "M8 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
      "M16 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    ],
  },
  bttsNo: {
    d: [
      "M8 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
      "M16 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
      "M4 20L20 4",
    ],
  },
  home: { d: ["M4 11l8-7 8 7", "M6 10v10h12V10", "M10 20v-5h4v5"] },
  away: { d: ["M4 11l8-7 8 7", "M6 10v10h5", "M14 16h6", "M17 13l3 3-3 3"] },
  corner: { d: ["M6 20V4", "M6 4l9 3.5L6 11", "M3 20a5 5 0 0 1 5-5"] },
  h1: {
    d: ["M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 4a8 8 0 0 0 0 16z"],
    fill: [1],
  },
  h2: {
    d: ["M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 4a8 8 0 0 1 0 16z"],
    fill: [1],
  },
  dnb: { d: ["M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z", "M9 12l2 2 4-4"] },
  live: {
    d: [
      "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      "M7.5 7.5a6.5 6.5 0 0 0 0 9",
      "M16.5 7.5a6.5 6.5 0 0 1 0 9",
    ],
    fill: [0],
  },
  verified: { d: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8 12l3 3 5-6"] },
  locked: { d: ["M7 11V8a5 5 0 0 1 10 0v3", "M5 11h14v9H5z", "M12 15v2"] },
  sponsored: { d: ["M20 12l-8 8-9-9V4h7z", "M8 8h.01"] },
  best: { d: ["M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M9 13l-1 8 4-2 4 2-1-8"] },
  editor: { d: ["M14 4l6 6L8 22H2v-6z", "M12 6l6 6"] },
  snapshot: {
    d: [
      "M4 8h3l2-3h6l2 3h3v11H4z",
      "M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M12 11v2h2",
    ],
  },
  search: { d: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4-4"] },
  filter: { d: ["M4 5h16l-6 7v6l-4 2v-8z"] },
  sort: { d: ["M7 4v16", "M4 17l3 3 3-3", "M17 20V4", "M14 7l3-3 3 3"] },
  follow: {
    d: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"],
  },
  arrow: { d: ["M5 12h14", "M13 6l6 6-6 6"] },
  external: { d: ["M14 4h6v6", "M20 4l-9 9", "M18 14v6H4V6h6"] },
  close: { d: ["M6 6l12 12", "M18 6L6 18"] },
  drag: {
    d: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  },
  navPred: {
    d: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  },
  navSites: { d: ["M4 10h16v10H4z", "M3 10l2-5h14l2 5", "M9 20v-5h6v5"] },
  navFree: {
    d: [
      "M4 11h16v9H4z",
      "M3 7h18v4H3z",
      "M12 7v13",
      "M12 7c-2-3-6-3-6 0",
      "M12 7c2-3 6-3 6 0",
    ],
  },
  navRecord: { d: ["M4 4h16v4H4z", "M5 8v12h14V8", "M10 12h4"] },
};

/* The four homepage list markets and their icons. Provider list kinds map to
   market glyphs here so market pills never guess from label text. */
export const RW3_MARKET_ICON_BY_LIST_KIND: Record<
  "fh" | "over15" | "over25" | "sh",
  Rw3IconName
> = {
  fh: "h1",
  over15: "over",
  over25: "over",
  sh: "h2",
};

export function isRw3IconName(name: string): name is Rw3IconName {
  return Object.prototype.hasOwnProperty.call(RW3_ICONS, name);
}
