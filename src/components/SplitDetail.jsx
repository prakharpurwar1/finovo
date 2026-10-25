import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, CheckCircle2, ArrowUpRight, ArrowDownRight,
  Info, Receipt, Plus, UserPlus, CreditCard, Clock, Sparkles,
  ChevronRight, X, AlertCircle, Share2, Copy, DollarSign, Wallet
} from 'lucide-react';
import { formatCurrency, fromPaise, toPaise } from '../utils/currency.js';
import { 
  SPLIT_METHODS, 
  calculateEqualSplit, 
  calculateUnequalSplit, 
  calculatePercentageSplit 
} from '../utils/splitCalculations.js';
import { splitService } from '../services/splitService.js';
import { notificationService } from '../services/notificationService.js';
import { useNotifications } from '../context/NotificationContext';

const SplitDetail = ({ 
  onBack, 
  groupId, 
  initialGroup, 
  userProfile = {},
  onGroupUpdated 
}) => {
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState('Overview'); // 'Overview', 'Expenses', 'Settlements', 'Activity'
  const [groupDetails, setGroupDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Add Expense Form State
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [expenseDescription, setExpenseDescription] = useState('');
  const [payerMemberId, setPayerMemberId] = useState('');
  const [splitMethod, setSplitMethod] = useState(SPLIT_METHODS.EQUAL);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [customShares, setCustomShares] = useState({}); // { [memberId]: amount }
  const [percentageShares, setPercentageShares] = useState({}); // { [memberId]: percentage }
  const [expenseError, setExpenseError] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Settlement Form State
  const [settlePayerId, setSettlePayerId] = useState('');
  const [settleRecipientId, setSettleRecipientId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('upi');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Invite Form State
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // Load group details from service
  const loadGroupData = async () => {
    setIsLoading(true);
    const { data, error } = await splitService.fetchGroupDetails(groupId, userProfile?.id);
    if (data) {
      setGroupDetails(data);
      // Default payer and selected members
      const userMember = data.members.find(m => m.user_id === userProfile?.id);
      if (userMember && !payerMemberId) {
        setPayerMemberId(userMember.id);
      } else if (data.members[0] && !payerMemberId) {
        setPayerMemberId(data.members[0].id);
      }
      if (selectedMemberIds.length === 0) {
        setSelectedMemberIds(data.members.map(m => m.id));
      }
    } else if (error) {
      showToast(error, 'warning');
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    loadGroupData();
  }, [groupId, userProfile?.id]);

  const group = groupDetails?.group || initialGroup;
  const members = groupDetails?.members || [];
  const expenses = groupDetails?.expenses || [];
  const settlements = groupDetails?.settlements || [];
  const activities = groupDetails?.activities || [];
  const memberBalances = groupDetails?.memberBalances || [];
  const simplifiedDebts = groupDetails?.simplifiedDebts || [];
  const totalSpend = groupDetails?.totalShared || 0;
  const totalSettled = groupDetails?.totalSettled || 0;

  // Find user's member object and balance in this group
  const currentUserMember = members.find(m => m.user_id === userProfile?.id);
  const currentUserBalance = currentUserMember 
    ? memberBalances.find(b => b.memberId === currentUserMember.id) 
    : null;

  // Handle Add Expense Submission
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setExpenseError('');

    const numAmount = parseFloat(expenseAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setExpenseError('Please enter a valid expense amount greater than zero.');
      return;
    }
    if (!expenseTitle.trim()) {
      setExpenseError('Please enter an expense title.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setExpenseError('Please select at least one participant.');
      return;
    }

    const participants = members
      .filter(m => selectedMemberIds.includes(m.id))
      .map(m => ({ id: m.id, name: m.name }));

    let splitResult;
    if (splitMethod === SPLIT_METHODS.EQUAL) {
      splitResult = calculateEqualSplit({ totalAmount: numAmount, participants });
    } else if (splitMethod === SPLIT_METHODS.UNEQUAL) {
      const customList = participants.map(p => ({
        memberId: p.id,
        name: p.name,
        amount: parseFloat(customShares[p.id] || 0)
      }));
      splitResult = calculateUnequalSplit({ totalAmount: numAmount, customShares: customList });
    } else if (splitMethod === SPLIT_METHODS.PERCENTAGE) {
      const pctList = participants.map(p => ({
        memberId: p.id,
        name: p.name,
        percentage: parseFloat(percentageShares[p.id] || 0)
      }));
      splitResult = calculatePercentageSplit({ totalAmount: numAmount, percentageShares: pctList });
    }

    if (!splitResult || !splitResult.valid) {
      setExpenseError(splitResult?.error || 'Invalid share allocation.');
      return;
    }

    setIsSubmittingExpense(true);
    const { data: createdExp, error } = await splitService.createSplitExpense(groupId, {
      creatorId: userProfile?.id,
      payerMemberId,
      title: expenseTitle.trim(),
      description: expenseDescription.trim(),
      amount: numAmount,
      splitMethod,
      date: expenseDate,
      shares: splitResult.shares
    });

    if (error) {
      setExpenseError(error);
      setIsSubmittingExpense(false);
      return;
    }

    // Dispatch in-app & SMS notifications
    const payerObj = members.find(m => m.id === payerMemberId);
    await notificationService.dispatchSplitExpenseCreated({
      group: { ...group, members },
      expense: createdExp,
      shares: splitResult.shares,
      actorName: payerObj?.name || userProfile?.name || 'A member'
    });

    showToast(`Added "${expenseTitle}" to ${group.name}.`, 'success');
    setShowAddExpenseModal(false);
    setIsSubmittingExpense(false);
    // Reset fields
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseDescription('');
    setCustomShares({});
    setPercentageShares({});
    await loadGroupData();
    if (onGroupUpdated) onGroupUpdated();
  };

  // Handle Settlement Submission
  const handleRecordSettlement = async (e) => {
    e.preventDefault();
    setSettleError('');

    const numAmount = parseFloat(settleAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setSettleError('Please enter a valid settlement amount.');
      return;
    }
    if (!settlePayerId || !settleRecipientId) {
      setSettleError('Please select both the paying member and the receiving member.');
      return;
    }
    if (settlePayerId === settleRecipientId) {
      setSettleError('Paying member and receiving member cannot be the same person.');
      return;
    }

    setIsSubmittingSettlement(true);
    const { data: createdSetl, error } = await splitService.recordSettlement(groupId, {
      payerMemberId: settlePayerId,
      recipientMemberId: settleRecipientId,
      amount: numAmount,
      paymentMethod: settleMethod,
      notes: settleNotes.trim(),
      createdBy: userProfile?.id
    });

    if (error) {
      setSettleError(error);
      setIsSubmittingSettlement(false);
      return;
    }

    const payer = members.find(m => m.id === settlePayerId);
    const recipient = members.find(m => m.id === settleRecipientId);
    await notificationService.dispatchSettlementRecorded({
      group,
      settlement: createdSetl,
      payerName: payer?.name || 'A member',
      recipientMember: recipient
    });

    showToast(`Payment of ${formatCurrency(numAmount)} recorded successfully.`, 'success');
    setShowSettlementModal(false);
    setIsSubmittingSettlement(false);
    setSettleAmount('');
    setSettleNotes('');
    await loadGroupData();
    if (onGroupUpdated) onGroupUpdated();
  };

  // Handle Member Invitation
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteName.trim()) {
      showToast('Member name is required.', 'warning');
      return;
    }

    setIsInviting(true);
    const { data, error } = await splitService.inviteMember(groupId, {
      name: inviteName.trim(),
      email: inviteEmail.trim() || null,
      phone: invitePhone.trim() || null,
      inviterId: userProfile?.id
    });

    setIsInviting(false);
    if (error) {
      showToast(error, 'warning');
      return;
    }

    setGeneratedInviteLink(data.inviteUrl);
    showToast(`Invitation created for ${inviteName}.`, 'success');
    await loadGroupData();
    if (onGroupUpdated) onGroupUpdated();
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast('Invitation link copied to clipboard.', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-app flex flex-col overflow-hidden text-txt-primary">
      {/* Top Navigation Bar */}
      <div className="p-4 sm:p-6 pt-10 flex items-center justify-between border-b border-brand-border bg-bg-card/90 backdrop-blur-md z-10">
        <button 
          onClick={onBack} 
          aria-label="Back to groups"
          className="w-10 h-10 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer shadow-brand-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-txt-primary">{group?.name}</h2>
          <p className="text-[10px] text-txt-secondary font-medium">{members.length} Members • Split Ledger</p>
        </div>
        <button 
          onClick={() => {
            setGeneratedInviteLink('');
            setInviteName('');
            setInviteEmail('');
            setInvitePhone('');
            setShowInviteModal(true);
          }}
          aria-label="Invite member"
          className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary hover:bg-brand-primary/20 cursor-pointer shadow-brand-sm"
        >
          <UserPlus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Group Hero Section */}
        <div className="p-5 sm:p-6 text-center bg-bg-card border-b border-brand-border relative">
          <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-1 block">Total Shared Expense</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary mb-3 tracking-tight">
            {formatCurrency(totalSpend)}
          </h1>

          {/* User's Personal Net Position in this Group */}
          {currentUserBalance && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border mb-3 text-xs font-bold shadow-brand-sm bg-bg-app">
              <span className="text-[10px] uppercase font-bold text-txt-secondary">Your Balance:</span>
              <span className={`flex items-center gap-1 ${
                currentUserBalance.netBalance > 0 
                  ? 'text-brand-success' 
                  : currentUserBalance.netBalance < 0 
                  ? 'text-brand-error' 
                  : 'text-txt-secondary'
              }`}>
                {currentUserBalance.netBalance > 0 && <ArrowUpRight size={14} />}
                {currentUserBalance.netBalance < 0 && <ArrowDownRight size={14} />}
                {currentUserBalance.netBalance === 0 ? 'Settled Up' : (
                  currentUserBalance.netBalance > 0 
                    ? `You are owed ${formatCurrency(currentUserBalance.netBalance)}`
                    : `You owe ${formatCurrency(Math.abs(currentUserBalance.netBalance))}`
                )}
              </span>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex justify-center gap-2.5 mt-2">
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="btn-primary py-2.5 px-4 text-xs font-bold w-auto inline-flex items-center gap-1.5 shadow-brand-sm cursor-pointer"
            >
              <Plus size={16} /> Add Expense
            </button>
            <button
              onClick={() => {
                // Pre-populate if debt exists
                if (simplifiedDebts.length > 0) {
                  setSettlePayerId(simplifiedDebts[0].fromMemberId);
                  setSettleRecipientId(simplifiedDebts[0].toMemberId);
                  setSettleAmount(simplifiedDebts[0].amount.toString());
                }
                setShowSettlementModal(true);
              }}
              className="py-2.5 px-4 rounded-xl border border-brand-border bg-bg-app hover:bg-bg-subtle text-txt-primary text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-brand-sm"
            >
              <CreditCard size={15} className="text-brand-primary" /> Settle Up
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-4 sm:px-6 my-4">
          <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl shadow-brand-sm">
            {['Overview', 'Expenses', 'Settlements', 'Activity'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer text-center
                  ${activeTab === t ? 'text-white' : 'text-txt-secondary hover:text-txt-primary'}`}
              >
                {activeTab === t && (
                  <motion.div 
                    layoutId="activeGroupDetailTab" 
                    className="absolute inset-0 bg-brand-primary rounded-lg shadow-brand-sm" 
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="px-4 sm:px-6">
          <AnimatePresence mode="wait">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'Overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-5"
              >
                {/* Simplified Debt Plan */}
                {simplifiedDebts.length > 0 && (
                  <div className="bg-gradient-to-r from-brand-primary/10 via-brand-primary/5 to-transparent border border-brand-primary/20 rounded-2xl p-4.5 shadow-brand-sm">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-txt-primary">Smart Settlement Plan</h4>
                        <p className="text-[10px] text-brand-primary font-semibold">Min-Transfers Optimization</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      {simplifiedDebts.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-bg-card border border-brand-border rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-txt-primary">{item.fromName}</span>
                            <span className="text-[10px] text-txt-secondary">pays</span>
                            <span className="font-bold text-brand-primary">{item.toName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-txt-primary">{formatCurrency(item.amount)}</span>
                            <button
                              onClick={() => {
                                setSettlePayerId(item.fromMemberId);
                                setSettleRecipientId(item.toMemberId);
                                setSettleAmount(item.amount.toString());
                                setShowSettlementModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-brand-primary text-white text-[10px] font-bold cursor-pointer hover:opacity-90"
                            >
                              Settle
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Member Breakdown */}
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Member Balances</h3>
                    <span className="text-[10px] text-txt-secondary font-bold uppercase">{memberBalances.length} Members</span>
                  </div>

                  <div className="space-y-2.5">
                    {memberBalances.map((mem) => {
                      const isOwed = mem.netBalance > 0;
                      const owes = mem.netBalance < 0;
                      return (
                        <div key={mem.memberId} className="flex items-center justify-between p-3.5 bg-bg-card border border-brand-border rounded-xl shadow-brand-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center font-bold text-sm text-brand-primary">
                              {mem.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs sm:text-sm font-semibold text-txt-primary">{mem.name}</h4>
                                {mem.role === 'admin' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-txt-secondary mt-0.5">
                                Paid: {formatCurrency(mem.paid)} • Share: {formatCurrency(mem.share)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-xs sm:text-sm font-bold flex items-center justify-end gap-1 ${
                              isOwed ? 'text-brand-success' : owes ? 'text-brand-error' : 'text-txt-secondary'
                            }`}>
                              {isOwed && <ArrowUpRight size={13} />}
                              {owes && <ArrowDownRight size={13} />}
                              {mem.netBalance === 0 ? 'Settled' : formatCurrency(Math.abs(mem.netBalance))}
                            </div>
                            <span className="text-[9px] uppercase font-semibold text-txt-secondary block mt-0.5">
                              {isOwed ? 'Gets back' : owes ? 'Owes group' : 'All clear'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: EXPENSES */}
            {activeTab === 'Expenses' && (
              <motion.div
                key="expenses"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Expense Records</h3>
                  <button
                    onClick={() => setShowAddExpenseModal(true)}
                    className="text-xs font-bold text-brand-primary flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Plus size={14} /> Add New
                  </button>
                </div>

                {expenses.length > 0 ? (
                  expenses.map((exp) => (
                    <div key={exp.id} className="bg-bg-card border border-brand-border rounded-xl p-4 shadow-brand-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-txt-primary">{exp.title}</h4>
                          <p className="text-[11px] text-txt-secondary mt-0.5">
                            Paid by <strong className="text-txt-primary">{exp.payer?.name || 'A member'}</strong> • {exp.date}
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary uppercase">
                            {exp.split_method} Split
                          </span>
                        </div>
                        <span className="text-base font-extrabold text-txt-primary">
                          {formatCurrency(exp.amount || fromPaise(exp.amount_paise))}
                        </span>
                      </div>

                      {/* Shares breakdown */}
                      {exp.shares && exp.shares.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-brand-border/60 flex flex-wrap gap-2">
                          {exp.shares.map((sh, idx) => {
                            const memberName = members.find(m => m.id === sh.member_id)?.name || 'Member';
                            return (
                              <span key={idx} className="text-[10px] bg-bg-app border border-brand-border px-2 py-0.5 rounded-md text-txt-secondary font-medium">
                                {memberName}: {formatCurrency(fromPaise(sh.allocated_share_paise))}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center bg-bg-card border border-brand-border rounded-2xl p-6 shadow-brand-sm">
                    <Receipt size={28} className="text-txt-secondary/40 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-txt-primary">No Expenses Recorded</h4>
                    <p className="text-xs text-txt-secondary mt-1 max-w-[240px] mx-auto">
                      Add expenses and choose who split them to automatically track balances.
                    </p>
                    <button
                      onClick={() => setShowAddExpenseModal(true)}
                      className="btn-primary py-2 px-4 text-xs font-bold inline-flex w-auto mx-auto mt-4 cursor-pointer"
                    >
                      <Plus size={14} /> Add First Expense
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: SETTLEMENTS */}
            {activeTab === 'Settlements' && (
              <motion.div
                key="settlements"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Confirmed Payments</h3>
                  <button
                    onClick={() => setShowSettlementModal(true)}
                    className="text-xs font-bold text-brand-primary flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <CreditCard size={14} /> Record Payment
                  </button>
                </div>

                {settlements.length > 0 ? (
                  settlements.map((setl) => (
                    <div key={setl.id} className="bg-bg-card border border-brand-border rounded-xl p-4 shadow-brand-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-success/10 text-brand-success border border-brand-success/20 flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="font-bold text-txt-primary">{setl.payer?.name}</span>
                            <span className="text-txt-secondary">paid</span>
                            <span className="font-bold text-brand-primary">{setl.recipient?.name}</span>
                          </div>
                          <p className="text-[10px] text-txt-secondary mt-0.5">
                            via {setl.payment_method?.toUpperCase()} • {setl.notes || 'Confirmed Settlement'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-brand-success">
                        +{formatCurrency(fromPaise(setl.amount_paise))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center bg-bg-card border border-brand-border rounded-2xl p-6 shadow-brand-sm">
                    <CheckCircle2 size={28} className="text-txt-secondary/40 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-txt-primary">No Payments Recorded Yet</h4>
                    <p className="text-xs text-txt-secondary mt-1 max-w-[240px] mx-auto">
                      When members pay back their shares, record settlements here to bring balances back to zero.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 4: ACTIVITY LOG */}
            {activeTab === 'Activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-4"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary px-1">Audit Trail & History</h3>
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className="flex gap-3 bg-bg-card border border-brand-border p-3.5 rounded-xl shadow-brand-sm">
                      <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                        <Clock size={16} />
                      </div>
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-txt-primary">
                            {act.activity_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[9px] text-txt-secondary">
                            {new Date(act.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-txt-secondary mt-1">
                          {act.details?.title ? `Expense: "${act.details.title}"` : ''}
                          {act.details?.amount ? ` • ${formatCurrency(act.details.amount)}` : ''}
                          {act.details?.groupName ? `Created group "${act.details.groupName}"` : ''}
                          {act.details?.memberName ? `Invited participant: ${act.details.memberName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 1. ADD SPLIT EXPENSE MODAL */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl p-5 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
                <h3 className="text-sm font-bold text-txt-primary">Add Group Expense</h3>
                <button 
                  onClick={() => setShowAddExpenseModal(false)}
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {expenseError && (
                  <div className="p-3 bg-brand-error/10 border border-brand-error/20 rounded-xl text-brand-error text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{expenseError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Expense Title</label>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Goa Villa Booking, Dinner, Groceries"
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Total Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary focus:border-brand-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Paid By</label>
                  <select
                    value={payerMemberId}
                    onChange={(e) => setPayerMemberId(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary focus:border-brand-primary outline-none"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.user_id === userProfile?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Split Method Selector */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Split Method</label>
                  <div className="flex bg-bg-app p-1 rounded-xl border border-brand-border gap-1">
                    {[
                      { id: SPLIT_METHODS.EQUAL, label: 'Equal Split' },
                      { id: SPLIT_METHODS.UNEQUAL, label: 'Exact Amounts' },
                      { id: SPLIT_METHODS.PERCENTAGE, label: 'Percentage' }
                    ].map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSplitMethod(method.id)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          splitMethod === method.id 
                            ? 'bg-brand-primary text-white shadow-brand-sm' 
                            : 'text-txt-secondary hover:text-txt-primary'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participant Selection and Share Inputs */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1.5">Participants</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {members.map(m => {
                      const isSelected = selectedMemberIds.includes(m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between p-2.5 bg-bg-app border border-brand-border rounded-xl">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-txt-primary">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMemberIds([...selectedMemberIds, m.id]);
                                } else {
                                  setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id));
                                }
                              }}
                              className="rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                            />
                            <span>{m.name}</span>
                          </label>

                          {isSelected && splitMethod === SPLIT_METHODS.UNEQUAL && (
                            <input
                              type="number"
                              step="0.01"
                              placeholder="₹ Amount"
                              value={customShares[m.id] || ''}
                              onChange={(e) => setCustomShares({ ...customShares, [m.id]: e.target.value })}
                              className="w-24 bg-bg-card border border-brand-border rounded-lg p-1.5 text-xs text-right font-bold text-txt-primary outline-none"
                            />
                          )}

                          {isSelected && splitMethod === SPLIT_METHODS.PERCENTAGE && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                placeholder="%"
                                value={percentageShares[m.id] || ''}
                                onChange={(e) => setPercentageShares({ ...percentageShares, [m.id]: e.target.value })}
                                className="w-16 bg-bg-card border border-brand-border rounded-lg p-1.5 text-xs text-right font-bold text-txt-primary outline-none"
                              />
                              <span className="text-xs text-txt-secondary">%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="btn-primary py-3 text-xs font-bold mt-2 cursor-pointer shadow-brand-sm"
                >
                  {isSubmittingExpense ? 'Recording Expense...' : 'Save Group Expense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. RECORD SETTLEMENT MODAL */}
      <AnimatePresence>
        {showSettlementModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl p-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
                <h3 className="text-sm font-bold text-txt-primary">Record Payment Settlement</h3>
                <button 
                  onClick={() => setShowSettlementModal(false)}
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleRecordSettlement} className="space-y-3.5 text-xs">
                {settleError && (
                  <div className="p-2.5 bg-brand-error/10 border border-brand-error/20 rounded-xl text-brand-error text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{settleError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Paying Member</label>
                  <select
                    value={settlePayerId}
                    onChange={(e) => setSettlePayerId(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                  >
                    <option value="">Select Payer</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Receiving Member</label>
                  <select
                    value={settleRecipientId}
                    onChange={(e) => setSettleRecipientId(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                  >
                    <option value="">Select Recipient</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Settlement Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Payment Method</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                  >
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="bank_transfer">Bank Transfer / IMPS</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSettlement}
                  className="btn-primary py-3 text-xs font-bold mt-2 cursor-pointer shadow-brand-sm"
                >
                  {isSubmittingSettlement ? 'Confirming...' : 'Confirm Payment'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. INVITE MEMBER MODAL */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl p-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-brand-border mb-3">
                <h3 className="text-sm font-bold text-txt-primary">Invite to {group?.name}</h3>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {!generatedInviteLink ? (
                <form onSubmit={handleInvite} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-txt-secondary tracking-wider block mb-1">Mobile Number (For SMS Invite)</label>
                    <input
                      type="tel"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs text-txt-primary outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isInviting}
                    className="btn-primary py-3 text-xs font-bold mt-2 cursor-pointer shadow-brand-sm"
                  >
                    {isInviting ? 'Generating Invite...' : 'Generate Invite Link'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-brand-success/10 border border-brand-success/20 rounded-xl text-brand-success text-center">
                    <CheckCircle2 size={24} className="mx-auto mb-1" />
                    <p className="font-bold">Invitation Created!</p>
                    <p className="text-[10px] text-txt-secondary mt-0.5">Share this secure link with {inviteName}:</p>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-bg-app border border-brand-border rounded-xl">
                    <input 
                      type="text" 
                      readOnly 
                      value={generatedInviteLink} 
                      className="w-full bg-transparent text-[10px] text-txt-secondary truncate outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedInviteLink)}
                      className="p-2 bg-brand-primary text-white rounded-lg cursor-pointer hover:opacity-90 shrink-0"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="w-full py-2.5 bg-bg-app border border-brand-border text-txt-primary font-bold rounded-xl text-xs cursor-pointer hover:bg-bg-subtle"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SplitDetail;
