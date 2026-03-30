import React, { useEffect, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi'
import { suppliersAPI } from '../../services/api'

export default function LabSuppliers(){
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const [form, setForm] = useState({
    supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:''
  })

  useEffect(()=>{ fetchSuppliers() },[])

  const fetchSuppliers = async ()=>{
    try {
      setLoading(true)
      const res = await suppliersAPI.getAll('lab')
      setSuppliers(res?.data || [])
    } catch (e) {
      setSuppliers([])
    } finally { setLoading(false) }
  }

  const openModal = (s=null)=>{
    if (s) { setEditing(s); setForm({
      supplierName: s.supplierName||'', contactPerson: s.contactPerson||'', phone: s.phone||'', email: s.email||'', address: s.address||'', category: s.category||'', notes: s.notes||''
    }) }
    else { setEditing(null); setForm({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' }) }
    setShowModal(true)
  }

  const saveSupplier = async (e)=>{
    e.preventDefault()
    try {
      if (editing && editing._id) {
        await suppliersAPI.update(editing._id, { ...form, portal: 'lab' })
        setToast('Supplier updated')
      } else {
        await suppliersAPI.create({ ...form, portal: 'lab' })
        setToast('Supplier added')
      }
      setShowModal(false)
      setEditing(null)
      await fetchSuppliers()
      setTimeout(()=>setToast(''), 2200)
    } catch (e) {
      setToast('Failed to save supplier')
      setTimeout(()=>setToast(''), 2200)
    }
  }

  const askDelete = (s)=>{ setToDelete(s); setShowDeleteModal(true) }
  const doDelete = async ()=>{
    if (!toDelete) return
    try { await suppliersAPI.delete(toDelete._id); setToast('Supplier deleted'); await fetchSuppliers() } catch (e) { setToast('Delete failed') }
    setShowDeleteModal(false); setToDelete(null); setTimeout(()=>setToast(''), 2200)
  }

  return (
    <div className="space-y-6">
      {toast && (<div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow z-50">{toast}</div>)}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Suppliers</h1>
          <p className="text-slate-500">Manage lab suppliers for inventory purchases</p>
        </div>
        <button onClick={()=>openModal()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"><FiPlus/> Add Supplier</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(loading? [] : suppliers).map(s=> (
          <div key={s._id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900 text-lg">{s.supplierName}</div>
                {s.category && <div className="text-xs text-blue-700 mt-1">{s.category}</div>}
                {s.contactPerson && <div className="text-xs text-slate-600 mt-1">Contact: {s.contactPerson}</div>}
                {s.phone && <div className="text-xs text-slate-600">Phone: {s.phone}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={()=>openModal(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><FiEdit2 className="w-4 h-4"/></button>
                <button onClick={()=>askDelete(s)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 className="w-4 h-4"/></button>
              </div>
            </div>
            {s.address && <div className="text-xs text-slate-500 mt-2">{s.address}</div>}
          </div>
        ))}
        {!loading && suppliers.length===0 && (
          <div className="col-span-full text-center text-slate-500 bg-white border border-slate-200 rounded-xl p-10">No suppliers yet</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowModal(false)}>
          <form onSubmit={saveSupplier} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold">{editing? 'Edit Supplier' : 'Add Supplier'}</div>
              <button type="button" onClick={()=>setShowModal(false)} className="text-slate-500 hover:text-slate-700"><FiX/></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                <input required value={form.supplierName} onChange={e=>setForm(f=>({...f, supplierName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input value={form.contactPerson} onChange={e=>setForm(f=>({...f, contactPerson:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input value={form.address} onChange={e=>setForm(f=>({...f, address:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} className="px-3 py-2 rounded-lg border-2 border-slate-200 w-full"/>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button type="button" onClick={()=>setShowModal(false)} className="h-10 px-4 rounded-lg border border-slate-300">Cancel</button>
              <button className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">{editing? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {showDeleteModal && toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between">
              <div className="font-semibold">Delete Supplier</div>
              <button onClick={()=>setShowDeleteModal(false)} className="text-white/90 hover:text-white"><FiX/></button>
            </div>
            <div className="p-6 text-sm">
              Are you sure you want to delete <b>{toDelete.supplierName}</b>?
            </div>
            <div className="sticky bottom-0 px-6 py-4 flex justify-end gap-2 bg-slate-50">
              <button onClick={()=>setShowDeleteModal(false)} className="h-9 px-3 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={doDelete} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
