import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiUserPlus, FiCalendar, FiFileText, FiLogOut, FiClipboard, FiUsers, FiSettings } from 'react-icons/fi'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function ReceptionSidebar({ open = false, onClose = () => { }, collapsed = false }) {
  const navigate = useNavigate()
  const { isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive
      ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm'
      : 'text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-bg))] hover:text-[hsl(var(--pm-text))]'
  }`

  const handleLogout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('reception_auth')
    navigate('/reception/login')
  }

  const Nav = (
    <nav className="space-y-1">
      {isSubmoduleEnabled('reception', 'dashboard') && canAccess('reception', 'dashboard') && (
        <NavLink to="/reception" end className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiGrid size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Dashboard</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'pets') && canAccess('reception', 'pets') && (
        <NavLink to="/reception/pets" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUserPlus size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Pets Registration</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'clients') && canAccess('reception', 'clients') && (
        <NavLink to="/reception/clients" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUsers size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Clients Directory</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'appointments') && canAccess('reception', 'appointments') && (
        <NavLink to="/reception/appointments" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiCalendar size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Appointments</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'visits') && canAccess('reception', 'visits') && (
        <NavLink to="/reception/visits" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiFileText size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Visit Records</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'forms') && canAccess('reception', 'forms') && (
        <NavLink to="/reception/forms" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiClipboard size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Medical Forms</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'procedures') && canAccess('reception', 'procedures') && (
        <NavLink to="/reception/procedures" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiClipboard size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Procedures</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('reception', 'settings') && canAccess('reception', 'settings') && (
        <NavLink to="/reception/settings" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiSettings size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Settings</span>}
        </NavLink>
      )}
      <button onClick={handleLogout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition text-sm font-medium`}>
        <FiLogOut size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Logout</span>}
      </button>
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-[hsl(var(--pm-surface))]/80 backdrop-blur border-r border-[hsl(var(--pm-border))] p-3 hidden md:block transition-all`}>
        {Nav}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[hsl(var(--pm-surface))] p-3 border-r border-[hsl(var(--pm-border))] shadow-xl md:hidden transform transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md border border-[hsl(var(--pm-border))] text-[hsl(var(--pm-text-muted))]" aria-label="Close sidebar">×</button>
        </div>
        <div className="mt-2">{Nav}</div>
      </aside>
    </>
  )
}