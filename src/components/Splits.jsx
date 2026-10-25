import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, CheckCircle2, MoreHorizontal, MessageCircle, Plus,
  ArrowUp, ArrowDown, ArrowUpRight, ArrowDownLeft, User, X, AlertCircle,
  Bell, Settings, Search, Receipt, CreditCard, Clock, Sparkles,
  ChevronRight, Filter, Check, Share2, Send, Smartphone, ShieldCheck,
  RefreshCw, Info, Calendar, DollarSign
} from 'lucide-react';
import SplitDetail from './SplitDetail';
import { useNotifications } from '../context/NotificationContext';
import { formatCurrency, fromPaise, toPaise } from '../utils/currency.js';
import { 
  SPLIT_METHODS, 
  calculateEqualSplit, 
  calculateUnequalSplit, 
  calculatePercentageSplit 
} from '../utils/splitCalculations.js';
import { splitService } from '../services/splitService.js';
import { notificationService } from '../services/notificationService.js';

// Group Icon Presets
const GROUP_ICONS = [
  { icon: '🏖️', label: 'Trip / Vacation' },
  { icon: '🏠', label: 'Flatmates / Rent' },
  { icon: '🍕', label: 'Food / Outing' },
  { icon: '✈️', label: 'Travel / Flights' },
  { icon: '🍿', label: 'Entertainment' },
  { icon: '💼', label: 'Office / Projects' },
  { icon: '🚗', label: 'Transport / Roadtrip' },
  { icon: '🍻', label: 'Parties / Events' }
];

const Splits = ({ 
  groups: propGroups = [], 
  transactions = [], 
  userProfile = {}, 
  onAddGroup 
}) => {
  const { showToast } = useNotifications();

  // Primary State
  const [activeTab, setActiveTab] = useState('Groups'); // 'Overview', 'Groups', 'Recent Activity', 'Your Splits'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userGroups, setUserGroups] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification Preferences State
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('finovo_split_notification_prefs');
      return saved ? JSON.parse(saved) : {
        inApp: true,
        push: false,
        smsExpenses: true,
        smsInvitations: true,
        settlementReminders: true
      };
    } catch {
      return {
        inApp: true,
        push: false,
        smsExpenses: true,
        smsInvitations: true,
        settlementReminders: true
      };
    }
  });

  // Create Group Form State
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupIcon, setGroupIcon] = useState('🏖️');
  const [initialMembers, setInitialMembers] = useState([{ name: '', email: '', phone: '' }]);
  const [createGroupErrors, setCreateGroupErrors] = useState({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Global Add Expense Form State
  const [expenseGroupId, setExpenseGroupId] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayerId, setExpensePayerId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseSplitMethod, setExpenseSplitMethod] = useState(SPLIT_METHODS.EQUAL);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [customShares, setCustomShares] = useState({});
  const [percentageShares, setPercentageShares] = useState({});
  const [expenseError, setExpenseError] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Active Group Details for Add Expense Modal
  const [activeGroupData, setActiveGroupData] = useState(null);

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const userId = userProfile?.id;
    try {
      const { data: groupsData, error: groupsErr } = await splitService.fetchUserGroups(userId);
      if (groupsData && groupsData.length > 0) {
        setUserGroups(groupsData);
      } else if (propGroups && propGroups.length > 0) {
        // Fall back to props if service returns empty
        setUserGroups(propGroups);
      } else {
        setUserGroups([]);
      }

      // Collect recent activities from groups
      if (groupsData) {
        const allActs = [];
        groupsData.forEach(g => {
          if (Array.isArray(g.activities)) {
            g.activities.forEach(a => allActs.push({ ...a, groupTitle: g.name || g.title }));
          }
        });
        allActs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecentActivities(allActs.slice(0, 20));
      }

      // Load persistent user notifications
      if (userId) {
        const { data: notifData } = await notificationService.fetchUserNotifications(userId);
        if (notifData) {
          setNotifications(notifData);
          setUnreadCount(notifData.filter(n => !n.is_read).length);
        }
      }
    } catch (err) {
      console.warn('Error fetching split groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.id, propGroups]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load active group members when expense group changes
  useEffect(() => {
    if (!expenseGroupId) {
      setActiveGroupData(null);
      return;
    }
    const loadGroupForExpense = async () => {
      const { data } = await splitService.fetchGroupDetails(expenseGroupId, userProfile?.id);
      if (data) {
        setActiveGroupData(data);
        const mems = data.members || [];
        setSelectedMemberIds(mems.map(m => m.id));
        const userMem = mems.find(m => m.user_id === userProfile?.id);
        setExpensePayerId(userMem ? userMem.id : (mems[0]?.id || ''));
      }
    };
    loadGroupForExpense();
  }, [expenseGroupId, userProfile?.id]);

  // ---------------------------------------------------------------------------
  // Metrics & Computations (Strictly Distinguishing Owed vs Owe)
  // ---------------------------------------------------------------------------
  const metrics = useMemo(() => {
    let totalSharedPaise = 0;
    let totalOwedToUserPaise = 0; // Positive balances (others owe user)
    let totalUserOwesPaise = 0;   // Negative balances (user owes others)
    let totalSettledPaise = 0;
    let activeGroupsCount = userGroups.length;

    userGroups.forEach(grp => {
      totalSharedPaise += (grp.totalSharedPaise || toPaise(grp.amount || 0));
      totalSettledPaise += (grp.totalSettledPaise || 0);

      // Check current user's balance in this group
      if (grp.userBalancePaise !== undefined) {
        if (grp.userBalancePaise > 0) {
          totalOwedToUserPaise += grp.userBalancePaise;
        } else if (grp.userBalancePaise < 0) {
          totalUserOwesPaise += Math.abs(grp.userBalancePaise);
        }
      } else if (grp.type === 'credit' && grp.status !== 'settled') {
        totalOwedToUserPaise += toPaise(grp.amount || 0);
      } else if (grp.type === 'debt' && grp.status !== 'settled') {
        totalUserOwesPaise += toPaise(grp.amount || 0);
      }
    });

    const netPaise = totalOwedToUserPaise - totalUserOwesPaise;

    return {
      totalShared: fromPaise(totalSharedPaise),
      totalOwedToUser: fromPaise(totalOwedToUserPaise),
      totalUserOwes: fromPaise(totalUserOwesPaise),
      totalSettled: fromPaise(totalSettledPaise),
      netPosition: fromPaise(netPaise),
      netPaise,
      activeGroupsCount
    };
  }, [userGroups]);

  // Filtered groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return userGroups;
    const q = searchQuery.toLowerCase();
    return userGroups.filter(g => 
      (g.name && g.name.toLowerCase().includes(q)) || 
      (g.title && g.title.toLowerCase().includes(q)) ||
      (g.description && g.description.toLowerCase().includes(q))
    );
  }, [userGroups, searchQuery]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setCreateGroupErrors({ name: 'Group name is required' });
      return;
    }

    setCreateGroupErrors({});
    setIsCreatingGroup(true);

    try {
      const validInitialMembers = initialMembers
        .filter(m => m.name.trim() !== '')
        .map(m => ({
          name: m.name.trim(),
          email: m.email.trim() || null,
          phone: m.phone.trim() || null
        }));

      const groupPayload = {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        icon: groupIcon,
        initialMembers: validInitialMembers
      };

      const { data, error } = await splitService.createGroup(userProfile?.id, groupPayload);
      if (error) {
        showToast(error, 'warning');
      } else {
        showToast(`Group "${groupName}" created successfully!`, 'success');
        if (onAddGroup) onAddGroup(data);
        setShowCreateModal(false);
        setGroupName('');
        setGroupDescription('');
        setInitialMembers([{ name: '', email: '', phone: '' }]);
        await loadData();
      }
    } catch (err) {
      showToast('Failed to create group. Please try again.', 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAddMemberRow = () => {
    if (initialMembers.length < 15) {
      setInitialMembers(prev => [...prev, { name: '', email: '', phone: '' }]);
    }
  };

  const handleRemoveMemberRow = (index) => {
    setInitialMembers(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMemberChange = (index, field, value) => {
    setInitialMembers(prev => prev.map((item, idx) => 
      idx === index ? { ...item, [field]: value } : item
    ));
  };

  // Add Expense Calculation & Submission
  const calculatedShares = useMemo(() => {
    const totalPaise = toPaise(parseFloat(expenseAmount) || 0);
    if (totalPaise <= 0 || selectedMemberIds.length === 0) return [];

    try {
      if (expenseSplitMethod === SPLIT_METHODS.EQUAL) {
        return calculateEqualSplit(totalPaise, selectedMemberIds);
      } else if (expenseSplitMethod === SPLIT_METHODS.UNEQUAL) {
        const customPaise = {};
        selectedMemberIds.forEach(id => {
          customPaise[id] = toPaise(parseFloat(customShares[id]) || 0);
        });
        return calculateUnequalSplit(totalPaise, selectedMemberIds, customPaise);
      } else if (expenseSplitMethod === SPLIT_METHODS.PERCENTAGE) {
        const pctMap = {};
        selectedMemberIds.forEach(id => {
          pctMap[id] = parseFloat(percentageShares[id]) || 0;
        });
        return calculatePercentageSplit(totalPaise, selectedMemberIds, pctMap);
      }
    } catch {
      return [];
    }
    return [];
  }, [expenseAmount, expenseSplitMethod, selectedMemberIds, customShares, percentageShares]);

  const handleCreateExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseError('');

    if (!expenseGroupId) {
      setExpenseError('Please select a group.');
      return;
    }
    if (!expenseTitle.trim()) {
      setExpenseError('Please enter an expense description.');
      return;
    }
    const totalPaise = toPaise(parseFloat(expenseAmount) || 0);
    if (totalPaise <= 0) {
      setExpenseError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!expensePayerId) {
      setExpenseError('Please select who paid the bill.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setExpenseError('At least one member must be included in the split.');
      return;
    }

    // Validation for Unequal / Percentage
    if (expenseSplitMethod === SPLIT_METHODS.UNEQUAL) {
      const sumPaise = selectedMemberIds.reduce((sum, id) => sum + toPaise(parseFloat(customShares[id]) || 0), 0);
      if (sumPaise !== totalPaise) {
        setExpenseError(`Custom shares sum to ${formatCurrency(fromPaise(sumPaise))}, but total is ${formatCurrency(fromPaise(totalPaise))}.`);
        return;
      }
    }
    if (expenseSplitMethod === SPLIT_METHODS.PERCENTAGE) {
      const sumPct = selectedMemberIds.reduce((sum, id) => sum + (parseFloat(percentageShares[id]) || 0), 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        setExpenseError(`Percentages sum to ${sumPct}%. They must total exactly 100%.`);
        return;
      }
    }

    setIsSubmittingExpense(true);

    try {
      const expensePayload = {
        title: expenseTitle.trim(),
        totalAmountPaise: totalPaise,
        currency: 'INR',
        payerMemberId: expensePayerId,
        expenseDate,
        description: expenseDesc.trim() || null,
        splitMethod: expenseSplitMethod,
        shares: calculatedShares
      };

      const { data, error } = await splitService.createSplitExpense(expenseGroupId, userProfile?.id, expensePayload);
      if (error) {
        setExpenseError(error);
        setIsSubmittingExpense(false);
        return;
      }

      // Dispatch notifications to affected members
      const activeGrp = userGroups.find(g => g.id === expenseGroupId);
      if (activeGroupData?.members) {
        await notificationService.dispatchSplitExpenseCreated({
          expenseId: data.id,
          groupId: expenseGroupId,
          groupName: activeGrp?.name || activeGrp?.title || 'Expense Group',
          creatorName: userProfile?.name || 'A group member',
          amountPaise: totalPaise,
          currency: 'INR',
          shares: calculatedShares,
          members: activeGroupData.members
        });
      }

      showToast(`Expense "${expenseTitle}" added successfully!`, 'success');
      setShowAddExpenseModal(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDesc('');
      setCustomShares({});
      setPercentageShares({});
      await loadData();
    } catch (err) {
      setExpenseError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Notification Center Actions
  const handleMarkAllRead = async () => {
    if (userProfile?.id) {
      await notificationService.markAllAsRead(userProfile.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read.', 'info');
    }
  };

  const handleSavePreferences = () => {
    try {
      localStorage.setItem('finovo_split_notification_prefs', JSON.stringify(preferences));
      showToast('Notification preferences saved successfully.', 'success');
      setShowPreferencesModal(false);
    } catch (e) {
      showToast('Failed to save preferences.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // If a group is selected, render the complete SplitDetail view
  // ---------------------------------------------------------------------------
  if (selectedGroup) {
    return (
      <SplitDetail 
        groupId={selectedGroup.id}
        initialGroup={selectedGroup}
        userProfile={userProfile}
        onBack={() => {
          setSelectedGroup(null);
          loadData();
        }}
        onGroupUpdated={loadData}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Main Splits Dashboard Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen text-txt-primary">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary flex items-center gap-2">
            Splits
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20">
              Pro
            </span>
          </h2>
          <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-0.5">
            Shared Bills & Multi-Party Debt Simplification
          </p>
        </div>

        {/* Actions: Notifications, Preferences, Add Expense, New Group */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotificationDrawer(true)}
            title="Notification Center"
            className="relative w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary hover:border-brand-primary/30 transition-all cursor-pointer shadow-brand-sm"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-error text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-brand-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowPreferencesModal(true)}
            title="Notification Preferences"
            className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary hover:border-brand-primary/30 transition-all cursor-pointer shadow-brand-sm"
          >
            <Settings size={18} />
          </button>

          {/* Add Expense Quick Action */}
          <button
            onClick={() => {
              if (userGroups.length === 0) {
                showToast('Create a group first before adding split expenses.', 'info');
                setShowCreateModal(true);
              } else {
                setExpenseGroupId(userGroups[0].id);
                setShowAddExpenseModal(true);
              }
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-bg-card border border-brand-border hover:border-brand-primary/40 rounded-xl text-xs font-bold text-txt-primary transition-all cursor-pointer shadow-brand-sm"
          >
            <Plus size={15} className="text-brand-primary" />
            Add Expense
          </button>

          {/* Create Group Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-4 bg-brand-primary text-white rounded-xl flex items-center gap-2 text-xs font-bold shadow-brand-sm cursor-pointer hover:opacity-95 active:scale-95 transition-all"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">New Group</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION 3.A: OVERVIEW STATS GRID                                      */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {/* You Are Owed (Positive Credit) */}
        <div className="bg-brand-success/5 border border-brand-success/20 rounded-[18px] p-4 relative overflow-hidden group shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-txt-secondary/80 uppercase tracking-wider font-bold">
              You are Owed
            </span>
            <div className="w-7 h-7 rounded-lg bg-brand-success/15 text-brand-success flex items-center justify-center">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-brand-success tracking-tight">
            {formatCurrency(metrics.totalOwedToUser)}
          </p>
          <span className="text-[10px] text-txt-secondary mt-1 block">
            Money members owe you
          </span>
        </div>

        {/* You Owe (Negative Debt) */}
        <div className="bg-brand-error/5 border border-brand-error/20 rounded-[18px] p-4 relative overflow-hidden group shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-txt-secondary/80 uppercase tracking-wider font-bold">
              You Owe
            </span>
            <div className="w-7 h-7 rounded-lg bg-brand-error/15 text-brand-error flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-brand-error tracking-tight">
            {formatCurrency(metrics.totalUserOwes)}
          </p>
          <span className="text-[10px] text-txt-secondary mt-1 block">
            Your outstanding shares
          </span>
        </div>

        {/* Total Shared */}
        <div className="bg-bg-card border border-brand-border rounded-[18px] p-4 relative overflow-hidden group shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-txt-secondary/80 uppercase tracking-wider font-bold">
              Total Shared
            </span>
            <div className="w-7 h-7 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-txt-primary tracking-tight">
            {formatCurrency(metrics.totalShared)}
          </p>
          <span className="text-[10px] text-txt-secondary mt-1 block">
            Across {metrics.activeGroupsCount} active groups
          </span>
        </div>

        {/* Total Settled */}
        <div className="bg-bg-card border border-brand-border rounded-[18px] p-4 relative overflow-hidden group shadow-brand-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-txt-secondary/80 uppercase tracking-wider font-bold">
              Settled Debts
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-txt-primary tracking-tight">
            {formatCurrency(metrics.totalSettled)}
          </p>
          <span className="text-[10px] text-txt-secondary mt-1 block">
            Confirmed payments
          </span>
        </div>
      </div>

      {/* Overall Position Status Banner */}
      <div className="bg-bg-card border border-brand-border rounded-xl p-3.5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-brand-sm">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            metrics.netPaise > 0 
              ? 'bg-brand-success/10 text-brand-success' 
              : metrics.netPaise < 0 
                ? 'bg-brand-error/10 text-brand-error' 
                : 'bg-brand-primary/10 text-brand-primary'
          }`}>
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-txt-primary">
              {metrics.netPaise > 0 ? (
                <>Overall Position: <span className="text-brand-success font-extrabold">You are owed {formatCurrency(metrics.netPosition)}</span> in total</>
              ) : metrics.netPaise < 0 ? (
                <>Overall Position: <span className="text-brand-error font-extrabold">You owe {formatCurrency(Math.abs(metrics.netPosition))}</span> in total</>
              ) : (
                <>All settled up! Zero net outstanding balance across groups.</>
              )}
            </h4>
            <p className="text-[11px] text-txt-secondary">
              Balances automatically updated via integer paise arithmetic.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (userGroups.length === 0) setShowCreateModal(true);
            else {
              setExpenseGroupId(userGroups[0].id);
              setShowAddExpenseModal(true);
            }
          }}
          className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-1.5 shadow-brand-sm cursor-pointer whitespace-nowrap"
        >
          <Plus size={14} /> Add New Expense
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TABS NAVIGATION                                                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex bg-bg-card border border-brand-border p-1 rounded-xl mb-6">
        {[
          { id: 'Groups', label: `Groups (${userGroups.length})` },
          { id: 'Recent Activity', label: 'Recent Activity' },
          { id: 'Your Splits', label: 'Your Splits' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
              ${activeTab === tab.id ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
          >
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeSplitsSubTab" 
                className="absolute inset-0 bg-bg-app border border-brand-border rounded-lg shadow-brand-sm" 
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB CONTENT: GROUPS                                                   */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence mode="wait">
        {activeTab === 'Groups' && (
          <motion.div
            key="groups-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Search Bar */}
            <div className="relative mb-5">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups by name or purpose..."
                className="w-full bg-bg-card border border-brand-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-txt-primary outline-none focus:border-brand-primary transition-all placeholder:text-txt-secondary/50 shadow-brand-sm"
              />
            </div>

            {filteredGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGroups.map((grp) => {
                  const isSettled = grp.status === 'settled' || (grp.userBalancePaise === 0 && grp.totalSettledPaise > 0);
                  const isPositive = (grp.userBalancePaise > 0) || (grp.type === 'credit' && !isSettled);
                  const isNegative = (grp.userBalancePaise < 0) || (grp.type === 'debt' && !isSettled);
                  const balanceAmount = grp.userBalancePaise !== undefined 
                    ? Math.abs(fromPaise(grp.userBalancePaise)) 
                    : (grp.amount || 0);

                  return (
                    <motion.div
                      key={grp.id || grp.title}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedGroup(grp)}
                      className="bg-bg-card border border-brand-border rounded-[18px] p-5 cursor-pointer hover:border-brand-primary/40 active:bg-bg-card/90 transition-all shadow-brand-sm flex flex-col justify-between"
                    >
                      <div>
                        {/* Group Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 border border-brand-border flex items-center justify-center text-xl shadow-brand-sm">
                              {grp.icon || '🏖️'}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
                                {grp.name || grp.title}
                              </h4>
                              <p className="text-[11px] text-txt-secondary mt-0.5 line-clamp-1">
                                {grp.description || `${grp.members_count || grp.members || 2} members sharing expenses`}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-bg-app border border-brand-border text-txt-secondary">
                            {grp.members_count || grp.members || 2} Members
                          </span>
                        </div>

                        {/* Balance Details */}
                        <div className="bg-bg-app border border-brand-border rounded-xl p-3 my-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-txt-secondary uppercase tracking-wider font-bold block mb-0.5">
                              Your Balance
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-base font-bold ${
                                isSettled 
                                  ? 'text-txt-disabled' 
                                  : isPositive 
                                    ? 'text-brand-success' 
                                    : isNegative 
                                      ? 'text-brand-error' 
                                      : 'text-txt-primary'
                              }`}>
                                {isSettled ? 'All Settled' : formatCurrency(balanceAmount)}
                              </span>
                              {!isSettled && (
                                <span className={`text-[11px] font-semibold ${isPositive ? 'text-brand-success' : 'text-brand-error'}`}>
                                  {isPositive ? '(you are owed)' : '(you owe)'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-txt-secondary uppercase tracking-wider font-bold block mb-0.5">
                              Total Shared
                            </span>
                            <span className="text-xs font-bold text-txt-primary">
                              {formatCurrency(fromPaise(grp.totalSharedPaise || toPaise(grp.amount || 0)))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-brand-border/60">
                        <span className="text-[11px] text-txt-secondary flex items-center gap-1">
                          <Clock size={12} />
                          {grp.created_at ? new Date(grp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Active'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(grp);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary/20 transition-all cursor-pointer flex items-center gap-1"
                          >
                            Details <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-brand-border rounded-[20px] p-8 shadow-brand-sm">
                <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl border border-brand-border flex items-center justify-center text-brand-primary mb-4 shadow-brand-sm text-2xl">
                  🏖️
                </div>
                <h4 className="text-base font-bold text-txt-primary">No Expense Groups Found</h4>
                <p className="text-xs text-txt-secondary mt-1.5 max-w-[280px] leading-relaxed mb-6">
                  {searchQuery ? 'No groups match your search query. Try another term.' : 'Create a group to split trip expenses, house rent, or dinners with friends.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary py-2.5 px-5 text-xs w-auto inline-flex items-center gap-2 shadow-brand-sm"
                >
                  <Plus size={15} /> Create Your First Group
                </button>

                {/* Quick Templates */}
                <div className="mt-8 pt-6 border-t border-brand-border w-full max-w-md">
                  <span className="text-[10px] text-txt-secondary uppercase tracking-wider font-bold block mb-3">
                    Or pick a popular template:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {[
                      { name: 'Flatmates & Rent', icon: '🏠', desc: 'Household groceries & bills' },
                      { name: 'Goa Trip 2026', icon: '🏖️', desc: 'Flights, hotel & parties' },
                      { name: 'Office Lunch', icon: '🍕', desc: 'Team meals & coffee' },
                      { name: 'Family Expenses', icon: '💼', desc: 'Shared monthly utilities' }
                    ].map((tpl) => (
                      <button
                        key={tpl.name}
                        onClick={() => {
                          setGroupName(tpl.name);
                          setGroupIcon(tpl.icon);
                          setGroupDescription(tpl.desc);
                          setShowCreateModal(true);
                        }}
                        className="p-2.5 rounded-xl bg-bg-app border border-brand-border hover:border-brand-primary/40 flex items-center gap-2.5 text-xs font-semibold text-txt-primary transition-all text-left cursor-pointer"
                      >
                        <span className="text-base">{tpl.icon}</span>
                        <div>
                          <div className="font-bold text-[11px]">{tpl.name}</div>
                          <div className="text-[9px] text-txt-secondary line-clamp-1">{tpl.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB CONTENT: RECENT ACTIVITY                                        */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'Recent Activity' && (
          <motion.div
            key="activity-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div 
                  key={act.id} 
                  className="bg-bg-card border border-brand-border rounded-xl p-4 flex items-center justify-between shadow-brand-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-border flex items-center justify-center text-brand-primary">
                      {act.activity_type === 'expense_created' ? <Receipt size={18} /> :
                       act.activity_type === 'settlement_recorded' ? <CheckCircle2 size={18} className="text-brand-success" /> :
                       act.activity_type === 'member_joined' ? <UserPlus size={18} /> :
                       <Clock size={18} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-txt-primary">
                        {act.description}
                      </h4>
                      <p className="text-[10px] text-txt-secondary mt-0.5">
                        {act.groupTitle || 'Expense Group'} • {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {act.metadata?.amount_paise && (
                    <div className="text-right">
                      <span className="text-xs font-bold text-brand-primary block">
                        {formatCurrency(fromPaise(act.metadata.amount_paise))}
                      </span>
                      <span className="text-[9px] text-txt-secondary uppercase tracking-wider font-semibold">
                        {act.activity_type.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-card border border-brand-border rounded-[18px] p-8 shadow-brand-sm">
                <Clock size={24} className="text-txt-secondary/50 mb-3" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">No Recent Activity</h4>
                <p className="text-xs text-txt-secondary mt-1 max-w-[240px]">
                  Activities like added expenses, member invitations, and settled debts will appear here.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB CONTENT: YOUR SPLITS (ALL EXPENSES)                             */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'Your Splits' && (
          <motion.div
            key="splits-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {transactions.filter(t => t.isSplit).length > 0 ? (
              transactions.filter(t => t.isSplit).map((tx) => (
                <div key={tx.id} className="bg-bg-card border border-brand-border rounded-xl p-4 flex justify-between items-center shadow-brand-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-border flex items-center justify-center text-brand-primary">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-txt-primary">{tx.merchant}</h4>
                      <p className="text-[11px] text-txt-secondary mt-0.5">
                        {tx.notes || `Split across ${tx.splitPeopleCount || 2} members`} • {tx.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-brand-primary block">{formatCurrency(tx.amount)}</span>
                    <span className="text-[9px] text-txt-secondary uppercase tracking-wider font-semibold">Split Logged</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-card border border-brand-border rounded-[18px] p-8 shadow-brand-sm">
                <Receipt size={24} className="text-txt-secondary/50 mb-3" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">No Split Expenses Recorded</h4>
                <p className="text-xs text-txt-secondary mt-1 max-w-[240px]">
                  When you record expenses in any of your groups, your allocated shares will appear here.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE GROUP                                                   */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[140] bg-brand-secondary/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="relative w-full max-w-lg bg-bg-card border border-brand-border rounded-t-[24px] sm:rounded-[24px] p-6 z-10 text-txt-primary shadow-brand-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-txt-primary">Create Expense Group</h3>
                  <p className="text-[11px] text-txt-secondary">Set up shared expenses for trips, flatmates, or events.</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                {/* Group Icon Selector */}
                <div>
                  <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-2">
                    Group Icon
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {GROUP_ICONS.map((item) => (
                      <button
                        key={item.icon}
                        type="button"
                        onClick={() => setGroupIcon(item.icon)}
                        className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer flex-shrink-0 ${
                          groupIcon === item.icon 
                            ? 'bg-brand-primary/15 border-brand-primary ring-2 ring-brand-primary/20 scale-105' 
                            : 'bg-bg-app border-brand-border hover:border-brand-primary/30'
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Group Name */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
                      Group Name *
                    </label>
                    {createGroupErrors.name && (
                      <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
                        <AlertCircle size={10} /> {createGroupErrors.name}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Goa Trip 2026, Flatmates 402, Office Lunch"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      if (createGroupErrors.name) setCreateGroupErrors({});
                    }}
                    className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                  />
                </div>

                {/* Group Description */}
                <div>
                  <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Short description or purpose"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs text-txt-primary outline-none focus:border-brand-primary"
                  />
                </div>

                {/* Initial Members */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
                        Add Initial Members (Optional)
                      </label>
                      <span className="text-[10px] text-txt-secondary">
                        Registered users or phone/email contacts
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMemberRow}
                      className="text-[10px] font-bold text-brand-primary flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus size={12} /> Add More
                    </button>
                  </div>

                  <div className="space-y-2">
                    {initialMembers.map((member, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Member Name"
                          value={member.name}
                          onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                          className="flex-1 bg-bg-app border border-brand-border rounded-xl px-3 py-2 text-xs text-txt-primary outline-none focus:border-brand-primary"
                        />
                        <input
                          type="text"
                          placeholder="Email or Mobile"
                          value={member.email || member.phone || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('@')) {
                              handleMemberChange(index, 'email', val);
                            } else {
                              handleMemberChange(index, 'phone', val);
                            }
                          }}
                          className="flex-1 bg-bg-app border border-brand-border rounded-xl px-3 py-2 text-xs text-txt-primary outline-none focus:border-brand-primary"
                        />
                        {initialMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberRow(index)}
                            className="w-8 h-8 rounded-xl bg-bg-app border border-brand-border text-txt-secondary hover:text-brand-error flex items-center justify-center cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-brand-border text-xs font-bold text-txt-secondary hover:text-txt-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingGroup}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingGroup ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: GLOBAL ADD EXPENSE                                             */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-[140] bg-brand-secondary/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowAddExpenseModal(false)} />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="relative w-full max-w-lg bg-bg-card border border-brand-border rounded-t-[24px] sm:rounded-[24px] p-6 z-10 text-txt-primary shadow-brand-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-txt-primary">Add Shared Expense</h3>
                  <p className="text-[11px] text-txt-secondary">Record a bill and divide shares accurately.</p>
                </div>
                <button 
                  onClick={() => setShowAddExpenseModal(false)} 
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {expenseError && (
                <div className="mb-4 p-3 rounded-xl bg-brand-error/10 border border-brand-error/20 flex items-center gap-2 text-xs text-brand-error font-medium">
                  <AlertCircle size={15} />
                  <span>{expenseError}</span>
                </div>
              )}

              <form onSubmit={handleCreateExpenseSubmit} className="space-y-4">
                {/* Select Group */}
                <div>
                  <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                    Select Group *
                  </label>
                  <select
                    value={expenseGroupId}
                    onChange={(e) => setExpenseGroupId(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
                  >
                    {userGroups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.icon || '🏖️'} {grp.name || grp.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                      Expense Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dinner, Cab, Grocery"
                      value={expenseTitle}
                      onChange={(e) => setExpenseTitle(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                      Total Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Paid By & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                      Paid By *
                    </label>
                    <select
                      value={expensePayerId}
                      onChange={(e) => setExpensePayerId(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
                    >
                      {activeGroupData?.members?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.user_id} {m.user_id === userProfile?.id ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-4 py-2.5 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Split Method Tabs */}
                <div>
                  <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block mb-2">
                    Split Method
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-bg-app p-1 rounded-xl border border-brand-border">
                    {[
                      { id: SPLIT_METHODS.EQUAL, label: 'Split Equally' },
                      { id: SPLIT_METHODS.UNEQUAL, label: 'Exact Amounts' },
                      { id: SPLIT_METHODS.PERCENTAGE, label: 'Percentages' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setExpenseSplitMethod(m.id)}
                        className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          expenseSplitMethod === m.id
                            ? 'bg-brand-primary text-white shadow-brand-sm'
                            : 'text-txt-secondary hover:text-txt-primary'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Participants Selection & Breakdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider">
                      Participants in Split ({selectedMemberIds.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMemberIds.length === activeGroupData?.members?.length) {
                          setSelectedMemberIds([]);
                        } else {
                          setSelectedMemberIds(activeGroupData?.members?.map(m => m.id) || []);
                        }
                      }}
                      className="text-[10px] font-bold text-brand-primary hover:underline cursor-pointer"
                    >
                      {selectedMemberIds.length === activeGroupData?.members?.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeGroupData?.members?.map((mem) => {
                      const isSelected = selectedMemberIds.includes(mem.id);
                      const share = calculatedShares.find(s => s.memberId === mem.id);

                      return (
                        <div
                          key={mem.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-bg-app border-brand-primary/40' 
                              : 'bg-bg-app/40 border-brand-border opacity-60'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMemberIds(prev => [...prev, mem.id]);
                                } else {
                                  setSelectedMemberIds(prev => prev.filter(id => id !== mem.id));
                                }
                              }}
                              className="accent-brand-primary"
                            />
                            <span className="text-xs font-semibold text-txt-primary">
                              {mem.name || 'Member'} {mem.user_id === userProfile?.id ? '(You)' : ''}
                            </span>
                          </label>

                          {/* Split-specific input */}
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              {expenseSplitMethod === SPLIT_METHODS.UNEQUAL && (
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="₹ Amount"
                                  value={customShares[mem.id] || ''}
                                  onChange={(e) => setCustomShares({ ...customShares, [mem.id]: e.target.value })}
                                  className="w-24 bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-right font-semibold text-txt-primary outline-none focus:border-brand-primary"
                                />
                              )}
                              {expenseSplitMethod === SPLIT_METHODS.PERCENTAGE && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="%"
                                    value={percentageShares[mem.id] || ''}
                                    onChange={(e) => setPercentageShares({ ...percentageShares, [mem.id]: e.target.value })}
                                    className="w-16 bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-right font-semibold text-txt-primary outline-none focus:border-brand-primary"
                                  />
                                  <span className="text-xs text-txt-secondary font-bold">%</span>
                                </div>
                              )}
                              {share && (
                                <span className="text-xs font-bold text-brand-primary min-w-[70px] text-right">
                                  {formatCurrency(fromPaise(share.allocatedSharePaise))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-brand-border text-xs font-bold text-txt-secondary hover:text-txt-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingExpense}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingExpense ? 'Saving Expense...' : 'Save & Split Expense'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* DRAWER: NOTIFICATION CENTER                                           */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {showNotificationDrawer && (
          <div className="fixed inset-0 z-[150] bg-brand-secondary/40 backdrop-blur-sm flex justify-end">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowNotificationDrawer(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="relative w-full max-w-md bg-bg-card border-l border-brand-border h-full p-6 z-10 text-txt-primary shadow-brand-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-txt-primary">Notifications</h3>
                      <p className="text-[10px] text-txt-secondary">Expense alerts, payments & invitations</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNotificationDrawer(false)} 
                    className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                {unreadCount > 0 && (
                  <div className="flex items-center justify-between bg-bg-app border border-brand-border p-2.5 rounded-xl mb-4">
                    <span className="text-xs font-semibold text-txt-secondary">
                      You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-brand-primary hover:underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  </div>
                )}

                {/* Notifications List */}
                <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.is_read) {
                            await notificationService.markAsRead(n.id);
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
                            setUnreadCount(prev => Math.max(0, prev - 1));
                          }
                          if (n.group_id) {
                            const targetGrp = userGroups.find(g => g.id === n.group_id);
                            if (targetGrp) {
                              setSelectedGroup(targetGrp);
                              setShowNotificationDrawer(false);
                            }
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          !n.is_read 
                            ? 'bg-brand-primary/5 border-brand-primary/30' 
                            : 'bg-bg-app border-brand-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-xs font-bold text-txt-primary">{n.title}</h5>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-txt-secondary mt-1 leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[9px] text-txt-secondary/60 mt-2 block font-medium">
                          {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16">
                      <Bell size={24} className="text-txt-secondary/40 mx-auto mb-2" />
                      <p className="text-xs text-txt-secondary">No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom footer button */}
              <button
                onClick={() => {
                  setShowNotificationDrawer(false);
                  setShowPreferencesModal(true);
                }}
                className="w-full py-2.5 rounded-xl border border-brand-border bg-bg-app text-xs font-semibold text-txt-secondary hover:text-txt-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
              >
                <Settings size={14} /> Notification Preferences
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: NOTIFICATION PREFERENCES                                       */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {showPreferencesModal && (
          <div className="fixed inset-0 z-[150] bg-brand-secondary/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowPreferencesModal(false)} />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="relative w-full max-w-md bg-bg-card border border-brand-border rounded-t-[24px] sm:rounded-[24px] p-6 z-10 text-txt-primary shadow-brand-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-txt-primary">Notification Settings</h3>
                  <p className="text-[11px] text-txt-secondary">Configure in-app, SMS, and push delivery rules.</p>
                </div>
                <button 
                  onClick={() => setShowPreferencesModal(false)} 
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3.5 my-5">
                {[
                  { key: 'inApp', title: 'In-App Notifications', desc: 'Real-time banners & bell alerts inside Finovo.' },
                  { key: 'push', title: 'Web Push Notifications', desc: 'Browser alerts when you receive a split share.' },
                  { key: 'smsExpenses', title: 'SMS Expense Notifications', desc: 'SMS dispatches when offline or unregistered.' },
                  { key: 'smsInvitations', title: 'SMS Group Invitations', desc: 'Secure invite link sent to unverified phones.' },
                  { key: 'settlementReminders', title: 'Settlement Reminders', desc: 'Gentle nudges for pending debt settlements.' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-bg-app border border-brand-border">
                    <div className="pr-3">
                      <h5 className="text-xs font-bold text-txt-primary">{item.title}</h5>
                      <p className="text-[10px] text-txt-secondary mt-0.5">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[item.key]}
                        onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreferencesModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-brand-border text-xs font-bold text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex-1 btn-primary py-2.5 text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="h-28" />
    </div>
  );
};

export default Splits;
