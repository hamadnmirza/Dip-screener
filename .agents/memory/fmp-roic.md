---
name: ROIC source — use Finnhub roiTTM, not FMP
description: FMP free plan blocks /key-metrics-ttm entirely. Use Finnhub roiTTM already fetched.
---

## Rule
Do NOT use FMP for ROIC. The FMP free plan returns "Limit Reach" on `/key-metrics-ttm` regardless of rate limiting. Finnhub's `/stock/metric?metric=all` (already fetched and cached for P/E and P/S) also returns `roiTTM` in **percent form** (e.g. 26.33 = 26.33%).

## Implementation
`FinnhubBasicMetrics.roiTTM` → parsed in `fetchFinnhubValuation` as `roiTtm` on `FinnhubValuationData`. Degenerate guard: `|roi| > 200` → null. In `verdicts.ts`, divide by 100 before passing to `computeRoicFlag` (which expects decimal form matching ROIC_THRESHOLDS).

## Why
Discovered when FMP returned "Limit Reach" in production despite a valid API key. Finnhub already returns an equivalent field in the same cached call — zero extra API calls needed.

