import express from 'express';
import Distributor from '../models/Distributor.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// Get all distributors (optionally filter by portal)
router.get('/', async (req, res) => {
  try {
    const { portal } = req.query;
    const q = {};
    if (portal && portal !== 'all') {
      q.portal = portal;
    }
    const distributors = await Distributor.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: distributors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get distributor by ID
router.get('/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.params.id);
    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Distributor not found' });
    }
    res.json({ success: true, data: distributor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create distributor
router.post('/', async (req, res) => {
  try {
    const distributor = new Distributor(req.body);
    await distributor.save();
    res.status(201).json({ success: true, data: distributor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update distributor
router.put('/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Distributor not found' });
    }
    res.json({ success: true, data: distributor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete distributor
router.delete('/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findByIdAndDelete(req.params.id);
    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Distributor not found' });
    }
    res.json({ success: true, message: 'Distributor deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add dispatch to distributor (and update inventory stock)
router.post('/:id/dispatch', async (req, res) => {
  try {
    const { inventoryItemId, itemName, quantity, unitPrice, invoiceNumber, note } = req.body;

    const distributor = await Distributor.findById(req.params.id);
    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Distributor not found' });
    }

    const q = Number(quantity || 0);
    const u = Number(unitPrice || 0);
    const totalPrice = q * u;

    distributor.dispatchHistory.push({
      inventoryItemId,
      itemName,
      quantity: q,
      unitPrice: u,
      totalPrice,
      invoiceNumber,
      dispatchDate: new Date(),
      note: note || ''
    });
    distributor.totalDispatches += totalPrice;
    await distributor.save();

    if (inventoryItemId) {
      await Inventory.findByIdAndUpdate(
        inventoryItemId,
        { $inc: { quantity: -Math.abs(q) } }
      );
    }

    res.json({ success: true, data: distributor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
