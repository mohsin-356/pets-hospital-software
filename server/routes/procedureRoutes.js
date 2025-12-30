import express from 'express';
import ProcedureRecord from '../models/ProcedureRecord.js';
import { postReceptionProcedure } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

router.post('/', dayGuard('reception'), async (req, res) => {
  try {
    const record = new ProcedureRecord(req.body);
    await record.save();

    try {
      await postReceptionProcedure(record.toObject());
    } catch (e) {
      console.error('Accounting posting failed for ProcedureRecord', e && e.message ? e.message : e);
    }

    // Create receivable if any
    try {
      const subtotal = Number(record.subtotal || 0);
      const receivedAmount = Number(record.receivedAmount || 0);
      const receivableCurrent = Math.max(0, subtotal - Math.max(0, Math.min(receivedAmount, subtotal)));
      if (receivableCurrent > 0) {
        await Receivable.create({
          portal: 'reception',
          customerId: record.clientId || undefined,
          patientId: record.petId || undefined,
          customerName: record.ownerName || undefined,
          refType: 'reception_procedure',
          refId: String(record._id),
          billDate: record.createdAt,
          description: `Reception procedures for ${record.petName}`,
          totalAmount: receivableCurrent,
          balance: receivableCurrent,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for ProcedureRecord', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'reception',
        sessionId: req.daySession?._id,
        action: 'reception_procedure',
        refType: 'procedure_record',
        refId: String(record._id),
        description: `Reception procedures for ${record.petName}`,
        amount: record.grandTotal || record.subtotal || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Bulk import: create simplified ProcedureRecord entries to reflect opening balances for imported pets
// This endpoint intentionally bypasses dayGuard to allow historical backfill from Excel
router.post('/import-openings', async (req, res) => {
  try {
    const { records } = req.body || {}
    if (!Array.isArray(records)) return res.status(400).json({ success:false, message:'records array required' })
    const created = []
    for (const r of records){
      const billed = Number(r.billed || 0)
      const received = Number(r.received || 0)
      const due = Math.max(0, Number(r.due != null ? r.due : (billed - received)))
      if (!(r.petName && r.ownerName && (billed>0 || received>0 || due>0))) continue
      const doc = new ProcedureRecord({
        petId: r.petId || '',
        clientId: r.clientId || '',
        petName: r.petName,
        ownerName: r.ownerName,
        contact: r.contact || '',
        procedures: [{ mainCategory:'Imported', subCategory:'Opening', drug: r.note || 'Opening Balance (Import)', quantity:1, unit:'entry', amount:billed }],
        subtotal: billed,
        previousDues: 0,
        grandTotal: billed,
        receivedAmount: received,
        receivable: due,
        notes: r.note || 'Imported from Excel',
        createdBy: 'Import'
      })
      await doc.save()
      created.push(doc._id)
    }
    res.status(201).json({ success:true, created: created.length })
  } catch (e) {
    res.status(500).json({ success:false, message: e?.message || 'Failed to import opening balances' })
  }
})

// Get all procedure records (optional filters by petId or clientId)
router.get('/', async (req, res) => {
  try {
    const { petId, clientId, includeImported } = req.query;
    const query = {};
    if (petId) query.petId = petId;
    if (clientId) query.clientId = clientId;

    // By default, hide Excel-imported opening balances from the Procedures list
    // These are NOT real procedures and should appear only in overall totals.
    const shouldExcludeImported = !(
      String(includeImported || '').toLowerCase() === '1' ||
      String(includeImported || '').toLowerCase() === 'true'
    );
    if (shouldExcludeImported) {
      query.$nor = [
        { createdBy: 'Import' },
        { notes: /import/i },
        { procedures: { $elemMatch: { mainCategory: 'Imported' } } },
        { procedures: { $elemMatch: { subCategory: 'Opening' } } },
      ];
    }

    const records = await ProcedureRecord.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single record by id
router.get('/:id', async (req, res) => {
  try {
    const record = await ProcedureRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Procedure record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
