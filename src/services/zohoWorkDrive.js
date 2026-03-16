import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const LOCAL_API_URL = 'http://localhost:3001/api/debtors';

const buildUrl = (url, cacheBust) => {
  if (!cacheBust) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

export const fetchAllDataFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { cacheBust = true } = options;
  if (!url) throw new Error('No URL provided');

  const sourceUrl = buildUrl(url, cacheBust);
  let response;

  try {
    response = await fetch(sourceUrl);
  } catch (error) {
    throw new Error(`Failed to fetch from backend: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`Backend returned error: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

export const fetchDebtorsFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { debtors } = await fetchAllDataFromSheet(url, options);
  return debtors;
};

export const fetchClientsByAgentFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { clientsByAgent } = await fetchAllDataFromSheet(url, options);
  return clientsByAgent;
};
