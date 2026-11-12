const test = require('node:test');
const assert = require('node:assert/strict');
const { planReconciliation } = require('./cmpReconciliation.cjs');

const cutoffDate = '2026-10-01';
const scopeAgentIds = ['agent-a'];
const row = (id, extra = {}) => ({
  id,
  agent_id: 'agent-a',
  status: 'overdue',
  amount: 100,
  remaining_amount: 100,
  invoice_date: '2025-01-01',
  ...extra
});

test('complete full-coverage run closes current scoped rows not seen in the run', () => {
  const result = planReconciliation({
    currentRows: [row('seen'), row('missing')],
    incomingRows: [row('seen')],
    status: 'complete',
    truncated: false,
    rowsExtracted: 2,
    scopeAgentIds,
    cutoffDate
  });

  assert.equal(result.eligible, true);
  assert.deepEqual(result.closedIds, ['missing']);
});

test('incomplete, truncated, or empty runs never close rows', () => {
  const currentRows = [row('missing')];
  for (const run of [
    { status: 'incomplete', truncated: false, rowsExtracted: 5 },
    { status: 'complete', truncated: true, rowsExtracted: 5 },
    { status: 'complete', truncated: false, rowsExtracted: 0 }
  ]) {
    const result = planReconciliation({
      currentRows,
      incomingRows: [],
      ...run,
      scopeAgentIds,
      cutoffDate
    });
    assert.deepEqual(result.closedIds, []);
  }
});

test('fast-window reconciliation leaves paid invoices older than its cutoff untouched', () => {
  const result = planReconciliation({
    currentRows: [
      row('old-paid', { status: 'paid', amount: 0, remaining_amount: 0, invoice_date: '2026-01-01' }),
      row('open-old')
    ],
    incomingRows: [],
    status: 'complete',
    truncated: false,
    rowsExtracted: 2,
    scopeAgentIds,
    cutoffDate
  });

  assert.deepEqual(result.closedIds, ['open-old']);
});

test('replaying an already reconciled run is state-idempotent', () => {
  const before = [row('seen'), row('missing')];
  const first = planReconciliation({
    currentRows: before,
    incomingRows: [row('seen')],
    status: 'complete',
    truncated: false,
    rowsExtracted: 2,
    scopeAgentIds,
    cutoffDate
  });
  const afterFirst = before.filter((item) => !first.closedIds.includes(item.id));
  const replay = planReconciliation({
    currentRows: afterFirst,
    incomingRows: [row('seen')],
    status: 'complete',
    truncated: false,
    rowsExtracted: 2,
    scopeAgentIds,
    cutoffDate
  });

  assert.deepEqual(first.closedIds, ['missing']);
  assert.deepEqual(replay.closedIds, []);
});
