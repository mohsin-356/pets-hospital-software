import mongoose from 'mongoose';

const ModuleAccessSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('ModuleAccess', ModuleAccessSchema);
