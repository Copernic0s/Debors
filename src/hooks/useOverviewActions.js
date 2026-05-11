import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { normalizeBillingCycle } from '../constants/billingCycles';
import { roundMoney } from '../services/debtorDataReconciliation';

export const useOverviewActions = ({
  currentDebtor,
  data,
  manualEditsRef,
  matchesSelectedAgent,
  persistEditedRows,
  recordActivityEntries,
  selectedWeek,
  setActiveCompany,
  setCurrentDebtor,
  setData,
  setIsModalOpen,
  setManualEdits,
  user,
  buildFieldChangeActivityEntries,
  createActivityEntry,
  manualEditsTable
}) => {
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentDebtor(null);
  }, [setCurrentDebtor, setIsModalOpen]);

  const openCompanyProfile = useCallback((companyName) => {
    if (!companyName) return;
    setActiveCompany(companyName);
  }, [setActiveCompany]);

  const handleSaveDebtor = useCallback((debtor) => {
    if (currentDebtor) {
      const isAggregatedRow = String(currentDebtor.id || '').startsWith('CMP-');

      if (isAggregatedRow) {
        const targetCompany = String(currentDebtor.company || currentDebtor.clientName || '').trim().toLowerCase();
        setData((prev) => {
          const changed = [];
          const activityEntries = [];
          const next = prev.map((item) => {
            const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
            if (!sameCompany) return item;

            const inAgentScope = matchesSelectedAgent(item.agentId);
            const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
            if (!inAgentScope || !inWeekScope) return item;

            const updatedRow = {
              ...item,
              company: debtor.company || debtor.clientName,
              clientName: debtor.company || debtor.clientName,
              amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0,
              dueDate: debtor.dueDate,
              status: debtor.status,
              agentId: debtor.agentId,
              billingCycle: debtor.billingCycle,
              invoiceNumber: debtor.invoiceNumber,
              notes: debtor.notes
            };
            changed.push(updatedRow);
            activityEntries.push(...buildFieldChangeActivityEntries({
              user,
              previousRow: item,
              nextRow: updatedRow
            }));
            return updatedRow;
          });

          if (changed.length > 0) {
            setManualEdits((prevEdits) => {
              const nextEdits = { ...prevEdits };
              changed.forEach((row) => {
                nextEdits[row.id] = row;
              });
              manualEditsRef.current = nextEdits;
              return nextEdits;
            });
            persistEditedRows(changed);
            recordActivityEntries(activityEntries);
          }
          return next;
        });
      } else {
        setData((prev) => {
          const previousRow = prev.find((d) => d.id === debtor.id);
          const next = prev.map((d) => (d.id === debtor.id ? debtor : d));
          setManualEdits((prevEdits) => {
            const nextEdits = { ...prevEdits, [debtor.id]: debtor };
            manualEditsRef.current = nextEdits;
            return nextEdits;
          });
          persistEditedRows([debtor]);
          recordActivityEntries(buildFieldChangeActivityEntries({
            user,
            previousRow,
            nextRow: debtor
          }));
          return next;
        });
      }

      toast.success('Debt updated successfully', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    } else {
      const newId = debtor.id || `MANUAL-${Date.now()}`;
      const newDebtor = {
        ...debtor,
        id: newId,
        amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0
      };
      setData((prev) => [newDebtor, ...prev]);
      setManualEdits((prev) => {
        const nextEdit = {
          ...newDebtor,
          __isNew: true,
          __deleted: false
        };
        const next = {
          ...prev,
          [newId]: nextEdit
        };
        persistEditedRows([nextEdit]);
        recordActivityEntries([
          createActivityEntry({
            user,
            actionType: 'EDIT',
            details: `${user.email} created a new debtor record for ${newDebtor.company || newDebtor.clientName || 'Unknown company'}`,
            entityType: 'debtor',
            entityId: newId,
            company: newDebtor.company || newDebtor.clientName || null
          })
        ]);
        return next;
      });
      toast.success('New debtor added', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    }

    closeModal();
  }, [
    buildFieldChangeActivityEntries,
    closeModal,
    createActivityEntry,
    currentDebtor,
    manualEditsRef,
    matchesSelectedAgent,
    persistEditedRows,
    recordActivityEntries,
    selectedWeek,
    setData,
    setManualEdits,
    user
  ]);

  const handleResetDebtor = useCallback(async (id) => {
    if (!user || !id) return;
    try {
      const { error } = await supabase
        .from(manualEditsTable)
        .delete()
        .eq('id', String(id));

      if (error) throw error;

      setManualEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        manualEditsRef.current = next;
        return next;
      });

      toast.success('Override removed. Restoring Zoho data...', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
      closeModal();
    } catch (error) {
      toast.error('Failed to reset record');
      console.error(error);
    }
  }, [closeModal, manualEditsRef, manualEditsTable, setManualEdits, user]);

  const handleDeleteDebtor = useCallback((target) => {
    const targetRecord = target && typeof target === 'object' ? target : null;
    const targetId = targetRecord?.latestId || targetRecord?.id || target;
    const targetInvKey = String(
      targetRecord?.invoiceNumber || targetRecord?.weekLabel || targetId || ''
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (String(targetRecord?.id || targetId).startsWith('CMP-')) {
      const targetCompany = String(targetRecord?.company || targetRecord?.clientName || '').trim().toLowerCase();

      const rowsToDelete = data.filter((d) => {
        const sameCompany = String(d.company || d.clientName || '').trim().toLowerCase() === targetCompany;
        const rowInvKey = String(d.invoiceNumber || d.weekLabel || d.id || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        return sameCompany && rowInvKey === targetInvKey;
      });

      setData((prev) => prev.filter((d) => !rowsToDelete.some((row) => row.id === d.id)));

      setManualEdits((prev) => {
        const next = { ...prev };
        const changed = [];
        rowsToDelete.forEach((d) => {
          const edit = { ...(next[d.id] || {}), ...d, id: d.id, __deleted: true };
          next[d.id] = edit;
          changed.push(edit);
        });
        manualEditsRef.current = next;
        persistEditedRows(changed);
        return next;
      });
    } else {
      setData((prev) => prev.filter((d) => d.id !== targetId));
      setManualEdits((prev) => {
        const edit = {
          ...(prev[targetId] || targetRecord || {}),
          id: targetId,
          __deleted: true
        };
        const next = {
          ...prev,
          [targetId]: edit
        };
        manualEditsRef.current = next;
        persistEditedRows([edit]);
        return next;
      });
    }
    toast.success('Record deleted', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  }, [data, manualEditsRef, persistEditedRows, setData, setManualEdits]);

  const quickUpdateBillingCycle = useCallback((row, nextCycle) => {
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const normalizedNextCycle = normalizeBillingCycle(nextCycle);

    setData((prev) => {
      const changed = [];
      const activityEntries = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

        const updatedRow = {
          ...item,
          billingCycle: normalizedNextCycle
        };
        changed.push(updatedRow);
        activityEntries.push(...buildFieldChangeActivityEntries({
          user,
          previousRow: item,
          nextRow: updatedRow
        }));
        return updatedRow;
      });
      persistEditedRows(changed);
      recordActivityEntries(activityEntries);
      return next;
    });

    toast.success('Billing cycle updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  }, [buildFieldChangeActivityEntries, persistEditedRows, recordActivityEntries, setData, user]);

  const quickUpdatePaymentStatus = useCallback((row, nextStatus) => {
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const normalizedStatus = String(nextStatus || '').toLowerCase();

    setData((prev) => {
      const changed = [];
      const activityEntries = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

        const updatedRow = {
          ...item,
          status: normalizedStatus
        };
        changed.push(updatedRow);
        activityEntries.push(...buildFieldChangeActivityEntries({
          user,
          previousRow: item,
          nextRow: updatedRow
        }));
        return updatedRow;
      });
      persistEditedRows(changed);
      recordActivityEntries(activityEntries);
      return next;
    });

    toast.success('Payment status updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  }, [buildFieldChangeActivityEntries, persistEditedRows, recordActivityEntries, setData, user]);

  const quickUpdateTotalDue = useCallback((row, nextAmount) => {
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const parsedAmount = roundMoney(nextAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

    setData((prev) => {
      const changed = [];
      const activityEntries = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

        const updatedRow = {
          ...item,
          amount: parsedAmount
        };
        changed.push(updatedRow);
        activityEntries.push(...buildFieldChangeActivityEntries({
          user,
          previousRow: item,
          nextRow: updatedRow
        }));
        return updatedRow;
      });
      persistEditedRows(changed);
      recordActivityEntries(activityEntries);
      return next;
    });

    toast.success('Total due updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  }, [buildFieldChangeActivityEntries, persistEditedRows, recordActivityEntries, setData, user]);

  return {
    handleDeleteDebtor,
    handleResetDebtor,
    handleSaveDebtor,
    openCompanyProfile,
    quickUpdateBillingCycle,
    quickUpdatePaymentStatus,
    quickUpdateTotalDue
  };
};
