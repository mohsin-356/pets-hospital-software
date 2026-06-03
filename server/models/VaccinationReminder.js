import mongoose from 'mongoose';

const vaccinationReminderSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  petId: {
    type: String,
    required: true,
    index: true
  },
  petName: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  ownerContact: {
    type: String,
    required: true
  },
  vaccineName: {
    type: String,
    required: true
  },
  lastVaccinationDate: {
    type: Date,
    required: true
  },
  nextDueDate: {
    type: Date,
    required: true,
    index: true
  },
  shotStage: {
    type: String,
    default: ''
  },
  periodicMonths: {
    type: Number,
    default: 12
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  reminderSentVia: {
    type: String,
    enum: ['WhatsApp', 'SMS', 'Email', ''],
    default: ''
  },
  clinicName: {
    type: String,
    default: 'Pets Hospital'
  },
  status: {
    type: String,
    enum: ['Pending', 'Sent', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for querying upcoming reminders
vaccinationReminderSchema.index({ nextDueDate: 1, reminderSent: 1 });
vaccinationReminderSchema.index({ petId: 1, vaccineName: 1 });

export default mongoose.model('VaccinationReminder', vaccinationReminderSchema);
