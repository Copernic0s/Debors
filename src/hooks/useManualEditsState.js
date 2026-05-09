import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  buildManualEditUpserts,
  findLegacyDueDateRepairs,
  MANUAL_EDITS_TABLE,
  mapDbEditToManualEdit
} from '../services/manualEditsPersistence';

export const useManualEditsState = ({ user, loading }) => {
  const [manualEdits, setManualEdits] = useState({});
  const manualEditsRef = useRef({});

  const persistEditedRows = useCallback(async (rows) => {
    if (!rows || rows.length === 0 || !user) return;

    const upserts = buildManualEditUpserts(rows);
    if (upserts.length === 0) return;

    try {
      const { error } = await supabase.from(MANUAL_EDITS_TABLE).upsert(upserts);
      if (error) throw error;

      setManualEdits((prev) => {
        const next = { ...prev };
        rows.forEach((row) => {
          next[row.id] = { ...row };
        });
        manualEditsRef.current = next;
        return next;
      });
    } catch (error) {
      const msg = error?.message || 'Unknown network error';
      toast.error(`Cloud Sync Failed: ${msg}`, { duration: 5000 });
      console.error('[Persistence] Detailed Error:', error);
    }
  }, [user]);

  const fetchManualEdits = useCallback(async () => {
    if (!user) return;

    try {
      const { data: edits, error } = await supabase.from(MANUAL_EDITS_TABLE).select('*');
      if (error) throw error;

      const editsById = {};
      (edits || []).forEach((edit) => {
        editsById[edit.id] = mapDbEditToManualEdit(edit);
      });

      setManualEdits(editsById);
      manualEditsRef.current = editsById;
    } catch (error) {
      console.error('Error fetching manual edits:', error.message);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchManualEdits();
      return;
    }

    setManualEdits({});
    manualEditsRef.current = {};
  }, [user, fetchManualEdits]);

  useEffect(() => {
    if (loading || !manualEdits || Object.keys(manualEdits).length === 0) return;

    const fixed = findLegacyDueDateRepairs(manualEdits);
    if (fixed.length === 0) return;

    setManualEdits((prev) => {
      const next = { ...prev };
      fixed.forEach((item) => {
        next[item.id] = item;
      });
      manualEditsRef.current = next;
      return next;
    });

    persistEditedRows(fixed);
  }, [loading, manualEdits, persistEditedRows]);

  return {
    manualEdits,
    manualEditsRef,
    persistEditedRows,
    setManualEdits
  };
};
