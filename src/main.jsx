import React from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate, redirect } from 'react-router-dom'
import App from './App'
import './style.css'
import { SettingsProvider } from './context/SettingsContext'
import { ActivityProvider } from './context/ActivityContext'
import { ModuleAccessProvider } from './context/ModuleAccessContext'
import { AccessRoleProvider } from './context/AccessRoleContext'
import SuperAdminLogin, { getLocalLicenseState, setLocalLicenseState, clearLocalLicenseState } from './pages/SuperAdminLogin'
import SuperAdminModules from './pages/SuperAdminModules'
import { licenseAPI } from './services/api'

import Home from './pages/Home'
import AdminLogin from './pages/AdminLogin'
import ReceptionLogin from './pages/ReceptionLogin'
import PharmacyLogin from './pages/PharmacyLogin'
import LabLogin from './pages/LabLogin'
import ShopLogin from './pages/ShopLogin'
import DoctorLogin from './pages/DoctorLogin'
import PortalRouteGuard from './components/PortalRouteGuard'

import ReceptionDashboard from './pages/dashboards/ReceptionDashboard'
import PharmacyDashboard from './pages/dashboards/PharmacyDashboard'
import LabDashboard from './pages/dashboards/LabDashboard'
import ShopDashboard from './pages/dashboards/ShopDashboard'
import DoctorDashboard from './pages/doctor/Dashboard'
import DoctorMedicines from './pages/doctor/Medicines'
import DoctorPrescription from './pages/doctor/Prescription'
import DoctorDetails from './pages/doctor/Details'
import PatientHistory from './pages/doctor/PatientHistory'
import DoctorPatients from './pages/doctor/Patients'
import DoctorMedicalForms from './pages/doctor/MedicalForms'
import DoctorSettings from './pages/doctor/Settings'
import AdminLayout from './layouts/AdminLayout'
import ReceptionLayout from './layouts/ReceptionLayout'
import LabLayout from './layouts/LabLayout'
import DoctorLayout from './layouts/DoctorLayout'
import ReceptionPortalDashboard from './pages/reception/Dashboard.jsx'
import ReceptionPets from './pages/reception/Pets'
import ReceptionClients from './pages/reception/Clients'
import ReceptionAppointments from './pages/reception/Appointments'
import ReceptionVisits from './pages/reception/Visits'
import ReceptionBilling from './pages/reception/Billing'
import ReceptionReports from './pages/reception/Reports.jsx'
import ReceptionForms from './pages/reception/Forms.jsx'
import ReceptionProcedures from './pages/reception/Procedures.jsx'
import ReceptionSettings from './pages/reception/Settings.jsx'
import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import Doctors from './pages/admin/Doctors'
import Pets from './pages/admin/Pets'
import Clients from './pages/admin/Clients'
import Financials from './pages/admin/Financials'
import Expenses from './pages/admin/Expenses'
import Inventory from './pages/admin/Inventory'
import HospitalInventory from './pages/admin/HospitalInventory'
import Logs from './pages/admin/Logs'
import Settings from './pages/admin/Settings'
import FinanceAndCenter from './pages/admin/FinanceAndCenter'
import DaySessions from './pages/admin/DaySessions'
import Receivables from './pages/admin/Receivables'
import Payables from './pages/admin/Payables'
import VendorPayments from './pages/admin/VendorPayments'
import StaffAdvances from './pages/admin/StaffAdvances'
import AdminSuppliers from './pages/admin/Suppliers'
import LabHome from './pages/lab/Dashboard'
import LabRequests from './pages/lab/Requests'
import LabAddReport from './pages/lab/AddReport'
import LabReports from './pages/lab/Reports'
import LabInventory from './pages/lab/Inventory'
import Radiology from './pages/lab/Radiology'
import LabCatalog from './pages/lab/Catalog'
import LabSettings from './pages/lab/Settings'
import LabSuppliers from './pages/lab/Suppliers'
import LabSampleIntake from './pages/lab/SampleIntake'
import ShopLayout from './layouts/ShopLayout'
import ShopDashboardPage from './pages/shop/ShopDashboard'
import Products from './pages/shop/Products'
import POS from './pages/shop/POS'
import ShopSuppliers from './pages/shop/Suppliers'
import ShopDistributors from './pages/shop/Distributors'
import SalesReports from './pages/shop/SalesReports'
import ShopSettings from './pages/shop/Settings'
import PharmacyLayout from './layouts/PharmacyLayout'
import PharmacyDashboardNew from './pages/pharmacy/Dashboard'
import Medicines from './pages/pharmacy/Medicines'
import PharmacyPrescriptions from './pages/pharmacy/Prescriptions'
import PharmacyPOS from './pages/pharmacy/POS'
import PharmacyReports from './pages/pharmacy/Reports'
import PharmacySuppliers from './pages/pharmacy/Suppliers'
import PharmacySettings from './pages/pharmacy/Settings'

function isExpired(expiresAtIso) {
  if (!expiresAtIso) return false
  const t = new Date(expiresAtIso).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() >= t
}

function shouldWarnExpiresSoon(expiresAtIso) {
  if (!expiresAtIso) return false
  const t = new Date(expiresAtIso).getTime()
  if (!Number.isFinite(t)) return false
  const diffMs = t - Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  return diffMs > 0 && diffMs <= oneDayMs
}

async function ensureLicenseOrThrowRedirect() {
  // 1) Check local cache first
  const local = getLocalLicenseState()
  if (local?.status === 'active' && !isExpired(local.expiresAt)) {
    // Special rule: lifetime must be verified on every app launch
    if (local.duration === 'lifetime') {
      try {
        const verified = sessionStorage.getItem('pmx_lifetime_verified_v1')
        if (verified !== '1') throw new Error('Lifetime not verified in this session')
      } catch {
        throw redirect('/super-admin')
      }
    }

    // Soft warning: 1 day before expiry
    if (shouldWarnExpiresSoon(local.expiresAt)) {
      try { alert('Trial/subscription will end within 1 day. Please renew from Super Admin login.') } catch {}
    }
    return true
  }

  // 2) If local says expired or missing, verify with server
  try {
    const res = await licenseAPI.status()
    const s = res?.data
    if (s?.status === 'active' && !isExpired(s.expiresAt)) {
      setLocalLicenseState({
        status: s.status,
        duration: s.duration,
        activatedAt: s.activatedAt,
        expiresAt: s.expiresAt,
      })
      if (shouldWarnExpiresSoon(s.expiresAt)) {
        try { alert('Trial/subscription will end within 1 day. Please renew from Super Admin login.') } catch {}
      }
      return true
    }
  } catch {
    // If API is unavailable, we fail closed (show super-admin)
  }

  clearLocalLicenseState()
  throw redirect('/super-admin')
}

const router = createHashRouter([
  {
    path: '/super-admin',
    element: <SuperAdminLogin />,
  },
  {
    path: '/super-admin/modules',
    element: <SuperAdminModules />,
  },
  {
    path: '/',
    element: <App />,
    loader: ensureLicenseOrThrowRedirect,
    children: [
      { index: true, element: <Home /> },
      { path: 'admin-login', element: <AdminLogin /> },
      { path: 'admin/login', element: <AdminLogin /> },
      { path: 'reception-login', element: <ReceptionLogin /> },
      { path: 'reception/login', element: <ReceptionLogin /> },
      { path: 'pharmacy-login', element: <PharmacyLogin /> },
      { path: 'pharmacy/login', element: <PharmacyLogin /> },
      { path: 'lab-login', element: <LabLogin /> },
      { path: 'lab/login', element: <LabLogin /> },
      { path: 'shop-login', element: <ShopLogin /> },
      { path: 'shop/login', element: <ShopLogin /> },
      { path: 'doctor-login', element: <DoctorLogin /> },
      { path: 'doctor/login', element: <DoctorLogin /> },
      { path: 'admin/dashboard', element: <Navigate to="/admin" replace /> },
      {
        path: 'reception/dashboard',
        element: (
          <PortalRouteGuard portal="reception" submodule="dashboard">
            <ReceptionPortalDashboard />
          </PortalRouteGuard>
        ),
      },
      {
        path: 'pharmacy/dashboard',
        element: (
          <PortalRouteGuard portal="pharmacy" submodule="dashboard">
            <PharmacyDashboardNew />
          </PortalRouteGuard>
        ),
      },
      {
        path: 'lab/dashboard',
        element: (
          <PortalRouteGuard portal="lab" submodule="dashboard">
            <LabDashboard />
          </PortalRouteGuard>
        ),
      },
      {
        path: 'shop/dashboard',
        element: (
          <PortalRouteGuard portal="shop" submodule="dashboard">
            <ShopDashboard />
          </PortalRouteGuard>
        ),
      },
      {
        path: 'doctor/dashboard',
        element: (
          <PortalRouteGuard portal="doctor" submodule="dashboard">
            <DoctorDashboard />
          </PortalRouteGuard>
        ),
      },

      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'users', element: <Users /> },
          { path: 'doctors', element: <Doctors /> },
          { path: 'pets', element: <Pets /> },
          { path: 'clients', element: <Clients /> },
          { path: 'financials', element: <Financials /> },
          { path: 'finance-center', element: <FinanceAndCenter /> },
          { path: 'suppliers', element: <AdminSuppliers /> },
          { path: 'day-sessions', element: <DaySessions /> },
          { path: 'receivables', element: <Receivables /> },
          { path: 'payables', element: <Payables /> },
          { path: 'vendor-payments', element: <VendorPayments /> },
          { path: 'staff-advances', element: <StaffAdvances /> },
          { path: 'expenses', element: <Expenses /> },
          { path: 'inventory', element: <Inventory /> },
          { path: 'hospital-inventory', element: <HospitalInventory /> },
          { path: 'logs', element: <Logs /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
      {
        path: 'reception',
        element: <ReceptionLayout />,
        children: [
          { index: true, element: <ReceptionPortalDashboard /> },
          { path: 'pets', element: <ReceptionPets /> },
          { path: 'clients', element: <ReceptionClients /> },
          { path: 'appointments', element: <ReceptionAppointments /> },
          { path: 'visits', element: <ReceptionVisits /> },
          { path: 'billing', element: <ReceptionBilling /> },
          { path: 'reports', element: <ReceptionReports /> },
          { path: 'forms', element: <ReceptionForms /> },
          { path: 'procedures', element: <ReceptionProcedures /> },
          { path: 'settings', element: <ReceptionSettings /> },
        ],
      },
      {
        path: 'lab',
        element: <LabLayout />,
        children: [
          { index: true, element: <LabHome /> },
          { path: 'catalog', element: <LabCatalog /> },
          { path: 'requests', element: <LabRequests /> },
          { path: 'add-report', element: <LabAddReport /> },
          { path: 'reports', element: <LabReports /> },
          { path: 'inventory', element: <LabInventory /> },
          { path: 'suppliers', element: <LabSuppliers /> },
          { path: 'sample-intake', element: <LabSampleIntake /> },
          { path: 'radiology', element: <Radiology /> },
          { path: 'settings', element: <LabSettings /> },
        ],
      },
      {
        path: 'doctor',
        element: <DoctorLayout />,
        children: [
          { index: true, element: <DoctorDashboard /> },
          { path: 'medicines', element: <DoctorMedicines /> },
          { path: 'prescription', element: <DoctorPrescription /> },
          { path: 'details', element: <DoctorDetails /> },
          { path: 'patients', element: <DoctorPatients /> },
          { path: 'medical-forms', element: <DoctorMedicalForms /> },
          { path: 'patient/:id', element: <PatientHistory /> },
          { path: 'settings', element: <DoctorSettings /> },
        ],
      },
      {
        path: 'shop',
        element: <ShopLayout />,
        children: [
          { index: true, element: <ShopDashboardPage /> },
          { path: 'products', element: <Products /> },
          { path: 'pos', element: <POS /> },
          { path: 'suppliers', element: <ShopSuppliers /> },
          { path: 'distributors', element: <ShopDistributors /> },
          { path: 'reports', element: <SalesReports /> },
          { path: 'settings', element: <ShopSettings /> },
        ],
      },
      {
        path: 'pharmacy',
        element: <PharmacyLayout />,
        children: [
          { index: true, element: <PharmacyDashboardNew /> },
          { path: 'medicines', element: <Medicines /> },
          { path: 'suppliers', element: <PharmacySuppliers /> },
          { path: 'prescriptions', element: <PharmacyPrescriptions /> },
          { path: 'pos', element: <PharmacyPOS /> },
          { path: 'reports', element: <PharmacyReports /> },
          { path: 'settings', element: <PharmacySettings /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <SettingsProvider>
      <ModuleAccessProvider>
        <AccessRoleProvider>
          <ActivityProvider>
            <RouterProvider router={router} />
          </ActivityProvider>
        </AccessRoleProvider>
      </ModuleAccessProvider>
    </SettingsProvider>
  </React.StrictMode>
)

