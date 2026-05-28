/**
 * Example backend server for Report Designer
 *
 * Provides:
 *   POST /api/reports         - Save report
 *   GET  /api/reports         - List reports
 *   GET  /api/reports/:id     - Get report by ID
 *   DELETE /api/reports/:id   - Delete report
 *   POST /api/data/query     - Execute database query
 *   POST /api/data/test      - Test data source connection
 *   POST /api/data/fields    - Discover fields from data source
 *
 * Run: node server/index.js
 * Default port: 3001
 */

const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;

// In-memory report storage
const reports = new Map();

// ─── Route handlers ──────────────────────────────────────────

function handleReportsList(req, res) {
  const list = Array.from(reports.values()).map(r => ({
    id: r.id,
    name: r.name,
    updatedAt: r.updatedAt || new Date().toISOString(),
  }));
  sendJson(res, 200, list);
}

function handleReportSave(req, res, body) {
  const report = JSON.parse(body);
  report.updatedAt = new Date().toISOString();
  reports.set(report.id, report);
  sendJson(res, 200, { id: report.id });
}

function handleReportGet(req, res, id) {
  const report = reports.get(id);
  if (!report) return sendJson(res, 404, { error: 'Report not found' });
  sendJson(res, 200, report);
}

function handleReportDelete(req, res, id) {
  reports.delete(id);
  sendJson(res, 200, { ok: true });
}

function handleDataQuery(req, res, body) {
  const { type, connectionString, query, params } = JSON.parse(body);

  // ─── IMPORTANT: In production, use parameterized queries and connection pooling ───
  // This is a stub that returns mock data based on the query string
  console.log(`[query] type=${type} query="${query}"`);

  // Mock: return sample data based on keywords in query
  const mockData = [
    { id: 1, name: '示例数据1', value: 100, date: '2025-01-15' },
    { id: 2, name: '示例数据2', value: 200, date: '2025-02-20' },
    { id: 3, name: '示例数据3', value: 300, date: '2025-03-10' },
  ];

  const fields = Object.keys(mockData[0]).map(k => ({
    name: k,
    type: typeof mockData[0][k] === 'number' ? 'number' : 'string',
  }));

  sendJson(res, 200, { data: mockData, fields, rowCount: mockData.length });
}

function handleDataTest(req, res, body) {
  const { type, connectionString, url, query } = JSON.parse(body);

  console.log(`[test] type=${type} url=${url || ''} connStr=${connectionString || ''}`);

  // Mock: always return success
  // In production, actually test the connection
  sendJson(res, 200, {
    success: true,
    message: type === 'database'
      ? '数据库连接成功'
      : 'API 连接成功',
    fields: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'value', type: 'number' },
      { name: 'date', type: 'string' },
    ],
    sampleData: [
      { id: 1, name: '示例1', value: 100, date: '2025-01-01' },
      { id: 2, name: '示例2', value: 200, date: '2025-02-01' },
    ],
  });
}

function handleDataFields(req, res, body) {
  const { type, url, method, headers, body: reqBody, connectionString, query, dataPath } = JSON.parse(body);

  console.log(`[fields] type=${type} url=${url || ''} connStr=${connectionString || ''}`);

  // Mock: return sample fields
  // In production, actually fetch from the API or execute a LIMIT 1 query
  const fields = [
    { name: 'id', type: 'number' },
    { name: 'name', type: 'string' },
    { name: 'value', type: 'number' },
    { name: 'date', type: 'string' },
  ];

  const sampleData = [
    { id: 1, name: '示例1', value: 100, date: '2025-01-01' },
    { id: 2, name: '示例2', value: 200, date: '2025-02-01' },
    { id: 3, name: '示例3', value: 300, date: '2025-03-01' },
  ];

  sendJson(res, 200, { fields, sampleData });
}

// ─── Server ──────────────────────────────────────────────────

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    // ─── Report routes ───
    if (path === '/api/reports' && method === 'GET') {
      return handleReportsList(req, res);
    }
    if (path === '/api/reports' && method === 'POST') {
      const body = await readBody(req);
      return handleReportSave(req, res, body);
    }
    if (path.startsWith('/api/reports/') && method === 'GET') {
      const id = path.replace('/api/reports/', '');
      return handleReportGet(req, res, decodeURIComponent(id));
    }
    if (path.startsWith('/api/reports/') && method === 'DELETE') {
      const id = path.replace('/api/reports/', '');
      return handleReportDelete(req, res, decodeURIComponent(id));
    }

    // ─── Data routes ───
    if (path === '/api/data/query' && method === 'POST') {
      const body = await readBody(req);
      return handleDataQuery(req, res, body);
    }
    if (path === '/api/data/test' && method === 'POST') {
      const body = await readBody(req);
      return handleDataTest(req, res, body);
    }
    if (path === '/api/data/fields' && method === 'POST') {
      const body = await readBody(req);
      return handleDataFields(req, res, body);
    }

    // 404
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Report Designer API server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/reports         - Save report');
  console.log('  GET  /api/reports         - List reports');
  console.log('  GET  /api/reports/:id     - Get report');
  console.log('  DELETE /api/reports/:id   - Delete report');
  console.log('  POST /api/data/query      - Execute DB query');
  console.log('  POST /api/data/test       - Test connection');
  console.log('  POST /api/data/fields     - Discover fields');
});
