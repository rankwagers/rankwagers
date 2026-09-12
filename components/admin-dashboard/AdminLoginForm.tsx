/**
 * V3 reskin — the gate screen renders standalone (AdminGate returns it in
 * place of the shell), so it carries its own `rw3` scope: it is entry
 * chrome, not an admin tool, and contains no v2-themed children. Minimal
 * token swap only: v2 surfaces/borders/inks → rw3 equivalents, radius set
 * inline per the v3 law, auth wiring untouched.
 */
export function AdminLoginForm() {
  return (
    <div className="rw3 flex min-h-screen items-center justify-center px-4">
      <form
        action="/api/admin/login"
        method="post"
        className="w-full max-w-sm p-6"
        style={{
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      >
        <h1 className="rw3-title">Admin sign-in</h1>
        <p className="rw3-meta mt-2">
          Internal Intelligence Dashboard. Not public. Requires ADMIN_KEY.
        </p>
        <label className="mt-4 block text-sm">
          Admin key
          <input
            type="password"
            name="key"
            required
            autoComplete="current-password"
            className="mt-1 min-h-11 w-full px-3"
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
        </label>
        <button
          type="submit"
          className="rw3-ghost mt-4 min-h-11 w-full justify-center"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
