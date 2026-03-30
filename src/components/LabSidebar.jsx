import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiFilePlus, FiList, FiActivity, FiPackage, FiSettings, FiLogOut, FiImage, FiClipboard } from 'react-icons/fi'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function LabSidebar({ collapsed=false, open=false, onClose=()=>{} }){
  const navigate = useNavigate()
  const { isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive
      ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm'
      : 'text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-bg))] hover:text-[hsl(var(--pm-text))]'
  }`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const logout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('lab_auth')
    navigate('/lab/login')
  }

  const Nav = (
    <nav className="space-y-1">
      {isSubmoduleEnabled('lab', 'dashboard') && canAccess('lab', 'dashboard') && (
        <NavLink to="/lab" end className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiGrid size={iconSize} className={iconClass} /> {!collapsed && <span>Dashboard</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'catalog') && canAccess('lab', 'catalog') && (
        <NavLink to="/lab/catalog" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiActivity size={iconSize} className={iconClass} /> {!collapsed && <span>Test Catalog</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'addReport') && canAccess('lab', 'addReport') && (
        <NavLink to="/lab/add-report" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiFilePlus size={iconSize} className={iconClass} /> {!collapsed && <span>Test Reports</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'radiology') && canAccess('lab', 'radiology') && (
        <NavLink to="/lab/radiology" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiImage size={iconSize} className={iconClass} /> {!collapsed && <span>Radiology</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'inventory') && canAccess('lab', 'inventory') && (
        <NavLink to="/lab/inventory" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiPackage size={iconSize} className={iconClass} /> {!collapsed && <span>Inventory</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'sampleIntake') && canAccess('lab', 'sampleIntake') && (
        <NavLink to="/lab/sample-intake" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiClipboard size={iconSize} className={iconClass} /> {!collapsed && <span>Sample Intake</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'suppliers') && canAccess('lab', 'suppliers') && (
        <NavLink to="/lab/suppliers" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiList size={iconSize} className={iconClass} /> {!collapsed && <span>Suppliers</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('lab', 'settings') && canAccess('lab', 'settings') && (
        <NavLink to="/lab/settings" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiSettings size={iconSize} className={iconClass} /> {!collapsed && <span>Settings</span>}
        </NavLink>
      )}
      <button onClick={logout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition text-sm font-medium`}>
        <FiLogOut size={iconSize} className={iconClass} /> {!collapsed && <span>Logout</span>}
      </button>
    </nav>
  )

  return (
    <>
      <aside className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-[hsl(var(--pm-surface))]/80 backdrop-blur border-r border-[hsl(var(--pm-border))] p-3 hidden md:block transition-all`}>
        {Nav}
      </aside>
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[hsl(var(--pm-surface))] p-3 border-r border-[hsl(var(--pm-border))] shadow-xl md:hidden transform transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md border border-[hsl(var(--pm-border))] text-[hsl(var(--pm-text-muted))]" aria-label="Close sidebar">×</button>
        </div>
        <div className="mt-2">{Nav}</div>
      </aside>
    </>
  )
}
