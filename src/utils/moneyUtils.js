export const parseMoneyValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  let raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

  raw = raw
    .replace(/[$€£]/g, '')
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!raw) return Number.NaN;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  if (sepIndex === -1) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  const hasBoth = lastComma !== -1 && lastDot !== -1;
  const decPart = raw.slice(sepIndex + 1);
  const intPart = raw.slice(0, sepIndex);

  let normalized;
  if (!hasBoth && decPart.length === 3) {
    normalized = raw.replace(/[.,]/g, '');
  } else {
    const cleanInt = intPart.replace(/[.,]/g, '');
    normalized = `${cleanInt}.${decPart.replace(/[.,]/g, '')}`;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const roundMoney = (value) => {
  const parsed = parseMoneyValue(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};