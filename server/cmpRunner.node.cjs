const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCmpRunConfig } = require('./cmpRunner.js');

test('runner creates a run envelope and preserves mode-specific coverage', () => {
  const config = buildCmpRunConfig('fast', 'f4-run-id', '2026-11-12T21:00:00.000Z');
  assert.deepEqual(config, {
    mode: 'fast',
    runId: 'f4-run-id',
    startedAt: '2026-11-12T21:00:00.000Z',
    historyDays: '15',
    maxPages: '5',
    isFastSync: 'true'
  });
});

test('normal and deep modes retain their configured windows and max pages', () => {
  assert.deepEqual(
    [buildCmpRunConfig('normal').historyDays, buildCmpRunConfig('normal').maxPages],
    ['120', '100']
  );
  assert.deepEqual(
    [buildCmpRunConfig('deep').historyDays, buildCmpRunConfig('deep').maxPages],
    ['365', '250']
  );
});
