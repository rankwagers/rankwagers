# Load testing

Use staging or local mock only. Never hit real affiliate destinations.

```bash
npm run load:phase-c -- http://127.0.0.1:3000
# or staging origin with durable LKG snapshots warm
```

## Scenarios

- Homepage / combo SSR (LKG)
- Combo generate/replace/remove bursts
- `/go` with `redirect: manual` (no follow)
- Health/ready
- Auth failures on diagnostics/admin

## Capture

Throughput, p50/p95, error rate, memory, rate-limit rejects, snapshot read latency.

Single-instance memory rate limiter assumption remains — do not scale PM2 instances without a shared limiter.
