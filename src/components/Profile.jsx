import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Shield, Smartphone, Moon, 
  Download, LogOut, ChevronRight, 
  Wallet, Heart, X, CheckCircle2,
  Tag, Zap, Sparkles, Target, FileSpreadsheet, 
  UploadCloud, RotateCcw, Trash2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { formatCurrency } from '../utils/currency.js';
import { detectGender, getUserInitials, getAvatarUrl } from '../utils/avatar.js';
import PersonalRulesModal from './PersonalRulesModal.jsx';
import BudgetManagerModal from './BudgetManagerModal.jsx';
import SavingsGoalsModal from './SavingsGoalsModal.jsx';
import CsvImportModal from './CsvImportModal.jsx';
import CsvExportModal from './CsvExportModal.jsx';

const SettingItem = ({ icon: Icon, label, sublabel, color, onClick, rightElement, 'aria-label': ariaLabel }) => (
  <motion.button
    whileHover={{ x: 2 }}
    onClick={onClick}
    aria-label={ariaLabel || label}
    className="w-full flex items-center justify-between p-4 bg-bg-card border border-brand-border rounded-xl mb-3 hover:opacity-95 transition-all group cursor-pointer shadow-brand-sm text-txt-primary focus-visible:ring-2 focus-visible:ring-brand-primary outline-none"
  >
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center border border-brand-border shrink-0`}>
        <Icon size={16} />
      </div>
      <div className="text-left">
        <h4 className="text-sm font-semibold text-txt-primary">{label}</h4>
        <p className="text-[10px] text-txt-secondary font-medium uppercase tracking-wider mt-0.5">{sublabel}</p>
      </div>
    </div>
    {rightElement ? rightElement : <ChevronRight size={16} className="text-txt-secondary group-hover:text-txt-primary transition-all" />}
  </motion.button>
);

const Profile = ({ 
  onLogout, 
  userProfile, 
  onUpdateProfile, 
  userRules = [], 
  onDeleteUserRule, 
  onAddUserRule,
  onUpdateUserRule,
  onToggleUserRule,
  transactions = [],
  budgets = [],
  onSaveBudget,
  onDeleteBudget,
  savingsGoals = [],
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddContribution,
  onImportTransactions,
  onClearAccountData,
  onApplyHistoricalRecategorisation
}) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { notificationsEnabled, toggleNotifications, showToast } = useNotifications();

  // Modals state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showCsvExportModal, setShowCsvExportModal] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Authenticated user values
  const userName = userProfile?.name?.trim() || (userProfile?.email ? userProfile.email.split('@')[0] : 'Welcome to Finovo');
  const userEmail = userProfile?.email || 'No email attached';
  const isPremium = Boolean(userProfile?.isPremium);
  const planLabel = isPremium ? 'Premium Plan' : 'Free Plan';
  const aiCategorizationEnabled = userProfile?.aiCategorizationEnabled !== false;

  const effectiveGender = userProfile?.gender || detectGender(userName);
  const avatarStyle = userProfile?.avatarStyle || 'avatar';
  const avatarUrl = getAvatarUrl({ ...userProfile, name: userName, gender: effectiveGender });
  const initials = getUserInitials(userName);
  
  const joinDate = userProfile?.createdAt 
    ? new Date(userProfile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const hasBudgetSet = userProfile?.budgetLimit && Number(userProfile.budgetLimit) > 0;
  const budgetSublabel = budgets.length > 0
    ? `${budgets.length} Targets • Global: ${formatCurrency(userProfile?.budgetLimit || 45000)}`
    : hasBudgetSet
    ? `Monthly Limit: ${formatCurrency(userProfile.budgetLimit)}`
    : 'Monthly Budget not set • Tap to configure';

  const smsStatus = userProfile?.smsPermission || 'Not Requested';

  const handleToggleSMSPermission = () => {
    if (onUpdateProfile) {
      const nextStatus = smsStatus === 'Permission Granted' ? 'Not Requested' : 'Permission Granted';
      onUpdateProfile({ smsPermission: nextStatus });
      showToast(`SMS tracking preference set to: ${nextStatus}.`, 'info');
    }
  };

  // Real data export (JSON file download)
  const handleExportData = () => {
    try {
      const exportObject = {
        exportedAt: new Date().toISOString(),
        profile: userProfile,
        transactions,
        budgets,
        savingsGoals,
        userRules,
        version: '5.3.0'
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `finovo-backup-${new Date().toISOString().substring(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('Financial data backup exported successfully.', 'success');
    } catch {
      showToast('Failed to export data.', 'warning');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Finovo - Personal Finance',
      text: 'Track smarter, spend better with Finovo.',
      url: window.location.origin
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share cancelled
      }
    } else {
      navigator.clipboard?.writeText(window.location.origin);
      showToast('Link copied to clipboard.', 'success');
    }
  };

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen text-txt-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
          <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-0.5">Account & Preferences</p>
        </div>
        <div className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">{planLabel}</span>
        </div>
      </div>

      {/* User Information Card */}
      <div className="bg-bg-card border border-brand-border rounded-2xl p-6 mb-8 shadow-brand-md relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border-2 border-brand-primary/20 flex items-center justify-center font-bold text-2xl text-brand-primary overflow-hidden shrink-0 shadow-brand-sm">
            {avatarStyle === 'avatar' && avatarUrl && !imgError ? (
              <img 
                src={avatarUrl} 
                alt={userName} 
                className="w-full h-full object-cover" 
                onError={() => setImgError(true)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-txt-primary truncate">{userName}</h3>
            <p className="text-xs text-txt-secondary truncate mt-0.5">{userEmail}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] bg-bg-app border border-brand-border px-2 py-0.5 rounded-md text-txt-secondary font-medium">
                Joined {joinDate}
              </span>
              <span className="text-[10px] bg-bg-app border border-brand-border px-2 py-0.5 rounded-md text-txt-secondary font-medium capitalize">
                {effectiveGender}
              </span>
            </div>
          </div>
        </div>

        {/* Avatar Display Style Toggle */}
        <div className="mt-5 pt-4 border-t border-brand-border flex items-center justify-between">
          <span className="text-xs font-semibold text-txt-secondary">Avatar Style:</span>
          <div className="flex gap-1.5 bg-bg-app p-1 rounded-xl border border-brand-border">
            <button
              onClick={() => onUpdateProfile && onUpdateProfile({ avatarStyle: 'avatar' })}
              aria-label="Use animated illustration avatar"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                avatarStyle === 'avatar' 
                  ? 'bg-brand-primary text-white shadow-brand-sm' 
                  : 'text-txt-secondary hover:text-txt-primary'
              }`}
            >
              🎨 Illustration
            </button>
            <button
              onClick={() => onUpdateProfile && onUpdateProfile({ avatarStyle: 'initials' })}
              aria-label="Use text initials avatar"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                avatarStyle === 'initials' 
                  ? 'bg-brand-primary text-white shadow-brand-sm' 
                  : 'text-txt-secondary hover:text-txt-primary'
              }`}
            >
              🔤 Initials
            </button>
          </div>
        </div>
      </div>

      {/* Financial Management */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Financial Management</h3>
        
        {/* Spending Targets & Budgets */}
        <SettingItem 
          icon={Wallet} 
          label="Spending Budgets" 
          sublabel={budgetSublabel} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={() => setShowBudgetModal(true)}
        />

        {/* Savings Goals */}
        <SettingItem 
          icon={Target} 
          label="Savings Goals" 
          sublabel={`${savingsGoals.length} Active Targets • Contribute & Track`} 
          color="bg-brand-success/10 text-brand-success" 
          onClick={() => setShowSavingsModal(true)}
        />

        {/* Smart Categorisation Rules */}
        <SettingItem 
          icon={Tag} 
          label="Personal Merchant Rules" 
          sublabel={`${userRules.length} Custom Merchant Rules Active`} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={() => setShowRulesModal(true)}
        />
      </div>

      {/* Data Management & Import/Export */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Data & Banking Records</h3>
        
        {/* CSV Import */}
        <SettingItem 
          icon={UploadCloud} 
          label="Import Statement (CSV)" 
          sublabel="Upload Bank CSV with Column Mapping" 
          color="bg-blue-500/10 text-blue-500" 
          onClick={() => setShowCsvImportModal(true)}
        />

        {/* CSV Export */}
        <SettingItem 
          icon={FileSpreadsheet} 
          label="Export Ledger (CSV)" 
          sublabel="Filtered Spreadsheet Download (Injection Safe)" 
          color="bg-emerald-500/10 text-emerald-500" 
          onClick={() => setShowCsvExportModal(true)}
        />

        {/* JSON Full Backup */}
        <SettingItem 
          icon={Download} 
          label="Full Backup (JSON)" 
          sublabel="Download Complete Profile & Financial Records" 
          color="bg-purple-500/10 text-purple-500" 
          onClick={handleExportData}
        />
      </div>

      {/* Preferences & System */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Preferences & Security</h3>
        
        <SettingItem 
          icon={Moon} 
          label="Dark Mode" 
          sublabel={darkMode ? "Enabled" : "Disabled"} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={toggleDarkMode}
          rightElement={
            <div
              onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 relative shrink-0 focus:outline-none cursor-pointer flex items-center
                ${darkMode ? 'bg-brand-primary' : 'bg-brand-border'}`}
            >
              <motion.div
                layout
                className="w-4.5 h-4.5 bg-white rounded-full shadow-brand-sm"
                animate={{ x: darkMode ? 22 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          }
        />

        <SettingItem 
          icon={Bell} 
          label="Notifications" 
          sublabel={notificationsEnabled ? "Smart Alerts Enabled" : "Alerts Muted"} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={toggleNotifications}
          rightElement={
            <div
              onClick={(e) => { e.stopPropagation(); toggleNotifications(); }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 relative shrink-0 focus:outline-none cursor-pointer flex items-center
                ${notificationsEnabled ? 'bg-brand-success' : 'bg-brand-border'}`}
            >
              <motion.div
                layout
                className="w-4.5 h-4.5 bg-white rounded-full shadow-brand-sm"
                animate={{ x: notificationsEnabled ? 22 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          }
        />

        <SettingItem 
          icon={Shield} 
          label="Privacy & Security" 
          sublabel={aiCategorizationEnabled ? "AI Enabled • Local & Cloud RLS" : "AI Disabled • 100% Local Rules"} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={() => setShowPrivacyModal(true)}
        />

        <SettingItem 
          icon={Smartphone} 
          label="SMS Permissions" 
          sublabel={`Status: ${smsStatus}`} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={handleToggleSMSPermission}
        />
      </div>

      {/* Support Settings */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Support</h3>
        <SettingItem 
          icon={Heart} 
          label="Share Finovo" 
          sublabel="Invite Friends to Finovo" 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={handleShare}
        />
      </div>

      {/* Account Actions */}
      <div className="space-y-3 mb-12">
        <button
          onClick={onLogout}
          aria-label="Logout current session"
          className="w-full bg-brand-error/10 border border-brand-error/20 p-4 rounded-xl flex items-center justify-center gap-2 text-brand-error font-semibold text-sm hover:bg-brand-error/20 transition-all cursor-pointer shadow-brand-sm focus-visible:ring-2 focus-visible:ring-brand-error outline-none"
        >
          <LogOut size={16} />
          Logout Session
        </button>

        {onClearAccountData && (
          <button
            onClick={() => setShowClearDataConfirm(true)}
            aria-label="Clear all account transaction data"
            className="w-full bg-bg-card border border-brand-border p-3.5 rounded-xl flex items-center justify-center gap-2 text-txt-secondary hover:text-brand-error text-xs font-semibold transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            Reset Account Ledger Data
          </button>
        )}
      </div>

      {/* Version Tag */}
      <div className="text-center text-[10px] text-txt-secondary font-medium pb-8">
        Finovo Personal Finance • Version 5.3.0
      </div>

      {/* 1. BUDGET MANAGER MODAL */}
      <BudgetManagerModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        budgets={budgets}
        transactions={transactions}
        onSaveBudget={onSaveBudget}
        onDeleteBudget={onDeleteBudget}
      />

      {/* 2. SAVINGS GOALS MODAL */}
      <SavingsGoalsModal
        isOpen={showSavingsModal}
        onClose={() => setShowSavingsModal(false)}
        goals={savingsGoals}
        onCreateGoal={onCreateGoal}
        onUpdateGoal={onUpdateGoal}
        onDeleteGoal={onDeleteGoal}
        onAddContribution={onAddContribution}
      />

      {/* 3. CSV IMPORT MODAL */}
      <CsvImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        existingTransactions={transactions}
        onImportTransactions={onImportTransactions}
      />

      {/* 4. CSV EXPORT MODAL */}
      <CsvExportModal
        isOpen={showCsvExportModal}
        onClose={() => setShowCsvExportModal(false)}
        transactions={transactions}
      />

      {/* 5. PERSONAL RULES MODAL */}
      <PersonalRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        userRules={userRules}
        onAddRule={onAddUserRule}
        onDeleteRule={onDeleteUserRule}
        onUpdateRule={onUpdateUserRule}
        onToggleRule={onToggleUserRule}
        transactions={transactions}
        onApplyHistoricalRecategorisation={onApplyHistoricalRecategorisation}
      />

      {/* 6. PRIVACY & SECURITY MODAL */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              role="dialog"
              aria-modal="true"
              aria-label="Privacy and Security Settings"
              className="w-full max-w-lg bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl p-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-brand-border mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center border border-brand-border">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-txt-primary">Privacy & Categorisation</h4>
                    <p className="text-[10px] text-txt-secondary font-medium">Transparent Data Safeguards</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPrivacyModal(false)} 
                  aria-label="Close dialog"
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 text-xs text-txt-secondary leading-relaxed mb-6 pr-1">
                {/* 1. Local Rules */}
                <div className="p-3.5 bg-bg-app border border-brand-border rounded-xl">
                  <h5 className="font-bold text-txt-primary text-xs mb-1 flex items-center gap-1.5">
                    <Zap size={14} className="text-brand-primary" /> Local Deterministic Rules
                  </h5>
                  <p className="text-[11px]">
                    Evaluates transactions completely inside your browser using known merchant dictionaries and personal merchant rules. Zero financial text is transmitted externally for rule matches.
                  </p>
                </div>

                {/* 2. AI Categorisation Toggle & Guardrails */}
                <div className="p-3.5 bg-bg-app border border-brand-border rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <h5 className="font-bold text-txt-primary text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600 dark:text-purple-400" /> AI Categorisation (Gemini)
                    </h5>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={aiCategorizationEnabled}
                      onClick={() => {
                        const next = !aiCategorizationEnabled;
                        onUpdateProfile({ aiCategorizationEnabled: next });
                        showToast(next ? 'AI categorization enabled' : 'AI categorization disabled', 'info');
                      }}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center ${
                        aiCategorizationEnabled ? 'bg-purple-600' : 'bg-brand-border'
                      }`}
                    >
                      <motion.div
                        layout
                        className="w-5 h-5 bg-white rounded-full shadow-brand-sm"
                        animate={{ x: aiCategorizationEnabled ? 20 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                  <p className="text-[11px]">
                    {aiCategorizationEnabled 
                      ? "Enabled: When rules are uncertain, the merchant title is sent to Google Gemini via our secure authenticated server proxy. Never sends balances or account numbers."
                      : "Disabled: AI requests are completely blocked. Categorisation operates 100% locally via personal rules and canonical dictionaries."}
                  </p>
                </div>

                {/* 3. Cloud Storage & Row Level Security */}
                <div className="p-3.5 bg-bg-app border border-brand-border rounded-xl">
                  <h5 className="font-bold text-txt-primary text-xs mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-brand-success" /> Multi-Tenant RLS Isolation
                  </h5>
                  <p className="text-[11px]">
                    Your financial records, budgets, goals, and merchant rules are stored in Supabase PostgreSQL protected by Row Level Security policies tied strictly to your cryptographic user identity.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-full py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-sm hover:opacity-95 cursor-pointer"
              >
                Close Privacy Sheet
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. CLEAR ACCOUNT DATA CONFIRMATION */}
      <AnimatePresence>
        {showClearDataConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-label="Confirm Clear Data"
              className="w-full max-w-sm bg-bg-card border border-brand-border rounded-2xl p-5 shadow-brand-xl space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-error/10 text-brand-error flex items-center justify-center mb-1">
                <Trash2 size={20} />
              </div>
              <h4 className="text-sm font-bold text-txt-primary">Reset Account Ledger?</h4>
              <p className="text-xs text-txt-secondary leading-relaxed">
                This will delete your recorded transactions, budgets, and savings goals from your account. Your account profile and email login will remain active.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowClearDataConfirm(false)}
                  className="px-3.5 py-2 border border-brand-border text-txt-secondary text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowClearDataConfirm(false);
                    onClearAccountData();
                  }}
                  className="px-4 py-2 bg-brand-error text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer hover:opacity-90"
                >
                  Reset Ledger
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
