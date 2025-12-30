import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import DoctorTopbar from '../components/DoctorTopbar'
import DaySessionBanner from '../components/DaySessionBanner'

export default function DoctorLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('doctor_auth')
    if (!auth) navigate('/doctor/login')
  }, [navigate])

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      setCollapsed(v => !v)
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="min-h-screen bg-hospital-blue text-slate-800">
      <div className="print:hidden">
        <DoctorTopbar onToggle={handleToggle} />
      </div>
      <div className="flex min-h-[calc(100vh-56px)]">
        <div className="print:hidden">
          <DoctorSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">
          <DaySessionBanner portal="doctor" userName={(JSON.parse(localStorage.getItem('doctor_auth')||'{}').name)||'Doctor'} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
