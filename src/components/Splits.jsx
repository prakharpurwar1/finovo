import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, CheckCircle2, MoreHorizontal, MessageCircle, Plus,
  ArrowUp, ArrowDown, User, X, AlertCircle
} from 'lucide-react';
import SplitDetail from './SplitDetail';
import { useNotifications } from '../context/NotificationContext';
import { validateGroup } from '../utils/validation.js';
import { formatCurrency } from '../utils/currency.js';

const SplitCard = ({ group, onClick, onSettle, onRemind }) => {
  const isDebt = group.type === 'debt';
  const isSettled = group.status === 'settled';

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
            <h4 className="text-sm font-semibold text-txt-primary">{group.title}</h4>
            <p className="text-[11px] text-txt-secondary mt-0.5">{group.date || 'Recently'} • {group.members || 2} Members</p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-txt-secondary/60 uppercase tracking-wider font-bold mb-1.5 block">
            {isSettled ? 'Group Settled' : (isDebt ? 'You owe group' : 'Group owes you')}
          </span>
          <div className="flex items-baseline gap-1.5">
            <h3 className={`text-xl font-bold ${isSettled ? 'text-txt-disabled' : (isDebt ? 'text-brand-error' : 'text-brand-success')}`}>
              {formatCurrency(group.amount || 0)}
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
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (isDebt) onSettle(group.id);
                else onRemind(group.title);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-brand-sm
                ${isDebt ? 'bg-brand-error text-white hover:opacity-90' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/20'}`}
            >
              {isDebt ? 'Settle' : 'Remind'}
            </button>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemind(group.title);
            }}
            title="Send Message/Reminder"
            className="w-9 h-9 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Splits = ({ groups = [], transactions = [], onAddGroup }) => {
  const [activeTab, setActiveTab] = useState('Groups'); // 'Splits', 'Groups'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState(3);
  const [formErrors, setFormErrors] = useState({});
  const { showToast } = useNotifications();

  // Dynamic calculations based strictly on user data
  const toReceive = useMemo(() => {
    return groups
      .filter(g => g.type === 'credit' && g.status !== 'settled')
      .reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  }, [groups]);

  const toPay = useMemo(() => {
    return groups
      .filter(g => g.type === 'debt' && g.status !== 'settled')
      .reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  }, [groups]);

  const individualSplits = useMemo(() => {
    return transactions.filter(tx => tx.isSplit);
  }, [transactions]);

  const handleCreateGroupSubmit = (e) => {
    e.preventDefault();
    const validation = validateGroup({
      title: newGroupTitle,
      members: newGroupMembers
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});

    if (onAddGroup) {
      onAddGroup({
        title: newGroupTitle.trim(),
        members: parseInt(newGroupMembers, 10) || 2,
        amount: 0,
        type: 'credit',
        status: 'active',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    setNewGroupTitle('');
    setNewGroupMembers(3);
    setShowCreateModal(false);
  };

  const handleSettle = (groupId) => {
    const grp = groups.find(g => g.id === groupId);
    if (grp) {
      grp.status = 'settled';
      showToast(`Settled balances for "${grp.title}".`, 'success');
    }
  };

  const handleRemind = (groupTitle) => {
    showToast(`Payment reminder dispatched to "${groupTitle}" members.`, 'info');
  };

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen">
      <AnimatePresence>
        {selectedGroup && (
          <SplitDetail 
            key="detail"
            group={selectedGroup}
            groupExpenses={transactions.filter(t => t.isSplit && (t.groupId === selectedGroup.id || t.groupTitle === selectedGroup.title))}
            onBack={() => setSelectedGroup(null)} 
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Splits</h2>
          <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-0.5">Shared Bills & Group Balances</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-brand-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
        >
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
          <p className="text-xl font-bold text-brand-success tracking-tight">
            {formatCurrency(toReceive)}
          </p>
        </div>
        <div className="bg-brand-error/5 border border-brand-error/15 rounded-[16px] p-5 relative overflow-hidden group">
          <div className="text-brand-error mb-3">
            <ArrowUp size={20} />
          </div>
          <span className="text-[10px] text-txt-secondary/70 uppercase tracking-wider font-bold mb-1 block">To Pay</span>
          <p className="text-xl font-bold text-brand-error tracking-tight">
            {formatCurrency(toPay)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl mb-6">
        {['Groups', 'Your Splits'].map((t) => (
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
            groups.length > 0 ? (
              <div className="space-y-4">
                {groups.map((grp) => (
                  <SplitCard 
                    key={grp.id || grp.title}
                    group={grp}
                    onClick={() => setSelectedGroup(grp)} 
                    onSettle={handleSettle}
                    onRemind={handleRemind}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-brand-border rounded-[18px] p-8 shadow-brand-sm">
                <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl border border-brand-border flex items-center justify-center text-brand-primary mb-4 shadow-brand-sm">
                  <Users size={26} />
                </div>
                <h4 className="text-sm font-bold text-txt-primary">You haven't created any expense groups</h4>
                <p className="text-xs text-txt-secondary mt-1 max-w-[240px] leading-relaxed mb-5">
                  Split trips, dinners, and shared bills seamlessly with friends.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary py-2.5 px-5 text-xs w-auto inline-flex items-center gap-1.5 shadow-brand-sm"
                >
                  <Plus size={14} /> Create Group
                </button>
              </div>
            )
          ) : (
            individualSplits.length > 0 ? (
              <div className="space-y-3">
                {individualSplits.map((tx) => (
                  <div key={tx.id} className="bg-bg-card border border-brand-border rounded-xl p-4 flex justify-between items-center shadow-brand-sm">
                    <div>
                      <h4 className="text-sm font-semibold text-txt-primary">{tx.merchant}</h4>
                      <p className="text-xs text-txt-secondary mt-0.5">{tx.notes || `Split across ${tx.splitPeopleCount || 2} people`}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-brand-primary">{formatCurrency(tx.amount)}</span>
                      <span className="text-[10px] text-txt-secondary block font-medium">Split Recorded</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 bg-bg-card rounded-xl border border-brand-border flex items-center justify-center text-txt-secondary/40 mb-4">
                  <User size={22} />
                </div>
                <h4 className="text-txt-secondary/60 font-bold uppercase tracking-wider text-xs">No Individual Splits</h4>
                <p className="text-txt-secondary/40 text-[11px] mt-1 max-w-[220px] leading-relaxed">
                  Individual splits with friends will appear here once you split an expense.
                </p>
              </div>
            )
          )}
        </motion.div>
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[140] bg-brand-secondary/30 backdrop-blur-sm flex items-end justify-center">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-bg-card border-t border-brand-border rounded-t-[24px] px-6 pt-6 pb-10 z-10 text-txt-primary"
            >
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Create Expense Group</h3>
                <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer">
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
                      Group Name
                    </label>
                    {formErrors.title && (
                      <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
                        <AlertCircle size={10} /> {formErrors.title}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Goa Trip 2026, Flatmates"
                    value={newGroupTitle}
                    onChange={(e) => {
                      setNewGroupTitle(e.target.value);
                      if (formErrors.title) setFormErrors(prev => ({ ...prev, title: null }));
                    }}
                    className={`w-full bg-bg-app border rounded-xl px-4 py-3 text-sm font-semibold text-txt-primary outline-none ${formErrors.title ? 'border-brand-error' : 'border-brand-border focus:border-brand-primary'}`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
                      Estimated Members
                    </label>
                    {formErrors.members && (
                      <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
                        <AlertCircle size={10} /> {formErrors.members}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={newGroupMembers}
                    onChange={(e) => {
                      setNewGroupMembers(e.target.value);
                      if (formErrors.members) setFormErrors(prev => ({ ...prev, members: null }));
                    }}
                    className={`w-full bg-bg-app border rounded-xl px-4 py-3 text-sm font-semibold text-txt-primary outline-none ${formErrors.members ? 'border-brand-error' : 'border-brand-border focus:border-brand-primary'}`}
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" className="btn-primary rounded-xl shadow-brand-sm">
                    Create Group
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="h-32" />
    </div>
  );
};

export default Splits;
