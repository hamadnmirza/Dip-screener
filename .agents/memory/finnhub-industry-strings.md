---
name: Finnhub industry string mapping
description: Finnhub returns BOTH granular and broad industry strings for finnhubIndustry — the map must handle both.
---

## Rule
Finnhub's `/stock/profile2` `finnhubIndustry` field uses inconsistent granularity:
- Some tickers get granular: `"Semiconductors"`, `"Pharmaceuticals"`, `"Aerospace & Defense"`
- Others get broad: `"Technology"`, `"Banking"`, `"Financial Services"`, `"Media"`, `"Retail"`, `"Automobiles"`, `"Health Care"`

**Why:** Finnhub assigns whichever category best fits — some industries have no granular subcategory.

## How to apply
`INDUSTRY_TO_SECTOR` must include BOTH forms. A "passthrough" section maps broad names directly. Missing entries silently fall through to DEFAULT, causing wrong sector bands or failed skip-checks (e.g. banks not being skipped for D/E).

Critical skip-sector entries that must be present:
- `"Banking"` → `"Financials"`
- `"Financial Services"` → `"Financials"`
- `"Insurance"` → `"Financials"` (already in original map)

When adding new sectors to `INDUSTRY_TO_SECTOR`, check what Finnhub actually returns by testing live tickers — do not assume granular names only.
