import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSharedState, saveSharedState, SHARED_APP_STATE_KEYS } from '../services/sharedAppState';
import {
  normalizeTrackerRows,
  readAccessFeatureOverrides,
  readTrackerFollowUps,
  sanitizeTrackerComments,
  writeAccessFeatureOverrides,
  writeTrackerFollowUps
} from '../services/supportTrackerState';

export const useAppSharedState = ({ user, setTrackerData }) => {
  const [trackerFollowUps, setTrackerFollowUps] = useState(() => readTrackerFollowUps());
  const [accessFeatureOverrides, setAccessFeatureOverrides] = useState(() => readAccessFeatureOverrides());
  const trackerFollowUpsRef = useRef({});

  useEffect(() => {
    trackerFollowUpsRef.current = trackerFollowUps;
  }, [trackerFollowUps]);

  useEffect(() => {
    if (!user) return;

    let isActive = true;

    const hydrateSharedState = async () => {
      const remoteOverrides = await loadSharedState(
        SHARED_APP_STATE_KEYS.featureAccessOverrides,
        readAccessFeatureOverrides()
      );
      if (isActive && remoteOverrides && typeof remoteOverrides === 'object') {
        setAccessFeatureOverrides(remoteOverrides);
        writeAccessFeatureOverrides(remoteOverrides);
      }

      const remoteFollowUps = await loadSharedState(
        SHARED_APP_STATE_KEYS.trackerFollowUps,
        readTrackerFollowUps()
      );
      if (isActive && remoteFollowUps && typeof remoteFollowUps === 'object') {
        setTrackerFollowUps(remoteFollowUps);
        trackerFollowUpsRef.current = remoteFollowUps;
        writeTrackerFollowUps(remoteFollowUps);
        setTrackerData((prev) => normalizeTrackerRows(prev, remoteFollowUps));
      }
    };

    hydrateSharedState();

    return () => {
      isActive = false;
    };
  }, [user, setTrackerData]);

  const normalizeIncomingTrackerRows = useCallback(
    (rows) => normalizeTrackerRows(rows, trackerFollowUpsRef.current),
    []
  );

  const handleSaveFollowUp = useCallback((payload) => {
    if (!payload?.id) return;

    const normalizedComments = sanitizeTrackerComments(payload.comments);
    const normalizedFollowUp = {
      id: String(payload.id),
      status: String(payload.status || 'Follow-up').trim(),
      owner: String(payload.owner || '').trim(),
      nextAction: String(payload.nextAction || '').trim(),
      followUpDue: String(payload.followUpDue || '').trim(),
      comments: normalizedComments,
      lastComment: normalizedComments.length > 0 ? normalizedComments[normalizedComments.length - 1] : null
    };

    setTrackerFollowUps((prev) => {
      const next = {
        ...prev,
        [normalizedFollowUp.id]: normalizedFollowUp
      };
      trackerFollowUpsRef.current = next;
      writeTrackerFollowUps(next);
      saveSharedState(SHARED_APP_STATE_KEYS.trackerFollowUps, next, user?.email || null);
      return next;
    });

    setTrackerData((prev) =>
      normalizeTrackerRows(
        prev.map((item) =>
          item.id === normalizedFollowUp.id
            ? {
                ...item,
                ...normalizedFollowUp
              }
            : item
        ),
        trackerFollowUpsRef.current
      )
    );
  }, [setTrackerData, user]);

  const updateFeatureAccessOverride = useCallback((subjectKey, patch) => {
    setAccessFeatureOverrides((prev) => {
      const next = {
        ...prev,
        [subjectKey]: {
          ...(prev?.[subjectKey] || {}),
          ...patch
        }
      };
      writeAccessFeatureOverrides(next);
      saveSharedState(SHARED_APP_STATE_KEYS.featureAccessOverrides, next, user?.email || null);
      return next;
    });
  }, [user]);

  return {
    accessFeatureOverrides,
    handleSaveFollowUp,
    normalizeIncomingTrackerRows,
    updateFeatureAccessOverride
  };
};
