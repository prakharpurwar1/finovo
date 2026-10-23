import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Trash2, Edit2, Tag, AlertCircle, Loader2,
  Utensils, Car, ShoppingBag, Smartphone, HeartPulse,
  Film, GraduationCap, Grid, ShieldAlert, TrendingUp, TrendingDown,
  Sparkles, Zap
} from 'lucide-react';
import { validateTransaction } from '../utils/validation.js';
import { formatCurrency } from '../utils/currency.js';
import { isDemoItem } from '../data/demoFixtures.js';
import { suggestCategory } from '../utils/categorizationEngine.js';
import { requestAiCategorization } from '../services/aiCategorizationService.js';

const categoryIcons = {
  Food: Utensils,
  Travel: Car,
  Shopping: ShoppingBag,
  Recharge: Smartphone,
  Medicine: HeartPulse,
  Education: GraduationCap,
  Entertainment: Film,
  Salary: TrendingUp,
  Investments: TrendingUp,
  Freelance: TrendingUp,
  Refunds: TrendingDown,
  Groceries: ShoppingBag,
  Subscriptions: Film,
  Rent: Grid,
  Others: Grid,
  Uncategorized: ShieldAlert
};

const TransactionDetails = ({ 
  tx, 
  onBack, 
  onDelete, 
  onUpdate, 
  onMoveCategory, 
  startInEditMode = false,
  userRules = [],
  _onSaveUserRule,
  userProfile = {}
}) => {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [merchantName, setMerchantName] = useState(tx.merchant);
  const [amount, setAmount] = useState(tx.amount);
  const [notes, setNotes] = useState(tx.notes || '');
  const [date, setDate] = useState(tx.date);
  const [time, setTime] = useState(tx.time || '12:00 PM');
  const [paymentMethod, setPaymentMethod] = useState(tx.paymentMethod || 'UPI');
  const [status, setStatus] = useState(tx.status || 'Completed');
  const [type, setType] = useState(tx.type || 'expense');
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isUnknownMerchant = tx.merchant === 'Unknown Merchant' || !tx.merchant;
  const isDemo = isDemoItem(tx);
  const Icon = categoryIcons[tx.category] || Grid;

  const suggestion = useMemo(() => {
    return suggestCategory({
      transactionType: type,
      merchant: merchantName,
      description: notes,
      userRules
    });
  }, [type, merchantName, notes, userRules]);

  // AI Categorisation for Uncategorized Transactions
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiError, setAiError] = useState(null);

  const handleAskAi = async () => {
    if (userProfile?.aiCategorizationEnabled === false) {
      setAiError('AI categorisation is disabled in your Privacy settings.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    try {
      const allowedCategories = type === 'income' 
        ? ['Salary', 'Freelance', 'Investments', 'Refunds', 'Gift', 'Others', 'Uncategorized']
        : ['Food', 'Groceries', 'Travel', 'Shopping', 'Recharge', 'Subscriptions', 'Medicine', 'Education', 'Entertainment', 'Rent', 'Others', 'Uncategorized'];

      const res = await requestAiCategorization({
        merchant: merchantName,
        description: notes,
        transactionType: type,
        allowedCategories,
        enabled: userProfile?.aiCategorizationEnabled !== false
      });

      if (!res.available) {
        setAiError(res.error || 'AI service is unconfigured or unavailable.');
      } else if (!res.success || !res.suggestion) {
        setAiError(res.error || 'AI could not categorize this transaction.');
      } else {
        setAiSuggestion(res.suggestion);
      }
    } catch (err) {
      setAiError(err.message || 'Error communicating with AI service.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSubmitting) return;

    const validation = validateTransaction({
      merchant: merchantName,
      amount,
      date
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await onUpdate({
        ...tx,
        merchant: merchantName.trim(),
        amount: parseFloat(amount),
        notes: notes.trim(),
        date,
        time,
        paymentMethod,
        status,
        type
      });
      setIsSubmitting(false);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating transaction:', err);
      setIsSubmitting(false);
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to update transaction in database. Please try again.'
      }));
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this ${formatCurrency(tx.amount)} transaction with ${tx.merchant}?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setErrors({});

    try {
      await onDelete(tx.id);
      // App.jsx will close the details drawer on successful delete
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setIsDeleting(false);
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to delete transaction. Please check your connection and try again.'
      }));
    }
  };

  const handleAddMerchantManually = async (name) => {
    if (!name || !name.trim()) return;
    try {
      await onUpdate({
        ...tx,
        merchant: name.trim()
      });
      setMerchantName(name.trim());
    } catch (err) {
      setErrors(prev => ({ ...prev, general: err.message || 'Failed to update merchant' }));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-brand-secondary/30 backdrop-blur-sm flex items-end justify-center">
      {/* Background Tap to Dismiss */}
      <div className="absolute inset-0 cursor-pointer" onClick={isSubmitting || isDeleting ? undefined : onBack} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative w-full max-w-md bg-bg-card border-t border-brand-border rounded-t-[24px] px-6 pt-6 pb-8 z-10 max-h-[90vh] overflow-y-auto text-txt-primary"
      >
        {/* Pull bar */}
        <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Transaction Details</h2>
            {isDemo && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-brand-warning/15 text-brand-warning border border-brand-warning/25 uppercase">
                Demo Fixture
              </span>
            )}
          </div>
          <button 
            onClick={onBack}
            disabled={isSubmitting || isDeleting}
            className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>

        {/* General Error Banner */}
        {errors.general && (
          <div className="mb-4 p-3.5 bg-brand-error/10 border border-brand-error/20 rounded-xl flex items-start gap-2.5">
            <AlertCircle size={16} className="text-brand-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-brand-error">Action Failed</p>
              <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">{errors.general}</p>
            </div>
            <button 
              onClick={() => setErrors(prev => ({ ...prev, general: null }))}
              className="text-txt-secondary hover:text-txt-primary"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Main Amount Card */}
        <div className="flex flex-col items-center justify-center text-center mb-6 bg-bg-app border border-brand-border rounded-[16px] p-5">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/5 text-brand-primary border border-brand-border flex items-center justify-center mb-3">
            <Icon size={22} />
          </div>

          {isEditing ? (
            <div className="flex flex-col items-center mb-1">
              <div className="flex items-center justify-center gap-1">
                <span className={`text-2xl font-bold ${type === 'income' ? 'text-brand-success' : 'text-brand-primary'}`}>₹</span>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors(prev => ({ ...prev, amount: null }));
                  }}
                  className={`bg-transparent text-3xl font-bold text-txt-primary tracking-tight w-36 text-center placeholder:text-txt-secondary/20 outline-none border-b ${errors.amount ? 'border-brand-error' : 'border-brand-primary'}`}
                />
              </div>
              {errors.amount && (
                <span className="text-[10px] text-brand-error font-bold mt-1">{errors.amount}</span>
              )}
            </div>
          ) : (
            <h1 className="text-3xl font-bold text-txt-primary tracking-tight mb-1">
              {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
            </h1>
          )}
          <span className="text-[10px] text-brand-primary font-bold uppercase tracking-wider bg-brand-primary/5 px-3 py-0.5 rounded-full border border-brand-primary/10">
            {tx.category}
          </span>
          {/* Uncategorized Suggestion Badges & Actions */}
          {tx.category === 'Uncategorized' && !isEditing && (
            <div className="mt-2.5 flex flex-col items-center gap-2">
              {/* AI Loading indicator */}
              {isAiLoading && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-bold animate-pulse">
                  <Loader2 size={12} className="animate-spin text-purple-600 shrink-0" />
                  <span>Asking Gemini AI...</span>
                </div>
              )}

              {/* AI Suggestion */}
              {aiSuggestion && !isAiLoading && (
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full">
                  <Sparkles size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-[11px] font-bold text-txt-primary">
                    AI Suggested: {aiSuggestion.categoryName} ({Math.round(aiSuggestion.confidenceScore * 100)}%)
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onUpdate({ ...tx, category: aiSuggestion.categoryName, isManualCategory: true });
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                    className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-0.5 rounded-full ml-1 cursor-pointer"
                  >
                    Accept
                  </button>
                </div>
              )}

              {/* Rule-Based Suggestion */}
              {!aiSuggestion && suggestion && suggestion.confidenceScore > 0 && !isAiLoading && (
                <div className="inline-flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-full">
                  <Zap size={12} className="text-brand-primary shrink-0" />
                  <span className="text-[11px] font-bold text-brand-primary">
                    Rule: {suggestion.categoryName}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onUpdate({ ...tx, category: suggestion.categoryName, isManualCategory: true });
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                    className="text-[10px] font-bold text-white bg-brand-primary px-2.5 py-0.5 rounded-full hover:opacity-90 ml-1 cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={handleAskAi}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline ml-1 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles size={10} /> Ask AI
                  </button>
                </div>
              )}

              {/* When No Rule Matched and No AI suggestion yet */}
              {!aiSuggestion && (!suggestion || suggestion.confidenceScore === 0) && !isAiLoading && (
                <button
                  type="button"
                  onClick={handleAskAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-purple-600 dark:text-purple-400 text-[11px] font-bold cursor-pointer transition-all"
                >
                  <Sparkles size={12} />
                  <span>Ask Gemini AI to Categorize</span>
                </button>
              )}

              {/* Error notice */}
              {aiError && !isAiLoading && (
                <span className="text-[10px] font-medium text-brand-warning">
                  {aiError}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Unknown Merchant Warning */}
        {isUnknownMerchant && !isEditing && (
          <div className="mb-6 p-4 bg-brand-warning/5 border border-brand-warning/15 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-brand-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-brand-warning">Merchant not detected</p>
              <p className="text-[10px] text-txt-secondary mt-1">Please enter the merchant name manually to update this transaction.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Merchant Name"
                  id="manual-merchant-input"
                  className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleAddMerchantManually(e.target.value.trim());
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('manual-merchant-input');
                    if (el && el.value.trim()) {
                      handleAddMerchantManually(el.value.trim());
                    }
                  }}
                  className="px-3 bg-brand-warning text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:opacity-90 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="space-y-4 mb-6 bg-bg-app border border-brand-border rounded-[16px] p-4">
          
          {/* Type Toggle in Edit Mode */}
          {isEditing && (
            <div className="flex justify-between items-center py-0.5 border-b border-brand-border">
              <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Type</span>
              <div className="flex gap-1 bg-bg-card p-1 rounded-lg border border-brand-border">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${type === 'expense' ? 'bg-brand-primary text-white' : 'text-txt-secondary'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${type === 'income' ? 'bg-brand-success text-white' : 'text-txt-secondary'}`}
                >
                  Income
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Merchant / Source</span>
            {isEditing ? (
              <div className="flex flex-col items-end">
                <input
                  type="text"
                  value={merchantName}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setMerchantName(e.target.value);
                    if (errors.merchant) setErrors(prev => ({ ...prev, merchant: null }));
                  }}
                  className={`bg-bg-card border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none text-right w-44 ${errors.merchant ? 'border-brand-error' : 'border-brand-border focus:border-brand-primary'}`}
                />
                {errors.merchant && (
                  <span className="text-[9px] text-brand-error font-bold mt-0.5">{errors.merchant}</span>
                )}
              </div>
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.merchant}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Date & Time</span>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  disabled={isSubmitting}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[11px] text-txt-primary outline-none text-right"
                />
                <input
                  type="text"
                  value={time}
                  disabled={isSubmitting}
                  placeholder="12:00 PM"
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[11px] text-txt-primary outline-none text-right w-20"
                />
              </div>
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.date} • {tx.time || '12:00 PM'}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Payment Method</span>
            {isEditing ? (
              <select
                value={paymentMethod}
                disabled={isSubmitting}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-txt-primary outline-none"
              >
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.paymentMethod}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Status</span>
            {isEditing ? (
              <select
                value={status}
                disabled={isSubmitting}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-txt-primary outline-none"
              >
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            ) : (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${tx.status === 'Completed' ? 'bg-brand-success/10 text-brand-success' : tx.status === 'Pending' ? 'bg-brand-warning/10 text-brand-warning' : 'bg-brand-error/10 text-brand-error'}`}>
                {tx.status || 'Completed'}
              </span>
            )}
          </div>

          <div className="flex justify-between items-start py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-1">Notes</span>
            {isEditing ? (
              <textarea
                value={notes}
                disabled={isSubmitting}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                rows={2}
                className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary text-right w-44 resize-none"
              />
            ) : (
              <span className="text-xs font-medium text-txt-secondary max-w-[200px] text-right">
                {tx.notes || <span className="italic text-txt-secondary/40">No notes added</span>}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setErrors({});
                  setMerchantName(tx.merchant);
                  setAmount(tx.amount);
                  setNotes(tx.notes || '');
                  setDate(tx.date);
                  setTime(tx.time || '12:00 PM');
                }}
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer shadow-brand-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Edit2 size={12} />
                  Edit Detail
                </button>
                <button
                  onClick={onMoveCategory}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Tag size={12} />
                  Move Category
                </button>
              </div>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-3.5 bg-brand-error/10 border border-brand-error/20 text-brand-error rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-error/15 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Deleting Row...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    <span>Delete Transaction</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionDetails;
