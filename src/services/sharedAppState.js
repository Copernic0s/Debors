import { supabase } from '../lib/supabase';

export const SHARED_APP_STATE_TABLE = 'app_shared_state';

export const SHARED_APP_STATE_KEYS = {
  trackerFollowUps: 'tracker_followups',
  featureAccessOverrides: 'feature_access_overrides',
  portfolioCompanyOverridesPrefix: 'portfolio_company_overrides'
};

const normalizeEmailKey = (value) => String(value || '').trim().toLowerCase();

export const getPortfolioOverridesStateKey = (email) =>
  `${SHARED_APP_STATE_KEYS.portfolioCompanyOverridesPrefix}:${normalizeEmailKey(email)}`;

export const loadSharedState = async (stateKey, fallbackValue) => {
  if (!supabase || !stateKey) return fallbackValue;

  const { data, error } = await supabase
    .from(SHARED_APP_STATE_TABLE)
    .select('payload')
    .eq('state_key', stateKey)
    .maybeSingle();

  if (error) {
    console.error(`[Shared State] Failed to load "${stateKey}":`, error);
    return fallbackValue;
  }

  return data?.payload ?? fallbackValue;
};

export const saveSharedState = async (stateKey, payload, updatedBy = null) => {
  if (!supabase || !stateKey) {
    return { success: false };
  }

  const { error } = await supabase
    .from(SHARED_APP_STATE_TABLE)
    .upsert(
      {
        state_key: stateKey,
        payload,
        updated_by: updatedBy ? String(updatedBy).trim().toLowerCase() : null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'state_key' }
    );

  if (error) {
    console.error(`[Shared State] Failed to save "${stateKey}":`, error);
    return { success: false, error };
  }

  return { success: true };
};
