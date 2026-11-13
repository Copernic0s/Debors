const { spawn } = require('child_process');
const { randomUUID } = require('node:crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const STATUS_PATH = path.join(ROOT_DIR, 'automation', 'cmp_status.json');
const LOG_PATH = path.join(ROOT_DIR, 'automation', 'cmp_invoice_extractor.log');
const LOG_DIR = path.join(ROOT_DIR, 'automation', 'logs');
const PS_SCRIPT = path.join(ROOT_DIR, 'automation', 'run_cmp_bot.ps1');
const DEFAULT_STATUS_MAX_AGE_MIN = 60;
const MAX_RUN_LOGS = 20;

const parseStatusMaxAge = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STATUS_MAX_AGE_MIN;
};

const readStatusFile = (fileSystem, statusPath) => {
  try {
    if (!fileSystem.existsSync(statusPath)) return null;
    return JSON.parse(fileSystem.readFileSync(statusPath, 'utf8'));
  } catch {
    return null;
  }
};

const writeStatusFile = (fileSystem, statusPath, status) => {
  fileSystem.mkdirSync(path.dirname(statusPath), { recursive: true });
  const temporaryPath = `${statusPath}.tmp`;
  fileSystem.writeFileSync(temporaryPath, JSON.stringify(status, null, 2), 'utf8');
  fileSystem.renameSync(temporaryPath, statusPath);
};

const buildCmpRunConfig = (depth, runId = randomUUID(), startedAt = new Date().toISOString(), trigger = 'manual') => {
  const mode = depth === 'standard' ? 'normal' : ['fast', 'normal', 'deep'].includes(depth) ? depth : 'fast';
  const settings = {
    fast: { historyDays: '15', maxPages: '5', isFastSync: 'true' },
    normal: { historyDays: '120', maxPages: '100', isFastSync: 'false' },
    deep: { historyDays: '365', maxPages: '250', isFastSync: 'false' }
  }[mode];

  return {
    mode,
    trigger: ['manual', 'scheduled'].includes(trigger) ? trigger : 'manual',
    runId,
    startedAt,
    historyDays: settings.historyDays,
    maxPages: settings.maxPages,
    isFastSync: settings.isFastSync
  };
};

const createCmpRunner = ({
  spawnProcess = spawn,
  fileSystem = fs,
  rootDir = ROOT_DIR,
  statusPath = STATUS_PATH,
  logPath = LOG_PATH,
  logDir = LOG_DIR,
  scriptPath = PS_SCRIPT,
  env = process.env,
  now = () => new Date(),
  makeRunId = randomUUID,
  logger = console,
  statusMaxAgeMin = parseStatusMaxAge(env.STATUS_MAX_AGE_MIN)
} = {}) => {
  let cmpChild = null;
  let startedAt = null;
  let lastExitCode = null;
  let lastExitAt = null;
  let latestRun = null;
  let lastSuccessfulSync = null;
  let lastRunError = null;

  const priorStatus = readStatusFile(fileSystem, statusPath);
  if (priorStatus?.runId) latestRun = { runId: priorStatus.runId, startedAt: priorStatus.startedAt || null };
  if (priorStatus?.lastSuccessfulSync) lastSuccessfulSync = priorStatus.lastSuccessfulSync;
  else if (priorStatus?.phase === 'done' && priorStatus.runStatus === 'complete' && priorStatus.updatedAt) {
    lastSuccessfulSync = { runId: priorStatus.runId || null, timestamp: priorStatus.updatedAt };
  }
  if (priorStatus?.lastRunError) lastRunError = priorStatus.lastRunError;
  else if (priorStatus?.error) {
    lastRunError = {
      runId: priorStatus.runId || null,
      timestamp: priorStatus.updatedAt || null,
      message: priorStatus.error
    };
  }

  const isFresh = (status) => {
    const updatedAt = Date.parse(status?.updatedAt || '');
    const age = now().getTime() - updatedAt;
    return Number.isFinite(updatedAt) && age >= 0 && age <= statusMaxAgeMin * 60_000;
  };

  const statusForRun = (runConfig, values = {}) => ({
    runId: runConfig.runId,
    parentRunId: runConfig.runId,
    running: true,
    phase: 'starting',
    message: 'CMP run starting...',
    trigger: runConfig.trigger,
    page: 0,
    invoicesFound: 0,
    error: null,
    runStatus: 'running',
    updatedAt: now().toISOString(),
    lastSuccessfulSync,
    lastRunError,
    ...values
  });

  const listRunLogs = () => {
    try {
      return fileSystem.readdirSync(logDir)
        .filter((name) => /^cmp-.+\.log$/i.test(name))
        .map((name) => {
          const fullPath = path.join(logDir, name);
          const stats = fileSystem.statSync(fullPath);
          return {
            runId: name.slice(4, -4),
            updatedAt: stats.mtime.toISOString(),
            size: stats.size
          };
        })
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    } catch {
      return [];
    }
  };

  const pruneRunLogs = (protectedRunId) => {
    const logs = listRunLogs();
    if (logs.length <= MAX_RUN_LOGS) return;
    const protectedLog = logs.find((log) => log.runId === protectedRunId);
    const keepIds = new Set([
      ...(protectedLog ? [protectedLog.runId] : []),
      ...logs.filter((log) => log.runId !== protectedRunId)
        .slice(0, protectedLog ? MAX_RUN_LOGS - 1 : MAX_RUN_LOGS)
        .map((log) => log.runId)
    ]);
    for (const log of logs) {
      if (!keepIds.has(log.runId)) {
        try {
          fileSystem.unlinkSync(path.join(logDir, `cmp-${log.runId}.log`));
        } catch (error) {
          logger.warn('[CMP Runner] Could not prune old run log:', error.message);
        }
      }
    }
  };

  const refreshHistory = (status) => {
    if (status?.lastSuccessfulSync) lastSuccessfulSync = status.lastSuccessfulSync;
    if (status?.lastRunError) lastRunError = status.lastRunError;
    else if (status?.error) {
      lastRunError = {
        runId: status.runId || null,
        timestamp: status.updatedAt || null,
        message: status.error
      };
    }
  };

  const recordRunFailure = (runConfig, message) => {
    const failedAt = now().toISOString();
    const existing = readStatusFile(fileSystem, statusPath);
    const matchesRun = existing?.runId === runConfig.runId || existing?.parentRunId === runConfig.runId;
    const matching = matchesRun ? existing : statusForRun(runConfig);
    lastRunError = { runId: matching.runId || runConfig.runId, timestamp: failedAt, message };
    writeStatusFile(fileSystem, statusPath, {
      ...matching,
      running: false,
      phase: 'error',
      message: 'CMP run failed',
      error: message,
      runStatus: 'failed',
      updatedAt: failedAt,
      lastSuccessfulSync,
      lastRunError
    });
  };

  const finishRun = (runConfig, code) => {
    lastExitCode = code;
    lastExitAt = now().toISOString();
    cmpChild = null;

    const existing = readStatusFile(fileSystem, statusPath);
    const matchesRun = existing?.runId === runConfig.runId || existing?.parentRunId === runConfig.runId;
    if (!matchesRun) {
      pruneRunLogs(runConfig.runId);
      return;
    }

    if (code !== 0) {
      recordRunFailure(runConfig, existing.error || `CMP worker exited with code ${code}`);
      pruneRunLogs(runConfig.runId);
      return;
    }

    if (existing.running || !['done', 'error'].includes(existing.phase)) {
      recordRunFailure(runConfig, 'CMP worker exited without a terminal status');
      pruneRunLogs(runConfig.runId);
      return;
    }

    if (existing.phase === 'done' && existing.runStatus === 'complete' && existing.persisted === true) {
      lastSuccessfulSync = { runId: existing.runId, timestamp: existing.updatedAt };
      writeStatusFile(fileSystem, statusPath, { ...existing, lastSuccessfulSync });
    }
    pruneRunLogs(runConfig.runId);
  };

  const getCmpStatus = () => {
    const fileStatus = readStatusFile(fileSystem, statusPath);
    const running = Boolean(cmpChild && cmpChild.exitCode === null);
    const belongsToActiveRun = Boolean(fileStatus?.runId) && (!latestRun
      || fileStatus.runId === latestRun.runId
      || fileStatus.parentRunId === latestRun.runId);
    const processStateMatches = running ? belongsToActiveRun : !fileStatus?.running;
    const usableStatus = processStateMatches && belongsToActiveRun && isFresh(fileStatus) ? fileStatus : null;

    refreshHistory(usableStatus);
    if (usableStatus?.phase === 'done' && usableStatus.runStatus === 'complete' && usableStatus.persisted === true) {
      lastSuccessfulSync = { runId: usableStatus.runId, timestamp: usableStatus.updatedAt };
    }
    const activeLogPath = latestRun
      ? path.join(logDir, `cmp-${latestRun.runId}.log`)
      : logPath;
    return {
      pid: process.pid,
      rootDir,
      logPath: activeLogPath,
      statusPath,
      statusMaxAgeMin,
      running,
      runId: usableStatus?.runId || latestRun?.runId || null,
      trigger: usableStatus?.trigger || latestRun?.trigger || null,
      lastRunIsStale: Boolean(fileStatus && !usableStatus && (!running || !belongsToActiveRun)),
      startedAt,
      lastExitAt,
      lastExitCode,
      logMtime: fileSystem.existsSync(activeLogPath) ? fileSystem.statSync(activeLogPath).mtime.toISOString() : null,
      phase: usableStatus?.phase || (running ? 'starting' : 'idle'),
      message: usableStatus?.message || (running ? 'Waiting for current run status...' : ''),
      page: usableStatus?.page || 0,
      invoicesFound: usableStatus?.invoicesFound || 0,
      error: usableStatus?.error || null,
      failureReason: usableStatus?.failureReason || null,
      runStatus: usableStatus?.runStatus || null,
      updatedAt: usableStatus?.updatedAt || null,
      lastSuccessfulSync,
      lastRunError
    };
  };

  const tailLog = (lines = 120, requestedRunId = null) => {
    const runId = requestedRunId || latestRun?.runId;
    const activeLogPath = runId
      ? path.join(logDir, `cmp-${path.basename(String(runId))}.log`)
      : logPath;
    if (!fileSystem.existsSync(activeLogPath)) return '';
    const content = fileSystem.readFileSync(activeLogPath, 'utf8');
    return content.split(/\r?\n/).slice(-lines).join('\n');
  };

  const getRunLogs = () => listRunLogs().slice(0, MAX_RUN_LOGS);

  const startCmpScraper = (depth = 'fast', trigger = 'manual') => {
    if (cmpChild && cmpChild.exitCode === null) {
      return { started: false, reason: 'already_running' };
    }
    if (!fileSystem.existsSync(scriptPath)) {
      throw new Error(`CMP script not found: ${scriptPath}`);
    }
    refreshHistory(readStatusFile(fileSystem, statusPath));

    const runConfig = buildCmpRunConfig(depth, makeRunId(), now().toISOString(), trigger);
    latestRun = runConfig;
    startedAt = runConfig.startedAt;
    lastExitCode = null;
    lastExitAt = null;
    writeStatusFile(fileSystem, statusPath, statusForRun(runConfig));

    const runLogPath = path.join(logDir, `cmp-${runConfig.runId}.log`);
    fileSystem.mkdirSync(logDir, { recursive: true });
    fileSystem.writeFileSync(runLogPath, '', { flag: 'a' });
    pruneRunLogs(runConfig.runId);
    const childEnv = {
      ...env,
      CMP_INGEST_URL: env.CMP_INGEST_URL || `http://127.0.0.1:${env.PORT || 3001}/api/cmp/ingest`,
      CMP_INGEST_SECRET: env.CMP_INGEST_SECRET || '',
      CMP_HISTORY_DAYS: runConfig.historyDays,
      CMP_MAX_PAGES: runConfig.maxPages,
      CMP_FAST_SYNC: runConfig.isFastSync,
      CMP_SYNC_MODE: runConfig.mode,
      CMP_RUN_TRIGGER: runConfig.trigger,
      CMP_LOGIN_TIMEOUT_SECONDS: runConfig.trigger === 'scheduled'
        ? (env.CMP_SCHEDULED_LOGIN_TIMEOUT_SECONDS || '60')
        : (env.CMP_MANUAL_LOGIN_TIMEOUT_SECONDS || '300'),
      CMP_RUN_ID: runConfig.runId,
      CMP_PARENT_RUN_ID: runConfig.runId,
      CMP_RUN_STARTED_AT: runConfig.startedAt,
      CMP_LOG_PATH: runLogPath
    };

    try {
      cmpChild = spawnProcess(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { cwd: rootDir, env: childEnv, windowsHide: true }
      );
    } catch (error) {
      cmpChild = null;
      recordRunFailure(runConfig, error.message || 'Failed to start CMP worker');
      throw error;
    }

    cmpChild.on('exit', (code) => finishRun(runConfig, code));
    cmpChild.on('error', (error) => {
      lastExitCode = 1;
      lastExitAt = now().toISOString();
      cmpChild = null;
      recordRunFailure(runConfig, error.message || 'CMP worker process error');
      logger.error('[CMP Runner] Process error:', error.message);
    });

    return { started: true, runId: runConfig.runId };
  };

  return { getCmpStatus, tailLog, getRunLogs, startCmpScraper };
};

let runner;
const getRunner = () => {
  if (!runner) runner = createCmpRunner();
  return runner;
};

module.exports = {
  getCmpStatus: (...args) => getRunner().getCmpStatus(...args),
  tailLog: (...args) => getRunner().tailLog(...args),
  getRunLogs: (...args) => getRunner().getRunLogs(...args),
  startCmpScraper: (...args) => getRunner().startCmpScraper(...args),
  buildCmpRunConfig,
  createCmpRunner,
  STATUS_PATH,
  LOG_PATH,
  LOG_DIR,
  DEFAULT_STATUS_MAX_AGE_MIN,
  MAX_RUN_LOGS
};
