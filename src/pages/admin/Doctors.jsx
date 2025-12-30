import React, { useEffect, useMemo, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiAlertTriangle } from 'react-icons/fi'
import { doctorProfileAPI } from '../../services/api'

const emptyForm = {
  id: null,
  username: '',
  name: '',
  specialization: '',
  fee: '',
  phone: '',
  email: '',
  address: ''
}

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [status, setStatus] = useState('')

  const readCachedDoctors = () => {
    try { return JSON.parse(localStorage.getItem('doctor_profiles') || '[]') } catch { return [] }
  }

  const persistCachedDoctors = (list) => {
    localStorage.setItem('doctor_profiles', JSON.stringify(list))
    return list
  }

  const upsertDoctorLocally = (doctor) => {
    const cached = readCachedDoctors()
    const next = [...cached.filter(d => d.username !== doctor.username), doctor]
    persistCachedDoctors(next)
    setDoctors(prev => {
      const updated = [...prev.filter(d => d.username !== doctor.username), doctor]
      return updated
    })
  }

  const deleteDoctorLocally = (username) => {
    const cached = readCachedDoctors().filter(d => d.username !== username)
    persistCachedDoctors(cached)
    setDoctors(prev => prev.filter(d => d.username !== username))
  }

  const loadDoctors = async () => {
    try {
      setLoading(true)
      setError('')
      setStatus('')
      const res = await doctorProfileAPI.list()
      const list = res.data || []
      if (list.length) {
        setDoctors(list)
        persistCachedDoctors(list)
      } else {
        const cached = readCachedDoctors()
        setDoctors(cached)
        if (!cached.length) {
          setError('No doctor profiles found.')
        } else {
          setStatus('Showing previously saved doctors. Server returned empty list.')
        }
      }
    } catch (err) {
      console.error('Failed to load doctors', err)
      const cached = readCachedDoctors()
      if (cached.length) {
        setDoctors(cached)
        setStatus('Server unreachable. Working with offline doctor list.')
        setError('')
      } else {
        setError('Server unreachable and no cached doctors found.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDoctors()
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return doctors
    const q = query.trim().toLowerCase()
    return doctors.filter(d =>
      [d.name, d.username, d.specialization, d.phone, d.email]
        .some(v => String(v || '').toLowerCase().includes(q))
    )
  }, [doctors, query])

  const openDialog = (doc = null) => {
    if (doc) {
      setForm({
        id: doc._id || doc.id || doc.username,
        username: doc.username || '',
        name: doc.name || '',
        specialization: doc.specialization || '',
        fee: doc.fee || '',
        phone: doc.phone || '',
        email: doc.email || '',
        address: doc.address || ''
      })
    } else {
      setForm(emptyForm)
    }
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setForm(emptyForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.name) return

    try {
      setLoading(true)
      setError('')
      setStatus('')
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        specialization: form.specialization,
        fee: form.fee,
        phone: form.phone,
        email: form.email,
        address: form.address
      }
      if (form.id) {
        await doctorProfileAPI.update(form.username, payload)
      } else {
        await doctorProfileAPI.save(payload)
      }
      upsertDoctorLocally(payload)
      setStatus('Doctor saved locally' + (status ? `. ${status}` : ''))
      closeDialog()
    } catch (err) {
      console.error('Failed to save doctor', err)
      upsertDoctorLocally({ ...form })
      setStatus('Server unreachable. Doctor saved locally only.')
      setError('')
      closeDialog()
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      setLoading(true)
      setError('')
      await doctorProfileAPI.delete(deleting.username)
      deleteDoctorLocally(deleting.username)
      setStatus('Doctor removed')
      setDeleting(null)
    } catch (err) {
      console.error('Failed to delete doctor', err)
      deleteDoctorLocally(deleting.username)
      setStatus('Server unreachable. Doctor removed locally only.')
      setError('')
      setDeleting(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-800">Doctors</h1>
          <p className="text-slate-600">Manage all consulting veterinarians shown in reception portal.</p>
        </div>
        <div className="flex gap-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search doctor..."
            className="h-11 px-4 rounded-xl border border-slate-300 bg-white"
          />
          <button
            onClick={() => openDialog()}
            className="h-11 px-5 rounded-xl bg-indigo-600 text-white flex items-center gap-2 shadow hover:bg-indigo-700"
          >
            <FiPlus /> Add Doctor
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertTriangle />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {status && !error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{status}</span>
          <button onClick={() => setStatus('')}>×</button>
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Specialization</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Fee</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No doctors found</td>
              </tr>
            )}
            {filtered.map(doc => (
              <tr key={doc._id || doc.username} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">{doc.name}</div>
                  <div className="text-xs text-slate-500">@{doc.username}</div>
                </td>
                <td className="px-4 py-3">{doc.specialization || '—'}</td>
                <td className="px-4 py-3">{doc.phone || '—'}</td>
                <td className="px-4 py-3">{doc.email || '—'}</td>
                <td className="px-4 py-3">{doc.fee ? `Rs. ${doc.fee}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openDialog(doc)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 flex items-center gap-1">
                      <FiEdit2 /> Edit
                    </button>
                    <button onClick={() => setDeleting(doc)} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 flex items-center gap-1">
                      <FiTrash2 /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">{form.id ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button onClick={closeDialog} className="text-slate-500 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Username (unique)</label>
                <input
                  value={form.username}
                  onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  placeholder="doctor1"
                  required
                  disabled={!!form.id}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Full Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  placeholder="Dr. Mazhar Hussain"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Specialization</label>
                  <input
                    value={form.specialization}
                    onChange={e => setForm(prev => ({ ...prev, specialization: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="Internal Medicine"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Consultant Fee (Rs.)</label>
                  <input
                    value={form.fee}
                    onChange={e => setForm(prev => ({ ...prev, fee: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="1500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="0300-1234567"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="doc@hospital.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Address / Clinic Room</label>
                <input
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  placeholder="Room 3, Pets Hospital"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeDialog} className="px-4 h-11 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
                <button type="submit" className="px-5 h-11 rounded-xl bg-emerald-600 text-white font-semibold">
                  {form.id ? 'Update Doctor' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 border border-red-100">
            <div className="flex items-center gap-2 text-red-600">
              <FiAlertTriangle />
              <h3 className="text-xl font-semibold">Delete Doctor</h3>
            </div>
            <p className="text-slate-600">Are you sure you want to delete {deleting.name || deleting.username}? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 pointer-events-none flex items-end justify-end pr-6 pb-6">
          <div className="bg-white shadow-lg rounded-2xl px-4 py-2 text-sm text-slate-500">Processing...</div>
        </div>
      )}
    </div>
  )
}
