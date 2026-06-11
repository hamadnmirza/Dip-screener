import { fetchAllSecurities, type SecurityData, type TimePeriod } from "./polygon";
import { logger } from "./logger";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  data: SecurityData[];
  fetchedAt: Date;
  nextRefreshAt: Date;
}

const cache = new Map<TimePeriod, CacheEntry>();
const inflightRequests = new Map<TimePeriod, Promise<SecurityData[]>>();

export async function getSecuritiesForPeriod(period: TimePeriod): Promise<SecurityData[]> {
  const entry = cache.get(period);
  const now = new Date();

  if (entry && now < entry.nextRefreshAt) {
    logger.debug({ period, age: now.getTime() - entry.fetchedAt.getTime() }, "Cache hit");
    return entry.data;
  }

  // Deduplicate concurrent requests for the same period
  const inflight = inflightRequests.get(period);
  if (inflight) {
    logger.debug({ period }, "Joining inflight request");
    return inflight;
  }

  logger.info({ period }, "Fetching fresh securities data from Polygon");
  const promise = fetchAllSecurities(period)
    .then((data) => {
      const fetchedAt = new Date();
      const nextRefreshAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
      cache.set(period, { data, fetchedAt, nextRefreshAt });
      inflightRequests.delete(period);
      logger.info({ period, count: data.length }, "Securities data cached");
      return data;
    })
    .catch((err) => {
      inflightRequests.delete(period);
      logger.error({ period, err }, "Failed to fetch securities");
      // Return stale data if available
      const stale = cache.get(period);
      if (stale) {
        logger.warn({ period }, "Returning stale cache data due to fetch error");
        return stale.data;
      }
      throw err;
    });

  inflightRequests.set(period, promise);
  return promise;
}

export function getCacheInfo(period: TimePeriod): { fetchedAt: Date | null; nextRefreshAt: Date | null } {
  const entry = cache.get(period);
  if (!entry) return { fetchedAt: null, nextRefreshAt: null };
  return { fetchedAt: entry.fetchedAt, nextRefreshAt: entry.nextRefreshAt };
}

export function getOverallLastUpdated(): { timestamp: Date | null; nextRefreshAt: Date | null } {
  let latest: Date | null = null;
  let nextRefresh: Date | null = null;
  for (const entry of cache.values()) {
    if (!latest || entry.fetchedAt > latest) {
      latest = entry.fetchedAt;
      nextRefresh = entry.nextRefreshAt;
    }
  }
  return { timestamp: latest, nextRefreshAt: nextRefresh };
}

// Warm the cache for the most common period on startup
export async function warmCache(): Promise<void> {
  logger.info("Warming cache for 24h period");
  try {
    await getSecuritiesForPeriod("24h");
    logger.info("Cache warm complete");
  } catch (err) {
    logger.warn({ err }, "Cache warm failed — will retry on first request");
  }
}
