import express from 'express';
import AccessRole from '../models/AccessRole.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const roles = await AccessRole.find().sort({ createdAt: -1 });
    res.json({ success: true, data: roles });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

router.post('/', async (req, res) => {
  try {
    const role = new AccessRole(req.body || {});
    await role.save();
    res.status(201).json({ success: true, data: role });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || String(e) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const role = await AccessRole.findByIdAndUpdate(req.params.id, req.body || {}, {
      new: true,
      runValidators: true,
    });

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, data: role });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || String(e) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const role = await AccessRole.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

export default router;
