import { z } from "zod";

/**
 * FOOTY ROW CONTRACT — the field constraints a provider match must satisfy to be usable.
 *
 * One definition, two readers:
 *
 *   · `fetchDailyListsUncached` applies it to every raw match to count the `validated` stage
 *     (rwdesign §6). A row failing here is unusable regardless of what its thresholds say.
 *   · `qualifiedFixture.ts` extends it with the presentation-only fields to parse a single
 *     fixture for the research feed.
 *
 * The constraints live here and nowhere else. Two copies would drift, and the moment they drifted
 * the `validated` count would stop describing the rows the pipeline actually accepts — which
 * would make it a fabricated observation rather than a measured one.
 */
export const footyRowCoreSchema = z.object({
  matchId: z.number().int().positive(),
  homeTeam: z.string().trim().min(1),
  awayTeam: z.string().trim().min(1),
  kickoffTime: z.number().finite().positive(),
  over15Pct: z.number().finite().min(0).max(100),
  fhOver05Pct: z.number().finite().min(0).max(100),
  over25Pct: z.number().finite().min(0).max(100),
  shOver05Pct: z.number().finite().min(0).max(100),
});

export type FootyRowCore = z.infer<typeof footyRowCoreSchema>;
