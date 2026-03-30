import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingCart, FiAlertTriangle, FiClock, FiDollarSign, FiTrendingUp, FiFileText, FiCalendar } from 'react-icons/fi';
import { MdLocalPharmacy } from 'react-icons/md';
import { pharmacyMedicinesAPI, pharmacySalesAPI, pharmacyReportsAPI } from '../../services/api';
import ExpenseCard from '../../components/ExpenseCard';
import DateRangePicker from '../../components/DateRangePicker';

export default function PharmacyDashboard() {
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStock: 0,
    expiring: 0,
    expired: 0,
    todaySales: 0,
    todayRevenue: 0,
    inventoryValue: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange.fromDate, dateRange.toDate]);

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr).toISOString().slice(0,10);
    return date >= dateRange.fromDate && date <= dateRange.toDate;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch data with individual error handling
      let totalMedicines = 0, lowStock = 0, expiring = 0, expired = 0;
      let todaySales = 0, todayRevenue = 0, inventoryValue = 0;
      let sales = [];

      // Get medicines data
      try {
        const medicinesRes = await pharmacyMedicinesAPI.getAll();
        const medicines = medicinesRes.data || [];
        totalMedicines = medicines.length;
        
        // Calculate inventory stats manually
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        medicines.forEach(med => {
          // Low stock check
          if (med.quantity <= (med.lowStockThreshold || 10)) {
            lowStock++;
          }
          
          // Expiry checks
          const expiryDate = new Date(med.expiryDate);
          if (expiryDate < today) {
            expired++;
          } else if (expiryDate <= thirtyDaysFromNow) {
            expiring++;
          }
          
        });
      } catch (error) {
        console.error('Error fetching medicines:', error);
      }

      // Get sales data
      try {
        const salesRes = await pharmacySalesAPI.getAll();
        sales = salesRes.data || [];
        setRecentSales(sales.slice(0, 5));
        
        // Filter sales by date range
        const filteredSales = sales.filter(sale => isDateInRange(sale.createdAt));
        setRecentSales(filteredSales.slice(0, 5));
        
        todaySales = filteredSales.length;
        todayRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        inventoryValue = filteredSales.reduce((sum, sale) => {
          const saleValue = (sale.items || []).reduce((itemSum, item) => {
            const qty = Number(item.quantity) || 0;
            const unitCost =
              Number(item.purchasePrice ?? item.costPrice ?? item.price ?? (qty ? (item.totalPrice || 0) / qty : 0)) || 0;
            return itemSum + qty * unitCost;
          }, 0);
          return sum + saleValue;
        }, 0);
      } catch (error) {
        console.error('Error fetching sales:', error);
      }

      setStats({
        totalMedicines,
        lowStock,
        expiring,
        expired,
        todaySales,
        todayRevenue,
        inventoryValue
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    { name: 'Medicine Inventory', path: '/pharmacy/medicines', icon: FiPackage, color: 'purple', description: 'Manage medicines & stock' },
    { name: 'Point of Sale', path: '/pharmacy/pos', icon: FiShoppingCart, color: 'blue', description: 'Sell medicines' },
    { name: 'Sales Reports', path: '/pharmacy/reports', icon: FiFileText, color: 'green', description: 'View sales analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[hsl(var(--pm-primary))] mb-2">
          Pharmacy Dashboard
        </h1>
        <p className="text-slate-600 text-lg">Manage medicines, sales, and inventory</p>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[hsl(var(--pm-primary))] rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[hsl(var(--pm-primary))]">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--pm-primary))]"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Medicines</p>
                  <p className="text-3xl font-bold mt-1 text-[hsl(var(--pm-primary))]">{stats.totalMedicines}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--pm-primary))] text-white flex items-center justify-center">
                  <MdLocalPharmacy className="w-7 h-7" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Low Stock</p>
                  <p className="text-3xl font-bold mt-1 text-[hsl(var(--pm-primary))]">{stats.lowStock}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--pm-primary))] text-white flex items-center justify-center">
                  <FiAlertTriangle className="w-7 h-7" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[hsl(var(--pm-surface))] shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Expiring Soon</p>
                  <p className="text-3xl font-bold mt-1 text-[hsl(var(--pm-primary))]">{stats.expiring}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--pm-primary))] text-white flex items-center justify-center">
                  <FiClock className="w-7 h-7" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-red-50 shadow-sm ring-1 ring-red-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Expired</p>
                  <p className="text-3xl font-bold mt-1 text-red-700">{stats.expired}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center">
                  <FiPackage className="w-7 h-7" />
                </div>
              </div>
            </div>
          </div>

          {/* Today's Performance */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[hsl(var(--pm-surface))] rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[hsl(var(--pm-primary-soft))] border border-[hsl(var(--pm-border))] rounded-lg flex items-center justify-center">
                  <FiShoppingCart className="w-5 h-5 text-[hsl(var(--pm-primary))]" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Today's Sales</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.todaySales}</p>
                </div>
              </div>
            </div>

            <div className="bg-[hsl(var(--pm-surface))] rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[hsl(var(--pm-primary-soft))] border border-[hsl(var(--pm-border))] rounded-lg flex items-center justify-center">
                  <FiDollarSign className="w-5 h-5 text-[hsl(var(--pm-primary))]" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">Rs{stats.todayRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-[hsl(var(--pm-surface))] rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[hsl(var(--pm-primary-soft))] border border-[hsl(var(--pm-border))] rounded-lg flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-[hsl(var(--pm-primary))]" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Inventory Value</p>
                  <p className="text-2xl font-bold text-slate-900">Rs{stats.inventoryValue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <ExpenseCard 
              portal="pharmacy" 
              title="Pharmacy" 
              color="blue" 
            />
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="bg-[hsl(var(--pm-surface))] rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))] p-6 hover:shadow-sm transition-all hover:-translate-y-1 group"
                >
                  <div className="w-12 h-12 bg-[hsl(var(--pm-primary))] rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <link.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">{link.name}</h3>
                  <p className="text-sm text-slate-600">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-[hsl(var(--pm-surface))] rounded-xl shadow-sm ring-1 ring-[hsl(var(--pm-border))] overflow-hidden">
            <div className="px-6 py-4 border-b border-[hsl(var(--pm-border))]">
              <h2 className="text-lg font-semibold text-slate-800">Recent Sales</h2>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No sales yet today</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-[hsl(var(--pm-border))]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentSales.map((sale) => (
                      <tr key={sale._id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-[hsl(var(--pm-primary))]">{sale.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{sale.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-slate-600">{sale.items?.length || 0}</td>
                        <td className="px-6 py-4 font-semibold text-[hsl(var(--pm-primary))]">Rs{sale.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(sale.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alerts Section */}
          {(stats.lowStock > 0 || stats.expiring > 0 || stats.expired > 0) && (
            <div className="bg-[hsl(var(--pm-primary-soft))] border border-[hsl(var(--pm-border))] rounded-xl p-6">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="w-6 h-6 text-[hsl(var(--pm-primary))] flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Attention Required</h3>
                  <div className="space-y-1 text-sm text-slate-700">
                    {stats.lowStock > 0 && (
                      <p>• {stats.lowStock} medicine(s) are running low on stock</p>
                    )}
                    {stats.expiring > 0 && (
                      <p>• {stats.expiring} medicine(s) are expiring within 30 days</p>
                    )}
                    {stats.expired > 0 && (
                      <p className="text-red-700">• {stats.expired} medicine(s) have expired</p>
                    )}
                  </div>
                  <Link
                    to="/pharmacy/medicines"
                    className="inline-block mt-3 px-4 py-2 bg-[hsl(var(--pm-primary))] hover:bg-[hsl(var(--pm-primary-hover))] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    View Inventory
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
