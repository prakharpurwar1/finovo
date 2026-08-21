import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './context/ThemeContext';
import { useNotifications } from './context/NotificationContext';
import SplashScreen from './components/SplashScreen';
import AuthFlow from './components/AuthFlow';
import OnboardingFlow from './components/OnboardingFlow';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Splits from './components/Splits';
import Profile from './components/Profile';
import NotificationSystem from './components/NotificationSystem';
import CategorySelect from './components/CategorySelect';
import AddExpense from './components/AddExpense';
import TransactionDetails from './components/TransactionDetails';

function App() {
  const [appState, setAppState] = useState('splash'); // 'splash', 'auth', 'onboarding', 'main'
  const [activeTab, setActiveTab] = useState('home');
  const { darkMode, setDarkMode } = useTheme();
  const { notificationsEnabled, sendNotification } = useNotifications();

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('finovo_user');
      return saved ? JSON.parse(saved) : { name: 'Alex Fischer', email: 'alex@finovo.io', budgetLimit: 45000 };
    } catch {
      return { name: 'Alex Fischer', email: 'alex@finovo.io', budgetLimit: 45000 };
    }
  });

  const updateUserProfile = (updates) => {
    setUserProfile(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('finovo_user', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving user profile', e);
      }
      return next;
    });
  };

  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [detailsStartWithEdit, setDetailsStartWithEdit] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Initial Mock Transactions
  const [transactions, setTransactions] = useState([
    {
      id: 'tx-1',
      merchant: 'Swiggy',
      category: 'Food',
      amount: 850,
      date: '2026-05-14',
      time: '02:30 PM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: 'Lunch order'
    },
    {
      id: 'tx-2',
      merchant: 'Uber',
      category: 'Travel',
      amount: 420,
      date: '2026-05-14',
      time: '10:15 AM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: 'Commute to office'
    },
    {
      id: 'tx-3',
      merchant: 'Recharge',
      category: 'Recharge',
      amount: 719,
      date: '2026-05-13',
      time: '09:00 PM',
      type: 'expense',
      paymentMethod: 'Net Banking',
      status: 'Completed',
      notes: 'Mobile monthly pack'
    },
    {
      id: 'tx-4',
      merchant: 'HDFC EMI',
      category: 'Others',
      amount: 4500,
      date: '2026-05-12',
      time: '12:00 PM',
      type: 'expense',
      paymentMethod: 'Card',
      status: 'Completed',
      notes: 'Loan EMI payment'
    },
    {
      id: 'tx-5',
      merchant: 'Apollo Meds',
      category: 'Medicine',
      amount: 1250,
      date: '2026-05-11',
      time: '11:00 AM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: 'First aid medicines'
    },
    {
      id: 'tx-6',
      merchant: 'Zomato',
      category: 'Food',
      amount: 1120,
      date: '2026-05-10',
      time: '08:30 PM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: 'Dinner with family'
    },
    // Uncategorized Transactions (Count = 3 to match user requirement)
    {
      id: 'tx-7',
      merchant: 'Unknown Merchant',
      category: 'Uncategorized',
      amount: 2400,
      date: '2026-05-14',
      time: '11:20 AM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: ''
    },
    {
      id: 'tx-8',
      merchant: 'Netflix Subscription',
      category: 'Uncategorized',
      amount: 649,
      date: '2026-05-13',
      time: '08:15 PM',
      type: 'expense',
      paymentMethod: 'Card',
      status: 'Completed',
      notes: 'Monthly renewal'
    },
    {
      id: 'tx-9',
      merchant: 'Unknown Merchant',
      category: 'Uncategorized',
      amount: 1500,
      date: '2026-05-12',
      time: '06:30 PM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: ''
    },
    // Income Transactions
    {
      id: 'tx-10',
      merchant: 'Tech Corp Salary',
      category: 'Others',
      amount: 75000,
      date: '2026-05-01',
      time: '09:00 AM',
      type: 'income',
      paymentMethod: 'Net Banking',
      status: 'Completed',
      notes: 'Monthly salary credit'
    },
    {
      id: 'tx-11',
      merchant: 'Freelance Design',
      category: 'Others',
      amount: 12500,
      date: '2026-05-08',
      time: '04:15 PM',
      type: 'income',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: 'Logo design project'
    }
  ]);

  useEffect(() => {
    // Show a demo notification after 5 seconds in the main app if notifications are enabled
    if (appState === 'main' && notificationsEnabled) {
      const timer = setTimeout(() => {
        const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized').length;
        if (uncategorizedCount > 0 && notificationsEnabled) {
          setNotificationMessage(`${uncategorizedCount} transactions need categorization`);
          setShowNotification(true);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [appState, notificationsEnabled, transactions]);

  const handleAddTransaction = (newTx) => {
    const txWithId = {
      ...newTx,
      id: `tx-${Date.now()}`
    };
    setTransactions(prev => [txWithId, ...prev]);

    if (notificationsEnabled) {
      sendNotification({
        title: 'Expense Added',
        message: `₹${Number(newTx.amount).toLocaleString('en-IN')} recorded for ${newTx.merchant || 'Merchant'}.`,
        type: 'info'
      });
    }
  };

  const handleDeleteTransaction = (txId) => {
    setTransactions(prev => prev.filter(tx => tx.id !== txId));
    setShowTransactionDetails(false);
    setSelectedTx(null);
  };

  const handleUpdateTransaction = (updatedTx) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
    setSelectedTx(updatedTx);
  };

  const handleConfirmCategory = (txId, categoryName) => {
    let nextTx = null;
    setTransactions(prev => {
      const updated = prev.map(tx => {
        if (tx.id === txId) {
          return { ...tx, category: categoryName };
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
      // Show next transaction with smooth transition
      setTimeout(() => {
        setSelectedTx(nextTx);
        setShowCategorySelect(true);
      }, 300);
    } else {
      setSelectedTx(null);
      if (notificationsEnabled) {
        setNotificationMessage("All transactions successfully categorized!");
        setShowNotification(true);
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
      case 'home': 
        return (
          <Dashboard 
            transactions={transactions}
            onSelectTx={(tx) => {
              setSelectedTx(tx);
              setDetailsStartWithEdit(false);
              setShowTransactionDetails(true);
            }} 
            onAdd={() => setShowAddExpense(true)}
            onGoToHistory={() => setActiveTab('history')}
            onCategorize={handleCategorizeQuickAction}
            onGoToSplits={() => setActiveTab('splits')}
          />
        );
      case 'history': 
        return (
          <History 
            transactions={transactions}
            onSelectTx={(tx, startWithEdit) => {
              setSelectedTx(tx);
              setDetailsStartWithEdit(startWithEdit);
              setShowTransactionDetails(true);
            }}
          />
        );
      case 'splits': 
        return <Splits onAdd={() => setShowAddExpense(true)} />;
      case 'profile': 
        return <Profile onLogout={() => setAppState('auth')} userProfile={userProfile} />;
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
          />
        );
    }
  };

  return (
    <div className={`mobile-container min-h-screen relative overflow-hidden bg-bg-app text-txt-primary ${darkMode ? 'dark' : ''}`}>
      <AnimatePresence mode="wait">
        {appState === 'splash' && (
          <SplashScreen key="splash" onComplete={() => setAppState('auth')} />
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
              if (data) updateUserProfile(data);
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
              if (data?.budget) updateUserProfile({ budgetLimit: data.budget });
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
                console.log('Action selected:', action);
                setShowNotification(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
