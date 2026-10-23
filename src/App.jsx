import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './context/ThemeContext';
import { useNotifications } from './context/NotificationContext';
import SplashScreen from './components/SplashScreen';
import AuthFlow from './components/AuthFlow';
import OnboardingFlow from './components/OnboardingFlow';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Insights from './components/Insights';
import Splits from './components/Splits';
import Profile from './components/Profile';
import NotificationSystem from './components/NotificationSystem';
import CategorySelect from './components/CategorySelect';
import AddExpense from './components/AddExpense';
import TransactionDetails from './components/TransactionDetails';
import { getDemoTransactions } from './data/demoFixtures.js';
import { detectGender } from './utils/avatar.js';
import { transactionService } from './services/transactionService.js';
import { budgetService } from './services/budgetService.js';
import { categoryRuleService } from './services/categoryRuleService.js';
import { savingsGoalService } from './services/savingsGoalService.js';
import CsvExportModal from './components/CsvExportModal.jsx';
import { 
  isSupabaseConfigured, 
  getCurrentSession, 
  onAuthStateChange, 
  signOutUser, 
  fetchUserProfile, 
  fetchUserPreferences, 
  updateUserProfileRemote, 
  upsertUserPreferencesRemote 
} from './lib/supabaseClient.js';

function App() {
  const [appState, setAppState] = useState('splash'); // 'splash', 'auth', 'onboarding', 'main'
  const [activeTab, setActiveTab] = useState('home');
  const [sessionRestored, setSessionRestored] = useState(() => !isSupabaseConfigured());
  const { darkMode } = useTheme();
  const { notificationsEnabled, sendNotification } = useNotifications();

  // User Profile strictly driven by authenticated user
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('finovo_user');
      return saved ? JSON.parse(saved) : { 
        name: 'Finovo Member', 
        email: '', 
        budgetLimit: 45000,
        createdAt: new Date().toISOString(),
        isPremium: false,
        smsPermission: 'Not Requested',
        aiCategorizationEnabled: true
      };
    } catch {
      return { 
        name: 'Finovo Member', 
        email: '', 
        budgetLimit: 45000,
        createdAt: new Date().toISOString(),
        isPremium: false,
        smsPermission: 'Not Requested',
        aiCategorizationEnabled: true
      };
    }
  });

  // Transactions state - Supabase PostgreSQL is the source of truth
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);
  const activeUserIdRef = useRef(null);

  // User-defined Smart Category Rules
  const [userRules, setUserRules] = useState([]);

  // Spending Budgets state
  const [budgets, setBudgets] = useState([]);

  // Savings Goals state
  const [savingsGoals, setSavingsGoals] = useState([]);

  // CSV Export Modal state
  const [showCsvExportModal, setShowCsvExportModal] = useState(false);

  // Groups initialized strictly for current authenticated user
  const [groups, setGroups] = useState(() => {
    try {
      const savedUser = localStorage.getItem('finovo_user');
      const user = savedUser ? JSON.parse(savedUser) : null;
      if (user?.id) {
        const userSaved = localStorage.getItem(`finovo_groups_${user.id}`);
        return userSaved ? JSON.parse(userSaved) : [];
      }
      return [];
    } catch (e) {
      console.warn('Error reading scoped groups', e);
      return [];
    }
  });

  // Reusable loader for user-defined categorization rules
  const loadUserRules = useCallback(async (userId) => {
    if (!userId) {
      setUserRules([]);
      return;
    }
    try {
      const { data } = await categoryRuleService.fetchUserRules(userId);
      setUserRules(data || []);
    } catch (e) {
      console.warn('Error loading user category rules:', e);
    }
  }, []);

  // Reusable loader for spending budgets
  const loadBudgets = useCallback(async (userId) => {
    if (!userId) {
      setBudgets([]);
      return;
    }
    try {
      const { data } = await budgetService.fetchBudgets(userId);
      setBudgets(data || []);
    } catch (e) {
      console.warn('Error loading budgets:', e);
    }
  }, []);

  // Reusable loader for savings goals
  const loadSavingsGoals = useCallback(async (userId) => {
    if (!userId) {
      setSavingsGoals([]);
      return;
    }
    try {
      const { data } = await savingsGoalService.fetchGoals(userId);
      setSavingsGoals(data || []);
    } catch (e) {
      console.warn('Error loading savings goals:', e);
    }
  }, []);

  // Reusable loader for transactions with active-user race protection
  const loadTransactions = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured()) {
      setTransactions([]);
      return;
    }

    activeUserIdRef.current = userId;
    setIsLoadingTransactions(true);
    setTransactionsError(null);

    try {
      const { data, error } = await transactionService.fetchTransactions({ userId });
      // Guard against stale async resolution if active user changed in-flight
      if (activeUserIdRef.current !== userId) return;

      if (error) {
        console.error('Error fetching transactions from Supabase:', error);
        setTransactionsError(error.message || 'Failed to load transactions');
      } else {
        setTransactions(data || []);
      }
    } catch (err) {
      if (activeUserIdRef.current === userId) {
        console.error('Network error during transaction fetch:', err);
        setTransactionsError(err.message || 'Network connection issue while loading transactions.');
      }
    } finally {
      if (activeUserIdRef.current === userId) {
        setIsLoadingTransactions(false);
      }
    }
  }, []);

  // Session restoration and live Supabase auth listener
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let isMounted = true;

    // Check active session on initial load
    getCurrentSession().then(async ({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Session restoration check encountered an error:', error);
      }

      if (session?.user) {
        let fullName = session.user.user_metadata?.full_name;
        let isPremium = false;
        let preferences = null;
        let remoteBudgetAmount = null;

        try {
          const profileRes = await fetchUserProfile(session.user.id);
          if (profileRes?.data) {
            fullName = profileRes.data.full_name || fullName;
            isPremium = Boolean(profileRes.data.is_premium);
          }
          const prefRes = await fetchUserPreferences(session.user.id);
          if (prefRes?.data) {
            preferences = prefRes.data;
          }
          const budgetRes = await budgetService.fetchGlobalMonthlyBudget(session.user.id);
          if (budgetRes?.data?.amount) {
            remoteBudgetAmount = budgetRes.data.amount;
          }
        } catch (e) {
          console.warn('Remote profile retrieval skipped:', e);
        }

        const detectedGender = detectGender(fullName || session.user.email?.split('@')[0] || '');
        const restoredUser = {
          id: session.user.id,
          name: fullName || session.user.email?.split('@')[0] || 'Finovo Member',
          email: session.user.email || '',
          gender: preferences?.gender || detectedGender,
          avatarStyle: preferences?.avatar_style || 'avatar',
          budgetLimit: remoteBudgetAmount || preferences?.budget_limit || 45000,
          createdAt: session.user.created_at || new Date().toISOString(),
          isPremium,
          smsPermission: preferences?.sms_permission || 'Not Requested',
          categorizationPreference: preferences?.categorization_preference || 'instant',
          aiCategorizationEnabled: preferences?.ai_categorization_enabled !== false
        };

        setUserProfile(restoredUser);
        try {
          localStorage.setItem('finovo_user', JSON.stringify(restoredUser));
          const userSavedGrp = localStorage.getItem(`finovo_groups_${session.user.id}`);
          setGroups(userSavedGrp ? JSON.parse(userSavedGrp) : []);
        } catch {
          // ignore storage error
        }

        // Load real persisted transactions, rules, budgets, and savings goals
        activeUserIdRef.current = session.user.id;
        loadTransactions(session.user.id);
        loadUserRules(session.user.id);
        loadBudgets(session.user.id);
        loadSavingsGoals(session.user.id);
      }
      setSessionRestored(true);
    });

    // Real-time auth subscription
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        activeUserIdRef.current = session.user.id;
        loadTransactions(session.user.id);
        loadUserRules(session.user.id);
        loadBudgets(session.user.id);
        loadSavingsGoals(session.user.id);
        
        try {
          const userSavedGrp = localStorage.getItem(`finovo_groups_${session.user.id}`);
          setGroups(userSavedGrp ? JSON.parse(userSavedGrp) : []);
        } catch {
          // ignore
        }
        setUserProfile(prev => ({
          ...prev,
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || (session.user.email ? session.user.email.split('@')[0] : prev.name)
        }));

        budgetService.fetchGlobalMonthlyBudget(session.user.id).then(budgetRes => {
          if (budgetRes?.data?.amount) {
            setUserProfile(prev => ({
              ...prev,
              budgetLimit: budgetRes.data.amount
            }));
          }
        }).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        activeUserIdRef.current = null;
        setTransactions([]);
        setUserRules([]);
        setBudgets([]);
        setSavingsGoals([]);
        setTransactionsError(null);
        setGroups([]);
        setUserProfile({
          name: 'Finovo Member',
          email: '',
          budgetLimit: 45000,
          createdAt: new Date().toISOString(),
          isPremium: false,
          smsPermission: 'Not Requested',
          aiCategorizationEnabled: true
        });
        try {
          localStorage.removeItem('finovo_user');
        } catch {
          // ignore
        }
        setAppState('auth');
      }
    });

    return () => {
      isMounted = false;
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [loadTransactions, loadUserRules, loadBudgets, loadSavingsGoals]);

  const updateUserProfile = (updates) => {
    setUserProfile(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('finovo_user', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving user profile', e);
      }

      // Synchronize with remote Supabase profile, preferences and budgets if authenticated
      if (next.id && isSupabaseConfigured()) {
        if (updates.name) {
          updateUserProfileRemote(next.id, { full_name: updates.name }).catch(() => {});
        }
        if (updates.smsPermission || updates.categorizationPreference || updates.aiCategorizationEnabled !== undefined) {
          upsertUserPreferencesRemote(next.id, {
            sms_permission: next.smsPermission,
            categorization_preference: next.categorizationPreference,
            ai_categorization_enabled: next.aiCategorizationEnabled !== false
          }).catch(() => {});
        }
        if (updates.budgetLimit && Number(updates.budgetLimit) > 0) {
          budgetService.upsertBudget(next.id, { amount: Number(updates.budgetLimit) }).catch((err) => {
            console.warn('Remote budget persistence error:', err);
          });
        }
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    activeUserIdRef.current = null;
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Error during sign out', e);
    }
    try {
      localStorage.removeItem('finovo_user');
    } catch {
      // ignore
    }
    setTransactions([]);
    setUserRules([]);
    setBudgets([]);
    setSavingsGoals([]);
    setTransactionsError(null);
    setGroups([]);
    setUserProfile({
      name: 'Finovo Member',
      email: '',
      budgetLimit: 45000,
      createdAt: new Date().toISOString(),
      isPremium: false,
      smsPermission: 'Not Requested',
      aiCategorizationEnabled: true
    });
    setAppState('auth');
  };

  // Personal rule creation, update, toggle and deletion handlers for smart categorisation
  const handleSaveUserRule = async ({ merchantPattern, categoryName, matchType = 'exact', transactionType = 'all', isActive = true }) => {
    if (!userProfile?.id || !merchantPattern) return { error: new Error('User and merchant pattern required') };
    try {
      const { data, error } = await categoryRuleService.createUserRule(userProfile.id, {
        merchantPattern,
        categoryName,
        matchType,
        transactionType,
        isActive
      });
      if (error) throw error;
      if (data) {
        setUserRules(prev => {
          const filtered = prev.filter(r => r.id !== data.id && r.merchantPattern.toLowerCase() !== merchantPattern.trim().toLowerCase());
          return categoryRuleService.sortRulesByPrecedence([data, ...filtered]);
        });
        if (notificationsEnabled) {
          sendNotification({
            title: 'Rule Saved',
            message: `Rule for "${merchantPattern}" saved successfully (${categoryName}).`,
            type: 'success'
          });
        }
        return { data };
      }
    } catch (err) {
      console.warn('Failed to save user rule:', err);
      return { error: err };
    }
  };

  const handleUpdateUserRule = async (ruleId, updates) => {
    if (!userProfile?.id || !ruleId) return { error: new Error('Rule ID and user required') };
    try {
      const { data, error } = await categoryRuleService.updateUserRule(userProfile.id, ruleId, updates);
      if (error) throw error;
      if (data) {
        setUserRules(prev => {
          const updated = prev.map(r => r.id === ruleId ? data : r);
          return categoryRuleService.sortRulesByPrecedence(updated);
        });
        if (notificationsEnabled) {
          sendNotification({
            title: 'Rule Updated',
            message: `Updated rule for "${data.merchantPattern}".`,
            type: 'success'
          });
        }
        return { data };
      }
    } catch (err) {
      console.warn('Failed to update user rule:', err);
      return { error: err };
    }
  };

  const handleToggleUserRule = async (ruleId) => {
    if (!userProfile?.id || !ruleId) return { error: new Error('Rule ID required') };
    try {
      const { data, error } = await categoryRuleService.toggleUserRule(userProfile.id, ruleId);
      if (error) throw error;
      if (data) {
        setUserRules(prev => {
          const updated = prev.map(r => r.id === ruleId ? data : r);
          return categoryRuleService.sortRulesByPrecedence(updated);
        });
        return { data };
      }
    } catch (err) {
      console.warn('Failed to toggle user rule:', err);
      return { error: err };
    }
  };

  const handleDeleteUserRule = async (ruleId) => {
    if (!userProfile?.id || !ruleId) return { error: new Error('Rule ID required') };
    try {
      const { error } = await categoryRuleService.deleteUserRule(userProfile.id, ruleId);
      if (error) throw error;
      setUserRules(prev => prev.filter(r => r.id !== ruleId));
      if (notificationsEnabled) {
        sendNotification({
          title: 'Rule Deleted',
          message: 'The categorization rule was removed.',
          type: 'info'
        });
      }
      return { success: true };
    } catch (err) {
      console.warn('Failed to delete user rule:', err);
      return { error: err };
    }
  };

  const handleApplyHistoricalRecategorisation = async (updates) => {
    if (!userProfile?.id || !updates || updates.length === 0) return { count: 0 };
    try {
      const { count, error } = await transactionService.applyHistoricalRecategorisation(userProfile.id, updates);
      if (error) throw error;
      await loadTransactions(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Historical Recategorisation',
          message: `Successfully recategorised ${count} past transaction${count === 1 ? '' : 's'}.`,
          type: 'success'
        });
      }
      return { count };
    } catch (err) {
      console.warn('Failed to apply historical recategorisation:', err);
      throw err;
    }
  };

  // Budget management handlers
  const handleSaveBudget = async (budgetData) => {
    if (!userProfile?.id) throw new Error('Authentication required to manage budgets');
    try {
      const { data, error } = await budgetService.upsertBudget(userProfile.id, budgetData);
      if (error) throw error;
      await loadBudgets(userProfile.id);
      if (!budgetData.categoryName && budgetData.amount) {
        setUserProfile(prev => ({ ...prev, budgetLimit: Number(budgetData.amount) }));
      }
      if (notificationsEnabled) {
        sendNotification({
          title: 'Budget Saved',
          message: `${budgetData.categoryName || 'Global'} budget set to ₹${Number(budgetData.amount).toLocaleString('en-IN')}`,
          type: 'success'
        });
      }
      return { data };
    } catch (err) {
      console.warn('Failed to save budget:', err);
      throw err;
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    if (!userProfile?.id) throw new Error('Authentication required');
    try {
      const { error } = await budgetService.deleteBudget(userProfile.id, budgetId);
      if (error) throw error;
      await loadBudgets(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Budget Deleted',
          message: 'The budget was removed.',
          type: 'info'
        });
      }
    } catch (err) {
      console.warn('Failed to delete budget:', err);
      throw err;
    }
  };

  // Savings goal management handlers
  const handleCreateGoal = async (goalData) => {
    if (!userProfile?.id) throw new Error('Authentication required');
    try {
      const { data, error } = await savingsGoalService.createGoal(userProfile.id, goalData);
      if (error) throw error;
      await loadSavingsGoals(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Goal Created',
          message: `Savings goal "${goalData.name}" created.`,
          type: 'success'
        });
      }
      return { data };
    } catch (err) {
      console.warn('Failed to create savings goal:', err);
      throw err;
    }
  };

  const handleUpdateGoal = async (goalId, updates) => {
    if (!userProfile?.id) throw new Error('Authentication required');
    try {
      const { data, error } = await savingsGoalService.updateGoal(userProfile.id, goalId, updates);
      if (error) throw error;
      await loadSavingsGoals(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Goal Updated',
          message: 'Goal details updated successfully.',
          type: 'success'
        });
      }
      return { data };
    } catch (err) {
      console.warn('Failed to update savings goal:', err);
      throw err;
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!userProfile?.id) throw new Error('Authentication required');
    try {
      const { error } = await savingsGoalService.deleteGoal(userProfile.id, goalId);
      if (error) throw error;
      await loadSavingsGoals(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Goal Removed',
          message: 'Savings goal deleted.',
          type: 'info'
        });
      }
    } catch (err) {
      console.warn('Failed to delete savings goal:', err);
      throw err;
    }
  };

  const handleAddContribution = async (goalId, amount, note) => {
    if (!userProfile?.id) throw new Error('Authentication required');
    try {
      const { data, error } = await savingsGoalService.addContribution(userProfile.id, goalId, amount, note);
      if (error) throw error;
      await loadSavingsGoals(userProfile.id);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Contribution Recorded',
          message: `Added ₹${Number(amount).toLocaleString('en-IN')} to your savings goal!`,
          type: 'success'
        });
      }
      return { data };
    } catch (err) {
      console.warn('Failed to record contribution:', err);
      throw err;
    }
  };

  // CSV Transactions batch import
  const handleImportCsvTransactions = async (rows) => {
    if (!userProfile?.id) throw new Error('Authentication required to import transactions');
    if (!rows || rows.length === 0) return { importedCount: 0, failedCount: 0 };

    let importedCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      try {
        const { error } = await transactionService.createTransaction(userProfile.id, {
          date: row.date,
          amount: row.amount,
          type: row.type || 'expense',
          category: row.category || 'Uncategorized',
          merchant: row.merchant || 'Bank Transaction',
          notes: row.notes || (row.bankTxId ? `Ref: ${row.bankTxId}` : 'Imported via CSV'),
          bankTxId: row.bankTxId || null,
          source: 'csv_import'
        });
        if (error) {
          failedCount++;
        } else {
          importedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    await loadTransactions(userProfile.id);

    if (notificationsEnabled) {
      sendNotification({
        title: 'CSV Import Completed',
        message: `Imported ${importedCount} transactions${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
        type: importedCount > 0 ? 'success' : 'error'
      });
    }

    return { importedCount, failedCount };
  };

  // Clear all personal account data
  const handleClearAccountData = async () => {
    if (!userProfile?.id) return;
    try {
      for (const tx of transactions) {
        if (!tx.isDemo) {
          await transactionService.deleteTransaction(userProfile.id, tx.id).catch(() => {});
        }
      }
      setTransactions([]);
      setUserRules([]);
      setBudgets([]);
      setSavingsGoals([]);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Account Ledger Reset',
          message: 'All personal transactions, budgets, and goals have been reset.',
          type: 'info'
        });
      }
    } catch (err) {
      console.warn('Failed to clear account data:', err);
    }
  };

  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [detailsStartWithEdit, setDetailsStartWithEdit] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    if (userProfile?.id) {
      try {
        localStorage.setItem(`finovo_groups_${userProfile.id}`, JSON.stringify(groups));
      } catch (e) {
        console.warn('Error saving groups', e);
      }
    }
  }, [groups, userProfile?.id]);

  // Handle optional SMS Demo import (helpful on-demand onboarding guide)
  const handleSimulateSMS = () => {
    const sample = getDemoTransactions();
    setTransactions(prev => [...sample, ...prev]);
    if (notificationsEnabled) {
      sendNotification({
        title: 'SMS Demo Imported',
        message: '3 simulated sample payments added for testing.',
        type: 'success'
      });
    }
  };

  const handleAddGroup = (newGroup) => {
    const groupWithId = {
      ...newGroup,
      id: `grp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      amount: newGroup.amount || 0,
      members: newGroup.members || 2,
      type: newGroup.type || 'credit'
    };
    setGroups(prev => [groupWithId, ...prev]);
    if (notificationsEnabled) {
      sendNotification({
        title: 'Group Created',
        message: `Group "${newGroup.title}" created successfully.`,
        type: 'success'
      });
    }
  };

  useEffect(() => {
    // Show a smart notification if uncategorized transactions exist
    if (appState === 'main' && notificationsEnabled && transactions.length > 0) {
      const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized').length;
      if (uncategorizedCount > 0) {
        const timer = setTimeout(() => {
          setNotificationMessage(`${uncategorizedCount} transactions need categorization`);
          setShowNotification(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [appState, notificationsEnabled, transactions]);

  // CREATE TRANSACTION: Persists to Supabase PostgreSQL with RLS and minor unit precision
  const handleAddTransaction = async (newTx) => {
    if (!userProfile?.id) {
      throw new Error('Authentication required: please log in to record transactions.');
    }

    const { data, error } = await transactionService.createTransaction(userProfile.id, newTx);
    if (error) {
      throw error;
    }

    // Prepend persisted row with PostgreSQL UUID to active UI state
    setTransactions(prev => [data, ...prev]);

    if (notificationsEnabled) {
      sendNotification({
        title: data.type === 'income' ? 'Income Recorded' : 'Expense Recorded',
        message: `₹${Number(data.amount).toLocaleString('en-IN')} recorded for ${data.merchant || 'Merchant'}.`,
        type: 'success'
      });
    }
    return data;
  };

  // DELETE TRANSACTION: Removes row from PostgreSQL and verifies RLS ownership
  const handleDeleteTransaction = async (txId) => {
    if (!userProfile?.id) {
      throw new Error('Authentication required: please log in to delete transactions.');
    }

    const targetTx = transactions.find(t => t.id === txId);
    if (targetTx?.isDemo) {
      setTransactions(prev => prev.filter(tx => tx.id !== txId));
      setShowTransactionDetails(false);
      setSelectedTx(null);
      return;
    }

    const { success, error } = await transactionService.deleteTransaction(userProfile.id, txId);
    if (error || !success) {
      throw error || new Error('Failed to delete transaction from database.');
    }

    setTransactions(prev => prev.filter(tx => tx.id !== txId));
    setShowTransactionDetails(false);
    setSelectedTx(null);

    if (notificationsEnabled) {
      sendNotification({
        title: 'Transaction Deleted',
        message: 'The transaction was permanently deleted from your records.',
        type: 'info'
      });
    }
  };

  // UPDATE TRANSACTION: Updates row in PostgreSQL and refreshes UI data
  const handleUpdateTransaction = async (updatedTx) => {
    if (!userProfile?.id) {
      throw new Error('Authentication required: please log in to update transactions.');
    }

    if (updatedTx.isDemo) {
      setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
      setSelectedTx(updatedTx);
      return updatedTx;
    }

    const { data, error } = await transactionService.updateTransaction(userProfile.id, updatedTx.id, updatedTx);
    if (error) {
      throw error;
    }

    setTransactions(prev => prev.map(tx => tx.id === data.id ? data : tx));
    setSelectedTx(data);

    if (notificationsEnabled) {
      sendNotification({
        title: 'Transaction Updated',
        message: `Details updated for ${data.merchant}.`,
        type: 'success'
      });
    }
    return data;
  };

  // CATEGORY MOVE: Updates category in PostgreSQL, saves rule if requested, and updates UI
  const handleConfirmCategory = async (txId, categoryName, options = {}) => {
    if (options.saveRule && options.merchant) {
      handleSaveUserRule({
        merchantPattern: options.merchant,
        categoryName,
        matchType: options.matchType || 'exact',
        transactionType: options.transactionType || 'all'
      });
    }

    const isManual = options.isManualCategory ?? true;
    const targetTx = transactions.find(t => t.id === txId);
    if (targetTx && !targetTx.isDemo && userProfile?.id) {
      try {
        await transactionService.updateTransaction(userProfile.id, txId, { 
          category: categoryName,
          isManualCategory: isManual
        });
      } catch (err) {
        console.warn('Failed to update category in database:', err);
      }
    }

    let nextTx = null;
    setTransactions(prev => {
      const updated = prev.map(tx => {
        if (tx.id === txId) {
          return { 
            ...tx, 
            category: categoryName,
            isManualCategory: isManual
          };
        }
        return tx;
      });
      // Find the next uncategorized transaction in the updated list
      const remaining = updated.filter(t => t.category === 'Uncategorized');
      if (remaining.length > 0) {
        nextTx = remaining[0];
      }
      return updated;
    });

    setShowCategorySelect(false);

    if (nextTx) {
      setTimeout(() => {
        setSelectedTx(nextTx);
        setShowCategorySelect(true);
      }, 300);
    } else {
      setSelectedTx(null);
      if (notificationsEnabled) {
        sendNotification({
          title: 'Categorized',
          message: 'Transactions successfully categorized!',
          type: 'success'
        });
      }
    }
  };

  const handleCategorizeQuickAction = () => {
    const uncategorized = transactions.filter(t => t.category === 'Uncategorized');
    if (uncategorized.length > 0) {
      setSelectedTx(uncategorized[0]);
      setShowCategorySelect(true);
    } else {
      alert('All transactions are already categorized!');
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case 'history': 
        return (
          <History 
            transactions={transactions}
            isLoading={isLoadingTransactions}
            error={transactionsError}
            onRetry={() => loadTransactions(userProfile?.id)}
            onAdd={() => setShowAddExpense(true)}
            onOpenExport={() => setShowCsvExportModal(true)}
            onSelectTx={(tx, startWithEdit) => {
              setSelectedTx(tx);
              setDetailsStartWithEdit(startWithEdit);
              setShowTransactionDetails(true);
            }}
          />
        );
      case 'insights':
        return (
          <Insights
            transactions={transactions}
            userProfile={userProfile}
            onAdd={() => setShowAddExpense(true)}
            onGoToProfile={() => setActiveTab('profile')}
          />
        );
      case 'splits': 
        return (
          <Splits 
            groups={groups}
            transactions={transactions}
            onAddGroup={handleAddGroup}
            onAdd={() => setShowAddExpense(true)} 
          />
        );
      case 'profile': 
        return (
          <Profile 
            onLogout={handleSignOut} 
            userProfile={userProfile} 
            onUpdateProfile={updateUserProfile} 
            userRules={userRules}
            onDeleteUserRule={handleDeleteUserRule}
            onAddUserRule={handleSaveUserRule}
            onUpdateUserRule={handleUpdateUserRule}
            onToggleUserRule={handleToggleUserRule}
            onApplyHistoricalRecategorisation={handleApplyHistoricalRecategorisation}
            transactions={transactions}
            budgets={budgets}
            onSaveBudget={handleSaveBudget}
            onDeleteBudget={handleDeleteBudget}
            savingsGoals={savingsGoals}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            onAddContribution={handleAddContribution}
            onImportTransactions={handleImportCsvTransactions}
            onClearAccountData={handleClearAccountData}
          />
        );
      default: 
        return (
          <Dashboard 
            transactions={transactions}
            userProfile={userProfile}
            onSelectTx={(tx) => {
              setSelectedTx(tx);
              setDetailsStartWithEdit(false);
              setShowTransactionDetails(true);
            }} 
            onAdd={() => setShowAddExpense(true)}
            onGoToHistory={() => setActiveTab('history')}
            onCategorize={handleCategorizeQuickAction}
            onGoToSplits={() => setActiveTab('splits')}
            onGoToAnalytics={() => setActiveTab('insights')}
            onSimulateSMS={handleSimulateSMS}
          />
        );
    }
  };

  return (
    <div className={`mobile-container min-h-screen relative overflow-hidden bg-bg-app text-txt-primary ${darkMode ? 'dark' : ''}`}>
      <AnimatePresence mode="wait">
        {appState === 'splash' && (
          <SplashScreen 
            key="splash" 
            onComplete={() => {
              // If valid restored Supabase session exists, proceed directly to main; else auth
              if (sessionRestored && userProfile?.id && isSupabaseConfigured()) {
                setAppState('main');
              } else {
                setAppState('auth');
              }
            }} 
          />
        )}

        {appState === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <AuthFlow onComplete={(data) => {
              if (data) {
                const detectedGender = detectGender(data.name || '');
                updateUserProfile({ ...data, gender: detectedGender });
                setTransactions([]);
                setGroups([]);
              }
              setAppState('onboarding');
            }} />
          </motion.div>
        )}

        {appState === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <OnboardingFlow onComplete={(data) => {
              if (data) {
                updateUserProfile({
                  ...(data.budget ? { budgetLimit: data.budget } : {}),
                  ...(data.smsPermission ? { smsPermission: data.smsPermission } : {}),
                  ...(data.categorizationPreference ? { categorizationPreference: data.categorizationPreference } : {})
                });
              }
              setAppState('main');
            }} />
          </motion.div>
        )}

        {appState === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col"
          >
            {showCategorySelect && (
              <CategorySelect 
                tx={selectedTx}
                userRules={userRules}
                userProfile={userProfile}
                onConfirmCategory={handleConfirmCategory}
                onBack={() => {
                  setShowCategorySelect(false);
                  setSelectedTx(null);
                }} 
              />
            )}
            
            {showAddExpense && (
              <AddExpense 
                onBack={() => setShowAddExpense(false)} 
                onAddTransaction={handleAddTransaction}
                groups={groups}
                userRules={userRules}
                userProfile={userProfile}
                onSaveUserRule={handleSaveUserRule}
              />
            )}

            <Layout activeTab={activeTab} onTabChange={setActiveTab} onAdd={() => setShowAddExpense(true)}>
              {renderMainContent()}
            </Layout>

            <AnimatePresence>
              {showTransactionDetails && selectedTx && (
                <TransactionDetails
                  tx={selectedTx}
                  startInEditMode={detailsStartWithEdit}
                  userRules={userRules}
                  userProfile={userProfile}
                  onSaveUserRule={handleSaveUserRule}
                  onBack={() => {
                    setShowTransactionDetails(false);
                    setSelectedTx(null);
                  }}
                  onDelete={handleDeleteTransaction}
                  onUpdate={handleUpdateTransaction}
                  onMoveCategory={() => {
                    setShowTransactionDetails(false);
                    setShowCategorySelect(true);
                  }}
                />
              )}
            </AnimatePresence>
            
            <NotificationSystem 
              show={notificationsEnabled && showNotification} 
              onClose={() => setShowNotification(false)}
              message={notificationMessage}
              onAction={(action) => {
                setShowNotification(false);
                if (action === 'More') {
                  handleCategorizeQuickAction();
                  return;
                }
                if (action === 'Ignore') {
                  return;
                }
                const uncategorized = transactions.find(t => t.category === 'Uncategorized');
                if (uncategorized) {
                  handleConfirmCategory(uncategorized.id, action);
                }
              }}
            />

            <AnimatePresence>
              {showCsvExportModal && (
                <CsvExportModal 
                  isOpen={showCsvExportModal}
                  onClose={() => setShowCsvExportModal(false)}
                  transactions={transactions}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
