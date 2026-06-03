import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  condition: {
    type: String,
    enum: ['Good', 'Damaged', 'Defective', 'Expired', 'Other'],
    default: 'Good'
  }
}, { _id: false });

const returnSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  returnNumber: {
    type: String,
    required: true,
    unique: true
  },
  originalSaleId: {
    type: String,
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  customerId: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  customerContact: {
    type: String,
    default: ''
  },
  items: [returnItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  refundAmount: {
    type: Number,
    required: true
  },
  refundMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Bank Transfer', 'Store Credit', 'Original Payment Method'],
    default: 'Cash'
  },
  processingFee: {
    type: Number,
    default: 0
  },
  restockingFee: {
    type: Number,
    default: 0
  },
  finalRefund: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Processing', 'Completed', 'Rejected'],
    default: 'Pending'
  },
  processedBy: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  inventoryUpdated: {
    type: Boolean,
    default: false
  },
  portal: {
    type: String,
    enum: ['shop', 'reception', 'pharmacy'],
    default: 'shop'
  },
  creditNote: {
    type: Boolean,
    default: false
  },
  creditNoteId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for querying (returnNumber already indexed by unique: true)
returnSchema.index({ originalSaleId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

export default mongoose.model('Return', returnSchema);
