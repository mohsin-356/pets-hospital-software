import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSend, FiX } from 'react-icons/fi';
import { distributorsAPI, inventoryAPI } from '../../services/api';

export default function Distributors() {
  const [distributors, setDistributors] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editingDistributor, setEditingDistributor] = useState(null);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [distributorToDelete, setDistributorToDelete] = useState(null);

  const [toast, setToast] = useState('');

  const [formData, setFormData] = useState({
    distributorName: '',
    contactPerson: '',
    phone: '',
    isWhatsApp: false,
    email: '',
    address: '',
    city: '',
    category: '',
    notes: ''
  });

  const [dispatchData, setDispatchData] = useState({
    inventoryItemId: '',
    itemName: '',
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: '',
    note: ''
  });

  useEffect(() => {
    fetchDistributors();
    fetchInventory();
  }, []);

  const showToastMsg = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchDistributors = async () => {
    try {
      const response = await distributorsAPI.getAll('shop');
      setDistributors(response.data || []);
    } catch {
      setDistributors([]);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await inventoryAPI.getAll();
      const list = response?.data || [];
      setInventoryItems(list);
    } catch {
      setInventoryItems([]);
    }
  };

  const shopInventory = useMemo(() => {
    return (inventoryItems || []).filter(i => !i?.department || i.department === 'shop');
  }, [inventoryItems]);

  const openModal = (d = null) => {
    if (d) {
      setEditingDistributor(d);
      setFormData({
        distributorName: d.distributorName || '',
        contactPerson: d.contactPerson || '',
        phone: d.phone || '',
        isWhatsApp: d.isWhatsApp === true,
        email: d.email || '',
        address: d.address || '',
        city: d.city || '',
        category: d.category || '',
        notes: d.notes || ''
      });
    } else {
      setEditingDistributor(null);
      setFormData({
        distributorName: '',
        contactPerson: '',
        phone: '',
        isWhatsApp: false,
        email: '',
        address: '',
        city: '',
        category: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const openDispatchModal = async (d) => {
    try {
      setSelectedDistributor(d);
      setDispatchData({
        inventoryItemId: '',
        itemName: '',
        quantity: 0,
        unitPrice: 0,
        invoiceNumber: '',
        note: ''
      });
      setShowDispatchModal(true);
      const fresh = await distributorsAPI.getById(d._id);
      if (fresh?.data) setSelectedDistributor(fresh.data);
    } catch {
      setShowDispatchModal(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDistributor) {
        await distributorsAPI.update(editingDistributor._id, { ...formData, portal: 'shop' });
        showToastMsg('Distributor updated successfully');
      } else {
        await distributorsAPI.create({ ...formData, portal: 'shop' });
        showToastMsg('Distributor added successfully');
      }
      setShowModal(false);
      fetchDistributors();
    } catch {
      showToastMsg('Error saving distributor');
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDistributor?._id) return;
    try {
      await distributorsAPI.addDispatch(selectedDistributor._id, dispatchData);
      showToastMsg('Dispatch recorded and stock updated');
      setShowDispatchModal(false);
      fetchDistributors();
      fetchInventory();
    } catch {
      showToastMsg('Error recording dispatch');
    }
  };

  const openDeleteModal = (d) => {
    setDistributorToDelete(d);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!distributorToDelete?._id) return;
    try {
      await distributorsAPI.delete(distributorToDelete._id);
      showToastMsg('Distributor deleted successfully');
      setShowDeleteModal(false);
      setDistributorToDelete(null);
      fetchDistributors();
    } catch {
      showToastMsg('Error deleting distributor');
      setShowDeleteModal(false);
    }
  };

  const handleInventorySelect = (e) => {
    const id = e.target.value;
    const item = shopInventory.find(i => String(i._id) === String(id));
    if (!item) {
      setDispatchData(prev => ({ ...prev, inventoryItemId: id, itemName: '' }));
      return;
    }
    setDispatchData(prev => ({
      ...prev,
      inventoryItemId: item._id,
      itemName: item.itemName,
      unitPrice: Number(item.price || 0)
    }));
  };

  const formatPhoneForWa = (raw) => {
    const digits = String(raw || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `92${digits.slice(1)}`;
    if (digits.startsWith('92')) return digits;
    if (digits.length === 10) return `92${digits}`;
    return digits;
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Distributors</h1>
          <p className="text-slate-500 mt-1">Manage distributor information and dispatches</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          <FiPlus /> Add Distributor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {distributors.map((d) => (
          <div key={d._id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-800 truncate" title={d.distributorName}>{d.distributorName}</h3>
                {d.category && (
                  <span className="inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{d.category}</span>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal(d)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button onClick={() => openDeleteModal(d)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-4">
              {d.contactPerson && (<p><strong>Contact:</strong> {d.contactPerson}</p>)}
              {d.phone && (
                <p className="flex items-center justify-between gap-2">
                  <span><strong>Phone:</strong> {d.phone}</span>
                  {d.isWhatsApp && (
                    <a
                      href={`https://wa.me/${encodeURIComponent(formatPhoneForWa(d.phone))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
                      title="Open WhatsApp"
                    >
                      WhatsApp
                    </a>
                  )}
                </p>
              )}
              {d.address && (<p><strong>Address:</strong> {d.address}</p>)}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Dispatches:</span>
                <span className="font-semibold text-slate-800">Rs{d.totalDispatches?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Dispatch Records:</span>
                <span className="font-semibold text-slate-800">{d.dispatchHistory?.length || 0}</span>
              </div>
            </div>

            <button
              onClick={() => openDispatchModal(d)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
            >
              <FiSend className="w-4 h-4" /> Record Dispatch
            </button>

            {d.dispatchHistory && d.dispatchHistory.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Recent Dispatches:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {d.dispatchHistory.slice(-3).reverse().map((p, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                      <p className="font-medium">{p.itemName}</p>
                      <p className="text-slate-600">Qty: {p.quantity} • Rs{p.totalPrice?.toLocaleString?.() || p.totalPrice || 0}</p>
                      <p className="text-slate-500">{new Date(p.dispatchDate || Date.now()).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {distributors.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No distributors yet. Add your first distributor.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">{editingDistributor ? 'Edit Distributor' : 'Add New Distributor'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><FiX className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Distributor Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.distributorName}
                    onChange={(e) => setFormData({ ...formData, distributorName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isWhatsApp === true}
                      onChange={(e) => setFormData({ ...formData, isWhatsApp: e.target.checked })}
                      className="h-4 w-4"
                    />
                    WhatsApp number
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{editingDistributor ? 'Update Distributor' : 'Add Distributor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDispatchModal && selectedDistributor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Record Dispatch - {selectedDistributor.distributorName}</h2>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-600"><FiX className="w-6 h-6" /></button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form onSubmit={handleDispatchSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Inventory Item *</label>
                    <select
                      required
                      value={dispatchData.inventoryItemId}
                      onChange={handleInventorySelect}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose an item</option>
                      {shopInventory.map(item => (
                        <option key={item._id} value={item._id}>
                          {item.itemName} (Stock: {item.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={dispatchData.quantity}
                      onChange={(e) => setDispatchData({ ...dispatchData, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={dispatchData.unitPrice}
                      onChange={(e) => setDispatchData({ ...dispatchData, unitPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={dispatchData.invoiceNumber}
                      onChange={(e) => setDispatchData({ ...dispatchData, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                    <input
                      type="text"
                      value={dispatchData.note}
                      onChange={(e) => setDispatchData({ ...dispatchData, note: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Amount:</span>
                      <span className="font-semibold text-slate-800">Rs{(Number(dispatchData.quantity || 0) * Number(dispatchData.unitPrice || 0)).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">Record Dispatch</button>
                  </div>
                </form>

                <div className="border rounded-lg">
                  <div className="px-3 py-2 border-b bg-slate-50 font-semibold text-slate-700 text-sm">Dispatch History</div>
                  <div className="max-h-80 overflow-y-auto">
                    {selectedDistributor.dispatchHistory && selectedDistributor.dispatchHistory.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Invoice</th>
                            <th className="p-2 text-left">Item</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Unit</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDistributor.dispatchHistory.slice().reverse().map((p, idx) => {
                            const unit = Number(p.unitPrice || 0);
                            const qty = Number(p.quantity || 0);
                            const total = Number(p.totalPrice != null ? p.totalPrice : unit * qty);
                            const when = p.dispatchDate || p.createdAt || new Date().toISOString();
                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{new Date(when).toLocaleDateString()}</td>
                                <td className="p-2">{p.invoiceNumber || '-'}</td>
                                <td className="p-2">{p.itemName}</td>
                                <td className="p-2 text-right">{qty}</td>
                                <td className="p-2 text-right">Rs{unit.toLocaleString()}</td>
                                <td className="p-2 text-right font-semibold">Rs{total.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-sm text-slate-500">No dispatch records yet for this distributor.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && distributorToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <h3 className="text-lg font-bold">Delete Distributor</h3>
              <p className="text-sm text-red-100">This action cannot be undone</p>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-6">Are you sure you want to delete <span className="font-bold text-slate-900">{distributorToDelete.distributorName}</span>?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDistributorToDelete(null); }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
