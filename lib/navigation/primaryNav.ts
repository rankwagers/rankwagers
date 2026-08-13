import type { Locale } from "@/lib/i18n";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { HomepageDestination } from "@/lib/analytics/homepage";
import { liveSignalsHref } from "@/lib/search/homeSearchRoutes";

export type NavItem = {
  href: string;
  label: string;
  analyticsDestination?: HomepageDestination;
  /** Show in the compact desktop primary row */
  desktopPrimary?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/*
 * Grouped primary navigation — research vs bookmakers vs browse.
 *
 * On the size of `desktopPrimary`. The compact desktop row is not free-width: the header container
 * is capped at max-w-[1440px] with 40px side padding, and the brand and the search cluster take
 * their share first, which leaves the row roughly 580px at 1280px and roughly 700px at 1536px and
 * above — it does not keep growing with the viewport. Nine entries measured 920px of links, so the
 * row could not seat them at ANY viewport width; because the row carried no width constraint of
 * its own, the overflow was painted straight over the search input instead of wrapping or
 * clipping. Five entries measure 569px and fit at every width from xl up, with the constraint and
 * a clipping backstop now in place (see Header.tsx).
 *
 * So `desktopPrimary` is now a budget of five, and the four entries that stood down are not lost:
 * the grouped menu button is visible at every width (see MobileNav), and three of the four are
 * also in the footer. Which four followed the priority this file already states below — the
 * surfaces that answer "should I believe this?" hold the masthead, commercial billing yields
 * first, and the remaining stand-down is an on-page anchor rather than a distinct page.
 */
export function buildPrimaryNav(
  locale: Locale,
  /* Language sweep: every label is dictionary-born. The old labels object
     carried only the retired commercial doors and is gone with them. */
  p: PredictionStrings
): { groups: NavGroup[]; flat: NavItem[]; desktop: NavItem[] } {
  const groups: NavGroup[] = [
    {
      id: "research",
      label: p.nvGroupResearch,
      items: [
        {
          href: `/${locale}`,
          label: p.nvToday,
          analyticsDestination: "todays_matches",
          desktopPrimary: true,
        },
        /*
         * Archive and Methodology lead the group and hold compact-desktop slots.
         *
         * They were previously last in Research and absent from the compact row, so the only
         * always-visible navigation was commercial. A visitor who reads a prediction and wants to
         * know whether the site is any good at predictions had no route to the settled record —
         * while that record exists in full at /archive. Order inside a group is a statement of
         * priority, so the two surfaces that answer "should I believe this?" come first.
         *
         * The compact row keeps its existing SIZE: `Accumulators` and `Qualified fixtures` step
         * down to make room, and both are wider than the entries replacing them, so the row gets
         * narrower rather than longer. `Accumulators` stays one click away beside `Build
         * accumulator`, which keeps its slot; `Qualified fixtures` is an on-page anchor reachable
         * by scrolling the page it points into. Neither leaves the grouped mobile navigation.
         */
        { href: `/${locale}/archive`, label: p.nvArchive, desktopPrimary: true },
        {
          href: `/${locale}/methodology`,
          label: p.navMethodology,
          desktopPrimary: true,
        },
        { href: `/${locale}/acca`, label: p.nvAccas },
        // Sprint 20B-B stage B5. Sits inside Research, next to the Studio and Builder, because
        // a published Acca is research output — not a promotion. It is deliberately NOT
        // `desktopPrimary`: the compact desktop row is already full, and pushing a qualified
        // fixtures or Live Signals entry out to surface combinations would invert the journey.
        { href: `/${locale}/accas`, label: p.nvAccasPublished },
        {
          href: `/${locale}/acca/builder`,
          label: p.nvAccaBuild,
          desktopPrimary: true,
        },
        // `/combo` remains a live route and still redirects to the Builder; it is no longer
        // surfaced in navigation. It duplicated the Builder entry, and its label carried an
        // internal refactoring note ("→ Builder") into user-facing UI.
        {
          href: `/${locale}#fixtures`,
          label: p.nvQualifiedFixtures,
          analyticsDestination: "qualified_markets",
        },
        {
          href: liveSignalsHref(locale),
          label: p.nvLiveMatches,
          analyticsDestination: "live_signals",
          desktopPrimary: true,
        },
        /*
         * Stands down from the compact row for the same reason this file already gives for
         * `Qualified fixtures`: it is an on-page anchor, reachable by scrolling the page it points
         * into. The three commercial stand-downs alone did not bring the row inside its budget —
         * this is the lowest-priority remaining entry and the only one whose target is not a page.
         */
        { href: `/${locale}#saved`, label: p.nvShortlist },
      ],
    },
    {
      id: "bookmakers",
      label: p.opIndexTitle,
      items: [
        /*
         * Commercial conversion pass: the five commercial doors (/best-betting-sites,
         * /best-crypto-betting-sites, /bonuses, /reviews/*, /compare/*) are permanent
         * redirects into /operators — ONE canonical commercial surface. The nav
         * carries the one real destination; linking a redirect is linking noise.
         */
        {
          href: `/${locale}/operators`,
          label: p.opIndexTitle,
          analyticsDestination: "operators",
        },
      ],
    },
    {
      id: "browse",
      label: p.nvGroupReference,
      items: [
        {
          href: `/${locale}/markets`,
          label: p.nvMarkets,
          analyticsDestination: "markets",
        },
        {
          href: `/${locale}/competitions`,
          label: p.cmpIndexTitle,
          analyticsDestination: "competitions",
        },
        {
          href: `/${locale}/teams`,
          label: p.tmIndexTitle,
          analyticsDestination: "teams",
        },
        {
          href: `/${locale}/seasons`,
          label: p.cmpSeasonsTitle,
          analyticsDestination: "seasons",
        },
        { href: `/${locale}/search`, label: p.srchTitle },
      ],
    },
  ];

  const flat = groups.flatMap((g) => g.items);
  const desktop = flat.filter((item) => item.desktopPrimary);
  return { groups, flat, desktop };
}
