import type { Brand } from "./brands";

export function isAffiliateConfigured(brand: Brand): boolean {
  return !brand.affiliateUrl.includes("TO-CONFIGURE");
}
