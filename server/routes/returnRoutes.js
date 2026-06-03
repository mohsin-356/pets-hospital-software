import express from 'express';
import Return from '../models/Return.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import { adjustInventoryQuantity } from '../utils/inventoryLinking.js';

const router = express.Router();

// Generate unique return number
const generateReturnNumber = () => `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Get all returns with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, portal, customerId, startDate, endDate } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (portal) filter.portal = portal;
    if (customerId) filter.customerId = customerId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const returns = await Return.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single return
router.get('/:id', async (req, res) => {
  try {
    const returnDoc = await Return.findOne({ id: req.params.id });
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    res.json({ success: true, data: returnDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new return
router.post('/', async (req, res) => {
  try {
    const returnData = {
      id: `return-${Date.now()}`,
      returnNumber: generateReturnNumber(),
      ...req.body,
      status: 'Pending',
      inventoryUpdated: false
    };
    
    const returnDoc = new Return(returnData);
    await returnDoc.save();
    
    res.status(201).json({ success: true, data: returnDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update return status and process inventory
router.put('/:id/process', async (req, res) => {
  try {
    const { status, processedBy } = req.body;
    
    const returnDoc = await Return.findOne({ id: req.params.id });
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    
    // If approving and inventory not yet updated
    if ((status === 'Approved' || status === 'Completed') && !returnDoc.inventoryUpdated) {
      // Update product quantities and create stock movements
      for (const item of returnDoc.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          const prevQty = product.quantity;
          product.quantity += item.quantity;
          await product.save();
          
          // Create stock movement record
          const stockMovement = new StockMovement({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            productId: item.productId,
            itemName: item.itemName,
            barcode: product.barcode,
            company: product.company,
            category: product.category,
            type: 'Return',
            quantity: item.quantity,
            previousQuantity: prevQty,
            newQuantity: product.quantity,
            department: returnDoc.portal === 'reception' ? 'shop' : returnDoc.portal,
            referenceType: 'Return',
            referenceId: returnDoc.id,
            referenceNumber: returnDoc.returnNumber,
            unitCost: item.unitPrice,
            totalCost: item.totalPrice,
            reason: item.reason || returnDoc.reason,
            performedBy: processedBy,
            performedByRole: returnDoc.portal === 'reception' ? 'Reception' : 'Shop'
          });
          await stockMovement.save();
          
          // Also update unified inventory
          try {
            await adjustInventoryQuantity(
              { 
                department: returnDoc.portal === 'reception' ? 'shop' : returnDoc.portal, 
                itemName: product.itemName,
                company: product.company,
                barcode: product.barcode
              },
              item.quantity,
              `Return processed: ${returnDoc.returnNumber}`
            );
          } catch (invErr) {
            console.log('Inventory adjustment note:', invErr.message);
          }
        }
      }
      
      returnDoc.inventoryUpdated = true;
    }
    
    returnDoc.status = status;
    returnDoc.processedBy = processedBy;
    returnDoc.processedAt = new Date();
    
    await returnDoc.save();
    
    res.json({ success: true, data: returnDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update return
router.put('/:id', async (req, res) => {
  try {
    const returnDoc = await Return.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    res.json({ success: true, data: returnDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete return
router.delete('/:id', async (req, res) => {
  try {
    const returnDoc = await Return.findOne({ id: req.params.id });
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return not found' });
    }
    
    // If inventory was updated, reverse it
    if (returnDoc.inventoryUpdated) {
      for (const item of returnDoc.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);
          await product.save();
        }
      }
    }
    
    await Return.findOneAndDelete({ id: req.params.id });
    res.json({ success: true, message: 'Return deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get returns by sale ID
router.get('/by-sale/:saleId', async (req, res) => {
  try {
    const returns = await Return.find({ originalSaleId: req.params.saleId });
    res.json({ success: true, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get return statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { portal, startDate, endDate } = req.query;
    const filter = {};
    
    if (portal) filter.portal = portal;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const stats = await Return.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalRefundAmount: { $sum: '$finalRefund' },
          pendingCount: { 
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
          },
          completedCount: { 
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({ 
      success: true, 
      data: stats[0] || { 
        totalReturns: 0, 
        totalRefundAmount: 0, 
        pendingCount: 0, 
        completedCount: 0 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
