import React, { useState } from "react";
import {
  useGetSecuritiesByTickers,
  getGetSecuritiesByTickersQueryKey,
  useGetVerdicts,
  getGetVerdictsQueryKey,
} from "@workspace/api-client-react";
import type { WatchlistEntry } from "@/hooks/useWatchlist";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { VerdictBadge } from "./VerdictBadge";
import { VerdictDetail } from "./VerdictDetail";
import { StarButton } from "./StarButton";

interface WatchlistTableProps {
  entries: WatchlistEntry[];
  onToggle: (ticker: string) => void;
}

const COL_COUNT = 7;

function formatAddedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WatchlistTable({ entries, onToggle }: WatchlistTableProps) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const tickers = entries.map((e) => e.ticker);
  const tickersParam = tickers.join(",");

  const { data, isLoading } = useGetSecuritiesByTickers(
    { tickers: tickersParam },
    {
      query: {
        enabled: tickers.length > 0,
        queryKey: getGetSecuritiesByTickersQueryKey({ tickers: tickersParam }),
      },
    }
  );

  const equityTickers =
    data?.securities.filter((s) => s.assetType === "equity").map((s) => s.ticker) ?? [];
  const equityParam = equityTickers.join(",");

  const { data: verdictsData, isLoading: verdictsLoading } = useGetVerdicts(
    { tickers: equityParam },
    {
      query: {
        enabled: equityTickers.length > 0,
        queryKey: getGetVerdictsQueryKey({ tickers: equityParam }),
      },
    }
  );

  const verdictMap = verdictsData?.verdicts ?? {};

  // Build a map of ticker → addedAt for display
  const addedAtMap = Object.fromEntries(entries.map((e) => [e.ticker, e.addedAt]));

  if (entries.length === 0) {
    return (
      <div className="p-16 flex flex-col items-center justify-center border border-border rounded-md bg-card text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">No tickers watched yet</h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          Click the star icon on any security in the Scanner to add it here.
        </p>
      </div>
    );
  }

  // Merge live data with watched tickers (some may not be in the cache if unlisted)
  const securityMap = Object.fromEntries((data?.securities ?? []).map((s) => [s.ticker, s]));

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card shadow-sm" data-testid="watchlist-table">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b-border">
            <TableHead className="w-8" />
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Ticker</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Name</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Market</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Price</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">24h Change</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? tickers.map((t) => (
                <TableRow key={t}>
                  <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            : tickers.map((ticker) => {
                const security = securityMap[ticker];
                const isEquity = security?.assetType === "equity";
                const isExpanded = expandedTicker === ticker;
                const tickerVerdict = isEquity ? verdictMap[ticker] : undefined;
                const addedAt = addedAtMap[ticker];
                const isDipping = security ? security.percentChange < 0 : false;

                return (
                  <React.Fragment key={ticker}>
                    <TableRow
                      className={`border-b-border transition-colors ${
                        isEquity && security
                          ? "cursor-pointer hover:bg-muted/20"
                          : "hover:bg-muted/10 cursor-default"
                      } ${isExpanded ? "bg-muted/10" : ""}`}
                      onClick={() => {
                        if (isEquity && security) {
                          setExpandedTicker((prev) => (prev === ticker ? null : ticker));
                        }
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <StarButton
                          watched={true}
                          onToggle={() => onToggle(ticker)}
                        />
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          {ticker}
                          {isEquity && security && (
                            <svg
                              width="10" height="10" viewBox="0 0 10 10"
                              className={`text-muted-foreground/40 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                              fill="currentColor"
                            >
                              <path d="M5 7L1 3h8z" />
                            </svg>
                          )}
                        </div>
                        {addedAt && (
                          <div className="text-[10px] text-muted-foreground/50 font-normal leading-tight">
                            Added {formatAddedDate(addedAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {security?.name ?? <span className="text-muted-foreground/40 text-xs italic">Not in current data</span>}
                      </TableCell>
                      <TableCell>
                        {security ? (
                          <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">
                            {security.assetType === "crypto" ? "CRYPTO" : security.market}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-foreground">
                        {security ? formatCurrency(security.currentPrice, security.currency) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {security ? (
                          <span className={isDipping ? "text-destructive" : "text-emerald-500"}>
                            {isDipping ? "" : "+"}{formatPercent(security.percentChange)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isEquity || !security ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : verdictsLoading ? (
                          <Skeleton className="h-5 w-24 ml-auto" />
                        ) : (
                          <VerdictBadge verdict={tickerVerdict?.verdict ?? null} size="sm" />
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && security && (
                      <TableRow className="bg-muted/5 border-b border-border hover:bg-muted/5">
                        <TableCell colSpan={COL_COUNT} className="p-0">
                          <VerdictDetail
                            ticker={ticker}
                            data={tickerVerdict ?? null}
                            loading={verdictsLoading}
                            currentPrice={security.currentPrice}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
