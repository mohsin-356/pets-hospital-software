import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiOutlineHome } from 'react-icons/ai'
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowLeft } from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'
import { PMInput } from './ui/PMInput'
import { PMButton } from './ui/PMButton'
import { FloatingOrbs } from './backgrounds/FloatingOrbs'
import { TechGridPattern } from './backgrounds/TechGridPattern'
import { PMMagicCard } from './ui/PMMagicCard'

export default function LoginForm({
  title,
  onSubmit,
  error,
  loading = false,
  illustrationSrc,
  illustrationAlt = 'Login illustration'
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const navigate = useNavigate()
  const { settings } = useSettings()

  // Removed auto-clear to avoid wiping values needed for profile display

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))] relative flex items-center justify-center px-4 py-10">
      <button
        aria-label="Go Home"
        className="absolute right-4 top-4 grid place-items-center h-9 w-9 rounded-lg border border-[hsl(var(--pm-border))] bg-[hsl(var(--pm-surface))] text-[hsl(var(--pm-text-muted))] hover:text-[hsl(var(--pm-text))] shadow-sm hover:shadow hover:cursor-pointer transition"
        onClick={() => navigate('/')}
      >
        <AiOutlineHome size={18} />
      </button>

      <div className="w-full max-w-5xl">
        <div className="grid overflow-hidden rounded-2xl border border-[hsl(var(--pm-border))] bg-[hsl(var(--pm-surface))] shadow-sm md:grid-cols-2">
          <div className="relative hidden md:flex flex-col justify-between p-10 bg-[hsl(var(--pm-primary))]/10">
            <TechGridPattern opacity={0.08} />
            <FloatingOrbs />

            <div className="relative">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="group relative inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--pm-border))]/60 bg-[hsl(var(--pm-surface))]/55 px-3 py-2 text-sm font-medium text-[hsl(var(--pm-text))] shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-[hsl(var(--pm-surface))]/75 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/35"
              >
                <span className="pointer-events-none absolute -inset-3 -z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_15%_30%,rgba(59,130,246,0.35),transparent_55%),radial-gradient(circle_at_85%_20%,rgba(0,217,255,0.22),transparent_52%)] blur-xl" />
                </span>
                <FiArrowLeft className="h-4 w-4 text-[hsl(var(--pm-primary))]" />
                <span>Back to Main Menu</span>
              </button>

              <div className="text-sm font-medium text-[hsl(var(--pm-text-muted))]">Welcome to</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-[hsl(var(--pm-text))]">{settings.companyName || 'Pet Matrix'}</div>
              <div className="mt-3 text-sm text-[hsl(var(--pm-text-muted))] max-w-[40ch]">
                Secure access for staff portals with a clean and consistent experience.
              </div>
            </div>

            {illustrationSrc ? (
              <div className="relative flex items-center justify-center px-2 py-6">
                <img
                  src={illustrationSrc}
                  alt={illustrationAlt}
                  className="max-h-[340px] max-w-full w-auto object-contain mix-blend-multiply opacity-95 contrast-110 saturate-105 drop-shadow-[0_18px_30px_rgba(2,6,23,0.18)]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="relative" />
            )}

            <div className="relative text-xs text-[hsl(var(--pm-text-muted))]">{title}</div>
          </div>

          <div className="p-6 md:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-5 md:hidden">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="group relative inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--pm-border))]/70 bg-[hsl(var(--pm-surface))]/70 px-3 py-2 text-sm font-medium text-[hsl(var(--pm-text))] shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-[hsl(var(--pm-surface))]/85 hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--pm-primary))]/35"
                >
                  <span className="pointer-events-none absolute -inset-3 -z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_35%,rgba(59,130,246,0.30),transparent_56%),radial-gradient(circle_at_85%_25%,rgba(0,217,255,0.18),transparent_52%)] blur-xl" />
                  </span>
                  <FiArrowLeft className="h-4 w-4 text-[hsl(var(--pm-primary))]" />
                  <span>Back to Main Menu</span>
                </button>
              </div>

              {illustrationSrc ? (
                <div className="flex justify-center mb-6 md:hidden">
                  <img
                    src={illustrationSrc}
                    alt={illustrationAlt}
                    className="max-h-40 max-w-full w-auto object-contain mix-blend-multiply opacity-95 contrast-110 saturate-105 drop-shadow-[0_16px_24px_rgba(2,6,23,0.14)]"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}

              {/* Centered Company Logo (from Settings) */}
              <div className="flex justify-center mb-6">
                {settings.companyLogo ? (
                  <img
                    src={settings.companyLogo}
                    alt="Company Logo"
                    className="h-20 w-20 md:h-24 md:w-24 object-contain rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))]"
                  />
                ) : (
                  <div className="text-2xl md:text-3xl font-semibold text-center tracking-tight text-[hsl(var(--pm-text))]">
                    {settings.companyName || 'Pet Matrix'}
                  </div>
                )}
              </div>

              {/* Portal Title under logo */}
              <h2 className="text-3xl md:text-5xl font-semibold text-center tracking-tight text-[hsl(var(--pm-text))]">
                {title}
              </h2>

              <div className="mt-4 h-px w-12 mx-auto bg-[hsl(var(--pm-primary))]/40" />

              <p className="mt-2 text-center text-sm text-[hsl(var(--pm-text-muted))]">
                Sign in to continue
              </p>

              <PMMagicCard className="mt-6 bg-[hsl(var(--pm-surface))] rounded-xl ring-1 ring-[hsl(var(--pm-border))] p-6 md:p-8" glowColor="59, 130, 246" particleCount={12} spotlightRadius={220}>
                <form
                  onSubmit={e => { e.preventDefault(); onSubmit({ username, password }) }}
                  className="space-y-5"
                  autoComplete="off"
                >
                  <PMInput
                    label="Username"
                    placeholder="Enter your username"
                    name="login_user"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    leftIcon={<FiUser className="h-4 w-4" />}
                    required
                  />

                  <PMInput
                    label="Password"
                    placeholder="Enter your password"
                    name="login_pass"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    leftIcon={<FiLock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPwd(s => !s)}
                        className="grid place-items-center h-8 w-8 rounded-md border border-[hsl(var(--pm-border))] text-[hsl(var(--pm-text-muted))] hover:text-[hsl(var(--pm-text))] hover:bg-[hsl(var(--pm-bg))]"
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                      >
                        {showPwd ? <FiEyeOff /> : <FiEye />}
                      </button>
                    }
                    required
                  />

                  {error && (
                    <div className="flex items-center gap-2 text-[hsl(var(--pm-error))] bg-[hsl(var(--pm-error))]/10 p-3 rounded-lg">
                      <FiAlertCircle className="flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <PMButton type="submit" className="w-full" size="lg" isLoading={loading}>Login</PMButton>
                </form>

                <p className="text-xs text-center text-[hsl(var(--pm-text-muted))] mt-5">© 2025 {settings.companyName || 'Pet Matrix'}. All rights reserved.</p>
              </PMMagicCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
