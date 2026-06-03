import express from 'express';
import VaccinationReminder from '../models/VaccinationReminder.js';
import Pet from '../models/Pet.js';

const router = express.Router();

// Generate unique ID
const generateId = () => `VAXREM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Get all reminders with optional filters
router.get('/', async (req, res) => {
  try {
    const { petId, status, startDate, endDate, reminderSent } = req.query;
    const filter = {};
    
    if (petId) filter.petId = petId;
    if (status) filter.status = status;
    if (reminderSent !== undefined) filter.reminderSent = reminderSent === 'true';
    if (startDate || endDate) {
      filter.nextDueDate = {};
      if (startDate) filter.nextDueDate.$gte = new Date(startDate);
      if (endDate) filter.nextDueDate.$lte = new Date(endDate);
    }
    
    const reminders = await VaccinationReminder.find(filter).sort({ nextDueDate: 1 });
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get upcoming reminders (for next 7 days)
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    const reminders = await VaccinationReminder.find({
      nextDueDate: { $gte: today, $lte: nextWeek },
      reminderSent: false,
      status: 'Pending'
    }).sort({ nextDueDate: 1 });
    
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single reminder
router.get('/:id', async (req, res) => {
  try {
    const reminder = await VaccinationReminder.findOne({ id: req.params.id });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new reminder
router.post('/', async (req, res) => {
  try {
    const reminderData = {
      id: generateId(),
      ...req.body,
      reminderSent: false,
      status: 'Pending'
    };
    
    const reminder = new VaccinationReminder(reminderData);
    await reminder.save();
    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update reminder
router.put('/:id', async (req, res) => {
  try {
    const reminder = await VaccinationReminder.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Mark reminder as sent
router.post('/:id/send', async (req, res) => {
  try {
    const { sentVia, messageStatus } = req.body;
    const reminder = await VaccinationReminder.findOneAndUpdate(
      { id: req.params.id },
      {
        reminderSent: true,
        reminderSentAt: new Date(),
        reminderSentVia: sentVia || 'WhatsApp',
        status: messageStatus === 'failed' ? 'Pending' : 'Sent'
      },
      { new: true }
    );
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete reminder
router.delete('/:id', async (req, res) => {
  try {
    const reminder = await VaccinationReminder.findOneAndDelete({ id: req.params.id });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync reminders from pet vaccination records
router.post('/sync-from-pets', async (req, res) => {
  try {
    const pets = await Pet.find({ status: { $ne: 'Deceased' } });
    const createdReminders = [];
    const today = new Date();
    
    for (const pet of pets) {
      const vaccines = pet.details?.vaccines || [];
      const ownerContact = pet.details?.owner?.mobile || pet.details?.owner?.phone || pet.ownerContact;
      
      for (const vax of vaccines) {
        if (!vax.nextDue || !vax.name) continue;
        
        const nextDue = new Date(vax.nextDue);
        // Only create reminders for future or recent past dates
        if (nextDue < new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) continue;
        
        // Check if reminder already exists
        const existing = await VaccinationReminder.findOne({
          petId: pet.id,
          vaccineName: vax.name,
          nextDueDate: nextDue
        });
        
        if (!existing) {
          const reminder = new VaccinationReminder({
            id: generateId(),
            petId: pet.id,
            petName: pet.petName,
            ownerName: pet.ownerName,
            ownerContact: ownerContact || '',
            vaccineName: vax.name,
            lastVaccinationDate: vax.dateGiven ? new Date(vax.dateGiven) : null,
            nextDueDate: nextDue,
            shotStage: vax.shotStage || '',
            periodicMonths: vax.shotStage?.includes('Annual') ? 12 : 
                           vax.shotStage?.includes('1st') ? 1 :
                           vax.shotStage?.includes('2nd') ? 1 :
                           vax.shotStage?.includes('3rd') ? 1 : 12,
            reminderSent: false,
            status: 'Pending',
            clinicName: req.body.clinicName || 'Pets Hospital'
          });
          
          await reminder.save();
          createdReminders.push(reminder);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Created ${createdReminders.length} new reminders`,
      data: createdReminders 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate WhatsApp message link
router.get('/:id/whatsapp-link', async (req, res) => {
  try {
    const reminder = await VaccinationReminder.findOne({ id: req.params.id });
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    
    if (!reminder.ownerContact) {
      return res.status(400).json({ success: false, message: 'No contact number available' });
    }
    
    // Format phone for WhatsApp
    let phone = reminder.ownerContact.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    if (!phone.startsWith('92')) phone = '92' + phone;
    
    const lastVaxDate = reminder.lastVaccinationDate 
      ? new Date(reminder.lastVaccinationDate).toLocaleDateString('en-GB')
      : 'Unknown';
    
    const nextDueDate = new Date(reminder.nextDueDate).toLocaleDateString('en-GB');
    
    const message = `Assalam-o-Alaikum ${reminder.ownerName},

This is a gentle reminder from *${reminder.clinicName}* regarding your pet *${reminder.petName}*.

Vaccination Details:
- Vaccine: *${reminder.vaccineName}*
- Last Vaccination: ${lastVaxDate}
- Next Due Date: *${nextDueDate}*
${reminder.shotStage ? `- Shot Stage: ${reminder.shotStage}` : ''}

Please visit us to get your pet vaccinated on time for their health and safety.

Thank you,
${reminder.clinicName}`;
    
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    res.json({ 
      success: true, 
      data: { 
        waLink, 
        phone, 
        message,
        reminderId: reminder.id 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
