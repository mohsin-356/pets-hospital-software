import express from 'express';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';

const router = express.Router();

// Get all suppliers (optionally filter by portal)
router.get('/', async (req, res) => {
  try {
    const { portal } = req.query;
    const q = {};
    if (portal && portal !== 'all') {
      q.portal = portal;
    }
    const suppliers = await Supplier.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get supplier by ID
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add purchase to supplier (and update product stock)
router.post('/:id/purchase', async (req, res) => {
  try {
    const { productId, productName, quantity, unitPrice, invoiceNumber } = req.body;
    
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const totalPrice = quantity * unitPrice;

    // Add to purchase history
    supplier.purchaseHistory.push({
      productId,
      productName,
      quantity,
      unitPrice,
      totalPrice,
      invoiceNumber,
      purchaseDate: new Date()
    });
    supplier.totalPurchases += totalPrice;
    await supplier.save();

    // Update product stock if productId provided
    if (productId) {
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: quantity } }
      );
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
