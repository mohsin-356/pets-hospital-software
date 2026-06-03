export const SUPER_ADMIN_EMAIL = 'alienmatrix0@gmail.com';
export const SUPER_ADMIN_PASSWORD = 'AlienMatrix017**';
export const SUPER_ADMIN_LICENSE_KEY = 'A9FqX2mR8ZL7pDkWJtYB6Hc0eS1VfN4UoM5IagCwTQrEbhyKxPn3sOlDiuFvJzR4A0m8c6';

export function verifySuperAdminCredentials({ ownerEmail, ownerPassword, licenseKey }) {
  return (
    String(ownerEmail).trim() === SUPER_ADMIN_EMAIL &&
    String(ownerPassword) === SUPER_ADMIN_PASSWORD &&
    String(licenseKey).trim() === SUPER_ADMIN_LICENSE_KEY
  );
}

export function verifyLicenseKeyOnly(licenseKey) {
  return String(licenseKey).trim() === SUPER_ADMIN_LICENSE_KEY;
}
