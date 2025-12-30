import React, { useState } from 'react'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings } from 'react-icons/fi'
import { backupAPI } from '../../services/api'

export default function ShopSettings() {
  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const pickShopOnly = (data) => {
    if (!data) return { products: [], sales: [], suppliers: [] }
    const { products = [], sales = [], suppliers = [] } = data
    return { products, sales, suppliers }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickShopOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `shop-backup-${ts}.json`
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
      const payload = pickShopOnly(json)
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
    const ok = window.confirm('This will DELETE all Shop data (Products, Sales, Suppliers). Continue?')
    if (!ok) return
    try {
      setBusy(true); setMessage('')
      await backupAPI.clearShop()
      setMessage('Shop data cleared successfully.')
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
          <FiSettings /> Shop Settings
        </h1>
        <p className="text-slate-600 text-lg">Backup, restore, and manage Shop portal data</p>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 grid place-items-center"><FiDownload /></div>
            <div className="font-semibold">Export Shop Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Download products, sales, and suppliers as JSON.</p>
          <button disabled={busy} onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60">
            <FiDownload className="w-4 h-4"/> Export JSON
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><FiUpload /></div>
            <div className="font-semibold">Import Shop Data</div>
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
            <div className="font-semibold">Delete Shop Data</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-700 mb-4">
            <FiAlertTriangle className="mt-0.5"/>
            <p>Danger action. This will permanently delete products, sales, and suppliers.</p>
          </div>
          <button disabled={busy} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60">
            <FiTrash2 className="w-4 h-4"/> Delete All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
        <FiDatabase className="text-slate-400"/> Scope: Shop collections only (Products, Sales, Suppliers). Export/Import works with JSON files produced here.
      </div>
    </div>
  )
}
