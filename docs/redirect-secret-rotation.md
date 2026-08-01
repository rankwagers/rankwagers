# Redirect secret rotation

## Env

- `AFFILIATE_REDIRECT_SECRET` — active (signing)
- `AFFILIATE_REDIRECT_PREVIOUS_SECRET` — optional verification
- `AFFILIATE_REDIRECT_TOKEN_TTL_SECONDS` — default 900

## Token

`r2.<body>.<sig>.<nonce>` — HMAC-SHA256, no destination URL inside.

Legacy `r1` still verifies during transition.

## Procedure (zero downtime)

1. Move current active → `AFFILIATE_REDIRECT_PREVIOUS_SECRET`
2. Set new `AFFILIATE_REDIRECT_SECRET`
3. Deploy
4. Wait > max TTL
5. Remove previous secret
6. Deploy again

## Verification rules

- Active signs only
- Active + previous verify
- Expired / malformed / unsupported version / CRLF → fail
- Never log full tokens or signatures
