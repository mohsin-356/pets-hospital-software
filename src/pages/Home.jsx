import React, { useState } from 'react'
import PortalCard from '../components/PortalCard'
import { MdAdminPanelSettings, MdLocalPharmacy } from 'react-icons/md'
import { FiClipboard } from 'react-icons/fi'
import { TbMicroscope } from 'react-icons/tb'
import { FaPaw, FaStethoscope } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { PMButton } from '../components/ui/PMButton'
import { PMInput } from '../components/ui/PMInput'
import { PMMagicCard } from '../components/ui/PMMagicCard'
import { licenseAPI } from '../services/api'
import { clearLocalLicenseState } from './SuperAdminLogin'
import { useModuleAccess } from '../context/ModuleAccessContext'

export default function Home() {
  const navigate = useNavigate()
  const { isPortalEnabled } = useModuleAccess()
  const [showOff, setShowOff] = useState(false)
  const [offKey, setOffKey] = useState('')
  const [offLoading, setOffLoading] = useState(false)
  const [offError, setOffError] = useState('')

  const handleSessionOff = async (e) => {
    e.preventDefault()
    try {
      setOffLoading(true)
      setOffError('')
      await licenseAPI.deactivate({ licenseKey: offKey })
      try { clearLocalLicenseState() } catch {}
      try { sessionStorage.removeItem('pmx_lifetime_verified_v1') } catch {}
      setShowOff(false)
      setOffKey('')
      navigate('/super-admin', { replace: true })
    } catch (err) {
      setOffError(err?.response?.message || err?.message || 'Invalid license key')
    } finally {
      setOffLoading(false)
    }
  }

  const portals = [
    {
      name: 'Main Admin',
      icon: <MdAdminPanelSettings />,
      description: 'Users, roles, reports, and overall system management.',
      to: '/admin/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
    {
      name: 'Reception',
      icon: <FiClipboard />,
      description: 'Appointments, patients check-in, and billing initiation.',
      to: '/reception/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
    {
      name: 'Pharmacy',
      icon: <MdLocalPharmacy />,
      description: 'Prescriptions, inventory, and POS for medicines.',
      to: '/pharmacy/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
    {
      name: 'Laboratory',
      icon: <TbMicroscope />,
      description: 'Lab orders, tests, and results management.',
      to: '/lab/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
    {
      name: 'Doctor',
      icon: <FaStethoscope />,
      description: 'Doctors portal: patient visits, notes, and review.',
      to: '/doctor/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
    {
      name: 'Pets Shop',
      icon: <FaPaw />,
      description: 'Pet items catalog, inventory and retail sales.',
      to: '/shop/login',
      bg: 'bg-[hsl(var(--pm-surface))]',
      accentColor: 'bg-[hsl(var(--pm-primary))]',
    },
  ]

  const visiblePortals = portals.filter(p => {
    if (p.to?.startsWith('/admin')) return isPortalEnabled('admin')
    if (p.to?.startsWith('/reception')) return isPortalEnabled('reception')
    if (p.to?.startsWith('/pharmacy')) return isPortalEnabled('pharmacy')
    if (p.to?.startsWith('/lab')) return isPortalEnabled('lab')
    if (p.to?.startsWith('/doctor')) return isPortalEnabled('doctor')
    if (p.to?.startsWith('/shop')) return isPortalEnabled('shop')
    return true
  })

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))]">
      <header className="py-14">
        <h1 className="text-5xl md:text-6xl font-extrabold text-center text-blue-600 tracking-tight">Pet Matrix</h1>
        <div className="h-2 w-56 md:w-72 mx-auto mt-4 rounded-full bg-gradient-to-r from-sky-500 to-blue-500" />
        <p className="text-center text-[hsl(var(--pm-text-muted))] mt-5 text-base md:text-xl font-semibold">
          A Product Of AlienMatix that Manage your Work flow
        </p>
        <p className="text-center text-[hsl(var(--pm-text))] mt-3 text-2xl md:text-3xl font-semibold">
          Select module to Start
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-24">
        <div className="flex justify-center mb-8">
          <PMButton variant="danger" size="md" onClick={() => { setShowOff(true); setOffError('') }}>
            Session Off (Super Admin)
          </PMButton>
        </div>

        {showOff && (
          <div className="max-w-xl mx-auto mb-10">
            <PMMagicCard className="bg-[hsl(var(--pm-surface))] rounded-xl ring-1 ring-[hsl(var(--pm-border))] p-6" glowColor="239, 68, 68" particleCount={8} spotlightRadius={220}>
              <form onSubmit={handleSessionOff} className="space-y-4" autoComplete="off">
                <div className="text-sm font-medium text-[hsl(var(--pm-text))]">Confirm Session Off</div>
                <div className="text-xs text-[hsl(var(--pm-text-muted))]">Enter secret license key to immediately lock the software.</div>

                <PMInput
                  label="Secret Licensed Key"
                  placeholder="Enter secret licensed key"
                  type="password"
                  value={offKey}
                  onChange={(e) => setOffKey(e.target.value)}
                  required
                />

                {offError ? (
                  <div className="text-sm text-[hsl(var(--pm-error))]">{offError}</div>
                ) : null}

                <div className="flex gap-3">
                  <PMButton type="submit" variant="danger" className="flex-1" isLoading={offLoading} disabled={!offKey}>
                    Lock Now
                  </PMButton>
                  <PMButton type="button" variant="secondary" className="flex-1" onClick={() => { setShowOff(false); setOffKey(''); setOffError('') }} disabled={offLoading}>
                    Cancel
                  </PMButton>
                </div>
              </form>
            </PMMagicCard>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8">
          {visiblePortals.map(p => (
            <PortalCard
              key={p.name}
              name={p.name}
              icon={p.icon}
              description={p.description}
              to={p.to}
              bg={p.bg}
              accentColor={p.accentColor}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
