---
name: FMP v3 for ROIC
description: FMP stable API doesn't have roicTTM field; must use v3.
---

## Rule
FMP stable API (https://financialmodelingprep.com/stable) uses verbose field names and does NOT return `roicTTM`. The v3 API (https://financialmodelingprep.com/api/v3/key-metrics-ttm/{ticker}) returns `roicTTM` as a decimal.

## Implementation
fmp.ts has a separate `fmpV3Fetch` helper pointing to `FMP_V3_BASE` = `https://financialmodelingprep.com/api/v3`. `fetchFmpRoic` uses this helper. Other FMP functions continue using the stable API.

## Why
When this was first attempted with the stable API the field was absent. Degenerate ROIC values (|roic| > 2.0, from negative invested capital) are filtered to null at the fetch layer.
