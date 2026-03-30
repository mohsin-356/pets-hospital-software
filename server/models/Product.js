import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory'
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster searches
productSchema.index({ itemName: 'text', category: 'text', barcode: 'text', supplier: 'text', company: 'text' });
productSchema.index(
  { company: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      barcode: { $type: 'string', $ne: '' }
    }
  }
);

export default mongoose.model('Product', productSchema);
