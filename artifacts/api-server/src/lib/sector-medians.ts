/**
 * Sector median multiples used for cheapness scoring.
 * Keyed by Finnhub `finnhubIndustry` strings (from /stock/profile2).
 * Refresh quarterly by checking sector ETF data (e.g. S&P SPDR sector ETFs).
 * Last updated: Q2 2026
 */

export interface SectorMedians {
  pe: number;  // P/E ratio
  ps: number;  // Price-to-Sales ratio
}

/**
 * Maps Finnhub industry strings → broad sector bucket → medians.
 * Finnhub uses granular industry names (e.g. "Semiconductors", "Software").
 */
const INDUSTRY_TO_SECTOR: Record<string, string> = {
  // Technology
  "Semiconductors":                   "Technology",
  "Software":                         "Technology",
  "Software Application":             "Technology",
  "Software Infrastructure":          "Technology",
  "Consumer Electronics":             "Technology",
  "Computer Hardware":                "Technology",
  "Electronic Components":            "Technology",
  "Information Technology Services":  "Technology",
  "Scientific & Technical Instruments": "Technology",
  "Technology Distributors":          "Technology",
  "Communication Equipment":          "Technology",
  "Electronic Gaming & Multimedia":   "Technology",

  // Health Care
  "Biotechnology":                    "Health Care",
  "Pharmaceuticals":                  "Health Care",
  "Drug Manufacturers—General":       "Health Care",
  "Drug Manufacturers—Specialty":     "Health Care",
  "Medical Devices":                  "Health Care",
  "Medical Instruments & Supplies":   "Health Care",
  "Healthcare Plans":                 "Health Care",
  "Medical Care Facilities":          "Health Care",
  "Diagnostics & Research":           "Health Care",
  "Health Information Services":      "Health Care",

  // Financials
  "Banks—Diversified":                "Financials",
  "Banks—Regional":                   "Financials",
  "Banks":                            "Financials",
  "Insurance—Diversified":            "Financials",
  "Insurance—Life":                   "Financials",
  "Insurance—Property & Casualty":    "Financials",
  "Insurance":                        "Financials",
  "Asset Management":                 "Financials",
  "Capital Markets":                  "Financials",
  "Financial Data & Stock Exchanges": "Financials",
  "Credit Services":                  "Financials",
  "Mortgage Finance":                 "Financials",

  // Communication Services
  "Internet Content & Information":   "Communication Services",
  "Entertainment":                    "Communication Services",
  "Telecom Services":                 "Communication Services",
  "Publishing":                       "Communication Services",
  "Broadcasting":                     "Communication Services",
  "Advertising Agencies":             "Communication Services",

  // Consumer Discretionary
  "Auto Manufacturers":               "Consumer Discretionary",
  "Auto Parts":                       "Consumer Discretionary",
  "Specialty Retail":                 "Consumer Discretionary",
  "Internet Retail":                  "Consumer Discretionary",
  "Restaurants":                      "Consumer Discretionary",
  "Apparel Retail":                   "Consumer Discretionary",
  "Apparel Manufacturing":            "Consumer Discretionary",
  "Footwear & Accessories":           "Consumer Discretionary",
  "Hotels & Motels":                  "Consumer Discretionary",
  "Luxury Goods":                     "Consumer Discretionary",
  "Leisure":                          "Consumer Discretionary",
  "Gambling":                         "Consumer Discretionary",

  // Consumer Staples
  "Food Distribution":                "Consumer Staples",
  "Beverages—Non-Alcoholic":          "Consumer Staples",
  "Beverages—Alcoholic":              "Consumer Staples",
  "Beverages":                        "Consumer Staples",
  "Household & Personal Products":    "Consumer Staples",
  "Packaged Foods":                   "Consumer Staples",
  "Grocery Stores":                   "Consumer Staples",
  "Tobacco":                          "Consumer Staples",
  "Discount Stores":                  "Consumer Staples",

  // Industrials
  "Aerospace & Defense":              "Industrials",
  "Industrial Distribution":          "Industrials",
  "Specialty Industrial Machinery":   "Industrials",
  "Engineering & Construction":       "Industrials",
  "Railroads":                        "Industrials",
  "Airlines":                         "Industrials",
  "Trucking":                         "Industrials",
  "Integrated Freight & Logistics":   "Industrials",
  "Business Services":                "Industrials",
  "Staffing & Employment Services":   "Industrials",

  // Energy
  "Oil & Gas Integrated":             "Energy",
  "Oil & Gas E&P":                    "Energy",
  "Oil & Gas Refining & Marketing":   "Energy",
  "Oil & Gas Equipment & Services":   "Energy",
  "Oil & Gas Midstream":              "Energy",

  // Utilities
  "Utilities—Regulated Electric":     "Utilities",
  "Utilities—Renewable":              "Utilities",
  "Utilities—Diversified":            "Utilities",
  "Utilities—Independent Power":      "Utilities",
  "Utilities":                        "Utilities",

  // Real Estate
  "REIT—Diversified":                 "Real Estate",
  "REIT—Retail":                      "Real Estate",
  "REIT—Office":                      "Real Estate",
  "REIT—Industrial":                  "Real Estate",
  "REIT—Healthcare Facilities":       "Real Estate",
  "REIT":                             "Real Estate",
  "Real Estate Services":             "Real Estate",
  "Real Estate—Development":          "Real Estate",

  // Materials
  "Chemicals":                        "Materials",
  "Specialty Chemicals":              "Materials",
  "Steel":                            "Materials",
  "Copper":                           "Materials",
  "Gold":                             "Materials",
  "Mining":                           "Materials",
  "Agricultural Inputs":              "Materials",
  "Paper & Paper Products":           "Materials",
};

const SECTOR_MEDIANS: Record<string, SectorMedians> = {
  "Technology":             { pe: 28, ps: 8  },
  "Health Care":            { pe: 22, ps: 4  },
  "Financials":             { pe: 13, ps: 3  },
  "Consumer Discretionary": { pe: 24, ps: 2  },
  "Communication Services": { pe: 19, ps: 5  },
  "Industrials":            { pe: 22, ps: 2  },
  "Consumer Staples":       { pe: 20, ps: 2  },
  "Energy":                 { pe: 12, ps: 1  },
  "Utilities":              { pe: 17, ps: 3  },
  "Real Estate":            { pe: 38, ps: 8  },
  "Materials":              { pe: 18, ps: 2  },
};

const DEFAULT_MEDIANS: SectorMedians = { pe: 20, ps: 3 };

/**
 * Look up sector medians by Finnhub industry string.
 * Falls back to DEFAULT_MEDIANS if the industry is unmapped.
 */
export function getSectorMedians(finnhubIndustry: string | null | undefined): SectorMedians {
  if (!finnhubIndustry) return DEFAULT_MEDIANS;
  const sector = INDUSTRY_TO_SECTOR[finnhubIndustry];
  if (!sector) return DEFAULT_MEDIANS;
  return SECTOR_MEDIANS[sector] ?? DEFAULT_MEDIANS;
}

/** Thresholds for cheapness scoring */
export const CHEAPNESS_THRESHOLDS = {
  /** ratio < (1 - BELOW_BAND) * median → +1 (cheap) */
  BELOW_BAND: 0.20,
  /** ratio > (1 + ABOVE_BAND) * median → −1 (expensive) */
  ABOVE_BAND: 0.20,
  /** Net score > 0 → "Cheap" */
  CHEAPNESS_THRESHOLD: 0,
};

/** Thresholds for fundamental momentum scoring */
export const FUNDAMENTALS_THRESHOLDS = {
  /** Revenue growth YoY > this % → growing signal (+1) */
  REVENUE_GROWTH_POSITIVE: 5,
  /** Revenue growth YoY < this % → shrinking signal (−1) */
  REVENUE_GROWTH_NEGATIVE: -5,
  /** Estimate revision weight (2x vs revenue 1x) */
  ESTIMATE_WEIGHT: 2,
  /** Weighted sum > 0 → "Stable/Improving" */
  MOMENTUM_THRESHOLD: 0,
};

// ── ROIC configuration ────────────────────────────────────────────────────────

/**
 * ROIC flag thresholds (decimal form, e.g. 0.08 = 8%).
 * Capital-intensive sectors have all non-zero thresholds reduced by CAPITAL_INTENSIVE_REDUCTION.
 */
export const ROIC_THRESHOLDS = {
  /** ROIC < 0 → "strong_negative" (applies to all sectors unchanged) */
  STRONG_NEGATIVE_MAX: 0,
  /** 0 ≤ ROIC < 0.08 → "negative" (below typical WACC) */
  NEGATIVE_MAX: 0.08,
  /** 0.08 ≤ ROIC ≤ 0.12 → "neutral" (roughly earning cost of capital) */
  NEUTRAL_MAX: 0.12,
  /** 0.12 < ROIC ≤ 0.20 → "positive" (value-creating) */
  POSITIVE_MAX: 0.20,
  // ROIC > 0.20 → "strong_positive" (elite, durable moat)
  /** Reduce all thresholds by this for capital-intensive sectors (lower WACC) */
  CAPITAL_INTENSIVE_REDUCTION: 0.03,
};

/**
 * Broad sectors where ROIC is not meaningful (e.g. banks — invested capital measure is unreliable).
 * Skip the modifier entirely for these.
 */
const ROIC_SKIP_BROAD_SECTORS = new Set(["Financials"]);

/**
 * Specific Finnhub industry strings with structurally lower WACC.
 * Applies the CAPITAL_INTENSIVE_REDUCTION to all thresholds.
 */
const ROIC_CAPITAL_INTENSIVE_INDUSTRIES = new Set([
  "Utilities—Regulated Electric",
  "Utilities—Renewable",
  "Utilities—Diversified",
  "Utilities—Independent Power",
  "Utilities",
  "Telecom Services",
]);

/**
 * Returns ROIC scoring config for a given Finnhub industry string.
 * skip: true → ROIC not meaningful; skip modifier entirely.
 * capitalIntensive: true → reduce thresholds by CAPITAL_INTENSIVE_REDUCTION.
 */
export function getRoicSectorConfig(finnhubIndustry: string | null | undefined): {
  skip: boolean;
  capitalIntensive: boolean;
} {
  if (!finnhubIndustry) return { skip: false, capitalIntensive: false };
  const sector = INDUSTRY_TO_SECTOR[finnhubIndustry];
  return {
    skip: ROIC_SKIP_BROAD_SECTORS.has(sector ?? ""),
    capitalIntensive: ROIC_CAPITAL_INTENSIVE_INDUSTRIES.has(finnhubIndustry),
  };
}
