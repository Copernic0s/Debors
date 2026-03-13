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
    company: 'TechCorp Solutions',
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
    company: 'María Rodríguez',
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
    company: 'Comercializadora Zeta',
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
    company: 'Jorge Alvarenga',
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
    company: 'Innovia Designs',
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
    company: 'Global Logistics',
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
    company: 'Estudio Jurídico Meier',
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

const getCentralTimeNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    dateKey: `${value.year}-${value.month}-${value.day}`,
    hour: Number.parseInt(value.hour || '0', 10),
    minute: Number.parseInt(value.minute || '0', 10)
  };
};

const isPastCutoffInCentral = (dueDate) => {
  if (!dueDate) return false;
  const nowCt = getCentralTimeNow();

  if (nowCt.dateKey > dueDate) return true;
  if (nowCt.dateKey < dueDate) return false;

  if (nowCt.hour > 17) return true;
  if (nowCt.hour < 17) return false;
  return nowCt.minute >= 0;
};

const normalizeStatus = (status, dueDate) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw.includes('paid') || raw.includes('pagado') || raw.includes('cobrado')) return 'paid';
  if (raw.includes('overdue') || raw.includes('mora') || raw.includes('vencido')) return 'overdue';
  if (isPastCutoffInCentral(dueDate)) return 'overdue';
  return 'pending';
};

export const calculateMetrics = (data) => {
  let totalDebt = 0;
  let totalOverdue = 0;
  let totalCollected = 0;
  let currentBalance = 0;
  let pendingAccounts = 0;
  let overdueAccounts = 0;

  const activeClients = new Set();

  data.forEach((item) => {
    const amount = normalizeAmount(item.amount);
    const status = normalizeStatus(item.status, item.dueDate);

    if (item.company || item.clientName) {
      activeClients.add(String(item.company || item.clientName).trim().toLowerCase());
    }

    if (status === 'paid') {
      totalCollected += amount;
      return;
    }

    totalDebt += amount;

    if (status === 'pending') {
      currentBalance += amount;
      pendingAccounts += 1;
    }

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
    currentBalance,
    totalCollected,
    activeClients: activeClients.size,
    pendingAccounts,
    overdueAccounts,
    collectionRate
  };
};
