
const getBaseApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  console.log('[API] Environment VITE_API_URL:', envUrl);
  if (envUrl) {
    const finalUrl = envUrl.endsWith('/api/debtors') ? envUrl : `${envUrl.replace(/\/$/, '')}/api/debtors`;
    console.log('[API] Using production URL:', finalUrl);
    return finalUrl;
  }

  if (import.meta.env.DEV) {
    const fallback = `http://${window.location.hostname}:3001/api/debtors`;
    console.log('[API] Using local fallback URL:', fallback);
    return fallback;
  }

  const fallback = '/api/debtors';
  console.log('[API] Using local fallback URL:', fallback);
  return fallback;
};

const LOCAL_API_URL = getBaseApiUrl();

const buildUrl = (url, cacheBust) => {
  if (!cacheBust) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const fetchAllDataFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { cacheBust = true, retries = 2 } = options;
  if (!url) throw new Error('No URL provided');

  const sourceUrl = buildUrl(url, cacheBust);
  let lastError = null;

  console.log('[API] Fetching data from:', sourceUrl);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Backend returned error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error;
      console.error(`[API] Fetch attempt ${attempt + 1} failed:`, error);
      if (attempt < retries) {
        await wait(700 * (attempt + 1));
      }
    }
  }

  throw new Error(`Failed to fetch from backend: ${lastError?.message || 'Unknown error'}`);
};

export const fetchDebtorsFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { debtors } = await fetchAllDataFromSheet(url, options);
  return debtors;
};

export const fetchClientsByAgentFromSheet = async (url = LOCAL_API_URL, options = {}) => {
  const { clientsByAgent } = await fetchAllDataFromSheet(url, options);
  return clientsByAgent;
};
