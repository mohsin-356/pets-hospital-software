import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminTopbar from '../components/AdminTopbar'
import { useActivity } from '../context/ActivityContext'
import DaySessionBanner from '../components/DaySessionBanner'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop collapsed icon-only
  const { addActivity } = useActivity()
  const { isPortalEnabled, isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const handleLogout = () => {
    try { addActivity({ user: 'Admin', text: 'Logout' }) } catch { }
    localStorage.removeItem('portal')
    navigate('/admin/login')
  }

  useEffect(() => {
    if (!isPortalEnabled('admin')) {
      navigate('/', { replace: true })
      return
    }

    const path = location.pathname || ''
    const submoduleByPath = (p) => {
      if (p === '/admin' || p === '/admin/') return 'dashboard'
      if (p.startsWith('/admin/users')) return 'users'
      if (p.startsWith('/admin/doctors')) return 'doctors'
      if (p.startsWith('/admin/pets')) return 'pets'
      if (p.startsWith('/admin/clients')) return 'clients'
      if (p.startsWith('/admin/financials')) return 'financials'
      if (p.startsWith('/admin/finance-center')) return 'financeCenter'
      if (p.startsWith('/admin/suppliers')) return 'suppliers'
      if (p.startsWith('/admin/day-sessions')) return 'daySessions'
      if (p.startsWith('/admin/receivables')) return 'receivables'
      if (p.startsWith('/admin/payables')) return 'payables'
      if (p.startsWith('/admin/vendor-payments')) return 'vendorPayments'
      if (p.startsWith('/admin/staff-advances')) return 'staffAdvances'
      if (p.startsWith('/admin/expenses')) return 'expenses'
      if (p.startsWith('/admin/inventory')) return 'inventory'
      if (p.startsWith('/admin/hospital-inventory')) return 'hospitalInventory'
      if (p.startsWith('/admin/logs')) return 'logs'
      if (p.startsWith('/admin/settings')) return 'settings'
      return 'dashboard'
    }

    const key = submoduleByPath(path)
    if (!isSubmoduleEnabled('admin', key) || !canAccess('admin', key)) {
      navigate('/admin', { replace: true })
    }
  }, [canAccess, isPortalEnabled, isSubmoduleEnabled, location.pathname, navigate])

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      setCollapsed(v => !v)
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))]">
      <div className="print:hidden">
        <AdminTopbar adminName="Main Admin" onLogout={handleLogout} onToggle={handleToggle} />
      </div>
      <div className="flex min-h-[calc(100vh-56px)]">
        <div className="print:hidden">
          <AdminSidebar collapsed={collapsed} open={open} onClose={() => setOpen(false)} onLogout={handleLogout} />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">
          <DaySessionBanner portal="admin" userName="Main Admin" />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

