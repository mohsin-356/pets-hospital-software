import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import { useActivity } from '../context/ActivityContext'
import { usersAPI } from '../services/api'
import { useModuleAccess } from '../context/ModuleAccessContext'

export default function PharmacyLogin() {
  const navigate = useNavigate()
  const { isPortalEnabled } = useModuleAccess()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addActivity } = useActivity()

  useEffect(() => {
    if (!isPortalEnabled('pharmacy')) {
      navigate('/', { replace: true })
    }
  }, [isPortalEnabled, navigate])
  
  const handleSubmit = async ({ username, password }) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await usersAPI.login({ username, password })
      
      if (response && response.data) {
        const user = response.data
        
        if (user.role === 'pharmacy' || user.role === 'Pharmacy') {
          localStorage.setItem('portal', 'pharmacy')
          localStorage.setItem('pharmacy_auth', JSON.stringify({ 
            username: user.username,
            name: user.name,
            role: user.role,
            accessRoleId: user.accessRoleId
          }))
          try { addActivity({ user: 'Pharmacy', text: `Login successful: ${user.username}` }) } catch {}
          navigate('/pharmacy')
        } else {
          setError('Access denied. Pharmacy role required.')
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }
  
  return <LoginForm title="Pharmacy Portal" onSubmit={handleSubmit} error={error} loading={loading} illustrationSrc="/Pharmacy-Illustration-AI.jpg" illustrationAlt="Pharmacy portal illustration" />
}
