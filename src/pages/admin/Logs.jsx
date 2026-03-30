import React, { useMemo, useState, useCallback } from 'react'
import { FiActivity, FiSearch, FiFilter, FiTrash2, FiDownload, FiClock, FiUser, FiCalendar } from 'react-icons/fi'
import { useActivity } from '../../context/ActivityContext'
import DateRangePicker from '../../components/DateRangePicker'

function toCSV(rows){
  const header = ['ID','Time','Portal','Detail']
  const lines = rows.map(r => [r.id, r.when, r.user, r.text].map(v => `"${String(v||'').replace(/"/g,'"')}"`).join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function Logs(){
  const { logs, clear } = useActivity()
  const [q, setQ] = useState('')
  const [portal, setPortal] = useState('All')
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }
  
  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchPortal = portal==='All' ? true : (l.user||'').toLowerCase() === portal.toLowerCase()
      const matchText = q.trim() === '' ? true : (l.text||'').toLowerCase().includes(q.toLowerCase()) || (l.when||'').toLowerCase().includes(q.toLowerCase())
      const matchDate = isDateInRange(l.when)
      return matchPortal && matchText && matchDate
    })
  }, [logs, q, portal, dateRange.fromDate, dateRange.toDate])

  const handleExport = () => {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system_logs_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 text-slate-900">
              <FiActivity className="w-6 h-6 text-[hsl(var(--pm-primary))]" /> System Logs
            </h1>
            <p className="text-sm/6 text-slate-600 mt-1">Monitor all system activities and events</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-hover))] text-white font-semibold border border-[hsl(var(--pm-border))] transition-colors">
              <FiDownload className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={clear} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold border border-red-700/30 transition-colors">
              <FiTrash2 className="h-4 w-4" /> Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[hsl(var(--pm-primary))] rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[hsl(var(--pm-primary))]">Filter by Log Date</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600">Total Logs</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{logs.length}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--pm-primary))]/10 ring-1 ring-[hsl(var(--pm-border))] flex items-center justify-center">
              <FiActivity className="w-6 h-6 text-[hsl(var(--pm-primary))]" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 shadow-md ring-1 ring-blue-200/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600">Filtered Results</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{filtered.length}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-200 flex items-center justify-center">
              <FiFilter className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-md ring-1 ring-emerald-200/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600">Active Portal</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{portal}</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-200 flex items-center justify-center">
              <FiUser className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200/70 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Search text or time..."
              className="w-full h-11 pl-11 pr-4 rounded-lg border-2 border-slate-200 focus:border-[hsl(var(--pm-primary))] focus:ring-4 focus:ring-[hsl(var(--pm-primary))]/15 transition-all"
            />
          </div>
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select value={portal} onChange={e=>setPortal(e.target.value)} className="w-full h-11 pl-11 pr-4 rounded-lg border-2 border-slate-200 focus:border-[hsl(var(--pm-primary))] focus:ring-4 focus:ring-[hsl(var(--pm-primary))]/15 transition-all appearance-none bg-white">
              <option>All</option>
              <option>Admin</option>
              <option>Reception</option>
              <option>Pharmacy</option>
              <option>Lab</option>
              <option>Shop</option>
              <option>Doctor</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((l, idx) => {
            const portalColors = {
              'Admin': 'bg-[hsl(var(--pm-primary-soft))] border-[hsl(var(--pm-border))]',
              'Reception': 'bg-[hsl(var(--pm-primary-soft))] border-[hsl(var(--pm-border))]',
              'Pharmacy': 'bg-[hsl(var(--pm-primary-soft))] border-[hsl(var(--pm-border))]',
              'Lab': 'bg-cyan-50 border-cyan-200',
              'Shop': 'bg-emerald-50 border-emerald-200',
              'Doctor': 'bg-blue-50 border-blue-200',
            }
            const bgClass = portalColors[l.user] || 'bg-slate-50 border-slate-200'
            return (
              <div key={l.id} className={`rounded-xl ${bgClass} border p-4 hover:shadow-md transition-all`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-white/80 shadow-sm grid place-items-center flex-shrink-0">
                      <FiActivity className="h-5 w-5 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 mb-1">{l.text}</div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <FiUser className="w-3 h-3" />
                          {l.user}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FiClock className="w-3 h-3" />
                          {l.when}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 bg-white/60 px-2 py-1 rounded-md">#{idx + 1}</div>
                </div>
              </div>
            )
          })}
          {filtered.length===0 && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center">
                <FiActivity className="w-8 h-8 text-slate-400" />
              </div>
              <div className="text-slate-500 font-medium">No logs found</div>
              <div className="text-xs text-slate-400 mt-1">Try adjusting your search or filter</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
