import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheckSquare, FiSave, FiRefreshCw } from 'react-icons/fi'
import { PMMagicCard } from '../components/ui/PMMagicCard'
import { PMButton } from '../components/ui/PMButton'
import { useModuleAccess, moduleAccessDefaults } from '../context/ModuleAccessContext'

const clone = (obj) => JSON.parse(JSON.stringify(obj || {}))

export default function SuperAdminModules() {
  const navigate = useNavigate()
  const { config, loading, save, reload } = useModuleAccess()

  const [draft, setDraft] = useState(() => clone(moduleAccessDefaults))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraft(clone(config))
  }, [config])

  const portals = useMemo(() => {
    const p = draft?.portals || {}
    return Object.keys(p)
  }, [draft])

  const togglePortal = (portal, enabled) => {
    setDraft(prev => {
      const next = clone(prev)
      if (!next.portals) next.portals = {}
      if (!next.portals[portal]) next.portals[portal] = { enabled: true, submodules: {} }
      next.portals[portal].enabled = enabled
      return next
    })
  }

  const toggleSub = (portal, sub, enabled) => {
    setDraft(prev => {
      const next = clone(prev)
      if (!next.portals) next.portals = {}
      if (!next.portals[portal]) next.portals[portal] = { enabled: true, submodules: {} }
      if (!next.portals[portal].submodules) next.portals[portal].submodules = {}
      next.portals[portal].submodules[sub] = enabled
      return next
    })
  }

  const handleSave = async () => {
    try {
      setBusy(true)
      setMessage('')
      await save(draft)
      setMessage('Saved. Module access has been applied.')
      navigate('/', { replace: true })
    } catch (e) {
      setMessage(e?.message || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setDraft(clone(moduleAccessDefaults))
    setMessage('Reset to defaults. Click Save to apply.')
  }

  const handleReload = async () => {
    try {
      setBusy(true)
      setMessage('')
      await reload()
      setMessage('Reloaded.')
    } catch (e) {
      setMessage(e?.message || 'Failed to reload')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--pm-bg))] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))] px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <div className="text-sm font-medium text-[hsl(var(--pm-text-muted))]">Software Owner Access</div>
          <div className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Modules Offering</div>
          <div className="mt-2 text-sm text-[hsl(var(--pm-text-muted))]">Tick modules and submodules to enable for this hospital.</div>
        </div>

        {message ? (
          <div className="rounded-xl border border-[hsl(var(--pm-border))] bg-[hsl(var(--pm-surface))] p-3 text-sm text-[hsl(var(--pm-text))]">
            {message}
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row gap-3 justify-center">
          <PMButton variant="secondary" onClick={handleReload} disabled={busy}>
            <FiRefreshCw className="mr-2" /> Reload
          </PMButton>
          <PMButton variant="secondary" onClick={handleReset} disabled={busy}>
            <FiCheckSquare className="mr-2" /> Reset Defaults
          </PMButton>
          <PMButton onClick={handleSave} disabled={busy}>
            <FiSave className="mr-2" /> Save & Apply
          </PMButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portals.map((portalKey) => {
            const p = draft?.portals?.[portalKey]
            const enabled = p?.enabled !== false
            const subs = p?.submodules || {}
            const subKeys = Object.keys(subs)

            return (
              <PMMagicCard key={portalKey} className="bg-[hsl(var(--pm-surface))] rounded-xl ring-1 ring-[hsl(var(--pm-border))] p-5" glowColor="59, 130, 246" particleCount={8} spotlightRadius={220}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold capitalize">{portalKey} Portal</div>
                    <div className="text-xs text-[hsl(var(--pm-text-muted))]">Enable/disable portal and choose pages.</div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => togglePortal(portalKey, e.target.checked)}
                    />
                    Enabled
                  </label>
                </div>

                <div className={`mt-4 space-y-2 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  {subKeys.map((sk) => (
                    <label key={sk} className="flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize">{sk}</span>
                      <input
                        type="checkbox"
                        checked={subs[sk] !== false}
                        onChange={(e) => toggleSub(portalKey, sk, e.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </PMMagicCard>
            )
          })}
        </div>

        <div className="text-center">
          <PMButton variant="secondary" onClick={() => navigate('/', { replace: true })} disabled={busy}>
            Back to Home
          </PMButton>
        </div>
      </div>
    </div>
  )
}
