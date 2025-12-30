import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PharmacyMedicine',
    required: true
  },
  medicineName: {
    type: String,
    required: true
  },
  batchNo: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // For ml-based medicines
  mlUsed: {
    type: Number,
    min: 0
  },
  // Remaining ml after this sale
  remainingMlAfterSale: {
    type: Number,
    min: 0
  },
  // Expiry date of the batch
  expiryDate: {
    type: Date
  },
  // Dosage information
  dosage: {
    type: String,
    trim: true
  },
  // Actual sale price used during transaction (may differ from original medicine price)
  actualSalePrice: {
    type: Number,
    min: 0
  },
  // Actual total price for this item
  actualTotalPrice: {
    type: Number,
    min: 0
  }
}, { _id: false });

const pharmacySaleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  // Links to patient and client for unified records
  patientId: { type: String, trim: true },
  clientId: { type: String, trim: true },
  customerName: {
    type: String,
    trim: true
  },
  customerContact: {
    type: String,
    trim: true
  },
  petName: {
    type: String,
    trim: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    min: 0
  },
  // Payment breakdown (optional, for dues tracking)
  receivedAmount: { type: Number, min: 0 },
  previousDue: { type: Number, min: 0 },
  dueAmount: { type: Number, min: 0 },
  newTotalDue: { type: Number, min: 0 },
  paymentMethod: {
    type: String,
    trim: true,
    default: 'Cash'
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  // Link to lab report if medicine used in lab
  labReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabReport'
  },
  soldBy: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Cancelled'],
    default: 'Completed'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
pharmacySaleSchema.index({ invoiceNumber: 1 });
pharmacySaleSchema.index({ createdAt: -1 });
pharmacySaleSchema.index({ prescriptionId: 1 });
pharmacySaleSchema.index({ customerContact: 1 });

const PharmacySale = mongoose.model('PharmacySale', pharmacySaleSchema);

export default PharmacySale;
