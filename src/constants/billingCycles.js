export const BILLING_CYCLES = {
  MONDAY_SUNDAY: 'Monday - Sunday',
  THURSDAY_WEDNESDAY: 'Thursday - Wednesday',
  TWICE: 'Twice',
  TWICE_TUE_FRI: 'Twice (Tue / Fri)',
  TWICE_WED_SAT: 'Twice (Wed / Sat)',
  CS_BY_AGENT: 'CS by agent',
  MULTIPLE: 'Multiple',
  UNSPECIFIED: 'Unspecified'
};

export const BILLING_CYCLE_OPTIONS = [
  BILLING_CYCLES.MONDAY_SUNDAY,
  BILLING_CYCLES.THURSDAY_WEDNESDAY,
  BILLING_CYCLES.TWICE,
  BILLING_CYCLES.TWICE_TUE_FRI,
  BILLING_CYCLES.TWICE_WED_SAT,
  BILLING_CYCLES.CS_BY_AGENT,
  BILLING_CYCLES.MULTIPLE,
  BILLING_CYCLES.UNSPECIFIED
];

export const DAYS_MAP = {
  'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0
};

export const normalizeBillingCycle = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return BILLING_CYCLES.UNSPECIFIED;

  const normalized = raw.toLowerCase();

  if (normalized.includes('twice') && normalized.includes('/')) {
    const match = raw.match(/\(([^)]+)\)/);
    if (match) return raw;
    return BILLING_CYCLES.TWICE;
  }

  if (normalized.includes('cs by agent')) return BILLING_CYCLES.CS_BY_AGENT;
  if (normalized.includes('multiple')) return BILLING_CYCLES.MULTIPLE;
  if (normalized.includes('twice')) return BILLING_CYCLES.TWICE;
  if (normalized.includes('thursday') || normalized.includes('thu') || normalized.includes('wed')) {
    return BILLING_CYCLES.THURSDAY_WEDNESDAY;
  }
  if (normalized.includes('monday') || normalized.includes('mon') || normalized.includes('sun')) {
    return BILLING_CYCLES.MONDAY_SUNDAY;
  }

  return raw;
};
