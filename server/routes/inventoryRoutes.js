import express from 'express';
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import JournalEntry from '../models/JournalEntry.js';
import { postInventoryPurchase } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const { department } = req.query;
    const filter = {};
    if (department) filter.department = department;
    const defaultsLab = ['Reagents','Test Kits','Chemicals','Consumables','Glassware','Equipment','Stains & Dyes','Calibrators','Controls','Buffers','Tubes & Vials','Other'];
    const dbCats = await Inventory.distinct('category', filter);
    const merged = Array.from(new Set([ ...(department === 'lab' ? defaultsLab : []), ...dbCats.filter(Boolean).map(c => String(c).trim()) ])).sort();
    res.json({ success: true, data: merged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const item = await Inventory.findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', dayGuard(req => (req.body.department || 'admin')), async (req, res) => {
  try {
    // Map frontend fields to backend schema
    const itemData = {
      ...req.body,
      id: req.body.id || new mongoose.Types.ObjectId().toString(),
      type: req.body.type || (req.body.category === 'medical_equipment' ? 'Equipment' : 'Other'),
      price: (typeof req.body.price === 'number' ? req.body.price : (parseFloat(req.body.purchasePrice) || parseFloat(req.body.unitSale) || 0)) || 0,
      status: req.body.status || 'In Stock',
      department: req.body.department || 'admin',
      createdBy: req.body.createdBy || 'system'
    };
    
    const item = new Inventory(itemData);
    await item.save();
    try {
      await postInventoryPurchase(item.toObject());
    } catch (e) {
      console.warn('Accounting post failed for inventory create', e && e.message ? e.message : e);
    }
    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: item.department || 'admin',
        sessionId: req.daySession?._id,
        action: 'inventory_create',
        refType: 'inventory_item',
        refId: String(item.id || item._id),
        description: item.itemName,
        amount: item.price || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put('/:id', async (req, res) => {
  try {
    // Map frontend fields to backend schema
    const updateData = {
      ...req.body,
      price: (typeof req.body.price === 'number' ? req.body.price : (parseFloat(req.body.purchasePrice) || parseFloat(req.body.unitSale) || 0)) || 0,
      status: req.body.status || 'In Stock',
      updatedAt: new Date()
    };
    
    const item = await Inventory.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    try {
      const sid = String(item.id || item._id);
      const exists = await JournalEntry.exists({ sourceType: 'inventory_purchase', sourceId: sid });
      if (!exists) {
        await postInventoryPurchase(item.toObject());
      }
    } catch (e) {
      console.warn('Accounting post failed for inventory update', e && e.message ? e.message : e);
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const item = await Inventory.findOneAndDelete({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
