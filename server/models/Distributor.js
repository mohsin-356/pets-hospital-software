import mongoose from 'mongoose';

const dispatchHistorySchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory'
  },
  itemName: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  dispatchDate: {
    type: Date,
    default: Date.now
  },
  invoiceNumber: String,
  note: String
}, { _id: false });

const distributorSchema = new mongoose.Schema({
  portal: {
    type: String,
    default: 'shop'
  },
  distributorName: {
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
  isWhatsApp: {
    type: Boolean,
    default: false
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
  dispatchHistory: [dispatchHistorySchema],
  totalDispatches: {
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

export default mongoose.model('Distributor', distributorSchema);
