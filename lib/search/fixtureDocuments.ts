/**
 * Short-horizon fixture search documents from daily archives (sync, no provider I/O).
 * Only real archived/qualified list rows — never invent fixtures.
 */

import fs from "fs";
import path from "path";
import { normalizeSearchQuery, normalizeSlugKey } from "./normalizer";
import type { SearchDocument } from "./types";

const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives");

type ArchiveRow = {
  matchId: number;
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  country?: string;
  countryCode?: string;
};

type ArchiveFile = {
  date: string;
  fh?: ArchiveRow[];
  over15?: ArchiveRow[];
  over25?: ArchiveRow[];
  sh?: ArchiveRow[];
};

function recentArchiveDates(limit: number): string[] {
  try {
    return fs
      .readdirSync(ARCHIVE_DIR)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

function readArchive(date: string): ArchiveFile | null {
  try {
    const raw = fs.readFileSync(path.join(ARCHIVE_DIR, `${date}.json`), "utf8");
    return JSON.parse(raw) as ArchiveFile;
  } catch {
    return null;
  }
}

/** Build fixture SearchDocuments from the last N archive days (deduped by matchId). */
export function buildFixtureSearchDocuments(dayLimit = 3): SearchDocument[] {
  const dates = recentArchiveDates(dayLimit);
  const seen = new Set<number>();
  const documents: SearchDocument[] = [];

  for (const date of dates) {
    const archive = readArchive(date);
    if (!archive) continue;
    const rows = [
      ...(archive.fh ?? []),
      ...(archive.over15 ?? []),
      ...(archive.over25 ?? []),
      ...(archive.sh ?? []),
    ];
    for (const row of rows) {
      if (!row.matchId || seen.has(row.matchId)) continue;
      const home = (row.homeTeam ?? "").trim();
      const away = (row.awayTeam ?? "").trim();
      if (!home || !away) continue;
      seen.add(row.matchId);
      const title = `${home} vs ${away}`;
      const slug = String(row.matchId);
      const competition = (row.competition ?? "").trim();
      const aliases = [home, away, competition].filter(Boolean);
      documents.push({
        id: `fixture:${slug}`,
        entityType: "fixture",
        slug,
        title,
        aliases,
        locale: "en",
        keywords: [competition, row.country ?? "", row.countryCode ?? "", date],
        popularityWeight: 0.4,
        graphScore: 1,
        integrityScore: 1,
        searchable: true,
        active: true,
        pathTemplate: `/fixtures/${slug}`,
        normalizedSlug: normalizeSlugKey(slug),
        normalizedTitle: normalizeSearchQuery(title),
        normalizedAliases: aliases.map((alias) => normalizeSearchQuery(alias)).filter(Boolean),
        normalizedKeywords: [competition, row.country ?? "", date]
          .map((kw) => normalizeSearchQuery(kw))
          .filter(Boolean),
      });
    }
  }

  return documents;
}
