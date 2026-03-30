import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import mongoose from 'mongoose';
import User from './models/User.js';
import Pet from './models/Pet.js';
import PharmacyMedicine from './models/PharmacyMedicine.js';
import Product from './models/Product.js';

// Import routes
import userRoutes from './routes/userRoutes.js';
import petRoutes from './routes/petRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import labReportRoutes from './routes/labReportRoutes.js';
import labTestRoutes from './routes/labTestRoutes.js';
import labRequestRoutes from './routes/labRequestRoutes.js';
import radiologyReportRoutes from './routes/radiologyReportRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import financialRoutes from './routes/financialRoutes.js';
import expensesRoutes from './routes/expensesRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import doctorProfileRoutes from './routes/doctorProfileRoutes.js';
import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import distributorRoutes from './routes/distributorRoutes.js';
import shopCustomerRoutes from './routes/shopCustomerRoutes.js';
import pharmacyRoutes from './routes/enhancedPharmacyRoutes.js';
import taxonomyRoutes from './routes/taxonomyRoutes.js';
import procedureRoutes from './routes/procedureRoutes.js';
import procedureCatalogRoutes from './routes/procedureCatalogRoutes.js';
import fullRecordRoutes from './routes/fullRecordRoutes.js';
import financialSummaryRoutes from './routes/financialSummaryRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import accountingRoutes from './routes/accountingRoutes.js';
import daySessionRoutes from './routes/daySessionRoutes.js';
import receivablesRoutes from './routes/receivablesRoutes.js';
import payablesRoutes from './routes/payablesRoutes.js';
import vendorPaymentRoutes from './routes/vendorPaymentRoutes.js';
import staffAdvanceRoutes from './routes/staffAdvanceRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import moduleAccessRoutes from './routes/moduleAccessRoutes.js';
import accessRoleRoutes from './routes/accessRoleRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Ensure Product indexes (drop legacy unique index that blocks multiple null/empty barcodes)
(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    }

    const idxs = await Product.collection.indexes();
    const companyBarcodeIdx = idxs.find(ix => ix.name === 'company_1_barcode_1');
    if (companyBarcodeIdx && companyBarcodeIdx.unique) {
      await Product.collection.dropIndex('company_1_barcode_1');
      console.log('✅ Dropped legacy unique index company_1_barcode_1 (product barcode per company)');
    }

    // Clean bad historical values that may have been stored as null/empty
    await Product.updateMany({ barcode: null }, { $unset: { barcode: '' } });
    await Product.updateMany({ barcode: '' }, { $unset: { barcode: '' } });

    // Recreate indexes as per schema (includes partial unique index)
    await Product.createIndexes();
  } catch (e) {
    if (e?.codeName !== 'IndexNotFound') {
      console.warn('⚠️  Product index migration failed:', e?.message || e);
    }
  }
})();

// Ensure default admin exists (dev-friendly)
(async () => {
  try {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    const password = (process.env.ADMIN_PASSWORD || 'admin123').trim();
    let admin = await User.findOne({ username });
    if (!admin) {
      admin = new User({ username, password, role: 'admin', name: 'Admin User', email: 'admin@petshospital.com', isActive: true });
      await admin.save();
      console.log(`✅ Default admin created: ${username}`);
    } else {
      let updated = false;
      if (admin.password !== password) { admin.password = password; updated = true; }
      if (!admin.isActive) { admin.isActive = true; updated = true; }
      if (admin.role !== 'admin') { admin.role = 'admin'; updated = true; }
      if (updated) { await admin.save(); console.log(`✅ Admin ensured/updated: ${username}`); }
    }
  } catch (e) {
    console.warn('⚠️  Failed to ensure default admin:', e?.message || e);
  }
})();

// Ensure default portal users exist (dev-friendly)
(async () => {
  try {
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    if (nodeEnv === 'production') return;

    const defaultUsers = [
      {
        username: (process.env.RECEPTION_USERNAME || 'reception').trim(),
        password: (process.env.RECEPTION_PASSWORD || 'reception123').trim(),
        role: 'reception',
        name: 'Reception Staff',
        email: 'reception@petshospital.com',
        isActive: true,
      },
      {
        username: (process.env.DOCTOR_USERNAME || 'doctor').trim(),
        password: (process.env.DOCTOR_PASSWORD || 'doctor123').trim(),
        role: 'doctor',
        name: 'Dr. Ahmed Khan',
        email: 'doctor@petshospital.com',
        isActive: true,
      },
      {
        username: (process.env.LAB_USERNAME || 'lab').trim(),
        password: (process.env.LAB_PASSWORD || 'lab123').trim(),
        role: 'lab',
        name: 'Lab Technician',
        email: 'lab@petshospital.com',
        isActive: true,
      },
      {
        username: (process.env.PHARMACY_USERNAME || 'pharmacy').trim(),
        password: (process.env.PHARMACY_PASSWORD || 'pharmacy123').trim(),
        role: 'pharmacy',
        name: 'Pharmacy Staff',
        email: 'pharmacy@petshospital.com',
        isActive: true,
      },
      {
        username: (process.env.SHOP_USERNAME || 'shop').trim(),
        password: (process.env.SHOP_PASSWORD || 'shop123').trim(),
        role: 'shop',
        name: 'Pet Shop Manager',
        email: 'shop@petshospital.com',
        isActive: true,
      },
    ];

    for (const u of defaultUsers) {
      const existing = await User.findOne({ username: u.username });
      if (!existing) {
        const user = new User(u);
        await user.save();
        console.log(`✅ Default user created: ${u.username} (${u.role})`);
        continue;
      }

      let updated = false;
      if (!existing.isActive) { existing.isActive = true; updated = true; }
      if (existing.role !== u.role) { existing.role = u.role; updated = true; }
      if (updated) {
        await existing.save();
        console.log(`✅ User ensured/updated: ${u.username} (${u.role})`);
      }
    }
  } catch (e) {
    console.warn('⚠️  Failed to ensure default portal users:', e?.message || e);
  }
})();

// Ensure indexes: allow multiple pets per client by dropping old unique index on clientId if it exists
(async () => {
  try {
    const idxs = await Pet.collection.indexes();
    const hasUniqueClient = idxs.find(ix => ix.name === 'clientId_1' && ix.unique);
    if (hasUniqueClient) {
      await Pet.collection.dropIndex('clientId_1');
      console.log('✅ Dropped unique index clientId_1 to allow multiple pets per client');
    }
  } catch (e) {
    if (e?.codeName !== 'IndexNotFound') {
      console.warn('⚠️  Index check/drop failed:', e?.message || e);
    }
  }
})();

// Ensure PharmacyMedicine barcode index is unique (drop non-unique if exists)
(async () => {
  try {
    const idxs = await PharmacyMedicine.collection.indexes();
    const barcodeIdx = idxs.find(ix => ix.name === 'barcode_1');
    if (barcodeIdx && !barcodeIdx.unique) {
      await PharmacyMedicine.collection.dropIndex('barcode_1');
      console.log('✅ Dropped non-unique barcode index');
    }
    // Mongoose will (re)create indexes as per schema definition
  } catch (e) {
    if (e?.codeName !== 'IndexNotFound') {
      console.warn('⚠️  PharmacyMedicine index check failed:', e?.message || e);
    }
  }
})();

// Middleware
// Relax CORS to accept requests from any frontend origin (helps during local/dev usage)
app.use(cors({
  origin: true,
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Pet Matrix API Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/lab-reports', labReportRoutes);
app.use('/api/lab-tests', labTestRoutes);
app.use('/api/lab-requests', labRequestRoutes);
app.use('/api/radiology-reports', radiologyReportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/full-record', fullRecordRoutes);
app.use('/api/financial-summary', financialSummaryRoutes);
app.use('/api/backup', backupRoutes); // Mounted under /api/backup
app.use('/api/expenses', expensesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/doctor-profiles', doctorProfileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/shop-customers', shopCustomerRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/taxonomy', taxonomyRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/procedure-catalog', procedureCatalogRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/day', daySessionRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/payables', payablesRoutes);
app.use('/api/vendor-payments', vendorPaymentRoutes);
app.use('/api/staff-advances', staffAdvanceRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/module-access', moduleAccessRoutes);
app.use('/api/access-roles', accessRoleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Pet Matrix Backend`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});
