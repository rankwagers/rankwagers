import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type RedirectContractDiagnostic = {
  goPathServerOnly: boolean;
  redirectTokenServerOnly: boolean;
  signOffersServerOnly: boolean;
  goRejectsClientDestination: boolean;
  notes: string[];
};

/** Static contract checks — no secrets, no network. */
export function diagnoseRedirectContracts(): RedirectContractDiagnostic {
  const root = process.cwd();
  const read = (rel: string) => {
    const p = path.join(root, rel);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  const goPath = read("lib/operators/go-path.ts");
  const token = read("lib/operators/redirect-token.ts");
  const sign = read("lib/affiliate/signOffers.ts");
  const route = read("app/go/[brand]/route.ts");

  return {
    goPathServerOnly: /server-only/.test(goPath),
    redirectTokenServerOnly: /server-only/.test(token),
    signOffersServerOnly: /server-only/.test(sign),
    goRejectsClientDestination:
      /destination/.test(route) && /reject|forbidden|invalid/i.test(route),
    notes: [
      "Diagnostics are file-contract based; they do not call affiliate networks.",
      "External HEAD/GET destination checks are not enabled by default.",
    ],
  };
}
