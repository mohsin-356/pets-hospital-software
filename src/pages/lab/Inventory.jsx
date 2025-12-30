import React, { useEffect, useMemo, useState } from 'react'
import { inventoryAPI, suppliersAPI } from '../../services/api'

export default function LabInventory(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [categories, setCategories] = useState(['Reagents','Test Kits','Chemicals','Consumables','Glassware','Equipment','Stains & Dyes','Calibrators','Controls','Buffers','Tubes & Vials','Other'])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  
  useEffect(() => {
    fetchInventory()
    fetchSuppliers()
    fetchCategories()
  }, [])
  
  const fetchInventory = async () => {
    try {
      setLoading(true)
      const response = await inventoryAPI.getAll()
      // Backend schema uses department, itemName, quantity, price, minStockLevel, expiryDate
      const labItems = (response.data || [])
        .filter(item => item.department === 'lab' || !item.department)
        .map(item => ({
          _id: item._id,
          id: item.id,
          invoice: item.invoice || '',
          name: item.itemName || item.name || '',
          category: item.category || '',
          packs: item.packs || 0,
          unitsPerPack: item.unitsPerPack || 0,
          unitPurchase: item.price ?? item.purchasePrice ?? 0,
          unitSale: item.unitSale ?? 0,
          qty: item.quantity ?? item.qty ?? 0,
          min: item.minStockLevel ?? item.min ?? 0,
          expiry: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0,10) : (item.expiry || ''),
          supplier: item.supplier || '',
          status: item.status || 'OK'
        }))
      setItems(labItems)
    } catch (err) {
      console.error('Error fetching lab inventory:', err)
    } finally {
      setLoading(false)
    }
  };
  async function fetchCategories(){
    try {
      const res = await inventoryAPI.getCategories('lab')
      const list = res?.data || []
      if (Array.isArray(list) && list.length) setCategories(list)
    } catch (e) {
      const derived = Array.from(new Set((items||[]).map(i=>i.category).filter(Boolean)))
      if (derived.length) setCategories(derived)
    }
  }
  async function fetchSuppliers() {
    try {
      const res = await suppliersAPI.getAll('lab')
      const list = res?.data || []
      setSuppliers(list)
    } catch (e) {
      setSuppliers([])
    }
  }
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('All') // All | Low | Expiring | Out
  const [showForm, setShowForm] = useState(false)
  const empty = { id:'', invoice:'', name:'', category:'', packs:'', unitsPerPack:'', unitPurchase:'', unitSale:'', qty:'', min:'', expiry:'', supplier:'', status:'OK' }
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' })


  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false
    const now = new Date()
    const target = new Date(dateStr)
    return (target - now)/(1000*60*60*24) <= 30
  }

  const filtered = useMemo(()=>{
    return items.filter(i => {
      const text = (i.invoice+i.name+i.category+i.supplier).toLowerCase()
      const matchQ = q ? text.includes(q.toLowerCase()) : true
      const matchTab = tab==='All' ? true : tab==='Low' ? Number(i.qty||0) <= Number(i.min||0) : tab==='Expiring' ? isExpiringSoon(i.expiry) : Number(i.qty||0)===0
      return matchQ && matchTab
    })
  }, [items, q, tab])

  const totals = useMemo(()=>{
    const totalItems = items.length
    const low = items.filter(i => Number(i.qty||0) <= Number(i.min||0)).length
    const exp = items.filter(i => isExpiringSoon(i.expiry)).length
    const value = items.reduce((s,i)=> s + (Number(i.qty||0) * Number(i.unitPurchase||0)), 0)
    return { totalItems, low, exp, value }
  }, [items])

  const openAdd = () => { setForm(empty); setEditing(false); setShowForm(true) }
  const openEdit = (i) => { setForm(i); setEditing(true); if(i.category && !categories.includes(i.category)){ setCategories(prev=>Array.from(new Set([...(prev||[]), i.category])).sort()) } setShowForm(true) }
  const askDelete = (item) => { setToDelete(item); setShowDeleteConfirm(true) }
  const confirmDelete = async () => { 
    if(toDelete){ 
      try {
        await inventoryAPI.delete(toDelete.id)
        await fetchInventory()
        setToDelete(null)
        setShowDeleteConfirm(false)
      } catch (err) {
        console.error('Error deleting inventory item:', err)
        alert('Failed to delete item')
      }
    } 
  }
  const cancelDelete = () => { setShowDeleteConfirm(false); setToDelete(null) }

  const save = async (e) => {
    e.preventDefault()
    try {
      // Map UI form to backend schema
      const computedQty = Number(form.qty || 0)
      const computedMin = Number(form.min || 0)
      const status = computedQty === 0 ? 'Out of Stock' : (computedQty <= computedMin ? 'Low Stock' : 'In Stock')

      const entry = {
        id: editing ? form.id : `LAB-INV-${Date.now()}`,
        itemName: form.name?.trim(),
        category: form.category || 'Other',
        quantity: computedQty,
        unit: 'unit',
        price: Number(form.unitPurchase || 0),
        supplier: form.supplier || '',
        expiryDate: form.expiry ? new Date(form.expiry) : undefined,
        minStockLevel: computedMin,
        department: 'lab',
        status
      }

      if (editing) {
        await inventoryAPI.update(form.id, entry)
      } else {
        await inventoryAPI.create(entry)
      }
      await fetchInventory()
      await fetchCategories()
      setShowForm(false)
    } catch (err) {
      console.error('Error saving inventory item:', err)
      alert('Failed to save item')
    }
  }

  const addCategoryInline = () => {
    const val = (newCategory||'').trim()
    if (!val) { alert('Enter category'); return }
    const exists = (categories||[]).find(c => c.toLowerCase() === val.toLowerCase())
    const chosen = exists || val
    setCategories(prev => Array.from(new Set([...(prev||[]), chosen])).sort())
    setForm(f => ({ ...f, category: chosen }))
    setShowAddCategory(false)
    setNewCategory('')
  }

  const exportCSV = () => {
    const headers = ['Invoice','Item','Category','Packs','Units/Pack','Unit Purchase','Unit Sale','Total Units','Min Stock','Expiry','Supplier','Status']
    const rows = filtered.map(i => [i.invoice, i.name, i.category, i.packs, i.unitsPerPack, i.unitPurchase, i.unitSale, i.qty, i.min, i.expiry||'-', i.supplier||'', i.status||'OK'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='lab-inventory.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <p className="text-slate-500 text-sm">Track and manage laboratory supplies</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Total Items</div><div className="text-2xl font-bold">{totals.totalItems}</div></div>
        <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Low Stock</div><div className="text-2xl font-bold text-amber-600">{totals.low}</div></div>
        <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Expiring Soon</div><div className="text-2xl font-bold text-rose-600">{totals.exp}</div></div>
        <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Total Value</div><div className="text-2xl font-bold text-emerald-600">PKR {totals.value.toLocaleString()}</div></div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <input className="h-10 px-3 rounded-lg border border-slate-300 w-72" placeholder="Search (name, category, invoice)" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setItems([...items])} className="px-3 h-10 rounded-lg bg-slate-100 hover:bg-slate-200">Refresh</button>
            <button onClick={exportCSV} className="px-3 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">Export CSV</button>
            <button className="px-3 h-10 rounded-lg bg-sky-100 text-sky-700">Update Stock</button>
            <button className="px-3 h-10 rounded-lg bg-teal-100 text-teal-700">Add Loose Items</button>
            <button onClick={openAdd} className="px-3 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">+ Add New Item</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['All','Low','Expiring','Out'].map(t => (
            <button key={t} onClick={()=>setTab(t)} className={`px-3 h-9 rounded-lg border ${tab===t? 'bg-slate-900 text-white border-slate-900':'bg-white border-slate-300 text-slate-700'}`}>{t==='All'?'All Items':t==='Low'?'Low Stock':t==='Expiring'?'Expiring Soon':'Out of Stock'}</button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Packs</th>
                <th className="py-3 px-4">Units/Pack</th>
                <th className="py-3 px-4">Unit Sale</th>
                <th className="py-3 px-4">Total Units</th>
                <th className="py-3 px-4">Min Stock</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="py-2 px-4">{i.invoice||'-'}</td>
                  <td className="py-2 px-4 font-medium text-slate-900">{i.name}</td>
                  <td className="py-2 px-4">{i.category||'-'}</td>
                  <td className="py-2 px-4">{i.packs||0}</td>
                  <td className="py-2 px-4">{i.unitsPerPack||0}</td>
                  <td className="py-2 px-4">{Number(i.unitSale||0).toLocaleString()}</td>
                  <td className="py-2 px-4">{i.qty||0}</td>
                  <td className="py-2 px-4">{i.min||0}</td>
                  <td className="py-2 px-4">{i.expiry||'-'}</td>
                  <td className="py-2 px-4">{i.supplier||'-'}</td>
                  <td className="py-2 px-4">{Number(i.qty||0)===0 ? 'Out' : Number(i.qty||0) <= Number(i.min||0) ? 'Low' : isExpiringSoon(i.expiry) ? 'Expiring' : 'OK'}</td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>openEdit(i)} className="px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Edit</button>
                      <button onClick={()=>askDelete(i)} className="px-3 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={12} className="py-6 text-center text-slate-500">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowForm(false)}></div>
          <form onSubmit={save} className="relative w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-800">{editing? 'Update Stock Item' : 'Add New Stock Item'}</div>
              <button type="button" onClick={()=>setShowForm(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                <input value={form.invoice} onChange={e=>setForm(f=>({...f, invoice:e.target.value}))} placeholder="e.g., 123" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} placeholder="Item Name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className="flex gap-2 items-center">
                  <select value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 flex-1 min-w-0 bg-white">
                    <option value="">Select Category</option>
                    {(categories||[]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" onClick={()=>{ setShowAddCategory(s=>!s); setNewCategory('') }} className="px-4 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap shrink-0">Add New</button>
                </div>
                {showAddCategory && (
                  <div className="mt-2 flex gap-2">
                    <input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="New category name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                    <button type="button" onClick={addCategoryInline} className="px-3 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Save</button>
                    <button type="button" onClick={()=>{ setShowAddCategory(false); setNewCategory('') }} className="px-3 h-10 rounded-lg border">Cancel</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Packs</label>
                <input type="number" value={form.packs} onChange={e=>setForm(f=>({...f, packs:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Units per Pack</label>
                <input type="number" value={form.unitsPerPack} onChange={e=>setForm(f=>({...f, unitsPerPack:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Purchase Price (PKR)</label>
                <input type="number" value={form.unitPurchase} onChange={e=>setForm(f=>({...f, unitPurchase:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Sale Price (PKR)</label>
                <input type="number" value={form.unitSale} onChange={e=>setForm(f=>({...f, unitSale:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Units in Stock</label>
                <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f, qty:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" value={form.min} onChange={e=>setForm(f=>({...f, min:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry</label>
                <input type="date" value={form.expiry} onChange={e=>setForm(f=>({...f, expiry:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <select value={form.supplier} onChange={e=>{
                  const val = e.target.value
                  if (val === '__add__') { setShowAddSupplier(true); return }
                  setForm(f=>({ ...f, supplier: val }))
                }} className="h-10 px-3 rounded-lg border border-slate-300 w-full bg-white">
                  <option value="">Select Supplier</option>
                  {suppliers.map(s=> (
                    <option key={s._id} value={s.supplierName}>{s.supplierName}</option>
                  ))}
                  <option value="__add__">+ Add new supplier…</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>OK</option>
                  <option>Low</option>
                  <option>Expiring</option>
                  <option>Out</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">{editing ? 'Update Item' : 'Add Item'}</button>
            </div>
          </form>
        </div>
      )}

      {showDeleteConfirm && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
            <div className="text-lg font-bold text-slate-900 mb-2">Delete Item</div>
            <div className="text-sm text-slate-600 mb-4">Are you sure you want to delete <span className="font-medium">{toDelete.name}</span> (Invoice #{toDelete.invoice || '-'})?</div>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
