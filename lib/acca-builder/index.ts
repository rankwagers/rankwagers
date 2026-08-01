/** Browser-safe Acca Builder surface. Server loaders stay in load.server.ts. */
export * from "./contracts";
export * from "./config";
export * from "./normalize";
export * from "./eligibility";
export * from "./scoring";
export * from "./conflicts";
export * from "./combinations";
export * from "./diagnostics";
export * from "./analytics";
export * from "./history";
export * from "./odds";
export * from "./evidence";
export { buildAccaCombinations } from "./service";
export type { BuildAccaInput, OddsLookup } from "./service";
