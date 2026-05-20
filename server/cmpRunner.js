const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const STATUS_PATH = path.join(ROOT_DIR, 'automation', 'cmp_status.json');
const LOG_PATH = path.join(ROOT_DIR, 'automation', 'cmp_invoice_extractor.log');
const PS_SCRIPT = path.join(ROOT_DIR, 'automation', 'run_cmp_bot.ps1');

let cmpChild = null;
let startedAt = null;
let lastExitCode = null;
let lastExitAt = null;

const readStatusFile = () => {
  try {
    if (!fs.existsSync(STATUS_PATH)) return null;
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch {
    return null;
  }
};

const getCmpStatus = () => {
  const fileStatus = readStatusFile();
  const running = Boolean(cmpChild && cmpChild.exitCode === null);

  return {
    pid: process.pid,
    rootDir: ROOT_DIR,
    logPath: LOG_PATH,
    statusPath: STATUS_PATH,
    running,
    startedAt,
    lastExitAt,
    lastExitCode,
    logMtime: fs.existsSync(LOG_PATH) ? fs.statSync(LOG_PATH).mtime.toISOString() : null,
    phase: fileStatus?.phase || (running ? 'running' : 'idle'),
    message: fileStatus?.message || '',
    page: fileStatus?.page || 0,
    invoicesFound: fileStatus?.invoicesFound || 0,
    error: fileStatus?.error || null,
    updatedAt: fileStatus?.updatedAt || null
  };
};

const tailLog = (lines = 120) => {
  if (!fs.existsSync(LOG_PATH)) return '';
  const content = fs.readFileSync(LOG_PATH, 'utf8');
  return content.split(/\r?\n/).slice(-lines).join('\n');
};

const startCmpScraper = (depth = 'fast') => {
  if (cmpChild && cmpChild.exitCode === null) {
    return { started: false, reason: 'already_running' };
  }

  if (!fs.existsSync(PS_SCRIPT)) {
    throw new Error(`CMP script not found: ${PS_SCRIPT}`);
  }

  let historyDays = '15';
  let maxPages = '5';
  let isFastSync = 'true';

  if (depth === 'deep') {
    historyDays = '365';
    maxPages = '250';
    isFastSync = 'false';
  } else if (depth === 'normal') {
    historyDays = '120';
    maxPages = '100';
    isFastSync = 'false';
  }

  const env = {
    ...process.env,
    CMP_INGEST_URL: process.env.CMP_INGEST_URL || `http://127.0.0.1:${process.env.PORT || 3001}/api/cmp/ingest`,
    CMP_INGEST_SECRET: process.env.CMP_INGEST_SECRET || '',
    CMP_HISTORY_DAYS: historyDays,
    CMP_MAX_PAGES: maxPages,
    CMP_FAST_SYNC: isFastSync
  };

  cmpChild = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_SCRIPT],
    {
      cwd: ROOT_DIR,
      env,
      windowsHide: true
    }
  );

  startedAt = new Date().toISOString();
  lastExitCode = null;
  lastExitAt = null;

  cmpChild.on('exit', (code) => {
    lastExitCode = code;
    lastExitAt = new Date().toISOString();
    cmpChild = null;
  });

  cmpChild.on('error', (error) => {
    lastExitCode = 1;
    lastExitAt = new Date().toISOString();
    cmpChild = null;
    console.error('[CMP Runner] Process error:', error);
  });

  return { started: true };
};

module.exports = {
  getCmpStatus,
  tailLog,
  startCmpScraper,
  STATUS_PATH,
  LOG_PATH
};
