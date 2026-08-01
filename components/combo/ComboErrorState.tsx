export function ComboErrorState({
 title,
 body,
 details,
}: {
 title: string;
 body: string;
 details?: string;
}) {
 return (
 <div
 className="rounded-md border border-[var(--red-primary)] bg-[var(--red-surface)] px-4 py-6 text-[var(--red-primary)]"
 role="alert"
 >
 <h3 className="font-display text-lg font-semibold">{title}</h3>
 <p className="mt-2 text-sm">{body}</p>
 {details ? <p className="mt-2 text-xs opacity-80">{details}</p> : null}
 </div>
 );
}
