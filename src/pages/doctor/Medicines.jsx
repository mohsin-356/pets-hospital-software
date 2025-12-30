import React, { useEffect, useMemo, useState } from 'react'
import { medicinesAPI, settingsAPI } from '../../services/api'

export default function DoctorMedicines(){
  // Regimen form supports multiple rows under a condition
  // composition: textual composition string (e.g., Amoxicillin 250mg + Clav 125mg)
  // doseRate: numeric dose rate (e.g., mg/kg)
  // perMl: composition per ml (e.g., mg/ml) used for dose calculation
  const emptyRow = { route:'Injection', name:'', doseRate:'', perMl:'', unit:'', instructions:'' }
  const [form, setForm] = useState({ id:null, condition:'', rows:[{...emptyRow}] })
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const DEFAULT_ROUTES = ['Infusion','Injection','Tablet','Syrup','Other']
  const [routeOptions, setRouteOptions] = useState(DEFAULT_ROUTES)
  const [showAddRoute, setShowAddRoute] = useState(false)
  const [newRoute, setNewRoute] = useState('')
  const [routeRowIndex, setRouteRowIndex] = useState(null)
  const [settingsDoc, setSettingsDoc] = useState(null)

  // Load existing from MongoDB
  const [loaded, setLoaded] = useState(false)
  useEffect(()=>{
    const fetchMedicines = async () => {
      try {
        const response = await medicinesAPI.getAll()
        const raw = response?.data || []
        // normalize flat entries into a single-row regimen
        const normalized = raw.map(m => m.rows ? m : ({ id:m.id, condition: m.name || 'General', rows: [{ route:'Other', name: m.name, composition: m.composition || m.dosage, doseRate: m.doseRate || '', perMl: m.perMl || '', dose:'', unit:'', instructions: m.description, ingredients: m.ingredients }] }))
        setItems(normalized)
      } catch (error) {
        console.error('Error fetching medicines:', error)
        // Fallback to localStorage
        try {
          const raw = JSON.parse(localStorage.getItem('doctor_medicines')||'[]')
          const normalized = raw.map(m => m.rows ? m : ({ id:m.id, condition: m.name || 'General', rows: [{ route:'Other', name: m.name, composition: m.composition || m.dosage, doseRate: m.doseRate || '', perMl: m.perMl || '', dose:'', unit:'', instructions: m.description, ingredients: m.ingredients }] }))
          setItems(normalized)
        } catch (e) {
          setItems([])
        }
      }
      setLoaded(true)
    }
    fetchMedicines()
  },[])

  // Load existing route options from Settings (MongoDB) or seed defaults
  useEffect(()=>{
    (async()=>{
      try {
        const user = JSON.parse(localStorage.getItem('user')||'{}')
        const userId = user.username || 'admin'
        const res = await settingsAPI.get(userId)
        const data = res?.data || res
        setSettingsDoc(data)
        const routes = data?.customSettings?.medicineRoutes || data?.medicineRoutes || []
        if (Array.isArray(routes) && routes.length) {
          const uniq = Array.from(new Set(routes.map(r=>String(r).trim()).filter(Boolean)))
          setRouteOptions(uniq)
          try { localStorage.setItem('medicine_routes', JSON.stringify(uniq)) } catch {}
          return
        }
      } catch (e) {
        // ignore
      }
      // Fallback to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('medicine_routes')||'[]')
        if (Array.isArray(stored) && stored.length) { setRouteOptions(stored); return }
      } catch {}
      setRouteOptions(DEFAULT_ROUTES)
    })()
  },[])

  const persistRoutes = async (routes) => {
    const user = JSON.parse(localStorage.getItem('user')||'{}')
    const userId = user.username || 'admin'
    const nextDoc = {
      ...(settingsDoc || { userId, role: 'doctor' }),
      customSettings: { ...((settingsDoc&&settingsDoc.customSettings)||{}), medicineRoutes: routes }
    }
    try {
      await settingsAPI.update(userId, nextDoc)
      setSettingsDoc(nextDoc)
      try { localStorage.setItem('medicine_routes', JSON.stringify(routes)) } catch {}
    } catch (e) {
      // best-effort local cache
      try { localStorage.setItem('medicine_routes', JSON.stringify(routes)) } catch {}
    }
  }

  const handleAddRouteSave = async () => {
    const name = String(newRoute||'').trim()
    if (!name) return
    const uniq = Array.from(new Set([...
      routeOptions,
      name
    ]))
    setRouteOptions(uniq)
    await persistRoutes(uniq)
    if (routeRowIndex!=null) {
      setForm(f=>({ ...f, rows: f.rows.map((r,i)=> i===routeRowIndex ? { ...r, route: name } : r) }))
    }
    setShowAddRoute(false)
    setNewRoute('')
    setRouteRowIndex(null)
  }

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return items
    return items.filter(m=> [m.condition, ...(m.rows||[]).map(r=>r.name), ...(m.rows||[]).map(r=>r.instructions)].some(v=>String(v||'').toLowerCase().includes(s)))
  },[items,q])

  const addRow = () => setForm(f=>({ ...f, rows:[...f.rows, { ...emptyRow }] }))
  const updateRow = (idx, field, value) => setForm(f=>({ ...f, rows: f.rows.map((r,i)=> i===idx ? { ...r, [field]: value } : r) }))
  const removeRow = (idx) => setForm(f=>({ ...f, rows: f.rows.filter((_,i)=>i!==idx) }))

  const resetForm = () => setForm({ id:null, condition:'', rows:[{...emptyRow}] })

  const save = async (e) => {
    e.preventDefault()
    if(!form.condition || !(form.rows||[]).some(r=>r.name)) return
    const cleaned = { ...form, rows: form.rows.filter(r=>r.name) }
    
    try {
      if(form.id){
        // Update existing medicine
        await medicinesAPI.update(form.id, cleaned)
        setItems(prev=>prev.map(x=>x.id===form.id? cleaned : x))
      } else {
        // Create new medicine
        const newMedicine = {...cleaned, id: Date.now()}
        await medicinesAPI.create(newMedicine)
        setItems(prev=>[newMedicine, ...prev])
      }
      // Also update localStorage for backward compatibility
      const updatedItems = form.id 
        ? items.map(x=>x.id===form.id? cleaned : x)
        : [{...cleaned, id: Date.now()}, ...items]
      localStorage.setItem('doctor_medicines', JSON.stringify(updatedItems))
    } catch (error) {
      console.error('Error saving medicine:', error)
      // Fallback to localStorage only
      if(form.id){
        setItems(prev=>prev.map(x=>x.id===form.id? cleaned : x))
      } else {
        setItems(prev=>[{...cleaned, id: Date.now()}, ...prev])
      }
      localStorage.setItem('doctor_medicines', JSON.stringify(items))
    }
    resetForm()
  }
  const edit = m => setForm({ id:m.id, condition:m.condition, rows: (m.rows&&m.rows.length? m.rows : [{...emptyRow}]) })
  const del = async (m) => {
    try {
      await medicinesAPI.delete(m.id)
      setItems(prev=>prev.filter(x=>x.id!==m.id))
      // Also update localStorage
      const updated = items.filter(x=>x.id!==m.id)
      localStorage.setItem('doctor_medicines', JSON.stringify(updated))
    } catch (error) {
      console.error('Error deleting medicine:', error)
      // Fallback to localStorage only
      setItems(prev=>prev.filter(x=>x.id!==m.id))
      localStorage.setItem('doctor_medicines', JSON.stringify(items.filter(x=>x.id!==m.id)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Medicine Management</h1>
        <p className="text-slate-500 mt-1">Create and manage medicine regimens by condition</p>
      </div>
      {showAddRoute && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setShowAddRoute(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">Add New Route</div>
            <div className="px-6 py-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Route Name</label>
              <input value={newRoute} onChange={e=>setNewRoute(e.target.value)} placeholder="e.g., Nebulization, Topical" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setShowAddRoute(false)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={handleAddRouteSave} className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-xl ring-1 ring-slate-200/50 p-6 border border-slate-100">
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Medical Condition
              </label>
              <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="e.g., Gastroenteritis, Dehydration" value={form.condition} onChange={e=>setForm(s=>({...s,condition:e.target.value}))} required />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
                Search Regimens
              </label>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search conditions, medicines..." className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200 bg-white shadow-sm" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <h3 className="text-lg font-semibold text-slate-800">Medicine Regimen</h3>
            </div>
            {form.rows.map((r, idx)=> (
              <div key={idx} className="group rounded-xl border-2 border-slate-200 hover:border-purple-300 p-4 bg-gradient-to-br from-white to-purple-50/30 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Line 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Route</label>
                    <select value={r.route} onChange={e=>{
                      const val = e.target.value
                      if (val === '__add__') { setRouteRowIndex(idx); setNewRoute(''); setShowAddRoute(true); return }
                      updateRow(idx,'route',val)
                    }} className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 bg-white w-full transition-all duration-200">
                      {routeOptions.map(opt=> (<option key={opt} value={opt}>{opt}</option>))}
                      <option value="__add__">+ Add new route…</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Medicine Name</label>
                    <input value={r.name} onChange={e=>updateRow(idx,'name',e.target.value)} placeholder="Enter medicine name" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
                  </div>
                </div>
                {/* Line 2 */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Dose Rate</label>
                    <input value={r.doseRate||''} onChange={e=>updateRow(idx,'doseRate',e.target.value)} placeholder="e.g., 10 mg/kg" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Composition per ml</label>
                    <input value={r.perMl||''} onChange={e=>updateRow(idx,'perMl',e.target.value)} placeholder="e.g., 100 mg/ml" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Unit</label>
                    <input value={r.unit} onChange={e=>updateRow(idx,'unit',e.target.value)} placeholder="ml, mg, tabs" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Instructions</label>
                    <input value={r.instructions} onChange={e=>updateRow(idx,'instructions',e.target.value)} placeholder="e.g., once daily for 5 days" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 w-full transition-all duration-200" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  {form.rows.length>1 && <button type="button" onClick={()=>removeRow(idx)} className="h-9 px-4 rounded-lg bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 cursor-pointer text-sm font-medium transition-all duration-200 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    Remove
                  </button>}
                </div>
              </div>
            ))}
          <button type="button" onClick={addRow} className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Add Medicine Row
          </button>
          </div>

          <div className="flex gap-3">
            <button className="px-6 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              {form.id? 'Update Regimen':'Save Regimen'}
            </button>
            {form.id && <button type="button" onClick={resetForm} className="px-6 h-12 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer font-semibold transition-all duration-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              Cancel
            </button>}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(m=> (
          <div key={m.id} className="group rounded-2xl bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-indigo-300 shadow-lg hover:shadow-xl p-6 transition-all duration-300 hover:scale-105">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                  <div className="font-bold text-slate-800 text-lg">{m.condition}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span className="font-medium">{(m.rows||[]).length} medicines</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>edit(m)} className="px-3 h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white cursor-pointer text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                  Edit
                </button>
                <button onClick={()=>setToDelete(m)} className="px-3 h-9 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white cursor-pointer text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                  Delete
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {(m.rows||[]).map((r,i)=> (
                <div key={i} className="bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-semibold">{r.route}</span>
                    <span className="font-semibold text-slate-800">{r.name}</span>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-x-3">
                    {r.doseRate && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/></svg>Dose Rate: {r.doseRate}</span>}
                    {r.perMl && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-cyan-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/></svg>Per ml: {r.perMl}</span>}
                    {r.unit && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>{r.unit}</span>}
                  </div>
                  {r.instructions && <div className="text-xs text-slate-500 mt-1 italic">{r.instructions}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div className="col-span-full rounded-2xl bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-dashed border-slate-300 text-slate-400 p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            <div className="text-lg font-semibold mb-1">No regimens found</div>
            <div className="text-sm">Create your first medicine regimen to get started</div>
          </div>
        )}
      </div>
      {toDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">Delete Regimen</div>
            <div className="px-6 py-4 text-sm text-slate-700">
              Are you sure you want to delete this regimen?
              <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Condition</div>
                <div className="text-slate-800 font-medium">{toDelete?.condition}</div>
                <div className="text-xs text-slate-500 mt-1">Items</div>
                <div className="text-slate-800">{(toDelete?.rows||[]).length}</div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setToDelete(null)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={()=>{ del(toDelete); setToDelete(null) }} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
