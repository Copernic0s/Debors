import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Building2, CirclePlus, Pencil, Search } from 'lucide-react';
import { BILLING_CYCLE_OPTIONS, BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';
import { getPortfolioOverridesStateKey, loadSharedState, saveSharedState } from '../services/sharedAppState';

const STORAGE_KEY = 'debors-portfolio-company-overrides-v1';

const normalizeCompanyKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const normalizeEmailKey = (value) => String(value || '').trim().toLowerCase();

const readOverrides = (email) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const scoped = parsed?.[normalizeEmailKey(email)];
    return Array.isArray(scoped) ? scoped : [];
  } catch {
    return [];
  }
};

const writeOverrides = (email, rows) => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[normalizeEmailKey(email)] = rows;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // swallow local-only persistence errors
  }
};

const getStatusMeta = (status) => {
  const tone = String(status || '').toLowerCase();
  if (tone === 'overdue') return { label: 'Overdue', color: 'var(--danger)', bg: 'rgba(248, 113, 113, 0.12)' };
  if (tone === 'pending') return { label: 'Pending', color: 'var(--warn)', bg: 'rgba(245, 158, 11, 0.12)' };
  if (tone === 'paid') return { label: 'Paid', color: 'var(--ok)', bg: 'rgba(16, 185, 129, 0.12)' };
  if (tone === 'inactive') return { label: 'Inactive', color: 'var(--bronze)', bg: 'rgba(217, 119, 6, 0.12)' };
  return { label: 'Awaiting invoice', color: 'var(--violet)', bg: 'rgba(167, 139, 250, 0.12)' };
};

const getStrongestStatus = (rows) => {
  const priorities = ['overdue', 'pending', 'paid', 'inactive', 'no_invoice'];
  const normalized = rows.map((row) => String(row.status || '').toLowerCase());
  return priorities.find((status) => normalized.includes(status)) || 'no_invoice';
};

const mergePortfolioRows = (baseRows, overrideRows) => {
  const merged = new Map();

  baseRows.forEach((row) => {
    const key = normalizeCompanyKey(row.company);
    if (!key) return;
    merged.set(key, { ...row });
  });

  overrideRows.forEach((row) => {
    const key = normalizeCompanyKey(row.company);
    if (!key) return;
    merged.set(key, {
      ...(merged.get(key) || {}),
      ...row,
      source: row.source || 'manual'
    });
  });

  return Array.from(merged.values()).sort((a, b) =>
    String(a.company || '').localeCompare(String(b.company || ''))
  );
};

const Wrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.4rem;
  flex-wrap: wrap;
`;

const TitleBlock = styled.div`
  h2 {
    font-size: 1.875rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-main);
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.8rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  position: relative;

  input {
    width: 280px;
    max-width: 80vw;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    padding: 0.72rem 1rem 0.72rem 2.7rem;
    color: var(--text-main);
    font-size: 0.9rem;
  }

  svg {
    position: absolute;
    left: 0.95rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid rgba(249, 115, 22, 0.3);
  background: rgba(249, 115, 22, 0.14);
  color: var(--brand);
  border-radius: 14px;
  padding: 0.72rem 1rem;
  cursor: pointer;
  font-weight: 700;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1.35rem;

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryCard = styled.div`
  padding: 1.1rem 1.15rem;
  border-radius: 20px;
  background: rgba(8, 18, 34, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.04);

  .label {
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .value {
    display: block;
    margin-top: 0.55rem;
    color: var(--text-main);
    font-size: 1.8rem;
    font-weight: 800;
  }
`;

const TableWrap = styled.div`
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(8, 18, 34, 0.35);
  padding: 1.2rem;
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 0.95rem 0.8rem;
  text-align: left;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const Td = styled.td`
  padding: 1rem 0.8rem;
  color: var(--text-main);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.9rem;
  vertical-align: middle;
`;

const CompanyCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;

  strong {
    font-size: 0.98rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 128px;
  padding: 0.42rem 0.8rem;
  border-radius: 999px;
  background: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  font-size: 0.78rem;
  font-weight: 800;
  border: 1px solid ${(props) => `${props.$color}33`};
`;

const SourcePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  background: ${(props) => (props.$manual ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.05)')};
  color: ${(props) => (props.$manual ? 'var(--brand-cyan)' : 'var(--text-muted)')};
  border: 1px solid ${(props) => (props.$manual ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.08)')};
`;

const EditButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const EmptyState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-muted);
`;

const FooterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  gap: 1rem;
`;

const Pager = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
`;

const PagerButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: var(--text-main);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(4, 10, 20, 0.72);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 1rem;
`;

const Modal = styled.div`
  width: min(520px, 100%);
  border-radius: 22px;
  background: rgba(10, 18, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1.4rem;
`;

const ModalHeader = styled.div`
  margin-bottom: 1rem;

  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: 1.15rem;
  }
`;

const FieldGrid = styled.div`
  display: grid;
  gap: 0.9rem;
`;

const Field = styled.label`
  display: grid;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.82rem;

  input,
  select {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.78rem 0.9rem;
    color: var(--text-main);
  }

  option {
    background: #0f172a;
    color: var(--text-main);
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.2rem;
`;

const GhostButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: var(--text-muted);
  border-radius: 12px;
  padding: 0.72rem 1rem;
  cursor: pointer;
`;

export default function PortfolioCompanies({ companies, debtRows, currentUserEmail }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [overrides, setOverrides] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    setOverrides(readOverrides(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    if (!currentUserEmail) return;

    let isActive = true;

    const hydrateOverrides = async () => {
      const fallbackRows = readOverrides(currentUserEmail);
      const sharedRows = await loadSharedState(
        getPortfolioOverridesStateKey(currentUserEmail),
        fallbackRows
      );

      if (isActive && Array.isArray(sharedRows)) {
        setOverrides(sharedRows);
        writeOverrides(currentUserEmail, sharedRows);
      }
    };

    hydrateOverrides();

    return () => {
      isActive = false;
    };
  }, [currentUserEmail]);

  const baseCompanies = useMemo(
    () =>
      (Array.isArray(companies) ? companies : [])
        .filter((item) => String(item.company || '').trim())
        .map((item) => ({
          id: `zoho-${normalizeCompanyKey(item.company)}-${normalizeCompanyKey(item.agentId)}`,
          company: String(item.company || '').trim(),
          agentId: String(item.agentId || '').trim(),
          billingCycle: normalizeBillingCycle(item.billingCycle),
          source: 'zoho'
        })),
    [companies]
  );

  const rows = useMemo(() => {
    const merged = mergePortfolioRows(baseCompanies, overrides);
    return merged.map((item) => {
      const relatedDebtRows = (Array.isArray(debtRows) ? debtRows : []).filter(
        (row) => normalizeCompanyKey(row.company || row.clientName) === normalizeCompanyKey(item.company) && row.invoiceNumber !== 'Marked as Sent'
      );

      const strongestStatus = relatedDebtRows.length > 0 ? getStrongestStatus(relatedDebtRows) : 'no_invoice';
      const latestWeek = relatedDebtRows
        .map((row) => String(row.weekLabel || '').trim())
        .filter(Boolean)
        .sort()
        .at(-1) || '';

      return {
        ...item,
        rosterStatus: strongestStatus,
        latestWeek,
        invoiceCount: relatedDebtRows.filter((row) => String(row.invoiceNumber || '').trim()).length
      };
    });
  }, [baseCompanies, overrides, debtRows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((item) => {
      const hay = `${item.company} ${item.agentId} ${item.billingCycle}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((item) => ['overdue', 'pending'].includes(item.rosterStatus)).length,
      awaiting: rows.filter((item) => item.rosterStatus === 'no_invoice').length,
      paid: rows.filter((item) => item.rosterStatus === 'paid').length
    };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages) || 1;
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openCreate = () => {
    setDraft({
      id: `manual-${Date.now()}`,
      company: '',
      agentId: String(companies?.[0]?.agentId || '').trim(),
      billingCycle: BILLING_CYCLES.UNSPECIFIED,
      source: 'manual'
    });
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setDraft({
      id: item.id,
      company: item.company,
      agentId: item.agentId,
      billingCycle: normalizeBillingCycle(item.billingCycle),
      source: item.source || 'manual'
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setDraft(null);
    setIsModalOpen(false);
  };

  const saveDraft = () => {
    if (!draft?.company?.trim()) return;
    const next = [...overrides];
    const key = normalizeCompanyKey(draft.company);
    const existingIndex = next.findIndex((item) => normalizeCompanyKey(item.company) === key || item.id === draft.id);

    const payload = {
      ...draft,
      company: draft.company.trim(),
      agentId: draft.agentId.trim(),
      billingCycle: normalizeBillingCycle(draft.billingCycle),
      source: 'manual'
    };

    if (existingIndex >= 0) {
      next[existingIndex] = payload;
    } else {
      next.push(payload);
    }

    setOverrides(next);
    writeOverrides(currentUserEmail, next);
    saveSharedState(getPortfolioOverridesStateKey(currentUserEmail), next, currentUserEmail || null);
    closeModal();
  };

  return (
    <Wrapper>
      <Header>
        <TitleBlock>
          <h2>Portfolio Companies</h2>
        </TitleBlock>
        <HeaderActions>
          <SearchBox>
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search company or cycle..."
            />
          </SearchBox>
          <PrimaryButton type="button" onClick={openCreate}>
            <CirclePlus size={16} />
            Add company
          </PrimaryButton>
        </HeaderActions>
      </Header>

      <SummaryGrid>
        <SummaryCard><span className="label">Total companies</span><span className="value">{summary.total}</span></SummaryCard>
        <SummaryCard><span className="label">Active debt</span><span className="value">{summary.active}</span></SummaryCard>
        <SummaryCard><span className="label">Awaiting invoice</span><span className="value">{summary.awaiting}</span></SummaryCard>
        <SummaryCard><span className="label">Paid / clear</span><span className="value">{summary.paid}</span></SummaryCard>
      </SummaryGrid>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Sales Rep</Th>
              <Th>Billing Cycle</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length > 0 ? paginatedRows.map((item) => {
              const meta = getStatusMeta(item.rosterStatus);
              return (
                <tr key={item.id}>
                  <Td>
                    <CompanyCell>
                      <strong>{item.company}</strong>
                      <span>{item.invoiceCount > 0 ? `${item.invoiceCount} invoice records` : 'No invoice records yet'}</span>
                    </CompanyCell>
                  </Td>
                  <Td>{item.agentId || 'Unassigned'}</Td>
                  <Td>{normalizeBillingCycle(item.billingCycle)}</Td>
                  <Td>
                    <EditButton type="button" onClick={() => openEdit(item)} title="Edit company">
                      <Pencil size={14} />
                    </EditButton>
                  </Td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="4">
                  <EmptyState>
                    <Building2 size={56} />
                    <h3 style={{ color: 'var(--text-main)' }}>No companies found</h3>
                  </EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        <FooterBar>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Showing {(safePage - 1) * pageSize + (paginatedRows.length ? 1 : 0)}-{(safePage - 1) * pageSize + paginatedRows.length} of {filteredRows.length}
          </span>
          <Pager>
            <PagerButton type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</PagerButton>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Page {safePage} / {totalPages}</span>
            <PagerButton type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</PagerButton>
          </Pager>
        </FooterBar>
      </TableWrap>

      {isModalOpen && draft && (
        <Overlay onClick={closeModal}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <h3>{draft.source === 'manual' && !rows.some((item) => item.id === draft.id) ? 'Add company' : 'Edit company'}</h3>
            </ModalHeader>
            <FieldGrid>
              <Field>
                Company
                <input
                  type="text"
                  value={draft.company}
                  onChange={(event) => setDraft((prev) => ({ ...prev, company: event.target.value }))}
                />
              </Field>
              <Field>
                Sales Rep
                <input
                  type="text"
                  value={draft.agentId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, agentId: event.target.value }))}
                />
              </Field>
              <Field>
                Billing Cycle
                <select
                  value={draft.billingCycle}
                  onChange={(event) => setDraft((prev) => ({ ...prev, billingCycle: event.target.value }))}
                >
                  {BILLING_CYCLE_OPTIONS.map((cycle) => (
                    <option key={cycle} value={cycle}>{cycle}</option>
                  ))}
                </select>
              </Field>
            </FieldGrid>
            <ModalActions>
              <GhostButton type="button" onClick={closeModal}>Cancel</GhostButton>
              <PrimaryButton type="button" onClick={saveDraft}>Save</PrimaryButton>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </Wrapper>
  );
}
