export function AdminLoginForm() {
 return (
 <div className="flex min-h-screen items-center justify-center bg-[var(--surface-elevated)] px-4 text-foreground">
 <form
 action="/api/admin/login"
 method="post"
 className="w-full max-w-sm rounded-xl border border-border bg-card p-6"
 >
 <h1 className="text-lg font-semibold text-foreground">Admin sign-in</h1>
 <p className="mt-2 text-sm text-[var(--ink-secondary)]">
 Internal Intelligence Dashboard. Not public. Requires ADMIN_KEY.
 </p>
 <label className="mt-4 block text-sm">
 Admin key
 <input
 type="password"
 name="key"
 required
 autoComplete="current-password"
 className="mt-1 w-full min-h-11 rounded-md border border-border bg-[var(--surface-elevated)] px-3 text-foreground"
 />
 </label>
 <button
 type="submit"
 className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--green-surface)] text-sm font-semibold text-foreground"
 >
 Continue
 </button>
 </form>
 </div>
 );
}
