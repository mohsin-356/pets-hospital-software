import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');

export const SUPER_ADMIN_EMAIL_HASH = '08636406fef8b54055c4a725be8cac9775e1a64dc05fca2eefd1ff206e18477f';
export const SUPER_ADMIN_PASSWORD_HASH = '75e2d1a12c6147a066bc89bf057a2108d1fdc4e5dbd8781a5672ffed0bc64a74';
export const SUPER_ADMIN_LICENSE_KEY_HASH = '168b5e6cb426052a571f3d88e732510955db924a66e43b3b1efdb7d024e2e4cb';

export function verifySuperAdminCredentials({ ownerEmail, ownerPassword, licenseKey }) {
  const emailHash = sha256(ownerEmail);
  const passwordHash = sha256(ownerPassword);
  const keyHash = sha256(licenseKey);
  return (
    emailHash === SUPER_ADMIN_EMAIL_HASH &&
    passwordHash === SUPER_ADMIN_PASSWORD_HASH &&
    keyHash === SUPER_ADMIN_LICENSE_KEY_HASH
  );
}

export function verifyLicenseKeyOnly(licenseKey) {
  const keyHash = sha256(licenseKey);
  return keyHash === SUPER_ADMIN_LICENSE_KEY_HASH;
}
