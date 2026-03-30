import React, { useState, useEffect, useRef } from 'react';
import { FiCalendar, FiDollarSign, FiShoppingCart, FiTrendingUp, FiDownload, FiPrinter, FiEye } from 'react-icons/fi';
import { salesAPI, settingsAPI } from '../../services/api';

export default function SalesReports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalItems: 0
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [previewSale, setPreviewSale] = useState(null);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const printFrameRef = useRef(null);

  // Build thermal receipt HTML identical to Pet Shop POS
  const buildThermalReceiptHTML = (sale) => {
    const baseSubtotal = Number(sale?.subtotal || 0);
    const extraCharge = Number(sale?.paymentCharge || 0);
    const shares = (sale?.items || []).map((it, i, arr) => {
      if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
      if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
      const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
      return Number((extraCharge - prev).toFixed(2));
    });
    const discountCurrency = ((Number(sale?.subtotal||0) * Number(sale?.discount||0)) / 100);
    const headerName = hospitalSettings?.companyName || 'Pet Matrix';
    const headerAddr = hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi';
    const headerPhone = hospitalSettings?.phone || '+92-21-1234567';

    return `<!DOCTYPE html>
      <html>
      <head>
        <title>Reprint - ${sale?.invoiceNumber || 'N/A'}</title>
        <meta charset="utf-8" />
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Poppins', Arial, sans-serif; }
          .header { text-align:center; margin-bottom:10px; }
          .hospital-name { font-size:16px; font-weight:700; color:#1e293b; }
          .hospital-info { font-size:11px; color:#64748b; }
          .receipt-title { text-align:center; padding:6px; font-size:14px; font-weight:700; color:#fff; background:linear-gradient(to right,#2563eb,#10b981); border-radius:8px; margin:6px 0; }
          .meta { width:100%; border-collapse:collapse; border:1px solid #e2e8f0; margin-bottom:8px; }
          .meta td { padding:6px 8px; font-size:12px; border-bottom:1px solid #e2e8f0; }
          .meta tr:last-child td { border-bottom:none; }
          .meta td.l { color:#64748b; }
          .meta td.r { text-align:right; font-weight:600; color:#1e293b; }
          .items { width:100%; table-layout:fixed; border-collapse:collapse; }
          .items th,.items td { padding:6px 4px; font-size:12px; border-bottom:1px solid #e2e8f0; }
          .items th:first-child,.items td:first-child { text-align:left; }
          .items th:nth-child(1),.items td:nth-child(1) { width:46%; }
          .items th:nth-child(2),.items td:nth-child(2) { width:12%; text-align:center; }
          .items th:nth-child(3),.items td:nth-child(3) { width:20%; text-align:right; }
          .items th:nth-child(4),.items td:nth-child(4) { width:22%; text-align:right; }
          .items td:first-child { white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
          thead { background:#f1f5f9; }
          th { font-weight:700; color:#475569; text-align:center; }
          .totals { width:100%; border-collapse:collapse; margin-top:6px; }
          .totals td { padding:6px 8px; font-size:12px; }
          .totals td.l { color:#334155; }
          .totals td.r { text-align:right; font-weight:600; }
          .totals tr.sep td { border-top:2px solid #cbd5e1; padding-top:8px; }
          @page { size:80mm auto; margin:5mm; }
          body { padding:0; width:70mm; margin:0 auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hospital-name">${headerName}</div>
          <div class="hospital-info">${headerAddr}<br/>Phone: ${headerPhone}</div>
        </div>
        <div class="receipt-title">SALES RECEIPT</div>
        <table class="meta"><tbody>
          <tr><td class="l">Customer ID</td><td class="r">${sale?.customerId || '-'}</td></tr>
          <tr><td class="l">Date</td><td class="r">${new Date(sale?.createdAt).toLocaleString()}</td></tr>
          <tr><td class="l">Customer</td><td class="r">${sale?.customerName || 'Walk-in'}</td></tr>
          <tr><td class="l">Phone</td><td class="r">${sale?.customerContact || '-'}</td></tr>
        </tbody></table>
        <table class="items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
          ${(sale?.items||[]).map((item,idx)=>{
            const share = shares[idx] || 0; const qty = Math.max(1, Number(item.quantity||1));
            const rate = Number(item.unitPrice||0) + (share/qty); const tot = Number(item.totalPrice||0) + share;
            return `<tr><td>${item.itemName}</td><td>${item.quantity}</td><td>Rs${rate.toFixed(2)}</td><td>Rs${tot.toFixed(2)}</td></tr>`;
          }).join('')}
        </tbody></table>
        <table class="totals"><tbody>
          <tr><td class="l">Subtotal:</td><td class="r">Rs${(Number(sale?.subtotal||0)+Number(sale?.paymentCharge||0)).toLocaleString()}</td></tr>
          ${sale?.discount>0 ? `<tr><td class="l" style="color:#f97316">Discount:</td><td class="r" style="color:#f97316">-Rs${discountCurrency.toLocaleString()}</td></tr>` : ''}
          ${sale?.previousDue>0 ? `<tr><td class="l">Previous Receivable:</td><td class="r">Rs${sale.previousDue.toLocaleString()}</td></tr>` : ''}
          ${(typeof sale?.receivedAmount==='number') ? `<tr><td class="l">Received (${sale.paymentMethod}):</td><td class="r">Rs${(sale.receivedAmount||0).toLocaleString()}</td></tr>` : ''}
          <tr class="sep"><td class="l">Total:</td><td class="r">Rs${(sale?.totalAmount||0).toLocaleString()}</td></tr>
          ${sale?.balanceDue>0 ? `<tr><td class="l">Balance Due:</td><td class="r">Rs${sale.balanceDue.toLocaleString()}</td></tr>` : ''}
        </tbody></table>
        <div style="text-align:center; font-size:11px; color:#94a3b8; margin-top:8px;">No return or exchange without receipt. Goods once sold will not be taken back.</div>
        <div style="text-align:center; font-size:11px; color:#94a3b8;">Powered by <strong style="color:#2563eb;">MindSpire</strong></div>
      </body>
      </html>`;
  };

  const printSaleReceipt = (sale) => {
    try {
      const html = buildThermalReceiptHTML(sale);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(()=>{ try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch {} }, 200);
      // auto-close the preview dialog now
      try { setPreviewSale(null); } catch {}
      setTimeout(()=>{ try { document.body.removeChild(iframe); } catch {} }, 1500);
    } catch {}
  };

  useEffect(() => {
    fetchSales();
    loadSettings();
  }, [dateRange]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await salesAPI.getByDateRange(dateRange.startDate, dateRange.endDate);
      const salesData = response.data || [];
      setSales(salesData);
      setFilteredSales(applySearch(salesData, search));
      calculateStats(salesData);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const resp = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(resp.data || null);
    } catch {}
  };

  const applySearch = (data, q) => {
    if (!q) return data;
    const s = q.toLowerCase();
    return data.filter(x =>
      (x.invoiceNumber||'').toLowerCase().includes(s) ||
      (x.customerId||'').toLowerCase().includes(s) ||
      (x.customerName||'').toLowerCase().includes(s)
    );
  };

  const calculateStats = (salesData) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalItems = salesData.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    setStats({
      totalSales,
      totalRevenue,
      averageOrderValue,
      totalItems
    });
  };

  const exportToCSV = () => {
    const headers = ['Invoice', 'Date', 'Customer', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method'];
    const rows = filteredSales.map(sale => [
      sale.invoiceNumber,
      new Date(sale.createdAt).toLocaleString(),
      sale.customerName || 'Walk-in',
      sale.items?.length || 0,
      sale.subtotal,
      sale.discount,
      sale.totalAmount,
      sale.paymentMethod
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Sales Reports
          </h1>
          <p className="text-slate-500 mt-1">Analyze sales performance and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search invoice / customer ID / name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilteredSales(applySearch(sales, e.target.value)); }}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg"
          >
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-xl ring-1 ring-blue-200/50 border border-blue-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button
            onClick={fetchSales}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-xl ring-1 ring-blue-200/50 border border-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Total Sales</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalSales}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <FiShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-xl ring-1 ring-blue-200/50 border border-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Total Revenue</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">Rs{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <FiDollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-xl ring-1 ring-blue-200/50 border border-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Avg Order Value</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">Rs{Math.round(stats.averageOrderValue).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <FiTrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-xl ring-1 ring-blue-200/50 border border-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Items Sold</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalItems}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Sales Transactions</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No sales found for the selected date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subtotal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receivable</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <button className="font-medium text-blue-600 hover:underline" onClick={()=>setPreviewSale(sale)}>{sale.invoiceNumber}</button>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {sale.customerId ? (
                        <button className="text-blue-600 hover:underline" onClick={()=>setPreviewSale(sale)}>
                          {sale.customerId}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>
                        <p>{new Date(sale.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{sale.customerName || 'Walk-in'}</p>
                        {sale.customerContact && (
                          <p className="text-sm text-slate-500">{sale.customerContact}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{sale.items?.length || 0}</td>
                    <td className="px-6 py-4 text-slate-600">Rs{sale.subtotal.toLocaleString()}</td>
                    <td className="px-6 py-4 text-orange-600">
                      {sale.discount > 0 ? `-Rs${sale.discount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-600">Rs{sale.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sale.balanceDue > 0 ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Rs{sale.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Paid</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button title="View" onClick={()=>setPreviewSale(sale)} className="p-2 border rounded-lg hover:bg-slate-50"><FiEye /></button>
                        <button title="Reprint" onClick={()=> printSaleReceipt(sale)} className="p-2 border rounded-lg hover:bg-slate-50"><FiPrinter /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Selling Products */}
      {filteredSales.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Selling Products</h2>
          <div className="space-y-3">
            {(() => {
              const productSales = {};
              filteredSales.forEach(sale => {
                sale.items?.forEach(item => {
                  if (!productSales[item.itemName]) {
                    productSales[item.itemName] = { quantity: 0, revenue: 0 };
                  }
                  productSales[item.itemName].quantity += item.quantity;
                  productSales[item.itemName].revenue += item.totalPrice;
                });
              });

              return Object.entries(productSales)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 5)
                .map(([name, data], idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">{name}</p>
                      <p className="text-sm text-slate-500">Sold: {data.quantity} units</p>
                    </div>
                    <p className="font-semibold text-green-600">Rs{data.revenue.toLocaleString()}</p>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}
      {/* Preview/Print Modal */}
      {previewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Invoice {previewSale.invoiceNumber}</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>printSaleReceipt(previewSale)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-2"><FiPrinter/> Print</button>
                <button onClick={()=>setPreviewSale(null)} className="px-3 py-1.5 border rounded-lg">Close</button>
              </div>
            </div>
            <div className="p-4 text-sm">
              <div className="font-semibold mb-2">{hospitalSettings?.companyName || 'Pet Matrix'}</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>Customer ID: <strong>{previewSale.customerId || '-'}</strong></div>
                <div>Date: {new Date(previewSale.createdAt).toLocaleString()}</div>
                <div>Customer: {previewSale.customerName || 'Walk-in'}</div>
                <div>Phone: {previewSale.customerContact || '-'}</div>
                <div>Payment: {previewSale.paymentMethod}</div>
              </div>
              <div className="border rounded">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr><th className="text-left p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Price</th><th className="p-2">Total</th></tr></thead>
                  <tbody className="divide-y">{previewSale.items.map((i,idx)=>(<tr key={idx}><td className="p-2">{i.itemName}</td><td className="p-2 text-center">{i.quantity}</td><td className="p-2 text-center">Rs{i.unitPrice.toLocaleString()}</td><td className="p-2 text-right">Rs{i.totalPrice.toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="mt-2 text-right space-y-1">
                <div>Subtotal: <strong>Rs{(Number(previewSale.subtotal||0) + Number(previewSale.paymentCharge||0)).toLocaleString()}</strong></div>
                {previewSale.discount>0 && <div>Discount: <strong>-Rs{(((Number(previewSale.subtotal||0) * Number(previewSale.discount||0))/100)||0).toLocaleString()}</strong></div>}
                {previewSale.previousDue>0 && <div>Previous Receivable: <strong>Rs{previewSale.previousDue.toLocaleString()}</strong></div>}
                {typeof previewSale.receivedAmount==='number' && <div>Received ({previewSale.paymentMethod}): <strong>Rs{(previewSale.receivedAmount||0).toLocaleString()}</strong></div>}
                <div className="text-lg">Total: <strong>Rs{previewSale.totalAmount.toLocaleString()}</strong></div>
                {previewSale.balanceDue>0 && <div>Balance Due: <strong>Rs{previewSale.balanceDue.toLocaleString()}</strong></div>}
              </div>
            </div>
            <iframe ref={printFrameRef} style={{display:'none'}} title="print" />
          </div>
        </div>
      )}
    </div>
  );
}
