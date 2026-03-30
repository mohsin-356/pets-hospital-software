import React from 'react'
import { Navigate } from 'react-router-dom'
import { useModuleAccess } from '../context/ModuleAccessContext'
import { useAccessRoles } from '../context/AccessRoleContext'

export default function PortalRouteGuard({ portal, submodule, children }) {
  const { isPortalEnabled, isSubmoduleEnabled, loading } = useModuleAccess()
  const { canAccess, loading: roleLoading } = useAccessRoles()

  if (loading || roleLoading) return null

  if (!isPortalEnabled(portal)) {
    return <Navigate to="/" replace />
  }

  if (!canAccess(portal)) {
    return <Navigate to="/" replace />
  }

  if (submodule && !isSubmoduleEnabled(portal, submodule)) {
    return <Navigate to="/" replace />
  }

  if (submodule && !canAccess(portal, submodule)) {
    return <Navigate to="/" replace />
  }

  return children
}
