---
name: Analyst price target API access
description: Neither Finnhub nor FMP free tier provides analyst price target endpoints; feature is built and wired but requires a paid plan.
---

## Rule
Analyst consensus price targets are paywalled on every major free-tier API:
- **Finnhub** `/stock/price-target` → 403 Forbidden (hardcoded premium gate)
- **FMP** `/price-target-consensus` (v3 and stable) → 429 on first request of a session (either daily cap exhausted or premium gate)

**Why:** Analyst price targets are considered premium financial data by all major aggregators.

## Current implementation state
All the scaffolding is in place:
- `fmp.ts` → `fetchPriceTarget()` using `withFmpRateLimit` + FMP v3 `/price-target-consensus`
- `scoring.ts` → `VerdictResult.priceTarget` field
- `verdicts.ts` → fetches price target in `computeTickerVerdict`
- `VerdictDetail.tsx` → `PriceTargetSection` component (shows "No analyst targets" when null)
- OpenAPI spec → `PriceTarget` schema + `priceTarget` field on `TickerVerdict`

## How to activate
Upgrade to **FMP Starter** (~$14/month) and set the paid `FMP_KEY`. No code changes needed — `fetchPriceTarget` will start returning data automatically.
