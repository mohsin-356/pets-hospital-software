import React, { useState, useEffect, useMemo } from 'react'
import { FiSearch, FiUsers, FiDollarSign, FiHeart, FiPhone, FiMail, FiMapPin, FiCalendar, FiEye, FiEdit } from 'react-icons/fi'
import { petsAPI, pharmacyDuesAPI, pharmacySalesAPI, proceduresAPI, appointmentsAPI, fullRecordAPI, financialSummaryAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

export default function ReceptionClients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [fullRecord, setFullRecord] = useState(null)
  const [clientDues, setClientDues] = useState({})
  const [clientPayments, setClientPayments] = useState({})
  const [clientSales, setClientSales] = useState([])
  const [clientProcedures, setClientProcedures] = useState([])
  const [lastPayment, setLastPayment] = useState(null)
  const [clientAppointments, setClientAppointments] = useState([])
  const [finSummary, setFinSummary] = useState(null)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  const toNum = (v) => {
    if (v == null) return 0
    const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
    return Number.isNaN(n) ? 0 : n
  }

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('reception_clients_cache')||'[]')
      if (Array.isArray(cached) && cached.length) {
        setClients(cached)
      } else {
        try {
          const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')
          if (Array.isArray(pets) && pets.length) {
            const clientsMap = new Map()
            pets.forEach(pet => {
              const clientId = (pet.clientId || pet.details?.owner?.clientId || '').trim()
              if (!clientId) return
              if (!clientsMap.has(clientId)) {
                clientsMap.set(clientId, {
                  clientId,
                  ownerName: pet.ownerName || pet.details?.owner?.fullName,
                  contact: pet.ownerContact || pet.details?.owner?.contact,
                  email: pet.details?.owner?.email || '',
                  address: pet.ownerAddress || pet.details?.owner?.address || '',
                  nic: pet.details?.owner?.nic || '',
                  emergencyContact: pet.details?.owner?.emergencyContactPerson || '',
                  emergencyPhone: pet.details?.owner?.emergencyContactNumber || '',
                  pets: [],
                  totalPets: 0,
                  registrationDate: pet.details?.clinic?.dateOfRegistration || pet.createdAt,
                  lastVisit: pet.createdAt
                })
              }
              const client = clientsMap.get(clientId)
              client.pets.push({
                id: pet.id || pet._id,
                petName: pet.petName,
                species: pet.species || pet.type,
                breed: pet.breed,
                age: pet.age,
                gender: pet.gender,
                status: pet.status || 'Active'
              })
              client.totalPets = client.pets.length
              const visitDate = new Date(pet.createdAt)
              const currentLastVisit = new Date(client.lastVisit)
              if (visitDate > currentLastVisit) client.lastVisit = pet.createdAt
            })
            setClients(Array.from(clientsMap.values()))
          }
        } catch {}
      }
    } catch {}
    loadClients()
  }, [])

  useEffect(() => {
    const onReset = () => { try { loadClients() } catch {} }
    const onStorage = (e) => { try { if (e.key === 'data_reset_at') loadClients() } catch {} }
    window.addEventListener('data-reset', onReset)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('data-reset', onReset)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Refresh on cross-app financial updates
  useEffect(() => {
    const refresh = () => {
      try {
        loadClients()
        if (showClientModal && selectedClient?.clientId) {
          ;(async () => {
            try {
              const fs = await financialSummaryAPI.getByClient((selectedClient.clientId||'').trim())
              setFinSummary(fs.data)
            } catch {}
          })()
        }
      } catch {}
    }
    const onStorage = (e) => { try { if (e.key === 'financial_updated_at') refresh() } catch {} }
    window.addEventListener('financial-updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('financial-updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [showClientModal, selectedClient?.clientId])

  useEffect(() => {
    try {
      if (showClientModal) {
        const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
        document.documentElement.style.overflowY = 'hidden'
        document.body.style.overflow = 'hidden'
        if (sbw) document.body.style.paddingRight = `${sbw}px`
      } else {
        document.documentElement.style.overflowY = ''
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
    } catch {}
  }, [showClientModal])

  const loadClients = async () => {
    try {
      setLoading(true)
      const response = await petsAPI.getAll()
      const pets = response.data || []
      
      // Group pets by clientId to create client records
      const clientsMap = new Map()
      
      pets.forEach(pet => {
        const clientId = (pet.clientId || pet.details?.owner?.clientId || '').trim()
        if (!clientId) return
        
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, {
            clientId,
            ownerName: pet.ownerName || pet.details?.owner?.fullName,
            contact: pet.ownerContact || pet.details?.owner?.contact,
            email: pet.details?.owner?.email || '',
            address: pet.ownerAddress || pet.details?.owner?.address || '',
            nic: pet.details?.owner?.nic || '',
            emergencyContact: pet.details?.owner?.emergencyContactPerson || '',
            emergencyPhone: pet.details?.owner?.emergencyContactNumber || '',
            pets: [],
            totalPets: 0,
            registrationDate: pet.details?.clinic?.dateOfRegistration || pet.createdAt,
            lastVisit: pet.createdAt
          })
        }
        
        const client = clientsMap.get(clientId)
        client.pets.push({
          id: pet.id || pet._id,
          petName: pet.petName,
          species: pet.species || pet.type,
          breed: pet.breed,
          age: pet.age,
          gender: pet.gender,
          status: pet.status || 'Active'
        })
        client.totalPets = client.pets.length
        
        // Update last visit date
        const visitDate = new Date(pet.createdAt)
        const currentLastVisit = new Date(client.lastVisit)
        if (visitDate > currentLastVisit) {
          client.lastVisit = pet.createdAt
        }
      })
      
      // Merge in clients from procedure records so search by Client ID works even without a pet record
      try {
        const procsRes = await proceduresAPI.getAll('')
        const procs = procsRes.data || []
        procs.forEach(rec => {
          const cid = (rec.clientId || '').trim()
          if (!cid) return
          if (!clientsMap.has(cid)) {
            clientsMap.set(cid, {
              clientId: cid,
              ownerName: rec.ownerName || '',
              contact: rec.contact || '',
              email: '',
              address: '',
              nic: '',
              emergencyContact: '',
              emergencyPhone: '',
              pets: [],
              totalPets: 0,
              registrationDate: rec.createdAt,
              lastVisit: rec.createdAt
            })
          }
          const c = clientsMap.get(cid)
          if (rec.petName) {
            c.pets.push({ id: rec.petId || rec._id, petName: rec.petName, species: '', breed: '', age: '', gender: '', status: 'Active' })
            c.totalPets = c.pets.length
          }
          if (!c.registrationDate) c.registrationDate = rec.createdAt
          if (!c.lastVisit || new Date(rec.createdAt) > new Date(c.lastVisit)) c.lastVisit = rec.createdAt
        })
      } catch {}

      const clientsList = Array.from(clientsMap.values())
      setClients(clientsList)
      try { localStorage.setItem('reception_clients_cache', JSON.stringify(clientsList)) } catch {}
      // Do not block initial render on financials
      loadClientFinancials(clientsList)
      
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClientFinancials = async (clientsList) => {
    const duesMap = {}
    const paymentsMap = {}

    // Fetch once for efficiency
    let allSales = []
    let allProcedures = []
    try { const salesRes = await pharmacySalesAPI.getAll(); allSales = salesRes.data || [] } catch {}
    try { const procsRes = await proceduresAPI.getAll(''); allProcedures = procsRes.data || [] } catch {}

    // Build indexes
    const salesByClient = allSales.reduce((acc, s) => {
      const cid = (s.clientId || '').trim()
      if (!cid) return acc
      if (!acc[cid]) acc[cid] = []
      acc[cid].push(s)
      return acc
    }, {})
    const procsByClient = allProcedures.reduce((acc, p) => {
      const cid = (p.clientId || '').trim()
      if (!cid) return acc
      if (!acc[cid]) acc[cid] = []
      acc[cid].push(p)
      return acc
    }, {})

    await Promise.all(clientsList.map(async (client) => {
      const cid = (client.clientId || '').trim()

      try {
        const fs = await financialSummaryAPI.getByClient(cid)
        const t = fs?.data?.totals || {}
        const haveFS = (t && (t.totalReceived != null || t.currentDue != null))
        if (haveFS) {
          paymentsMap[cid] = toNum(t.totalReceived)
          duesMap[cid] = toNum(t.currentDue)
          return
        }
      } catch {}

      let due = 0
      try {
        const duesResponse = await pharmacyDuesAPI.getByClient(cid)
        due = Number(duesResponse.previousDue || duesResponse.data?.previousDue || duesResponse.data?.totalDue || 0)
      } catch {}

      if (!due) {
        const sales = (salesByClient[cid] || []).slice().sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0))
        const procs = (procsByClient[cid] || []).slice().sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0))
        const latestSale = sales[0]
        const latestProc = procs[0]
        const latestSaleTs = latestSale ? new Date(latestSale.createdAt||0).getTime() : 0
        const latestProcTs = latestProc ? new Date(latestProc.createdAt||0).getTime() : 0
        if (latestSaleTs >= latestProcTs && latestSale) {
          const subtotal = toNum(latestSale.subtotal)
          const discount = toNum(latestSale.discount)
          const grand = toNum(latestSale.totalAmount ?? (subtotal - discount))
          const recv = toNum((latestSale.receivedAmount!=null? latestSale.receivedAmount : grand))
          const prev = toNum(latestSale.previousDue)
          const calcDue = Math.max(0, prev + (grand - recv))
          due = toNum(latestSale.newTotalDue!=null ? latestSale.newTotalDue : calcDue)
        } else if (latestProc) {
          const gt = toNum(latestProc.grandTotal ?? (toNum(latestProc.subtotal) + toNum(latestProc.previousDues)))
          const recv = (latestProc.receivedAmount!=null) ? toNum(latestProc.receivedAmount) : (latestProc.receivable!=null ? Math.max(0, gt - toNum(latestProc.receivable)) : 0)
          const calcDue = Math.max(0, gt - recv)
          due = toNum(latestProc.receivable!=null ? latestProc.receivable : calcDue)
        }
      }
      duesMap[cid] = Number(due)||0

      const totalSalesPaid = (salesByClient[cid]||[]).reduce((sum, s)=> sum + Math.max(0, toNum((s.receivedAmount!=null? s.receivedAmount : s.totalAmount))), 0)
      const totalProcPaid = (procsByClient[cid]||[]).reduce((sum, p)=> sum + Math.max(0, toNum(p.receivedAmount)), 0)
      paymentsMap[cid] = totalSalesPaid + totalProcPaid
    }))

    setClientDues(duesMap)
    setClientPayments(paymentsMap)
  }

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr).toISOString().slice(0,10)
    return d >= dateRange.fromDate && d <= dateRange.toDate
  }

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return clients.filter(client => {
      const matchesSearch = !q ||
        client.clientId?.toLowerCase().includes(q) ||
        client.ownerName?.toLowerCase().includes(q) ||
        client.contact?.toLowerCase?.().includes(q) ||
        client.email?.toLowerCase().includes(q) ||
        client.pets.some(pet => pet.petName?.toLowerCase().includes(q) || String(pet.id||'').toLowerCase().includes(q))

      const dateField = client.registrationDate || client.lastVisit
      const matchesDate = isDateInRange(dateField)
      // If searching, ignore date filter to ensure Client ID/Name/Phone searches are global
      return matchesSearch && (q ? true : matchesDate)
    })
  }, [clients, searchQuery, dateRange.fromDate, dateRange.toDate])

  const totalStats = useMemo(() => {
    const totalClients = filteredClients.length
    const totalPets = filteredClients.reduce((sum, client) => sum + client.totalPets, 0)
    const filteredClientIds = filteredClients.map(c => (c.clientId || '').trim())
    const totalDues = Object.entries(clientDues)
      .filter(([clientId]) => filteredClientIds.includes((clientId || '').trim()))
      .reduce((sum, [, due]) => sum + (due || 0), 0)
    const totalPaid = Object.entries(clientPayments)
      .filter(([clientId]) => filteredClientIds.includes((clientId || '').trim()))
      .reduce((sum, [, payment]) => sum + (payment || 0), 0)
    return { totalClients, totalPets, totalDues, totalPaid }
  }, [filteredClients, clientDues, clientPayments])

  const handleViewClient = (client) => {
    setSelectedClient(client)
    setShowClientModal(true)
    setFullRecord(null)
    setLastPayment(null)
    setFinSummary(null)
    ;(async () => {
      let latestPayment = null
      const updateLatest = (date, amount, source, id) => {
        try {
          if (!date || !(date instanceof Date)) return
          const ts = date.getTime()
          const cur = latestPayment ? latestPayment.date.getTime() : 0
          if (!latestPayment || ts > cur) {
            latestPayment = { date, amount: Number(amount)||0, source, id }
          }
        } catch {}
      }
      try {
        // Load unified client record (pets with complete histories and totals)
        try {
          const fr = await fullRecordAPI.getByClient(client.clientId)
          setFullRecord(fr.data)
        } catch (e) {
          console.warn('fullRecordAPI.getByClient failed, falling back to piecemeal data', e?.message)
        }

        try {
          const fs = await financialSummaryAPI.getByClient((client.clientId||'').trim())
          setFinSummary(fs.data)
          if (fs?.data?.totals?.lastPayment) {
            const lp = fs.data.totals.lastPayment
            updateLatest(new Date(lp.date), lp.amount, lp.source, lp.refId)
          }
        } catch (e) {
          console.warn('financialSummaryAPI.getByClient failed', e?.message)
        }

        const salesRes = await pharmacySalesAPI.getAll()
        const sales = (salesRes.data || []).filter(s => s.clientId === client.clientId)
        sales.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0))
        setClientSales(sales)
        // Compute last payment from sales
        const paidSale = sales.find(s => toNum(s.receivedAmount!=null ? s.receivedAmount : s.totalAmount) > 0)
        if (paidSale) {
          const amt = toNum(paidSale.receivedAmount!=null ? paidSale.receivedAmount : paidSale.totalAmount)
          updateLatest(new Date(paidSale.createdAt||0), amt, 'Pharmacy', paidSale._id||paidSale.id)
        }
      } catch { setClientSales([]) }

      try {
        let procs = []
        try {
          const res = await proceduresAPI.getAll(`?clientId=${client.clientId}`)
          procs = res.data || []
        } catch {
          const res = await proceduresAPI.getAll('')
          procs = (res.data || []).filter(p => p.clientId === client.clientId)
        }
        // Normalize received/receivable for backward records
        const normalized = procs.map(p => {
          const gt = toNum(p.grandTotal ?? (toNum(p.subtotal) + toNum(p.previousDues)))
          const recv = (p.receivedAmount != null) ? toNum(p.receivedAmount) : (p.receivable != null ? Math.max(0, gt - toNum(p.receivable)) : 0)
          const due = (p.receivable != null) ? toNum(p.receivable) : Math.max(0, gt - recv)
          return { ...p, receivedAmount: recv, receivable: due }
        })
        normalized.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0))
        setClientProcedures(normalized)
        const paidProc = normalized.find(p => toNum(p.receivedAmount) > 0)
        if (paidProc) {
          updateLatest(new Date(paidProc.createdAt||0), toNum(paidProc.receivedAmount), 'Procedure', paidProc._id||paidProc.id)
        }
      } catch { setClientProcedures([]) }

      try {
        const appRes = await appointmentsAPI.getAll()
        const apps = (appRes.data || []).filter(a => a.clientId === client.clientId)
        apps.sort((a,b)=> new Date(b.appointmentDate||b.createdAt||0) - new Date(a.appointmentDate||a.createdAt||0))
        setClientAppointments(apps)
      } catch { setClientAppointments([]) }
      setLastPayment(latestPayment)
    })()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Clients Directory
          </h1>
          <p className="text-slate-600 mt-1">View and manage client information</p>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-xl ring-1 ring-emerald-200 border border-emerald-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-600">Filter by Date</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          <DateRangePicker 
            onDateChange={(dr)=>setDateRange(dr)}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{totalStats.totalClients}</div>
              <div className="text-sm text-slate-600">Total Clients</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <FiHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{totalStats.totalPets}</div>
              <div className="text-sm text-slate-600">Total Pets</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <FiDollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">Rs. {totalStats.totalDues.toLocaleString()}</div>
              <div className="text-sm text-slate-600">Current Dues</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <FiDollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">Rs. {totalStats.totalPaid.toLocaleString()}</div>
              <div className="text-sm text-slate-600">Total Paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Client ID, name, contact, email, or pet name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Showing {filteredClients.length} of {clients.length} clients
        </div>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {false ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <span className="ml-3 text-slate-600">Loading clients...</span>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No clients found</p>
            <p className="text-slate-400 text-sm mt-1">
              {searchQuery ? 'Try adjusting your search criteria' : 'Clients will appear here as pets are registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Contact</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Pets</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Current Due</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Total Paid</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Last Visit</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map(client => (
                  <tr key={client.clientId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-slate-900">{client.ownerName}</div>
                        <div className="text-sm text-slate-500">ID: {client.clientId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {client.contact && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <FiPhone className="w-3 h-3" />
                            {client.contact}
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <FiMail className="w-3 h-3" />
                            {client.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {client.totalPets} pet{client.totalPets !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${
                        (clientDues[client.clientId] || 0) > 0 ? 'text-red-600' : 'text-slate-600'
                      }`}>
                        Rs. {(clientDues[client.clientId] || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-green-600">
                        Rs. {(clientPayments[client.clientId] || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                      {new Date(client.lastVisit).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewClient(client)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-sm font-medium"
                      >
                        <FiEye className="w-4 h-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client Details Modal */}
      {showClientModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{selectedClient.ownerName}</h2>
                  <p className="text-slate-600">Client ID: {selectedClient.clientId}</p>
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="text-slate-500 hover:text-slate-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Unified Client Summary (from fullRecord) */}
              {(fullRecord && (fullRecord.totals || finSummary)) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="text-slate-600 text-sm">Prescriptions</div>
                    <div className="text-2xl font-bold text-blue-700">{fullRecord.totals.prescriptions}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <div className="text-slate-600 text-sm">Pharmacy Total</div>
                    <div className="text-2xl font-bold text-emerald-700">Rs. {Number(fullRecord.totals.pharmacyTotal||0).toLocaleString()}</div>
                    <div className="text-xs text-slate-600">Paid: Rs. {Number(fullRecord.totals.pharmacyPaid||0).toLocaleString()} | Due: Rs. {Number(fullRecord.totals.pharmacyDue||0).toLocaleString()}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="text-slate-600 text-sm">Consultation Fees</div>
                    <div className="text-2xl font-bold text-amber-700">Rs. {(() => {
                      try {
                        const moduleAmt = Number(((finSummary && finSummary.modules && finSummary.modules.consultant && finSummary.modules.consultant.amount) || 0))
                        const petsAmt = Array.isArray(finSummary?.pets) ? finSummary.pets.reduce((s,p)=> s + Number(p?.modules?.consultant?.amount || 0), 0) : 0
                        const entriesAmt = Array.isArray(finSummary?.entries) 
                          ? finSummary.entries.filter(e => String(e.type||'').toLowerCase().includes('consult'))
                              .reduce((s,e)=> s + Number(e?.received || 0), 0)
                          : 0
                        const frAmt = Number(fullRecord?.totals?.consultationFees || 0)
                        const val = entriesAmt || moduleAmt || petsAmt || frAmt
                        return Number(val || 0).toLocaleString()
                      } catch { return '0' }
                    })()}</div>
                  </div>
                </div>
              )}

              {/* All Modules Financial Summary (Unified) */}
              {finSummary && finSummary.totals && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <div className="text-slate-600 text-xs">Total Billed</div>
                      <div className="text-lg font-bold text-slate-800">Rs. {Number(finSummary.totals.totalBilled||0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs">Total Received</div>
                      <div className="text-lg font-bold text-green-700">Rs. {Number(finSummary.totals.totalReceived||0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs">Total Receivable (Balance)</div>
                      <div className="text-lg font-bold text-amber-700">Rs. {Number(finSummary.totals.totalPending||0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs">Current Due</div>
                      <div className="text-lg font-semibold text-red-700">Rs. {Number(finSummary.totals.currentDue||0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs">Last Payment</div>
                      <div className="text-sm font-semibold text-slate-800">{finSummary.totals.lastPayment ? `Rs. ${Number(finSummary.totals.lastPayment.amount||0).toLocaleString()} on ${new Date(finSummary.totals.lastPayment.date).toLocaleDateString()} (${finSummary.totals.lastPayment.source})` : '—'}</div>
                    </div>
                  </div>
                </div>
              )}
              {fullRecord && Array.isArray(fullRecord.pets) && fullRecord.pets.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Pets & Histories</h3>
                  <div className="space-y-3">
                    {fullRecord.pets.map((entry, idx) => {
                      const pid = String(entry?.pet?.id || entry?.pet?.petId || '').trim()
                      const it = Array.isArray(finSummary?.pets) ? finSummary.pets.find(p => String(p.petId||'').trim() === pid) : null
                      const paid = !!(it && it.modules && it.modules.consultant && it.modules.consultant.paid)
                      const amt = Number(it?.modules?.consultant?.amount || 0)
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                          <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span>{entry.pet?.petName} <span className="text-slate-500 font-normal">(ID: {entry.pet?.id})</span></span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {paid ? `Consultant Paid • Rs. ${amt.toLocaleString()}` : 'Consultant Pending'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-slate-500">Prescriptions</div>
                              <div className="font-semibold text-slate-800">{entry.prescriptions?.length || 0}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Pharmacy Spend</div>
                              <div className="font-semibold text-slate-800">Rs. {Number(entry.totals?.pharmacyTotal||0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Lab Tests</div>
                              <div className="font-semibold text-slate-800">{entry.labReports?.length || 0} ({Number(entry.totals?.labTotal||0).toLocaleString()} Rs)</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Radiology</div>
                              <div className="font-semibold text-slate-800">{entry.radiologyReports?.length || 0} ({Number(entry.totals?.radiologyTotal||0).toLocaleString()} Rs)</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Client Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Contact Information</h3>
                  <div className="space-y-3">
                    {selectedClient.contact && (
                      <div className="flex items-center gap-3">
                        <FiPhone className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-700">{selectedClient.contact}</span>
                      </div>
                    )}
                    {selectedClient.email && (
                      <div className="flex items-center gap-3">
                        <FiMail className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-700">{selectedClient.email}</span>
                      </div>
                    )}
                    {selectedClient.address && (
                      <div className="flex items-start gap-3">
                        <FiMapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                        <span className="text-slate-700">{selectedClient.address}</span>
                      </div>
                    )}
                    {selectedClient.emergencyContact && (
                      <div className="flex items-center gap-3">
                        <FiPhone className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-700">
                          Emergency: {selectedClient.emergencyContact} 
                          {selectedClient.emergencyPhone && ` (${selectedClient.emergencyPhone})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-slate-700">Current Due</span>
                      <span className="font-bold text-red-600">Rs. {(clientDues[selectedClient.clientId] || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-slate-700">Total Paid</span>
                      <span className="font-bold text-green-600">Rs. {(clientPayments[selectedClient.clientId] || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Last Payment</span>
                      <span className="font-medium text-slate-800">{lastPayment ? `Rs. ${Number(lastPayment.amount||0).toLocaleString()} on ${new Date(lastPayment.date).toLocaleDateString()} (${lastPayment.source})` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-700">Registration Date</span>
                      <span className="font-medium text-slate-800">{new Date(selectedClient.registrationDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pets List */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Registered Pets ({selectedClient.totalPets})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedClient.pets.map(pet => (
                    <div key={pet.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-800">{pet.petName}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          pet.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {pet.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div><span className="font-medium">Species:</span> {pet.species}</div>
                        {pet.breed && <div><span className="font-medium">Breed:</span> {pet.breed}</div>}
                        {pet.age && <div><span className="font-medium">Age:</span> {pet.age}</div>}
                        {pet.gender && <div><span className="font-medium">Gender:</span> {pet.gender}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Pharmacy Purchases</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Items</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSales.map(s => (
                        <tr key={s._id || s.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{new Date(s.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{Array.isArray(s.items)? s.items.length : '-'}</td>
                          <td className="px-3 py-2 text-right">{Number(s.totalAmount||0).toLocaleString()}</td>
                        </tr>
                      ))}
                      {clientSales.length === 0 && (
                        <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-500">No sales</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pet-wise Financial Breakdown (Unified) */}
              {finSummary && Array.isArray(finSummary.pets) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Pet-wise Financial Breakdown</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Pet</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Pharmacy Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Lab Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Procedures Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Pet Shop Due</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Consultant</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Received</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finSummary.pets.map(p => (
                          <tr key={p.petId} className="border-t border-slate-100">
                            <td className="px-3 py-2">{p.petName}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.pharmacy?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.lab?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.procedures?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.petShop?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2">{p.modules?.consultant?.paid ? `Paid ${Number(p.modules.consultant.amount||0).toLocaleString()}` : 'Pending'}</td>
                            <td className="px-3 py-2 text-right">{Number(p.totals?.received||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.totals?.pending||0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {finSummary.pets.length === 0 && (
                          <tr><td colSpan="8" className="px-3 py-4 text-center text-slate-500">No pets</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Procedures</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Pet</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Procedure(s)</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Subtotal</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Received</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Receivable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientProcedures.map(p => (
                        <tr key={p._id || p.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{new Date(p.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{p.petName}</td>
                          <td className="px-3 py-2">{Array.isArray(p.procedures) ? p.procedures.map(it=> it.drug || it.mainCategory || 'Item').join(', ') : '-'}</td>
                          <td className="px-3 py-2 text-right">{Number(p.subtotal||0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{Number(p.receivedAmount||0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{Number(p.receivable||0).toLocaleString()}</td>
                        </tr>
                      ))}
                      {clientProcedures.length === 0 && (
                        <tr><td colSpan="6" className="px-3 py-4 text-center text-slate-500">No procedures</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Radiology Records */}
              {(() => {
                try {
                  const pets = (selectedClient?.pets || [])
                  let records = []
                  // Gather from pet.details.radiology where available
                  for (const p of pets) {
                    const petFull = clients.find(c => c.clientId === selectedClient.clientId)?.pets?.find(x => x.id === p.id)
                    // We don't have the full pet document here; fetch from cached list in localStorage; otherwise we will rely on local radiology list
                  }
                  // Try from localStorage radiology_records
                  try {
                    const local = JSON.parse(localStorage.getItem('radiology_records')||'[]')
                    const petIds = new Set(pets.map(pp=> String(pp.id||'').toLowerCase()))
                    const localRecs = local.filter(r => petIds.has(String(r.patientId||'').toLowerCase()))
                    records = [...records, ...localRecs]
                  } catch {}
                  // De-duplicate
                  const seen = new Set()
                  records = records.filter(r => {
                    const k = r.id || `${r.patientId}-${r.testDate}-${r.testType}-${r.bodyPart}`
                    if (seen.has(k)) return false
                    seen.add(k)
                    return true
                  })
                  if (!records.length) return null
                  // Attach pet name for display when missing
                  const nameMap = new Map((selectedClient.pets||[]).map(p => [String(p.id), p.petName]))
                  records.sort((a,b)=> new Date(b.testDate || b.createdAt || 0) - new Date(a.testDate || a.createdAt || 0))
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">Radiology Records</h3>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Pet</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Body Part</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((r, idx) => (
                              <tr key={r.id || idx} className="border-t border-slate-100">
                                <td className="px-3 py-2">{new Date(r.testDate || r.createdAt || Date.now()).toLocaleDateString()}</td>
                                <td className="px-3 py-2">{r.petName || nameMap.get(String(r.patientId)) || '-'}</td>
                                <td className="px-3 py-2">{r.testType || 'Imaging'}</td>
                                <td className="px-3 py-2">{r.bodyPart || '-'}</td>
                              </tr>
                            ))}
                            {records.length === 0 && (
                              <tr><td colSpan="4" className="px-3 py-4 text-center text-slate-500">No radiology records</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                } catch { return null }
              })()}

              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Appointments</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Title</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAppointments.map(a => (
                        <tr key={a._id || a.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{new Date(a.appointmentDate || a.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{a.title || a.reason || '-'}</td>
                          <td className="px-3 py-2">{a.status || 'Scheduled'}</td>
                        </tr>
                      ))}
                      {clientAppointments.length === 0 && (
                        <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-500">No appointments</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
