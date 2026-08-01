import type { Operator, OperatorCountryAvailability } from "./types";

export function resolveOperatorAvailability(
  operator: Operator,
  visitorCountry: string | null | undefined
): OperatorCountryAvailability {
  const country = (visitorCountry ?? "").toUpperCase();
  if (!operator.supportedCountries.length) {
    return {
      visitorCountry: country || "—",
      available: true,
      label: "Availability not restricted",
    };
  }
  if (!country) {
    return {
      visitorCountry: "—",
      available: false,
      label: "Not currently available",
    };
  }
  const available = operator.supportedCountries.includes(country);
  return {
    visitorCountry: country,
    available,
    label: available ? "Available in your country" : "Not currently available",
  };
}
