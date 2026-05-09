import { useMemo } from 'react';
import { calculateMetrics } from '../data/mockData';
import { aggregateByCompany, toComparableDate } from '../services/debtorDataReconciliation';
import { userCanAccessAgent } from '../constants/accessControl';

export const useDerivedDebtorViews = ({
  accessProfile,
  activeCompany,
  clientsByAgent,
  data,
  lastTick,
  matchesSelectedAgent,
  selectedAgent,
  selectedWeek,
  statusScope,
  trackerData
}) => {
  const accessibleData = useMemo(() => {
    if (accessProfile.canViewAllData) return data;
    return data.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [data, accessProfile]);

  const accessibleClientsByAgent = useMemo(() => {
    if (accessProfile.canViewAllData) return clientsByAgent;
    return clientsByAgent.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [clientsByAgent, accessProfile]);

  const accessibleTrackerData = useMemo(() => {
    if (accessProfile.canViewAllData) return trackerData;
    return trackerData.filter((item) => userCanAccessAgent(accessProfile, item.agent || item.agentId));
  }, [trackerData, accessProfile]);

  const agentOptions = useMemo(() => {
    const rosterAgents = Array.from(
      new Set(
        accessibleClientsByAgent
          .map((item) => String(item.agentId || '').trim())
          .filter(Boolean)
      )
    ).sort();

    if (rosterAgents.length > 0) return rosterAgents;

    return Array.from(
      new Set(
        accessibleData
          .map((item) => String(item.agentId || '').trim())
          .filter(Boolean)
      )
    ).sort();
  }, [accessibleClientsByAgent, accessibleData]);

  const hydratedWithSmartStatus = useMemo(() => {
    const today = new Date(lastTick);
    return accessibleData.map((row) => {
      let status = row.status || 'pending';
      let isAutoOverdue = false;

      if (status !== 'paid' && status !== 'no_invoice' && row.dueDate) {
        const dateStr = row.dueDate.includes('T') ? row.dueDate : `${row.dueDate}T17:00:00`;
        const parsedDue = new Date(dateStr);
        if (!Number.isNaN(parsedDue.getTime()) && parsedDue < today) {
          status = 'overdue';
          isAutoOverdue = true;
        }
      }

      return { ...row, status, isAutoOverdue };
    });
  }, [accessibleData, lastTick]);

  const analyticsInvoiceRows = useMemo(
    () =>
      hydratedWithSmartStatus.filter((item) => {
        const matchesAgent = matchesSelectedAgent(item.agentId);
        const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        const status = String(item.status || '').toLowerCase();
        const hasInvoice = Boolean(String(item.invoiceNumber || '').trim()) && item.invoiceNumber !== 'Marked as Sent';
        return matchesAgent && matchesWeek && hasInvoice && ['pending', 'overdue', 'paid'].includes(status);
      }),
    [hydratedWithSmartStatus, matchesSelectedAgent, selectedWeek]
  );

  const analyticsAggregatedRows = useMemo(
    () => aggregateByCompany(analyticsInvoiceRows),
    [analyticsInvoiceRows]
  );

  const currentCycleWeekLabel = useMemo(() => {
    const latestByWeek = new Map();

    hydratedWithSmartStatus.forEach((row) => {
      const status = String(row.status || '').toLowerCase();
      const hasInvoice = Boolean(String(row.invoiceNumber || '').trim()) && row.invoiceNumber !== 'Marked as Sent';
      const weekLabel = String(row.weekLabel || '').trim();
      if (!weekLabel || !hasInvoice || !['pending', 'overdue', 'paid'].includes(status)) return;

      const candidateDate =
        toComparableDate(row.dueDate) ||
        toComparableDate(row.lastInvoicedDate) ||
        toComparableDate(row.updated_at);

      const current = latestByWeek.get(weekLabel);
      if (!current || (candidateDate && candidateDate > current)) {
        latestByWeek.set(weekLabel, candidateDate || new Date(0));
      }
    });

    const sortedWeeks = Array.from(latestByWeek.entries()).sort((a, b) => b[1] - a[1]);
    return sortedWeeks[0]?.[0] || '';
  }, [hydratedWithSmartStatus]);

  const scopedInvoiceData = useMemo(
    () =>
      hydratedWithSmartStatus.filter((item) => {
        const matchesAgent = matchesSelectedAgent(item.agentId);
        const weekLabel = String(item.weekLabel || '').trim();
        const matchesWeek =
          selectedWeek === 'all'
            ? statusScope === 'all'
              ? !currentCycleWeekLabel || weekLabel === currentCycleWeekLabel
              : true
            : weekLabel === selectedWeek;
        const status = String(item.status || '').toLowerCase();
        const isOpen = status === 'pending' || status === 'overdue';
        const matchesStatus =
          statusScope === 'all' ? ['pending', 'overdue', 'paid', 'no_invoice'].includes(status) : isOpen;
        return matchesAgent && matchesWeek && matchesStatus;
      }),
    [hydratedWithSmartStatus, matchesSelectedAgent, selectedWeek, statusScope, currentCycleWeekLabel]
  );

  const aggregatedData = useMemo(() => aggregateByCompany(scopedInvoiceData), [scopedInvoiceData]);
  const agentData = aggregatedData;

  const metrics = useMemo(() => {
    const baseMetrics = calculateMetrics(agentData);

    const clients = new Set();
    accessibleData.forEach((item) => {
      const agentMatch = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
      if (agentMatch && (item.company || item.clientName) && item.invoiceNumber !== 'Marked as Sent') {
        clients.add(String(item.company || item.clientName).trim().toLowerCase());
      }
    });

    return {
      ...baseMetrics,
      activeClients: clients.size
    };
  }, [agentData, accessibleData, selectedAgent]);

  const companyProfile = useMemo(() => {
    if (!activeCompany) return null;

    const scopedRows = accessibleData.filter((item) => {
      const company = String(item.company || item.clientName || '').trim().toLowerCase();
      const byCompany = company === activeCompany.trim().toLowerCase();
      if (!byCompany) return false;
      const byAgent = matchesSelectedAgent(item.agentId);
      const byWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
      return byAgent && byWeek;
    });

    const deduplicatedRows = [];
    const sortedScoped = [...scopedRows].sort((a, b) => {
      if (a.source === 'debt' && b.source !== 'debt') return -1;
      if (a.source !== 'debt' && b.source === 'debt') return 1;
      return 0;
    });

    const seenIds = new Set();
    const seenInvoices = new Set();

    sortedScoped.forEach((row) => {
      const invKey = String(row.invoiceNumber || row.id).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenIds.has(row.id) && !seenInvoices.has(invKey)) {
        deduplicatedRows.push(row);
        seenIds.add(row.id);
        if (row.invoiceNumber) seenInvoices.add(invKey);
      }
    });

    const invoiceRows = deduplicatedRows.filter(
      (item) => !String(item.id || '').startsWith('CS-') && item.invoiceNumber !== 'Marked as Sent'
    );
    const totalDebt = deduplicatedRows
      .filter((item) => String(item.status || '').toLowerCase() !== 'paid')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOverdue = deduplicatedRows
      .filter((item) => String(item.status || '').toLowerCase() === 'overdue')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return {
      company: activeCompany,
      totalDebt,
      totalOverdue,
      invoiceCount: invoiceRows.length,
      agents: Array.from(new Set(deduplicatedRows.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(),
      contacts: Array.from(new Set(deduplicatedRows.map((item) => String(item.contactPerson || '').trim()).filter(Boolean))).sort(),
      invoices: invoiceRows.sort((a, b) => String(a.invoiceNumber || a.id).localeCompare(String(b.invoiceNumber || b.id)))
    };
  }, [activeCompany, accessibleData, matchesSelectedAgent, selectedWeek]);

  return {
    accessibleClientsByAgent,
    accessibleData,
    accessibleTrackerData,
    agentData,
    agentOptions,
    analyticsAggregatedRows,
    analyticsInvoiceRows,
    companyProfile,
    metrics
  };
};
