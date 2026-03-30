import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { accessRolesAPI } from '../services/api'

const KEY = 'pmx_access_roles_v1'
const AccessRoleContext = createContext(null)

function getPortalAuthKey(portal) {
  if (!portal) return null
  return `${portal}_auth`
}

function getCurrentAuth() {
  try {
    const portal = localStorage.getItem('portal')
    const key = getPortalAuthKey(portal)
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeRoleDoc(doc) {
  if (!doc || typeof doc !== 'object') return null
  return {
    _id: doc._id,
    name: doc.name,
    config: doc.config || {},
  }
}

function normalizeRoleName(name) {
  return String(name || '').trim().toLowerCase()
}

export function AccessRoleProvider({ children }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const res = await accessRolesAPI.getAll()
      const payload = res?.data
      const rawList = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      const list = rawList.map(normalizeRoleDoc).filter(Boolean)
      setRoles(list)
      try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
    } catch {
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) setRoles(parsed.map(normalizeRoleDoc).filter(Boolean))
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const getRoleForAuth = (auth) => {
    const id = auth?.accessRoleId?._id || auth?.accessRoleId || auth?.accessRole?._id || auth?.accessRole
    if (!id) return null
    return roles.find(r => String(r._id) === String(id)) || null
  }

  const getRoleForAuthByName = (auth) => {
    const wanted = normalizeRoleName(auth?.role)
    if (!wanted) return null
    return roles.find(r => normalizeRoleName(r?.name) === wanted) || null
  }

  const isRoleAllowed = (role, portal, submodule) => {
    if (!role) return false
    const p = role?.config?.portals?.[portal]
    if (!p) return false
    if (!submodule) return true
    return p?.submodules?.[submodule] === true
  }

  const canAccess = (portal, submodule) => {
    const auth = getCurrentAuth()
    if (!auth) return false
    if (String(auth?.role || '').toLowerCase() === 'admin') return true
    const role = getRoleForAuth(auth) || getRoleForAuthByName(auth)
    if (!role) return false
    return isRoleAllowed(role, portal, submodule)
  }

  const value = useMemo(() => ({
    roles,
    loading,
    reload: load,
    canAccess,
    getCurrentAuth,
    getRoleForAuth,
  }), [roles, loading])

  return <AccessRoleContext.Provider value={value}>{children}</AccessRoleContext.Provider>
}

export function useAccessRoles() {
  const ctx = useContext(AccessRoleContext)
  if (!ctx) throw new Error('useAccessRoles must be used within AccessRoleProvider')
  return ctx
}
