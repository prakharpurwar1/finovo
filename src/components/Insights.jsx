import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, TrendingDown,
  Activity, Plus,
  CheckCircle2, AlertCircle,
  ChevronRight, PieChart
} from 'lucide-react';
import { 
  AreaChart, Area, Tooltip, ResponsiveContainer 
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
  Others: '💳'
};

const StatCard = ({ label, value, subValue, trend, trendType }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-bg-card border border-brand-border rounded-xl p-4 shadow-brand-sm"
  >
    <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-2">{label}</p>
    <div className="flex items-end justify-between">
      <div>
        <h4 className="text-xl font-bold text-txt-primary mb-0.5">{value}</h4>
        <p className="text-[10px] text-txt-secondary/60 font-medium">{subValue}</p>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${trendType === 'up' ? 'bg-brand-error/10 text-brand-error' : 'bg-brand-success/10 text-brand-success'}`}>
          {trendType === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend}
        </div>
      )}
    </div>
  </motion.div>
);

const InsightCard = ({ icon: Icon, title, description, color, action, onAction }) => (
  <motion.div 
    whileHover={{ x: 2 }}
    onClick={onAction}
    className="flex gap-4 p-4 bg-bg-card border border-brand-border rounded-xl group cursor-pointer hover:bg-bg-card/85 transition-all shadow-brand-sm"
  >
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0 border border-brand-border`}>
      <Icon size={18} className="text-txt-primary" />
    </div>
    <div className="flex-1">
      <h4 className="text-sm font-semibold text-txt-primary mb-1">{title}</h4>
      <p className="text-xs text-txt-secondary leading-relaxed font-medium mb-2">{description}</p>
      {action && (
        <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1">
          {action} <ChevronRight size={12} />
        </span>
      )}
    </div>
  </motion.div>
);

const Insights = ({ transactions = [], userProfile, onAdd, onGoToProfile }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_FILTERS.THIS_MONTH);

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

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Analytics</h2>
          <p className="text-txt-secondary text-[10px] font-bold uppercase tracking-wider mt-0.5">Real-time Financial Intelligence</p>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Period Filter Tabs */}
          <div className="flex bg-bg-card border border-brand-border p-1 rounded-2xl shadow-brand-sm mb-6">
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
                  onClick={() => setSelectedPeriod(t.id)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                    ${isSelected ? 'text-white' : 'text-txt-secondary hover:text-txt-primary'}`}
                >
                  {isSelected && (
                    <motion.div layoutId="activeInsightPeriodTab" className="absolute inset-0 bg-brand-primary rounded-xl shadow-brand-sm" />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {/* Main Spend Chart Card */}
            <div className="bg-bg-card border border-brand-border rounded-[20px] p-6 shadow-brand-sm">
              <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-1 block">
                {boundaries.label} Expenditure
              </span>
              <h3 className="text-3xl font-bold text-txt-primary mb-1">
                {formatCurrency(metrics.totalExpense)}
              </h3>
              <p className="text-[11px] text-brand-success font-semibold flex items-center gap-1 mb-6">
                <TrendingDown size={12} /> Active Cash Flow Intelligence
              </p>

              {hasSpendInPeriod ? (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--bg-card)', 
                          borderColor: 'var(--color-border)',
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: 'var(--text-primary)'
                        }}
                        formatter={(value) => [formatCurrency(value), 'Spend']}
                      />
                      <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" strokeWidth={2} fill="var(--color-primary)" fillOpacity={0.08} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center border-t border-brand-border/60">
                  <p className="text-xs text-txt-secondary font-medium">No expenses recorded for {boundaries.label.toLowerCase()}.</p>
                </div>
              )}
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard 
                label="Transactions" 
                value={metrics.transactionCount.toString()} 
                subValue={`${metrics.expenseCount} expenses • ${metrics.incomeCount} income`} 
              />
              <StatCard 
                label="Top Category" 
                value={topCategory.category} 
                subValue={topCategory.amount > 0 ? `${formatCurrency(topCategory.amount)} (${topCategory.percentage}%)` : 'No expenses'} 
              />
              <StatCard 
                label="Average Expense" 
                value={formatCurrency(metrics.averageExpense)} 
                subValue="Per expense record" 
              />
              <StatCard 
                label="Savings Rate" 
                value={`${metrics.savingsRate}%`} 
                subValue={`Net: ${formatCurrency(metrics.netCashFlow)}`} 
              />
            </div>

            {/* Category Expense Breakdown */}
            {categoryBreakdown.length > 0 && (
              <div className="bg-bg-card border border-brand-border rounded-[20px] p-5 shadow-brand-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PieChart size={16} className="text-brand-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-txt-primary">Category Breakdown</h3>
                  </div>
                  <span className="text-[10px] text-txt-secondary font-bold uppercase">{boundaries.label}</span>
                </div>

                <div className="space-y-3.5">
                  {categoryBreakdown.map((cat) => {
                    const emoji = categoryEmojis[cat.category] || '💳';
                    return (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-txt-primary flex items-center gap-2">
                            <span>{emoji}</span> {cat.category}
                          </span>
                          <span className="font-bold text-txt-primary">
                            {formatCurrency(cat.amount)} <span className="text-[10px] text-txt-secondary font-normal">({cat.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-app rounded-full overflow-hidden border border-brand-border/40">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.percentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-brand-primary rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Smart Dynamic Recommendations */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary px-1">Financial Intelligence</h3>
              
              {budgetHealth.isExceeded ? (
                <InsightCard 
                  icon={AlertCircle}
                  title="Monthly Budget Exceeded"
                  description={`You have exceeded your ${formatCurrency(budgetLimit)} monthly limit by ${formatCurrency(budgetHealth.exceededAmount)} (${budgetHealth.percentage}% used).`}
                  color="bg-brand-error/10 text-brand-error"
                  action="Adjust Budget"
                  onAction={onGoToProfile}
                />
              ) : budgetHealth.status === 'warning' || budgetHealth.status === 'danger' ? (
                <InsightCard 
                  icon={AlertCircle}
                  title="Approaching Monthly Limit"
                  description={`You have utilized ${budgetHealth.percentage}% of your ${formatCurrency(budgetLimit)} monthly budget target (${formatCurrency(budgetHealth.remaining)} remaining).`}
                  color="bg-brand-warning/10 text-brand-warning"
                  action="View Budget"
                  onAction={onGoToProfile}
                />
              ) : (
                <InsightCard 
                  icon={CheckCircle2}
                  title="Spending On Track"
                  description={`Your monthly expenses (${formatCurrency(monthlyExpense)}) are well within your ${formatCurrency(budgetLimit)} limit (${budgetHealth.percentage}% used).`}
                  color="bg-brand-success/10 text-brand-success"
                  action="View Budget"
                  onAction={onGoToProfile}
                />
              )}

              <InsightCard 
                icon={Activity}
                title="Cash Flow Summary"
                description={`Total recorded income is ${formatCurrency(metrics.totalIncome)} with net savings of ${formatCurrency(Math.max(0, metrics.netCashFlow))} in ${boundaries.label.toLowerCase()}.`}
                color="bg-brand-primary/10 text-brand-primary"
                action="Add Transaction"
                onAction={onAdd}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-bg-card border border-brand-border rounded-[20px] p-8 text-center shadow-brand-sm mt-4">
          <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl border border-brand-border flex items-center justify-center text-brand-primary mx-auto mb-4 shadow-brand-sm">
            <Activity size={26} />
          </div>
          <h3 className="text-base font-bold text-txt-primary">Start tracking expenses to unlock insights</h3>
          <p className="text-xs text-txt-secondary mt-1.5 max-w-[260px] mx-auto leading-relaxed mb-6">
            As you record transactions in Supabase, Finovo automatically generates financial health scores, category intensity graphs, and cash flow intelligence.
          </p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="btn-primary py-3 px-6 text-xs inline-flex w-auto mx-auto items-center gap-1.5 shadow-brand-sm"
            >
              <Plus size={14} /> Add First Expense
            </button>
          )}
        </div>
      )}

      <div className="h-28" />
    </div>
  );
};

export default Insights;
