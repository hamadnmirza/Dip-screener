import React, { useState } from "react";
import {
  useListSecurities,
  getListSecuritiesQueryKey,
  useGetVerdicts,
  getGetVerdictsQueryKey,
} from "@workspace/api-client-react";
import type { ListSecuritiesParams } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VerdictBadge } from "./VerdictBadge";
import { VerdictDetail } from "./VerdictDetail";

interface SecuritiesTableProps {
  params: ListSecuritiesParams;
}

const COL_COUNT = 6;

export function SecuritiesTable({ params }: SecuritiesTableProps) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const { data, isLoading, isError } = useListSecurities(params, {
    query: { queryKey: getListSecuritiesQueryKey(params) },
  });

  // Collect equity tickers from the current result for lazy verdict fetching
  const equityTickers =
    data?.securities
      .filter((s) => s.assetType === "equity")
      .map((s) => s.ticker) ?? [];

  const tickersParam = equityTickers.join(",");

  const {
    data: verdictsData,
    isLoading: verdictsLoading,
  } = useGetVerdicts(
    { tickers: tickersParam },
    {
      query: {
        enabled: equityTickers.length > 0,
        queryKey: getGetVerdictsQueryKey({ tickers: tickersParam }),
      },
    }
  );

  const verdictMap = verdictsData?.verdicts ?? {};

  function handleRowClick(ticker: string, isEquity: boolean) {
    if (!isEquity) return;
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Drop %</TableHead>
              <TableHead className="text-right">Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="p-8 text-center border border-border rounded-md bg-card">
        <p className="text-destructive font-semibold">Failed to load securities.</p>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!data || data.securities.length === 0) {
    return (
      <div
        className="p-16 flex flex-col items-center justify-center border border-border rounded-md bg-card text-center"
        data-testid="empty-state"
      >
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">No matches found</h3>
        <p className="text-muted-foreground max-w-sm">
          No securities match your current filters. Try adjusting the time period or drop range.
        </p>
      </div>
    );
  }

  // Sort by biggest drop first
  const sortedSecurities = [...data.securities].sort(
    (a, b) => a.percentChange - b.percentChange
  );

  return (
    <div
      className="border border-border rounded-md overflow-hidden bg-card shadow-sm"
      data-testid="securities-table"
    >
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b-border">
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">
              Ticker
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">
              Name
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">
              Market
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">
              Current Price
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">
              Drop %
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">
              Verdict
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSecurities.map((security) => {
            const isEquity = security.assetType === "equity";
            const isExpanded = expandedTicker === security.ticker;
            const tickerVerdict = isEquity ? verdictMap[security.ticker] : undefined;

            return (
              <React.Fragment key={`${security.ticker}-${security.market}`}>
                <TableRow
                  className={`border-b-border transition-colors ${
                    isEquity
                      ? "cursor-pointer hover:bg-muted/20"
                      : "hover:bg-muted/10 cursor-default"
                  } ${isExpanded ? "bg-muted/10" : ""}`}
                  onClick={() => handleRowClick(security.ticker, isEquity)}
                >
                  <TableCell className="font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      {security.ticker}
                      {isEquity && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className={`text-muted-foreground/40 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                          fill="currentColor"
                        >
                          <path d="M5 7L1 3h8z" />
                        </svg>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{security.name}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">
                      {security.assetType === "crypto" ? "CRYPTO" : security.market}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatCurrency(security.currentPrice, security.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive font-bold">
                    {formatPercent(security.percentChange)}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isEquity ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : verdictsLoading ? (
                      <Skeleton className="h-5 w-24 ml-auto" />
                    ) : (
                      <VerdictBadge
                        verdict={tickerVerdict?.verdict ?? null}
                        size="sm"
                      />
                    )}
                  </TableCell>
                </TableRow>

                {/* Expanded detail row */}
                {isExpanded && (
                  <TableRow className="bg-muted/5 border-b border-border hover:bg-muted/5">
                    <TableCell colSpan={COL_COUNT} className="p-0">
                      <VerdictDetail
                        ticker={security.ticker}
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
