import React, { useState } from "react";
import { SummaryBar } from "@/components/SummaryBar";
import { TopMovers } from "@/components/TopMovers";
import { SecuritiesTable } from "@/components/SecuritiesTable";
import type { CauseMoveFilter } from "@/components/SecuritiesTable";
import { WatchlistTable } from "@/components/WatchlistTable";
import { LastUpdatedBar } from "@/components/LastUpdatedBar";
import { useWatchlist } from "@/hooks/useWatchlist";
import type {
  ListSecuritiesAssetType,
  ListSecuritiesDropRange,
  ListSecuritiesMarket,
  ListSecuritiesTimePeriod,
  GetSecuritiesSummaryTimePeriod,
  GetTopMoversTimePeriod,
  GetTopMoversAssetType
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type MainTab = "scanner" | "watchlist";

export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>("scanner");
  const [timePeriod, setTimePeriod] = useState<ListSecuritiesTimePeriod>("24h");
  const [assetType, setAssetType] = useState<ListSecuritiesAssetType | "all">("all");
  const [market, setMarket] = useState<ListSecuritiesMarket | "all">("all");
  const [dropRange, setDropRange] = useState<ListSecuritiesDropRange | "all">("all");
  const [causeFilter, setCauseFilter] = useState<CauseMoveFilter>("all");

  const { entries, tickers: watchedTickers, toggle: toggleWatch, isWatched } = useWatchlist();

  const listParams = {
    timePeriod,
    ...(assetType !== "all" ? { assetType } : {}),
    ...(market !== "all" && assetType !== "crypto" ? { market } : {}),
    ...(dropRange !== "all" ? { dropRange } : {}),
  };

  const summaryParams = {
    timePeriod: timePeriod as GetSecuritiesSummaryTimePeriod,
  };

  const moversParams = {
    timePeriod: timePeriod as GetTopMoversTimePeriod,
    ...(assetType !== "all" ? { assetType: assetType as GetTopMoversAssetType } : {}),
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans selection:bg-primary/30">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-8 border-b border-border pb-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="w-3 h-3 bg-destructive rounded-sm inline-block"></span>
              Dip Tracker
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Market intelligence for significant price drops</p>
          </div>
        </header>

        {/* ── Main tabs ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("scanner")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "scanner"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Scanner
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === "watchlist"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Watchlist
            {watchedTickers.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === "watchlist"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              }`}>
                {watchedTickers.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "scanner" && (
          <>
            <SummaryBar params={summaryParams} />

            <div className="bg-card border border-border p-4 rounded-md mb-8 flex flex-wrap gap-4 items-end shadow-sm">
              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Period</Label>
                <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as ListSecuritiesTimePeriod)}>
                  <SelectTrigger data-testid="select-time-period" className="bg-background border-border">
                    <SelectValue placeholder="Time Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="24h">24 Hours</SelectItem>
                    <SelectItem value="1w">1 Week</SelectItem>
                    <SelectItem value="1m">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset Type</Label>
                <Select value={assetType} onValueChange={(v) => {
                  setAssetType(v as ListSecuritiesAssetType | "all");
                  if (v === "crypto") setMarket("all");
                }}>
                  <SelectTrigger data-testid="select-asset-type" className="bg-background border-border">
                    <SelectValue placeholder="All Assets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assets</SelectItem>
                    <SelectItem value="equity">Equities</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(assetType === "all" || assetType === "equity") && (
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market</Label>
                  <Select value={market} onValueChange={(v) => setMarket(v as ListSecuritiesMarket | "all")}>
                    <SelectTrigger data-testid="select-market" className="bg-background border-border">
                      <SelectValue placeholder="All Markets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Markets</SelectItem>
                      <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                      <SelectItem value="FTSE100">FTSE 100</SelectItem>
                      <SelectItem value="FTSE250">FTSE 250</SelectItem>
                      <SelectItem value="SP500">S&P 500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-[150px]">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drop Range</Label>
                <Select value={dropRange} onValueChange={(v) => setDropRange(v as ListSecuritiesDropRange | "all")}>
                  <SelectTrigger data-testid="select-drop-range" className="bg-background border-border">
                    <SelectValue placeholder="Any Drop" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Drop</SelectItem>
                    <SelectItem value="up_to_10">Up to 10%</SelectItem>
                    <SelectItem value="11_to_20">11% – 20%</SelectItem>
                    <SelectItem value="21_to_30">21% – 30%</SelectItem>
                    <SelectItem value="31_plus">31%+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cause filter — equities only */}
              {(assetType === "all" || assetType === "equity") && (
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cause</Label>
                  <Select
                    value={causeFilter}
                    onValueChange={(v) => setCauseFilter(v as CauseMoveFilter)}
                  >
                    <SelectTrigger data-testid="select-cause-filter" className="bg-background border-border">
                      <SelectValue placeholder="All Causes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Causes</SelectItem>
                      <SelectItem value="company_specific">Company-specific only</SelectItem>
                      <SelectItem value="market_driven">Market / sector driven</SelectItem>
                      <SelectItem value="relative_outperformer">Outperforming sector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TopMovers params={moversParams} />

            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground mb-3 tracking-tight">Scanner Results</h2>
              <SecuritiesTable
                params={listParams}
                isWatched={isWatched}
                onToggleWatch={toggleWatch}
                causeFilter={causeFilter}
              />
              <p className="mt-3 text-[11px] text-muted-foreground/40 leading-relaxed">
                This is not financial advice. Verdicts reflect P/E and P/S ratios relative to sector medians at the time of calculation and may not account for qualitative factors, non-financial risks, or information not captured in the metrics shown. Always do your own research before making any investment decisions.
              </p>
            </div>
          </>
        )}

        {activeTab === "watchlist" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Your Watchlist</h2>
              {watchedTickers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {watchedTickers.length} ticker{watchedTickers.length !== 1 ? "s" : ""} tracked · showing 24h change
                </p>
              )}
            </div>
            <WatchlistTable entries={entries} onToggle={toggleWatch} />
            {watchedTickers.length > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground/40 leading-relaxed">
                This is not financial advice. Always do your own research before making any investment decisions.
              </p>
            )}
          </div>
        )}

        <LastUpdatedBar />
      </div>
    </div>
  );
}
