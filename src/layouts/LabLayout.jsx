import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import LabSidebar from '../components/LabSidebar'
import LabTopbar from '../components/LabTopbar'
import DaySessionBanner from '../components/DaySessionBanner'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function LabLayout(){
  const navigate = useNavigate()
  const location = useLocation()
  const { isPortalEnabled, isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(()=>{
    const auth = localStorage.getItem('lab_auth')
    if(!auth) navigate('/lab/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!isPortalEnabled('lab')) {
      navigate('/', { replace: true })
      return
    }

    const path = location.pathname || ''
    const submoduleByPath = (p) => {
      if (p === '/lab' || p === '/lab/') return 'dashboard'
      if (p.startsWith('/lab/catalog')) return 'catalog'
      if (p.startsWith('/lab/requests')) return 'requests'
      if (p.startsWith('/lab/add-report')) return 'addReport'
      if (p.startsWith('/lab/reports')) return 'reports'
      if (p.startsWith('/lab/inventory')) return 'inventory'
      if (p.startsWith('/lab/suppliers')) return 'suppliers'
      if (p.startsWith('/lab/sample-intake')) return 'sampleIntake'
      if (p.startsWith('/lab/radiology')) return 'radiology'
      if (p.startsWith('/lab/settings')) return 'settings'
      return 'dashboard'
    }

    const key = submoduleByPath(path)
    if (!isSubmoduleEnabled('lab', key) || !canAccess('lab', key)) {
      navigate('/lab', { replace: true })
    }
  }, [canAccess, isPortalEnabled, isSubmoduleEnabled, location.pathname, navigate])

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) setCollapsed(v=>!v)
    else setOpen(v=>!v)
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))]">
      <LabTopbar onToggle={handleToggle} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <LabSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} />
        <main className="flex-1 p-4 md:p-6">
          <DaySessionBanner portal="lab" userName={(JSON.parse(localStorage.getItem('lab_auth')||'{}').name)||'Lab Staff'} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
