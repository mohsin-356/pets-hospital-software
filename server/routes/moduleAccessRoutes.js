import express from 'express';
import ModuleAccess from '../models/ModuleAccess.js';

const router = express.Router();

async function getOrCreate() {
  let doc = await ModuleAccess.findOne({ key: 'global' });
  if (!doc) {
    doc = new ModuleAccess({ key: 'global', config: {} });
    await doc.save();
  }
  return doc;
}

// GET /api/module-access
router.get('/', async (_req, res) => {
  try {
    const doc = await getOrCreate();
    res.json({ success: true, data: doc.config || {} });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

// PUT /api/module-access
router.put('/', async (req, res) => {
  try {
    const config = req.body || {};
    const doc = await getOrCreate();
    doc.config = config;
    await doc.save();
    res.json({ success: true, data: doc.config || {} });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

export default router;
