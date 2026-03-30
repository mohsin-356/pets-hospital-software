import React, { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useNavigate } from 'react-router-dom'
import DateRangePicker from '../../components/DateRangePicker'
import { labReportsAPI, labTestsAPI, petsAPI, inventoryAPI, labRequestsAPI } from '../../services/api'
import { useLocation } from 'react-router-dom'

export default function AddLabReport(){
  const location = useLocation()
  const [intakeId, setIntakeId] = useState('')
  const [form, setForm] = useState({
    petName: '', ownerName: '', patientId: '', species: '', age: '', gender: '',
    testName: '', testId: `T-${Date.now()}`, sampleType: '', referredBy: '',
    result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10), technician: '', pdf: '',
    fee: '', paymentStatus: 'Paid',
    results: [] // [{ name, unit, refRange, value }]
  })
  const [catalog, setCatalog] = useState([])
  
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await labTestsAPI.getAll()
        console.log('Fetched catalog:', res.data) // Debug log
        console.log('First test price:', res.data?.[0]?.price) // Check price field
        setCatalog(res.data || [])
      } catch (err) {
        console.error('Error fetching catalog:', err)
      }
    }
    fetchCatalog()
  }, [])

  // Prefill from Sample Intake if intakeId is provided in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const intakeId = params.get('intakeId')
    if (!intakeId) return
    setIntakeId(intakeId)
    let cancelled = false
    ;(async()=>{
      try {
        const res = await labRequestsAPI.getById(intakeId)
        const r = res?.data || res
        if (!r || cancelled) return
        // Try to match test in catalog to seed parameters and fee
        const testName = r.testType === '__custom' ? (r.customTestName || '') : (r.testType || '')
        const ct = (catalog || []).find(t => (t.testName||t.name) === testName)
        const mappedResults = (ct?.parameters || ct?.params || []).map(p => ({
          name: p.name,
          unit: p.unit,
          refRange: p.normalRange || p.refRange,
          value: ''
        }))
        setForm(prev => ({
          ...prev,
          petName: r.petName || prev.petName,
          ownerName: r.ownerName || prev.ownerName,
          patientId: r.patientId || r.petId || prev.patientId,
          species: r.species || prev.species,
          age: r.age || prev.age,
          gender: r.gender || prev.gender,
          testName: testName || prev.testName,
          testId: r.testId || prev.testId,
          sampleType: r.sampleType || prev.sampleType,
          referredBy: r.doctorName || r.referredBy || prev.referredBy,
          fee: (ct?.price ?? r.fee ?? prev.fee) || '',
          paymentStatus: r.paymentStatus || prev.paymentStatus,
          results: mappedResults
        }))
        setShowForm(true)
      } catch (e) {
        console.error('Failed to prefill from intake', e)
      }
    })()
    return ()=>{ cancelled=true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, catalog.length])

  const { settings } = useSettings()
  const [showForm, setShowForm] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printData, setPrintData] = useState(null)
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [copyToast, setCopyToast] = useState('')
  const todayStr = useMemo(()=> new Date().toISOString().slice(0,10), [])
  const [dateRange, setDateRange] = useState({ fromDate: todayStr, toDate: todayStr })
  const inRange = (dStr) => {
    if (!dateRange?.fromDate && !dateRange?.toDate) return true
    if (!dStr) return false
    const d = String(dStr).slice(0,10)
    const from = dateRange.fromDate || '0000-01-01'
    const to = dateRange.toDate || '9999-12-31'
    return d >= from && d <= to
  }
  const filteredReports = useMemo(()=>{
    return (reports||[]).filter(r => inRange(r.collectionDate || r.date))
  }, [reports, dateRange.fromDate, dateRange.toDate])
  const stats = useMemo(()=>{
    const list = filteredReports || []
    const total = list.length
    const paid = list.filter(r => (r.paymentStatus || '').toLowerCase() === 'paid').length
    const pending = list.filter(r => (r.paymentStatus || '').toLowerCase() === 'pending').length
    const revenue = list.reduce((s, r) => s + (Number(r.amount)||0), 0)
    return { total, paid, pending, revenue }
  }, [filteredReports])
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyToast('Copied: ' + text)
      setTimeout(()=>setCopyToast(''), 1500)
    } catch (e) {
      console.error('Clipboard error:', e)
    }
  }
  
  useEffect(() => {
    fetchReports()
  }, [])
  
  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await labReportsAPI.getAll()
      console.log('Fetched reports:', response.data) // Debug log
      setReports(response.data || [])
    } catch (err) {
      console.error('Error fetching lab reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = e => {
    const { name, value, files } = e.target
    if (name === 'pdf') {
      const file = files?.[0]
      if (!file) return setForm(f=>({ ...f, pdf: '' }))
      const reader = new FileReader()
      reader.onload = () => setForm(f=>({ ...f, pdf: reader.result }))
      reader.readAsDataURL(file)
      return
    }
    
    // Auto-fill test fee and specimen when test is selected
    if (name === 'testName' && value && value !== '__custom') {
      const selectedTest = catalog.find(t => (t.testName || t.name) === value)
      if (selectedTest) {
        setForm(prev => ({
          ...prev,
          testName: value,
          fee: selectedTest.price || prev.fee,
          sampleType: selectedTest.sampleType || selectedTest.specimen || prev.sampleType,
          results: (selectedTest.parameters || selectedTest.params || []).map(p => ({
            name: p.name,
            unit: p.unit,
            refRange: p.normalRange || p.refRange,
            value: ''
          }))
        }))
        return
      }
    }
    
    // Auto-fill patient information when Patient ID is entered
    if (name === 'patientId' && value) {
      const fetchPetData = async () => {
        try {
          const response = await petsAPI.getById(value)
          if (response.data) {
            const matchedPet = response.data
            setForm(prev => ({
              ...prev,
              patientId: value,
              petName: matchedPet.petName || prev.petName,
              ownerName: matchedPet.ownerName || prev.ownerName,
              species: matchedPet.species || prev.species,
              age: matchedPet.age || prev.age,
              gender: matchedPet.gender || prev.gender
            }))
          }
        } catch (err) {
          console.error('Error loading pet data:', err)
          // If pet not found, generate new patient ID if fields are filled
        }
      }
      fetchPetData()
    }
    
    // Auto-generate patient ID if manually entering pet details
    if ((name === 'petName' || name === 'ownerName') && value && !form.patientId) {
      setForm(prev => ({
        ...prev,
        [name]: value,
        patientId: `PET-${Date.now()}`
      }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Print a saved report row
  const printSaved = (r) => {
    const mappedData = {
      ...r,
      patientId: r.petId || r.patientId,
      testId: r.id || r.testId,
      results: r.tests || r.results || [],
      testName: r.testType || r.testName,
      testDate: r.collectionDate || r.testDate || r.date,
      referredBy: r.requestedBy || r.referredBy,
      notes: r.overallNotes || r.result || r.remarks
    }
    setPrintData(mappedData)
    setShowPrintPreview(true)
  }

  // Edit/Delete for inline list
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const startEdit = (r) => { 
    // Map MongoDB fields to edit form
    const editData = {
      ...r,
      results: (r.tests || r.results || []).map(t => ({
        name: t.testName || t.name,
        value: t.result || t.value,
        unit: t.unit,
        refRange: t.normalRange || t.refRange
      }))
    }
    setEditItem(editData)
    setShowEdit(true)
  }
  const saveEdit = async (e) => {
    e.preventDefault()
    try {
      // Map edit form back to MongoDB schema
      const updateData = {
        ...editItem,
        tests: (editItem.results || []).map(r => ({
          testName: r.name,
          result: r.value,
          unit: r.unit,
          normalRange: r.refRange,
          status: 'Completed'
        })),
        amount: Number(editItem.amount || 0)
      }
      await labReportsAPI.update(editItem.id, updateData)
      await fetchReports()
      setShowEdit(false)
    } catch (err) {
      console.error('Error updating report:', err)
      alert('Failed to update report')
    }
  }
  const askDelete = (r) => { setEditItem(r); setShowDelete(true) }
  const confirmDelete = async () => {
    try {
      await labReportsAPI.delete(editItem.id)
      await fetchReports()
      setShowDelete(false)
      setEditItem(null)
    } catch (err) {
      console.error('Error deleting report:', err)
      alert('Failed to delete report')
    }
  }

  // Define inventory requirements for different lab tests
  const getTestInventoryRequirements = (testName) => {
    const requirements = {
      // Blood Tests
      'CBC': [
        { name: 'EDTA Tubes', category: 'Tubes & Vials', quantity: 1 },
        { name: 'CBC Reagent', category: 'Reagents', quantity: 1 }
      ],
      'Blood Chemistry': [
        { name: 'Serum Tubes', category: 'Tubes & Vials', quantity: 1 },
        { name: 'Chemistry Reagent', category: 'Reagents', quantity: 2 }
      ],
      'Liver Function Test': [
        { name: 'Serum Tubes', category: 'Tubes & Vials', quantity: 1 },
        { name: 'ALT Reagent', category: 'Reagents', quantity: 1 },
        { name: 'AST Reagent', category: 'Reagents', quantity: 1 }
      ],
      'Kidney Function Test': [
        { name: 'Serum Tubes', category: 'Tubes & Vials', quantity: 1 },
        { name: 'Creatinine Reagent', category: 'Reagents', quantity: 1 },
        { name: 'BUN Reagent', category: 'Reagents', quantity: 1 }
      ],
      // Urine Tests
      'Urinalysis': [
        { name: 'Urine Container', category: 'Tubes & Vials', quantity: 1 },
        { name: 'Urine Test Strips', category: 'Test Kits', quantity: 1 }
      ],
      // Fecal Tests
      'Fecal Examination': [
        { name: 'Fecal Container', category: 'Tubes & Vials', quantity: 1 },
        { name: 'Saline Solution', category: 'Reagents', quantity: 1 },
        { name: 'Microscope Slides', category: 'Glassware', quantity: 2 }
      ],
      // Microbiology
      'Bacterial Culture': [
        { name: 'Culture Media', category: 'Reagents', quantity: 2 },
        { name: 'Petri Dishes', category: 'Glassware', quantity: 2 },
        { name: 'Swabs', category: 'Consumables', quantity: 1 }
      ],
      // Parasitology
      'Parasite Examination': [
        { name: 'Microscope Slides', category: 'Glassware', quantity: 3 },
        { name: 'Cover Slips', category: 'Glassware', quantity: 3 },
        { name: 'Iodine Solution', category: 'Stains & Dyes', quantity: 1 }
      ],
      // Histopathology
      'Biopsy': [
        { name: 'Formalin', category: 'Chemicals', quantity: 1 },
        { name: 'Tissue Cassettes', category: 'Consumables', quantity: 1 },
        { name: 'H&E Stain', category: 'Stains & Dyes', quantity: 1 }
      ],
      // Cytology
      'Cytology': [
        { name: 'Microscope Slides', category: 'Glassware', quantity: 2 },
        { name: 'Diff-Quik Stain', category: 'Stains & Dyes', quantity: 1 }
      ],
      // Serology
      'ELISA Test': [
        { name: 'ELISA Kit', category: 'Test Kits', quantity: 1 },
        { name: 'Microplate', category: 'Consumables', quantity: 1 }
      ]
    }

    // Return requirements for the specific test, or empty array if not defined
    return requirements[testName] || []
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Check inventory requirements for the test
      const requiredItems = getTestInventoryRequirements(form.testName)
      
      if (requiredItems.length > 0) {
        // Check if all required items are available
        const inventoryResponse = await inventoryAPI.getAll()
        const labInventory = (inventoryResponse.data || []).filter(item => item.department === 'lab')
        
        const unavailableItems = []
        const insufficientItems = []
        
        for (const required of requiredItems) {
          const inventoryItem = labInventory.find(item => 
            item.itemName?.toLowerCase().includes(required.name.toLowerCase()) ||
            item.category?.toLowerCase() === required.category?.toLowerCase()
          )
          
          if (!inventoryItem) {
            unavailableItems.push(required.name)
          } else if (inventoryItem.quantity < required.quantity) {
            insufficientItems.push(`${required.name} (Available: ${inventoryItem.quantity}, Required: ${required.quantity})`)
          }
        }
        
        // Show alerts if items are missing or insufficient
        if (unavailableItems.length > 0) {
          alert(`⚠️ Missing Inventory Items:\n${unavailableItems.join('\n')}\n\nPlease add these items to inventory before conducting the test.`)
          return
        }
        
        if (insufficientItems.length > 0) {
          alert(`⚠️ Insufficient Inventory:\n${insufficientItems.join('\n')}\n\nPlease restock these items before conducting the test.`)
          return
        }
        
        // Deduct inventory items
        for (const required of requiredItems) {
          const inventoryItem = labInventory.find(item => 
            item.itemName?.toLowerCase().includes(required.name.toLowerCase()) ||
            item.category?.toLowerCase() === required.category?.toLowerCase()
          )
          
          if (inventoryItem) {
            const newQuantity = inventoryItem.quantity - required.quantity
            const newStatus = newQuantity === 0 ? 'Out of Stock' : (newQuantity <= inventoryItem.minStockLevel ? 'Low Stock' : 'In Stock')
            
            await inventoryAPI.update(inventoryItem.id, {
              ...inventoryItem,
              quantity: newQuantity,
              status: newStatus
            })
          }
        }
      }

      // Map form fields to MongoDB schema
      const report = {
        id: form.testId || `REP-${Date.now()}`,
        reportNumber: form.testId || `REP-${Date.now()}`,
        petId: form.patientId || `PET-${Date.now()}`,
        petName: form.petName,
        ownerName: form.ownerName,
        species: form.species || '',
        age: form.age || '',
        gender: form.gender || '',
        requestedBy: form.referredBy || '',
        testCategory: 'Laboratory',
        testType: form.testName,
        sampleType: form.sampleType || '',
        collectionDate: form.testDate || new Date().toISOString().slice(0, 10),
        reportDate: new Date(),
        tests: (form.results || []).map(r => ({
          testName: r.name,
          result: r.value,
          unit: r.unit,
          normalRange: r.refRange,
          status: 'Completed'
        })),
        overallNotes: form.result || form.remarks || '',
        technician: form.technician || '',
        status: 'Completed',
        priority: 'Normal',
        // Additional fields for compatibility
        date: form.testDate || new Date().toISOString().slice(0, 10),
        amount: Number(form.fee || 0),
        paymentStatus: form.paymentStatus || 'Paid',
        inventoryUsed: requiredItems // Track what inventory was used
      }
      
      console.log('Submitting report:', report) // Debug log
      console.log('Inventory deducted:', requiredItems) // Debug inventory usage
      await labReportsAPI.create(report)
      // If this report was created from a Sample Intake, mark that intake Completed
      try {
        if (intakeId) {
          await labRequestsAPI.update(intakeId, {
            status: 'Completed',
            paymentStatus: form.paymentStatus,
            fee: form.fee,
          })
        }
      } catch (e) { console.warn('Failed to update intake status', e) }
      await fetchReports()
      setForm({ 
        petName: '', ownerName: '', patientId:'', species:'', age:'', gender:'', 
        testName: '', testId:`T-${Date.now()}`, sampleType: '', referredBy:'', 
        result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10), 
        technician: '', pdf: '', fee:'', paymentStatus:'Paid', results: [] 
      })
      setShowForm(false)
    } catch (err) {
      console.error('Error creating report:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create report'
      alert(errorMsg)
    }
  }

  const printReport = () => {
    setPrintData(form)
    setShowPrintPreview(true)
    // Best-effort: also mark intake Completed on print if available
    ;(async()=>{
      try {
        if (intakeId) {
          await labRequestsAPI.update(intakeId, {
            status: 'Completed',
            paymentStatus: form.paymentStatus,
            fee: form.fee,
          })
        }
      } catch (e) { /* ignore */ }
    })()
  }

  const handlePrint = () => {
    try {
      window.print()
    } finally {
      // After print dialog completes, close all related dialogs
      setShowPrintPreview(false)
      setShowForm(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Test Reports</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
            </svg>
            Manage laboratory test reports
          </p>
        </div>
        <button 
          onClick={()=>setShowForm(true)} 
          className="px-6 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2 cursor-pointer font-semibold"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          Add Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
          <div className="text-xs text-blue-600 font-semibold mb-1">Total Reports</div>
          <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200">
          <div className="text-xs text-cyan-600 font-semibold mb-1">Paid</div>
          <div className="text-2xl font-bold text-cyan-700">{stats.paid}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <div className="text-xs text-amber-600 font-semibold mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
          <div className="text-xs text-purple-600 font-semibold mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-purple-700">Rs. {stats.revenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-800">Reports List</div>
              <div className="text-xs text-slate-500">{filteredReports.length} in range</div>
            </div>
          </div>
          <div>
            <DateRangePicker onDateChange={setDateRange} defaultFromDate={dateRange.fromDate} defaultToDate={dateRange.toDate} />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Pet</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Test</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-800">{r.petName}</div>
                    <div className="text-xs text-slate-500">{r.ownerName}</div>
                    {(r.petId || r.patientId) && (
                      <button
                        type="button"
                        onClick={()=>copyToClipboard(r.petId || r.patientId)}
                        className="mt-1 w-fit text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                        title="Click to copy"
                      >
                        {r.petId || r.patientId}
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-slate-700">{r.testType || r.testName}</div>
                    <div className="text-xs text-slate-500">{r.id || r.reportNumber || r.testId}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {r.collectionDate ? new Date(r.collectionDate).toLocaleDateString() : (r.date || '-')}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-purple-700">Rs. {Number(r.amount||0).toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      r.paymentStatus === 'Paid' 
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' 
                        : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      {r.paymentStatus || 'Paid'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={()=>printSaved(r)} 
                        className="px-3 h-9 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
                        </svg>
                        Print
                      </button>
                      <button 
                        onClick={()=>startEdit(r)} 
                        className="px-3 h-9 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                        Edit
                      </button>
                      <button 
                        onClick={()=>askDelete(r)} 
                        className="px-3 h-9 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length===0 && (
                <tr>
                  <td className="py-12 px-6 text-center" colSpan={6}>
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <div className="text-lg font-semibold text-slate-700 mb-1">No reports yet</div>
                      <div className="text-sm text-slate-500">Click "Add Report" to create your first test report</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowForm(false)}></div>
          <form onSubmit={handleSubmit} className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 px-8 py-6 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Add Test Report</h2>
                    <p className="text-blue-100 text-sm mt-1">Fill in the test details below</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={()=>setShowForm(false)} 
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl transition-all"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name</label>
                <input name="petName" value={form.petName} onChange={handleChange} placeholder="Enter pet name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="Enter owner name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                <input name="patientId" value={form.patientId} onChange={handleChange} placeholder="e.g., PT-123" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test ID</label>
                <input name="testId" value={form.testId} onChange={handleChange} placeholder="e.g., T-2025-001" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test</label>
                <select name="testName" value={form.testName} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full" required>
                  <option value="">Select Test</option>
                  {catalog.map(t => (<option key={t.id || t._id} value={t.testName || t.name}>{t.testName || t.name}</option>))}
                  <option value="__custom">Other (type manually)</option>
                </select>
              </div>
              {form.testName==='__custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Test Name</label>
                  <input name="testName" value={form.testNameInput||''} onChange={e=>setForm(f=>({ ...f, testName:e.target.value, testNameInput:e.target.value }))} placeholder="Enter test name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Species</label>
                <input name="species" value={form.species} onChange={handleChange} placeholder="e.g., Dog" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Age (Months)</label>
                <input name="age" value={form.age} onChange={handleChange} placeholder="e.g., 18" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Specimen</label>
                <input name="sampleType" value={form.sampleType} onChange={handleChange} placeholder="e.g., Blood" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                <input name="referredBy" value={form.referredBy} onChange={handleChange} placeholder="Doctor / Clinic" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Test</label>
                <input type="date" name="testDate" value={form.testDate} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Technician</label>
                <input name="technician" value={form.technician} onChange={handleChange} placeholder="Technician Name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fee (PKR)</label>
                <input name="fee" type="number" value={form.fee} onChange={handleChange} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select name="paymentStatus" value={form.paymentStatus} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>Paid</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>

            {(form.results||[]).length>0 && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">Results</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-white">
                        <th className="text-left py-2 px-3">S.#</th>
                        <th className="text-left py-2 px-3">Parameter</th>
                        <th className="text-left py-2 px-3">Result</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-left py-2 px-3">Ref. Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.results.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="py-2 px-3">{idx+1}</td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3"><input value={r.value||''} onChange={e=>setForm(f=>{ const arr=[...f.results]; arr[idx]={...arr[idx], value:e.target.value}; return { ...f, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-40" /></td>
                          <td className="py-2 px-3"><input value={r.unit||''} onChange={e=>setForm(f=>{ const arr=[...f.results]; arr[idx]={...arr[idx], unit:e.target.value}; return { ...f, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-32" /></td>
                          <td className="py-2 px-3"><input value={r.refRange||''} onChange={e=>setForm(f=>{ const arr=[...f.results]; arr[idx]={...arr[idx], refRange:e.target.value}; return { ...f, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-48" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Result / Observations</label>
              <textarea name="result" value={form.result} onChange={handleChange} placeholder="Free text" rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Remarks" rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload PDF (optional)</label>
              <input type="file" name="pdf" accept="application/pdf" onChange={handleChange} className="block" />
            </div>
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
              <button 
                type="button" 
                onClick={printReport} 
                className="px-6 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
                </svg>
                Print Preview
              </button>
              <button 
                type="submit"
                className="px-6 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Save Report
              </button>
            </div>
            </div>
          </form>
        </div>
      )}

      {showEdit && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowEdit(false)}></div>
          <form onSubmit={saveEdit} className="relative w-[95%] max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-800">Edit Report</div>
              <button type="button" onClick={()=>setShowEdit(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fee (PKR)</label>
                <input type="number" value={editItem.amount||0} onChange={e=>setEditItem(it=>({...it, amount:Number(e.target.value||0)}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select value={editItem.paymentStatus||'Paid'} onChange={e=>setEditItem(it=>({...it, paymentStatus:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>Paid</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>
            {(editItem.results||[]).length>0 && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">Results</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-white">
                        <th className="text-left py-2 px-3">S.#</th>
                        <th className="text-left py-2 px-3">Parameter</th>
                        <th className="text-left py-2 px-3">Result</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-left py-2 px-3">Ref. Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItem.results.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="py-2 px-3">{idx+1}</td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3"><input value={r.value||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], value:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-40" /></td>
                          <td className="py-2 px-3"><input value={r.unit||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], unit:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-32" /></td>
                          <td className="py-2 px-3"><input value={r.refRange||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], refRange:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-48" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={()=>setShowEdit(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button className="px-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {showDelete && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowDelete(false)}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
            <div className="text-lg font-bold text-slate-900 mb-2">Delete Report</div>
            <div className="text-sm text-slate-600 mb-4">Are you sure you want to delete report for <span className="font-medium">{editItem.petName}</span> ({editItem.testName})?</div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setShowDelete(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <style>{`
              @page { size: A4; margin: 12mm; }
              @media print {
                html, body { width: 210mm; }
                body * { visibility: hidden; }
                #lab-report-print, #lab-report-print * { visibility: visible; }
                #lab-report-print {
                  position: static;
                  width: 190mm;
                  margin: 0 auto;
                  padding: 0;
                  box-shadow: none !important;
                }
                .print-page-break { page-break-before: always; }
                table { page-break-inside: auto; }
                tr, td, th { page-break-inside: avoid; }
              }
            `}</style>
            
            <div id="lab-report-print" className="p-8 overflow-y-auto flex-1">
              {/* Header */}
              <div className="text-center border-b-4 border-blue-600 pb-3 mb-6">
                <div className="text-3xl font-bold text-blue-600" style={{fontFamily: 'Georgia, serif'}}>{settings.companyName || 'Pet Matrix'}</div>
              </div>

              {/* Test Information Grid */}
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Test Date:</span>
                    <span className="flex-1">{printData.testDate || printData.date || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Test ID:</span>
                    <span className="flex-1">{printData.testId || printData.id || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Patient ID:</span>
                    <span className="flex-1">{printData.patientId || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Owner Name:</span>
                    <span className="flex-1">{printData.ownerName || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Animal Name:</span>
                    <span className="flex-1">{printData.petName || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Gender:</span>
                    <span className="flex-1">{printData.gender || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Species:</span>
                    <span className="flex-1">{printData.species || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Date:</span>
                    <span className="flex-1">{new Date(printData.testDate || printData.date).toLocaleDateString() || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Age (M):</span>
                    <span className="flex-1">{printData.age || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Referred By:</span>
                    <span className="flex-1 text-red-600 font-semibold">{printData.referredBy || 'Manual'}</span>
                  </div>
                </div>
              </div>

              {/* Test Name */}
              <div className="mb-4">
                <div className="text-xl font-bold">{printData.testName || 'Laboratory Test'}</div>
              </div>

              {/* Test Results Table */}
              {(printData.results || []).length > 0 && (
                <table className="w-full border-collapse text-sm mb-6">
                  <thead>
                    <tr className="border-b-2 border-slate-800">
                      <th className="text-left py-2 px-2 font-bold">S.#</th>
                      <th className="text-left py-2 px-2 font-bold">Parameter</th>
                      <th className="text-left py-2 px-2 font-bold">Result</th>
                      <th className="text-left py-2 px-2 font-bold">Unit</th>
                      <th className="text-left py-2 px-2 font-bold">Ref. Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.results || []).map((r, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="py-2 px-2">{i + 1}</td>
                        <td className="py-2 px-2">{r.testName || r.name || ''}</td>
                        <td className="py-2 px-2 font-semibold">{r.result || r.value || ''}</td>
                        <td className="py-2 px-2">{r.unit || ''}</td>
                        <td className="py-2 px-2">{r.normalRange || r.refRange || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Notes / Result Text */}
              {(printData.notes || printData.result || printData.remarks) && (
                <div className="mt-4 pt-4 border-t border-slate-300 space-y-2">
                  {printData.notes && (
                    <div>
                      <div className="font-semibold mb-1">Notes:</div>
                      <div className="text-sm">{printData.notes}</div>
                    </div>
                  )}
                  {(printData.result || printData.remarks) && (
                    <div>
                      {printData.result && (
                        <div className="mb-1">
                          <div className="font-semibold">Result</div>
                          <div className="text-sm">{printData.result}</div>
                        </div>
                      )}
                      {printData.remarks && (
                        <div>
                          <div className="font-semibold">Remarks</div>
                          <div className="text-sm">{printData.remarks}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="border-t border-slate-200 p-4 flex justify-end gap-3">
              <button 
                onClick={() => setShowPrintPreview(false)} 
                className="px-6 h-11 rounded-lg border-2 border-slate-300 hover:bg-slate-50 font-semibold text-slate-700"
              >
                OK
              </button>
              <button 
                onClick={handlePrint} 
                className="px-6 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
      {copyToast && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-black/80 text-white text-sm px-3 py-2">{copyToast}</div>
      )}
    </div>
  )
}
