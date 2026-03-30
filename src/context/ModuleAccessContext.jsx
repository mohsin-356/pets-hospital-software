import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { moduleAccessAPI } from '../services/api'

const KEY = 'pmx_module_access_v1'
const ModuleAccessContext = createContext(null)

const DEFAULT_CONFIG = {
  portals: {
    admin: {
      enabled: true,
      submodules: {
        dashboard: true,
        users: true,
        doctors: true,
        pets: true,
        clients: true,
        financials: true,
        financeCenter: true,
        suppliers: true,
        daySessions: true,
        receivables: true,
        payables: true,
        vendorPayments: true,
        staffAdvances: true,
        expenses: true,
        inventory: true,
        hospitalInventory: true,
        logs: true,
        settings: true,
      },
    },
    reception: {
      enabled: true,
      submodules: {
        dashboard: true,
        pets: true,
        clients: true,
        appointments: true,
        visits: true,
        reports: true,
        forms: true,
        procedures: true,
        settings: true,
      },
    },
    pharmacy: {
      enabled: true,
      submodules: {
        dashboard: true,
        medicines: true,
        suppliers: true,
        prescriptions: true,
        pos: true,
        reports: true,
        settings: true,
      },
    },
    lab: {
      enabled: true,
      submodules: {
        dashboard: true,
        catalog: true,
        requests: true,
        addReport: true,
        reports: true,
        inventory: true,
        suppliers: true,
        sampleIntake: true,
        radiology: true,
        settings: true,
      },
    },
    doctor: {
      enabled: true,
      submodules: {
        dashboard: true,
        medicines: true,
        prescription: true,
        medicalForms: true,
        details: true,
        patients: true,
        settings: true,
      },
    },
    shop: {
      enabled: true,
      submodules: {
        dashboard: true,
        products: true,
        pos: true,
        suppliers: true,
        distributors: true,
        reports: true,
        settings: true,
      },
    },
  },
}

const deepMerge = (base, patch) => {
  if (!patch || typeof patch !== 'object') return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

export function ModuleAccessProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const res = await moduleAccessAPI.get()
      const next = deepMerge(DEFAULT_CONFIG, res?.data || {})
      setConfig(next)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
    } catch {
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          setConfig(deepMerge(DEFAULT_CONFIG, parsed))
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const save = async (nextConfig) => {
    const next = deepMerge(DEFAULT_CONFIG, nextConfig)
    setConfig(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
    try {
      await moduleAccessAPI.save(next)
    } catch {}
    return next
  }

  const isPortalEnabled = (portal) => {
    const p = config?.portals?.[portal]
    return p ? p.enabled !== false : true
  }

  const isSubmoduleEnabled = (portal, submodule) => {
    const p = config?.portals?.[portal]
    if (p && p.enabled === false) return false
    const s = p?.submodules?.[submodule]
    return s !== false
  }

  const value = useMemo(
    () => ({
      config,
      loading,
      reload: load,
      save,
      isPortalEnabled,
      isSubmoduleEnabled,
    }),
    [config, loading]
  )

  return <ModuleAccessContext.Provider value={value}>{children}</ModuleAccessContext.Provider>
}

export function useModuleAccess() {
  const ctx = useContext(ModuleAccessContext)
  if (!ctx) throw new Error('useModuleAccess must be used within ModuleAccessProvider')
  return ctx
}

export const moduleAccessDefaults = DEFAULT_CONFIG
