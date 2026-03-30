import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PMMagicCard } from './ui/PMMagicCard'

export default function PortalCard({ name, icon, description, to, bg = 'bg-[hsl(var(--pm-surface))]', accentColor = 'bg-[hsl(var(--pm-primary))]' }) {
  const navigate = useNavigate()
  return (
    <PMMagicCard
      className={`${bg} rounded-xl shadow-sm border border-[hsl(var(--pm-border))] p-6 md:p-8 hover:shadow-sm transition cursor-pointer group`}
      onClick={() => navigate(to)}
      glowColor="14, 165, 233"
      particleCount={12}
      spotlightRadius={220}
    >
      <div className="flex flex-col items-center text-center gap-4 md:gap-5">
        <div className={`h-14 w-14 md:h-16 md:w-16 rounded-xl ${accentColor} text-white grid place-items-center shadow-sm`}> 
          <div className="text-2xl md:text-3xl">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-lg md:text-xl font-semibold text-[hsl(var(--pm-text))]">{name}</div>
          {description && (
            <p className="mt-1 text-[hsl(var(--pm-text-muted))] text-sm md:text-base leading-relaxed max-w-[48ch] mx-auto">{description}</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(to) }}
            className="mt-4 inline-flex items-center gap-1 px-3 md:px-4 py-2 text-sm rounded-md bg-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-hover))] text-white transition shadow-sm border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--pm-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--pm-bg))]"
            aria-label={`Open ${name}`}
          >
            Open
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </PMMagicCard>
  )
}
