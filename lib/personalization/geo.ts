import { detectCountry as detectGeoCountry } from "@/lib/geo";

const ISO_ALPHA2 = /^[A-Z]{2}$/;

export function isCountryCode(value: string | null | undefined): value is string {
  return Boolean(value && ISO_ALPHA2.test(value.toUpperCase()));
}

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return isCountryCode(code) ? code : null;
}

/** GeoIP / edge headers → ISO alpha-2 (or null). */
export function detectCountryFromHeaders(headers: Headers): string | null {
  return normalizeCountryCode(detectGeoCountry(headers));
}

export function parseCountryParam(value: string | null | undefined): string | null {
  return normalizeCountryCode(value);
}
