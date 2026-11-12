const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getConfiguredIngestSecret,
  verifyCmpIngestSecret,
  mapCmpInvoiceRows,
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

test('serverless ingest maps agent scope with the same contract', async () => {
  const { mapCmpInvoiceRows: mapServerlessRows } = await serverlessIngest;
  const rows = mapServerlessRows([
    { companyName: 'Acme LLC', invoiceNumber: 'INV-1', agentId: 'jose rivera' }
  ], 'run-1', '2026-11-12T00:00:00.000Z');

  assert.equal(rows[0].agent_id, 'jose rivera');
});
