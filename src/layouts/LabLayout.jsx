import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import LabSidebar from '../components/LabSidebar'
import LabTopbar from '../components/LabTopbar'
import DaySessionBanner from '../components/DaySessionBanner'

export default function LabLayout(){
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(()=>{
    const auth = localStorage.getItem('lab_auth')
    if(!auth) navigate('/lab/login', { replace: true })
  }, [navigate])

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) setCollapsed(v=>!v)
    else setOpen(v=>!v)
  }

  return (
    <div className="min-h-screen bg-hospital-blue text-slate-800">
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
