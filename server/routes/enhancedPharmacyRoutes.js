import express from 'express';
import PharmacyMedicine from '../models/PharmacyMedicine.js';
import PharmacySale from '../models/PharmacySale.js';
import PharmacyPurchase from '../models/PharmacyPurchase.js';
import PharmacyDue from '../models/PharmacyDue.js';
import { postPharmacySale, postPharmacyPurchase } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';
import Payable from '../models/Payable.js';
import { upsertInventoryForMedicine } from '../utils/inventoryLinking.js';

const router = express.Router();

// ==================== DUES (CLIENT PREVIOUS BALANCE) ====================
// Get client dues by clientId (used across portals)
router.get('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
    const row = await PharmacyDue.findOne({ clientId });
    res.json({ success: true, data: row || { clientId, previousDue: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Find a single medicine by barcode (no stock filters) for admin/import use
router.get('/medicines/find-by-barcode/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    if (!barcode) return res.status(400).json({ success: false, message: 'Barcode is required' });
    const medicine = await PharmacyMedicine.findOne({ barcode });
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upsert client dues by clientId (called after creating procedures/sales to persist receivable)
router.put('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const payload = {
      previousDue: Math.max(0, Number(req.body?.previousDue || 0)),
      name: req.body?.name || '',
      customerContact: req.body?.customerContact || '',
    };
    const updated = await PharmacyDue.findOneAndUpdate(
      { clientId },
      { $set: { ...payload, clientId } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MEDICINE ROUTES ====================

// Get all medicines with enhanced filtering for POS
router.get('/medicines', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true }).sort({ createdAt: -1 });

    // Initialize remainingMl for injections that don't have it set
    const updatedMedicines = medicines.map(medicine => {
      if (medicine.category === 'Injection' && !medicine.remainingMl && medicine.mlPerVial) {
        medicine.remainingMl = medicine.mlPerVial * medicine.quantity;
      }
      return medicine;
    });

    res.json({ success: true, data: updatedMedicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get medicine by ID
router.get('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PharmacyMedicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search medicines by name or barcode
router.get('/medicines/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const medicines = await PharmacyMedicine.find({
      isActive: true,
      $or: [
        { medicineName: { $regex: query, $options: 'i' } },
        { barcode: query }
      ],
      $and: [
        {
          $or: [
            { quantity: { $gt: 0 } },
            { 
              category: 'Injection',
              $or: [
                { remainingMl: { $gt: 0 } },
                { quantity: { $gt: 0 }, remainingMl: { $exists: false } }
              ]
            }
          ]
        }
      ]
    });
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get low stock medicines
router.get('/medicines/alerts/low-stock', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true });
    const lowStock = medicines.filter(med => {
      if (med.category === 'Injection') {
        const remainingMl = med.remainingMl || (med.mlPerVial * med.quantity);
        return remainingMl <= (med.lowStockThreshold || 10);
      }
      return med.quantity <= med.lowStockThreshold;
    });
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get expiring medicines (within 30 days)
router.get('/medicines/alerts/expiring', async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const medicines = await PharmacyMedicine.find({
      isActive: true,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    }).sort({ expiryDate: 1 });
    
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get expired medicines
router.get('/medicines/alerts/expired', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({
      isActive: true,
      expiryDate: { $lt: new Date() }
    }).sort({ expiryDate: -1 });
    
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new medicine
router.post('/medicines', async (req, res) => {
  try {
    const medicineData = { ...req.body };
    
    // Set original quantity for tracking
    medicineData.originalQuantity = medicineData.quantity;
    
    // For injections, initialize remainingMl
    if (medicineData.category === 'Injection' && medicineData.mlPerVial) {
      medicineData.remainingMl = medicineData.mlPerVial * medicineData.quantity;
    }
    // Validate barcode presence & uniqueness
    const barcode = String(medicineData.barcode || '').trim();
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }
    const dup = await PharmacyMedicine.findOne({ barcode });
    if (dup) {
      return res.status(400).json({ success: false, message: 'Medicine with this barcode already exists' });
    }

    const medicine = new PharmacyMedicine({ ...medicineData, barcode });
    await medicine.save();

    try {
      const inv = await upsertInventoryForMedicine(medicine.toObject());
      if (inv && inv._id && String(medicine.inventoryItemId || '') !== String(inv._id)) {
        medicine.inventoryItemId = inv._id;
        await medicine.save();
      }
    } catch {}

    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || '';
      const msg = key === 'barcode' ? 'Medicine with this barcode already exists' : 'Medicine with this batch number already exists';
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update medicine
router.put('/medicines/:id', async (req, res) => {
  try {
    if (typeof req.body.barcode !== 'undefined') {
      const barcode = String(req.body.barcode || '').trim();
      if (!barcode) {
        return res.status(400).json({ success: false, message: 'Barcode is required' });
      }
      const exists = await PharmacyMedicine.findOne({ barcode, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Medicine with this barcode already exists' });
      }
      req.body.barcode = barcode;
    }
    const medicine = await PharmacyMedicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    try {
      const inv = await upsertInventoryForMedicine(medicine.toObject());
      if (inv && inv._id && String(medicine.inventoryItemId || '') !== String(inv._id)) {
        await PharmacyMedicine.findByIdAndUpdate(medicine._id, { $set: { inventoryItemId: inv._id } });
        medicine.inventoryItemId = inv._id;
      }
    } catch {}

    res.json({ success: true, data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || '';
      const msg = key === 'barcode' ? 'Medicine with this barcode already exists' : 'Medicine with this batch number already exists';
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete medicine (soft delete)
router.delete('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PharmacyMedicine.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SALES ROUTES ====================

// Get all sales
router.get('/sales', async (req, res) => {
  try {
    const sales = await PharmacySale.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sales by date range
router.get('/sales/date-range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const sales = await PharmacySale.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      }
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sale by ID
router.get('/sales/:id', async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id)
      .populate('prescriptionId')
      .populate('items.medicineId');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Enhanced sale creation with injection partial sale logic
router.post('/sales', dayGuard('pharmacy'), async (req, res) => {
  try {
    const { items, ...saleData } = req.body;
    
    // Validate and process each item
    const processedItems = [];
    let totalCost = 0;
    
    for (const item of items) {
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      
      if (!medicine) {
        return res.status(404).json({ 
          success: false, 
          message: `Medicine ${item.medicineName} not found` 
        });
      }

      if (medicine.category === 'Injection') {
        // Handle injection partial sale
        const mlUsed = parseFloat(item.mlUsed);
        
        if (isNaN(mlUsed) || mlUsed <= 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid ML amount for ${item.medicineName}` 
          });
        }

        // Initialize remainingMl if not set
        if (!medicine.remainingMl && medicine.mlPerVial) {
          medicine.remainingMl = medicine.mlPerVial * medicine.quantity;
        }

        const currentRemainingMl = medicine.remainingMl || 0;
        
        if (mlUsed > currentRemainingMl) {
          return res.status(400).json({ 
            success: false, 
            message: `Only ${currentRemainingMl}ml available for ${medicine.medicineName}` 
          });
        }

        // Calculate new remaining ml
        const newRemainingMl = currentRemainingMl - mlUsed;
        
        // Update medicine stock
        medicine.remainingMl = newRemainingMl;
        
        // If batch is completely used, mark as inactive or update quantity
        if (newRemainingMl <= 0) {
          medicine.quantity = 0;
          // Keep the batch active until a new batch is added
          // This ensures the same batch continues to appear until finished
        }
        
        await medicine.save();

        try {
          const inv = await upsertInventoryForMedicine(medicine.toObject());
          if (inv && inv._id && String(medicine.inventoryItemId || '') !== String(inv._id)) {
            await PharmacyMedicine.findByIdAndUpdate(medicine._id, { $set: { inventoryItemId: inv._id } });
            medicine.inventoryItemId = inv._id;
          }
        } catch {}

        // Cost for injection: use purchasePrice per ml where possible
        const purchasePricePerMl = medicine.mlPerVial && medicine.purchasePrice
          ? medicine.purchasePrice / medicine.mlPerVial
          : medicine.purchasePrice || 0;
        totalCost += purchasePricePerMl * mlUsed;

        // Add processed item
        processedItems.push({
          ...item,
          mlUsed: mlUsed,
          remainingMlAfterSale: newRemainingMl,
          quantity: 1 // For injections, quantity is always 1 vial
        });

      } else {
        // Handle regular medicine sale
        const quantity = parseFloat(item.quantity);
        
        if (isNaN(quantity) || quantity <= 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid quantity for ${item.medicineName}` 
          });
        }
        
        if (medicine.quantity < quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.quantity}` 
          });
        }
        
        // Deduct stock
        medicine.quantity -= quantity;
        
        // If stock reaches zero, keep the batch active until new stock is added
        if (medicine.quantity <= 0) {
          medicine.quantity = 0;
        }
        
        await medicine.save();

        try {
          const inv = await upsertInventoryForMedicine(medicine.toObject());
          if (inv && inv._id && String(medicine.inventoryItemId || '') !== String(inv._id)) {
            await PharmacyMedicine.findByIdAndUpdate(medicine._id, { $set: { inventoryItemId: inv._id } });
            medicine.inventoryItemId = inv._id;
          }
        } catch {}

        // Cost for regular medicine: quantity * purchasePrice
        const unitCost = medicine.purchasePrice || 0;
        totalCost += unitCost * quantity;

        // Add processed item
        processedItems.push({
          ...item,
          quantity: quantity,
          mlUsed: 0
        });
      }
    }
    
    // Generate invoice number
    const lastSale = await PharmacySale.findOne().sort({ createdAt: -1 });
    let invoiceNumber = 'PH-INV-0001';
    if (lastSale && lastSale.invoiceNumber) {
      const lastNumber = parseInt(lastSale.invoiceNumber.split('-')[2]);
      invoiceNumber = `PH-INV-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    
    // Create sale record
    const sale = new PharmacySale({
      ...saleData,
      items: processedItems,
      invoiceNumber,
      totalCost: Math.max(0, Number(totalCost) || 0),
    });
    
    await sale.save();

    // Create Receivable if there is a due portion
    try {
      const totalAmount = Number(sale.totalAmount || 0);
      const receivedAmount = Number(sale.receivedAmount || 0);
      const receivableCurrent = Math.max(0, totalAmount - Math.max(0, Math.min(receivedAmount, totalAmount)));
      if (receivableCurrent > 0) {
        await Receivable.create({
          portal: 'pharmacy',
          customerId: sale.clientId || sale.customerId || undefined,
          patientId: sale.patientId || undefined,
          customerName: sale.customerName || undefined,
          refType: 'pharmacy_sale',
          refId: String(sale._id),
          billDate: sale.createdAt,
          description: `Pharmacy sale ${sale.invoiceNumber}`,
          totalAmount: receivableCurrent,
          balance: receivableCurrent,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for PharmacySale', e?.message || e);
    }

    try {
      await postPharmacySale(sale.toObject());
    } catch (e) {
      console.error('Accounting posting failed for PharmacySale', e && e.message ? e.message : e);
    }
    
    // Populate the sale with medicine details for response
    const populatedSale = await PharmacySale.findById(sale._id)
      .populate('items.medicineId');

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'pharmacy',
        sessionId: req.daySession?._id,
        action: 'pharmacy_sale',
        refType: 'pharmacy_sale',
        refId: String(sale._id),
        description: `Pharmacy sale ${sale.invoiceNumber}`,
        amount: sale.totalAmount,
      });
    } catch {}

    res.status(201).json({ success: true, data: populatedSale });
  } catch (error) {
    console.error('Sale creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update sale
router.put('/sales/:id', async (req, res) => {
  try {
    const sale = await PharmacySale.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete sale (with stock restoration)
router.delete('/sales/:id', dayGuard('pharmacy'), async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // Restore stock for each item
    for (const item of sale.items) {
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        if (medicine.category === 'Injection' && item.mlUsed) {
          // Restore ml for injections
          medicine.remainingMl = (medicine.remainingMl || 0) + item.mlUsed;
          if (medicine.remainingMl > 0) {
            medicine.quantity = Math.max(medicine.quantity, 1);
          }
        } else {
          // Restore quantity for regular medicines
          medicine.quantity += item.quantity;
        }
        await medicine.save();

        try {
          const inv = await upsertInventoryForMedicine(medicine.toObject());
          if (inv && inv._id && String(medicine.inventoryItemId || '') !== String(inv._id)) {
            await PharmacyMedicine.findByIdAndUpdate(medicine._id, { $set: { inventoryItemId: inv._id } });
            medicine.inventoryItemId = inv._id;
          }
        } catch {}
      }
    }

    await PharmacySale.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sale deleted and stock restored successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DUES ROUTES ====================

// Get dues by clientId
router.get('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const record = await PharmacyDue.findOne({ clientId });
    if (!record) return res.json({ success: true, previousDue: 0, data: { clientId, previousDue: 0 } });
    res.json({ success: true, previousDue: record.previousDue, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upsert dues by clientId
router.put('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { previousDue = 0, name, customerContact } = req.body || {};
    const updated = await PharmacyDue.findOneAndUpdate(
      { clientId },
      { clientId, name, customerContact, previousDue: Math.max(0, Number(previousDue) || 0) },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==================== PURCHASE ROUTES ====================

// Get all purchases
router.get('/purchases', async (req, res) => {
  try {
    const purchases = await PharmacyPurchase.find().sort({ purchaseDate: -1 });
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get purchase by ID
router.get('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new purchase
router.post('/purchases', dayGuard('pharmacy'), async (req, res) => {
  try {
    const purchase = new PharmacyPurchase(req.body);
    await purchase.save();

    try {
      const items = Array.isArray(purchase.items) ? purchase.items : [];
      for (const item of items) {
        const barcode = String(item?.barcode || '').trim();
        const medicineName = String(item?.medicineName || '').trim();
        const batchNo = String(item?.batchNo || '').trim();
        const category = String(item?.category || '').trim();
        const qty = Math.max(0, Number(item?.quantity || 0));
        if (!medicineName || !batchNo || !qty) continue;

        const existing = barcode
          ? await PharmacyMedicine.findOne({ barcode })
          : await PharmacyMedicine.findOne({ medicineName, batchNo });

        if (existing) {
          if (existing.category === 'Injection' || category === 'Injection') {
            existing.quantity = Math.max(0, Number(existing.quantity || 0)) + qty;
            if (!existing.mlPerVial && item?.mlPerVial) existing.mlPerVial = Number(item.mlPerVial || 0);
            if (existing.mlPerVial) {
              const addMl = Number(existing.mlPerVial || 0) * qty;
              existing.remainingMl = Math.max(0, Number(existing.remainingMl || 0)) + addMl;
            }
          } else {
            existing.quantity = Math.max(0, Number(existing.quantity || 0)) + qty;
          }

          if (item?.purchasePrice != null) existing.purchasePrice = Number(item.purchasePrice || 0);
          if (item?.salePrice != null) existing.salePrice = Number(item.salePrice || 0);
          if (purchase.supplierName) existing.supplierName = purchase.supplierName;
          if (purchase.purchaseDate) existing.purchaseDate = purchase.purchaseDate;
          if (purchase.invoiceNo) existing.invoiceNo = purchase.invoiceNo;
          await existing.save();

          try {
            const inv = await upsertInventoryForMedicine(existing.toObject());
            if (inv && inv._id && String(existing.inventoryItemId || '') !== String(inv._id)) {
              await PharmacyMedicine.findByIdAndUpdate(existing._id, { $set: { inventoryItemId: inv._id } });
            }
          } catch {}
        } else {
          const medicineData = {
            medicineName,
            batchNo,
            category: category || 'Medicine',
            expiryDate: item.expiryDate,
            quantity: qty,
            unit: item.unit,
            purchasePrice: Number(item.purchasePrice || 0),
            salePrice: Number(item.salePrice || 0),
            supplierName: purchase.supplierName,
            purchaseDate: purchase.purchaseDate,
            invoiceNo: purchase.invoiceNo,
            lowStockThreshold: 10,
            description: '',
            barcode: barcode || `PH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            mlPerVial: item.mlPerVial,
            isActive: true,
          };

          if (medicineData.category === 'Injection' && medicineData.mlPerVial) {
            medicineData.remainingMl = Number(medicineData.mlPerVial || 0) * qty;
            medicineData.originalQuantity = qty;
          } else {
            medicineData.originalQuantity = qty;
          }

          const created = await PharmacyMedicine.create(medicineData);

          try {
            const inv = await upsertInventoryForMedicine(created.toObject());
            if (inv && inv._id) {
              await PharmacyMedicine.findByIdAndUpdate(created._id, { $set: { inventoryItemId: inv._id } });
            }
          } catch {}
        }
      }
    } catch (e) {}

    try {
      await postPharmacyPurchase(purchase.toObject());
    } catch (e) {
      console.error('Accounting posting failed for PharmacyPurchase', e && e.message ? e.message : e);
    }

    try {
      const total = Number(purchase.totalAmount || 0);
      const paid = Number(purchase.amountPaid || 0);
      const balance = Math.max(0, total - paid);
      if (balance > 0) {
        await Payable.create({
          portal: 'pharmacy',
          supplierId: purchase.supplierName, // string id fallback
          supplierName: purchase.supplierName,
          billRef: purchase.invoiceNo,
          billDate: purchase.purchaseDate || purchase.createdAt,
          sourceType: 'pharmacy_purchase',
          sourceId: String(purchase._id),
          description: `Pharmacy invoice ${purchase.invoiceNo}`,
          totalAmount: balance,
          balance: balance,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Payable create failed for PharmacyPurchase', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'pharmacy',
        sessionId: req.daySession?._id,
        action: 'pharmacy_purchase',
        refType: 'pharmacy_purchase',
        refId: String(purchase._id),
        description: `Pharmacy purchase ${purchase.purchaseOrderNo}`,
        amount: purchase.totalAmount,
      });
    } catch {}

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update purchase
router.put('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete purchase
router.delete('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findByIdAndDelete(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== REPORTING ROUTES ====================

// Get sales summary
router.get('/reports/sales-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        }
      };
    }

    const sales = await PharmacySale.find(dateFilter);
    
    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalDiscount: sales.reduce((sum, sale) => sum + sale.discount, 0),
      averageSaleAmount: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length : 0,
      paymentMethods: {}
    };

    // Group by payment methods
    sales.forEach(sale => {
      summary.paymentMethods[sale.paymentMethod] = 
        (summary.paymentMethods[sale.paymentMethod] || 0) + 1;
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get top selling medicines
router.get('/reports/top-selling', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const sales = await PharmacySale.find();
    const medicineStats = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!medicineStats[item.medicineName]) {
          medicineStats[item.medicineName] = {
            name: item.medicineName,
            category: item.category,
            totalQuantity: 0,
            totalMlUsed: 0,
            totalRevenue: 0,
            salesCount: 0
          };
        }
        
        const stats = medicineStats[item.medicineName];
        stats.totalQuantity += item.quantity || 0;
        stats.totalMlUsed += item.mlUsed || 0;
        stats.totalRevenue += item.totalPrice;
        stats.salesCount += 1;
      });
    });

    const topSelling = Object.values(medicineStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: topSelling });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
