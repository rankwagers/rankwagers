"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
 FormEvent,
 KeyboardEvent,
 useEffect,
 useId,
 useMemo,
 useRef,
 useState,
} from "react";
import type { Locale } from "@/lib/i18n";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import {
 SEARCH_GROUP_LABELS,
 SEARCH_GROUP_ORDER,
 type SearchGroupKey,
 type SearchResult,
} from "@/lib/search/types";
import { normalizeSearchQuery } from "@/lib/search/normalizer";
import { searchEventProperties } from "@/lib/search/analytics";
import {
 loadRecentSearchQueries,
 rememberSearchQuery,
} from "@/lib/search/recentQueries";
import { HighlightMatch } from "./HighlightMatch";

type ApiPayload = {
 query: string;
 results: SearchResult[];
 groups: Partial<Record<SearchGroupKey, SearchResult[]>>;
 meta: { count: number; tookMs: number; emptyReason?: string };
};

const DEBOUNCE_MS = 220;

export function GlobalSearch({
 locale,
 variant = "header",
 onNavigate,
}: {
 locale: Locale;
 variant?: "header" | "mobile";
 onNavigate?: () => void;
}) {
 const router = useRouter();
 const listboxId = useId();
 const inputId = useId();
 const [query, setQuery] = useState("");
 const [results, setResults] = useState<SearchResult[]>([]);
 const [groups, setGroups] = useState<Partial<Record<SearchGroupKey, SearchResult[]>>>({});
 const [open, setOpen] = useState(false);
 const [activeIndex, setActiveIndex] = useState(-1);
 const [loading, setLoading] = useState(false);
 const [recentQueries, setRecentQueries] = useState<string[]>([]);
 const openedRef = useRef(false);
 const abortRef = useRef<AbortController | null>(null);
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 setRecentQueries(loadRecentSearchQueries());
 }, []);

 const flatResults = useMemo(() => {
 const grouped = SEARCH_GROUP_ORDER.flatMap((key) => groups[key] ?? []);
 return grouped.length ? grouped : results;
 }, [groups, results]);

 const groupedEntries = useMemo(() => {
 let cursor = 0;
 return SEARCH_GROUP_ORDER.flatMap((groupKey) => {
 const rows = groups[groupKey] ?? [];
 if (!rows.length) return [];
 const withIndex = rows.map((result) => {
 const index = cursor;
 cursor += 1;
 return { result, index };
 });
 return [{ groupKey, rows: withIndex }];
 });
 }, [groups]);

 useEffect(() => {
 return () => {
 if (debounceRef.current) clearTimeout(debounceRef.current);
 abortRef.current?.abort();
 };
 }, []);

 function trackOpen() {
 if (openedRef.current) return;
 openedRef.current = true;
 trackAnalyticsEvent({
 event_name: "search_open",
 fixture_id: null,
 market: null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: searchEventProperties({ locale, timestamp: new Date().toISOString() }),
 });
 }

 function runSearch(raw: string) {
 const normalized = normalizeSearchQuery(raw);
 if (!normalized) {
 setResults([]);
 setGroups({});
 setOpen(false);
 setActiveIndex(-1);
 setLoading(false);
 return;
 }

 abortRef.current?.abort();
 const controller = new AbortController();
 abortRef.current = controller;
 setLoading(true);

 void fetch(`/api/search?q=${encodeURIComponent(normalized)}&locale=${locale}`, {
 signal: controller.signal,
 })
 .then(async (response) => {
 if (!response.ok) throw new Error("search_failed");
 return (await response.json()) as ApiPayload;
 })
 .then((payload) => {
 setResults(payload.results ?? []);
 setGroups(payload.groups ?? {});
 setOpen(true);
 setActiveIndex(-1);
 trackAnalyticsEvent({
 event_name: "search_query",
 fixture_id: null,
 market: null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: searchEventProperties({
 query: payload.query,
 locale,
 results_count: payload.meta?.count ?? 0,
 }),
 });
 if (!(payload.results ?? []).length) {
 trackAnalyticsEvent({
 event_name: "search_empty",
 fixture_id: null,
 market: null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: searchEventProperties({
 query: payload.query,
 locale,
 results_count: 0,
 }),
 });
 }
 })
 .catch((error: unknown) => {
 if (error instanceof DOMException && error.name === "AbortError") return;
 setResults([]);
 setGroups({});
 setOpen(true);
 })
 .finally(() => setLoading(false));
 }

 function scheduleSearch(value: string) {
 if (debounceRef.current) clearTimeout(debounceRef.current);
 debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
 }

 function clearSearch() {
 setQuery("");
 setResults([]);
 setGroups({});
 setOpen(false);
 setActiveIndex(-1);
 openedRef.current = false;
 abortRef.current?.abort();
 }

 function goToSearchPage(raw: string) {
 const normalized = normalizeSearchQuery(raw);
 if (!normalized) return;
 onNavigate?.();
 router.push(`/${locale}/search?q=${encodeURIComponent(normalized)}`);
 setOpen(false);
 }

 function handleSubmit(event: FormEvent) {
 event.preventDefault();
 if (activeIndex >= 0 && flatResults[activeIndex]) {
 selectResult(flatResults[activeIndex], activeIndex);
 return;
 }
 goToSearchPage(query);
 }

 function selectResult(result: SearchResult, position: number) {
 const normalized = normalizeSearchQuery(query);
 if (normalized) setRecentQueries(rememberSearchQuery(normalized));
 trackAnalyticsEvent({
 event_name: "search_result_click",
 fixture_id: result.entityType === "fixture" ? Number(result.slug) || null : null,
 market: result.entityType === "market" ? result.slug : null,
 operator_slug: result.entityType === "operator" ? result.slug : null,
 locale,
 user_id: null,
 properties: searchEventProperties({
 query: normalized,
 entity_type: result.entityType,
 entity_slug: result.slug,
 locale,
 result_position: position,
 results_count: flatResults.length,
 }),
 });
 onNavigate?.();
 setOpen(false);
 router.push(result.href);
 }

 function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
 if (event.key === "Escape") {
 event.preventDefault();
 clearSearch();
 return;
 }

 if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
 if (query.trim()) runSearch(query);
 return;
 }

 if (event.key === "ArrowDown") {
 event.preventDefault();
 setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1));
 trackAnalyticsEvent({
 event_name: "search_keyboard_navigation",
 fixture_id: null,
 market: null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: searchEventProperties({
 query: normalizeSearchQuery(query),
 locale,
 key: "ArrowDown",
 results_count: flatResults.length,
 }),
 });
 return;
 }

 if (event.key === "ArrowUp") {
 event.preventDefault();
 setActiveIndex((index) => Math.max(index - 1, -1));
 trackAnalyticsEvent({
 event_name: "search_keyboard_navigation",
 fixture_id: null,
 market: null,
 operator_slug: null,
 locale,
 user_id: null,
 properties: searchEventProperties({
 query: normalizeSearchQuery(query),
 locale,
 key: "ArrowUp",
 results_count: flatResults.length,
 }),
 });
 return;
 }

 if (event.key === "Enter" && activeIndex >= 0 && flatResults[activeIndex]) {
 event.preventDefault();
 selectResult(flatResults[activeIndex], activeIndex);
 }
 }

 // Widens at 2xl rather than xl: xl is exactly where the compact nav row appears, and taking
 // another 48px for the input at that width is what pushed the row into the search box.
 const widthClass = variant === "mobile" ? "w-full" : "w-52 2xl:w-64";
 const formClass =
 variant === "mobile" ? "relative w-full" : "relative hidden lg:block";
 const resultSummary = loading
 ? "Searching"
 : query.trim()
 ? `${flatResults.length} result${flatResults.length === 1 ? "" : "s"}`
 : "";

 return (
 <form className={formClass} onSubmit={handleSubmit} role="search">
 <label htmlFor={inputId} className="sr-only">
 Search fixtures, teams, competitions, markets, countries, and bookmakers
 </label>
 <Search
 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
 aria-hidden
 />
 <input
 id={inputId}
 type="search"
 value={query}
 autoComplete="off"
 autoCorrect="off"
 spellCheck={false}
 role="combobox"
 aria-expanded={open}
 aria-controls={listboxId}
 aria-autocomplete="list"
 aria-activedescendant={
 activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
 }
 onChange={(event) => {
 const value = event.target.value;
 setQuery(value);
 scheduleSearch(value);
 }}
 onFocus={trackOpen}
 onKeyDown={handleKeyDown}
 className={`${widthClass} min-h-10 rounded-md border border-border bg-muted py-1.5 pl-8 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
 placeholder="Search entities"
 aria-label="Search fixtures, teams, competitions, markets, countries, and bookmakers"
 />
 <p className="sr-only" aria-live="polite" aria-atomic="true">
 {open ? resultSummary : ""}
 </p>
 {open && (
 <div
 id={listboxId}
 role="listbox"
 aria-label="Search results"
 className={`absolute ${variant === "mobile" ? "left-0 right-0" : "right-0"} top-full z-50 mt-2 max-h-96 w-full min-w-[20rem] overflow-auto rounded-md border border-border bg-[var(--canvas-secondary)] shadow-elevated`}
 >
 {loading && !flatResults.length ? (
 <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
 Searching…
 </p>
 ) : groupedEntries.length ? (
 groupedEntries.map(({ groupKey, rows }) => (
 <div key={groupKey} role="group" aria-label={SEARCH_GROUP_LABELS[groupKey]}>
 <p className="sticky top-0 bg-[var(--canvas-secondary)] px-3 py-1.5 text-metadata font-medium uppercase tracking-label text-muted-foreground">
 {SEARCH_GROUP_LABELS[groupKey]}
 </p>
 {rows.map(({ result, index }) => {
 const active = index === activeIndex;
 return (
 <Link
 key={`${result.entityType}-${result.slug}`}
 id={`${listboxId}-option-${index}`}
 href={result.href}
 role="option"
 aria-selected={active}
 onClick={(event) => {
 event.preventDefault();
 selectResult(result, index);
 }}
 className={`block border-b border-border px-3 py-2 text-sm last:border-0 ${
 active
 ? "bg-[var(--green-surface)] text-foreground"
 : "text-foreground hover:bg-[var(--green-surface)]"
 }`}
 >
 <HighlightMatch text={result.title} query={query} />
 <span className="mt-0.5 block text-metadata text-muted-foreground">
 {SEARCH_GROUP_LABELS[groupKey]}
 </span>
 </Link>
 );
 })}
 </div>
 ))
 ) : (
 <div className="px-3 py-3 text-sm text-muted-foreground">
 <p role="status">No matching entities for “{query.trim()}”.</p>
 {recentQueries.length ? (
 <div className="mt-3">
 <p className="text-metadata font-medium uppercase tracking-label">Recent searches</p>
 <ul className="mt-1 space-y-1">
 {recentQueries.slice(0, 5).map((recent) => (
 <li key={recent}>
 <button
 type="button"
 className="text-left text-brand underline-offset-2 hover:underline"
 onClick={() => {
 setQuery(recent);
 runSearch(recent);
 }}
 >
 {recent}
 </button>
 </li>
 ))}
 </ul>
 </div>
 ) : null}
 <button
 type="button"
 className="mt-3 text-brand underline-offset-2 hover:underline"
 onClick={() => goToSearchPage(query)}
 >
 Open full search
 </button>
 </div>
 )}
 </div>
 )}
 </form>
 );
}
