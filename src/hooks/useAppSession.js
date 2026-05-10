import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import {
  canViewActivityLogs,
  logActivityEntries,
  logLoginActivity,
  shouldTrackUserActivity
} from '../services/activityLogger';

export const useAppSession = ({ onSignedOut }) => {
  const [user, setUser] = useState(null);
  const [activityLogRefreshKey, setActivityLogRefreshKey] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const loggedSessionRef = useRef('');

  const bumpActivityLogRefresh = useCallback(() => {
    setActivityLogRefreshKey((prev) => prev + 1);
  }, []);

  const recordActivityEntries = useCallback(async (entries) => {
    if (!user || !shouldTrackUserActivity(user) || !entries || entries.length === 0) return;
    const result = await logActivityEntries(entries);
    if (result?.success && result.logged > 0) {
      bumpActivityLogRefresh();
    }
  }, [bumpActivityLogRefresh, user]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT' || !session?.user) {
        loggedSessionRef.current = '';
        onSignedOut?.();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        const sessionKey = `${session.user.id}:${session.access_token?.slice(0, 16) || 'signed-in'}`;
        if (loggedSessionRef.current !== sessionKey && !canViewActivityLogs(session.user)) {
          loggedSessionRef.current = sessionKey;
          try {
            const result = await logLoginActivity(session.user);
            if (result?.success && result.logged > 0) {
              bumpActivityLogRefresh();
            }
          } catch (error) {
            console.error('[Activity Logs] Login logging failed:', error);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [bumpActivityLogRefresh, onSignedOut]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    loggedSessionRef.current = '';
    try {
      if (hasSupabaseConfig && supabase) {
        const signOutTask = supabase.auth.signOut({ scope: 'local' });
        const timeoutTask = new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Logout timed out')), 4000);
        });

        const result = await Promise.race([signOutTask, timeoutTask]);
        const error = result?.error;
        if (error) {
          throw error;
        }
      }

      onSignedOut?.();
      setUser(null);
      window.setTimeout(() => {
        window.location.reload();
      }, 120);
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
      onSignedOut?.();
      setUser(null);
      toast.error('Session closed locally. Refresh if needed.', {
        duration: 3500
      });
      window.setTimeout(() => {
        window.location.reload();
      }, 120);
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, onSignedOut]);

  return {
    activityLogRefreshKey,
    handleLogout,
    isLoggingOut,
    recordActivityEntries,
    setAuthenticatedUser: setUser,
    user
  };
};
