import React, { useState, useEffect } from 'react'
import { FiTrendingDown, FiCalendar, FiDollarSign } from 'react-icons/fi'
import { expensesAPI } from '../services/api'

export default function ExpenseCard({ portal, title, color = 'red' }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadExpenses()
  }, [portal])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try API first
      try {
        const response = await expensesAPI.getByPortal(portal)
        if (response && response.data) {
          setExpenses(response.data)
          return
        }
      } catch (apiError) {
        console.log(`API not available for ${portal} expenses, using localStorage`)
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('admin_expenses')
      if (stored) {
        const allExpenses = JSON.parse(stored)
        setExpenses(allExpenses.filter(e => e.portal === portal))
      } else {
        setExpenses([])
      }
    } catch (err) {
      console.error(`Error loading ${portal} expenses:`, err)
      setError('Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate today's expenses
  const today = new Date().toISOString().slice(0, 10)
  const todayExpenses = expenses.filter(exp => exp.date === today)
  const todayTotal = todayExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  // Calculate this month's expenses
  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const monthExpenses = expenses.filter(exp => exp.date?.startsWith(thisMonth))
  const monthTotal = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  // Get recent expenses (last 3)
  const recentExpenses = expenses
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .slice(0, 3)

  const colorMap = {
    red: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' },
    orange: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' },
    blue: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' },
    purple: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' },
    green: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' },
    slate: { text: 'text-[hsl(var(--pm-primary))]', icon: 'text-[hsl(var(--pm-primary))]' }
  }

  const colors = colorMap[color] || colorMap.red

  if (loading) {
    return (
      <div className="rounded-xl p-4 bg-[hsl(var(--pm-surface))] ring-1 ring-[hsl(var(--pm-border))] shadow-sm">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
          <div className="h-6 bg-gray-300 rounded w-16 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-24"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 bg-[hsl(var(--pm-surface))] ring-1 ring-[hsl(var(--pm-border))] shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiTrendingDown className={`w-5 h-5 ${colors.icon}`} />
          <span className={`font-semibold text-sm ${colors.text}`}>{title} Expenses</span>
        </div>
        {error && (
          <div className="text-xs text-red-500" title={error}>⚠</div>
        )}
      </div>

      {/* Today's Total */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-slate-900">
          Rs. {todayTotal.toLocaleString()}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <FiCalendar className="w-3 h-3" />
          Today ({todayExpenses.length} expenses)
        </div>
      </div>

      {/* Month Summary */}
      <div className="mb-3 pb-3 border-b border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">This Month</span>
          <span className="font-semibold text-slate-900">
            Rs. {monthTotal.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {monthExpenses.length} total expenses
        </div>
      </div>

      {/* Recent Expenses */}
      {recentExpenses.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-600 mb-2">Recent</div>
          <div className="space-y-1">
            {recentExpenses.map((expense, idx) => (
              <div key={expense.id || expense._id || idx} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-slate-700">
                    {expense.description || expense.category}
                  </div>
                  <div className="text-slate-500">
                    {new Date(expense.date || expense.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-semibold text-slate-900 ml-2">
                  Rs. {(expense.amount || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No expenses message */}
      {expenses.length === 0 && !loading && (
        <div className="text-center py-2">
          <FiDollarSign className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <div className="text-xs text-slate-500">No expenses recorded</div>
        </div>
      )}
    </div>
  )
}
