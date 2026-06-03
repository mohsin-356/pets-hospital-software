import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList, FiEyeOff, FiMaximize2 } from 'react-icons/fi';
import { productsAPI, salesAPI, settingsAPI, shopCustomersAPI } from '../../services/api';

export default function ReceptionPOS() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerId: '',
    customerName: '',
    customerContact: ''
  });
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [hideInventory, setHideInventory] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [allSales, setAllSales] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [previousDue, setPreviousDue] = useState(0);
  const [paymentCharge, setPaymentCharge] = useState(0);
  const [isChargeManual, setIsChargeManual] = useState(false);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const receiptRef = useRef();
  const scanTimerRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchHospitalSettings();
    fetchAllSales();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchAllSales = async () => {
    try {
      const resp = await salesAPI.getAll();
      setAllSales(resp.data || []);
    } catch (e) {
      console.error('Error loading sales list', e);
    }
  };

  const fetchHospitalSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const findByBarcode = (code) => {
    if (!code) return null;
    const q = String(code).trim().toLowerCase();
    return products.find(p => (p.barcode || '').trim().toLowerCase() === q) || null;
  };

  const scheduleAutoAddByBarcode = (val) => {
    try { if (scanTimerRef.current) clearTimeout(scanTimerRef.current); } catch {}
    scanTimerRef.current = setTimeout(() => {
      const prod = findByBarcode(val);
      if (prod) {
        addToCart(prod);
        setSearchQuery('');
      }
    }, 120);
  };

  const searchProducts = products.filter(p =>
    p.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product._id);
    
    if (existing) {
      if (existing.quantity >= product.quantity) {
        showToast('Insufficient stock');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.salePrice }
          : item
      ));
      showToast(`${product.itemName} quantity updated`);
    } else {
      if (product.quantity === 0) {
        showToast('Product out of stock');
        return;
      }
      setCart([...cart, {
        productId: product._id,
        itemName: product.itemName,
        quantity: 1,
        purchasePrice: product.purchasePrice || 0,
        salePrice: product.salePrice,
        margin: 0,
        totalPrice: product.salePrice,
        availableStock: product.quantity
      }]);
      showToast(`${product.itemName} added to cart`);
    }
    setSearchQuery('');
  };

  const updateQuantity = (productId, newQuantity) => {
    const item = cart.find(i => i.productId === productId);
    if (newQuantity > item.availableStock) {
      showToast('Insufficient stock');
      return;
    }
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity, totalPrice: newQuantity * item.salePrice }
        : item
    ));
  };

  const updateMargin = (productId, margin) => {
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, margin: Number(margin) || 0 }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo({ customerId: '', customerName: '', customerContact: '' });
    setDiscount(0);
    setPaymentMethod('Cash');
    setReceivedAmount('');
    setPreviousDue(0);
    setPaymentCharge(0);
    setIsChargeManual(false);
    setReceivedTouched(false);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = (subtotal * discount) / 100;
  const baseTotal = Math.max(0, subtotal - discountAmount);
  const totalAmount = baseTotal + Number(paymentCharge || 0);
  const payableTotal = totalAmount + previousDue;

  useEffect(() => {
    if (paymentMethod === 'Cash') {
      if (!isChargeManual) setPaymentCharge(0);
      return;
    }
    if (!isChargeManual) {
      const auto = Number((baseTotal * 0.02).toFixed(2));
      setPaymentCharge(auto);
    }
  }, [paymentMethod, baseTotal, isChargeManual]);

  useEffect(() => {
    if (!showPaymentModal) return;
    const totalLocal = payableTotal;
    setReceivedAmount(v => (v && Number(v) > 0 ? v : totalLocal));
    setReceivedTouched(false);
  }, [showPaymentModal]);

  useEffect(() => {
    if (!showPaymentModal) return;
    if (receivedTouched) return;
    setReceivedAmount(payableTotal);
  }, [paymentMethod, paymentCharge, cart, discount, previousDue, showPaymentModal, receivedTouched, payableTotal]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty');
      return;
    }

    try {
      let cid = customerInfo.customerId?.trim();
      if (!cid) {
        cid = `CUS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;
      }
      const recv = (receivedAmount !== '' && Number(receivedAmount) >= 0)
        ? Number(receivedAmount)
        : payableTotal;
      const balanceDue = Math.max(0, totalAmount - recv + previousDue);

      const displayMethod = paymentMethod;
      const serverMethodMap = { Cash: 'Cash', Bank: 'Card', JazzCash: 'Online', Other: 'Other' };
      const serverMethod = serverMethodMap[displayMethod] || 'Cash';

      const salePayload = {
        items: cart.map(item => ({
          productId: item.productId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.salePrice,
          totalPrice: item.totalPrice,
          margin: item.margin
        })),
        subtotal,
        discount,
        paymentCharge: Number(paymentCharge || 0),
        tax: 0,
        totalAmount,
        paymentMethod: serverMethod,
        receivedAmount: recv,
        previousDue,
        balanceDue,
        customerId: cid,
        customerName: customerInfo.customerName || '',
        customerContact: customerInfo.customerContact || '',
        soldBy: 'Reception'
      };

      let response;
      try {
        response = await salesAPI.create(salePayload);
      } catch (err) {
        if (String(err?.status||'') === '400') {
          const minimal = {
            items: salePayload.items,
            subtotal,
            discount,
            totalAmount,
            paymentMethod: serverMethod,
            receivedAmount: recv,
            previousDue,
            balanceDue,
            customerId: cid,
            customerName: customerInfo.customerName || '',
            customerContact: customerInfo.customerContact || '',
            soldBy: 'Reception',
          };
          response = await salesAPI.create(minimal);
        } else {
          throw err;
        }
      }
      setLastSale({ ...response.data, paymentMethod: displayMethod, receivedAmount: recv, previousDue, balanceDue, customerId: cid, paymentCharge: Number(paymentCharge||0) });
      setShowReceipt(true);
      setShowPaymentModal(false);
      clearCart();
      fetchProducts();
      fetchAllSales();
      showToast('Sale completed successfully');
      try {
        const customer = {
          id: cid,
          name: customerInfo.customerName || 'Walk-in',
          contact: customerInfo.customerContact || '',
        };
        await shopCustomersAPI.create(customer);
      } catch(e) {}
      setLastSale(prev => prev ? { ...prev, paymentMethod: displayMethod, receivedAmount: recv, previousDue, balanceDue, customerId: cid } : prev)
    } catch (error) {
      console.error('Checkout error:', error);
      showToast(error.response?.data?.message || error.message || 'Error processing sale');
    }
  };

  const printReceipt = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    try { setShowReceipt(false); } catch {}
    
    const baseSubtotal = Number(lastSale?.subtotal || 0);
    const extraCharge = Number(lastSale?.paymentCharge || 0);
    const shares = (lastSale?.items || []).map((it, i, arr) => {
      if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
      if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
      const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
      return Number((extraCharge - prev).toFixed(2));
    });

    const discountCurrency = ((Number(lastSale?.subtotal||0) * Number(lastSale?.discount||0)) / 100);
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${lastSale?.invoiceNumber || 'N/A'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Poppins', sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; background: white; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #e2e8f0; }
          .logo { width: 100px; height: 100px; margin: 0 auto 15px; }
          .logo img { width: 100%; height: 100%; object-fit: contain; }
          .hospital-name { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
          .hospital-info { font-size: 12px; color: #64748b; line-height: 1.6; }
          .hospital-phone { color: #2563eb; font-weight: 600; }
          .receipt-title { background: linear-gradient(to right, #2563eb, #10b981); color: white; padding: 12px; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 2px; margin-bottom: 25px; border-radius: 8px; }
          .invoice-details { background: #f8fafc; padding: 20px; margin-bottom: 25px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .detail-item { text-align: center; }
          .detail-label { font-size: 11px; color: #64748b; margin-bottom: 5px; text-transform: uppercase; }
          .detail-value { font-size: 14px; font-weight: 600; color: #1e293b; }
          .invoice-number { color: #2563eb; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          thead { background: #f1f5f9; }
          th { padding: 12px 8px; text-align: center; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
          th:first-child { text-align: left; }
          td { padding: 12px 8px; text-align: center; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
          td:first-child { text-align: left; font-weight: 500; }
          .item-total { color: #10b981; font-weight: 600; }
          .totals-section { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .total-row.discount { color: #f97316; }
          .total-row.final { border-top: 2px solid #cbd5e1; padding-top: 12px; margin-top: 8px; }
          .total-label { font-weight: 600; }
          .total-value { font-weight: 600; }
          .final .total-label { font-size: 18px; color: #1e293b; }
          .final .total-value { font-size: 20px; color: #10b981; }
          .footer { text-align: center; padding-top: 25px; border-top: 2px dashed #cbd5e1; }
          .thank-you { font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 15px; }
          .powered-by { font-size: 11px; color: #94a3b8; font-style: italic; }
          .powered-by strong { color: #2563eb; }
          .meta { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 10px; }
          .meta td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
          .meta tr:last-child td { border-bottom: none; }
          .meta td.l { color: #64748b; }
          .meta td.r { text-align: right; font-weight: 600; color: #1e293b; }
          .items { table-layout: fixed; }
          .items th, .items td { padding: 8px 6px; font-size: 12px; }
          .items th:first-child, .items td:first-child { text-align: left; }
          .items th:nth-child(1), .items td:nth-child(1) { width: 46%; }
          .items th:nth-child(2), .items td:nth-child(2) { width: 12%; text-align: center; }
          .items th:nth-child(3), .items td:nth-child(3) { width: 20%; text-align: right; }
          .items th:nth-child(4), .items td:nth-child(4) { width: 22%; text-align: right; }
          .items td:first-child { white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
          .totals { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .totals td { padding: 6px 8px; font-size: 12px; }
          .totals td.l { color: #334155; }
          .totals td.r { text-align: right; font-weight: 600; }
          .totals tr.sep td { border-top: 2px solid #cbd5e1; padding-top: 8px; }
          @media print {
            @page { size: 80mm auto; margin: 5mm; }
            body { padding: 0; width: 70mm; margin: 0 auto; }
            .header { margin-bottom: 10px; }
            .logo { width: 60px; height: 60px; }
            .hospital-name { font-size: 16px; }
            .receipt-title { padding: 6px; font-size: 14px; }
            .invoice-details { padding: 8px; }
            .detail-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
            th, td { padding: 6px 4px; font-size: 11px; }
            .meta td { padding: 4px 6px; font-size: 11px; }
            .items th, .items td { padding: 6px 4px; font-size: 11px; }
            .totals td { padding: 4px 6px; font-size: 11px; }
            .totals-section { padding: 8px; }
            .final .total-label { font-size: 14px; }
            .final .total-value { font-size: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            ${hospitalSettings?.companyLogo 
              ? `<img src="${hospitalSettings.companyLogo}" alt="Hospital Logo" />`
              : `<div style="width: 80px; height: 80px; margin: 0 auto; background: linear-gradient(to bottom right, #10b981, #2563eb); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 700;">AH</div>`
            }
          </div>
          <div class="hospital-name">Pet Matrix</div>
          <div class="hospital-info">
            ${hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi'}<br>
            <span class="hospital-phone">Phone: ${hospitalSettings?.phone || '+92-21-1234567'}</span>
          </div>
        </div>
        <div class="receipt-title">SALES RECEIPT</div>
        <div class="invoice-details">
          <table class="meta">
            <tbody>
              <tr><td class="l">Customer ID</td><td class="r">${lastSale?.customerId || '-'}</td></tr>
              <tr><td class="l">Date</td><td class="r">${new Date(lastSale?.createdAt).toLocaleString()}</td></tr>
              <tr><td class="l">Customer</td><td class="r">${lastSale?.customerName || 'Walk-in'}</td></tr>
              <tr><td class="l">Phone</td><td class="r">${lastSale?.customerContact || '-'}</td></tr>
            </tbody>
          </table>
        </div>
        <table class="items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${lastSale?.items.map((item, idx) => {
              const share = shares[idx] || 0;
              const qty = Math.max(1, Number(item.quantity||1));
              const rate = Number(item.unitPrice||0) + (share/qty);
              const tot = Number(item.totalPrice||0) + share;
              return `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.quantity}</td>
                  <td>Rs${rate.toFixed(2)}</td>
                  <td class="item-total">Rs${tot.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <table class="totals">
          <tbody>
            <tr><td class="l">Subtotal:</td><td class="r">Rs${(Number(lastSale?.subtotal||0) + Number(lastSale?.paymentCharge||0)).toLocaleString()}</td></tr>
            ${lastSale?.discount > 0 ? `
              <tr><td class="l" style="color:#f97316">Discount:</td><td class="r" style="color:#f97316">-Rs${discountCurrency.toLocaleString()}</td></tr>
            ` : ''}
            ${lastSale?.previousDue > 0 ? `
              <tr><td class="l">Previous Receivable:</td><td class="r">Rs${lastSale.previousDue.toLocaleString()}</td></tr>
            ` : ''}
            ${lastSale?.receivedAmount >= 0 ? `
              <tr><td class="l">Received (${lastSale.paymentMethod}):</td><td class="r">Rs${(lastSale.receivedAmount||0).toLocaleString()}</td></tr>
            ` : ''}
            <tr class="sep"><td class="l">Total:</td><td class="r">Rs${lastSale?.totalAmount.toLocaleString()}</td></tr>
            ${lastSale?.balanceDue > 0 ? `
              <tr><td class="l">Balance Due:</td><td class="r">Rs${lastSale.balanceDue.toLocaleString()}</td></tr>
            ` : ''}
          </tbody>
        </table>
        <div class="footer">
          <div class="thank-you">Thank you for your purchase!</div>
          <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">No return or exchange without receipt. Goods once sold will not be taken back.</div>
          <div class="powered-by">Powered by <strong>MindSpire</strong></div>
        </div>
      </body>
      </html>
    `;
    
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Point of Sale (Reception)</h1>
          <p className="text-slate-500 mt-1">Same inventory as Shop - Sell products to customers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiGrid className="w-4 h-4" /> Grid View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiList className="w-4 h-4" /> List View
          </button>
          <button
            onClick={() => setHideInventory(!hideInventory)}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
              hideInventory ? 'bg-slate-700 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <FiEyeOff className="w-4 h-4" /> Hide Inventory
          </button>
          <button onClick={clearCart} className="px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-md transition-all">
            <FiTrash2 className="w-4 h-4" /> Clear Cart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search product name or scan barcode..."
                value={searchQuery}
                onChange={(e) => { const v = e.target.value; setSearchQuery(v); scheduleAutoAddByBarcode(v); }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === 'Tab' || e.key === 'NumpadEnter')) {
                    const exact = findByBarcode(searchQuery);
                    if (exact) { e.preventDefault(); addToCart(exact); setSearchQuery(''); return; }
                    if (searchProducts.length > 0) { e.preventDefault(); addToCart(searchProducts[0]); setSearchQuery(''); }
                  }
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                autoFocus
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Customer ID</label>
                <input
                  type="text"
                  value={customerInfo.customerId}
                  onChange={async (e) => {
                    const v = e.target.value.trim();
                    setCustomerInfo({ ...customerInfo, customerId: v });
                    if (v) {
                      const due = (allSales||[]).filter(s => (s.customerId||'').toLowerCase() === v.toLowerCase()).reduce((sum, s) => sum + Math.max(0, (s.balanceDue||0)), 0);
                      setPreviousDue(due);
                    } else { setPreviousDue(0); }
                  }}
                  placeholder="Enter or scan customer ID"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    const id = `CUS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;
                    setCustomerInfo(prev => ({ ...prev, customerId: id }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >Generate ID</button>
              </div>
              <div className="flex items-end">
                <div className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <div className="text-slate-500">Receivable</div>
                  <div className="font-semibold text-orange-600">PKR {previousDue.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          {!hideInventory && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(searchQuery ? searchProducts : products).map(product => (
                    <div key={product._id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-slate-800 text-base mb-1">{product.itemName}</h3>
                      <p className="text-sm text-slate-500 mb-3">Stock: {product.quantity}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500">PKR</span>
                          <span className="text-lg font-bold text-blue-600">{product.salePrice}</span>
                        </div>
                        <button onClick={() => addToCart(product)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1 font-medium">
                          <FiPlus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(searchQuery ? searchProducts : products).map(product => (
                    <div key={product._id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div>
                        <h3 className="font-medium text-slate-800">{product.itemName}</h3>
                        <p className="text-sm text-slate-500">Stock: {product.quantity} | PKR {product.salePrice}</p>
                      </div>
                      <button onClick={() => addToCart(product)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1">
                        <FiPlus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg"><FiShoppingCart className="w-6 h-6 text-blue-600" /></div>
            <div><h2 className="text-xl font-bold text-slate-800">Cart</h2><p className="text-sm text-slate-500">{cart.length} items</p></div>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FiShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm mt-1">Add products from inventory</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800 truncate">{item.itemName}</h4>
                      <p className="text-sm text-slate-500">PKR {item.salePrice} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 text-slate-400 hover:text-slate-600"><FiMinus className="w-4 h-4" /></button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 text-slate-400 hover:text-slate-600"><FiPlus className="w-4 h-4" /></button>
                      <button onClick={() => removeFromCart(item.productId)} className="p-1 text-red-400 hover:text-red-600 ml-2"><FiTrash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal:</span><span className="font-medium">PKR {subtotal.toLocaleString()}</span></div>
                {discount > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">Discount ({discount}%):</span><span className="font-medium text-orange-600">-PKR {discountAmount.toLocaleString()}</span></div>)}
                {paymentCharge > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">Payment Charge:</span><span className="font-medium">PKR {paymentCharge.toLocaleString()}</span></div>)}
                {previousDue > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">Previous Receivable:</span><span className="font-medium text-orange-600">PKR {previousDue.toLocaleString()}</span></div>)}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span className="text-slate-800">Total:</span>
                  <span className="text-blue-600">PKR {payableTotal.toLocaleString()}</span>
                </div>
              </div>

              <button onClick={() => setShowPaymentModal(true)} className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <FiShoppingCart className="w-5 h-5" /> Checkout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 text-slate-400 hover:text-slate-600"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>JazzCash</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Received Amount (PKR)</label>
                <input type="number" value={receivedAmount} onChange={(e) => { setReceivedAmount(e.target.value); setReceivedTouched(true); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Enter amount" />
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-1"><span>Total:</span><span>PKR {payableTotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm mb-1"><span>Received:</span><span>PKR {(Number(receivedAmount) || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg border-t border-slate-200 pt-2 mt-2">
                  <span>Balance:</span>
                  <span className={payableTotal - (Number(receivedAmount) || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                    PKR {Math.max(0, payableTotal - (Number(receivedAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <button onClick={handleCheckout} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all">
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">Receipt - {lastSale.invoiceNumber}</h3>
                <button onClick={() => setShowReceipt(false)} className="p-2 text-slate-400 hover:text-slate-600"><FiX className="w-5 h-5" /></button>
              </div>
              <div className="border-t border-b border-slate-200 py-4 my-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500">Customer:</span> {lastSale.customerName || 'Walk-in'}</div>
                  <div><span className="text-slate-500">Date:</span> {new Date(lastSale.createdAt).toLocaleString()}</div>
                  <div><span className="text-slate-500">Payment:</span> {lastSale.paymentMethod}</div>
                  <div><span className="text-slate-500">Total:</span> PKR {lastSale.totalAmount?.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={printReceipt} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  <FiPrinter className="w-5 h-5" /> Print Receipt
                </button>
                <button onClick={() => setShowReceipt(false)} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
