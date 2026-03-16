import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const getBaseApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  console.log('[API] Environment VITE_API_URL:', envUrl);
  if (envUrl) {
    const finalUrl = envUrl.endsWith('/api/debtors') ? envUrl : `${envUrl.replace(/\/$/, '')}/api/debtors`;
    console.log('[API] Using production URL:', finalUrl);
    return finalUrl;
  }
  const fallback = `http://${window.location.hostname}:3001/api/debtors`;
  console.log('[API] Using local fallback URL:', fallback);
  return fallback;
};

const LOCAL_API_URL = getBaseApiUrl();

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

  console.log('[API] Fetching data from:', sourceUrl); // Log the actual URL being fetched
  try {
    response = await fetch(sourceUrl);
  } catch (error) {
    console.error('[API] Network error during fetch:', error); // Log network error details
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
