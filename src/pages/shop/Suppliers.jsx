import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiX } from 'react-icons/fi';
import { suppliersAPI, productsAPI, salesAPI } from '../../services/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [toast, setToast] = useState('');
  const [sales, setSales] = useState([]);

  const [formData, setFormData] = useState({
    supplierName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    notes: ''
  });

  const [purchaseData, setPurchaseData] = useState({
    productId: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: ''
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchSales();
  }, []);

  const fetchSuppliers = async () => {
    try {
      console.log('Fetching suppliers...');
      const response = await suppliersAPI.getAll('shop');
      console.log('Suppliers API response:', response);
      setSuppliers(response.data || []);
      console.log('Suppliers set:', response.data?.length || 0);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await salesAPI.getAll();
      // API may return { data: [...] } or raw array
      setSales(response.data || response || []);
    } catch (error) {
      console.error('Error fetching sales for suppliers:', error);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const supplierSalesStats = useMemo(() => {
    if (!Array.isArray(products) || !Array.isArray(sales) || !sales.length) return {};

    const productMap = new Map();
    products.forEach(p => {
      if (p && p._id) {
        productMap.set(String(p._id), p);
      }
    });

    const stats = {};

    sales.forEach(sale => {
      const items = Array.isArray(sale?.items) ? sale.items : [];
      items.forEach(item => {
        const pid = item.productId ? String(item.productId) : null;
        const prod = pid ? productMap.get(pid) : null;
        const supplierName = prod?.supplier;
        if (!supplierName) return;

        if (!stats[supplierName]) {
          stats[supplierName] = {
            totalRevenue: 0,
            totalUnits: 0,
            products: {}
          };
        }

        const supStat = stats[supplierName];
        const qty = Number(item.quantity || 0);
        const perItemTotal = Number(
          item.totalPrice != null
            ? item.totalPrice
            : qty * Number(item.unitPrice || 0)
        );

        supStat.totalUnits += qty;
        supStat.totalRevenue += perItemTotal;

        const prodKey = pid || item.itemName || 'unknown';
        if (!supStat.products[prodKey]) {
          supStat.products[prodKey] = {
            productId: pid,
            productName: prod?.itemName || item.itemName || 'Unknown Product',
            unitsSold: 0,
            revenue: 0
          };
        }
        supStat.products[prodKey].unitsSold += qty;
        supStat.products[prodKey].revenue += perItemTotal;
      });
    });

    return stats;
  }, [products, sales]);

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        supplierName: supplier.supplierName,
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        category: supplier.category || '',
        notes: supplier.notes || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        supplierName: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        category: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const openPurchaseModal = async (supplier) => {
    try {
      // Optimistically set selected
      setSelectedSupplier(supplier);
      setPurchaseData({
        productId: '',
        productName: '',
        quantity: 0,
        unitPrice: 0,
        invoiceNumber: ''
      });
      setShowPurchaseModal(true);
      // Fetch latest supplier details to ensure full, up-to-date history
      const fresh = await suppliersAPI.getById(supplier._id);
      if (fresh?.data) setSelectedSupplier(fresh.data);
    } catch {
      // keep optimistic state on failure
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier._id, { ...formData, portal: 'shop' });
        showToast('Supplier updated successfully');
      } else {
        await suppliersAPI.create({ ...formData, portal: 'shop' });
        showToast('Supplier added successfully');
      }
      fetchSuppliers();
      setShowModal(false);
    } catch (error) {
      showToast('Error saving supplier');
    }
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    try {
      await suppliersAPI.addPurchase(selectedSupplier._id, purchaseData);
      showToast('Purchase recorded and stock updated');
      fetchSuppliers();
      fetchProducts();
      setShowPurchaseModal(false);
    } catch (error) {
      showToast('Error recording purchase');
    }
  };

  const openDeleteModal = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    
    try {
      await suppliersAPI.delete(supplierToDelete._id);
      showToast('Supplier deleted successfully');
      fetchSuppliers();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch (error) {
      showToast('Error deleting supplier');
      setShowDeleteModal(false);
    }
  };

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p._id === productId);
    if (product) {
      setPurchaseData({
        ...purchaseData,
        productId: product._id,
        productName: product.itemName,
        unitPrice: product.purchasePrice
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Suppliers
          </h1>
          <p className="text-slate-500 mt-1">Manage supplier information and purchases</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          <FiPlus /> Add Supplier
        </button>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier) => (
          <div key={supplier._id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{supplier.supplierName}</h3>
                {supplier.category && (
                  <span className="inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {supplier.category}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal(supplier)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(supplier)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-4">
              {supplier.contactPerson && (
                <p><strong>Contact:</strong> {supplier.contactPerson}</p>
              )}
              {supplier.phone && (
                <p><strong>Phone:</strong> {supplier.phone}</p>
              )}
              {supplier.email && (
                <p><strong>Email:</strong> {supplier.email}</p>
              )}
              {supplier.address && (
                <p><strong>Address:</strong> {supplier.address}</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Purchases:</span>
                <span className="font-semibold text-slate-800">
                  Rs{supplier.totalPurchases?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Purchase Records:</span>
                <span className="font-semibold text-slate-800">
                  {supplier.purchaseHistory?.length || 0}
                </span>
              </div>
              {(() => {
                const perf = supplierSalesStats[supplier.supplierName] || null;
                if (!perf) return null;
                return (
                  <>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-600">Units Sold (Shop):</span>
                      <span className="font-semibold text-emerald-700">
                        {perf.totalUnits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-600">Sales Revenue:</span>
                      <span className="font-semibold text-emerald-700">
                        Rs{perf.totalRevenue.toLocaleString()}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <button
              onClick={() => openPurchaseModal(supplier)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
            >
              <FiPackage className="w-4 h-4" /> Record Purchase
            </button>

            {supplier.purchaseHistory && supplier.purchaseHistory.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Recent Purchases:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {supplier.purchaseHistory.slice(-3).reverse().map((purchase, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                      <p className="font-medium">{purchase.productName}</p>
                      <p className="text-slate-600">
                        Qty: {purchase.quantity} • Rs{purchase.totalPrice?.toLocaleString()}
                      </p>
                      <p className="text-slate-500">
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {suppliers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FiPackage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No suppliers yet. Add your first supplier.</p>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.supplierName}
                    onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Pet Food, Accessories"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      {showPurchaseModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                Record Purchase - {selectedSupplier.supplierName}
              </h2>
              <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Purchase Form */}
                <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Product *</label>
                    <select
                      required
                      value={purchaseData.productId}
                      onChange={handleProductSelect}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Choose a product</option>
                      {products.map(product => (
                        <option key={product._id} value={product._id}>
                          {product.itemName} (Stock: {product.quantity})
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
                      value={purchaseData.quantity}
                      onChange={(e) => setPurchaseData({...purchaseData, quantity: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={purchaseData.unitPrice}
                      onChange={(e) => setPurchaseData({...purchaseData, unitPrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={purchaseData.invoiceNumber}
                      onChange={(e) => setPurchaseData({...purchaseData, invoiceNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Amount:</span>
                      <span className="font-semibold text-slate-800">Rs{(purchaseData.quantity * purchaseData.unitPrice).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                    >
                      Record Purchase
                    </button>
                  </div>
                </form>

                {/* Purchase History */}
                <div className="border rounded-lg">
                  <div className="px-3 py-2 border-b bg-slate-50 font-semibold text-slate-700 text-sm">Purchase History</div>
                  <div className="max-h-80 overflow-y-auto">
                    {selectedSupplier.purchaseHistory && selectedSupplier.purchaseHistory.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Invoice</th>
                            <th className="p-2 text-left">Product</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Unit</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSupplier.purchaseHistory.slice().reverse().map((p, idx) => {
                            const unit = Number(p.unitPrice || 0);
                            const qty = Number(p.quantity || 0);
                            const total = Number(p.totalPrice != null ? p.totalPrice : unit * qty);
                            const when = p.purchaseDate || p.createdAt || new Date().toISOString();
                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{new Date(when).toLocaleDateString()}</td>
                                <td className="p-2">{p.invoiceNumber || '-'}</td>
                                <td className="p-2">{p.productName}</td>
                                <td className="p-2 text-right">{qty}</td>
                                <td className="p-2 text-right">Rs{unit.toLocaleString()}</td>
                                <td className="p-2 text-right font-semibold">Rs{total.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-sm text-slate-500">No purchase records yet for this supplier.</div>
                    )}
                  </div>
                  {(() => {
                    if (!selectedSupplier) return null;
                    const perf = supplierSalesStats[selectedSupplier.supplierName];
                    if (!perf) return null;
                    const topProducts = Object.values(perf.products || {})
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, 3);
                    if (!topProducts.length) return null;
                    return (
                      <div className="border-t bg-slate-50">
                        <div className="px-3 py-2 font-semibold text-slate-700 text-sm flex justify-between">
                          <span>Sales Summary</span>
                          <span className="text-emerald-700">Rs{perf.totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="px-3 pb-3 text-xs text-slate-600 space-y-1">
                          <div>Total units sold: <span className="font-semibold">{perf.totalUnits.toLocaleString()}</span></div>
                          <div className="mt-1 font-semibold text-slate-700">Top Products:</div>
                          <ul className="space-y-1">
                            {topProducts.map((p, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span className="truncate mr-2">{p.productName}</span>
                                <span className="whitespace-nowrap">{p.unitsSold} pcs • Rs{p.revenue.toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Supplier</h3>
                  <p className="text-sm text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-900">{supplierToDelete.supplierName}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning:</p>
                    <p>Deleting this supplier will remove all associated purchase history and records.</p>
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  {supplierToDelete.contactPerson && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Contact:</span>
                      <span className="font-medium text-slate-800">{supplierToDelete.contactPerson}</span>
                    </div>
                  )}
                  {supplierToDelete.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Phone:</span>
                      <span className="font-medium text-slate-800">{supplierToDelete.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Total Purchases:</span>
                    <span className="font-semibold text-slate-900">Rs{supplierToDelete.totalPurchases?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSupplierToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Delete Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
