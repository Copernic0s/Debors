export const normalizeWeekLabel = (label) => {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return 'unspecified';
  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return `W-${numbers[0]}-${numbers[1]}`;
  }
  return raw.replace(/[^a-z0-9]/g, '');
};

export const normalizeMatchKey = (value) => {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+(llc|inc|corp|co|limited|ltd|transportation|logistics|express)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const normalizeStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid' || normalized === 'inactive') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'no_invoice') return 'no_invoice';
  return 'pending';
};