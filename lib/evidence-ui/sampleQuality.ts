import type { SampleQualityView } from "./types";

export function buildSampleQualityView(input: {
  sampleSize: number;
  eligible?: number;
  skipped?: number;
  unknown?: number;
  coveragePercent?: number | null;
  note?: string;
}): SampleQualityView {
  const sampleSize = Math.max(0, Math.floor(input.sampleSize));
  const eligible = input.eligible ?? sampleSize;
  const skipped = input.skipped ?? 0;
  const unknown = input.unknown ?? 0;
  const total = eligible + skipped + unknown;
  const coveragePercent =
    input.coveragePercent ??
    (total > 0 ? Math.round((eligible / total) * 100) : null);

  let label = "No sample";
  if (sampleSize >= 12) label = "Adequate sample";
  else if (sampleSize >= 6) label = "Moderate sample";
  else if (sampleSize >= 3) label = "Limited sample";
  else if (sampleSize > 0) label = "Very limited sample";

  return {
    sampleSize,
    coveragePercent,
    eligible,
    skipped,
    unknown,
    label,
    note: input.note,
  };
}

export function formatSampleSummary(sample: SampleQualityView): string {
  const parts = [`${sample.sampleSize} qualified`];
  if (sample.coveragePercent != null) parts.push(`Coverage ${sample.coveragePercent}%`);
  if (sample.skipped > 0) parts.push(`${sample.skipped} excluded`);
  if (sample.unknown > 0) parts.push(`${sample.unknown} unknown`);
  return parts.join(" · ");
}

export function legacyQualityToSampleView(
  quality: "none" | "very-limited" | "limited" | "adequate" | string,
  sampleSize: number,
  note?: string
): SampleQualityView {
  const size =
    sampleSize > 0
      ? sampleSize
      : quality === "adequate"
        ? 12
        : quality === "limited"
          ? 5
          : quality === "very-limited"
            ? 2
            : 0;
  return buildSampleQualityView({
    sampleSize: size,
    eligible: size,
    skipped: 0,
    unknown: 0,
    coveragePercent: size > 0 ? Math.min(100, Math.round((size / Math.max(size, 10)) * 100)) : null,
    note,
  });
}
