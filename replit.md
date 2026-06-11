# Dip Tracker

A market intelligence tool that shows equities and crypto that have fallen in price, helping investors identify potential buying opportunities.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/dip-tracker run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `POLYGON_API_KEY` — Polygon.io API key for market data

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Tailwind CSS, shadcn/ui, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Market data: Polygon.io (grouped daily endpoint — 2–4 API calls per refresh)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas (used by server)
- `artifacts/dip-tracker/src/` — React frontend
- `artifacts/api-server/src/lib/polygon.ts` — Polygon.io integration (grouped daily)
- `artifacts/api-server/src/lib/cache.ts` — 15-minute in-memory cache
- `artifacts/api-server/src/routes/securities.ts` — API route handlers

## Architecture decisions

- **Grouped daily endpoint**: Uses Polygon's `/v2/aggs/grouped/locale/us/market/stocks/{date}` — returns all US stocks in a single API call, avoiding per-ticker rate limit issues on free tier.
- **In-memory cache**: Securities data is cached for 15 minutes per time period. Cache is warmed on startup for the 24h period.
- **Inflight deduplication**: Concurrent requests for the same period join the in-progress fetch instead of spawning duplicates.
- **ADR tickers for UK stocks**: FTSE 100/250 stocks are tracked via their US ADR tickers (e.g. SHEL, AZN, HSBC) since Polygon covers US markets.
- **Open price as "previous" for 1h/24h**: For intraday periods, we use the day's open price as the baseline. For 1w/1m, we fetch a grouped snapshot from N trading days ago.

## Product

- Filter falling securities by: drop range (≤10%, 11–20%, 21–30%, 31%+), time period (1h, 24h, 1w, 1m), asset type (equity/crypto), and market (NASDAQ, FTSE 100, FTSE 250, S&P 500)
- Summary bar: total falling + breakdown by drop range
- Top Movers panel: biggest 10 fallers
- Data refreshes every 15 minutes

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Polygon free tier: use grouped daily endpoints (not per-ticker) to stay within rate limits
- FTSE tickers use US ADR symbols, not London Stock Exchange codes
- Cache warm on startup fetches 24h data; other periods are fetched on first request
- `pnpm run typecheck` must pass before restarting the API server

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
