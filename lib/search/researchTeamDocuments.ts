/**
 * Research team-name search documents from the daily archives (the Levadia
 * backlog). The curated team registry covers major clubs; every other name a
 * reader has seen on a list page was invisible to search. These documents
 * surface the names that actually appear in the research set — deduped
 * against the registry, clearly typed as RESEARCH entries (no canonical team
 * page exists), and pointing at the most recent fixture the name appeared in,
 * which is the real research a reader can open. Never invented: a name enters
 * only from an archived row. Search keeps zero commercial presence.
 */

import fs from "fs";
import path from "path";
import { normalizeSearchQuery, normalizeSlugKey } from "./normalizer";
import type { SearchDocument } from "./types";
import { resolveTeam } from "@/lib/teams/resolver";
import { listTeams } from "@/lib/teams/registry";

const DEFAULT_ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives");

type ArchiveRow = {
  matchId: number;
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  country?: string;
};

type ArchiveFile = {
  date: string;
  fh?: ArchiveRow[];
  over15?: ArchiveRow[];
  over25?: ArchiveRow[];
  sh?: ArchiveRow[];
};

function recentDates(dir: string, limit: number): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function buildResearchTeamDocuments(input?: {
  dayLimit?: number;
  /** Test seam only; production callers take the default partition. */
  archiveDir?: string;
}): SearchDocument[] {
  const dir = input?.archiveDir ?? DEFAULT_ARCHIVE_DIR;
  const dayLimit = input?.dayLimit ?? 14;
  const registry = listTeams();

  /** name → the newest fixture context it appeared in. */
  const byName = new Map<string, { matchId: number; competition: string; country: string; date: string }>();

  for (const date of recentDates(dir, dayLimit)) {
    let archive: ArchiveFile | null;
    try {
      archive = JSON.parse(fs.readFileSync(path.join(dir, `${date}.json`), "utf8")) as ArchiveFile;
    } catch {
      continue;
    }
    const rows = [
      ...(archive.fh ?? []),
      ...(archive.over15 ?? []),
      ...(archive.over25 ?? []),
      ...(archive.sh ?? []),
    ];
    for (const row of rows) {
      if (!row.matchId) continue;
      for (const name of [row.homeTeam, row.awayTeam]) {
        const trimmed = (name ?? "").trim();
        if (trimmed.length < 3) continue;
        // Dates iterate newest-first, so first sighting wins the freshest fixture.
        if (byName.has(trimmed)) continue;
        byName.set(trimmed, {
          matchId: row.matchId,
          competition: (row.competition ?? "").trim(),
          country: (row.country ?? "").trim(),
          date,
        });
      }
    }
  }

  const documents: SearchDocument[] = [];
  for (const [name, ctx] of byName) {
    // Deduped against the registry through the SAME resolver the pages use:
    // a registered team already has a richer document and a canonical page.
    if (resolveTeam(registry, { name }).status === "matched") continue;
    const slug = normalizeSlugKey(name.toLowerCase().replace(/\s+/g, "-"));
    if (!slug) continue;
    documents.push({
      id: `research-team:${slug}`,
      entityType: "team",
      slug,
      title: name,
      aliases: [name],
      locale: "en",
      keywords: [ctx.competition, ctx.country, "research", ctx.date].filter(Boolean),
      popularityWeight: 0.3,
      graphScore: 1,
      integrityScore: 1,
      searchable: true,
      active: true,
      // No canonical team page exists — the honest destination is the most
      // recent fixture this name appeared in.
      pathTemplate: `/fixtures/${ctx.matchId}`,
      normalizedSlug: normalizeSlugKey(slug),
      normalizedTitle: normalizeSearchQuery(name),
      normalizedAliases: [normalizeSearchQuery(name)].filter(Boolean),
      normalizedKeywords: [ctx.competition, ctx.country]
        .map((kw) => normalizeSearchQuery(kw))
        .filter(Boolean),
    });
  }
  return documents;
}
