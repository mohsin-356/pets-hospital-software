import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { FiGrid, FiUsers, FiBookOpen, FiDollarSign, FiBox, FiActivity, FiLogOut, FiSettings, FiTrendingDown, FiUserCheck, FiHome, FiClock, FiChevronDown } from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function AdminSidebar({ onLogout, open = false, onClose = () => {}, collapsed = false, onCollapse = () => {} }) {
  const { settings } = useSettings()
  const { isSubmoduleEnabled } = useModuleAccess()
  const { canAccess } = useAccessRoles()
  const location = useLocation()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive
      ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm'
      : 'text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-primary))]/10 hover:text-[hsl(var(--pm-primary))]'
  }`
  const subLinkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
    isActive
      ? 'bg-[hsl(var(--pm-primary))]/10 text-[hsl(var(--pm-primary))]'
      : 'text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-primary))]/10 hover:text-[hsl(var(--pm-primary))]'
  }`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const financeItems = useMemo(() => ([
    { to: '/admin/financials', label: 'Financial Reports', Icon: FiDollarSign, key: 'financials' },
    { to: '/admin/finance-center', label: 'Finance Center', Icon: FiDollarSign, key: 'financeCenter' },
    { to: '/admin/receivables', label: 'Receivables', Icon: FiDollarSign, key: 'receivables' },
    { to: '/admin/payables', label: 'Payables', Icon: FiDollarSign, key: 'payables' },
    { to: '/admin/vendor-payments', label: 'Vendor Payments', Icon: FiDollarSign, key: 'vendorPayments' },
    { to: '/admin/staff-advances', label: 'Staff Advances', Icon: FiDollarSign, key: 'staffAdvances' },
    { to: '/admin/day-sessions', label: 'Day Sessions', Icon: FiClock, key: 'daySessions' },
    { to: '/admin/expenses', label: 'Expenses', Icon: FiTrendingDown, key: 'expenses' },
  ]).filter(i => isSubmoduleEnabled('admin', i.key) && canAccess('admin', i.key)), [canAccess, isSubmoduleEnabled])

  const financeActive = useMemo(() => {
    const path = location?.pathname || ''
    return financeItems.some(i => path === i.to || path.startsWith(`${i.to}/`))
  }, [financeItems, location?.pathname])

  const [financeOpen, setFinanceOpen] = useState(false)

  useEffect(() => {
    if (collapsed) {
      setFinanceOpen(false)
      return
    }
    if (financeActive) setFinanceOpen(true)
  }, [collapsed, financeActive])

  const Nav = (
    <nav className="space-y-1">
      {isSubmoduleEnabled('admin', 'dashboard') && canAccess('admin', 'dashboard') && (
        <NavLink to="/admin" end className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiGrid size={iconSize} className={iconClass} /> {!collapsed && <span>Dashboard</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'users') && canAccess('admin', 'users') && (
        <NavLink to="/admin/users" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUsers size={iconSize} className={iconClass} /> {!collapsed && <span>Users</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'doctors') && canAccess('admin', 'doctors') && (
        <NavLink to="/admin/doctors" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUserCheck size={iconSize} className={iconClass} /> {!collapsed && <span>Doctors</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'pets') && canAccess('admin', 'pets') && (
        <NavLink to="/admin/pets" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiBookOpen size={iconSize} className={iconClass} /> {!collapsed && <span>Pets Records</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'clients') && canAccess('admin', 'clients') && (
        <NavLink to="/admin/clients" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUserCheck size={iconSize} className={iconClass} /> {!collapsed && <span>Clients Directory</span>}
        </NavLink>
      )}
      {financeItems.length > 0 && (
        <div className={`${linkClass({ isActive: financeActive })} ${collapsed ? 'justify-center px-2' : ''}`}>
          <NavLink
            to={financeItems[0]?.to || '/admin/finance-center'}
            className={`flex items-center gap-3 ${collapsed ? '' : 'flex-1'}`}
            onClick={() => {
              if (!collapsed) setFinanceOpen(true)
              onClose()
            }}
          >
            <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Finance</span>}
          </NavLink>
          {!collapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFinanceOpen(v => !v)
              }}
              className="ml-auto h-8 w-8 grid place-items-center rounded-md text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-primary))]/10"
              aria-label="Toggle finance menu"
              aria-expanded={financeOpen}
            >
              <FiChevronDown size={16} className={`transition-transform ${financeOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {!collapsed && financeOpen && (
        <div className="ml-4 pl-2 border-l border-[hsl(var(--pm-border))] space-y-1">
          {financeItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => subLinkClass({ isActive })}
              onClick={onClose}
            >
              <Icon size={16} /> <span>{label}</span>
            </NavLink>
          ))}
        </div>
      )}
      {isSubmoduleEnabled('admin', 'suppliers') && canAccess('admin', 'suppliers') && (
        <NavLink to="/admin/suppliers" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiUsers size={iconSize} className={iconClass} /> {!collapsed && <span>Suppliers</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'inventory') && canAccess('admin', 'inventory') && (
        <NavLink to="/admin/inventory" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiBox size={iconSize} className={iconClass} /> {!collapsed && <span>Inventory</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'hospitalInventory') && canAccess('admin', 'hospitalInventory') && (
        <NavLink to="/admin/hospital-inventory" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiHome size={iconSize} className={iconClass} /> {!collapsed && <span>Hospital Inventory</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'logs') && canAccess('admin', 'logs') && (
        <NavLink to="/admin/logs" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiActivity size={iconSize} className={iconClass} /> {!collapsed && <span>System Logs</span>}
        </NavLink>
      )}
      {isSubmoduleEnabled('admin', 'settings') && canAccess('admin', 'settings') && (
        <NavLink to="/admin/settings" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
          <FiSettings size={iconSize} className={iconClass} /> {!collapsed && <span>Settings</span>}
        </NavLink>
      )}
      <button onClick={onLogout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition text-sm font-medium`}>
        <FiLogOut size={iconSize} className={iconClass} /> {!collapsed && <span>Logout</span>}
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

