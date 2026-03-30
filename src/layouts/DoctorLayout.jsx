import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import DoctorTopbar from '../components/DoctorTopbar'
import DaySessionBanner from '../components/DaySessionBanner'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function DoctorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isPortalEnabled, isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('doctor_auth')
    if (!auth) navigate('/doctor/login')
  }, [navigate])

  useEffect(() => {
    if (!isPortalEnabled('doctor')) {
      navigate('/', { replace: true })
      return
    }

    const path = location.pathname || ''
    const submoduleByPath = (p) => {
      if (p === '/doctor' || p === '/doctor/') return 'dashboard'
      if (p.startsWith('/doctor/medicines')) return 'medicines'
      if (p.startsWith('/doctor/prescription')) return 'prescription'
      if (p.startsWith('/doctor/medical-forms')) return 'medicalForms'
      if (p.startsWith('/doctor/details')) return 'details'
      if (p.startsWith('/doctor/patients')) return 'patients'
      if (p.startsWith('/doctor/patient/')) return 'patients'
      if (p.startsWith('/doctor/settings')) return 'settings'
      return 'dashboard'
    }

    const key = submoduleByPath(path)
    if (!isSubmoduleEnabled('doctor', key) || !canAccess('doctor', key)) {
      navigate('/doctor', { replace: true })
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
        <DoctorTopbar onToggle={handleToggle} />
      </div>
      <div className="flex min-h-[calc(100vh-56px)]">
        <div className="print:hidden">
          <DoctorSidebar collapsed={collapsed} open={open} onClose={() => setOpen(false)} />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">
          <DaySessionBanner portal="doctor" userName={(JSON.parse(localStorage.getItem('doctor_auth') || '{}').name) || 'Doctor'} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
