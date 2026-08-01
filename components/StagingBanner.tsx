import { publicFeatureFlags } from "@/lib/config/featureFlags";

/** Non-sensitive staging marker — never used for security decisions. */
export function StagingBanner() {
 const flags = publicFeatureFlags();
 if (!flags.stagingBannerVisible) return null;
 return (
 <div
 role="status"
 className="bg-[var(--amber-surface)] px-3 py-1.5 text-center text-xs font-medium text-black"
 >
 Staging environment — not for public indexing or production traffic
 </div>
 );
}
