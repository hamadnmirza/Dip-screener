---
name: ROIC scoring architecture
description: How ROIC acts as a quality modifier on top of the cheapness verdict; where thresholds live.
---

## Rule
ROIC is a one-notch quality modifier on the verdict scale (Undervalued → At value → Overvalued). It does NOT replace the cheapness signal.

- positive/strong_positive → shift one notch favourable
- negative/strong_negative → shift one notch unfavourable
- strong_negative exception: cannot produce "Undervalued" — capped at "At value"
- neutral/skipped/missing → no change

## Threshold location
All thresholds and sector rules live in `sector-medians.ts` (ROIC_THRESHOLDS, getRoicSectorConfig). Logic lives in `scoring.ts` (computeRoicFlag, applyRoicModifier).

## Sector exceptions
- Financials → skip entirely (invested capital not meaningful for banks/insurance)
- Utilities + Telecom Services → capital-intensive; reduce all thresholds by 3pp

## Why
Keeps scoring logic pure and thresholds tunable without touching functions. Matches spec requirement: "keep thresholds in config file so they can be tuned without touching logic."
