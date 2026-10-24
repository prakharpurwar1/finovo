import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown,
  Activity, Plus,
  CheckCircle2, AlertCircle, AlertTriangle,
  ChevronRight, PieChart,
  ArrowUpRight, ArrowDownRight,
  Wallet, Sparkles, Target, BarChart3,
  Calendar, Layers, ShieldCheck
} from 'lucide-react';
import { 
  AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis
} from 'recharts';
import { formatCurrency } from '../utils/currency.js';
import { getHourlySpendDistribution } from '../utils/date.js';
import { 
  PERIOD_FILTERS, 
  getPeriodBoundaries, 
  filterTransactionsByPeriod, 
  calculateCashFlowMetrics, 
  calculateBudgetHealth,
  getCategorySpendingBreakdown, 
  getDailySpendingSeries 
} from '../utils/financialAnalytics.js';

const categoryEmojis = {
  Food: '🍔',
  Travel: '🚕',
  Shopping: '🛍️',
  Recharge: '📱',
  Medicine: '💊',
  Education: '📚',
  Entertainment: '🎬',
  Salary: '💰',
  Investments: '📈',
  Freelance: '💻',
  Refunds: '🔄',
  Others: '💳',
  Uncategorized: '🏷️'
};

const categoryColors = {
  Food: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Travel: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Shopping: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  Recharge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  Medicine: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  Education: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Entertainment: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Salary: 'bg-green-500/10 text-green-500 border-green-500/20',
  Investments: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  Freelance: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  Refunds: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  Others: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  Uncategorized: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
};

const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-card border border-brand-border p-2.5 rounded-xl shadow-brand-md text-xs">
        <p className="text-[10px] uppercase font-bold text-txt-secondary mb-1">{label}</p>
        <p className="font-bold text-brand-primary flex items-center gap-1">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const Insights = ({ transactions = [], userProfile, onAdd, onGoToProfile }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_FILTERS.THIS_MONTH);
  const [analyticsSubTab, setAnalyticsSubTab] = useState('trends'); // 'trends' | 'categories' | 'health'

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Period boundaries
  const boundaries = useMemo(() => {
    return getPeriodBoundaries(selectedPeriod);
  }, [selectedPeriod]);

  // Current period transactions
  const periodTransactions = useMemo(() => {
    return filterTransactionsByPeriod(transactions, {
      startDate: boundaries.startDate,
      endDate: boundaries.endDate,
      excludeDemo: false
    });
  }, [transactions, boundaries]);

  // Financial cash flow metrics
  const metrics = useMemo(() => {
    return calculateCashFlowMetrics(periodTransactions);
  }, [periodTransactions]);

  // Category intensity breakdown
  const categoryBreakdown = useMemo(() => {
    return getCategorySpendingBreakdown(periodTransactions);
  }, [periodTransactions]);

  const topCategory = useMemo(() => {
    return categoryBreakdown.length > 0 
      ? categoryBreakdown[0] 
      : { category: 'None', amount: 0, percentage: 0 };
  }, [categoryBreakdown]);

  // Monthly Budget Health
  const currentMonthBoundaries = useMemo(() => getPeriodBoundaries(PERIOD_FILTERS.THIS_MONTH), []);
  const currentMonthTransactions = useMemo(() => {
    return filterTransactionsByPeriod(transactions, {
      startDate: currentMonthBoundaries.startDate,
      endDate: currentMonthBoundaries.endDate
    });
  }, [transactions, currentMonthBoundaries]);

  const monthlyExpense = useMemo(() => {
    return calculateCashFlowMetrics(currentMonthTransactions).totalExpense;
  }, [currentMonthTransactions]);

  const budgetLimit = userProfile?.budgetLimit || 45000;
  const budgetHealth = useMemo(() => {
    return calculateBudgetHealth(monthlyExpense, budgetLimit);
  }, [monthlyExpense, budgetLimit]);

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
    const start = boundaries.startDate || currentMonthBoundaries.startDate;
    const end = boundaries.endDate || currentMonthBoundaries.endDate;
    const series = getDailySpendingSeries(periodTransactions, start, end);
    return series.map(s => ({ label: s.label, amount: s.amount }));
  }, [selectedPeriod, boundaries, periodTransactions, transactions, currentMonthBoundaries]);

  const hasData = transactions.length > 0;
  const hasSpendInPeriod = metrics.totalExpense > 0;

  // Highest spending day/point in current chart
  const peakSpend = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    let max = { label: '', amount: 0 };
    for (const item of chartData) {
      if (item.amount > max.amount) {
        max = item;
      }
    }
    return max.amount > 0 ? max : null;
  }, [chartData]);

  return (
    <div className="p-4 sm:p-6 pt-10 pb-20 bg-bg-app min-h-screen text-txt-primary">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
              <Activity size={18} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-txt-primary">Analytics</h2>
          </div>
          <p className="text-txt-secondary text-[11px] font-medium mt-0.5 ml-10">Real-time Financial Intelligence & Metrics</p>
        </div>
        <div className="px-2.5 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">{boundaries.label}</span>
        </div>
      </div>

      {/* Primary Period Filter Selector */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-2xl shadow-brand-sm mb-4">
        {[
          { id: PERIOD_FILTERS.THIS_MONTH, label: 'This Month' },
          { id: PERIOD_FILTERS.THIS_WEEK, label: 'This Week' },
          { id: PERIOD_FILTERS.TODAY, label: 'Today' },
          { id: PERIOD_FILTERS.ALL, label: 'All Time' }
        ].map((t) => {
          const isSelected = selectedPeriod === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedPeriod(t.id)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer text-center
                ${isSelected ? 'text-white' : 'text-txt-secondary hover:text-txt-primary'}`}
            >
              {isSelected && (
                <motion.div 
                  layoutId="activeInsightPeriodTab" 
                  className="absolute inset-0 bg-brand-primary rounded-xl shadow-brand-sm" 
                  transition={{ type: "spring", duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-brand-border mb-5 gap-2 px-1">
        {[
          { id: 'trends', label: 'Trends & Flow', icon: BarChart3 },
          { id: 'categories', label: 'Categories', icon: PieChart },
          { id: 'health', label: 'Budget Health', icon: Target }
        ].map((tab) => {
          const isActive = analyticsSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAnalyticsSubTab(tab.id)}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold transition-all relative cursor-pointer
                ${isActive ? 'text-brand-primary' : 'text-txt-secondary hover:text-txt-primary'}`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeAnalyticsSubTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {hasData ? (
        <AnimatePresence mode="wait">
          {/* TAB 1: TRENDS & CASH FLOW */}
          {analyticsSubTab === 'trends' && (
            <motion.div
              key="trends"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Main Spend Chart Card */}
              <div className="bg-bg-card border border-brand-border rounded-[22px] p-5 shadow-brand-md relative overflow-hidden">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider block">
                      Total {boundaries.label} Expenses
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-txt-primary mt-0.5 tracking-tight">
                      {formatCurrency(metrics.totalExpense)}
                    </h3>
                  </div>
                  {peakSpend && (
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-txt-secondary tracking-wider block">Peak Spend</span>
                      <span className="text-xs font-bold text-brand-primary">{formatCurrency(peakSpend.amount)}</span>
                      <span className="text-[9px] text-txt-secondary block">({peakSpend.label})</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    metrics.netCashFlow >= 0 ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
                  }`}>
                    {metrics.netCashFlow >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    Net: {formatCurrency(Math.abs(metrics.netCashFlow))} {metrics.netCashFlow >= 0 ? 'Saved' : 'Deficit'}
                  </div>
                  <span className="text-[10px] text-txt-secondary font-medium">
                    • {metrics.transactionCount} records
                  </span>
                </div>

                {hasSpendInPeriod ? (
                  <div className="h-44 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="label" 
                          stroke="var(--text-secondary)" 
                          fontSize={9} 
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          stroke="var(--text-secondary)" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="var(--color-primary)" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#spendGradient)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center justify-center text-center border-t border-brand-border/60">
                    <p className="text-xs text-txt-secondary font-medium">No expenses recorded for {boundaries.label.toLowerCase()}.</p>
                  </div>
                )}
              </div>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider">Total Income</span>
                    <div className="w-6 h-6 rounded-lg bg-brand-success/10 text-brand-success flex items-center justify-center">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-txt-primary">{formatCurrency(metrics.totalIncome)}</h4>
                  <p className="text-[10px] text-txt-secondary mt-0.5">{metrics.incomeCount} credits</p>
                </div>

                <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider">Average Daily</span>
                    <div className="w-6 h-6 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <TrendingDown size={14} />
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-txt-primary">{formatCurrency(metrics.averageExpense)}</h4>
                  <p className="text-[10px] text-txt-secondary mt-0.5">Per expense record</p>
                </div>

                <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider">Top Category</span>
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <PieChart size={14} />
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-txt-primary truncate">{topCategory.category}</h4>
                  <p className="text-[10px] text-txt-secondary mt-0.5">{topCategory.percentage}% of spending</p>
                </div>

                <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider">Savings Rate</span>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Sparkles size={14} />
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-txt-primary">{metrics.savingsRate}%</h4>
                  <p className="text-[10px] text-txt-secondary mt-0.5">Net cash ratio</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CATEGORIES BREAKDOWN */}
          {analyticsSubTab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Top Category Spotlight */}
              {topCategory.amount > 0 && (
                <div className="bg-gradient-to-r from-brand-primary/10 via-brand-primary/5 to-transparent border border-brand-primary/20 rounded-2xl p-4 shadow-brand-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-bg-card border border-brand-primary/30 flex items-center justify-center text-2xl shadow-brand-sm">
                      {categoryEmojis[topCategory.category] || '💳'}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-brand-primary tracking-wider">Top Spending Category</span>
                      <h4 className="text-base font-bold text-txt-primary">{topCategory.category}</h4>
                      <p className="text-xs text-txt-secondary">{formatCurrency(topCategory.amount)} spent in {boundaries.label.toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-brand-primary">{topCategory.percentage}%</span>
                    <span className="text-[9px] uppercase font-semibold text-txt-secondary block">of expenses</span>
                  </div>
                </div>
              )}

              {/* Category Breakdown List */}
              {categoryBreakdown.length > 0 ? (
                <div className="bg-bg-card border border-brand-border rounded-2xl p-5 shadow-brand-sm">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-border/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-txt-primary">Expense Distribution</h3>
                    <span className="text-[10px] text-txt-secondary font-bold uppercase">{categoryBreakdown.length} Categories</span>
                  </div>

                  <div className="space-y-4">
                    {categoryBreakdown.map((cat) => {
                      const emoji = categoryEmojis[cat.category] || '💳';
                      const badgeColor = categoryColors[cat.category] || 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';
                      return (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-txt-primary flex items-center gap-2">
                              <span className="text-base">{emoji}</span>
                              <span className="font-bold">{cat.category}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-md border font-semibold ${badgeColor}`}>
                                {cat.count || 1} tx
                              </span>
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-txt-primary">{formatCurrency(cat.amount)}</span>
                              <span className="text-[10px] text-txt-secondary font-medium ml-1.5">({cat.percentage}%)</span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-bg-app rounded-full overflow-hidden border border-brand-border/40">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-brand-primary rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-bg-card border border-brand-border rounded-2xl p-8 text-center shadow-brand-sm">
                  <PieChart size={32} className="text-txt-secondary mx-auto mb-2 opacity-50" />
                  <h4 className="text-sm font-bold text-txt-primary">No Category Expenses</h4>
                  <p className="text-xs text-txt-secondary mt-1">There are no categorized expenses recorded for {boundaries.label.toLowerCase()}.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: BUDGET HEALTH & FINANCIAL INTELLIGENCE */}
          {analyticsSubTab === 'health' && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Monthly Budget Card */}
              <div className="bg-bg-card border border-brand-border rounded-2xl p-5 shadow-brand-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block">Monthly Target Limit</span>
                    <h4 className="text-xl font-bold text-txt-primary mt-0.5">{formatCurrency(budgetLimit)}</h4>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    budgetHealth.isExceeded 
                      ? 'bg-brand-error/10 text-brand-error' 
                      : budgetHealth.status === 'warning'
                      ? 'bg-brand-warning/10 text-brand-warning'
                      : 'bg-brand-success/10 text-brand-success'
                  }`}>
                    {budgetHealth.isExceeded ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {budgetHealth.percentage}% Utilized
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-bg-app rounded-full overflow-hidden border border-brand-border/60 mb-2.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, budgetHealth.percentage)}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${
                      budgetHealth.isExceeded 
                        ? 'bg-brand-error' 
                        : budgetHealth.status === 'warning' 
                        ? 'bg-brand-warning' 
                        : 'bg-brand-success'
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-txt-secondary pt-1">
                  <span>Spent: <strong className="text-txt-primary">{formatCurrency(monthlyExpense)}</strong></span>
                  <span>
                    {budgetHealth.isExceeded 
                      ? `Exceeded by: ${formatCurrency(budgetHealth.exceededAmount)}` 
                      : `Remaining: ${formatCurrency(budgetHealth.remaining)}`}
                  </span>
                </div>

                {onGoToProfile && (
                  <button
                    type="button"
                    onClick={onGoToProfile}
                    className="w-full mt-4 py-2.5 bg-bg-app border border-brand-border hover:bg-bg-subtle rounded-xl text-xs font-bold text-txt-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Wallet size={14} className="text-brand-primary" />
                    Adjust Spending Budget Targets
                    <ChevronRight size={14} className="text-txt-secondary" />
                  </button>
                )}
              </div>

              {/* Dynamic Financial Intelligence Alerts */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary px-1">Financial Intelligence Alerts</h3>

                {budgetHealth.isExceeded ? (
                  <div className="flex gap-3.5 p-4 bg-brand-error/5 border border-brand-error/20 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-brand-error/10 text-brand-error flex items-center justify-center shrink-0">
                      <AlertCircle size={18} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-brand-error">Monthly Limit Exceeded</h4>
                      <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">
                        Total monthly spending ({formatCurrency(monthlyExpense)}) has exceeded your {formatCurrency(budgetLimit)} target by {formatCurrency(budgetHealth.exceededAmount)}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3.5 p-4 bg-brand-success/5 border border-brand-success/20 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-brand-success/10 text-brand-success flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-brand-success">Healthy Budget Pacing</h4>
                      <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">
                        Your spending is currently at {budgetHealth.percentage}% of your monthly limit with {formatCurrency(budgetHealth.remaining)} left to spare.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3.5 p-4 bg-bg-card border border-brand-border rounded-xl">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                    <Activity size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-txt-primary">Cash Flow Summary</h4>
                    <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">
                      Recorded income is {formatCurrency(metrics.totalIncome)} with net savings of {formatCurrency(Math.max(0, metrics.netCashFlow))} in {boundaries.label.toLowerCase()}.
                    </p>
                    {onAdd && (
                      <button
                        type="button"
                        onClick={onAdd}
                        className="mt-2 text-[10px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:underline"
                      >
                        Add Transaction <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="bg-bg-card border border-brand-border rounded-[22px] p-8 text-center shadow-brand-sm mt-4">
          <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl border border-brand-border flex items-center justify-center text-brand-primary mx-auto mb-4 shadow-brand-sm">
            <Activity size={26} />
          </div>
          <h3 className="text-base font-bold text-txt-primary">Start tracking expenses to unlock insights</h3>
          <p className="text-xs text-txt-secondary mt-1.5 max-w-[280px] mx-auto leading-relaxed mb-6">
            As you record transactions in Finovo, real-time financial health scores, category intensity graphs, and cash flow intelligence appear here automatically.
          </p>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="btn-primary py-3 px-6 text-xs inline-flex w-auto mx-auto items-center gap-1.5 shadow-brand-sm cursor-pointer"
            >
              <Plus size={14} /> Add First Expense
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Insights;
