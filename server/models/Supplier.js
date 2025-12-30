import mongoose from 'mongoose';

const purchaseHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productName: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  invoiceNumber: String
}, { _id: false });

const supplierSchema = new mongoose.Schema({
  portal: {
    type: String,
    default: 'admin'
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'General'
  },
  purchaseHistory: [purchaseHistorySchema],
  totalPurchases: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('Supplier', supplierSchema);
