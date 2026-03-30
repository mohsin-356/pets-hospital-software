import mongoose from 'mongoose';

const licenseStateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive',
  },
  duration: {
    type: String,
    enum: ['one-week', 'one-month', 'one-year', 'lifetime'],
    required: false,
  },
  activatedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  lastVerifiedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

licenseStateSchema.index({ key: 1 });

const LicenseState = mongoose.model('LicenseState', licenseStateSchema);

export default LicenseState;
