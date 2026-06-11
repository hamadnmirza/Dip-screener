import React from "react";
import { useGetTopMovers, getGetTopMoversQueryKey } from "@workspace/api-client-react";
import type { GetTopMoversParams } from "@workspace/api-client-react/src/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface TopMoversProps {
  params: GetTopMoversParams;
}

export function TopMovers({ params }: TopMoversProps) {
  const { data, isLoading, isError } = useGetTopMovers(params, {
    query: { queryKey: getGetTopMoversQueryKey(params) }
  });

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Top Movers</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 min-w-[200px] rounded-md bg-muted flex-shrink-0" />
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
        {data.movers.map((mover) => (
          <div 
            key={`${mover.ticker}-${mover.market}`} 
            className="bg-card border border-border p-4 rounded-md min-w-[200px] flex-shrink-0 flex flex-col hover:border-muted-foreground transition-colors cursor-default"
            data-testid={`card-top-mover-${mover.ticker}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-foreground text-lg">{mover.ticker}</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {mover.assetType === 'crypto' ? 'CRYPTO' : mover.market}
              </span>
            </div>
            <div className="text-sm text-muted-foreground truncate mb-4" title={mover.name}>
              {mover.name}
            </div>
            <div className="mt-auto flex justify-between items-end">
              <span className="font-mono text-foreground font-medium">
                {formatCurrency(mover.currentPrice, mover.currency)}
              </span>
              <span className="font-mono text-destructive font-bold bg-destructive/10 px-2 py-1 rounded">
                {formatPercent(mover.percentChange)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
