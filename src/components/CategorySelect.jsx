import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Utensils, Car, Smartphone, ShoppingBag,
  Film, GraduationCap, HeartPulse, Grid, X,
  ArrowRight, Check, Sparkles, Zap, Loader2, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { suggestCategory } from '../utils/categorizationEngine.js';
import { requestAiCategorization } from '../services/aiCategorizationService.js';

const categories = [
  { id: 'food', name: 'Food', icon: Utensils },
  { id: 'groceries', name: 'Groceries', icon: ShoppingBag },
  { id: 'travel', name: 'Travel', icon: Car },
  { id: 'recharge', name: 'Recharge', icon: Smartphone },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag },
  { id: 'subscriptions', name: 'Subscriptions', icon: Film },
  { id: 'entertainment', name: 'Entertainment', icon: Film },
  { id: 'education', name: 'Education', icon: GraduationCap },
  { id: 'medicine', name: 'Medicine', icon: HeartPulse },
  { id: 'others', name: 'Others', icon: Grid },
  { id: 'uncategorized', name: 'Uncategorized', icon: AlertCircle },
];

const CategoryChip = ({ category, isSelected, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className={`relative p-5 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3 overflow-hidden group cursor-pointer
      ${isSelected
        ? 'bg-brand-primary/5 border-brand-primary'
        : 'bg-bg-card border-brand-border hover:border-brand-border/90'}`}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all
      ${isSelected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-brand-primary/5 text-brand-primary border border-brand-border'}`}>
      <category.icon size={20} />
    </div>

    <span className={`text-[11px] font-bold uppercase tracking-wider
      ${isSelected ? 'text-brand-primary' : 'text-txt-secondary'}`}>
      {category.name}
    </span>

    {isSelected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute bottom-2 right-2 w-4 h-4 bg-brand-primary rounded-full flex items-center justify-center text-white"
      >
        <Check size={10} className="stroke-[3px]" />
      </motion.div>
    )}
  </motion.button>
);

const CategorySelect = ({ onBack, tx, onConfirmCategory, userRules = [], userProfile = {} }) => {
  const suggestion = useMemo(() => {
    return suggestCategory({
      transactionType: tx?.type || 'expense',
      merchant: tx?.merchant || '',
      description: tx?.notes || '',
      userRules,
      availableCategories: categories
    });
  }, [tx, userRules]);

  const [selectedId, setSelectedId] = useState(() => {
    if (tx?.category && tx.category !== 'Uncategorized') {
      const match = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
      if (match) return match.id;
    }
    const initialSuggestion = suggestCategory({
      transactionType: tx?.type || 'expense',
      merchant: tx?.merchant || '',
      description: tx?.notes || '',
      userRules,
      availableCategories: categories
    });
    if (initialSuggestion && initialSuggestion.confidenceScore > 0) {
      return initialSuggestion.categoryId;
    }
    return 'food';
  });

  const [search, setSearch] = useState('');
  const [alwaysCategorizeAsRule, setAlwaysCategorizeAsRule] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiError, setAiError] = useState(null);

  const handleAskAi = async () => {
    if (!tx) return;
    if (userProfile?.aiCategorizationEnabled === false) {
      setAiError('AI categorisation is disabled in your Privacy settings.');
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await requestAiCategorization({
        merchant: tx.merchant || '',
        description: tx.notes || '',
        transactionType: tx.type || 'expense',
        allowedCategories: categories,
        enabled: userProfile?.aiCategorizationEnabled !== false
      });

      if (!res.available) {
        setAiError(res.error || 'AI categorisation service is unavailable.');
      } else if (!res.success || !res.suggestion) {
        setAiError(res.error || 'AI could not confidently determine a category.');
      } else {
        setAiSuggestion(res.suggestion);
        setSelectedId(res.suggestion.categoryId);
      }
    } catch (err) {
      setAiError(err.message || 'Error communicating with AI service.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = () => {
    if (!tx) return;
    const matchedCategory = categories.find(c => c.id === selectedId);
    if (matchedCategory) {
      onConfirmCategory(tx.id, matchedCategory.name, {
        saveRule: alwaysCategorizeAsRule,
        merchant: tx.merchant,
        isManualCategory: true
      });
    }
  };

  const merchant = tx ? tx.merchant : 'Unknown';
  const amount = tx ? tx.amount : '0';
  const selectedCategoryName = categories.find(c => c.id === selectedId)?.name || 'this category';

  return (
    <div className="fixed inset-0 z-[130] bg-bg-app flex flex-col overflow-hidden text-txt-primary">
      {/* Header */}
      <div className="relative p-6 pt-12 flex items-center justify-between border-b border-brand-border bg-bg-card/90 backdrop-blur-md z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary cursor-pointer">
          <X size={18} />
        </button>
        <div className="text-center">
          <h2 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-0.5">Categorize</h2>
          <p className="text-sm font-semibold text-txt-primary">{merchant}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-36 relative">
        {/* Transaction Hero */}
        <div className="py-8 text-center">
          <motion.h1
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold text-txt-primary tracking-tight mb-2"
          >
            {formatCurrency(amount)}
          </motion.h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-primary/5 border border-brand-primary/10 rounded-full">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Select Category Below</span>
          </div>
        </div>

        {/* AI Loading Indicator */}
        {isAiLoading && (
          <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300 animate-pulse">
            <Loader2 size={14} className="animate-spin text-purple-600 shrink-0" />
            <span>Consulting Google Gemini AI for {tx?.merchant}...</span>
          </div>
        )}

        {/* AI Error Notification */}
        {aiError && !isAiLoading && (
          <div className="mb-4 p-3 bg-brand-warning/10 border border-brand-warning/20 rounded-xl flex items-center justify-between gap-2 text-xs text-brand-warning">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle size={13} className="shrink-0" />
              <span className="truncate">{aiError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="text-[10px] font-bold uppercase tracking-wider hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* AI Suggestion Callout Banner */}
        {aiSuggestion && (
          <div 
            onClick={() => setSelectedId(aiSuggestion.categoryId)}
            className="mb-6 p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/50 transition-all shadow-brand-sm"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-txt-primary">AI Suggested: {aiSuggestion.categoryName}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    Gemini AI ({Math.round(aiSuggestion.confidenceScore * 100)}%)
                  </span>
                </div>
                <p className="text-[11px] text-txt-secondary truncate mt-0.5">{aiSuggestion.explanation}</p>
              </div>
            </div>
            {selectedId === aiSuggestion.categoryId ? (
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 uppercase tracking-wider shrink-0">
                <Check size={12} /> Selected
              </span>
            ) : (
              <button
                type="button"
                className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider hover:underline shrink-0"
              >
                Tap to pick
              </button>
            )}
          </div>
        )}

        {/* Rule Suggestion Callout Banner */}
        {!aiSuggestion && suggestion && suggestion.confidenceScore > 0 && (
          <div 
            onClick={() => setSelectedId(suggestion.categoryId)}
            className="mb-4 p-3.5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-brand-primary/40 transition-all shadow-brand-sm"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                <Zap size={16} />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-brand-primary">Rule Match: {suggestion.categoryName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    suggestion.confidenceLevel === 'HIGH' ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-warning/15 text-brand-warning'
                  }`}>
                    {suggestion.confidenceLevel}
                  </span>
                </div>
                <p className="text-[11px] text-txt-secondary truncate mt-0.5">{suggestion.explanation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedId === suggestion.categoryId ? (
                <span className="text-[10px] font-bold text-brand-success flex items-center gap-1 uppercase tracking-wider">
                  <Check size={12} /> Selected
                </span>
              ) : (
                <button
                  type="button"
                  className="text-[10px] font-bold text-brand-primary uppercase tracking-wider hover:underline"
                >
                  Pick
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ask Gemini AI Trigger Option */}
        {!aiSuggestion && !isAiLoading && (
          <div className="mb-6 flex items-center justify-between p-2.5 px-3 bg-bg-card border border-brand-border rounded-xl">
            <span className="text-xs text-txt-secondary">
              Want a second opinion from AI?
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

        {/* Search */}
        <div className="relative mb-6 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-txt-secondary/60 group-focus-within:text-brand-primary transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 pl-12 pr-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none focus:border-brand-primary transition-all"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {filteredCategories.map((cat) => (
            <CategoryChip
              key={cat.id}
              category={cat}
              isSelected={selectedId === cat.id}
              onClick={() => setSelectedId(cat.id)}
            />
          ))}
        </div>

        {/* Rule learning checkbox */}
        {merchant && merchant !== 'Unknown Merchant' && (
          <label className="flex items-center gap-2.5 p-3.5 bg-bg-card border border-brand-border rounded-xl cursor-pointer hover:border-brand-primary/40 transition-colors select-none mb-6">
            <input
              type="checkbox"
              checked={alwaysCategorizeAsRule}
              onChange={(e) => setAlwaysCategorizeAsRule(e.target.checked)}
              className="w-4 h-4 rounded border-brand-border text-brand-primary accent-brand-primary cursor-pointer"
            />
            <span className="text-xs text-txt-secondary font-medium">
              Always categorize transactions from <strong className="text-txt-primary font-bold">&quot;{merchant}&quot;</strong> as <strong className="text-brand-primary font-bold">{selectedCategoryName}</strong>
            </span>
          </label>
        )}
      </div>

      {/* Footer Action */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent pt-8 z-10">
        <button
          onClick={handleConfirm}
          className="btn-primary rounded-xl"
        >
          Confirm Category ({selectedCategoryName})
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default CategorySelect;

