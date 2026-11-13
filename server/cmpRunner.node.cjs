const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCmpRunConfig, createCmpRunner } = require('./cmpRunner.js');

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

const createRunnerFixture = ({ ageMinutes = 60, initialStatus = null } = {}) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debors-cmp-runner-'));
  const automationDir = path.join(rootDir, 'automation');
  const statusPath = path.join(automationDir, 'cmp_status.json');
  const logDir = path.join(automationDir, 'logs');
  const scriptPath = path.join(automationDir, 'run_cmp_bot.ps1');
  fs.mkdirSync(automationDir, { recursive: true });
  fs.writeFileSync(scriptPath, '# fixture', 'utf8');
  if (initialStatus) fs.writeFileSync(statusPath, JSON.stringify(initialStatus));
  let currentTime = new Date('2026-11-12T20:00:00.000Z');
  const children = [];
  const runner = createCmpRunner({
    rootDir,
    statusPath,
    logDir,
    scriptPath,
    logPath: path.join(automationDir, 'legacy.log'),
    env: { PORT: '3001', STATUS_MAX_AGE_MIN: String(ageMinutes) },
    logger: { error() {} },
    now: () => new Date(currentTime),
    makeRunId: () => `run-${children.length + 1}`,
    spawnProcess: (...args) => {
      const child = new EventEmitter();
      child.exitCode = null;
      child.spawnArgs = args;
      children.push(child);
      return child;
    }
  });
  return {
    runner,
    statusPath,
    children,
    setNow(value) { currentTime = new Date(value); },
    dispose() { fs.rmSync(rootDir, { recursive: true, force: true }); }
  };
};

test('starting a run resets live progress and isolates status and logs by run id', () => {
  const fixture = createRunnerFixture({ initialStatus: {
    runId: 'old-run', running: false, phase: 'error', page: 88, invoicesFound: 900,
    error: 'stale failure', updatedAt: '2026-11-12T18:00:00.000Z',
    lastSuccessfulSync: { runId: 'success-1', timestamp: '2026-11-12T17:00:00.000Z' },
    lastRunError: { runId: 'old-run', timestamp: '2026-11-12T18:00:00.000Z', message: 'stale failure' }
  } });
  try {
    const result = fixture.runner.startCmpScraper('normal');
    const status = fixture.runner.getCmpStatus();
    const [executable, args, options] = fixture.children[0].spawnArgs;

    assert.deepEqual(result, { started: true, runId: 'run-1' });
    assert.equal(status.phase, 'starting');
    assert.equal(status.error, null);
    assert.equal(status.failureReason, null);
    assert.equal(status.page, 0);
    assert.equal(status.invoicesFound, 0);
    assert.equal(status.runId, 'run-1');
    assert.equal(status.lastSuccessfulSync.runId, 'success-1');
    assert.equal(status.lastRunError.runId, 'old-run');
    assert.match(status.logPath, /cmp-run-1\.log$/);
    assert.equal(executable, 'powershell.exe');
    assert.deepEqual(args, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(path.dirname(fixture.statusPath), 'run_cmp_bot.ps1')
    ]);
    assert.equal(options.env.CMP_RUN_ID, 'run-1');
    assert.equal(options.env.CMP_LOG_PATH, status.logPath);
    fs.writeFileSync(status.logPath, 'run_id=run-1 | isolated log line', 'utf8');
    assert.match(fixture.runner.tailLog(), /run_id=run-1/);
  } finally {
    fixture.dispose();
  }
});

test('runner ignores status from another run and status older than STATUS_MAX_AGE_MIN', () => {
  const fixture = createRunnerFixture({ ageMinutes: 2 });
  try {
    fixture.runner.startCmpScraper('fast');
    fs.writeFileSync(fixture.statusPath, JSON.stringify({
      runId: 'wrong-run', running: false, phase: 'error', page: 77, invoicesFound: 123,
      error: 'unrelated stale error', updatedAt: '2026-11-12T19:59:00.000Z'
    }));
    let status = fixture.runner.getCmpStatus();
    assert.equal(status.running, true);
    assert.equal(status.error, null);
    assert.equal(status.page, 0);

    fs.writeFileSync(fixture.statusPath, JSON.stringify({
      runId: 'run-1', running: true, phase: 'scraping', page: 9, invoicesFound: 400,
      error: null, updatedAt: '2026-11-12T19:55:00.000Z'
    }));
    status = fixture.runner.getCmpStatus();
    assert.equal(status.phase, 'starting');
    assert.equal(status.page, 0);
    assert.equal(status.error, null);
  } finally {
    fixture.dispose();
  }
});

test('runner does not present a leftover running status as live after a server restart', () => {
  const fixture = createRunnerFixture({ initialStatus: {
    runId: 'orphaned-run', running: true, phase: 'scraping', page: 12, invoicesFound: 600,
    updatedAt: '2026-11-12T19:59:00.000Z'
  } });
  try {
    const status = fixture.runner.getCmpStatus();
    assert.equal(status.running, false);
    assert.equal(status.phase, 'idle');
    assert.equal(status.page, 0);
    assert.equal(status.invoicesFound, 0);
    assert.equal(status.lastRunIsStale, true);
  } finally {
    fixture.dispose();
  }
});

test('runner ignores a recent legacy status without a run id', () => {
  const fixture = createRunnerFixture({ initialStatus: {
    running: false, phase: 'error', page: 8, invoicesFound: 90,
    error: 'legacy error', updatedAt: '2026-11-12T20:00:00.000Z'
  } });
  try {
    const status = fixture.runner.getCmpStatus();
    assert.equal(status.phase, 'idle');
    assert.equal(status.error, null);
    assert.equal(status.lastRunIsStale, true);
  } finally {
    fixture.dispose();
  }
});

test('runner accepts a retry run id only when it carries the active parent run id', () => {
  const fixture = createRunnerFixture();
  try {
    fixture.runner.startCmpScraper('fast');
    fs.writeFileSync(fixture.statusPath, JSON.stringify({
      runId: 'retry-run', parentRunId: 'run-1', running: true, phase: 'scraping',
      page: 4, invoicesFound: 80, error: null, updatedAt: '2026-11-12T20:00:00.000Z'
    }));

    const status = fixture.runner.getCmpStatus();
    assert.equal(status.runId, 'retry-run');
    assert.equal(status.phase, 'scraping');
    assert.equal(status.page, 4);
  } finally {
    fixture.dispose();
  }
});

test('runner reports last successful sync and last-run error as separate history values', () => {
  const fixture = createRunnerFixture();
  try {
    fixture.runner.startCmpScraper('fast');
    fs.writeFileSync(fixture.statusPath, JSON.stringify({
      runId: 'run-1', running: false, phase: 'done', runStatus: 'complete', persisted: true,
      page: 2, invoicesFound: 50, updatedAt: '2026-11-12T20:00:00.000Z', error: null
    }));
    fixture.children[0].emit('exit', 0);
    let status = fixture.runner.getCmpStatus();
    assert.deepEqual(status.lastSuccessfulSync, { runId: 'run-1', timestamp: '2026-11-12T20:00:00.000Z' });
    assert.equal(status.lastRunError, null);

    fixture.runner.startCmpScraper('fast');
    fixture.children[1].emit('error', new Error('worker failed'));
    status = fixture.runner.getCmpStatus();
    assert.equal(status.error, 'worker failed');
    assert.deepEqual(status.lastRunError, {
      runId: 'run-2', timestamp: '2026-11-12T20:00:00.000Z', message: 'worker failed'
    });
    assert.deepEqual(status.lastSuccessfulSync, { runId: 'run-1', timestamp: '2026-11-12T20:00:00.000Z' });
  } finally {
    fixture.dispose();
  }
});
