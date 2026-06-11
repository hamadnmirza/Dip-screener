import React from "react";
import { useGetSecuritiesSummary, getGetSecuritiesSummaryQueryKey } from "@workspace/api-client-react";
import type { GetSecuritiesSummaryParams } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryBarProps {
  params: GetSecuritiesSummaryParams;
}

export function SummaryBar({ params }: SummaryBarProps) {
  const { data, isLoading, isError } = useGetSecuritiesSummary(params, {
    query: { queryKey: getGetSecuritiesSummaryQueryKey(params) }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const { totalFalling, byDropRange } = data;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" data-testid="summary-bar">
      <div className="bg-card border border-border p-4 rounded-md flex flex-col justify-center">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Total Falling</span>
        <span className="text-2xl font-mono text-foreground font-bold" data-testid="text-total-falling">{totalFalling}</span>
      </div>
      
      {byDropRange.map((range) => {
        const labels: Record<string, string> = {
          'up_to_10': '0 - 10% Drop',
          '11_to_20': '11 - 20% Drop',
          '21_to_30': '21 - 30% Drop',
          '31_plus': '31%+ Drop',
        };
        
        return (
          <div key={range.range} className="bg-card border border-border p-4 rounded-md flex flex-col justify-center">
            <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">{labels[range.range] || range.range}</span>
            <span className="text-2xl font-mono text-destructive font-bold">{range.count}</span>
          </div>
        );
      })}
    </div>
  );
}
