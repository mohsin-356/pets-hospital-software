import express from 'express';
import LicenseState from '../models/LicenseState.js';
import { verifySuperAdminCredentials, verifyLicenseKeyOnly } from '../config/superAdminSecret.js';

const router = express.Router();

const DURATION_DAYS = {
  'one-week': 7,
  'one-month': 30,
  'one-year': 365,
};

function computeExpiry(duration) {
  if (duration === 'lifetime') return null;
  const days = DURATION_DAYS[duration];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function getOrCreate() {
  let doc = await LicenseState.findOne({ key: 'global' });
  if (!doc) {
    doc = new LicenseState({ key: 'global', status: 'inactive' });
    await doc.save();
  }
  return doc;
}

router.get('/status', async (_req, res) => {
  try {
    const doc = await getOrCreate();

    const now = new Date();
    let isActive = doc.status === 'active';
    let isExpired = false;

    if (doc.status === 'active' && doc.expiresAt) {
      if (now >= new Date(doc.expiresAt)) {
        isActive = false;
        isExpired = true;
      }
    }

    if (isExpired && doc.status !== 'inactive') {
      doc.status = 'inactive';
      await doc.save();
    }

    res.json({
      success: true,
      data: {
        status: isActive ? 'active' : 'inactive',
        duration: doc.duration || null,
        activatedAt: doc.activatedAt || null,
        expiresAt: doc.expiresAt || null,
        serverTime: now.toISOString(),
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

router.post('/activate', async (req, res) => {
  try {
    const { ownerEmail, ownerPassword, licenseKey, duration } = req.body || {};

    if (!ownerEmail || !ownerPassword || !licenseKey) {
      return res.status(400).json({ success: false, message: 'ownerEmail, ownerPassword and licenseKey are required' });
    }
    if (!duration || !['one-week', 'one-month', 'one-year', 'lifetime'].includes(duration)) {
      return res.status(400).json({ success: false, message: 'Valid duration is required' });
    }

    const ok = verifySuperAdminCredentials({ ownerEmail, ownerPassword, licenseKey });
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid owner credentials or license key' });
    }

    const doc = await getOrCreate();

    const now = new Date();
    doc.status = 'active';
    doc.duration = duration;
    doc.activatedAt = now;
    doc.expiresAt = computeExpiry(duration);
    doc.lastVerifiedAt = now;

    await doc.save();

    res.json({
      success: true,
      data: {
        status: doc.status,
        duration: doc.duration,
        activatedAt: doc.activatedAt,
        expiresAt: doc.expiresAt,
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

router.post('/deactivate', async (req, res) => {
  try {
    const { licenseKey } = req.body || {};
    if (!licenseKey) {
      return res.status(400).json({ success: false, message: 'licenseKey is required' });
    }

    const ok = verifyLicenseKeyOnly(licenseKey);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid license key' });
    }

    const doc = await getOrCreate();
    doc.status = 'inactive';
    doc.duration = null;
    doc.activatedAt = null;
    doc.expiresAt = null;
    doc.lastVerifiedAt = new Date();
    await doc.save();

    res.json({ success: true, data: { status: 'inactive' } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

export default router;
