import React from "react";
import {
  useGetTopMovers,
  getGetTopMoversQueryKey,
  useGetVerdicts,
  getGetVerdictsQueryKey,
  useGetDropCause,
  getGetDropCauseQueryKey,
} from "@workspace/api-client-react";
import type { GetTopMoversParams, GetDropCausePeriod } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { VerdictBadge } from "./VerdictBadge";
import { DropCauseBadge } from "./DropCauseBadge";

interface TopMoversProps {
  params: GetTopMoversParams;
}

function DropCausePill({
  ticker,
  period,
}: {
  ticker: string;
  period: GetDropCausePeriod;
}) {
  const { data, isLoading } = useGetDropCause(
    { ticker, period },
    { query: { queryKey: getGetDropCauseQueryKey({ ticker, period }) } }
  );
  if (isLoading) return <Skeleton className="h-4 w-16 bg-muted/20" />;
  if (!data) return null;
  return <DropCauseBadge classification={data} size="xs" />;
}

export function TopMovers({ params }: TopMoversProps) {
  const { data, isLoading, isError } = useGetTopMovers(params, {
    query: { queryKey: getGetTopMoversQueryKey(params) },
  });

  const equityTickers =
    data?.movers
      .filter((m) => m.assetType === "equity")
      .map((m) => m.ticker) ?? [];

  const tickersParam = equityTickers.join(",");

  const { data: verdictsData, isLoading: verdictsLoading } = useGetVerdicts(
    { tickers: tickersParam },
    {
      query: {
        enabled: equityTickers.length > 0,
        queryKey: getGetVerdictsQueryKey({ tickers: tickersParam }),
      },
    }
  );

  const verdictMap = verdictsData?.verdicts ?? {};
  const period = (params.timePeriod ?? "24h") as GetDropCausePeriod;

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Top Movers</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-36 min-w-[200px] rounded-md bg-muted flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data || !data.movers || data.movers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6" data-testid="top-movers-panel">
      <h2 className="text-lg font-semibold mb-3 text-foreground tracking-tight">Top Movers</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
        {data.movers.map((mover) => {
          const isEquity = mover.assetType === "equity";
          const tickerVerdict = isEquity ? verdictMap[mover.ticker] : undefined;

          return (
            <div
              key={`${mover.ticker}-${mover.market}`}
              className="bg-card border border-border p-4 rounded-md min-w-[200px] flex-shrink-0 flex flex-col hover:border-muted-foreground transition-colors cursor-default"
              data-testid={`card-top-mover-${mover.ticker}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-foreground text-lg">{mover.ticker}</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {mover.assetType === "crypto" ? "CRYPTO" : mover.market}
                </span>
              </div>
              <div className="text-sm text-muted-foreground truncate mb-3" title={mover.name}>
                {mover.name}
              </div>
              <div className="mt-auto">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-mono text-foreground font-medium">
                    {formatCurrency(mover.currentPrice, mover.currency)}
                  </span>
                  <span className="font-mono text-destructive font-bold bg-destructive/10 px-2 py-1 rounded">
                    {formatPercent(mover.percentChange)}
                  </span>
                </div>
                {/* Verdict + cause badges for equity cards */}
                {isEquity && (
                  <div className="mt-1 flex flex-wrap gap-1 items-center">
                    {verdictsLoading ? (
                      <Skeleton className="h-4 w-24 bg-muted/30" />
                    ) : (
                      <>
                        <VerdictBadge verdict={tickerVerdict?.verdict ?? null} size="sm" />
                        <DropCausePill ticker={mover.ticker} period={period} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
