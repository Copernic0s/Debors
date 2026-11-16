const getBogotaWorkTime = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const getCmpSyncStalenessWarning = (status, now = new Date()) => {
  const lastSuccessTimestamp = status?.lastSuccessfulSync?.timestamp;
  const lastSuccessMs = Date.parse(lastSuccessTimestamp || '');
  if (!Number.isFinite(lastSuccessMs) || now.getTime() - lastSuccessMs <= 8 * 60 * 60 * 1000) return null;

  const { weekday, hour } = getBogotaWorkTime(now);
  const hourNumber = Number(hour);
  if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday) || hourNumber < 7 || hourNumber >= 20) {
    return null;
  }

  return {
    timestamp: lastSuccessTimestamp,
    failureReason: status?.lastRunError?.failureReason || status?.failureReason || 'not_recorded'
  };
};

export const formatBogotaSyncTime = (timestamp) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(timestamp));
