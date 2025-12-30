import express from 'express';
import LabReport from '../models/LabReport.js';
import { postLabReport } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const reports = await LabReport.find().sort({ reportDate: -1 });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', dayGuard('lab'), async (req, res) => {
  try {
    const report = new LabReport(req.body);
    await report.save();

    try {
      await postLabReport(report.toObject());
    } catch (e) {
      console.error('Accounting posting failed for LabReport', e && e.message ? e.message : e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'lab',
        sessionId: req.daySession?._id,
        action: 'lab_report_create',
        refType: 'lab_report',
        refId: report.id || String(report._id),
        description: `Lab report ${report.reportNumber}`,
        amount: report.amount || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOneAndDelete({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
