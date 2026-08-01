"use client";

import type { ComboFormState } from "@/lib/combo/clientApi";
import { AdvancedFilters } from "./AdvancedFilters";
import { MarketPreferenceSelector } from "./MarketPreferenceSelector";
import { RiskProfileSelector } from "./RiskProfileSelector";
import { SelectionCountSelector } from "./SelectionCountSelector";
import { TargetOddsSelector } from "./TargetOddsSelector";

export function ComboForm({
 form,
 onChange,
 onSubmit,
 pending,
 fieldErrors,
}: {
 form: ComboFormState;
 onChange: (form: ComboFormState) => void;
 onSubmit: () => void;
 pending: boolean;
 fieldErrors: Record<string, string>;
}) {
 return (
 <form
 className="space-y-8"
 onSubmit={(e) => {
 e.preventDefault();
 onSubmit();
 }}
 >
 <TargetOddsSelector
 min={form.targetOddsMin}
 max={form.targetOddsMax}
 onChange={(min, max) =>
 onChange({ ...form, targetOddsMin: min, targetOddsMax: max })
 }
 />
 {(fieldErrors.targetOddsMin || fieldErrors.targetOddsMax) && (
 <p className="text-sm text-[var(--red-primary)]" role="alert">
 {fieldErrors.targetOddsMin || fieldErrors.targetOddsMax}
 </p>
 )}

 <RiskProfileSelector
 value={form.riskProfile}
 onChange={(riskProfile) => onChange({ ...form, riskProfile })}
 />
 {fieldErrors.riskProfile && (
 <p className="text-sm text-[var(--red-primary)]" role="alert">
 {fieldErrors.riskProfile}
 </p>
 )}

 <MarketPreferenceSelector
 value={form.marketPreferences}
 onChange={(marketPreferences) => onChange({ ...form, marketPreferences })}
 />
 {fieldErrors.marketPreferences && (
 <p className="text-sm text-[var(--red-primary)]" role="alert">
 {fieldErrors.marketPreferences}
 </p>
 )}

 <SelectionCountSelector
 value={form.maxSelections}
 onChange={(maxSelections) => onChange({ ...form, maxSelections })}
 />
 {fieldErrors.maxSelections && (
 <p className="text-sm text-[var(--red-primary)]" role="alert">
 {fieldErrors.maxSelections}
 </p>
 )}

 <AdvancedFilters
 excludeSameCompetition={form.excludeSameCompetition}
 excludeSameCountry={form.excludeSameCountry}
 limitSameKickoffWindow={form.limitSameKickoffWindow}
 onChange={(next) => onChange({ ...form, ...next })}
 />

 <button
 type="submit"
 disabled={pending}
 className="btn-primary min-h-12 w-full sm:w-auto"
 >
 {pending ? "Building combo…" : "Build My Combo"}
 </button>
 </form>
 );
}
