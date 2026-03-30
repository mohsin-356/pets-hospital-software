import express from 'express';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import { adjustInventoryQuantity, upsertInventoryForProduct } from '../utils/inventoryLinking.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get categories (distinct from DB + defaults)
router.get('/categories', async (req, res) => {
  try {
    const defaults = ['Food', 'Toy', 'Collar', 'Shampoo', 'Accessory', 'Medicine', 'Grooming', 'Other'];
    const dbCats = await Product.distinct('category');
    const merged = Array.from(new Set([ ...defaults, ...dbCats.filter(Boolean).map(c => String(c).trim()) ])).sort();
    res.json({ success: true, data: merged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search products
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const products = await Product.find({
      $or: [
        { itemName: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { company: { $regex: query, $options: 'i' } },
        { supplier: { $regex: query, $options: 'i' } },
        { barcode: query }
      ]
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get low stock products
router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear all products (must be defined BEFORE parameterized '/:id' route)
router.delete('/clear', async (req, res) => {
  try {
    const r = await Product.deleteMany({});
    res.json({ success: true, deleted: r?.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    try {
      const inv = await upsertInventoryForProduct(product.toObject());
      if (inv && inv._id && String(product.inventoryItemId || '') !== String(inv._id)) {
        await Product.findByIdAndUpdate(product._id, { $set: { inventoryItemId: inv._id } });
        product.inventoryItemId = inv._id;
      }
    } catch {}
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create product
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    try {
      const inv = await upsertInventoryForProduct(product.toObject());
      if (inv && inv._id && String(product.inventoryItemId || '') !== String(inv._id)) {
        product.inventoryItemId = inv._id;
        await product.save();
      }
    } catch {}

    // If a supplier is selected, create a corresponding purchase record
    try {
      const qty = Number(product.quantity || 0);
      const unit = Number(product.purchasePrice || 0);
      if (product.supplier && qty > 0) {
        const supplier = await Supplier.findOne({ supplierName: product.supplier, portal: 'shop' });
        if (supplier) {
          const total = qty * unit;
          supplier.purchaseHistory.push({
            productId: product._id,
            productName: product.itemName,
            quantity: qty,
            unitPrice: unit,
            totalPrice: total,
            invoiceNumber: '',
            purchaseDate: new Date()
          });
          supplier.totalPurchases += total;
          await supplier.save();
        }
      }
    } catch (e) {
      // Non-fatal: purchase log should not block product creation
    }

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    // Fetch existing product to compare quantities and supplier changes
    const existing = await Product.findById(req.params.id);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Log a supplier purchase entry if quantity increased OR if supplier was newly set with existing stock
    try {
      const prevQty = Number(existing?.quantity ?? 0);
      const newQty = req.body && req.body.quantity != null ? Number(req.body.quantity) : prevQty;
      const delta = Math.max(0, newQty - prevQty);
      const unit = req.body && req.body.purchasePrice != null ? Number(req.body.purchasePrice) : Number(product.purchasePrice || 0);

      if (product.supplier) {
        const supplier = await Supplier.findOne({ supplierName: product.supplier, portal: 'shop' });
        if (supplier) {
          if (delta > 0) {
            const total = delta * unit;
            supplier.purchaseHistory.push({
              productId: product._id,
              productName: product.itemName,
              quantity: delta,
              unitPrice: unit,
              totalPrice: total,
              invoiceNumber: '',
              purchaseDate: new Date()
            });
            supplier.totalPurchases += total;
            await supplier.save();
          } else if ((!existing?.supplier || existing.supplier === '') && newQty > 0) {
            // If previously no supplier and now set, create a baseline purchase record for current stock
            const total = newQty * unit;
            supplier.purchaseHistory.push({
              productId: product._id,
              productName: product.itemName,
              quantity: newQty,
              unitPrice: unit,
              totalPrice: total,
              invoiceNumber: '',
              purchaseDate: new Date()
            });
            supplier.totalPurchases += total;
            await supplier.save();
          }
        }
      }
    } catch (e) {
      // Non-fatal: do not block product update due to supplier log issues
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update stock quantity
router.patch('/:id/stock', async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const q = Number(quantity || 0);
    if (operation === 'add') {
      product.quantity += q;
    } else if (operation === 'subtract') {
      if (product.quantity < q) {
        return res.status(400).json({ success: false, message: 'Insufficient stock' });
      }
      product.quantity -= q;
    }

    await product.save();

    try {
      const inv = await upsertInventoryForProduct(product.toObject());
      if (inv && inv._id) {
        if (String(product.inventoryItemId || '') !== String(inv._id)) {
          product.inventoryItemId = inv._id;
          await product.save();
        }
        const delta = operation === 'add' ? Math.abs(q) : -Math.abs(q);
        await adjustInventoryQuantity({ inventoryItemId: inv._id, delta });
      }
    } catch {}

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }
    const results = [];
    for (const raw of payload) {
      const itemName = String(raw.itemName || raw.item_name || '').trim();
      const company = raw.company ? String(raw.company).trim() : '';
      const category = String(raw.category || '').trim() || 'Other';
      const barcodeRaw = raw.barcode == null ? '' : String(raw.barcode).trim();
      const barcodeClean = (barcodeRaw || '').trim();
      const barcode = barcodeClean && barcodeClean.toLowerCase() !== 'null' && barcodeClean.toLowerCase() !== 'undefined' ? barcodeClean : undefined;
      const quantity = Number(raw.quantity ?? 0) || 0;
      const purchasePrice = Number(raw.purchasePrice ?? 0) || 0;
      const salePrice = Number(raw.salePrice ?? 0) || 0;
      const supplier = raw.supplier ? String(raw.supplier) : '';
      const description = raw.description ? String(raw.description) : '';
      const lowStockThreshold = Number(raw.lowStockThreshold ?? 10) || 10;
      // Do not require itemName; allow partial rows. If both barcode and itemName are missing,
      // we insert a new document (handled below).
      const doc = {
        itemName,
        company,
        category,
        quantity,
        purchasePrice,
        salePrice,
        supplier,
        description,
        lowStockThreshold,
      };
      if (barcode) doc.barcode = barcode;
      // If no barcode is provided, treat as a new product (do not merge by name)
      if (!barcode) {
        const created = await Product.create(doc);
        try {
          const inv = await upsertInventoryForProduct(created.toObject());
          if (inv && inv._id) {
            created.inventoryItemId = inv._id;
            await created.save();
          }
        } catch {}
        results.push(created);
        continue;
      }
      // With a barcode, upsert by barcode to avoid duplicates of the same coded item
      const filter = { barcode, company };
      const updated = await Product.findOneAndUpdate(
        filter,
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      try {
        const inv = await upsertInventoryForProduct(updated.toObject());
        if (inv && inv._id && String(updated.inventoryItemId || '') !== String(inv._id)) {
          updated.inventoryItemId = inv._id;
          await updated.save();
        }
      } catch {}
      results.push(updated);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
