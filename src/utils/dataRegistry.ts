/**
 * Data Registry - centralized data source management with caching and auto-refresh
 *
 * Provides a registry API to register/unregister data sources by name,
 * supports JSON, API, and database types with caching and auto-refresh.
 */

import type { DataSource } from '../types';
import { executeQuery } from '../services/api';

interface CacheEntry {
  data: Record<string, any>[];
  timestamp: number;
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL

/** In-memory data cache keyed by data source ID */
const dataCache = new Map<string, CacheEntry>();

/** Registered data source definitions */
const registeredSources = new Map<string, DataSource>();

/** Auto-refresh timers */
const refreshTimers = new Map<string, ReturnType<typeof setInterval>>();

/** Event listeners for data changes */
type DataChangeListener = (sourceId: string, data: Record<string, any>[]) => void;
const listeners = new Set<DataChangeListener>();

function notifyListeners(sourceId: string, data: Record<string, any>[]) {
  listeners.forEach(fn => {
    try { fn(sourceId, data); } catch { /* ignore */ }
  });
}

/**
 * Register a data source definition
 */
export function registerDataSource(ds: DataSource): void {
  registeredSources.set(ds.id, ds);
  // If data is already present (JSON type), cache it
  if (ds.type === 'json' && ds.data) {
    dataCache.set(ds.id, {
      data: ds.data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL,
    });
  }
}

/**
 * Unregister a data source and clear its cache
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

/**
 * Get data for a source, using cache if available, fetching if needed
 */
export async function getDataSourceData(sourceId: string): Promise<Record<string, any>[]> {
  // Check cache first
  const cached = dataCache.get(sourceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const ds = registeredSources.get(sourceId);
  if (!ds) return [];

  let data: Record<string, any>[];

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

  // Update cache
  dataCache.set(sourceId, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL,
  });

  notifyListeners(sourceId, data);
  return data;
}

/**
 * Fetch data from an API endpoint
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
    // Support nested data path, e.g. "data.items"
    if (ds.fields.length > 0 && ds.fields[0].path) {
      let extracted = result;
      for (const segment of ds.fields[0].path.split('.')) {
        extracted = extracted?.[segment];
      }
      return Array.isArray(extracted) ? extracted : [];
    }
    return Array.isArray(result) ? result : result.data ? (Array.isArray(result.data) ? result.data : []) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch data from a database via the backend proxy
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

/**
 * Register a JSON data source directly with data
 */
export function registerJsonData(
  id: string,
  name: string,
  data: Record<string, any>[],
): DataSource {
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
 * Register an API data source
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

/**
 * Set up auto-refresh for an API data source
 */
export function setAutoRefresh(sourceId: string, intervalMs: number): void {
  // Clear existing timer
  const existing = refreshTimers.get(sourceId);
  if (existing !== undefined) clearInterval(existing);

  if (intervalMs <= 0) {
    refreshTimers.delete(sourceId);
    return;
  }

  const timer = setInterval(async () => {
    const ds = registeredSources.get(sourceId);
    if (ds && ds.type === 'api') {
      await getDataSourceData(sourceId); // This will refresh cache and notify
    }
  }, intervalMs);

  refreshTimers.set(sourceId, timer);
}

/**
 * Force refresh a data source (bypasses cache)
 */
export async function refreshDataSource(sourceId: string): Promise<Record<string, any>[]> {
  dataCache.delete(sourceId);
  return getDataSourceData(sourceId);
}

/**
 * Invalidate cache for a specific source
 */
export function invalidateCache(sourceId: string): void {
  dataCache.delete(sourceId);
}

/**
 * Invalidate all caches
 */
export function invalidateAllCaches(): void {
  dataCache.clear();
}

/**
 * Get all registered source IDs
 */
export function getRegisteredSourceIds(): string[] {
  return Array.from(registeredSources.keys());
}

/**
 * Add a data change listener
 */
export function addDataChangeListener(listener: DataChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Resolve data for a band, handling data source binding
 */
export async function resolveBandData(
  dataSourceId: string | undefined,
  dataSources: DataSource[],
): Promise<Record<string, any>[]> {
  const ds = dataSourceId
    ? dataSources.find(d => d.id === dataSourceId)
    : dataSources[0];

  if (!ds) return [];

  // For JSON type, data is inline
  if (ds.type === 'json') return ds.data || [];

  // For API/DB types, use the registry (with cache)
  return getDataSourceData(ds.id);
}

/**
 * Clean up all timers and caches
 */
export function disposeDataRegistry(): void {
  refreshTimers.forEach(timer => clearInterval(timer));
  refreshTimers.clear();
  dataCache.clear();
  registeredSources.clear();
  listeners.clear();
}
