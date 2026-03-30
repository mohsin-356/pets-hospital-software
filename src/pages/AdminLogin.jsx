import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import { useActivity } from '../context/ActivityContext'
import { usersAPI } from '../services/api'
import { useModuleAccess } from '../context/ModuleAccessContext'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { isPortalEnabled } = useModuleAccess()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addActivity } = useActivity()

  useEffect(() => {
    if (!isPortalEnabled('admin')) {
      navigate('/', { replace: true })
    }
  }, [isPortalEnabled, navigate])
  
  const handleSubmit = async ({ username, password }) => {
    try {
      setLoading(true)
      setError('')
      
      // Try API login first
      const response = await usersAPI.login({ username, password })
      
      if (response && response.data) {
        const user = response.data
        
        // Check if user has admin role
        if (user.role === 'admin' || user.role === 'Admin') {
          localStorage.setItem('portal', 'admin')
          localStorage.setItem('admin_auth', JSON.stringify({ 
            username: user.username,
            name: user.name,
            role: user.role,
            accessRoleId: user.accessRoleId
          }))
          try { addActivity({ user: 'Admin', text: `Login successful: ${user.username}` }) } catch {}
          navigate('/admin')
        } else {
          setError('Access denied. Admin role required.')
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      console.error('Login error:', err)
      
      // Fallback to localStorage if API fails
      try {
        const storedUsers = JSON.parse(localStorage.getItem('admin_users') || '[]')
        const user = storedUsers.find(u => 
          u.username === username && 
          u.password === password && 
          (u.role === 'Admin' || u.role === 'admin')
        )
        
        if (user) {
          localStorage.setItem('portal', 'admin')
          localStorage.setItem('admin_auth', JSON.stringify({ 
            username: user.username,
            name: user.name,
            role: user.role,
            accessRoleId: user.accessRoleId
          }))
          try { addActivity({ user: 'Admin', text: `Login successful: ${user.username}` }) } catch {}
          navigate('/admin')
        } else {
          setError('Invalid username or password')
        }
      } catch (fallbackErr) {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }
  
  return <LoginForm title="Admin Portal" onSubmit={handleSubmit} error={error} loading={loading} illustrationSrc="/vetdoctor.png" illustrationAlt="Admin portal illustration" />
}
