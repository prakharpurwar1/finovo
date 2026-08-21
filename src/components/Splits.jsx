import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, CheckCircle2, MoreHorizontal, MessageCircle, Plus,
  ArrowUp, ArrowDown, User
} from 'lucide-react';
import SplitDetail from './SplitDetail';

const SplitCard = ({ title, members, amount, type, status, date, onClick }) => {
  const isDebt = type === 'debt';
  const isSettled = status === 'settled';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-bg-card border border-brand-border rounded-[16px] p-5 mb-4 active:bg-bg-card/85 transition-all cursor-pointer shadow-brand-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/5 border border-brand-border flex items-center justify-center">
            <Users size={18} className="text-brand-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-txt-primary">{title}</h4>
            <p className="text-[11px] text-txt-secondary mt-0.5">{date} • {members} Members</p>
          </div>
        </div>
        <button className="text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-txt-secondary/60 uppercase tracking-wider font-bold mb-1.5 block">
            {isSettled ? 'Transaction Settled' : (isDebt ? 'You owe Sneha' : 'Rahul owes you')}
          </span>
          <div className="flex items-baseline gap-1.5">
            <h3 className={`text-xl font-bold ${isSettled ? 'text-txt-disabled' : (isDebt ? 'text-brand-error' : 'text-brand-success')}`}>
              ₹{amount.toLocaleString()}
            </h3>
            {!isSettled && (
              <div className={isDebt ? 'text-brand-error' : 'text-brand-success'}>
                {isDebt ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </div>
            )}
            {isSettled && <CheckCircle2 size={14} className="text-brand-success" />}
          </div>
        </div>

        <div className="flex gap-2">
          {!isSettled && (
            <button className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
              ${isDebt ? 'bg-brand-error text-white' : 'bg-brand-primary/5 text-brand-primary border border-brand-border'}`}>
              {isDebt ? 'Settle' : 'Remind'}
            </button>
          )}
          <button className="w-9 h-9 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary cursor-pointer">
            <MessageCircle size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Splits = ({ onAdd }) => {
  const [activeTab, setActiveTab] = useState('Groups'); // 'Splits', 'Groups'
  const [selectedGroup, setSelectedGroup] = useState(null);

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      <AnimatePresence>
        {selectedGroup && (
          <SplitDetail 
            key="detail"
            groupName={selectedGroup} 
            onBack={() => setSelectedGroup(null)} 
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Splits</h2>
        <button className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-brand-sm cursor-pointer hover:opacity-90">
          <UserPlus size={18} />
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3.5 mb-8">
        <div className="bg-brand-success/5 border border-brand-success/15 rounded-[16px] p-5 relative overflow-hidden group">
          <div className="text-brand-success mb-3">
            <ArrowDown size={20} />
          </div>
          <span className="text-[10px] text-txt-secondary/70 uppercase tracking-wider font-bold mb-1 block">To Receive</span>
          <p className="text-xl font-bold text-brand-success tracking-tight">₹12,450</p>
        </div>
        <div className="bg-brand-error/5 border border-brand-error/15 rounded-[16px] p-5 relative overflow-hidden group">
          <div className="text-brand-error mb-3">
            <ArrowUp size={20} />
          </div>
          <span className="text-[10px] text-txt-secondary/70 uppercase tracking-wider font-bold mb-1 block">To Pay</span>
          <p className="text-xl font-bold text-brand-error tracking-tight">₹4,200</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl mb-6">
        {['Your Splits', 'Groups'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
              ${activeTab === t ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
          >
            {activeTab === t && (
              <motion.div layoutId="activeSplitTab" className="absolute inset-0 bg-bg-app border border-brand-border rounded-lg shadow-brand-sm" />
            )}
            <span className="relative z-10">{t}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'Groups' ? (
            <div className="space-y-4">
              <SplitCard title="Goa Trip 2024" members={5} amount={8450} type="credit" date="June 12" onClick={() => setSelectedGroup("Goa Trip 2024")} />
              <SplitCard title="Office Lunch" members={3} amount={420} type="debt" date="Today" onClick={() => setSelectedGroup("Office Lunch")} />
              <SplitCard title="Movie Night" members={2} amount={150} type="debt" date="Yesterday" onClick={() => setSelectedGroup("Movie Night")} />
              <SplitCard title="Weekend Trek" members={4} amount={2400} status="settled" date="May 10" onClick={() => setSelectedGroup("Weekend Trek")} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 bg-bg-card rounded-xl border border-brand-border flex items-center justify-center text-txt-secondary/40 mb-4">
                <User size={22} />
              </div>
              <h4 className="text-txt-secondary/60 font-bold uppercase tracking-wider text-xs">No Individual Splits</h4>
              <p className="text-txt-secondary/40 text-[11px] mt-1 max-w-[200px] leading-relaxed">Individual splits with friends will appear here once you add an expense.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="h-32" />
    </div>
  );
};

export default Splits;
