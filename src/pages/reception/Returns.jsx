import React, { useState, useEffect, useMemo } from 'react';
import { FiRefreshCw, FiCheck, FiX, FiSearch, FiFilter, FiPackage, FiDollarSign, FiFileText, FiTrash2, FiEye } from 'react-icons/fi';
import { returnsAPI, salesAPI } from '../../services/api';
import { useActivity } from '../../context/ActivityContext';

export default function ReceptionReturns() {
  const [returns, setReturns] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewReturnModal, setShowNewReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [processingFee, setProcessingFee] = useState(0);
  const [restockingFee, setRestockingFee] = useState(0);
  const [viewReturn, setViewReturn] = useState(null);
  const { addActivity } = useActivity();

  useEffect(() => {
    fetchReturns();
    fetchSales();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await returnsAPI.getAll({ portal: 'reception' });
      setReturns(response.data || []);
    } catch (error) {
      console.error('Error fetching returns:', error);
      showToast('Error loading returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await salesAPI.getAll();
      setSales(response.data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const handleCreateReturn = async () => {
    if (!selectedSale || returnItems.length === 0) {
      showToast('Please select a sale and items to return');
      return;
    }

    try {
      const subtotal = returnItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const finalRefund = Math.max(0, subtotal - processingFee - restockingFee);

      const returnData = {
        originalSaleId: selectedSale.id || selectedSale._id,
        invoiceNumber: selectedSale.invoiceNumber,
        customerId: selectedSale.customerId,
        customerName: selectedSale.customerName,
        customerContact: selectedSale.customerContact,
        items: returnItems.map(item => ({
          productId: item.productId,
          itemName: item.itemName,
          quantity: item.returnQuantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.returnQuantity,
          reason: item.reason || returnReason,
          condition: item.condition || 'Good'
        })),
        subtotal,
        refundAmount: subtotal,
        refundMethod,
        processingFee: Number(processingFee) || 0,
        restockingFee: Number(restockingFee) || 0,
        finalRefund,
        reason: returnReason,
        portal: 'reception',
        status: 'Pending'
      };

      await returnsAPI.create(returnData);
      showToast('Return created successfully');
      setShowNewReturnModal(false);
      resetReturnForm();
      fetchReturns();
      try {
        addActivity({ user: 'Reception', text: `Created return for invoice ${selectedSale.invoiceNumber}` });
      } catch {}
    } catch (error) {
      console.error('Error creating return:', error);
      showToast('Error creating return');
    }
  };

  const handleProcessReturn = async (returnDoc, status) => {
    try {
      await returnsAPI.process(returnDoc.id, {
        status,
        processedBy: 'Reception Staff'
      });
      showToast(`Return ${status.toLowerCase()}`);
      fetchReturns();
      if (viewReturn && viewReturn.id === returnDoc.id) {
        setViewReturn({ ...viewReturn, status });
      }
    } catch (error) {
      console.error('Error processing return:', error);
      showToast('Error processing return');
    }
  };

  const handleDeleteReturn = async (id) => {
    if (!confirm('Are you sure you want to delete this return?')) return;
    
    try {
      await returnsAPI.delete(id);
      showToast('Return deleted');
      fetchReturns();
    } catch (error) {
      console.error('Error deleting return:', error);
      showToast('Error deleting return');
    }
  };

  const resetReturnForm = () => {
    setSelectedSale(null);
    setReturnItems([]);
    setReturnReason('');
    setRefundMethod('Cash');
    setProcessingFee(0);
    setRestockingFee(0);
  };

  const selectSaleForReturn = (sale) => {
    setSelectedSale(sale);
    setReturnItems(sale.items.map(item => ({
      ...item,
      returnQuantity: 0,
      reason: '',
      condition: 'Good'
    })));
  };

  const updateReturnItem = (index, field, value) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'returnQuantity') {
        updated.totalPrice = updated.unitPrice * Math.min(value, item.quantity);
      }
      return updated;
    }));
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const filteredReturns = useMemo(() => {
    let filtered = returns;
    
    if (filter === 'pending') {
      filtered = filtered.filter(r => r.status === 'Pending');
    } else if (filter === 'approved') {
      filtered = filtered.filter(r => r.status === 'Approved' || r.status === 'Completed');
    } else if (filter === 'rejected') {
      filtered = filtered.filter(r => r.status === 'Rejected');
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.returnNumber?.toLowerCase().includes(q) ||
        r.invoiceNumber?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.customerId?.toLowerCase().includes(q)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [returns, filter, searchQuery]);

  const getStatusBadge = (status) => {
    const styles = {
      'Pending': 'bg-amber-100 text-amber-700',
      'Approved': 'bg-blue-100 text-blue-700',
      'Processing': 'bg-purple-100 text-purple-700',
      'Completed': 'bg-emerald-100 text-emerald-700',
      'Rejected': 'bg-red-100 text-red-700'
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  const selectedReturnSubtotal = returnItems.reduce((sum, item) => sum + (item.unitPrice * Math.min(item.returnQuantity || 0, item.quantity)), 0);
  const selectedReturnFinal = Math.max(0, selectedReturnSubtotal - processingFee - restockingFee);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Returns Management</h1>
          <p className="text-slate-500 mt-1">Process customer returns and update inventory</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewReturnModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <FiRefreshCw className="w-4 h-4" />
            New Return
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-800">{returns.length}</div>
          <div className="text-sm text-slate-500">Total Returns</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-amber-600">
            {returns.filter(r => r.status === 'Pending').length}
          </div>
          <div className="text-sm text-slate-500">Pending</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-emerald-600">
            {returns.filter(r => r.status === 'Completed').length}
          </div>
          <div className="text-sm text-slate-500">Completed</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            PKR {returns.filter(r => r.status === 'Completed').reduce((sum, r) => sum + (r.finalRefund || 0), 0).toLocaleString()}
          </div>
          <div className="text-sm text-slate-500">Total Refunded</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by return number, invoice, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >All</button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >Pending</button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >Approved</button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >Rejected</button>
          </div>
        </div>
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FiPackage className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700">No returns found</h3>
          <p className="text-slate-500 mt-1">Click "New Return" to process a customer return</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Return #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Invoice</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Refund</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{ret.returnNumber}</div>
                      <div className="text-sm text-slate-500">{new Date(ret.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ret.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{ret.customerName || 'Walk-in'}</div>
                      {ret.customerId && <div className="text-sm text-slate-500">{ret.customerId}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ret.items?.length || 0} items</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                      PKR {(ret.finalRefund || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(ret.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewReturn(ret)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        {ret.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleProcessReturn(ret, 'Approved')}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            >
                              <FiCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleProcessReturn(ret, 'Rejected')}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteReturn(ret.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Return Modal */}
      {showNewReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">Create New Return</h3>
                <button onClick={() => { setShowNewReturnModal(false); resetReturnForm(); }} className="p-2 text-slate-400 hover:text-slate-600">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {!selectedSale ? (
                <div className="space-y-4">
                  <p className="text-slate-600">Select a sale to process a return:</p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {sales.filter(s => s.invoiceNumber).slice(0, 50).map(sale => (
                      <div
                        key={sale.id || sale._id}
                        onClick={() => selectSaleForReturn(sale)}
                        className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800">{sale.invoiceNumber}</div>
                            <div className="text-sm text-slate-500">{sale.customerName || 'Walk-in'} | {new Date(sale.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-slate-800">PKR {(sale.totalAmount || 0).toLocaleString()}</div>
                            <div className="text-sm text-slate-500">{sale.items?.length || 0} items</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-slate-800">{selectedSale.invoiceNumber}</div>
                        <div className="text-sm text-slate-500">{selectedSale.customerName || 'Walk-in'}</div>
                      </div>
                      <button
                        onClick={() => setSelectedSale(null)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Change Sale
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Select Items to Return</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {returnItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{item.itemName}</div>
                            <div className="text-sm text-slate-500">Original: {item.quantity} @ PKR {item.unitPrice}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">Return Qty:</label>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.returnQuantity}
                              onChange={(e) => updateReturnItem(idx, 'returnQuantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded"
                            />
                          </div>
                          <div className="w-32">
                            <select
                              value={item.condition}
                              onChange={(e) => updateReturnItem(idx, 'condition', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            >
                              <option>Good</option>
                              <option>Damaged</option>
                              <option>Defective</option>
                              <option>Expired</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Return Reason</label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="">Select reason...</option>
                        <option value="Defective">Defective Product</option>
                        <option value="Wrong Item">Wrong Item Sent</option>
                        <option value="Not Needed">Customer Changed Mind</option>
                        <option value="Damaged">Damaged in Transit</option>
                        <option value="Expired">Expired Product</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Refund Method</label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option>Cash</option>
                        <option>Card</option>
                        <option>Bank Transfer</option>
                        <option>Store Credit</option>
                        <option>Original Payment Method</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Processing Fee (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        value={processingFee}
                        onChange={(e) => setProcessingFee(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Restocking Fee (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        value={restockingFee}
                        onChange={(e) => setRestockingFee(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Subtotal:</span>
                      <span>PKR {selectedReturnSubtotal.toLocaleString()}</span>
                    </div>
                    {(processingFee > 0 || restockingFee > 0) && (
                      <div className="flex justify-between text-sm mb-1 text-red-600">
                        <span>Fees:</span>
                        <span>-PKR {(processingFee + restockingFee).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                      <span>Final Refund:</span>
                      <span className="text-emerald-600">PKR {selectedReturnFinal.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateReturn}
                    disabled={selectedReturnSubtotal <= 0}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Create Return
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Return Modal */}
      {viewReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">Return Details - {viewReturn.returnNumber}</h3>
                <button onClick={() => setViewReturn(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(viewReturn.status)}
                  <span className="text-sm text-slate-500">{new Date(viewReturn.createdAt).toLocaleString()}</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">Invoice:</span> {viewReturn.invoiceNumber}</div>
                    <div><span className="text-slate-500">Customer:</span> {viewReturn.customerName || 'Walk-in'}</div>
                    <div><span className="text-slate-500">Reason:</span> {viewReturn.reason || 'N/A'}</div>
                    <div><span className="text-slate-500">Refund Method:</span> {viewReturn.refundMethod}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-800 mb-2">Returned Items</h4>
                  <div className="space-y-2">
                    {viewReturn.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-800">{item.itemName}</div>
                          <div className="text-sm text-slate-500">Condition: {item.condition}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.quantity} x PKR {item.unitPrice}</div>
                          <div className="text-sm text-slate-500">PKR {item.totalPrice.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>PKR {(viewReturn.subtotal || 0).toLocaleString()}</span>
                  </div>
                  {(viewReturn.processingFee > 0 || viewReturn.restockingFee > 0) && (
                    <div className="flex justify-between text-sm mb-1 text-red-600">
                      <span>Fees:</span>
                      <span>-PKR {((viewReturn.processingFee || 0) + (viewReturn.restockingFee || 0)).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Final Refund:</span>
                    <span className="text-emerald-600">PKR {(viewReturn.finalRefund || 0).toLocaleString()}</span>
                  </div>
                </div>

                {viewReturn.status === 'Pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { handleProcessReturn(viewReturn, 'Approved'); setViewReturn(null); }}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                    >
                      Approve Return
                    </button>
                    <button
                      onClick={() => { handleProcessReturn(viewReturn, 'Rejected'); setViewReturn(null); }}
                      className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                      Reject Return
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
