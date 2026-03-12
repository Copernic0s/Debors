import { format, subDays, addDays } from 'date-fns';

const today = new Date();

export const agents = [
  { id: 1, name: 'Ana Silva', avatar: 'AS' },
  { id: 2, name: 'Carlos Mendoza', avatar: 'CM' },
  { id: 3, name: 'Lucía Pérez', avatar: 'LP' },
  { id: 4, name: 'Roberto Gómez', avatar: 'RG' }
];

export const mockDebtors = [
  {
    id: 'DB-1001',
    clientName: 'TechCorp Solutions',
    amount: 5400.00,
    dueDate: format(subDays(today, 5), 'yyyy-MM-dd'),
    status: 'overdue',
    agentId: 'Guidiana Puentes',
    lastContact: format(subDays(today, 1), 'yyyy-MM-dd'),
    notes: 'Prometió pagar el viernes.'
  },
  {
    id: 'DB-1002',
    clientName: 'María Rodríguez',
    amount: 850.50,
    dueDate: format(addDays(today, 15), 'yyyy-MM-dd'),
    status: 'pending',
    agentId: 'Julian Sandoval',
    lastContact: format(subDays(today, 3), 'yyyy-MM-dd'),
    notes: 'Esperando factura corregida.'
  },
  {
    id: 'DB-1003',
    clientName: 'Comercializadora Zeta',
    amount: 12000.00,
    dueDate: format(subDays(today, 30), 'yyyy-MM-dd'),
    status: 'overdue',
    agentId: 'Julian Sandoval',
    lastContact: format(subDays(today, 10), 'yyyy-MM-dd'),
    notes: 'Pasado a legales.'
  },
  {
    id: 'DB-1004',
    clientName: 'Jorge Alvarenga',
    amount: 420.00,
    dueDate: format(subDays(today, 2), 'yyyy-MM-dd'),
    status: 'paid',
    agentId: 'Guidiana Puentes',
    lastContact: format(today, 'yyyy-MM-dd'),
    notes: 'Pago recibido hoy vía transferencia.'
  },
  {
    id: 'DB-1005',
    clientName: 'Innovia Designs',
    amount: 3200.00,
    dueDate: format(addDays(today, 5), 'yyyy-MM-dd'),
    status: 'pending',
    agentId: 'Julian Sandoval',
    lastContact: format(subDays(today, 4), 'yyyy-MM-dd'),
    notes: 'Revisando cronograma de pagos.'
  },
  {
    id: 'DB-1006',
    clientName: 'Global Logistics',
    amount: 8900.00,
    dueDate: format(subDays(today, 12), 'yyyy-MM-dd'),
    status: 'overdue',
    agentId: 'Guidiana Puentes',
    lastContact: format(subDays(today, 2), 'yyyy-MM-dd'),
    notes: 'Problemas de flujo de caja.'
  },
  {
    id: 'DB-1007',
    clientName: 'Estudio Jurídico Meier',
    amount: 1500.00,
    dueDate: format(addDays(today, 20), 'yyyy-MM-dd'),
    status: 'pending',
    agentId: 'Julian Sandoval',
    lastContact: format(subDays(today, 5), 'yyyy-MM-dd'),
    notes: 'Factura entregada.'
  }
];

const normalizeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDateDiffInDays = (dateValue, referenceDate) => {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((parsed - referenceDate) / 86400000);
};

const normalizeStatus = (status, dueDate, referenceDate) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'paid' || raw === 'pagado' || raw === 'cobrado') return 'paid';
  if (raw === 'overdue' || raw === 'mora' || raw === 'vencido') return 'overdue';

  const diff = getDateDiffInDays(dueDate, referenceDate);
  if (diff !== null && diff < 0) return 'overdue';
  return 'pending';
};

export const calculateMetrics = (data) => {
  const today = getDayStart(new Date());

  let totalDebt = 0;
  let totalOverdue = 0;
  let totalCollected = 0;
  let overdueAccounts = 0;
  let pendingAccounts = 0;

  const activeClients = new Set();

  data.forEach((item) => {
    const amount = normalizeAmount(item.amount);
    const status = normalizeStatus(item.status, item.dueDate, today);

    if (item.clientName) {
      activeClients.add(String(item.clientName).trim().toLowerCase());
    }

    if (status === 'paid') {
      totalCollected += amount;
      return;
    }

    totalDebt += amount;
    pendingAccounts += 1;

    if (status === 'overdue') {
      totalOverdue += amount;
      overdueAccounts += 1;
    }
  });

  const portfolioTotal = totalDebt + totalCollected;
  const collectionRate = portfolioTotal > 0 ? (totalCollected / portfolioTotal) * 100 : 0;

  return {
    totalDebt,
    totalOverdue,
    totalCollected,
    activeClients: activeClients.size,
    overdueAccounts,
    pendingAccounts,
    collectionRate
  };
};
