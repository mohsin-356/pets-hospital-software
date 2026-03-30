import express from 'express';
import Appointment from '../models/Appointment.js';
import Pet from '../models/Pet.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ date: -1, time: -1 });
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ id: req.params.id });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const petId = body.petId ? String(body.petId).trim() : '';
    const nextVisitDiscountPercentInput = body.nextVisitDiscountPercent;
    const enteredNextDiscount = Number(nextVisitDiscountPercentInput ?? 0);
    const safeEnteredNextDiscount = Number.isFinite(enteredNextDiscount) ? Math.min(100, Math.max(0, enteredNextDiscount)) : 0;

    let appliedDiscountPercent = 0;
    let petVisitNumber = 1;

    if (petId) {
      const pet = await Pet.findOne({ id: petId });
      if (pet) {
        const saved = Number(pet.nextVisitDiscountPercent ?? 0);
        appliedDiscountPercent = Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 0;
        const currentCount = Number(pet.visitCount ?? 0);
        const safeCount = Number.isFinite(currentCount) && currentCount >= 0 ? currentCount : 0;
        petVisitNumber = safeCount + 1;

        // Increment visit count immediately on appointment creation (as requested)
        pet.visitCount = petVisitNumber;
        // Save newly entered next-visit discount for future appointment
        pet.nextVisitDiscountPercent = safeEnteredNextDiscount;
        await pet.save();
      }
    }

    const appointment = new Appointment({
      ...body,
      appliedDiscountPercent,
      nextVisitDiscountPercent: safeEnteredNextDiscount,
      petVisitNumber
    });
    await appointment.save();
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ id: req.params.id });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
