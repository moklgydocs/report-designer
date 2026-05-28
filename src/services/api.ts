/**
 * API Service Layer - backend integration for Report Designer
 *
 * All API calls go through this module. In development, Vite proxies
 * /api/* requests to the backend server (see vite.config.ts).
 *
 * Endpoints:
 *   POST /api/reports           - Save report
 *   GET  /api/reports/:id       - Load report
 *   GET  /api/reports           - List reports
 *   DELETE /api/reports/:id     - Delete report
 *   POST /api/data/query        - Execute database query
 *   POST /api/data/test         - Test data source connection
 *   GET  /api/data/fields       - Auto-discover fields from API source
 */

const API_BASE = '/api';

/** Generic request helper with error handling */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// ─── Report CRUD ──────────────────────────────────────────────

export interface ReportMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export async function saveReport(report: Record<string, any>): Promise<{ id: string }> {
  return request('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function loadReport(id: string): Promise<Record<string, any>> {
  return request(`/reports/${encodeURIComponent(id)}`);
}

export async function listReports(): Promise<ReportMeta[]> {
  return request('/reports');
}

export async function deleteReport(id: string): Promise<void> {
  await request(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Data Source Operations ───────────────────────────────────

export interface QueryRequest {
  type: 'database';
  connectionString: string;
  query: string;
  params?: Record<string, any>;
}

export interface QueryResult {
  data: Record<string, any>[];
  fields: { name: string; type: string }[];
  rowCount: number;
  error?: string;
}

export interface TestConnectionRequest {
  type: 'database' | 'api';
  connectionString?: string;
  query?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  fields?: { name: string; type: string }[];
  sampleData?: Record<string, any>[];
}

export interface DiscoverFieldsRequest {
  type: 'api' | 'database';
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  connectionString?: string;
  query?: string;
  dataPath?: string;
}

export interface DiscoverFieldsResult {
  fields: { name: string; type: string }[];
  sampleData: Record<string, any>[];
}

/** Execute a database query via the backend proxy */
export async function executeQuery(req: QueryRequest): Promise<QueryResult> {
  return request('/data/query', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Test a data source connection */
export async function testConnection(req: TestConnectionRequest): Promise<TestConnectionResult> {
  return request('/data/test', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** Auto-discover fields from an API or database source */
export async function discoverFields(req: DiscoverFieldsRequest): Promise<DiscoverFieldsResult> {
  return request('/data/fields', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
