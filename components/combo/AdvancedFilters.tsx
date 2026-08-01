"use client";

export function AdvancedFilters({
  excludeSameCompetition,
  excludeSameCountry,
  limitSameKickoffWindow,
  onChange,
}: {
  excludeSameCompetition: boolean;
  excludeSameCountry: boolean;
  limitSameKickoffWindow: boolean;
  onChange: (next: {
    excludeSameCompetition: boolean;
    excludeSameCountry: boolean;
    limitSameKickoffWindow: boolean;
  }) => void;
}) {
  return (
    <details className="rounded-md border border-border bg-[var(--canvas-secondary)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Advanced correlation filters
      </summary>
      <fieldset className="mt-3 space-y-3">
        <legend className="sr-only">Advanced filters</legend>
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={excludeSameCompetition}
            onChange={(e) =>
              onChange({
                excludeSameCompetition: e.target.checked,
                excludeSameCountry,
                limitSameKickoffWindow,
              })
            }
          />
          Exclude same competition
        </label>
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={excludeSameCountry}
            onChange={(e) =>
              onChange({
                excludeSameCompetition,
                excludeSameCountry: e.target.checked,
                limitSameKickoffWindow,
              })
            }
          />
          Exclude same country
        </label>
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={limitSameKickoffWindow}
            onChange={(e) =>
              onChange({
                excludeSameCompetition,
                excludeSameCountry,
                limitSameKickoffWindow: e.target.checked,
              })
            }
          />
          Limit same kickoff window
        </label>
      </fieldset>
    </details>
  );
}
