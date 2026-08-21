import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, Search, TrendingUp, TrendingDown, ArrowRight,
  Smartphone, ShoppingBag, Utensils, Car, Plus,
  Users, Grid, HeartPulse, CreditCard, Clock, Tag, Film, 
  GraduationCap, ShieldAlert, PiggyBank
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const categoryIcons = {
  Food: Utensils,
  Travel: Car,
  Shopping: ShoppingBag,
  Recharge: Smartphone,
  Medicine: HeartPulse,
  Education: GraduationCap,
  Entertainment: Film,
  Others: Grid,
  Uncategorized: ShieldAlert
};

const TransactionCard = ({ icon: Icon, merchant, category, amount, date, type, onClick }) => {
  const isUnknown = merchant === 'Unknown Merchant' || !merchant;
  const isIncome = type === 'income';

  return (
    <motion.div
      whileHover={{ x: 3 }}
      onClick={onClick}
      className="bg-bg-card border border-brand-border rounded-[14px] p-4 flex items-center justify-between mb-3 active:bg-bg-card/80 transition-colors group cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-brand-primary/5 text-brand-primary flex items-center justify-center border border-brand-border`}>
          <Icon size={18} />
        </div>
        <div>
          <h4 className={`text-sm font-semibold transition-colors ${isUnknown ? 'text-txt-secondary/60 italic' : 'text-txt-primary'}`}>
            {isUnknown ? 'Unknown Merchant' : merchant}
          </h4>
          <p className="text-[11px] text-txt-secondary/75 font-medium mt-0.5">{category} • {date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isIncome ? 'text-brand-success' : 'text-txt-primary'}`}>
          {isIncome ? '+' : '-'}₹{amount.toLocaleString('en-IN')}
        </p>
        <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider block mt-0.5">Confirmed</span>
      </div>
    </motion.div>
  );
};

const QuickAction = ({ icon: Icon, label, onClick, badgeCount }) => (
  <div className="flex flex-col items-center gap-2 cursor-pointer relative flex-1">
    {badgeCount > 0 && (
      <div className="absolute -top-10 z-20 bg-brand-error text-white text-[8px] font-bold uppercase tracking-wider py-1 px-2 rounded-lg shadow-brand-sm pointer-events-none whitespace-nowrap border border-white/10">
        {badgeCount} review
      </div>
    )}
    
    <motion.button 
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-12 h-12 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center relative group cursor-pointer`}
    >
      <Icon size={18} className="text-txt-secondary group-hover:text-brand-primary transition-colors" />
      
      {badgeCount > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-error rounded-full flex items-center justify-center text-[9px] font-bold text-white">
          {badgeCount}
        </div>
      )}
    </motion.button>
    <span className="text-[10px] font-semibold text-txt-secondary uppercase tracking-wider">{label}</span>
  </div>
);

const Dashboard = ({ transactions, onSelectTx, onAdd, onGoToHistory, onCategorize, onGoToSplits }) => {
  
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(`${b.date} ${b.time || '12:00 PM'}`) - new Date(`${a.date} ${a.time || '12:00 PM'}`))
      .slice(0, 4);
  }, [transactions]);

  const uncategorizedCount = useMemo(() => {
    return transactions.filter(tx => tx.category === 'Uncategorized').length;
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const portfolioBalance = 42850 + totalIncome - totalExpense;
  const savings = Math.max(0, totalIncome - totalExpense);

  const sparklineData = [
    { day: 'Mon', amount: 1200 },
    { day: 'Tue', amount: 800 },
    { day: 'Wed', amount: 2100 },
    { day: 'Thu', amount: 1400 },
    { day: 'Fri', amount: 3500 },
    { day: 'Sat', amount: 2900 },
    { day: 'Sun', amount: 1800 }
  ];

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Finovo</h2>
          <p className="text-txt-secondary text-[10px] font-bold uppercase tracking-wider mt-0.5">Track. Grow. Simplify.</p>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer">
            <Search size={18} />
          </button>
          <button className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all relative cursor-pointer">
            <Bell size={18} />
            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand-primary rounded-full ring-2 ring-bg-card" />
          </button>
        </div>
      </div>

      {/* Main Balance Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-brand-primary rounded-[20px] p-6 mb-6 text-white shadow-brand-md relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-1 opacity-80">
              <span className="text-[10px] font-bold uppercase tracking-widest">Total Portfolio Balance</span>
              <CreditCard size={16} />
            </div>
            <h3 className="text-3xl font-bold tracking-tight">₹{portfolioBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-1.5 opacity-80">
              <span className="text-[9px] font-bold uppercase tracking-widest">Monthly Limit Progress</span>
              <span className="text-[10px] font-bold">68% used</span>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '68%' }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <div className="flex justify-between items-center text-[10px] opacity-75 mt-1">
              <span>Spent: ₹{totalExpense.toLocaleString('en-IN')}</span>
              <span>Budget: ₹45,000</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {/* Income Card */}
        <div className="bg-bg-card border border-brand-border rounded-[14px] p-4 flex flex-col justify-between">
          <div className="text-brand-success mb-2 flex items-center justify-between">
            <TrendingDown size={16} className="rotate-180" />
            <span className="text-[8px] font-bold text-brand-success uppercase tracking-wider">In</span>
          </div>
          <div>
            <span className="text-[9px] text-txt-secondary font-bold uppercase tracking-wider block mb-0.5">Income</span>
            <p className="text-sm font-bold text-txt-primary">₹{totalIncome.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-bg-card border border-brand-border rounded-[14px] p-4 flex flex-col justify-between">
          <div className="text-brand-error mb-2 flex items-center justify-between">
            <TrendingUp size={16} />
            <span className="text-[8px] font-bold text-brand-error uppercase tracking-wider">Out</span>
          </div>
          <div>
            <span className="text-[9px] text-txt-secondary font-bold uppercase tracking-wider block mb-0.5">Expenses</span>
            <p className="text-sm font-bold text-txt-primary">₹{totalExpense.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Savings Card */}
        <div className="bg-bg-card border border-brand-border rounded-[14px] p-4 flex flex-col justify-between">
          <div className="text-brand-primary mb-2 flex items-center justify-between">
            <PiggyBank size={16} />
            <span className="text-[8px] font-bold text-brand-primary uppercase tracking-wider">Saved</span>
          </div>
          <div>
            <span className="text-[9px] text-txt-secondary font-bold uppercase tracking-wider block mb-0.5">Savings</span>
            <p className="text-sm font-bold text-txt-primary">₹{savings.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex justify-between items-center gap-2 mb-8 bg-bg-card border border-brand-border rounded-[16px] p-4 shadow-brand-sm">
        <QuickAction icon={Plus} label="Add" onClick={onAdd} />
        <QuickAction icon={Clock} label="History" onClick={onGoToHistory} />
        <QuickAction 
          icon={Tag} 
          label="Review" 
          onClick={onCategorize} 
          badgeCount={uncategorizedCount}
        />
        <QuickAction icon={Users} label="Split" onClick={onGoToSplits} />
      </div>

      {/* Spend Trend Micro-Chart */}
      <div className="bg-bg-card border border-brand-border rounded-[16px] p-5 mb-8 shadow-brand-sm">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Weekly Spend Trend</h4>
          <span className="text-[10px] text-brand-success font-bold bg-brand-success/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <TrendingDown size={10} /> -4.2%
          </span>
        </div>
        <div className="w-full h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <XAxis dataKey="day" hide />
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
                formatter={(value) => [`₹${value}`, 'Expenses']}
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
        <div className="flex justify-between items-center text-[9px] text-txt-secondary/60 font-bold tracking-widest mt-2 uppercase">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
          <span>Sun</span>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Recent Activity</h3>
          <button onClick={onGoToHistory} className="text-xs font-bold text-brand-primary flex items-center gap-1 cursor-pointer">
            See All <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {recentTransactions.map((tx) => {
            const Icon = categoryIcons[tx.category] || Grid;
            return (
              <TransactionCard 
                key={tx.id} 
                icon={Icon} 
                merchant={tx.merchant} 
                category={tx.category} 
                amount={tx.amount} 
                date={tx.date} 
                type={tx.type} 
                onClick={() => onSelectTx && onSelectTx(tx)} 
              />
            );
          })}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
};

export default Dashboard;
