/**
 * Data Registry - Centralized data source management with caching and auto-refresh
 *
 * Provides a registry API to register/unregister data sources by name,
 * supports JSON, API, and database types with caching and auto-refresh.
 *
 * Architecture:
 * - Data sources are registered as `DataSource` definitions and stored in a Map keyed by ID
 * - Fetched data is cached in-memory with a configurable TTL (default 5 minutes)
 * - API sources can be set up with automatic periodic refresh via `setAutoRefresh()`
 * - Change listeners are notified whenever a data source's data is updated
 * - The registry is a singleton module — all state is module-scoped
 */

import type { DataSource } from '../types';
import { executeQuery } from '../services/api';

// ============================================================================
// Types & Internal State
// ============================================================================

/** A cache entry containing the fetched data and its expiration metadata */
interface CacheEntry {
  data: Record<string, any>[];  // The cached data rows
  timestamp: number;            // When the data was fetched (epoch ms)
  expiresAt: number;            // When the cache entry expires (epoch ms)
}

/** Default cache time-to-live: 5 minutes */
const CACHE_TTL = 5 * 60 * 1000;

/** In-memory data cache keyed by data source ID */
const dataCache = new Map<string, CacheEntry>();

/** Registered data source definitions */
const registeredSources = new Map<string, DataSource>();

/** Auto-refresh interval timers keyed by data source ID */
const refreshTimers = new Map<string, ReturnType<typeof setInterval>>();

/** Event listeners for data changes */
type DataChangeListener = (sourceId: string, data: Record<string, any>[]) => void;
const listeners = new Set<DataChangeListener>();

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Notify all registered change listeners that a data source has been updated.
 * Errors thrown by listeners are silently ignored to prevent cascading failures.
 *
 * @param sourceId - The ID of the data source that changed
 * @param data     - The new data for the source
 */
function notifyListeners(sourceId: string, data: Record<string, any>[]) {
  listeners.forEach(fn => {
    try { fn(sourceId, data); } catch { /* ignore listener errors */ }
  });
}

// ============================================================================
// Registration API
// ============================================================================

/**
 * Register a data source definition.
 * If the source is a JSON type with inline data, it is immediately cached.
 *
 * @param ds - The data source definition to register
 */
export function registerDataSource(ds: DataSource): void {
  registeredSources.set(ds.id, ds);
  // Pre-cache JSON data sources since their data is available immediately
  if (ds.type === 'json' && ds.data) {
    dataCache.set(ds.id, {
      data: ds.data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL,
    });
  }
}

/**
 * Unregister a data source and clean up all associated state:
 * removes the source definition, clears its cache, and stops any auto-refresh timer.
 *
 * @param sourceId - The ID of the data source to unregister
 */
export function unregisterDataSource(sourceId: string): void {
  registeredSources.delete(sourceId);
  dataCache.delete(sourceId);
  const timer = refreshTimers.get(sourceId);
  if (timer !== undefined) {
    clearInterval(timer);
    refreshTimers.delete(sourceId);
  }
}

// ============================================================================
// Data Fetching API
// ============================================================================

/**
 * Get data for a data source, using the cache if available.
 * If the cache is expired or missing, fetches fresh data based on the source type
 * (JSON returns inline data, API fetches from a URL, database queries via the backend).
 *
 * @param sourceId - The ID of the registered data source
 * @returns A promise resolving to an array of data records
 */
export async function getDataSourceData(sourceId: string): Promise<Record<string, any>[]> {
  // Return cached data if it hasn't expired yet
  const cached = dataCache.get(sourceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const ds = registeredSources.get(sourceId);
  if (!ds) return [];

  let data: Record<string, any>[];

  // Dispatch to the appropriate fetch strategy based on source type
  switch (ds.type) {
    case 'json':
      data = ds.data || [];
      break;
    case 'api':
      data = await fetchApiData(ds);
      break;
    case 'database':
      data = await fetchDatabaseData(ds);
      break;
    default:
      data = [];
  }

  // Store fetched data in the cache with a fresh TTL
  dataCache.set(sourceId, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL,
  });

  // Notify listeners that this source's data has been updated
  notifyListeners(sourceId, data);
  return data;
}

// ============================================================================
// Internal Data Fetchers
// ============================================================================

/**
 * Fetch data from an API endpoint (HTTP GET or POST).
 * Supports custom headers, request body, and nested data path extraction
 * (e.g. if the API returns `{ data: { items: [...] } }`, a path of "data.items"
 * will extract the array).
 *
 * @param ds - The API-type data source definition
 * @returns A promise resolving to the fetched data records, or an empty array on error
 */
async function fetchApiData(ds: DataSource): Promise<Record<string, any>[]> {
  if (!ds.url) return [];

  try {
    const options: RequestInit = {
      method: ds.method || 'GET',
      headers: ds.headers ? { ...ds.headers } : { 'Content-Type': 'application/json' },
    };

    if (ds.method === 'POST' && ds.body) {
      options.body = ds.body;
    }

    const response = await fetch(ds.url, options);
    if (!response.ok) return [];

    const result = await response.json();
    // If a nested data path is defined in the fields, extract the inner array
    // e.g. "data.items" would traverse result.data.items
    if (ds.fields.length > 0 && ds.fields[0].path) {
      let extracted = result;
      for (const segment of ds.fields[0].path.split('.')) {
        extracted = extracted?.[segment];
      }
      return Array.isArray(extracted) ? extracted : [];
    }
    // Fallback: if no path is specified, try common response shapes
    return Array.isArray(result) ? result : result.data ? (Array.isArray(result.data) ? result.data : []) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch data from a database by executing a SQL query through the backend proxy.
 *
 * @param ds - The database-type data source definition (requires connectionString and query)
 * @returns A promise resolving to the query result records, or an empty array on error
 */
async function fetchDatabaseData(ds: DataSource): Promise<Record<string, any>[]> {
  if (!ds.connectionString || !ds.query) return [];

  try {
    const result = await executeQuery({
      type: 'database',
      connectionString: ds.connectionString,
      query: ds.query,
    });
    if (result.error) {
      console.error(`Database query error for "${ds.name}":`, result.error);
      return [];
    }
    return result.data;
  } catch {
    return [];
  }
}

// ============================================================================
// Convenience Registration Helpers
// ============================================================================

/**
 * Register a JSON data source directly with inline data.
 * Automatically infers field definitions from the first data row's keys and value types.
 *
 * @param id   - Unique identifier for the data source
 * @param name - Human-readable name
 * @param data - The inline data array
 * @returns The registered DataSource definition
 */
export function registerJsonData(
  id: string,
  name: string,
  data: Record<string, any>[],
): DataSource {
  // Infer field types from the first row's values
  const fields = Object.keys(data[0] || {}).map(key => ({
    name: key,
    type: typeof data[0][key] === 'number' ? 'number' as const :
          typeof data[0][key] === 'boolean' ? 'boolean' as const :
          'string' as const,
  }));

  const ds: DataSource = { id, name, type: 'json', data, fields };
  registerDataSource(ds);
  return ds;
}

/**
 * Register an API data source with a URL and optional HTTP method/headers/body.
 *
 * @param id      - Unique identifier for the data source
 * @param name    - Human-readable name
 * @param url     - The API endpoint URL
 * @param method  - HTTP method (GET or POST), defaults to GET
 * @param headers - Optional HTTP headers to include in the request
 * @param body    - Optional request body (for POST requests)
 * @returns The registered DataSource definition
 */
export function registerApiDataSource(
  id: string,
  name: string,
  url: string,
  method: 'GET' | 'POST' = 'GET',
  headers?: Record<string, string>,
  body?: string,
): DataSource {
  const ds: DataSource = { id, name, type: 'api', url, method, headers, body, fields: [] };
  registerDataSource(ds);
  return ds;
}

// ============================================================================
// Auto-Refresh & Cache Management
// ============================================================================

/**
 * Set up automatic periodic refresh for an API data source.
 * Replaces any existing refresh timer for the same source.
 * Pass `intervalMs <= 0` to disable auto-refresh.
 *
 * @param sourceId   - The ID of the API data source to auto-refresh
 * @param intervalMs - Refresh interval in milliseconds (non-positive values disable refresh)
 */
export function setAutoRefresh(sourceId: string, intervalMs: number): void {
  // Clear any existing timer for this source before setting a new one
  const existing = refreshTimers.get(sourceId);
  if (existing !== undefined) clearInterval(existing);

  // A non-positive interval disables auto-refresh for this source
  if (intervalMs <= 0) {
    refreshTimers.delete(sourceId);
    return;
  }

  // Periodically re-fetch the data source (only API sources are eligible)
  const timer = setInterval(async () => {
    const ds = registeredSources.get(sourceId);
      if (ds && ds.type === 'api') {
        await getDataSourceData(sourceId); // Re-fetch will update cache and notify listeners
    }
  }, intervalMs);

  refreshTimers.set(sourceId, timer);
}

/**
 * Force-refresh a data source by clearing its cache entry and re-fetching.
 * Bypasses the cache entirely — the next `getDataSourceData()` call will fetch fresh data.
 *
 * @param sourceId - The ID of the data source to refresh
 * @returns A promise resolving to the freshly fetched data
 */
export async function refreshDataSource(sourceId: string): Promise<Record<string, any>[]> {
  dataCache.delete(sourceId);
  return getDataSourceData(sourceId);
}

/** Invalidate (clear) the cache for a specific data source */
export function invalidateCache(sourceId: string): void {
  dataCache.delete(sourceId);
}

/** Invalidate (clear) all cached data for every data source */
export function invalidateAllCaches(): void {
  dataCache.clear();
}

// ============================================================================
// Query & Observation API
// ============================================================================

/** Get all registered data source IDs */
export function getRegisteredSourceIds(): string[] {
  return Array.from(registeredSources.keys());
}

/**
 * Register a listener that will be called whenever any data source's data changes.
 * Returns an unsubscribe function that removes the listener when called.
 *
 * @param listener - Callback function receiving (sourceId, data) on each change
 * @returns An unsubscribe function
 */
export function addDataChangeListener(listener: DataChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ============================================================================
// Band Data Resolution
// ============================================================================

/**
 * Resolve the data for a report band by looking up its bound data source.
 * If the band doesn't specify a source, falls back to the first available source.
 * JSON sources return their inline data directly; API/DB sources go through the
 * registry's caching and fetching pipeline.
 *
 * @param dataSourceId - The ID of the data source bound to the band (optional)
 * @param dataSources  - The full list of available data source definitions
 * @returns A promise resolving to the data records for the band
 */
export async function resolveBandData(
  dataSourceId: string | undefined,
  dataSources: DataSource[],
): Promise<Record<string, any>[]> {
  // Find the bound data source, or fall back to the first one
  const ds = dataSourceId
    ? dataSources.find(d => d.id === dataSourceId)
    : dataSources[0];

  if (!ds) return [];

  // JSON sources carry their data inline — no fetch needed
  if (ds.type === 'json') return ds.data || [];

  // API/DB sources require fetching (with cache) through the registry
  return getDataSourceData(ds.id);
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up all registry state: stop all auto-refresh timers,
 * clear caches, remove all source definitions, and remove all listeners.
 * Call this when the report designer is unmounted or the application shuts down.
 */
export function disposeDataRegistry(): void {
  refreshTimers.forEach(timer => clearInterval(timer));
  refreshTimers.clear();
  dataCache.clear();
  registeredSources.clear();
  listeners.clear();
}
