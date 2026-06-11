/**
 * Hardcoded GICS sector median multiples.
 * FMP returns sector names that differ slightly from GICS labels — both are mapped here.
 * Refresh these values quarterly by checking sector ETF P/E data (e.g. S&P SPDR sector ETFs).
 * Last updated: Q2 2025
 */

export interface SectorMedians {
  pe: number;         // P/E ratio
  evEbitda: number;   // EV/EBITDA
  pFcf: number;       // Price / Free Cash Flow
  evRevenue: number;  // EV/Revenue (fallback for unprofitable companies)
}

/**
 * Sector median multiples by sector name.
 * Keys include both GICS canonical names and FMP API names.
 */
const SECTOR_MEDIANS: Record<string, SectorMedians> = {
  // Information Technology / Technology
  "Information Technology": { pe: 28, evEbitda: 20, pFcf: 28, evRevenue: 7 },
  "Technology":             { pe: 28, evEbitda: 20, pFcf: 28, evRevenue: 7 },

  // Health Care
  "Health Care":            { pe: 22, evEbitda: 15, pFcf: 24, evRevenue: 4 },
  "Healthcare":             { pe: 22, evEbitda: 15, pFcf: 24, evRevenue: 4 },

  // Financials / Financial Services
  "Financials":             { pe: 13, evEbitda: 11, pFcf: 14, evRevenue: 3 },
  "Financial Services":     { pe: 13, evEbitda: 11, pFcf: 14, evRevenue: 3 },

  // Consumer Discretionary / Consumer Cyclical
  "Consumer Discretionary": { pe: 24, evEbitda: 13, pFcf: 20, evRevenue: 2 },
  "Consumer Cyclical":      { pe: 24, evEbitda: 13, pFcf: 20, evRevenue: 2 },

  // Communication Services
  "Communication Services": { pe: 19, evEbitda: 11, pFcf: 20, evRevenue: 4 },

  // Industrials
  "Industrials":            { pe: 22, evEbitda: 14, pFcf: 22, evRevenue: 2 },

  // Consumer Staples / Consumer Defensive
  "Consumer Staples":       { pe: 20, evEbitda: 13, pFcf: 21, evRevenue: 2 },
  "Consumer Defensive":     { pe: 20, evEbitda: 13, pFcf: 21, evRevenue: 2 },

  // Energy
  "Energy":                 { pe: 12, evEbitda: 6,  pFcf: 13, evRevenue: 1 },

  // Utilities
  "Utilities":              { pe: 17, evEbitda: 12, pFcf: 19, evRevenue: 3 },

  // Real Estate
  "Real Estate":            { pe: 38, evEbitda: 20, pFcf: 28, evRevenue: 8 },

  // Materials / Basic Materials
  "Materials":              { pe: 18, evEbitda: 10, pFcf: 17, evRevenue: 2 },
  "Basic Materials":        { pe: 18, evEbitda: 10, pFcf: 17, evRevenue: 2 },
};

/** Fallback if sector is unknown or unmapped */
const DEFAULT_MEDIANS: SectorMedians = { pe: 20, evEbitda: 13, pFcf: 20, evRevenue: 3 };

export function getSectorMedians(sector: string | null | undefined): SectorMedians {
  if (!sector) return DEFAULT_MEDIANS;
  return SECTOR_MEDIANS[sector] ?? DEFAULT_MEDIANS;
}

/** Thresholds for cheapness scoring */
export const CHEAPNESS_THRESHOLDS = {
  /** ratio < (1 - BELOW_BAND) * median → +1 (cheap) */
  BELOW_BAND: 0.20,
  /** ratio > (1 + ABOVE_BAND) * median → −1 (expensive) */
  ABOVE_BAND: 0.20,
  /** PEG < PEG_CHEAP → +1 */
  PEG_CHEAP: 1.0,
  /** PEG > PEG_EXPENSIVE → −1 */
  PEG_EXPENSIVE: 2.0,
  /** Net score > 0 → "Cheap" */
  CHEAPNESS_THRESHOLD: 0,
};

/** Thresholds for fundamental momentum scoring */
export const FUNDAMENTALS_THRESHOLDS = {
  /** debt/EBITDA above this triggers balance-sheet gate */
  DEBT_EBITDA_GATE: 3.0,
  /** FCF < 0 = negative */
  FCF_NEGATIVE: 0,
  /** Weighted sum > 0 → "Stable/Improving" */
  MOMENTUM_THRESHOLD: 0,
  /** Estimate revision weight (2x vs revenue/margin 1x each) */
  ESTIMATE_WEIGHT: 2,
};
