/**
 * The build-time SVG flag — the homepage's flag mechanism, shared.
 *
 * Same contract as `V2LeagueCell`: the asset is the vendored `public/flags/4x3/{iso}.svg`
 * (self-hosted, so `img-src 'self'` holds and Windows never renders a bare letter pair the way
 * it does flag emoji), 4:3 at 16×12, hairline outline, `aria-hidden` because the country's NAME
 * prints beside it and a screen reader must not hear the country twice.
 *
 * THE INK FALLBACK IS NOTHING. An unresolvable code renders no glyph — the name alone, in ink,
 * carries the identity. A placeholder flag is a claim about a country nobody resolved.
 */
export function CountryFlagIcon({ code }: { code: string | null | undefined }) {
  const iso = code?.trim().toLowerCase();
  if (!iso || !/^[a-z]{2}$/.test(iso)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/4x3/${iso}.svg`}
      alt=""
      aria-hidden
      width={16}
      height={12}
      loading="lazy"
      decoding="async"
      className="inline-block shrink-0 self-center outline outline-[0.5px] outline-[var(--hero-line)]"
    />
  );
}
