import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FiHome, FiPackage, FiShoppingCart, FiFileText, 
  FiMenu, FiLogOut, FiUsers, FiSettings, FiArrowLeft 
} from 'react-icons/fi';
import { MdLocalPharmacy } from 'react-icons/md';
import { useSettings } from '../context/SettingsContext';
import DaySessionBanner from '../components/DaySessionBanner';
import { useModuleAccess } from '../context/ModuleAccessContext';
import { useAccessRoles } from '../context/AccessRoleContext';

export default function PharmacyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { isPortalEnabled, isSubmoduleEnabled } = useModuleAccess();
  const { canAccess } = useAccessRoles();

  const menuItems = useMemo(() => (
    [
      { path: '/pharmacy', icon: FiHome, label: 'Dashboard', exact: true, key: 'dashboard' },
      { path: '/pharmacy/medicines', icon: FiPackage, label: 'Medicines', key: 'medicines' },
      { path: '/pharmacy/suppliers', icon: FiUsers, label: 'Suppliers', key: 'suppliers' },
      { path: '/pharmacy/prescriptions', icon: FiFileText, label: 'Prescriptions', key: 'prescriptions' },
      { path: '/pharmacy/pos', icon: FiShoppingCart, label: 'Point of Sale', key: 'pos' },
      { path: '/pharmacy/reports', icon: FiFileText, label: 'Reports', key: 'reports' },
      { path: '/pharmacy/settings', icon: FiSettings, label: 'Settings', key: 'settings' },
    ]
      .filter(i => isSubmoduleEnabled('pharmacy', i.key) && canAccess('pharmacy', i.key))
  ), [canAccess, isSubmoduleEnabled]);

  useEffect(() => {
    if (!isPortalEnabled('pharmacy')) {
      navigate('/', { replace: true });
      return;
    }

    const path = location.pathname || '';
    const submoduleByPath = (p) => {
      if (p === '/pharmacy' || p === '/pharmacy/') return 'dashboard';
      if (p.startsWith('/pharmacy/medicines')) return 'medicines';
      if (p.startsWith('/pharmacy/suppliers')) return 'suppliers';
      if (p.startsWith('/pharmacy/prescriptions')) return 'prescriptions';
      if (p.startsWith('/pharmacy/pos')) return 'pos';
      if (p.startsWith('/pharmacy/reports')) return 'reports';
      if (p.startsWith('/pharmacy/settings')) return 'settings';
      return 'dashboard';
    };

    const key = submoduleByPath(path);
    if (!isSubmoduleEnabled('pharmacy', key) || !canAccess('pharmacy', key)) {
      navigate('/pharmacy', { replace: true });
    }
  }, [canAccess, isPortalEnabled, isSubmoduleEnabled, location.pathname, navigate]);

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('pharmacy_auth');
    localStorage.removeItem('portal');
    navigate('/pharmacy/login');
  };

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      setSidebarOpen(v => !v);
    } else {
      setMobileMenuOpen(v => !v);
    }
  };

  const pharmacyUser = JSON.parse(localStorage.getItem('pharmacy_auth') || '{}');

  return (
    <div className="flex flex-col h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--pm-surface))]/80 backdrop-blur border-b border-[hsl(var(--pm-border))]">
        <div className="px-3 md:px-5 py-2">
          <div className="h-12 w-full rounded-full border border-[hsl(var(--pm-border))] bg-[hsl(var(--pm-surface))] shadow-sm flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--pm-surface))] text-[hsl(var(--pm-text-muted))] hover:text-[hsl(var(--pm-text))] border border-[hsl(var(--pm-border))]"
                aria-label="Back to modules"
              >
                <FiArrowLeft className="h-5 w-5" />
              </Link>
              <button
                onClick={handleToggle}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--pm-surface))] text-[hsl(var(--pm-text-muted))] hover:text-[hsl(var(--pm-text))] border border-[hsl(var(--pm-border))]"
                aria-label="Toggle sidebar"
              >
                <FiMenu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200/70" />
              <div className="min-w-0 flex items-center gap-2">
                {settings.companyLogo ? (
                  <img src={settings.companyLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain ring-1 ring-slate-200" />
                ) : (
                  <MdLocalPharmacy className="h-7 w-7 text-[hsl(var(--pm-primary))]" />
                )}
                <div className="text-sm md:text-base font-semibold tracking-wide text-slate-800 truncate">
                  {settings.companyName || 'Pet Matrix'}
                  <span className="ml-2 text-xs font-medium text-[hsl(var(--pm-primary))] align-middle">
                    Pharmacy Portal • {pharmacyUser.name || pharmacyUser.username || 'Pharmacy Staff'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-600 hidden md:block">Welcome</div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-[hsl(var(--pm-error))] hover:brightness-95 text-white text-xs rounded-full transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'w-64' : 'w-20'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          fixed md:relative z-50 md:z-auto
          bg-[hsl(var(--pm-surface))] border-r border-[hsl(var(--pm-border))] 
          transition-all duration-200 
          flex flex-col h-full
        `}>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  active
                    ? 'bg-[hsl(var(--pm-primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--pm-text-muted))] hover:bg-[hsl(var(--pm-bg))] hover:text-[hsl(var(--pm-text))]'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <div className={`flex items-center justify-center ${!sidebarOpen && 'mx-auto'}`}>
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </div>
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[hsl(var(--pm-border))] space-y-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <FiLogOut className={`w-5 h-5 ${!sidebarOpen && 'mx-auto'}`} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <DaySessionBanner portal="pharmacy" userName={(JSON.parse(localStorage.getItem('pharmacy_auth')||'{}').name)||'Pharmacy Staff'} />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
