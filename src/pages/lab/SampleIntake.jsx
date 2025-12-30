import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import DateRangePicker from '../../components/DateRangePicker'
import { FiPlus, FiX, FiClipboard, FiCalendar, FiCheckCircle } from 'react-icons/fi'
import { labTestsAPI, petsAPI, labRequestsAPI } from '../../services/api'

export default function SampleIntake(){
  const [showModal, setShowModal] = useState(false)
  const [q, setQ] = useState('')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const fetchRequests = async () => {
    try { setLoading(true); const res = await labRequestsAPI.getAll(); setRequests(res?.data||[]) } finally { setLoading(false) }
  }
  useEffect(()=>{ fetchRequests() }, [])

  const empty = {
    id: '',
    petName: '',
    ownerName: '',
    contact: '',
    doctorName: '',
    testType: '',
    patientId: '',
    testId: `T-${Date.now()}`,
    species: '',
    age: '',
    gender: '',
    sampleType: '',
    priority: 'Routine',
    collectedBy: '',
    requestDate: new Date().toISOString().slice(0,10),
    requestTime: new Date().toTimeString().slice(0,5),
    clinicalNotes: '',
    referredBy: '',
    technician: '',
    fee: '',
    paymentStatus: 'Pending',
    status: 'Pending'
  }
  const [form, setForm] = useState(empty)
  const [catalog, setCatalog] = useState([])
  const [printData, setPrintData] = useState(null)
  const [showStickerDialog, setShowStickerDialog] = useState(false)
  const barcodeRef = useRef(null)
  const qrRef = useRef(null)
  const location = useLocation()
  const [viewData, setViewData] = useState(null)
  const [showView, setShowView] = useState(false)
  const todayStr = useMemo(()=> new Date().toISOString().slice(0,10), [])
  const [dateRange, setDateRange] = useState({ fromDate: todayStr, toDate: todayStr })

  // Render QR and Barcode when printData is ready
  useEffect(()=>{
    if (!printData) return
    const loadScript = (src) => new Promise((resolve, reject)=>{
      if (document.querySelector(`script[src="${src}"]`)) return resolve()
      const s = document.createElement('script'); s.src = src; s.onload=resolve; s.onerror=reject; document.body.appendChild(s)
    })
    ;(async()=>{
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js')
      } catch {}
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js')
      } catch {}
      try {
        if (window.JsBarcode && barcodeRef.current) {
          window.JsBarcode(
            barcodeRef.current,
            printData.id || printData.url || '',
            { format:'CODE128', lineColor:'#000', width:1, height:18, displayValue:false, margin:4 }
          )
        }
      } catch {}
      try {
        if (qrRef.current && window.QRCode) {
          const node = qrRef.current
          if (node && node.firstChild) node.innerHTML = ''
          // If it's a canvas, replace with div container for QRCode lib
          const container = node.nodeName==='CANVAS' ? node.parentElement : node
          if (container) {
            container.innerHTML = ''
            // eslint-disable-next-line no-new
            new window.QRCode(container, { text: printData.url || String(printData.id||''), width:32, height:32, correctLevel: window.QRCode.CorrectLevel.L })
          }
        }
      } catch {}
    })()
  }, [printData])

  // If opened with scan URL (?id=...), fetch and show a compact details modal
  useEffect(()=>{
    const params = new URLSearchParams(location.search)
    const id = params.get('id')
    if (!id) return
    (async()=>{
      try { const res = await labRequestsAPI.getById(id); const data = res?.data || res; setViewData(data); setShowView(true) } catch {}
    })()
  }, [location.search])

  useEffect(()=>{
    (async()=>{
      try { const res = await labTestsAPI.getAll(); setCatalog(res?.data||[]) } catch {}
    })()
  },[])

  const open = () => { setForm(empty); setShowModal(true) }
  const close = () => setShowModal(false)

  const save = async (e) => {
    e.preventDefault()
    const rec = { ...form, id: form.testId || `INT-${Date.now()}` }
    let created = rec
    try {
      const res = await labRequestsAPI.create(rec)
      const data = res?.data || res
      if (data) created = { ...rec, ...data, id: data.id || data._id || rec.id }
      await fetchRequests()
    } catch {}
    const uid = created.id || created._id || rec.id
    const base = (typeof window!== 'undefined' ? (window.location.href.split('#')[0] || '') : '')
    const scanUrl = `${base}#/lab/sample-intake?id=${encodeURIComponent(uid)}`
    setPrintData({
      patientName: created.petName,
      date: created.requestDate,
      doctor: created.doctorName || created.referredBy || '-',
      age: created.age || '-',
      sex: created.gender || '-',
      test: created.testType==='__custom' ? (created.customTestName||'Test') : created.testType || '-',
      acc: created.patientId || created.testId,
      id: uid,
      url: scanUrl
    })
    setShowModal(false)
    setShowStickerDialog(true)
  }

  // Auto-fill patient details when Patient ID entered
  useEffect(()=>{
    const id = (form.patientId||'').trim()
    if (!id) return
    let cancelled=false
    ;(async()=>{
      try {
        const res = await petsAPI.getById(id)
        const p = res?.data
        if (!cancelled && p) {
          setForm(f=>({
            ...f,
            petName: p.petName || f.petName,
            ownerName: p.ownerName || f.ownerName,
            species: p.species || f.species,
            age: p.age || f.age,
            gender: p.gender || f.gender
          }))
        }
      } catch {}
    })()
    return ()=>{ cancelled=true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.patientId])

  const inRange = (dStr) => {
    if (!dateRange?.fromDate && !dateRange?.toDate) return true
    if (!dStr) return false
    const d = String(dStr).slice(0,10)
    const from = dateRange.fromDate || '0000-01-01'
    const to = dateRange.toDate || '9999-12-31'
    return d >= from && d <= to
  }

  const filtered = useMemo(()=>{
    const s = q.toLowerCase()
    return requests.filter(r => {
      const matchesSearch = (r.petName + r.ownerName + r.testType + r.doctorName).toLowerCase().includes(s)
      const matchesDate = inRange(r.requestDate)
      return matchesSearch && matchesDate
    })
  }, [requests, q, dateRange.fromDate, dateRange.toDate])

  return (
    <div className="space-y-6">
      {/* Print Styles and Sticker Template */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { size: 70mm 25mm; margin: 1mm; }
          html, body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-only { display: none; }
        .sticker { width: 68mm; height: 23mm; padding: 1mm; box-sizing: border-box; }
        .sticker h1 { margin: 0; padding: 0; font-weight: 800; font-size: 12pt; line-height: 1.1; }
        .sticker .row { display:flex; justify-content:space-between; align-items:flex-start; }
        .sticker .meta { font-size: 8pt; display:flex; justify-content:space-between; gap: 6mm; margin-top: 0.5mm; }
        .sticker .small { font-size: 8pt; }
        .sticker .qr { width: 14mm; height: 14mm; }
        .sticker .barcode { margin-top: 1mm; }
      `}</style>
      {printData && (
        <div className="print-only">
          <div className="sticker" style={{ fontFamily:'Arial, sans-serif' }}>
            <div className="row">
              <div style={{ flex:1, paddingRight:'2mm' }}>
                <h1>{printData.patientName || 'Patient Name'}</h1>
                <div className="meta">
                  <div>DATE {printData.date}</div>
                  <div>ACC # {printData.acc}</div>
                </div>
                <div className="small" style={{ marginTop:'0.5mm' }}>Dr. {printData.doctor}</div>
                <div className="small" style={{ display:'flex', gap:'6mm', marginTop:'0.5mm' }}>
                  <div>AGE {printData.age||'-'}</div>
                  <div>SEX {printData.sex||'-'}</div>
                </div>
                {printData.test ? (
                  <div className="small" style={{ marginTop:'0.8mm' }}>
                    Test: <b>{printData.test}</b>
                  </div>
                ) : null}
              </div>
              <div style={{ width:'16mm', textAlign:'right' }}>
                <div ref={qrRef} className="qr" />
              </div>
            </div>
            <div className="barcode">
              <svg ref={barcodeRef} style={{ width:'100%' }}></svg>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Sample Intake</h1>
          <p className="text-slate-500">Create intake for ordered tests; results will be added from Add Report</p>
        </div>
        <button onClick={open} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"><FiPlus/> Sample Intake</button>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 no-print">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <input className="h-10 pl-3 pr-3 w-72 rounded-lg border border-slate-300" placeholder="Search (pet/owner/test/doctor)" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="ml-auto">
            <DateRangePicker onDateChange={setDateRange} defaultFromDate={dateRange.fromDate} defaultToDate={dateRange.toDate} />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="py-3 px-4">Pet</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Test</th>
                <th className="py-3 px-4">Test ID</th>
                <th className="py-3 px-4">Doctor</th>
                <th className="py-3 px-4">Sample</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 px-4 font-medium text-slate-800">{r.petName}</td>
                  <td className="py-2 px-4">{r.ownerName}</td>
                  <td className="py-2 px-4">{r.testType}</td>
                  <td className="py-2 px-4">
                    <Link
                      to={`/lab/add-report?intakeId=${encodeURIComponent(r.id || r._id || r.testId)}`}
                      className="text-emerald-700 hover:text-emerald-900 underline"
                      title="Open Add Report prefilled"
                    >
                      {r.testId || r.id}
                    </Link>
                  </td>
                  <td className="py-2 px-4">{r.doctorName}</td>
                  <td className="py-2 px-4">{r.sampleType||'-'}</td>
                  <td className="py-2 px-4">{r.priority}</td>
                  <td className="py-2 px-4">{r.requestDate} {r.requestTime}</td>
                  <td className="py-2 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${r.status==='Pending'?'bg-amber-50 text-amber-700 border border-amber-200':'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      <FiCheckCircle/> {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td className="py-6 px-4 text-center text-slate-500" colSpan={8}>No intakes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showStickerDialog && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowStickerDialog(false)}></div>
          <div className="relative w-[95%] max-w-sm rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="font-semibold text-slate-800">Print Sticker</div>
              <button type="button" onClick={()=>setShowStickerDialog(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="p-6 text-sm space-y-2">
              <div className="text-center font-bold text-base text-slate-900">{printData.patientName || 'Patient'}</div>
              <div className="text-center text-slate-600">{printData.test || '-'}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{printData.date}</span></div>
                <div><span className="text-slate-500">ACC #</span> <span className="font-medium">{printData.acc}</span></div>
              </div>
              <div className="text-center text-xs text-slate-500 mt-2">Label size: 70mm x 25mm</div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button type="button" onClick={()=>setShowStickerDialog(false)} className="h-10 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white">OK</button>
              <button type="button" onClick={()=>{ setShowStickerDialog(false); setTimeout(()=>{ window.print() }, 20) }} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Print</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-black/40" onClick={close}></div>
          <form onSubmit={save} className="relative w-[95%] max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="font-semibold text-slate-800 flex items-center gap-2"><FiClipboard/> New Sample Intake</div>
              <button type="button" onClick={close} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name *</label>
                  <input required value={form.petName} onChange={e=>setForm(f=>({...f, petName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name *</label>
                  <input required value={form.ownerName} onChange={e=>setForm(f=>({...f, ownerName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                  <input value={form.patientId} onChange={e=>setForm(f=>({...f, patientId:e.target.value}))} placeholder="e.g., PET-123" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Test ID</label>
                  <input value={form.testId} onChange={e=>setForm(f=>({...f, testId:e.target.value}))} placeholder="e.g., T-2025-001" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                  <input value={form.contact} onChange={e=>setForm(f=>({...f, contact:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doctor</label>
                  <input value={form.doctorName} onChange={e=>setForm(f=>({...f, doctorName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Test</label>
                  <select value={form.testType} onChange={e=>{
                    const val = e.target.value
                    if (!val) return setForm(f=>({...f, testType:''}))
                    const t = catalog.find(tt => (tt.testName||tt.name)===val)
                    setForm(f=>({
                      ...f,
                      testType: val,
                      fee: t?.price ?? f.fee,
                      sampleType: t?.sampleType || t?.specimen || f.sampleType
                    }))
                  }} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full bg-white">
                    <option value="">Select Test</option>
                    {catalog.map(t => (<option key={t.id||t._id} value={t.testName||t.name}>{t.testName||t.name}</option>))}
                    <option value="__custom">Other (type manually)</option>
                  </select>
                </div>
                {form.testType==='__custom' && (
                  <div className="md:col-span-2">
                    <input placeholder="Enter test name" value={form.customTestName||''} onChange={e=>setForm(f=>({...f, customTestName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Species</label>
                  <input value={form.species} onChange={e=>setForm(f=>({...f, species:e.target.value}))} placeholder="e.g., Dog" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Age (Months)</label>
                  <input value={form.age} onChange={e=>setForm(f=>({...f, age:e.target.value}))} placeholder="e.g., 18" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <select value={form.gender} onChange={e=>setForm(f=>({...f, gender:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full bg-white">
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sample Type</label>
                  <input placeholder="Blood / Serum / Urine / Feces / Swab" value={form.sampleType} onChange={e=>setForm(f=>({...f, sampleType:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={e=>setForm(f=>({...f, priority:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full bg-white">
                    <option>Routine</option>
                    <option>Urgent</option>
                    <option>Stat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Collected By</label>
                  <input value={form.collectedBy} onChange={e=>setForm(f=>({...f, collectedBy:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><FiCalendar/> Request Date</label>
                  <div className="flex gap-2">
                    <input type="date" value={form.requestDate} onChange={e=>setForm(f=>({...f, requestDate:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200" />
                    <input type="time" value={form.requestTime} onChange={e=>setForm(f=>({...f, requestTime:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                  <input value={form.referredBy} onChange={e=>setForm(f=>({...f, referredBy:e.target.value}))} placeholder="Doctor / Clinic" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Technician</label>
                  <input value={form.technician} onChange={e=>setForm(f=>({...f, technician:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee (PKR)</label>
                  <input type="number" value={form.fee} onChange={e=>setForm(f=>({...f, fee:e.target.value}))} placeholder="0" className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                  <select value={form.paymentStatus} onChange={e=>setForm(f=>({...f, paymentStatus:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full bg-white">
                    <option>Pending</option>
                    <option>Paid</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes</label>
                  <textarea rows={3} value={form.clinicalNotes} onChange={e=>setForm(f=>({...f, clinicalNotes:e.target.value}))} className="px-3 py-2 rounded-lg border-2 border-slate-200 w-full" />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="h-10 px-4 rounded-lg border border-slate-300">Cancel</button>
              <button className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Save Intake</button>
            </div>
          </form>
        </div>
      )}
      {showView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowView(false)}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="font-semibold text-slate-800 flex items-center gap-2"><FiClipboard/> Sample Intake Details</div>
              <button type="button" onClick={()=>setShowView(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Intake ID</span><span className="font-medium text-slate-800">{viewData?.id || viewData?._id || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Patient</span><span className="font-medium text-slate-800">{viewData?.petName || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Owner</span><span className="text-slate-800">{viewData?.ownerName || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Doctor</span><span className="text-slate-800">{viewData?.doctorName || viewData?.referredBy || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Age</span><span className="text-slate-800">{viewData?.age || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Sex</span><span className="text-slate-800">{viewData?.gender || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Species</span><span className="text-slate-800">{viewData?.species || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Test</span><span className="font-medium text-slate-800">{viewData?.testType==='__custom' ? (viewData?.customTestName || '-') : (viewData?.testType || '-')}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Sample</span><span className="text-slate-800">{viewData?.sampleType || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Priority</span><span className="text-slate-800">{viewData?.priority || '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Date</span><span className="text-slate-800">{viewData?.requestDate} {viewData?.requestTime}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><span className="text-slate-800">{viewData?.status || '-'}</span></div>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
              <button type="button" onClick={()=>setShowView(false)} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
