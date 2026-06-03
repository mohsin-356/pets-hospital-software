import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  // Reference to the item
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    index: true
  },
  productId: {
    type: String,
    index: true
  },
  // Item details (snapshot)
  itemName: {
    type: String,
    required: true
  },
  barcode: {
    type: String
  },
  company: {
    type: String
  },
  category: {
    type: String
  },
  // Movement details
  type: {
    type: String,
    enum: ['In', 'Out', 'Adjustment', 'Return', 'Transfer', 'Sale', 'Purchase', 'Expired'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  // Department/Location tracking
  department: {
    type: String,
    enum: ['shop', 'pharmacy', 'lab', 'admin'],
    required: true
  },
  fromDepartment: {
    type: String,
    enum: ['shop', 'pharmacy', 'lab', 'admin', 'supplier']
  },
  toDepartment: {
    type: String,
    enum: ['shop', 'pharmacy', 'lab', 'admin']
  },
  // Reference documents
  referenceType: {
    type: String,
    enum: ['Sale', 'Return', 'Purchase', 'Prescription', 'Adjustment', 'Transfer', 'Manual'],
    required: true
  },
  referenceId: {
    type: String,
    index: true
  },
  referenceNumber: {
    type: String
  },
  // Financial details
  unitCost: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  // Reason/Notes
  reason: {
    type: String
  },
  notes: {
    type: String
  },
  // User tracking
  performedBy: {
    type: String,
    required: true
  },
  performedByRole: {
    type: String
  },
  // Batch/Expiry tracking for pharmacy
  batchNumber: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  // Sync status
  syncedToInventory: {
    type: Boolean,
    default: true
  },
  // For returns - link to original sale
  originalSaleId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
stockMovementSchema.index({ inventoryItemId: 1, createdAt: -1 });
stockMovementSchema.index({ department: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ referenceId: 1, referenceType: 1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ type: 1, department: 1 });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

export default StockMovement;
