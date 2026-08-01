import type { Dictionary } from "@/lib/dictionaries";
import { Send } from "lucide-react";

export function TelegramCta({ dict }: { dict: Dictionary }) {
 const url = process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/your_channel";
 return (
 <section className="relative my-12 overflow-hidden rounded-xl border border-accent/30 from-ink-card to-ink-soft p-8 text-center sm:p-10">
 <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
 <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
 <div className="relative">
 <span className="chip mb-3 border-accent/40 text-accent">
 <Send className="h-4 w-4" aria-hidden /> Telegram
 </span>
 <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
 {dict.telegram.title}
 </h2>
 <p className="mx-auto mt-2 max-w-2xl text-[var(--ink-secondary)]">
 {dict.telegram.body}
 </p>
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer nofollow"
 className="mt-6 inline-flex items-center gap-2 rounded-xl from-accent to-accent-dark px-7 py-3 font-semibold text-background shadow-card transition-transform hover:-translate-y-0.5"
 >
 {dict.telegram.button}
 </a>
 </div>
 </section>
 );
}
