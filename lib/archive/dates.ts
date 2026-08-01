import fs from "fs/promises";
import path from "path";

const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives");

/** Newest-first list of archive dates that exist on disk. */
export async function listArchiveDates(limit?: number): Promise<string[]> {
  try {
    const names = await fs.readdir(ARCHIVE_DIR);
    const dates = names
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ""))
      .sort()
      .reverse();
    return typeof limit === "number" ? dates.slice(0, limit) : dates;
  } catch {
    return [];
  }
}

export function isArchiveDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
