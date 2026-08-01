# Admin authentication

## Model

- **Browser:** POST `/api/admin/login` with form field `key` → opaque HttpOnly cookie `rw_admin_session`
- **API:** `Authorization: Bearer <ADMIN_KEY>`
- **Rejected:** `?key=` query strings, non-HttpOnly client cookies, default secrets in staging/production

## Cookie

| Attribute | Value |
|---|---|
| Name | `rw_admin_session` |
| HttpOnly | yes |
| Secure | staging/production |
| SameSite | Lax |
| Path | `/` |
| Max-Age | 12 hours |

Cookie value is `s1.<exp>.<nonce>.<hmac>` — raw `ADMIN_KEY` is never stored in the cookie.

## Disable

- `FF_EMERGENCY_DISABLE_ADMIN=true` → `/admin` returns 404

## Rate limits

- Login: 10/min per client key (fail-closed)
- Page auth checks: 30/min (fail-closed)

## Logout

POST `/api/admin/logout` clears the session cookie.
