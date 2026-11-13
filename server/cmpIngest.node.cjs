const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getConfiguredIngestSecret,
  verifyCmpIngestSecret,
  mapCmpInvoiceRows,
  ingestCmpSnapshot,
  MIN_INGEST_SECRET_LENGTH
} = require('./cmpIngest.cjs');
const serverlessIngest = import('../lib/cmpIngest.js');

const buildRequest = (authorization = '') => ({
  headers: { authorization }
});

test('ingest secret configuration fails closed when missing or too short', () => {
  const validSecret = 'x'.repeat(MIN_INGEST_SECRET_LENGTH);
  assert.equal(getConfiguredIngestSecret({}), null);
  assert.equal(getConfiguredIngestSecret({ CMP_INGEST_SECRET: 'short' }), null);
  assert.equal(getConfiguredIngestSecret({ CMP_INGEST_SECRET: validSecret }), validSecret);
  assert.equal(verifyCmpIngestSecret(buildRequest(), {}), false);
});

test('ingest requires an exact bearer token and accepts a valid secret', () => {
  const secret = 'a'.repeat(MIN_INGEST_SECRET_LENGTH);
  const env = { CMP_INGEST_SECRET: secret };

  assert.equal(verifyCmpIngestSecret(buildRequest(), env), false);
  assert.equal(verifyCmpIngestSecret(buildRequest('Bearer wrong'), env), false);
  assert.equal(verifyCmpIngestSecret(buildRequest(`Bearer ${secret}x`), env), false);
  assert.equal(verifyCmpIngestSecret(buildRequest(`Bearer ${secret}`), env), true);
});

test('serverless ingest applies the same fail-closed secret contract', async () => {
  const { getConfiguredIngestSecret, verifyCmpIngestSecret } = await serverlessIngest;
  const secret = 'b'.repeat(MIN_INGEST_SECRET_LENGTH);

  assert.equal(getConfiguredIngestSecret({}), null);
  assert.equal(verifyCmpIngestSecret(buildRequest(), { CMP_INGEST_SECRET: secret }), false);
  assert.equal(verifyCmpIngestSecret(buildRequest(`Bearer ${secret}`), { CMP_INGEST_SECRET: secret }), true);
});

test('ingest preserves explicit agent scope and leaves unknown assignments unscoped', () => {
  const rows = mapCmpInvoiceRows([
    { companyName: 'Acme LLC', invoiceNumber: 'INV-1', agentId: 'jose rivera' },
    { companyName: 'Unmapped Inc', invoiceNumber: 'INV-2' }
  ], 'run-1', '2026-11-12T00:00:00.000Z');

  assert.equal(rows[0].agent_id, 'jose rivera');
  assert.equal(rows[1].agent_id, null);
});

test('ingest defaults omitted financial values and preserves explicit zero balances', () => {
  const rows = mapCmpInvoiceRows([
    { companyName: 'Missing totals LLC', invoiceNumber: 'INV-1', amount: 125.5 },
    { companyName: 'Zero balance LLC', invoiceNumber: 'INV-2', amount: 400, totalAmount: 400, remainingAmount: 0, totalPaid: 400 }
  ], 'run-1', '2026-11-12T00:00:00.000Z');

  assert.deepEqual(
    rows.map(({ total_amount, remaining_amount, total_paid }) => [total_amount, remaining_amount, total_paid]),
    [[125.5, 125.5, 0], [400, 0, 400]]
  );
});

test('serverless ingest maps agent scope with the same contract', async () => {
  const { mapCmpInvoiceRows: mapServerlessRows } = await serverlessIngest;
  const rows = mapServerlessRows([
    { companyName: 'Acme LLC', invoiceNumber: 'INV-1', agentId: 'jose rivera' }
  ], 'run-1', '2026-11-12T00:00:00.000Z');

  assert.equal(rows[0].agent_id, 'jose rivera');
});

test('serverless ingest defaults omitted financial values and preserves explicit zero balances', async () => {
  const { mapCmpInvoiceRows: mapServerlessRows } = await serverlessIngest;
  const rows = mapServerlessRows([
    { companyName: 'Missing totals LLC', invoiceNumber: 'INV-1', amount: 125.5 },
    { companyName: 'Zero balance LLC', invoiceNumber: 'INV-2', amount: 400, totalAmount: 400, remainingAmount: 0, totalPaid: 400 }
  ], 'run-1', '2026-11-12T00:00:00.000Z');

  assert.deepEqual(
    rows.map(({ total_amount, remaining_amount, total_paid }) => [total_amount, remaining_amount, total_paid]),
    [[125.5, 125.5, 0], [400, 0, 400]]
  );
});

test('dry-run sends the snapshot to the preview RPC and performs no table write', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = global.fetch;
  let requestUrl = '';
  let requestBody;
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ dryRun: true, rowsThatWouldClose: 4 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await ingestCmpSnapshot({
      syncRunId: 'f4f80000-0000-4000-8000-000000000001',
      startedAt: '2026-11-12T21:00:00.000Z',
      runStatus: 'complete',
      mode: 'fast',
      pagesScraped: 2,
      rowsExtracted: 1,
      truncated: false,
      cutoffDate: '2026-10-28',
      scopeAgentIds: ['agent-a'],
      dryRun: true,
      invoices: [{ companyName: 'Acme LLC', invoiceNumber: 'INV-1', agentId: 'agent-a' }]
    });

    assert.match(requestUrl, /\/rest\/v1\/rpc\/apply_cmp_sync_run$/);
    assert.equal(requestBody.p_dry_run, true);
    assert.equal(requestBody.p_rows[0].agent_id, 'agent-a');
    assert.equal(result.rowsThatWouldClose, 4);
    assert.equal(result.count, 0);
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test('missing failure_reason column does not turn the registered run into an ingest failure', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = global.fetch;
  const previousWarn = console.warn;
  let patchAttempted = false;
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  console.warn = () => {};
  global.fetch = async (url, options) => {
    if (String(url).endsWith('/rpc/apply_cmp_sync_run')) {
      return new Response(JSON.stringify({ runId: 'reason-run', status: 'failed' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    patchAttempted = options.method === 'PATCH' && String(url).includes('/cmp_sync_runs?');
    return new Response(JSON.stringify({ code: 'PGRST204', message: 'column failure_reason does not exist' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await ingestCmpSnapshot({
      syncRunId: 'f4f80000-0000-4000-8000-000000000003',
      runStatus: 'failed', mode: 'fast', pagesScraped: 0, rowsExtracted: 0,
      truncated: false, cutoffDate: '2026-10-28', scopeAgentIds: [],
      failureReason: 'mfa_required', invoices: []
    });
    assert.equal(patchAttempted, true);
    assert.equal(result.failureReasonPersisted, false);
  } finally {
    global.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test('serverless ingest uses the same transactional dry-run RPC', async () => {
  const { ingestCmpSnapshot: ingestServerless } = await serverlessIngest;
  const previousFetch = global.fetch;
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ dryRun: true, rowsThatWouldClose: 2 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const result = await ingestServerless({
      syncRunId: 'f4f80000-0000-4000-8000-000000000002',
      runStatus: 'complete',
      mode: 'normal',
      pagesScraped: 3,
      rowsExtracted: 1,
      truncated: false,
      cutoffDate: '2026-07-15',
      scopeAgentIds: ['agent-b'],
      dryRun: true,
      invoices: [{ companyName: 'Acme LLC', invoiceNumber: 'INV-2', agentId: 'agent-b' }]
    }, {
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
    });

    assert.equal(requestBody.p_dry_run, true);
    assert.equal(requestBody.p_scope_agent_ids[0], 'agent-b');
    assert.equal(result.rowsThatWouldClose, 2);
    assert.equal(result.count, 0);
  } finally {
    global.fetch = previousFetch;
  }
});
