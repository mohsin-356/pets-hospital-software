import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiLock, FiMail, FiKey, FiAlertCircle } from 'react-icons/fi'
import { PMInput } from '../components/ui/PMInput'
import { PMButton } from '../components/ui/PMButton'
import { PMMagicCard } from '../components/ui/PMMagicCard'
import { useSettings } from '../context/SettingsContext'
import { licenseAPI } from '../services/api'

const LOCAL_KEY = 'pmx_license_state_v1'

const DURATION_OPTIONS = [
  { value: 'one-week', label: 'One Week' },
  { value: 'one-month', label: 'One Month' },
  { value: 'one-year', label: 'One Year' },
  { value: 'lifetime', label: 'Life Time' },
]

export function getLocalLicenseState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setLocalLicenseState(state) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function clearLocalLicenseState() {
  try { localStorage.removeItem(LOCAL_KEY) } catch {}
}

export default function SuperAdminLogin() {
  const navigate = useNavigate()
  const { settings } = useSettings()

  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [duration, setDuration] = useState('one-month')

  const [showPwd, setShowPwd] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => {
    return ownerEmail.trim() && ownerPassword && licenseKey && duration
  }, [ownerEmail, ownerPassword, licenseKey, duration])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setLoading(true)
      setError('')

      const response = await licenseAPI.activate({
        ownerEmail: ownerEmail.trim(),
        ownerPassword,
        licenseKey,
        duration,
      })

      const data = response?.data
      if (!data) throw new Error('Activation failed')

      setLocalLicenseState({
        status: data.status,
        duration: data.duration,
        activatedAt: data.activatedAt,
        expiresAt: data.expiresAt,
      })

      try {
        if (data.duration === 'lifetime') {
          sessionStorage.setItem('pmx_lifetime_verified_v1', '1')
        } else {
          sessionStorage.removeItem('pmx_lifetime_verified_v1')
        }
      } catch {
        // ignore
      }

      navigate('/super-admin/modules', { replace: true })
    } catch (err) {
      setError(err?.response?.message || err?.message || 'Activation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pm-bg))] text-[hsl(var(--pm-text))] relative flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="text-sm font-medium text-[hsl(var(--pm-text-muted))]">Software Owner Access</div>
          <div className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Super Admin Login</div>
          <div className="mt-2 text-sm text-[hsl(var(--pm-text-muted))]">
            Activate your subscription to continue using {settings.companyName || 'Pet Matrix'}.
          </div>
        </div>

        <PMMagicCard className="bg-[hsl(var(--pm-surface))] rounded-xl ring-1 ring-[hsl(var(--pm-border))] p-6 md:p-8" glowColor="59, 130, 246" particleCount={10} spotlightRadius={220}>
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            <PMInput
              label="Owner Email"
              placeholder="alienmatrix0@gmail.com"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              leftIcon={<FiMail className="h-4 w-4" />}
              required
            />

            <PMInput
              label="Owner Password"
              placeholder="Enter owner password"
              type={showPwd ? 'text' : 'password'}
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              leftIcon={<FiLock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="grid place-items-center h-8 w-8 rounded-md border border-[hsl(var(--pm-border))] text-[hsl(var(--pm-text-muted))] hover:text-[hsl(var(--pm-text))] hover:bg-[hsl(var(--pm-bg))]"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              }
              required
            />

            <PMInput
              label="Secret Licensed Key"
              placeholder="Enter secret licensed key"
              type="password"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              leftIcon={<FiKey className="h-4 w-4" />}
              required
            />

            <div className="space-y-2">
              <label className="text-xs font-medium text-[hsl(var(--pm-text))]">Subscription Duration<span className="text-[hsl(var(--pm-error))] ml-1">*</span></label>
              <select
                className="w-full h-10 px-3 bg-[hsl(var(--pm-surface))] border border-[hsl(var(--pm-border))] rounded-md text-[hsl(var(--pm-text))]"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              >
                {DURATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[hsl(var(--pm-error))] bg-[hsl(var(--pm-error))]/10 p-3 rounded-lg">
                <FiAlertCircle className="flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <PMButton type="submit" className="w-full" size="lg" isLoading={loading} disabled={!canSubmit}>
              Proceed
            </PMButton>

            <p className="text-xs text-center text-[hsl(var(--pm-text-muted))] mt-2">© 2025 {settings.companyName || 'Pet Matrix'}. All rights reserved.</p>
          </form>
        </PMMagicCard>
      </div>
    </div>
  )
}
