import express from 'express';
import StockMovement from '../models/StockMovement.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import PharmacyMedicine from '../models/PharmacyMedicine.js';

const router = express.Router();

// Get all stock movements with filters
router.get('/', async (req, res) => {
  try {
    const { department, type, startDate, endDate, itemName, limit = 100 } = req.query;
    const filter = {};
    
    if (department) filter.department = department;
    if (type) filter.type = type;
    if (itemName) filter.itemName = { $regex: itemName, $options: 'i' };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const movements = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
      
    res.json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stock movement statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    const filter = {};
    
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const stats = await StockMovement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);
    
    const summary = {
      totalMovements: 0,
      byType: {}
    };
    
    stats.forEach(s => {
      summary.totalMovements += s.count;
      summary.byType[s._id] = {
        count: s.count,
        totalQuantity: s.totalQuantity
      };
    });
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stock levels by department
router.get('/stock-levels', async (req, res) => {
  try {
    const { department } = req.query;
    
    let inventory;
    if (department) {
      inventory = await Inventory.find({ department });
    } else {
      // Aggregate across all departments
      inventory = await Inventory.aggregate([
        {
          $group: {
            _id: { itemName: '$itemName', company: '$company', barcode: '$barcode' },
            totalQuantity: { $sum: '$quantity' },
            departments: { $push: '$department' },
            minStockLevel: { $min: '$minStockLevel' }
          }
        }
      ]);
    }
    
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create manual stock movement
router.post('/', async (req, res) => {
  try {
    const movementData = req.body;
    
    // Validate inventory item exists
    if (movementData.inventoryItemId) {
      const inventoryItem = await Inventory.findById(movementData.inventoryItemId);
      if (!inventoryItem) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }
      
      // Update inventory quantity
      const prevQty = inventoryItem.quantity;
      const newQty = movementData.type === 'In' || movementData.type === 'Return'
        ? prevQty + movementData.quantity
        : prevQty - movementData.quantity;
        
      inventoryItem.quantity = Math.max(0, newQty);
      
      // Update status
      if (inventoryItem.quantity === 0) {
        inventoryItem.status = 'Out of Stock';
      } else if (inventoryItem.quantity <= inventoryItem.minStockLevel) {
        inventoryItem.status = 'Low Stock';
      } else {
        inventoryItem.status = 'In Stock';
      }
      
      await inventoryItem.save();
      
      movementData.previousQuantity = prevQty;
      movementData.newQuantity = inventoryItem.quantity;
    }
    
    const movement = new StockMovement({
      id: `sm-${Date.now()}`,
      ...movementData
    });
    
    await movement.save();
    
    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get stock movement by ID
router.get('/:id', async (req, res) => {
  try {
    const movement = await StockMovement.findOne({ id: req.params.id });
    if (!movement) {
      return res.status(404).json({ success: false, message: 'Stock movement not found' });
    }
    res.json({ success: true, data: movement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get movements by reference
router.get('/by-reference/:referenceType/:referenceId', async (req, res) => {
  try {
    const { referenceType, referenceId } = req.params;
    const movements = await StockMovement.find({ referenceType, referenceId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get low stock alerts
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const { department } = req.query;
    const filter = { 
      $expr: { $lte: ['$quantity', '$minStockLevel'] },
      quantity: { $gt: 0 }
    };
    if (department) filter.department = department;
    
    const lowStock = await Inventory.find(filter);
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get out of stock items
router.get('/alerts/out-of-stock', async (req, res) => {
  try {
    const { department } = req.query;
    const filter = { quantity: 0 };
    if (department) filter.department = department;
    
    const outOfStock = await Inventory.find(filter);
    res.json({ success: true, data: outOfStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reconcile inventory
router.post('/reconcile', async (req, res) => {
  try {
    const { department, items, performedBy, reason } = req.body;
    
    const movements = [];
    
    for (const item of items) {
      const inventoryItem = await Inventory.findOne({
        _id: item.inventoryItemId,
        department
      });
      
      if (!inventoryItem) continue;
      
      const prevQty = inventoryItem.quantity;
      const newQty = item.actualQuantity;
      const diff = newQty - prevQty;
      
      if (diff !== 0) {
        inventoryItem.quantity = newQty;
        
        if (newQty === 0) {
          inventoryItem.status = 'Out of Stock';
        } else if (newQty <= inventoryItem.minStockLevel) {
          inventoryItem.status = 'Low Stock';
        } else {
          inventoryItem.status = 'In Stock';
        }
        
        await inventoryItem.save();
        
        const movement = new StockMovement({
          id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          inventoryItemId: inventoryItem._id,
          itemName: inventoryItem.itemName,
          barcode: inventoryItem.barcode,
          company: inventoryItem.company,
          category: inventoryItem.category,
          type: diff > 0 ? 'In' : 'Out',
          quantity: Math.abs(diff),
          previousQuantity: prevQty,
          newQuantity: newQty,
          department,
          referenceType: 'Adjustment',
          reason: reason || 'Stock reconciliation',
          notes: item.notes,
          performedBy,
          performedByRole: 'Admin'
        });
        
        await movement.save();
        movements.push(movement);
      }
    }
    
    res.json({ success: true, data: movements, count: movements.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
