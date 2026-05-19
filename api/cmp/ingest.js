import { ingestCmpSnapshot, verifyCmpIngestSecret } from '../../lib/cmpIngest.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyCmpIngestSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await ingestCmpSnapshot(req.body || {});
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[CMP Ingest]', error);
    return res.status(500).json({ error: error.message || 'CMP ingest failed' });
  }
}
