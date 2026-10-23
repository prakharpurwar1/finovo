import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Search, Bell, Activity, 
  ArrowUpRight, ArrowDownLeft, Sparkles, 
  ArrowRight, Tag, Users,
  TrendingDown, Receipt, Smartphone, AlertTriangle
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/currency.js';
import { getHourlySpendDistribution } from '../utils/date.js';
import { 
  PERIOD_FILTERS, 
  getPeriodBoundaries, 
  filterTransactionsByPeriod, 
  calculateCashFlowMetrics, 
  calculatePeriodComparison, 
  calculateBudgetHealth,
  getDailySpendingSeries 
} from '../utils/financialAnalytics.js';
import { isDemoItem } from '../data/demoFixtures.js';

const QuickAction = ({ icon: Icon, label, onClick, badgeCount }) => (
  <div className="flex flex-col items-center gap-2">
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="w-12 h-12 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-primary hover:text-brand-primary shadow-brand-sm transition-all relative cursor-pointer"
    >
      <Icon size={20} />
      {badgeCount > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-error rounded-full flex items-center justify-center text-[9px] font-bold text-white">
          {badgeCount}
        </div>
      )}
    </motion.button>
    <span className="text-[10px] font-semibold text-txt-secondary uppercase tracking-wider">{label}</span>
  </div>
);

const Dashboard = ({ 
  transactions = [], 
  userProfile, 
  onSelectTx, 
  onAdd, 
  onGoToHistory, 
  onCategorize, 
  onGoToSplits,
  onGoToAnalytics,
  onSimulateSMS 
}) => {
  // Period filter state: default is current month
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_FILTERS.THIS_MONTH);

  // Period boundaries calculation
  const boundaries = useMemo(() => {
    return getPeriodBoundaries(selectedPeriod);
  }, [selectedPeriod]);

  // Current period transactions
  const periodTransactions = useMemo(() => {
    return filterTransactionsByPeriod(transactions, {
      startDate: boundaries.startDate,
      endDate: boundaries.endDate,
      excludeDemo: false // Include user's own demo if triggered, but prioritize real data
    });
  }, [transactions, boundaries]);

  // Previous equivalent period transactions for comparison
  const prevPeriodTransactions = useMemo(() => {
    if (!boundaries.prevStartDate || !boundaries.prevEndDate) return [];
    return filterTransactionsByPeriod(transactions, {
      startDate: boundaries.prevStartDate,
      endDate: boundaries.prevEndDate,
      excludeDemo: false
    });
  }, [transactions, boundaries]);

  // Comparative financial metrics
  const comparison = useMemo(() => {
    return calculatePeriodComparison(periodTransactions, prevPeriodTransactions);
  }, [periodTransactions, prevPeriodTransactions]);

  const { current: metrics, expenseChangePercentage, incomeChangePercentage } = comparison;

  // Monthly Budget Analytics (evaluated against calendar month)
  const currentMonthBoundaries = useMemo(() => getPeriodBoundaries(PERIOD_FILTERS.THIS_MONTH), []);
  const currentMonthTransactions = useMemo(() => {
    return filterTransactionsByPeriod(transactions, {
      startDate: currentMonthBoundaries.startDate,
      endDate: currentMonthBoundaries.endDate
    });
  }, [transactions, currentMonthBoundaries]);

  const currentMonthExpense = useMemo(() => {
    return calculateCashFlowMetrics(currentMonthTransactions).totalExpense;
  }, [currentMonthTransactions]);

  const monthlyBudget = userProfile?.budgetLimit || 45000;
  const budgetHealth = useMemo(() => {
    return calculateBudgetHealth(currentMonthExpense, monthlyBudget);
  }, [currentMonthExpense, monthlyBudget]);

  // Chart data matching active period
  const chartData = useMemo(() => {
    if (selectedPeriod === PERIOD_FILTERS.TODAY) {
      const hourly = getHourlySpendDistribution(transactions, boundaries.startDate);
      return hourly.map(h => ({ label: h.time, amount: h.amount }));
    }
    if (selectedPeriod === PERIOD_FILTERS.THIS_WEEK) {
      const series = getDailySpendingSeries(periodTransactions, boundaries.startDate, boundaries.endDate);
      return series.map(s => ({ label: s.dayName, amount: s.amount }));
    }
    // This Month or All Time
    const start = boundaries.startDate || currentMonthBoundaries.startDate;
    const end = boundaries.endDate || currentMonthBoundaries.endDate;
    const series = getDailySpendingSeries(periodTransactions, start, end);
    return series.map(s => ({ label: s.label, amount: s.amount }));
  }, [selectedPeriod, boundaries, periodTransactions, transactions, currentMonthBoundaries]);

  const currentPeriodSpendTotal = useMemo(() => {
    return chartData.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [chartData]);

  const hasAnySpendInChart = currentPeriodSpendTotal > 0;

  // 4 most recent transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(`${b.date} ${b.time || '12:00 PM'}`) - new Date(`${a.date} ${a.time || '12:00 PM'}`))
      .slice(0, 4);
  }, [transactions]);

  const uncategorizedCount = useMemo(() => {
    return transactions.filter(tx => tx.category === 'Uncategorized').length;
  }, [transactions]);

  const isBrandNewUser = transactions.length === 0;

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Finovo</h2>
          <p className="text-txt-secondary text-[10px] font-bold uppercase tracking-wider mt-0.5">Track. Grow. Simplify.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onGoToHistory} 
            title="Search Transactions"
            className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer"
          >
            <Search size={18} />
          </button>
          <button 
            onClick={uncategorizedCount > 0 ? onCategorize : onGoToHistory}
            title={uncategorizedCount > 0 ? `${uncategorizedCount} transactions need review` : "Notifications"}
            className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all relative cursor-pointer"
          >
            <Bell size={18} />
            {uncategorizedCount > 0 && (
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-primary rounded-full ring-2 ring-bg-card" />
            )}
          </button>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-2xl shadow-brand-sm mb-6">
        {[
          { id: PERIOD_FILTERS.THIS_MONTH, label: 'This Month' },
          { id: PERIOD_FILTERS.THIS_WEEK, label: 'This Week' },
          { id: PERIOD_FILTERS.TODAY, label: 'Today' },
          { id: PERIOD_FILTERS.ALL, label: 'All Time' }
        ].map((tab) => {
          const isSelected = selectedPeriod === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedPeriod(tab.id)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                ${isSelected ? 'text-white' : 'text-txt-secondary hover:text-txt-primary'}`}
            >
              {isSelected && (
                <motion.div 
                  layoutId="activePeriodDashboardTab" 
                  className="absolute inset-0 bg-brand-primary rounded-xl shadow-brand-sm" 
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Balance / Net Cash Flow Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-brand-primary rounded-[20px] p-6 mb-6 text-white shadow-brand-md relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-1 opacity-80">
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Net Cash Flow ({boundaries.label})
              </span>
              <Activity size={16} />
            </div>
            <h3 className="text-3xl font-bold tracking-tight">
              {formatCurrency(metrics.netCashFlow, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-white/75 mt-0.5">
              Income minus expenses in {boundaries.label.toLowerCase()}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/15">
            <div className="flex items-center justify-between mb-1.5 opacity-90">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest">Monthly Budget Health</span>
                {budgetHealth.isExceeded && (
                  <span className="bg-brand-error text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase inline-flex items-center gap-0.5">
                    <AlertTriangle size={10} /> Over Budget
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">
                {budgetHealth.hasBudget ? `${budgetHealth.percentage}% used` : 'No budget set'}
              </span>
            </div>

            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, budgetHealth.percentage)}%` }}
                transition={{ duration: 1.0, ease: "circOut" }}
                className={`h-full rounded-full ${budgetHealth.isExceeded ? 'bg-brand-error' : budgetHealth.status === 'danger' ? 'bg-amber-400' : 'bg-white'}`}
              />
            </div>

            <p className="text-[10px] text-white/75 flex justify-between">
              <span>{formatCurrency(currentMonthExpense)} spent this month</span>
              <span>{budgetHealth.hasBudget ? `of ${formatCurrency(monthlyBudget)} limit` : 'Configure in Profile'}</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary 3-Card Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {/* Income Card */}
        <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 flex flex-col justify-between shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-txt-secondary uppercase tracking-wider">Income</span>
            <div className="w-6 h-6 rounded-lg bg-brand-success/10 text-brand-success flex items-center justify-center">
              <ArrowDownLeft size={13} />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold text-brand-success tracking-tight block">
              {formatCurrency(metrics.totalIncome)}
            </span>
            {boundaries.prevStartDate && comparison.previous.totalIncome > 0 && (
              <span className="text-[9px] font-semibold text-brand-success mt-0.5 block">
                {incomeChangePercentage >= 0 ? `+${incomeChangePercentage}%` : `${incomeChangePercentage}%`} vs {boundaries.prevLabel}
              </span>
            )}
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 flex flex-col justify-between shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-txt-secondary uppercase tracking-wider">Expenses</span>
            <div className="w-6 h-6 rounded-lg bg-brand-error/10 text-brand-error flex items-center justify-center">
              <ArrowUpRight size={13} />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold text-brand-error tracking-tight block">
              {formatCurrency(metrics.totalExpense)}
            </span>
            {boundaries.prevStartDate && comparison.previous.totalExpense > 0 && (
              <span className={`text-[9px] font-semibold mt-0.5 block ${expenseChangePercentage > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
                {expenseChangePercentage > 0 ? `+${expenseChangePercentage}%` : `${expenseChangePercentage}%`} vs {boundaries.prevLabel}
              </span>
            )}
          </div>
        </div>

        {/* Savings / Net Flow Card */}
        <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 flex flex-col justify-between shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-txt-secondary uppercase tracking-wider">Savings Rate</span>
            <div className="w-6 h-6 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Sparkles size={13} />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold text-brand-primary tracking-tight block">
              {metrics.savingsRate}%
            </span>
            <span className="text-[9px] font-medium text-txt-secondary mt-0.5 block">
              {formatCurrency(Math.max(0, metrics.netCashFlow))} saved
            </span>
          </div>
        </div>
      </div>

      {/* First-Time User Welcome Onboarding Guide Card */}
      {isBrandNewUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-primary/5 border border-brand-primary/15 rounded-[18px] p-5 mb-6 shadow-brand-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shrink-0 shadow-brand-sm">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-txt-primary">👋 Welcome to Finovo!</h4>
              <p className="text-xs text-txt-secondary mt-1 leading-relaxed">
                You're ready to take charge of your finances. Record your first expense to begin tracking cash flow and budget analytics.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-4">
                <button
                  onClick={onAdd}
                  className="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-brand-sm"
                >
                  <Plus size={14} /> Add First Expense
                </button>
                {onSimulateSMS && (
                  <button
                    onClick={onSimulateSMS}
                    className="px-3.5 py-2 bg-bg-card border border-brand-border text-txt-primary rounded-xl text-xs font-semibold hover:bg-bg-subtle active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Smartphone size={14} /> Import Demo Data
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Actions Grid */}
      <div className="flex items-center justify-between mb-8 px-2">
        <QuickAction icon={Plus} label="Add" onClick={onAdd} />
        <QuickAction icon={Tag} label="Review" onClick={onCategorize} badgeCount={uncategorizedCount} />
        <QuickAction icon={Users} label="Splits" onClick={onGoToSplits} />
        <QuickAction icon={Activity} label="Analytics" onClick={onGoToAnalytics} />
      </div>

      {/* Spending Trend Area Chart Card */}
      <div className="bg-bg-card border border-brand-border rounded-[20px] p-5 mb-6 shadow-brand-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider block">
              {boundaries.label} Spending Trend
            </span>
            <h4 className="text-base font-bold text-txt-primary">
              {formatCurrency(currentPeriodSpendTotal)} <span className="text-xs font-normal text-txt-secondary">recorded</span>
            </h4>
          </div>
          {hasAnySpendInChart && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-brand-success">
              <TrendingDown size={14} /> Active
            </div>
          )}
        </div>

        {hasAnySpendInChart ? (
          <div className="h-32 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-card)', 
                    borderColor: 'var(--color-border)',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontFamily: 'Inter, sans-serif',
                    color: 'var(--text-primary)'
                  }}
                  itemStyle={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(value) => [formatCurrency(value), 'Spend']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="var(--color-primary)" 
                  strokeWidth={2} 
                  fill="var(--color-primary)" 
                  fillOpacity={0.06} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center border-t border-brand-border/60 mt-3">
            <p className="text-xs text-txt-secondary font-medium">No spending activity recorded in {boundaries.label.toLowerCase()}.</p>
            <p className="text-[10px] text-txt-secondary/60 mt-0.5">Transactions added in this period will plot your trend automatically.</p>
          </div>
        )}
      </div>

      {/* Recent Activity List / Empty State */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Recent Activity</h3>
          {transactions.length > 0 && (
            <button onClick={onGoToHistory} className="text-xs font-bold text-brand-primary flex items-center gap-1 cursor-pointer">
              See All <ArrowRight size={14} />
            </button>
          )}
        </div>

        {recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((tx) => {
              const isDemo = isDemoItem(tx);
              return (
                <div 
                  key={tx.id} 
                  onClick={() => onSelectTx(tx)}
                  className="bg-bg-card border border-brand-border rounded-xl p-4 flex items-center justify-between hover:border-brand-primary/40 transition-all cursor-pointer shadow-brand-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/5 text-brand-primary border border-brand-border flex items-center justify-center font-bold text-sm">
                      {tx.category === 'Food' ? '🍔' : 
                       tx.category === 'Travel' ? '🚕' : 
                       tx.category === 'Shopping' ? '🛍️' : 
                       tx.category === 'Recharge' ? '📱' : 
                       tx.category === 'Medicine' ? '💊' : 
                       tx.category === 'Salary' ? '💰' : '💳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold text-txt-primary">{tx.merchant}</h4>
                        {isDemo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-warning/15 text-brand-warning border border-brand-warning/25 uppercase tracking-wider">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-txt-secondary font-medium">{tx.category} • {tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${tx.type === 'expense' ? 'text-txt-primary' : 'text-brand-success'}`}>
                      {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                    <span className="text-[10px] text-txt-secondary block font-medium uppercase tracking-wider">{tx.paymentMethod}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-bg-card border border-brand-border rounded-[18px] p-8 text-center shadow-brand-sm">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-3">
              <Receipt size={22} />
            </div>
            <h4 className="text-sm font-bold text-txt-primary">No transactions yet</h4>
            <p className="text-xs text-txt-secondary mt-1 max-w-[240px] mx-auto leading-relaxed">
              You haven't recorded any expenses or income yet.
            </p>
            <button
              onClick={onAdd}
              className="mt-4 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-brand-sm"
            >
              <Plus size={14} /> Add First Expense
            </button>
          </div>
        )}
      </div>

      <div className="h-20" />
    </div>
  );
};

export default Dashboard;
