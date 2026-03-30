import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ReceptionSidebar from '../components/ReceptionSidebar'
import ReceptionTopbar from '../components/ReceptionTopbar'
import DaySessionBanner from '../components/DaySessionBanner'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function ReceptionLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isPortalEnabled, isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // auth guard
    const auth = localStorage.getItem('reception_auth')
    if (!auth) navigate('/reception/login')
  }, [navigate])

  useEffect(() => {
    if (!isPortalEnabled('reception')) {
      navigate('/', { replace: true })
      return
    }

    const path = location.pathname || ''
    const submoduleByPath = (p) => {
      if (p === '/reception' || p === '/reception/') return 'dashboard'
      if (p.startsWith('/reception/pets')) return 'pets'
      if (p.startsWith('/reception/clients')) return 'clients'
      if (p.startsWith('/reception/appointments')) return 'appointments'
      if (p.startsWith('/reception/visits')) return 'visits'
      if (p.startsWith('/reception/reports')) return 'reports'
      if (p.startsWith('/reception/forms')) return 'forms'
      if (p.startsWith('/reception/procedures')) return 'procedures'
      if (p.startsWith('/reception/settings')) return 'settings'
      return 'dashboard'
    }

    const key = submoduleByPath(path)
    if (!isSubmoduleEnabled('reception', key) || !canAccess('reception', key)) {
      navigate('/reception', { replace: true })
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
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))] overflow-x-hidden">
      <div className="print:hidden">
        <ReceptionTopbar onToggle={handleToggle} />
      </div>
      <div className="flex min-h-[calc(100vh-56px)] min-w-0 w-full">
        <div className="print:hidden">
          <ReceptionSidebar collapsed={collapsed} open={open} onClose={() => setOpen(false)} />
        </div>
        <main className="flex-1 min-w-0 p-4 md:p-6 print:p-0">
          <DaySessionBanner
            portal="reception"
            userName={(JSON.parse(localStorage.getItem('reception_auth') || '{}').name) || 'Reception Staff'}
          />
          <Outlet />
        </main>
      </div>
    </div>
  )
}