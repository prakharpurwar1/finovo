import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users,
  CheckCircle2, ArrowUp, ArrowDown, Info, Receipt
} from 'lucide-react';
import { formatCurrency, splitMoneyEvenly } from '../utils/currency.js';

const MemberItem = ({ name, amount, type, status, avatar }) => {
  const isDebt = type === 'debt';
  const isSettled = status === 'settled';

  return (
    <div className="flex items-center justify-between p-4 bg-bg-card border border-brand-border rounded-xl mb-3 transition-all hover:bg-bg-card/85">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-border/40 overflow-hidden border border-brand-border">
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-txt-primary">{name}</h4>
          <p className="text-[10px] text-txt-secondary/60 font-bold uppercase tracking-wider">
            {isSettled ? 'Fully Settled' : (isDebt ? 'Owes you' : 'You owe')}
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold flex items-center justify-end gap-1 ${isSettled ? 'text-txt-disabled' : (isDebt ? 'text-brand-success' : 'text-brand-error')}`}>
          {formatCurrency(amount, { minimumFractionDigits: 2 })}
          {isSettled ? <CheckCircle2 size={13} /> : (isDebt ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
        </div>
      </div>
    </div>
  );
};

const ActivityItem = ({ title, user, date, amount }) => (
  <div className="flex gap-4 mb-6 relative group">
    <div className="absolute left-3.5 top-8 bottom-0 w-[1px] bg-brand-border" />
    <div className="w-7 h-7 rounded-full bg-bg-card border border-brand-border flex items-center justify-center text-brand-primary shrink-0 z-10">
      <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
    </div>
    <div className="flex-1 pt-0.5">
      <div className="flex items-center justify-between mb-1">
        <h5 className="text-xs font-semibold text-txt-primary">{title}</h5>
        <span className="text-[9px] font-bold text-txt-secondary/60 uppercase tracking-wider">{date}</span>
      </div>
      <p className="text-[10px] text-txt-secondary font-semibold">Added by <span className="text-brand-primary font-bold">{user}</span> • {formatCurrency(amount)}</p>
    </div>
  </div>
);

const SplitDetail = ({ onBack, group, groupName = "Expense Group", groupExpenses = [] }) => {
  const [activeTab, setActiveTab] = useState('Overview');

  const title = group?.title || groupName;
  const membersCount = group?.members || 2;
  const totalSpend = groupExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Exact even split per member
  const memberShares = totalSpend > 0 ? splitMoneyEvenly(totalSpend, membersCount) : [];

  return (
    <div className="fixed inset-0 z-[60] bg-bg-app flex flex-col overflow-hidden text-txt-primary">
      {/* Header */}
      <div className="p-6 pt-12 flex items-center justify-between border-b border-brand-border bg-bg-card/90 backdrop-blur-md z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Group Hero Section */}
        <div className="p-6 text-center bg-bg-card border-b border-brand-border relative">
          <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-1 block">Total Group Spend</span>
          <h1 className="text-4xl font-bold text-txt-primary mb-4 tracking-tight">
            {formatCurrency(totalSpend)}
          </h1>
          <div className="flex justify-center gap-2">
            <div className="px-3 py-1 rounded-full bg-brand-primary/5 border border-brand-primary/10 flex items-center gap-1.5">
              <Users size={12} className="text-brand-primary" />
              <span className="text-[10px] font-semibold text-txt-secondary">{membersCount} Members</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-brand-success/10 border border-brand-success/25 flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-brand-success" />
              <span className="text-[10px] font-bold text-brand-success uppercase tracking-wider">
                {group?.status === 'settled' ? 'Settled' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab System */}
        <div className="px-6 my-6">
          <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl">
            {['Overview', 'Expenses', 'Activity'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                  ${activeTab === t ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
              >
                {activeTab === t && (
                  <motion.div layoutId="activeDetailTab" className="absolute inset-0 bg-bg-app border border-brand-border rounded-lg shadow-brand-sm" />
                )}
                <span className="relative z-10">{t}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'Overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="px-6 space-y-6"
            >
              {/* Balance Breakdown */}
              <section>
                <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Member Breakdown</h3>
                <MemberItem 
                  name="You (Creator)" 
                  amount={memberShares[0] || 0} 
                  type="credit" 
                  status={group?.status}
                  avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=You" 
                />
                {[...Array(Math.max(1, membersCount - 1))].map((_, i) => (
                  <MemberItem 
                    key={i}
                    name={`Member ${i + 2}`} 
                    amount={memberShares[i + 1] || 0} 
                    type="debt" 
                    status={group?.status}
                    avatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=Member${i + 2}`} 
                  />
                ))}
              </section>

              {/* Settlement Suggestion Card */}
              <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary">
                    <Info size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-txt-primary">Smart Settlement</h4>
                    <p className="text-[9px] text-brand-primary font-bold uppercase tracking-wider">Optimized Share</p>
                  </div>
                </div>
                <p className="text-xs text-txt-secondary leading-relaxed mb-4">
                  {totalSpend > 0 
                    ? `Total spend is ${formatCurrency(totalSpend)}. Each member owes approximately ${formatCurrency(memberShares[0] || 0)}.`
                    : "No group balances recorded yet. Add an expense and attach it to this group to calculate optimal settlements."}
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'Expenses' && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="px-6 space-y-3"
            >
              <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Expense Log</h3>
              {groupExpenses.length > 0 ? (
                groupExpenses.map((exp, idx) => (
                  <div key={idx} className="bg-bg-card border border-brand-border rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-semibold text-txt-primary">{exp.merchant || 'Group Expense'}</h4>
                      <p className="text-[11px] text-txt-secondary mt-0.5">{exp.date || 'Today'}</p>
                    </div>
                    <span className="text-sm font-bold text-txt-primary">{formatCurrency(exp.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-bg-card border border-brand-border rounded-xl p-6">
                  <Receipt size={22} className="text-txt-secondary/40 mx-auto mb-2" />
                  <p className="text-xs text-txt-secondary font-semibold">No group expenses recorded yet.</p>
                  <p className="text-[10px] text-txt-secondary/60 mt-0.5">Use Add Expense with Group Expense enabled to record items for this group.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'Activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="px-6"
            >
              <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-4 px-1">Group Activity Log</h3>
              {groupExpenses.length > 0 ? (
                <div className="space-y-1">
                  {groupExpenses.map((exp, idx) => (
                    <ActivityItem
                      key={idx}
                      title={exp.merchant || 'Group Expense'}
                      user="You"
                      date={exp.date || 'Recently'}
                      amount={exp.amount}
                    />
                  ))}
                  <ActivityItem
                    title={`Group "${title}" created`}
                    user="You"
                    date={group?.date || 'Recently'}
                    amount={0}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <ActivityItem
                    title={`Group "${title}" created`}
                    user="You"
                    date={group?.date || 'Recently'}
                    amount={0}
                  />
                  <div className="py-8 text-center bg-bg-card border border-brand-border rounded-xl p-4 mt-4">
                    <p className="text-xs text-txt-secondary font-semibold">All caught up!</p>
                    <p className="text-[10px] text-txt-secondary/60 mt-0.5">Transactions added to this group will append to this activity feed.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent pt-8 flex gap-3 z-10">
        <button 
          onClick={onBack}
          className="flex-1 bg-brand-primary text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-brand-sm"
        >
          Back to Groups
        </button>
      </div>
    </div>
  );
};

export default SplitDetail;
