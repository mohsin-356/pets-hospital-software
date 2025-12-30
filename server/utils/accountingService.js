import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import DaySession from '../models/DaySession.js';

// Basic chart of accounts seed (idempotent)
export const ensureDefaultAccounts = async () => {
  const defaults = [
    { code: '1001', name: 'Cash in Hand', type: 'asset', subType: 'cash', portal: 'global' },
    { code: '1002', name: 'Bank', type: 'asset', subType: 'bank', portal: 'global' },
    { code: '1100', name: 'Accounts Receivable', type: 'asset', subType: 'receivable', portal: 'global' },
    { code: '1110', name: 'Staff Advances', type: 'asset', subType: 'other_receivable', portal: 'global' },
    { code: '1200', name: 'Hospital Inventory', type: 'asset', subType: 'inventory', portal: 'admin' },
    { code: '1210', name: 'Pharmacy Inventory', type: 'asset', subType: 'inventory', portal: 'pharmacy' },
    { code: '1220', name: 'Lab Inventory', type: 'asset', subType: 'inventory', portal: 'lab' },
    { code: '1230', name: 'Pet Shop Inventory', type: 'asset', subType: 'inventory', portal: 'shop' },
    { code: '2001', name: 'Supplier Payables - Hospital', type: 'liability', subType: 'payable', portal: 'admin' },
    { code: '2010', name: 'Supplier Payables - Pharmacy', type: 'liability', subType: 'payable', portal: 'pharmacy' },
    { code: '2020', name: 'Supplier Payables - Lab', type: 'liability', subType: 'payable', portal: 'lab' },
    { code: '2030', name: 'Supplier Payables - Pet Shop', type: 'liability', subType: 'payable', portal: 'shop' },
    { code: '3000', name: "Owner's Equity", type: 'equity', portal: 'global' },
    { code: '4001', name: 'Consultation Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4002', name: 'Registration Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4003', name: 'Procedure Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4100', name: 'Pharmacy Sales Revenue', type: 'income', portal: 'pharmacy' },
    { code: '4200', name: 'Lab Test Revenue', type: 'income', portal: 'lab' },
    { code: '4300', name: 'Pet Shop Sales Revenue', type: 'income', portal: 'shop' },
    { code: '4099', name: 'Other Income', type: 'income', portal: 'global' },
    { code: '5100', name: 'COGS - Pharmacy', type: 'expense', subType: 'cogs', portal: 'pharmacy' },
    { code: '5200', name: 'COGS - Lab', type: 'expense', subType: 'cogs', portal: 'lab' },
    { code: '5300', name: 'COGS - Pet Shop', type: 'expense', subType: 'cogs', portal: 'shop' },
    { code: '5900', name: 'Admin Expenses', type: 'expense', portal: 'admin' },
    { code: '5910', name: 'Travel Expense', type: 'expense', portal: 'global' },
    { code: '5920', name: 'Food Expense', type: 'expense', portal: 'global' },
    { code: '5990', name: 'Misc Expense', type: 'expense', portal: 'global' },
    { code: '5999', name: 'General Expense', type: 'expense', portal: 'global' },
  ];

  for (const acc of defaults) {
    await Account.updateOne({ code: acc.code }, { $setOnInsert: acc }, { upsert: true });
  }
};

export const postInventoryPurchase = async (item) => {
  if (!item) return null;
  const qty = Number(item.quantity || 0);
  const unitPrice = Number(item.price || item.purchasePrice || 0);
  const amount = qty * unitPrice;
  if (!amount) return null;

  const portal = item.department || 'admin';
  // Map department to inventory and payable accounts
  const inventoryAccount = portal === 'lab' ? '1220' : portal === 'shop' ? '1230' : '1200';
  const payableAccount = portal === 'lab' ? '2020' : portal === 'shop' ? '2030' : '2001';

  // If supplier provided, credit payable; else assume cash
  const creditLines = item.supplier && String(item.supplier).trim() ?
    [{ accountCode: payableAccount, debit: 0, credit: amount }] :
    [{ accountCode: '1001', debit: 0, credit: amount }];

  const description = `Inventory purchase ${item.itemName || item.name || ''}`.trim();
  const meta = {
    supplierId: item.supplier || undefined,
    portalRef: String(item.id || item._id || ''),
    extra: {
      itemName: item.itemName || item.name,
      quantity: qty,
      unitPrice,
    },
  };

  return postEntry({
    date: item.purchaseDate || item.createdAt || new Date(),
    portal,
    sourceType: 'inventory_purchase',
    sourceId: String(item.id || item._id || ''),
    description,
    meta,
    lines: [
      { accountCode: inventoryAccount, debit: amount, credit: 0 },
      ...creditLines,
    ],
  });
};

export const getBalanceSheet = async ({ from, to, portal }) => {
  // as-of balance by account type; include retained earnings (net income) for the period [from,to]
  const asOfMatch = {};
  if (to) {
    asOfMatch.date = { $lte: new Date(new Date(to).setHours(23,59,59,999)) };
  }
  if (portal && portal !== 'all') asOfMatch.portal = portal;

  const agg = await JournalEntry.aggregate([
    { $match: asOfMatch },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const accounts = await Account.find({ code: { $in: agg.map(a => a._id) } }).lean();
  const amap = Object.fromEntries(accounts.map(a => [a.code, a]));

  const byType = { asset: [], liability: [], equity: [] };
  for (const a of agg) {
    const acc = amap[a._id];
    if (!acc) continue;
    const bal = (a.debit || 0) - (a.credit || 0);
    if (acc.type === 'asset') byType.asset.push({ code: a._id, name: acc.name, balance: bal });
    if (acc.type === 'liability') byType.liability.push({ code: a._id, name: acc.name, balance: (a.credit || 0) - (a.debit || 0) });
    if (acc.type === 'equity') byType.equity.push({ code: a._id, name: acc.name, balance: (a.credit || 0) - (a.debit || 0) });
  }

  // Net income for period (defaults to all-time if from not provided)
  const isReport = await getIncomeStatement({ from, to, portal });
  const retained = isReport.netProfit || 0;

  const totalAssets = byType.asset.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = byType.liability.reduce((s, r) => s + r.balance, 0);
  const totalEquityBase = byType.equity.reduce((s, r) => s + r.balance, 0);
  const totalEquity = totalEquityBase + retained;

  return {
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      liabilitiesAndEquity: totalLiabilities + totalEquity,
      retainedEarnings: retained,
    },
    assets: byType.asset,
    liabilities: byType.liability,
    equity: byType.equity,
  };
};

export const getCashFlow = async ({ from, to, portal }) => {
  // Direct method: net movement on Cash (1001) and Bank (1002)
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const cashCodes = ['1001', '1002'];
  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    { $match: { 'lines.accountCode': { $in: cashCodes } } },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const detail = rows.map(r => ({ accountCode: r._id, debit: r.debit || 0, credit: r.credit || 0 }));
  const totalDebit = detail.reduce((s, r) => s + r.debit, 0);
  const totalCredit = detail.reduce((s, r) => s + r.credit, 0);
  const cashIn = Math.max(0, totalDebit - 0);
  const cashOut = Math.max(0, totalCredit - 0);
  const netChange = totalDebit - totalCredit;

  return { cashIn, cashOut, netChange, lines: detail };
};

const resolveCashAccount = (paymentMethod) => {
  const pm = (paymentMethod || '').toLowerCase();
  if (pm.includes('bank') || pm.includes('card') || pm.includes('online')) return '1002';
  return '1001';
};

export const getPayableAccountForPortal = (portal) => {
  if (portal === 'pharmacy') return '2010';
  if (portal === 'lab') return '2020';
  if (portal === 'shop') return '2030';
  return '2001'; // admin/hospital
};

export const postEntry = async ({ date = new Date(), portal = 'system', sourceType, sourceId, description = '', lines, meta = {} }) => {
  if (!lines || !lines.length) {
    throw new Error('Journal entry must have at least one line');
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Journal entry not balanced (debits != credits)');
  }

  // Link to DaySession if available
  const dayDate = new Date(date).toISOString().slice(0,10);
  let sessionId = undefined;
  try {
    if (portal && portal !== 'system') {
      const session = await DaySession.findOne({ portal, date: dayDate });
      if (session) sessionId = session._id;
    }
  } catch {}

  const entry = new JournalEntry({ date, dayDate, sessionId, portal, sourceType, sourceId, description, lines, meta });
  await entry.save();
  return entry;
};

// Helper: convert a Financial record (generic income/expense) into a journal entry
export const postFinancialRecord = async (financial) => {
  if (!financial) return null;
  const { id, type, category, amount, date, paymentMethod, petId, petName, ownerName } = financial;
  const amt = Number(amount || 0);
  if (!amt) return null;

  const cat = (category || '').toLowerCase();
  const isIncome = type === 'Income';

  // Map payment method to cash/bank account
  const cashAccount = resolveCashAccount(paymentMethod);

  let accountCode;
  if (isIncome) {
    if (cat.includes('consult')) accountCode = '4001';
    else if (cat.includes('register')) accountCode = '4002';
    else if (cat.includes('procedure')) accountCode = '4003';
    else accountCode = '4099';
  } else {
    // Expense side - basic mapping, otherwise General Expense
    if (cat.includes('salary') || cat.includes('payroll')) accountCode = '5900';
    else if (cat.includes('rent')) accountCode = '5900';
    else if (cat.includes('electric') || cat.includes('utility')) accountCode = '5900';
    else accountCode = '5999';
  }

  const description = `${type} - ${category}`;
  const portal = financial.portal || 'admin';
  const meta = {
    patientId: petId || undefined,
    petId: petId || undefined,
    clientId: ownerName || undefined,
    portalRef: id,
    extra: { petName, ownerName, paymentMethod },
  };

  if (isIncome) {
    // Debit Cash, Credit Income
    return postEntry({
      date,
      portal,
      sourceType: 'financial_income',
      sourceId: id,
      description,
      meta,
      lines: [
        { accountCode: cashAccount, debit: amt, credit: 0 },
        { accountCode, debit: 0, credit: amt },
      ],
    });
  }

  // Expense: Debit Expense, Credit Cash
  return postEntry({
    date,
    portal,
    sourceType: 'financial_expense',
    sourceId: id,
    description,
    meta,
    lines: [
      { accountCode, debit: amt, credit: 0 },
      { accountCode: cashAccount, debit: 0, credit: amt },
    ],
  });
};

export const postReceptionProcedure = async (record) => {
  if (!record) return null;
  const subtotal = Number(record.subtotal || 0);
  const receivedAmount = Number(record.receivedAmount || 0);
  if (!subtotal) return null;

  const cashPortion = Math.max(0, Math.min(receivedAmount, subtotal));
  const receivableCurrent = Math.max(0, subtotal - cashPortion);

  if (!cashPortion && !receivableCurrent) return null;

  const description = `Reception procedures for ${record.petName || ''}`.trim();
  const portal = 'reception';
  const cashAccount = resolveCashAccount(record.paymentMethod || 'Cash');
  const meta = {
    patientId: record.petId || undefined,
    petId: record.petId || undefined,
    clientId: record.clientId || undefined,
    portalRef: String(record._id || ''),
    extra: {
      petName: record.petName,
      ownerName: record.ownerName,
      contact: record.contact,
      previousDues: record.previousDues,
      grandTotal: record.grandTotal,
      receivable: record.receivable,
    },
  };

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }
  lines.push({ accountCode: '4003', debit: 0, credit: subtotal });

  return postEntry({
    date: record.createdAt || new Date(),
    portal,
    sourceType: 'reception_procedure',
    sourceId: String(record._id || ''),
    description,
    meta,
    lines,
  });
};

export const postShopSale = async (sale) => {
  if (!sale) return null;
  const totalAmount = Number(sale.totalAmount || 0);
  if (!totalAmount) return null;

  const receivedAmount = Number(sale.receivedAmount || 0);
  const cashAccount = resolveCashAccount(sale.paymentMethod);

  const cashPortion = Math.max(0, Math.min(receivedAmount, totalAmount));
  const receivableCurrent = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }

  // Revenue - Pet Shop Sales
  lines.push({ accountCode: '4300', debit: 0, credit: totalAmount });

  // COGS and Inventory, if we have cost info
  const totalCost = Number(sale.totalCost || 0);
  if (totalCost > 0) {
    lines.push({ accountCode: '5300', debit: totalCost, credit: 0 });
    lines.push({ accountCode: '1230', debit: 0, credit: totalCost });
  }

  const description = `Shop sale ${sale.invoiceNumber || ''}`.trim();
  const meta = {
    customerId: sale.customerId || undefined,
    portalRef: String(sale._id || ''),
    extra: {
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      previousDue: sale.previousDue,
      balanceDue: sale.balanceDue,
      paymentMethod: sale.paymentMethod,
    },
  };

  return postEntry({
    date: sale.createdAt || new Date(),
    portal: 'shop',
    sourceType: 'shop_sale',
    sourceId: String(sale._id || ''),
    description,
    meta,
    lines,
  });
};

export const postLabReport = async (report) => {
  if (!report) return null;
  const amount = Number(report.amount || 0);
  if (!amount) return null;

  const isPaid = report.paymentStatus === 'Paid';

  const lines = [];
  if (isPaid) {
    // Paid: Debit Cash
    lines.push({ accountCode: '1001', debit: amount, credit: 0 });
  } else {
    // Pending: Debit Accounts Receivable
    lines.push({ accountCode: '1100', debit: amount, credit: 0 });
  }

  // Credit Lab Test Revenue
  lines.push({ accountCode: '4200', debit: 0, credit: amount });

  const description = `Lab report ${report.reportNumber || ''}`.trim();
  const meta = {
    patientId: report.petId || undefined,
    petId: report.petId || undefined,
    clientId: report.ownerName || undefined,
    portalRef: report.id || undefined,
    extra: {
      petName: report.petName,
      ownerName: report.ownerName,
      testCategory: report.testCategory,
      testType: report.testType,
      paymentStatus: report.paymentStatus,
    },
  };

  return postEntry({
    date: report.reportDate || report.createdAt || new Date(),
    portal: 'lab',
    sourceType: 'lab_report',
    sourceId: report.id || String(report._id || ''),
    description,
    meta,
    lines,
  });
};

export const postPharmacySale = async (sale) => {
  if (!sale) return null;
  const totalAmount = Number(sale.totalAmount || 0);
  if (!totalAmount) return null;

  const receivedAmount = Number(sale.receivedAmount || 0);
  const cashAccount = resolveCashAccount(sale.paymentMethod);

  const cashPortion = Math.max(0, Math.min(receivedAmount, totalAmount));
  const receivableCurrent = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }

  // Revenue
  lines.push({ accountCode: '4100', debit: 0, credit: totalAmount });

  // COGS and Inventory, if we have cost info
  const totalCost = Number(sale.totalCost || 0);
  if (totalCost > 0) {
    lines.push({ accountCode: '5100', debit: totalCost, credit: 0 });
    lines.push({ accountCode: '1210', debit: 0, credit: totalCost });
  }

  const description = `Pharmacy sale ${sale.invoiceNumber || ''}`.trim();
  const meta = {
    patientId: sale.patientId || undefined,
    petId: sale.patientId || undefined,
    clientId: sale.clientId || undefined,
    customerId: sale.clientId || undefined,
    portalRef: String(sale._id || ''),
    extra: {
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      previousDue: sale.previousDue,
      dueAmount: sale.dueAmount,
      newTotalDue: sale.newTotalDue,
      paymentMethod: sale.paymentMethod,
    },
  };

  return postEntry({
    date: sale.createdAt || new Date(),
    portal: 'pharmacy',
    sourceType: 'pharmacy_sale',
    sourceId: String(sale._id || ''),
    description,
    meta,
    lines,
  });
};

// Simple aggregations
export const getTrialBalance = async ({ from, to, portal }) => {
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const entries = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const accounts = await Account.find({ code: { $in: entries.map(e => e._id) } }).lean();
  const map = Object.fromEntries(accounts.map(a => [a.code, a]));

  return entries.map(e => ({
    code: e._id,
    name: map[e._id]?.name || e._id,
    type: map[e._id]?.type || null,
    debit: e.debit,
    credit: e.credit,
  }));
};

export const getIncomeStatement = async ({ from, to, portal }) => {
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const pipeline = [
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ];

  const aggregates = await JournalEntry.aggregate(pipeline);
  const accounts = await Account.find({ code: { $in: aggregates.map(a => a._id) } }).lean();
  const map = Object.fromEntries(accounts.map(a => [a.code, a]));

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalExpenses = 0;

  const details = aggregates.map(a => {
    const acc = map[a._id];
    const type = acc?.type;
    const balance = (a.debit || 0) - (a.credit || 0);
    if (type === 'income') {
      totalRevenue += -balance; // income normally credit
    } else if (type === 'expense' && acc?.subType === 'cogs') {
      totalCOGS += balance;
    } else if (type === 'expense') {
      totalExpenses += balance;
    }
    return { code: a._id, name: acc?.name || a._id, type, debit: a.debit, credit: a.credit };
  });

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  return { totalRevenue, totalCOGS, totalExpenses, grossProfit, netProfit, lines: details };
};

export const postPharmacyPurchase = async (purchase) => {
  if (!purchase) return null;
  const totalAmount = Number(purchase.totalAmount || 0);
  if (!totalAmount) return null;

  const paid = Number(purchase.amountPaid || 0);
  const cashPortion = Math.max(0, Math.min(paid, totalAmount));
  const payablePortion = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    // Cash/Bank out
    lines.push({ accountCode: '1001', debit: 0, credit: cashPortion });
  }
  if (payablePortion) {
    // Supplier Payable - Pharmacy
    lines.push({ accountCode: '2010', debit: 0, credit: payablePortion });
  }

  // Inventory in (Pharmacy Inventory)
  lines.push({ accountCode: '1210', debit: totalAmount, credit: 0 });

  const description = `Pharmacy purchase ${purchase.purchaseOrderNo || ''}`.trim();
  const meta = {
    supplierId: purchase.supplierName || undefined,
    portalRef: String(purchase._id || ''),
    extra: {
      supplierName: purchase.supplierName,
      supplierContact: purchase.supplierContact,
      invoiceNo: purchase.invoiceNo,
      paymentStatus: purchase.paymentStatus,
    },
  };

  return postEntry({
    date: purchase.purchaseDate || purchase.createdAt || new Date(),
    portal: 'pharmacy',
    sourceType: 'pharmacy_purchase',
    sourceId: String(purchase._id || ''),
    description,
    meta,
    lines,
  });
};

export const getGeneralLedger = async ({ accountCode, from, to, portal }) => {
  if (!accountCode) return [];
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const pipeline = [
    { $match: match },
    { $unwind: '$lines' },
    { $match: { 'lines.accountCode': accountCode } },
    { $sort: { date: 1, _id: 1 } },
  ];

  const entries = await JournalEntry.aggregate(pipeline);

  let runningDebit = 0;
  let runningCredit = 0;

  return entries.map(e => {
    runningDebit += e.lines.debit || 0;
    runningCredit += e.lines.credit || 0;
    return {
      date: e.date,
      portal: e.portal,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      description: e.description,
      debit: e.lines.debit || 0,
      credit: e.lines.credit || 0,
      runningDebit,
      runningCredit,
    };
  });
};

export const getPartyLedger = async ({ partyType, partyId, from, to, portal }) => {
  if (!partyId) return [];

  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const metaField =
    partyType === 'supplier' ? 'meta.supplierId' :
    partyType === 'customer' ? 'meta.customerId' :
    partyType === 'patient' ? 'meta.patientId' : null;

  if (!metaField) return [];

  const pipeline = [
    { $match: match },
    { $sort: { date: 1, _id: 1 } },
  ];

  const entries = await JournalEntry.aggregate(pipeline);

  let runningBalance = 0;

  return entries
    .filter(e => {
      const v = e.meta && e.meta[metaField.split('.').pop()];
      return v === partyId;
    })
    .map(e => {
      const debit = (e.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
      const credit = (e.lines || []).reduce((s, l) => s + (l.credit || 0), 0);
      runningBalance += debit - credit;
      return {
        date: e.date,
        portal: e.portal,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        description: e.description,
        debit,
        credit,
        balance: runningBalance,
      };
    });
};

export default {
  ensureDefaultAccounts,
  postEntry,
  getTrialBalance,
  getIncomeStatement,
  postFinancialRecord,
  postReceptionProcedure,
  postPharmacySale,
  postLabReport,
  postShopSale,
  postPharmacyPurchase,
  postInventoryPurchase,
  getGeneralLedger,
  getPartyLedger,
  getBalanceSheet,
  getCashFlow,
};
