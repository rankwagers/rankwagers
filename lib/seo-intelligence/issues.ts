import type { IssueSeverity, SeoIssue } from "./contracts";

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export function sortIssues(issues: readonly SeoIssue[]): SeoIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
}

export function countBySeverity(
  issues: readonly SeoIssue[]
): Record<IssueSeverity, number> {
  const out: Record<IssueSeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const i of issues) out[i.severity] += 1;
  return out;
}

export function filterIssues(
  issues: readonly SeoIssue[],
  opts: {
    severity?: IssueSeverity | "all";
    pageType?: string;
    q?: string | null;
    offset: number;
    limit: number;
  }
): { total: number; items: SeoIssue[] } {
  let list = [...issues];
  if (opts.severity && opts.severity !== "all") {
    list = list.filter((i) => i.severity === opts.severity);
  }
  if (opts.pageType && opts.pageType !== "all") {
    list = list.filter((i) => i.pageType === opts.pageType);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    list = list.filter(
      (i) =>
        i.url.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.explanation.toLowerCase().includes(q)
    );
  }
  list = sortIssues(list);
  return {
    total: list.length,
    items: list.slice(opts.offset, opts.offset + opts.limit),
  };
}
