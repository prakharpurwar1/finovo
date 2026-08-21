import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown,
  ArrowRight,
  ShoppingBag, Utensils, Car, Smartphone,
  CheckCircle2, AlertCircle,
  ChevronRight, Filter
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, 
  Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

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

const InsightCard = ({ icon: Icon, title, description, color, action }) => (
  <motion.div 
    whileHover={{ x: 2 }}
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

const Insights = () => {
  const [timeframe, setTimeframe] = useState('Daily');

  const hourlyData = [
    { time: '9a', amount: 120 }, { time: '11a', amount: 450 }, { time: '1p', amount: 850 },
    { time: '3p', amount: 320 }, { time: '5p', amount: 150 }, { time: '7p', amount: 1200 },
    { time: '9p', amount: 450 }, { time: '11p', amount: 100 }
  ];

  const weeklyData = [
    { name: 'Mon', amount: 1200 }, { name: 'Tue', amount: 2100 },
    { name: 'Wed', amount: 800 }, { name: 'Thu', amount: 1600 },
    { name: 'Fri', amount: 4200 }, { name: 'Sat', amount: 5800 },
    { name: 'Sun', amount: 3100 }
  ];

  const categoryData = [
    { name: 'Food', value: 35, color: '#f97316' },
    { name: 'Travel', value: 25, color: '#3b82f6' },
    { name: 'Shopping', value: 20, color: '#10b981' },
    { name: 'Bills', value: 20, color: '#8b5cf6' }
  ];

  const renderDaily = () => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-bg-card border border-brand-border rounded-[20px] p-6 shadow-brand-sm">
        <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-1 block">Spent Today</span>
        <h3 className="text-3xl font-bold text-txt-primary mb-1">₹3,490</h3>
        <p className="text-[11px] text-brand-success font-semibold flex items-center gap-1 mb-6">
          <TrendingDown size={12} /> 12% lower than daily average
        </p>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--color-border)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: 'var(--text-primary)'
                }}
                formatter={(value) => [`₹${value}`, 'Spend']}
              />
              <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" strokeWidth={2} fill="var(--color-primary)" fillOpacity={0.08} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Transactions" value="6" subValue="Today" />
        <StatCard label="Top Category" value="Food" subValue="₹1,850" />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary px-1">Smart AI Recommendations</h3>
        <InsightCard 
          icon={AlertCircle}
          title="Weekend Budget Alert"
          description="Your weekend spending typically spikes by 40%. Consider setting a cap."
          color="bg-brand-warning/10 text-brand-warning"
          action="Set Limit"
        />
        <InsightCard 
          icon={CheckCircle2}
          title="On Track for Savings"
          description="You are 8% ahead of your savings goal for this month."
          color="bg-brand-success/10 text-brand-success"
          action="View Goal"
        />
      </div>
    </motion.div>
  );

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Analytics</h2>
          <p className="text-txt-secondary text-[10px] font-bold uppercase tracking-wider mt-0.5">Real-time Financial Intelligence</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl mb-6">
        {['Daily', 'Weekly', 'Monthly'].map((t) => (
          <button
            key={t}
            onClick={() => setTimeframe(t)}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
              ${timeframe === t ? 'text-txt-primary' : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            {timeframe === t && (
              <motion.div layoutId="activeInsightTab" className="absolute inset-0 bg-bg-app border border-brand-border rounded-lg shadow-brand-sm" />
            )}
            <span className="relative z-10">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {renderDaily()}
      </AnimatePresence>
      <div className="h-28" />
    </div>
  );
};

export default Insights;
