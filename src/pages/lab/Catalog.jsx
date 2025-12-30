import React, { useEffect, useMemo, useState } from 'react'
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiDollarSign, FiClock } from 'react-icons/fi'
import { labTestsAPI } from '../../services/api'

export default function LabTestCatalog(){
  // Preloaded common tests (from shared list) with default category 'Test'
  const TEST_TEMPLATES = useMemo(()=>[
    { name:'Blood Glucose', price:350 },
    { name:'Blood Glucose - Clinic', price:150 },
    { name:'Blood Smear', price:700 },
    { name:'Ultrasound (Pregnancy Diagnosis)', price:1000 },
    { name:'Ultrasound (Abdominal)', price:1000 },
    { name:'CBC', price:200 },
    { name:'CBC (VRI)', price:200 },
    { name:'Cross Match', price:1000 },
    { name:'Fecal analysis', price:150 },
    { name:'FIP', price:5000 },
    { name:'Rivalta', price:1050 },
    { name:"LFT's (4 Para)", price:2500 },
    { name:'P4', price:3000 },
    { name:'Pre-anesthetic Blood Work', price:2500 },
    { name:"RFT's", price:2000 },
    { name:'Serum Calcium', price:1000 },
    { name:'Electrolytes (Serum)', price:3000 },
    { name:'Skin cytology', price:500 },
    { name:'TFT', price:5000 },
    { name:'Free T-3, Free T-4 & TSH', price:5000 },
    { name:'Urine R/E', price:700 },
    { name:'Vaginal cytology', price:700 },
    { name:'X-Ray', price:1000 },
  ], [])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const BANNED_CATEGORIES = ['ok','ass','khao','abc']
  const isBanned = (c) => BANNED_CATEGORIES.includes(String(c||'').trim().toLowerCase())
  const [customTemplates, setCustomTemplates] = useState([])
  const templateOptions = useMemo(()=>{
    // Merge predefined templates with any added in the session (avoid dups by name)
    const map = new Map()
    ;[...TEST_TEMPLATES, ...customTemplates].forEach(t=>{ if(t?.name) map.set(t.name, { name:t.name, price:Number(t.price||0) }) })
    return Array.from(map.values())
  }, [TEST_TEMPLATES, customTemplates])
  
  useEffect(() => {
    fetchTests()
  }, [])
  
  const fetchTests = async () => {
    try {
      setLoading(true)
      const response = await labTestsAPI.getAll()
      setItems(response.data || [])
    } catch (err) {
      console.error('Error fetching lab tests:', err)
    } finally {
      setLoading(false)
    }
  }
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [editingId, setEditingId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const emptyForm = { id:'', name:'', category:'', notes:'', price:'', specimen:'Blood', fasting:false, parameter:'', unit:'', rangeM:'', rangeF:'', rangeP:'', speciesRanges:[{species:'Cat', range:''},{species:'Dog', range:''},{species:'Horse', range:''}], params:[{ name:'', unit:'', refRange:'' }] }
  const [form, setForm] = useState(emptyForm)
  const [showTemplateAdder, setShowTemplateAdder] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name:'', price:'' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [notification, setNotification] = useState({ show: false, type: '', message: '' })
  
  const showNotification = (type, message) => {
    setNotification({ show: true, type, message })
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000)
  }


  const categories = useMemo(()=>{
    const defaults = ['Test','Radiology','Serology','Biochemistry','Hematology','Urine','Parasitology','Cytology','Microbiology','Imaging']
    const s = new Set(defaults)
    ;(items||[]).forEach(i => {
      const c = (i.category||'').trim()
      if (c && !isBanned(c)) s.add(c)
    })
    return ['All', ...Array.from(s)]
  }, [items])

  const filtered = useMemo(()=> items.filter(i => {
    const text = (i.name+i.category+i.specimen+(i.parameter||'')).toLowerCase()
    const byText = text.includes(q.toLowerCase())
    const byCat = categoryFilter==='All' ? true : (i.category||'')===categoryFilter
    return byText && byCat
  }), [items, q, categoryFilter])

  const onChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }))
  const updateSpecies = (idx, key, value) => {
    setForm(prev => {
      const speciesRanges = [...(prev.speciesRanges || [])]
      speciesRanges[idx] = { ...speciesRanges[idx], [key]: value }
      return { ...prev, speciesRanges }
    })
  }
  const addSpecies = () => setForm(prev => ({ ...prev, speciesRanges:[...(prev.speciesRanges||[]), { species:'', range:'' }] }))
  const removeSpecies = (idx) => setForm(prev => ({ ...prev, speciesRanges:(prev.speciesRanges||[]).filter((_,i)=>i!==idx) }))
  const updateParam = (idx, key, value) => {
    setForm(prev => {
      const params = [...(prev.params||[])]
      params[idx] = { ...params[idx], [key]: value }
      return { ...prev, params }
    })
  }
  const addParam = () => setForm(prev => ({ ...prev, params:[...(prev.params||[]), { name:'', unit:'', refRange:'' }] }))
  const removeParam = (idx) => setForm(prev => ({ ...prev, params:(prev.params||[]).filter((_,i)=>i!==idx) }))

  const reset = () => { setEditingId(''); setForm(emptyForm) }

  const save = async (e) => {
    e.preventDefault()
    try {
      // Map form fields to match MongoDB schema
      const normalize = (text='') => {
        const t = String(text).trim()
        if (!t) return ''
        return t.charAt(0).toUpperCase() + t.slice(1)
      }
      // normalize, trim and deduplicate species ranges
      const normSpecies = []
      const seen = new Set()
      for (const s of (form.speciesRanges||[])) {
        const species = normalize(s.species)
        const range = String(s.range||'').trim()
        if (!species || !range) continue
        if (seen.has(species)) continue
        seen.add(species)
        normSpecies.push({ species, range })
      }

      const entry = {
        id: form.id || `TEST-${Date.now()}`,
        testName: form.name,
        category: isBanned(form.category) ? 'Test' : (form.category || 'Test'),
        price: Number(form.price||0),
        sampleType: form.specimen,
        parameters: (form.params||[]).filter(p=>p.name?.trim()).map(p => ({
          name: p.name,
          unit: p.unit,
          normalRange: p.refRange
        })),
        // Additional fields from form
        notes: form.notes,
        fasting: form.fasting,
        parameter: form.parameter,
        unit: form.unit,
        // legacy demographic fields kept for backward compatibility
        rangeM: normSpecies.find(s=>s.species==='Cat')?.range || form.rangeM,
        rangeF: normSpecies.find(s=>s.species==='Dog')?.range || form.rangeF,
        rangeP: normSpecies.find(s=>s.species==='Horse')?.range || form.rangeP,
        // new species-based ranges
        speciesRanges: normSpecies
      }
      
      if (editingId) {
        await labTestsAPI.update(form.id || editingId, entry)
        showNotification('success', 'Test updated successfully!')
      } else {
        await labTestsAPI.create(entry)
        showNotification('success', 'Test created successfully!')
        // Add to in-session template options for quick future selection
        setCustomTemplates(prev => [{ name: entry.testName, price: entry.price }, ...prev])
      }
      await fetchTests()
      reset()
      setShowForm(false)
    } catch (err) {
      console.error('Error saving test:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save test. Please try again.'
      showNotification('error', errorMsg)
    }
  }

  const edit = (i) => { 
    console.log('Editing test:', i) // Debug log
    setEditingId(i._id || i.id)
    // Map MongoDB fields back to form fields
    const mappedForm = {
      _id: i._id,
      id: i.id,
      name: i.testName || i.name || '',
      category: isBanned(i.category) ? 'Test' : (i.category || ''),
      notes: i.notes || '',
      price: i.price || '',
      specimen: i.sampleType || i.specimen || 'Blood',
      fasting: i.fasting || false,
      parameter: i.parameter || '',
      unit: i.unit || '',
      rangeM: i.rangeM || '',
      rangeF: i.rangeF || '',
      rangeP: i.rangeP || '',
      speciesRanges: (Array.isArray(i.speciesRanges) && i.speciesRanges.length>0)
        ? i.speciesRanges
        : [
            { species:'Cat', range: i.rangeM || '' },
            { species:'Dog', range: i.rangeF || '' },
            { species:'Horse', range: i.rangeP || '' },
          ],
      params: (i.parameters || i.params || []).length > 0 
        ? (i.parameters || i.params).map(p => ({
            name: p.name || '',
            unit: p.unit || '',
            refRange: p.normalRange || p.refRange || ''
          }))
        : [{ name: '', unit: '', refRange: '' }]
    }
    console.log('Mapped form:', mappedForm) // Debug log
    setForm(mappedForm)
    setShowForm(true)
  }
  const askDelete = (i) => { setToDelete(i); setShowDeleteConfirm(true) }
  const del = async () => {
    try {
      await labTestsAPI.delete(toDelete.id)
      await fetchTests()
      setShowDeleteConfirm(false)
      setToDelete(null)
      showNotification('success', 'Test deleted successfully!')
    } catch (err) {
      console.error('Error deleting test:', err)
      showNotification('error', 'Failed to delete test. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Test Catalog</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <FiSearch className="w-4 h-4" />
            Manage available laboratory tests
          </p>
        </div>
        <button
          onClick={()=>{setShowForm(true); setEditingId(''); setForm(emptyForm)}}
          className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2 cursor-pointer font-semibold"
        >
          <FiPlus className="w-5 h-5" /> Add New Test
          <span className="ml-2 px-2 py-1 rounded-lg bg-white/20 text-sm font-bold">
            {items.length}
          </span>
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            className="h-12 pl-12 pr-4 w-full rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white shadow-sm"
            placeholder="Search tests by name, category, or specimen..."
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e=>setCategoryFilter(e.target.value)}
          className="h-12 px-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          {categories.map(c => (<option key={c}>{c}</option>))}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={()=>{ setShowForm(false); reset() }}></div>
          <form onSubmit={save} className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{editingId? 'Edit Test' : 'Add New Test'}</h2>
                  <p className="text-emerald-100 text-sm mt-1">Fill in the test details below</p>
                </div>
                <button 
                  type="button" 
                  onClick={()=>{ setShowForm(false); reset() }} 
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-8 space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs">1</span>
                    Test Name
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.name || ''}
                      onChange={e=>{
                        const val = e.target.value
                        if (val === '__add_new__') { setShowTemplateAdder(true); return }
                        onChange('name', val)
                        const t = templateOptions.find(tt => tt.name===val)
                        if (t) onChange('price', t.price)
                        if (!form.category) onChange('category','Test')
                      }}
                      className="h-12 px-4 rounded-xl border-2 border-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all bg-white shadow-sm font-medium"
                      required
                    >
                      <option value="">Select Test</option>
                      {/* Ensure current value appears even if not in template list (for editing) */}
                      {(form.name && !templateOptions.some(t=>t.name===form.name)) && (
                        <option value={form.name}>{form.name}</option>
                      )}
                      {templateOptions.map(t => (<option key={t.name} value={t.name}>{t.name}</option>))}
                      <option value="__add_new__">+ Add New…</option>
                    </select>
                  </div>
                  {showTemplateAdder && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50">
                      <input value={newTemplate.name} onChange={e=>setNewTemplate(p=>({...p, name:e.target.value}))} placeholder="New test name" className="h-11 px-3 rounded-lg border border-emerald-300" />
                      <input type="number" value={newTemplate.price} onChange={e=>setNewTemplate(p=>({...p, price:e.target.value}))} placeholder="Price" className="h-11 px-3 rounded-lg border border-emerald-300" />
                      <div className="flex gap-2">
                        <button type="button" onClick={()=>{
                          const nm = (newTemplate.name||'').trim(); const pr = Number(newTemplate.price||0)
                          if (!nm) return
                          setCustomTemplates(prev => [{ name:nm, price:pr }, ...prev])
                          onChange('name', nm)
                          onChange('price', pr)
                          if (!form.category) onChange('category','Test')
                          setShowTemplateAdder(false)
                          setNewTemplate({ name:'', price:'' })
                        }} className="px-4 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Use</button>
                        <button type="button" onClick={()=>{ setShowTemplateAdder(false); setNewTemplate({ name:'', price:'' }) }} className="px-4 h-11 rounded-lg border border-slate-300">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs">2</span>
                    Category
                  </label>
                  <select
                    value={form.category || 'Test'}
                    onChange={e=>onChange('category', e.target.value)}
                    className="h-12 px-4 rounded-xl border-2 border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 w-full transition-all bg-white shadow-sm font-medium"
                  >
                    {categories.filter(c=>c!=='All').map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs">3</span>
                  Notes
                </label>
                <textarea 
                  value={form.notes} 
                  onChange={e=>onChange('notes', e.target.value)} 
                  placeholder="Enter test notes or special instructions..." 
                  rows="3"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all bg-white shadow-sm font-medium resize-none" 
                />
              </div>
            </div>

            {/* Pricing & Specimen Section */}
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 border-2 border-amber-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <FiDollarSign className="w-4 h-4 text-white" />
                </div>
                <div className="text-base font-bold text-slate-800">Pricing & Specimen Details</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Price (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rs.</span>
                    <input 
                      type="number" 
                      value={form.price} 
                      onChange={e=>onChange('price', e.target.value)} 
                      placeholder="0" 
                      className="h-12 pl-14 pr-4 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 w-full transition-all bg-white shadow-sm font-bold text-lg" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Specimen</label>
                  <select 
                    value={form.specimen} 
                    onChange={e=>onChange('specimen', e.target.value)} 
                    className="h-12 px-4 rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 w-full transition-all bg-white shadow-sm font-medium"
                  >
                    <option>Blood</option>
                    <option>Urine</option>
                    <option>Stool</option>
                    <option>Swab</option>
                    <option>Serum</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-white border-2 border-amber-200">
                <input 
                  type="checkbox" 
                  id="fasting" 
                  checked={form.fasting} 
                  onChange={e=>onChange('fasting', e.target.checked)} 
                  className="w-5 h-5 rounded border-2 border-amber-400 text-amber-600 focus:ring-2 focus:ring-amber-200 cursor-pointer" 
                />
                <label htmlFor="fasting" className="text-sm font-semibold text-slate-700 cursor-pointer flex items-center gap-2">
                  <FiClock className="w-4 h-4 text-amber-600" />
                  Fasting Required
                </label>
              </div>
            </div>

            {/* Optional Parameters Section */}
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-5 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800">Optional Parameters</div>
                  <div className="text-xs text-slate-500">Additional test information</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Parameter (optional)</label>
                  <input 
                    value={form.parameter} 
                    onChange={e=>onChange('parameter', e.target.value)} 
                    placeholder="e.g., WBC" 
                    className="h-12 px-4 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 w-full transition-all bg-white shadow-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Unit (optional)</label>
                  <input 
                    value={form.unit} 
                    onChange={e=>onChange('unit', e.target.value)} 
                    placeholder="e.g., x10^9/L" 
                    className="h-12 px-4 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 w-full transition-all bg-white shadow-sm font-medium" 
                  />
                </div>
              </div>
            </div>
            {/* Parameters Template Section */}
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-6 border-2 border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800">Parameters Template</div>
                  <div className="text-xs text-slate-500">Define test parameters with reference ranges</div>
                </div>
              </div>
              
              {/* Parameter Headers */}
              {(form.params||[]).length > 0 && (
                <div className="grid grid-cols-12 gap-3 mb-3 px-2">
                  <div className="col-span-5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Parameter Name</label>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Unit</label>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Ref. Range</label>
                  </div>
                  <div className="col-span-1"></div>
                </div>
              )}
              
              {/* Parameter Rows */}
              <div className="space-y-3">
                {(form.params||[]).map((p, idx)=> (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <input 
                        value={p.name} 
                        onChange={e=>updateParam(idx,'name',e.target.value)} 
                        placeholder="e.g., WBC, Hemoglobin" 
                        className="h-11 px-4 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-full bg-white transition-all" 
                      />
                    </div>
                    <div className="col-span-3">
                      <input 
                        value={p.unit} 
                        onChange={e=>updateParam(idx,'unit',e.target.value)} 
                        placeholder="e.g., x10^9/L" 
                        className="h-11 px-4 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-full bg-white transition-all" 
                      />
                    </div>
                    <div className="col-span-3">
                      <input 
                        value={p.refRange} 
                        onChange={e=>updateParam(idx,'refRange',e.target.value)} 
                        placeholder="e.g., 4.0-11.0" 
                        className="h-11 px-4 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-full bg-white transition-all" 
                      />
                    </div>
                    <div className="col-span-1">
                      <button 
                        type="button" 
                        onClick={()=>removeParam(idx)} 
                        className="h-11 w-11 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center"
                        title="Remove parameter"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Empty State */}
              {(form.params||[]).length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm font-medium">No parameters added yet</div>
                  <div className="text-xs mt-1">Click "Add Parameter" to get started</div>
                </div>
              )}
              
              {/* Add Row Button */}
              <div className="mt-4 pt-4 border-t border-slate-300">
                <button 
                  type="button" 
                  onClick={addParam} 
                  className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FiPlus className="w-5 h-5" />
                  Add Parameter
                </button>
              </div>
            </div>
            {/* Reference Ranges Section (Species-based) */}
            <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-5 border-2 border-green-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-800">Reference Ranges</div>
                    <div className="text-xs text-slate-500">Species-wise normal values</div>
                  </div>
                </div>
                <button type="button" onClick={addSpecies} className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">Add Species</button>
              </div>
              {(form.speciesRanges||[]).length>0 && (
                <div className="grid grid-cols-12 gap-3 mb-2 px-2">
                  <div className="col-span-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Species</div>
                  <div className="col-span-7 text-xs font-semibold text-slate-600 uppercase tracking-wide">Normal Range</div>
                  <div className="col-span-1" />
                </div>
              )}
              <div className="space-y-3">
                {(form.speciesRanges||[]).map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4">
                      <input value={s.species} onChange={e=>updateSpecies(idx,'species',e.target.value)} placeholder="e.g., Cat" className="h-11 px-4 rounded-lg border-2 border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 w-full bg-white transition-all" />
                    </div>
                    <div className="col-span-7">
                      <input value={s.range} onChange={e=>updateSpecies(idx,'range',e.target.value)} placeholder="e.g., 3.5-5.0" className="h-11 px-4 rounded-lg border-2 border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 w-full bg-white transition-all" />
                    </div>
                    <div className="col-span-1">
                      <button type="button" onClick={()=>removeSpecies(idx)} className="h-11 w-11 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md flex items-center justify-center" title="Remove species">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={()=>{ setShowForm(false); reset() }} className="px-6 h-11 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold transition-all cursor-pointer">Cancel</button>
              <button className="px-6 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl font-semibold transition-all cursor-pointer">{editingId? 'Update Test' : 'Add Test'}</button>
            </div>
            </div>
          </form>
        </div>
      )}

      {/* Test Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{fontFamily: 'Poppins, sans-serif'}}>
        {filtered.map(i => (
          <div key={i.id} className="group relative rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden border border-slate-700">
            
            <div className="p-5">
              {/* Test Name */}
              <h3 className="text-lg font-semibold text-white mb-4 line-clamp-2 min-h-[3.5rem] tracking-wide">
                {i.testName || i.name}
              </h3>

              {/* Price */}
              <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md">
                <div className="flex items-baseline justify-between">
                  <span className="text-white/90 text-xs font-medium uppercase tracking-wider">Price</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-white/90">Rs.</span>
                    <span className="text-xl font-bold text-white">{Number(i.price||0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={()=>edit(i)} 
                  className="col-span-2 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-md text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View
                </button>
                <button 
                  onClick={()=>askDelete(i)} 
                  className="h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-all cursor-pointer inline-flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {filtered.length===0 && (
          <div className="col-span-full rounded-2xl bg-white ring-1 ring-slate-200 shadow-lg p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <FiSearch className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No tests found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {showDeleteConfirm && toDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="text-lg font-bold mb-2">Delete Test</div>
            <div className="text-slate-600 text-sm mb-4">Are you sure you want to delete <span className="font-medium">{toDelete.name}</span>?</div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setShowDeleteConfirm(false)} className="px-4 h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={del} className="px-4 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in">
          <div className={`rounded-xl shadow-2xl p-4 min-w-[320px] flex items-start gap-3 ${
            notification.type === 'success' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
              : 'bg-gradient-to-r from-red-500 to-rose-500'
          }`}>
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-sm mb-1">
                {notification.type === 'success' ? 'Success!' : 'Error!'}
              </div>
              <div className="text-white/90 text-sm">
                {notification.message}
              </div>
            </div>
            <button 
              onClick={() => setNotification({ show: false, type: '', message: '' })}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
