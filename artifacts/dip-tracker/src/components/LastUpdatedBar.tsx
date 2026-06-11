import React from "react";
import { useGetLastUpdated, getGetLastUpdatedQueryKey } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";

export function LastUpdatedBar() {
  const { data } = useGetLastUpdated({
    query: { 
      queryKey: getGetLastUpdatedQueryKey(),
      refetchInterval: 30000 
    }
  });

  if (!data) return <div className="h-6" />;

  const lastUpdatedText = formatDistanceToNow(new Date(data.timestamp), { addSuffix: true });
  const nextRefreshMins = Math.ceil(data.nextRefreshIn / 60);

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-t border-border mt-8" data-testid="last-updated-indicator">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span>Data refreshed {lastUpdatedText}</span>
      </div>
      <div>
        Next refresh in {nextRefreshMins} min{nextRefreshMins !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
