import express from 'express';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import Sale from '../models/Sale.js';
import PharmacySale from '../models/PharmacySale.js';
import PharmacyPurchase from '../models/PharmacyPurchase.js';
import Inventory from '../models/Inventory.js';
import LabReport from '../models/LabReport.js';
import ProcedureRecord from '../models/ProcedureRecord.js';
import Financial from '../models/Financial.js';
import Expense from '../models/Expense.js';
import { ensureDefaultAccounts, getTrialBalance, getIncomeStatement, getGeneralLedger, getPartyLedger, getBalanceSheet, getCashFlow, postShopSale, postPharmacySale, postPharmacyPurchase, postLabReport, postReceptionProcedure, postFinancialRecord, postInventoryPurchase } from '../utils/accountingService.js';

const router = express.Router();

// Ensure default accounts exist before any request
router.use(async (req, res, next) => {
  try {
    await ensureDefaultAccounts();
    next();
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await Account.find().sort({ code: 1 });
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/trial-balance?from=&to=
router.get('/trial-balance', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const rows = await getTrialBalance({ from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/income-statement?from=&to=
router.get('/income-statement', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getIncomeStatement({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/balance-sheet?from=&to=&portal=
router.get('/balance-sheet', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getBalanceSheet({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/cash-flow?from=&to=&portal=
router.get('/cash-flow', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getCashFlow({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/general-ledger/:accountCode
router.get('/general-ledger/:accountCode', async (req, res, next) => {
  try {
    const { accountCode } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getGeneralLedger({ accountCode, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/customer-ledger/:id
router.get('/customer-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'customer', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/supplier-ledger/:id
router.get('/supplier-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'supplier', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/patient-ledger/:id
router.get('/patient-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'patient', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/accounting/sync?from=&to=
// Backfill JournalEntries from existing domain records in the given date range
router.post('/sync', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let start, end;
    if (from) { start = new Date(from); start.setHours(0,0,0,0); }
    if (to) { end = new Date(to); end.setHours(23,59,59,999); }

    const inRange = (field) => (start || end) ? { [field]: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {};

    const summary = { created: 0, skipped: 0, errors: 0, details: [] };

    // Helper to check existence and post
    const ensureEntry = async (sourceType, sourceId, postFn, payload) => {
      try {
        const exists = await JournalEntry.exists({ sourceType, sourceId: String(sourceId) });
        if (exists) { summary.skipped++; return; }
        await postFn(payload);
        summary.created++;
      } catch (e) {
        summary.errors++;
        summary.details.push({ sourceType, sourceId, error: e?.message || String(e) });
      }
    };

    // Shop Sales
    const shopSales = await Sale.find(inRange('createdAt')).lean();
    for (const s of shopSales) {
      await ensureEntry('shop_sale', String(s._id), postShopSale, s);
    }

    // Pharmacy Sales
    const phSales = await PharmacySale.find(inRange('createdAt')).lean();
    for (const s of phSales) {
      await ensureEntry('pharmacy_sale', String(s._id), postPharmacySale, s);
    }

    // Pharmacy Purchases
    const phPurchases = await PharmacyPurchase.find({ $or: [ inRange('purchaseDate'), inRange('createdAt') ] }).lean();
    for (const p of phPurchases) {
      await ensureEntry('pharmacy_purchase', String(p._id), postPharmacyPurchase, p);
    }

    // Lab Reports
    const labReports = await LabReport.find({ $or: [ inRange('reportDate'), inRange('createdAt') ] }).lean();
    for (const r of labReports) {
      const sid = r.id || String(r._id);
      // existence check tries both possible id encodings
      const exists = await JournalEntry.exists({ sourceType: 'lab_report', sourceId: { $in: [sid, String(r._id)] } });
      if (exists) { summary.skipped++; } else {
        await ensureEntry('lab_report', sid, postLabReport, r);
      }
    }

    // Reception Procedures
    const procedures = await ProcedureRecord.find(inRange('createdAt')).lean();
    for (const pr of procedures) {
      await ensureEntry('reception_procedure', String(pr._id), postReceptionProcedure, pr);
    }

    // Financial Records (Income/Expense)
    const financials = await Financial.find(inRange('date')).lean();
    for (const f of financials) {
      const type = f.type === 'Income' ? 'financial_income' : 'financial_expense';
      await ensureEntry(type, f.id || String(f._id), postFinancialRecord, f);
    }

    // Expenses (ensure accounting posted if any missed)
    const expenses = await Expense.find(inRange('date')).lean();
    for (const e of expenses) {
      await ensureEntry('financial_expense', e.id || String(e._id), postFinancialRecord, {
        id: e.id,
        type: 'Expense',
        category: e.category,
        amount: e.amount,
        date: e.date,
        paymentMethod: e.paymentMethod,
        portal: e.portal || 'admin',
      });
    }

    // Inventory Purchases (Admin/Lab/Shop)
    const invFilter = { $and: [
      { $or: [ inRange('purchaseDate'), inRange('createdAt') ] },
      { department: { $in: ['admin','lab','shop'] } },
    ]};
    const invItems = await Inventory.find(invFilter).lean();
    for (const it of invItems) {
      await ensureEntry('inventory_purchase', String(it.id || it._id), postInventoryPurchase, it);
    }

    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
