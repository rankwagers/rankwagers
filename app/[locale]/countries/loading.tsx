/* Route-level loading state for the countries family — form-guide idiom: quiet,
   ruled, monochrome. No spinners, no color; the same ground the page lands on. */
export default function CountriesLoading() {
  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <div className="mx-auto max-w-3xl px-4 pt-16" aria-busy="true">
        <p className="rw-label">Loading</p>
        <div className="mt-6 space-y-0 border-t border-[var(--hero-line)]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border-b border-[var(--hero-line)] py-4"
            >
              <div
                className="h-3 animate-pulse bg-[var(--hero-line)]"
                style={{ width: `${72 - i * 9}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
