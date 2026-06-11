import React from "react";
import { useListSecurities, getListSecuritiesQueryKey } from "@workspace/api-client-react";
import type { ListSecuritiesParams } from "@workspace/api-client-react/src/generated/api.schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, formatCompactNumber } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SecuritiesTableProps {
  params: ListSecuritiesParams;
}

export function SecuritiesTable({ params }: SecuritiesTableProps) {
  const { data, isLoading, isError } = useListSecurities(params, {
    query: { queryKey: getListSecuritiesQueryKey(params) }
  });

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
              <TableHead className="text-right">Volume</TableHead>
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
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center border border-border rounded-md bg-card">
        <p className="text-destructive font-semibold">Failed to load securities.</p>
      </div>
    );
  }

  if (!data || data.securities.length === 0) {
    return (
      <div className="p-16 flex flex-col items-center justify-center border border-border rounded-md bg-card text-center" data-testid="empty-state">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className="text-muted-foreground"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">No matches found</h3>
        <p className="text-muted-foreground max-w-sm">No securities match your current filters. Try adjusting the time period or drop range.</p>
      </div>
    );
  }

  // Sort by percentChange ascending (most negative first)
  const sortedSecurities = [...data.securities].sort((a, b) => a.percentChange - b.percentChange);

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card shadow-sm" data-testid="securities-table">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b-border">
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Ticker</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Name</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Market</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Current Price</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Drop %</TableHead>
            <TableHead className="font-semibold text-muted-foreground uppercase text-xs tracking-wider text-right">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSecurities.map((security) => (
            <TableRow key={`${security.ticker}-${security.market}`} className="border-b-border hover:bg-muted/20 transition-colors">
              <TableCell className="font-bold text-foreground">{security.ticker}</TableCell>
              <TableCell className="text-muted-foreground">{security.name}</TableCell>
              <TableCell>
                <span className="text-xs font-medium px-2 py-1 rounded bg-muted text-muted-foreground">
                  {security.assetType === 'crypto' ? 'CRYPTO' : security.market}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-foreground">
                {formatCurrency(security.currentPrice, security.currency)}
              </TableCell>
              <TableCell className="text-right font-mono text-destructive font-bold">
                {formatPercent(security.percentChange)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {security.volume != null ? formatCompactNumber(security.volume) : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
