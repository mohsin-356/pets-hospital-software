import React from 'react'
import { Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))]">
      <Outlet />
    </div>
  )
}
