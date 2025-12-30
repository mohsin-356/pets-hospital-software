import React, { useState } from 'react'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings } from 'react-icons/fi'
import { backupAPI } from '../../services/api'

export default function DoctorSettings() {
  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const pickDoctorOnly = (data) => {
    if (!data) return { doctorProfiles: [], prescriptions: [] }
    const { doctorProfiles = [], prescriptions = [] } = data
    return { doctorProfiles, prescriptions }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickDoctorOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `doctor-backup-${ts}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Export complete. File downloaded.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to export')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) { setMessage('Please select a JSON file to import.'); return }
    try {
      setBusy(true); setMessage('')
      const text = await importFile.text()
      let json
      try { json = JSON.parse(text) } catch { throw new Error('Invalid JSON file') }
      const payload = pickDoctorOnly(json)
      await backupAPI.importAll(payload)
      setMessage('Import completed successfully.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to import')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const ok = window.confirm('This will DELETE all Doctor data (Doctor profiles and prescriptions). Continue?')
    if (!ok) return
    try {
      setBusy(true); setMessage('')
      await backupAPI.clearDoctor()
      setMessage('Doctor data cleared successfully.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to clear data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
          <FiSettings /> Doctor Settings
        </h1>
        <p className="text-slate-600 text-lg">Backup, restore, and manage Doctor portal data</p>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center"><FiDownload /></div>
            <div className="font-semibold">Export Doctor Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Download doctor profiles and prescriptions as JSON.</p>
          <button disabled={busy} onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60">
            <FiDownload className="w-4 h-4"/> Export JSON
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><FiUpload /></div>
            <div className="font-semibold">Import Doctor Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-3">Select a previously exported JSON file to restore.</p>
          <input type="file" accept="application/json" onChange={(e)=>setImportFile(e.target.files?.[0]||null)} className="block w-full text-sm mb-3" />
          <button disabled={busy || !importFile} onClick={handleImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">
            <FiUpload className="w-4 h-4"/> Import JSON
          </button>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-red-700">
            <div className="w-10 h-10 rounded-xl bg-red-100 grid place-items-center"><FiTrash2 /></div>
            <div className="font-semibold">Delete Doctor Data</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-700 mb-4">
            <FiAlertTriangle className="mt-0.5"/>
            <p>Danger action. This will permanently delete doctor data from the database.</p>
          </div>
          <button disabled={busy} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60">
            <FiTrash2 className="w-4 h-4"/> Delete All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
        <FiDatabase className="text-slate-400"/> Scope: Doctor collections only (Doctor Profiles, Prescriptions). Export/Import uses JSON files created here.
      </div>
    </div>
  )
}
