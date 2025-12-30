import express from 'express';
import VendorPayment from '../models/VendorPayment.js';
import Payable from '../models/Payable.js';
import DailyLog from '../models/DailyLog.js';
import { getPayableAccountForPortal, postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';

const router = express.Router();

// List vendor payments
router.get('/', async (req, res, next) => {
  try {
    const { portal, from, to } = req.query;
    const q = {};
    if (portal && portal !== 'all') q.portal = portal;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) q.date.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    const rows = await VendorPayment.find(q).sort({ date: -1 });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// Backfill: create VendorPayment docs for historical Payable allocations that lack paymentId
router.post('/backfill', async (req, res, next) => {
  try {
    const { portal, from, to } = req.query;
    const inRange = (d) => {
      if (!from && !to) return true;
      const dt = new Date(d || Date.now());
      if (from && dt < new Date(`${from}T00:00:00.000Z`)) return false;
      if (to && dt > new Date(`${to}T23:59:59.999Z`)) return false;
      return true;
    };

    const pFilter = {};
    if (portal && portal !== 'all') pFilter.portal = portal;

    const payables = await Payable.find({
      ...pFilter,
      allocations: { $elemMatch: { sourceType: 'vendor_payment', $or: [{ paymentId: null }, { paymentId: { $exists: false } }] } }
    });

    let created = 0;
    for (const p of payables) {
      let changed = false;
      for (const a of p.allocations) {
        if (a?.sourceType === 'vendor_payment' && !a?.paymentId && inRange(a?.date)) {
          const vp = new VendorPayment({
            portal: p.portal,
            supplierId: p.supplierId,
            supplierName: p.supplierName,
            date: a?.date || new Date(),
            amount: a.amount || 0,
            paymentMethod: 'Cash',
            allocations: [{ payableId: p._id, amount: a.amount || 0 }],
            notes: 'Backfilled from Payable allocation',
          });
          await vp.save();
          a.paymentId = vp._id;
          a.sourceRef = String(vp._id);
          created++;
          changed = true;
        }
      }
      if (changed) await p.save();
    }

    res.json({ success: true, data: { created } });
  } catch (e) { next(e); }
});

// Create vendor payment with allocations
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const { portal, supplierId, supplierName, amount, paymentMethod = 'Cash', allocations = [], notes } = req.body || {};
    const pay = new VendorPayment({ portal, supplierId, supplierName, amount, paymentMethod, allocations, notes });
    await pay.save();

    let remaining = Math.max(0, Number(amount) || 0);
    let allocatedTotal = 0;

    for (const a of allocations) {
      if (!a.payableId) continue;
      const p = await Payable.findById(a.payableId);
      if (!p) continue;
      const allocAmt = Math.min(Math.max(0, Number(a.amount) || 0), p.balance, remaining);
      if (allocAmt <= 0) continue;
      p.balance -= allocAmt;
      p.allocations.push({ paymentId: pay._id, sourceType: 'vendor_payment', sourceRef: String(pay._id), amount: allocAmt, date: pay.date });
      if (p.balance <= 0.0001) { p.balance = 0; p.status = 'closed'; }
      await p.save();
      remaining -= allocAmt;
      allocatedTotal += allocAmt;
    }

    // Journal: DR Payable(s) total, CR Cash/Bank
    const payableAccount = getPayableAccountForPortal(portal || 'admin');
    await postEntry({
      date: pay.date,
      portal: portal || 'admin',
      sourceType: 'vendor_payment',
      sourceId: String(pay._id),
      description: notes || `Vendor payment to ${supplierName || supplierId || ''}`,
      meta: { supplierId, extra: { paymentMethod } },
      lines: [
        { accountCode: payableAccount, debit: allocatedTotal, credit: 0 },
        { accountCode: (paymentMethod || '').toLowerCase().includes('bank') ? '1002' : '1001', debit: 0, credit: allocatedTotal },
      ],
    });

    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: portal || 'admin', sessionId: req.daySession?._id, action: 'vendor_payment_create', refType: 'vendor_payment', refId: String(pay._id), description: `Vendor payment ${allocatedTotal}`, amount: allocatedTotal });

    res.status(201).json({ success: true, data: pay });
  } catch (e) { next(e); }
});

export default router;
