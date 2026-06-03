import mongoose from 'mongoose';

const pharmacyDueSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  name: { type: String, trim: true },
  customerContact: { type: String, trim: true },
  previousDue: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

// clientId already indexed by unique: true

const PharmacyDue = mongoose.model('PharmacyDue', pharmacyDueSchema);
export default PharmacyDue;
