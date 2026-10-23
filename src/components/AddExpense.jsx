import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, Tag, FileText, ArrowRight, ChevronDown, Clock, 
  Users, Info, AlertCircle, Loader2, TrendingUp, TrendingDown,
  Sparkles, Zap, ShieldCheck
} from 'lucide-react';
import { validateTransaction } from '../utils/validation.js';
import { splitMoneyEvenly, formatCurrency } from '../utils/currency.js';
import { getTodayDateString, getCurrentTimeString } from '../utils/date.js';
import { suggestCategory } from '../utils/categorizationEngine.js';
import { requestAiCategorization } from '../services/aiCategorizationService.js';

const expenseCategories = [
  { id: 'food', name: 'Food', emoji: '🍔' },
  { id: 'groceries', name: 'Groceries', emoji: '🛒' },
  { id: 'travel', name: 'Travel', emoji: '🚕' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️' },
  { id: 'recharge', name: 'Recharge', emoji: '📱' },
  { id: 'subscriptions', name: 'Subscriptions', emoji: '🔁' },
  { id: 'medicine', name: 'Medicine', emoji: '💊' },
  { id: 'education', name: 'Education', emoji: '📚' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬' },
  { id: 'rent', name: 'Rent', emoji: '🏠' },
  { id: 'others', name: 'Others', emoji: '➕' },
  { id: 'uncategorized', name: 'Uncategorized', emoji: '❓' }
];

const incomeCategories = [
  { id: 'salary', name: 'Salary', emoji: '💰' },
  { id: 'freelance', name: 'Freelance', emoji: '💻' },
  { id: 'investment', name: 'Investments', emoji: '📈' },
  { id: 'refund', name: 'Refunds', emoji: '🔄' },
  { id: 'gift', name: 'Gift / Award', emoji: '🎁' },
  { id: 'others', name: 'Others', emoji: '➕' },
  { id: 'uncategorized', name: 'Uncategorized', emoji: '❓' }
];

const AddExpense = ({ onBack, onAddTransaction, groups = [], userRules = [], onSaveUserRule, userProfile = {} }) => {
  // Mode: 'expense' or 'income'
  const [transactionType, setTransactionType] = useState('expense');
  
  // Form States
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [isManualCategorySelection, setIsManualCategorySelection] = useState(false);
  const [alwaysCategorizeAsRule, setAlwaysCategorizeAsRule] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => getTodayDateString());
  const [time, setTime] = useState(() => getCurrentTimeString());
  const [note, setNote] = useState('');
  const [currency] = useState('INR');
  
  // Validation and Submission States
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group Expense toggle & states (only for expense)
  const [isGroupExpense, setIsGroupExpense] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(() => groups[0]?.id || '');
  const [numPeople, setNumPeople] = useState(2);
  const [splitType, setSplitType] = useState('equal'); // 'equal', 'custom'

  // AI Categorisation States
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiDismissed, setAiDismissed] = useState(false);
  const aiReqCounterRef = useRef(0);

  const currentCategories = transactionType === 'income' ? incomeCategories : expenseCategories;

  // Real-time suggestion from categorisation engine (Stage 1-5 deterministic rules)
  const suggestion = useMemo(() => {
    return suggestCategory({
      transactionType,
      merchant,
      description: note,
      userRules,
      availableCategories: currentCategories
    });
  }, [transactionType, merchant, note, userRules, currentCategories]);

  // Invalidate AI state when input changes to prevent stale responses
  useEffect(() => {
    setAiSuggestion(null);
    setAiError(null);
    setAiDismissed(false);
    setIsAiLoading(false);
  }, [merchant, note, transactionType]);

  // Apply rule-based suggestion automatically ONLY when user has NOT manually chosen a category
  useEffect(() => {
    if (!isManualCategorySelection && suggestion && suggestion.confidenceScore > 0) {
      setSelectedCategory(suggestion.categoryId);
    }
  }, [suggestion, isManualCategorySelection]);

  // Explicit AI Categorisation Handler
  const handleAskAi = async () => {
    if (userProfile?.aiCategorizationEnabled === false) {
      setAiError('AI categorisation is disabled in your Privacy settings.');
      return;
    }

    const trimmedMerchant = merchant.trim();
    const trimmedNote = note.trim();
    if (!trimmedMerchant && !trimmedNote) return;

    const reqId = ++aiReqCounterRef.current;
    setIsAiLoading(true);
    setAiError(null);
    setAiDismissed(false);

    try {
      const res = await requestAiCategorization({
        merchant: trimmedMerchant,
        description: trimmedNote,
        transactionType,
        allowedCategories: currentCategories,
        enabled: userProfile?.aiCategorizationEnabled !== false
      });

      // Stale check: discard if user updated inputs during request
      if (aiReqCounterRef.current !== reqId) return;

      if (!res.available) {
        setAiError(res.error || 'AI categorisation service is not configured on the server.');
      } else if (!res.success || !res.suggestion) {
        setAiError(res.error || 'AI could not confidently determine a category.');
      } else {
        setAiSuggestion(res.suggestion);
      }
    } catch (err) {
      if (aiReqCounterRef.current !== reqId) return;
      setAiError(err.message || 'Error requesting AI categorisation.');
    } finally {
      if (aiReqCounterRef.current === reqId) {
        setIsAiLoading(false);
      }
    }
  };

  // Handle switching transaction type
  const handleTypeChange = (newType) => {
    setTransactionType(newType);
    setIsManualCategorySelection(false);
    setSelectedCategory(newType === 'income' ? 'salary' : 'food');
    if (newType === 'income') {
      setIsGroupExpense(false);
    }
  };

  const handleCategoryCardClick = (catId) => {
    setSelectedCategory(catId);
    setIsManualCategorySelection(true);
  };

  const handleAddExpenseSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission

    // Validate with centralized financial validation utility
    const validation = validateTransaction({
      amount,
      merchant,
      date,
      category: selectedCategory
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const matchedCat = currentCategories.find(c => c.id === selectedCategory);
      let categoryName = matchedCat ? matchedCat.name : 'Others';
      
      const selectedGroup = groups.find(g => g.id === selectedGroupId);

      if (isGroupExpense && transactionType === 'expense') {
        categoryName = 'Group Expense';
      }

      const groupNoteSuffix = (isGroupExpense && transactionType === 'expense')
        ? ` • Split (${splitType === 'equal' ? 'Equal' : 'Custom'}) across ${numPeople} people${selectedGroup ? ` in "${selectedGroup.title}"` : ''}`
        : '';

      const finalNotes = `${note.trim()}${groupNoteSuffix}`.trim();

      // If user explicitly opted to remember rule for future transactions
      if (alwaysCategorizeAsRule && onSaveUserRule && merchant.trim()) {
        try {
          await onSaveUserRule({
            merchantPattern: merchant.trim(),
            categoryName
          });
        } catch (ruleErr) {
          console.warn('Could not save user category rule:', ruleErr);
        }
      }

      await onAddTransaction({
        merchant: merchant.trim(),
        amount: parseFloat(amount),
        currency,
        category: categoryName,
        date,
        time,
        type: transactionType,
        paymentMethod: transactionType === 'income' ? 'Bank Transfer' : 'UPI',
        status: 'Completed',
        notes: finalNotes,
        isManualCategory: isManualCategorySelection,
        // Metadata for split transaction
        isSplit: transactionType === 'expense' && isGroupExpense,
        groupId: (transactionType === 'expense' && isGroupExpense) ? selectedGroupId : null,
        groupTitle: (transactionType === 'expense' && isGroupExpense && selectedGroup) ? selectedGroup.title : null,
        splitPeopleCount: (transactionType === 'expense' && isGroupExpense) ? numPeople : 1,
        splitType: (transactionType === 'expense' && isGroupExpense) ? splitType : null
      });

      // On successful confirmation from Supabase database
      setIsSubmitting(false);
      onBack();
    } catch (err) {
      console.error('Error adding transaction:', err);
      setIsSubmitting(false);
      // Preserve form values, set clear field or general error
      setErrors(prev => ({
        ...prev,
        general: err.message || 'Failed to save transaction to database. Please check your network and try again.'
      }));
    }
  };

  // Compute exact even split down to the paisa
  const equalShares = amount && Number(amount) > 0 ? splitMoneyEvenly(amount, numPeople) : [];

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="fixed inset-0 z-[120] bg-bg-app flex flex-col overflow-hidden text-txt-primary"
    >
      {/* Header */}
      <div className="relative p-6 pt-12 flex items-center justify-between border-b border-brand-border bg-bg-card/90 backdrop-blur-md z-10">
        <button 
          onClick={onBack} 
          disabled={isSubmitting}
          className="w-10 h-10 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer disabled:opacity-50"
        >
          <X size={18} />
        </button>
        <h2 className="text-xs font-bold uppercase tracking-wider text-txt-primary/80">
          {transactionType === 'income' ? 'Add Income' : 'Add Expense'}
        </h2>
        <button 
          onClick={handleAddExpenseSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-brand-sm disabled:opacity-50 inline-flex items-center gap-1.5"
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

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-6 relative z-0">
        
        {/* General Error Banner */}
        {errors.general && (
          <div className="p-4 bg-brand-error/10 border border-brand-error/25 rounded-2xl flex items-start gap-3">
            <AlertCircle size={18} className="text-brand-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-brand-error">Submission Failed</h4>
              <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">{errors.general}</p>
            </div>
            <button 
              onClick={() => setErrors(prev => ({ ...prev, general: null }))}
              className="text-txt-secondary hover:text-txt-primary cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Transaction Type Segmented Toggle */}
        <div className="flex bg-bg-card border border-brand-border p-1 rounded-2xl shadow-brand-sm">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer
              ${transactionType === 'expense' 
                ? 'bg-brand-primary text-white shadow-brand-sm' 
                : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            <TrendingDown size={14} />
            Expense
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            disabled={isSubmitting}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer
              ${transactionType === 'income' 
                ? 'bg-brand-success text-white shadow-brand-sm' 
                : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            <TrendingUp size={14} />
            Income
          </button>
        </div>

        {/* Large Amount Input */}
        <div className={`text-center bg-bg-card border rounded-[20px] p-6 shadow-brand-sm transition-colors ${errors.amount ? 'border-brand-error/60 ring-1 ring-brand-error/40' : 'border-brand-border'}`}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider block">
              {transactionType === 'income' ? 'Income Amount' : 'Expense Amount'} ({currency})
            </span>
            {errors.amount && (
              <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
                <AlertCircle size={11} /> {errors.amount}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className={`text-3xl font-bold ${transactionType === 'income' ? 'text-brand-success' : 'text-brand-primary'}`}>
              ₹
            </span>
            <input 
              type="number"
              step="any"
              min="0.01"
              value={amount}
              disabled={isSubmitting}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors(prev => ({ ...prev, amount: null }));
              }}
              placeholder="0"
              className="bg-transparent text-4xl font-bold text-txt-primary tracking-tight w-48 text-center placeholder:text-txt-secondary/20 outline-none"
              style={{ caretColor: transactionType === 'income' ? 'var(--color-success, #10b981)' : 'var(--color-primary)' }}
            />
          </div>
        </div>

        {/* Category Select Dropdown */}
        <div className="group">
          <div className="flex items-center justify-between mb-2 px-1">
            <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
              Category
            </label>
            {aiSuggestion && !aiDismissed ? (
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Sparkles size={11} /> AI: {aiSuggestion.categoryName} ({Math.round(aiSuggestion.confidenceScore * 100)}%)
              </span>
            ) : suggestion && suggestion.confidenceScore > 0 ? (
              <span className="text-[10px] font-bold text-brand-primary flex items-center gap-1">
                <Zap size={11} /> Rule: {suggestion.categoryName} ({suggestion.confidenceLevel.toLowerCase()})
              </span>
            ) : null}
          </div>

          {/* AI Loading State */}
          {isAiLoading && (
            <div className="flex items-center gap-2 p-2.5 px-3 bg-purple-500/10 border border-purple-500/20 rounded-xl mb-3 text-xs font-semibold text-purple-700 dark:text-purple-300 animate-pulse">
              <Loader2 size={13} className="animate-spin text-purple-600 shrink-0" />
              <span>Analyzing transaction with Google Gemini AI...</span>
            </div>
          )}

          {/* AI Suggestion Banner (Verified Structured Response) */}
          {aiSuggestion && !aiDismissed && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-xl mb-3 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 overflow-hidden">
                  <Sparkles size={14} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-txt-primary">
                        Suggested: {aiSuggestion.categoryName}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        Gemini AI ({Math.round(aiSuggestion.confidenceScore * 100)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-txt-secondary mt-0.5 leading-snug">
                      {aiSuggestion.explanation}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(aiSuggestion.categoryId);
                      setIsManualCategorySelection(true);
                      setAiDismissed(true);
                    }}
                    className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiDismissed(true)}
                    className="text-[10px] font-bold text-txt-secondary hover:text-txt-primary px-1.5 py-1 rounded-lg uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Error or Limit Notice */}
          {aiError && !isAiLoading && (
            <div className="flex items-center justify-between p-2.5 px-3 bg-brand-warning/10 border border-brand-warning/20 rounded-xl mb-3 text-xs text-brand-warning">
              <div className="flex items-center gap-2 truncate">
                <AlertCircle size={13} className="shrink-0" />
                <span className="truncate">{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-[10px] font-bold uppercase tracking-wider hover:underline shrink-0 ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Deterministic Rule Suggestion Indicator Banner */}
          {(!aiSuggestion || aiDismissed) && suggestion && suggestion.confidenceScore > 0 && (
            <div className="flex items-center justify-between p-2.5 px-3 bg-brand-primary/5 border border-brand-primary/15 rounded-xl mb-3 transition-all">
              <div className="flex items-center gap-2 overflow-hidden">
                <Zap size={13} className="text-brand-primary shrink-0" />
                <span className="text-xs font-semibold text-txt-primary truncate">
                  {suggestion.explanation}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {selectedCategory !== suggestion.categoryId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(suggestion.categoryId);
                      setIsManualCategorySelection(false);
                    }}
                    className="text-[10px] font-bold text-brand-primary uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    Use
                  </button>
                )}
                {/* Secondary Ask AI option for user second opinion */}
                {(merchant.trim().length >= 2 || note.trim().length >= 2) && !isAiLoading && (
                  <button
                    type="button"
                    onClick={handleAskAi}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={10} /> Ask AI
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Fallback Ask AI Banner when no deterministic rule matched */}
          {(!aiSuggestion || aiDismissed) && (!suggestion || suggestion.confidenceScore === 0) && (merchant.trim().length >= 2 || note.trim().length >= 2) && !isAiLoading && (
            <div className="flex items-center justify-between p-2.5 px-3 bg-bg-app border border-dashed border-brand-border rounded-xl mb-3 transition-all">
              <span className="text-xs text-txt-secondary truncate">
                Unknown category. Let AI help categorize this.
              </span>
              <button
                type="button"
                onClick={handleAskAi}
                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0 ml-2 cursor-pointer transition-all"
              >
                <Sparkles size={11} /> Ask Gemini AI
              </button>
            </div>
          )}

          <div className="relative">
            <select
              value={selectedCategory}
              disabled={isSubmitting}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setIsManualCategorySelection(true);
              }}
              className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary appearance-none cursor-pointer"
            >
              {currentCategories.map((c) => (
                <option key={c.id} value={c.id} className="bg-bg-card text-txt-primary">
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-secondary/60 pointer-events-none">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {/* Category Cards Grid */}
        <div>
          <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2.5 block px-1">
            Select Category Card
          </label>
          <div className="grid grid-cols-4 gap-2">
            {currentCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCategoryCardClick(cat.id)}
                  className={`aspect-square rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer
                    ${isSelected 
                      ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-brand-sm' 
                      : 'bg-bg-card border-brand-border text-txt-secondary hover:text-txt-primary'}`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center px-1">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* User Rule Learn Checkbox */}
          {merchant.trim().length > 1 && (
            <label className="flex items-center gap-2.5 mt-3.5 p-3 bg-bg-card border border-brand-border rounded-xl cursor-pointer hover:border-brand-primary/40 transition-colors select-none">
              <input
                type="checkbox"
                checked={alwaysCategorizeAsRule}
                disabled={isSubmitting}
                onChange={(e) => setAlwaysCategorizeAsRule(e.target.checked)}
                className="w-4 h-4 rounded border-brand-border text-brand-primary accent-brand-primary cursor-pointer"
              />
              <span className="text-xs text-txt-secondary font-medium">
                Always categorize transactions from <strong className="text-txt-primary font-bold">&quot;{merchant.trim()}&quot;</strong> as <strong className="text-brand-primary font-bold">{currentCategories.find(c => c.id === selectedCategory)?.name || 'this category'}</strong>
              </span>
            </label>
          )}

          {/* Privacy Note */}
          <div className="flex items-center gap-1.5 px-1 mt-2.5 text-[10px] text-txt-secondary/70">
            <ShieldCheck size={12} className="shrink-0 text-brand-primary" />
            <span>
              Finovo uses Gemini AI to suggest categories from merchant text only. Financial amounts, account numbers, and balances are never sent.
            </span>
          </div>
        </div>

        {/* Merchant or Payee Name */}
        <div className="group">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5 text-txt-secondary">
              <Tag size={13} />
              <label className="text-[10px] font-bold uppercase tracking-wider">
                {transactionType === 'income' ? 'Payee / Source' : 'Merchant / Payee'}
              </label>
            </div>
            {errors.merchant && (
              <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
                <AlertCircle size={11} /> {errors.merchant}
              </span>
            )}
          </div>
          <input 
            type="text"
            value={merchant}
            disabled={isSubmitting}
            onChange={(e) => {
              setMerchant(e.target.value);
              if (errors.merchant) setErrors(prev => ({ ...prev, merchant: null }));
            }}
            placeholder={transactionType === 'income' ? "Enter source (e.g. Employer, Client, Bank Interest)" : "Enter merchant name (e.g. Swiggy, Metro, Amazon)"}
            className={`w-full bg-bg-card border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none transition-colors ${errors.merchant ? 'border-brand-error/60' : 'border-brand-border focus:border-brand-primary'}`}
          />
          {/* Quick Examples Chips */}
          <div className="flex gap-2 mt-2 px-1">
            {(transactionType === 'income' ? ['Salary', 'Client', 'Dividend', 'Refund'] : ['Swiggy', 'Uber', 'Amazon', 'Airtel']).map(m => (
              <button
                key={m}
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setMerchant(m);
                  if (errors.merchant) setErrors(prev => ({ ...prev, merchant: null }));
                }}
                className="text-[10px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-3 py-1.5 rounded-full hover:bg-brand-primary/20 active:scale-95 transition-all cursor-pointer"
              >
                + {m}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="group">
            <div className="flex items-center gap-1.5 mb-2 px-1 text-txt-secondary">
              <Calendar size={13} />
              <label className="text-[10px] font-bold uppercase tracking-wider">
                Date
              </label>
            </div>
            <input 
              type="date"
              value={date}
              disabled={isSubmitting}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
            />
          </div>

          <div className="group">
            <div className="flex items-center gap-1.5 mb-2 px-1 text-txt-secondary">
              <Clock size={13} />
              <label className="text-[10px] font-bold uppercase tracking-wider">
                Time
              </label>
            </div>
            <input 
              type="text"
              value={time}
              disabled={isSubmitting}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Notes Input */}
        <div className="group">
          <div className="flex items-center gap-1.5 mb-2 px-1 text-txt-secondary">
            <FileText size={13} />
            <label className="text-[10px] font-bold uppercase tracking-wider">
              Notes
            </label>
          </div>
          <input 
            type="text"
            value={note}
            disabled={isSubmitting}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add notes..."
            className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none focus:border-brand-primary"
          />
        </div>

        {/* Group Expense Toggle & Splitting (Only for expenses) */}
        {transactionType === 'expense' && (
          <div className="p-5 bg-bg-card border border-brand-border rounded-[16px] shadow-brand-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors
                  ${isGroupExpense ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-brand-border/40 border-brand-border text-txt-disabled'}`}>
                  <Users size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-txt-primary uppercase tracking-wider block">Group Expense</span>
                  <span className="text-[10px] text-txt-secondary/60 font-medium">Split expenses with other users</span>
                </div>
              </div>
              
              {/* Toggle Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsGroupExpense(!isGroupExpense)}
                className={`w-12 h-6 rounded-full p-1 transition-colors relative focus:outline-none cursor-pointer
                  ${isGroupExpense ? 'bg-brand-primary' : 'bg-brand-border'}`}
              >
                <motion.div 
                  layout
                  className="w-4 h-4 bg-white rounded-full shadow-md"
                  animate={{ x: isGroupExpense ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Animated Group Split Details */}
            <AnimatePresence>
              {isGroupExpense && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden mt-4 pt-4 border-t border-brand-border space-y-4"
                >
                  {/* Select Group (if groups exist) */}
                  {groups.length > 0 && (
                    <div>
                      <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider block mb-1.5">Attach to Group</span>
                      <select
                        value={selectedGroupId}
                        disabled={isSubmitting}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full bg-bg-app border border-brand-border rounded-xl py-2.5 px-3 text-xs font-bold text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
                      >
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Number of People */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Number of People</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setNumPeople(prev => Math.max(2, prev - 1))}
                        className="w-8 h-8 rounded-lg bg-bg-app hover:bg-bg-card text-txt-primary border border-brand-border flex items-center justify-center font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-bold w-6 text-center">{numPeople}</span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setNumPeople(prev => Math.min(50, prev + 1))}
                        className="w-8 h-8 rounded-lg bg-bg-app hover:bg-bg-card text-txt-primary border border-brand-border flex items-center justify-center font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Split Type (Equally / Custom) */}
                  <div>
                    <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider block mb-2">Split Mode</span>
                    <div className="flex bg-bg-app border border-brand-border p-1 rounded-xl">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSplitType('equal')}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                          ${splitType === 'equal' ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
                      >
                        {splitType === 'equal' && (
                          <motion.div layoutId="activeSplitType" className="absolute inset-0 bg-bg-card border border-brand-border rounded-lg shadow-brand-sm" />
                        )}
                        <span className="relative z-10">Split Equally</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSplitType('custom')}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                          ${splitType === 'custom' ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
                      >
                        {splitType === 'custom' && (
                          <motion.div layoutId="activeSplitType" className="absolute inset-0 bg-bg-card border border-brand-border rounded-lg shadow-brand-sm" />
                        )}
                        <span className="relative z-10">Custom Preview</span>
                      </button>
                    </div>
                  </div>

                  {/* Split breakdown info with exact paise calculation */}
                  {amount && Number(amount) > 0 && (
                    <div className="p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-brand-primary shrink-0" />
                        <span className="text-[11px] font-bold text-brand-primary">
                          Exact Split Allocation (Sum: {formatCurrency(amount)})
                        </span>
                      </div>
                      <div className="pl-5 text-[10px] text-txt-secondary space-y-0.5">
                        {equalShares.slice(0, 3).map((share, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>Person {idx + 1}{idx === 0 ? ' (You)' : ''}:</span>
                            <span className="font-bold text-txt-primary">{formatCurrency(share, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                        {numPeople > 3 && (
                          <p className="text-[9px] italic text-txt-secondary/60">...and {numPeople - 3} other members equal share</p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* Fixed Footer Bottom Action Button */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent pt-8">
        <button
          onClick={handleAddExpenseSubmit}
          disabled={isSubmitting}
          className="btn-primary rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Saving Transaction...</span>
            </>
          ) : (
            <>
              <span>{transactionType === 'income' ? 'Record Income' : 'Add Expense'}</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default AddExpense;
