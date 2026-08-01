export function GambleAwareNotice() {
  return (
    <div className="mb-6 card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
            Gamble responsibly
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
            This site is for users aged <strong className="font-semibold text-foreground">18+</strong>{" "}
            only. Gambling can be addictive — please play responsibly and only bet what you can
            afford to lose. If gambling is affecting you or someone you know, free confidential
            help is available from{" "}
            <a
              href="https://www.begambleaware.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-light underline decoration-brand-light/40 underline-offset-2 hover:text-foreground"
            >
              GambleAware
            </a>{" "}
            (BeGambleAware.org).
          </p>
        </div>
        <a
          href="https://www.begambleaware.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-label text-foreground transition-colors hover:border-border hover:text-foreground"
        >
          GambleAware →
        </a>
      </div>
    </div>
  );
}
