import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Edit2, Trash2, AlertTriangle, 
  Wallet, Layers, Loader2, Check
} from 'lucide-react';
import { calculateBudgetProgress } from '../services/budgetService.js';
import { formatCurrency } from '../utils/currency.js';
import { getCurrentMonthBoundaries } from '../utils/date.js';

const AVAILABLE_CATEGORIES = [
  { id: '__GLOBAL__', name: 'Global Monthly Budget' },
  { id: 'Food', name: 'Food' },
  { id: 'Groceries', name: 'Groceries' },
  { id: 'Travel', name: 'Travel' },
  { id: 'Shopping', name: 'Shopping' },
  { id: 'Recharge', name: 'Recharge' },
  { id: 'Subscriptions', name: 'Subscriptions' },
  { id: 'Medicine', name: 'Medicine' },
  { id: 'Education', name: 'Education' },
  { id: 'Entertainment', name: 'Entertainment' },
  { id: 'Rent', name: 'Rent' },
  { id: 'Others', name: 'Others' }
];

export const BudgetManagerModal = ({
  isOpen,
  onClose,
  budgets = [],
  transactions = [],
  onSaveBudget,
  onDeleteBudget
}) => {
  // Modes: 'list', 'create', 'edit'
  const [viewMode, setViewMode] = useState('list');
  const [editingBudget, setEditingBudget] = useState(null);
  
  // Form state
  const [formCategory, setFormCategory] = useState('Global Monthly Budget');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation modal state
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const monthBoundaries = useMemo(() => getCurrentMonthBoundaries(), []);

  // Compute budget progress for each configured budget
  const budgetProgressList = useMemo(() => {
    return budgets.map(b => calculateBudgetProgress(b, transactions, monthBoundaries));
  }, [budgets, transactions, monthBoundaries]);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingBudget(null);
    setFormCategory('Global Monthly Budget');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormError(null);
    setViewMode('create');
  };

  const startEdit = (budget) => {
    setEditingBudget(budget);
    setFormCategory(budget.categoryName || 'Global Monthly Budget');
    setFormAmount(String(budget.amount));
    setFormPeriod(budget.period || 'monthly');
    setFormError(null);
    setViewMode('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Please enter a valid positive budget amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isGlobal = formCategory === 'Global Monthly Budget';
      await onSaveBudget({
        id: editingBudget?.id || null,
        categoryName: isGlobal ? null : formCategory,
        amount: amountNum,
        period: formPeriod,
        currency: 'INR'
      });
      setViewMode('list');
    } catch (err) {
      setFormError(err.message || 'Failed to save budget. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!budgetToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteBudget(budgetToDelete.id);
      setBudgetToDelete(null);
    } catch (err) {
      console.error('Failed to delete budget:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-manager-title"
        className="w-full max-w-lg bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-bg-app/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center border border-brand-primary/20 shrink-0">
              <Wallet size={20} />
            </div>
            <div>
              <h3 id="budget-manager-title" className="text-base font-bold text-txt-primary">Budget Management</h3>
              <p className="text-[11px] text-txt-secondary font-medium">Spending targets & category limits</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {viewMode === 'list' ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
                  Active Spending Targets ({budgetProgressList.length})
                </span>
                <button
                  onClick={startCreate}
                  className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-brand-sm cursor-pointer hover:opacity-95"
                >
                  <Plus size={13} /> Add Budget
                </button>
              </div>

              {/* Budgets List */}
              {budgetProgressList.length === 0 ? (
                <div className="text-center py-12 px-4 bg-bg-app border border-brand-border rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-3">
                    <Layers size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-txt-primary mb-1">No Budgets Set</h4>
                  <p className="text-xs text-txt-secondary max-w-xs mx-auto mb-4">
                    Create category-specific limits or a global spending cap to stay in control of your finances.
                  </p>
                  <button
                    onClick={startCreate}
                    className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer"
                  >
                    Set First Budget
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {budgetProgressList.map(({ budget, actualSpend, budgetAmount, remaining, percentage, isExceeded, status }) => {
                    const isGlobal = !budget.categoryId && (budget.categoryName === 'Global Monthly Budget' || !budget.categoryName);

                    return (
                      <div 
                        key={budget.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isExceeded 
                            ? 'bg-brand-error/5 border-brand-error/30' 
                            : status === 'danger'
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-bg-app border-brand-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-txt-primary">
                              {budget.categoryName || 'Global Monthly Budget'}
                            </span>
                            {isGlobal && (
                              <span className="px-1.5 py-0.2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded text-[9px] font-bold uppercase">
                                Global Wallet
                              </span>
                            )}
                            {isExceeded && (
                              <span className="px-1.5 py-0.2 bg-brand-error text-white rounded text-[9px] font-bold uppercase flex items-center gap-1">
                                <AlertTriangle size={9} /> Over Limit
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(budget)}
                              aria-label={`Edit ${budget.categoryName} budget`}
                              className="p-1.5 text-txt-secondary hover:text-brand-primary rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setBudgetToDelete(budget)}
                              aria-label={`Delete ${budget.categoryName} budget`}
                              className="p-1.5 text-txt-secondary hover:text-brand-error rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-bg-card border border-brand-border rounded-full overflow-hidden mb-2">
                          <div 
                            style={{ width: `${Math.min(100, percentage)}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExceeded 
                                ? 'bg-brand-error' 
                                : status === 'danger' 
                                ? 'bg-amber-500' 
                                : status === 'warning'
                                ? 'bg-brand-primary/80'
                                : 'bg-brand-primary'
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-secondary">
                            Spent: <span className="font-semibold text-txt-primary">{formatCurrency(actualSpend)}</span> of {formatCurrency(budgetAmount)}
                          </span>
                          <span className={`font-bold ${isExceeded ? 'text-brand-error' : 'text-txt-primary'}`}>
                            {isExceeded ? `Over by ${formatCurrency(actualSpend - budgetAmount)}` : `${remaining > 0 ? `${formatCurrency(remaining)} left` : 'Fully spent'}`} ({percentage}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* CREATE OR EDIT FORM */
            <form onSubmit={handleSave} className="space-y-4">
              <h4 className="text-xs font-bold text-txt-primary uppercase tracking-wider">
                {viewMode === 'edit' ? 'Edit Spending Target' : 'Create New Spending Target'}
              </h4>

              {formError && (
                <div className="p-3 bg-brand-error/10 border border-brand-error/20 text-brand-error text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                  Target Category
                </label>
                <select
                  disabled={viewMode === 'edit'}
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary disabled:opacity-60"
                >
                  {AVAILABLE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                  Limit Amount (₹ INR) <span className="text-brand-error">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 15000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-sm font-bold text-txt-primary outline-none focus:border-brand-primary"
                />
              </div>

              {/* Period Selection */}
              <div>
                <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                  Budget Period
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'yearly', label: 'Yearly' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormPeriod(p.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        formPeriod === p.id 
                          ? 'bg-brand-primary text-white border-brand-primary' 
                          : 'bg-bg-app border-brand-border text-txt-secondary'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 border border-brand-border text-txt-secondary text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-brand-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {viewMode === 'edit' ? 'Update Budget' : 'Save Budget'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Delete Confirmation Sub-modal */}
        <AnimatePresence>
          {budgetToDelete && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-bg-card border border-brand-border rounded-2xl p-5 shadow-brand-xl space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-error/10 text-brand-error flex items-center justify-center mb-1">
                  <Trash2 size={20} />
                </div>
                <h4 className="text-sm font-bold text-txt-primary">Delete Spending Budget?</h4>
                <p className="text-xs text-txt-secondary leading-relaxed">
                  Are you sure you want to remove the budget for "{budgetToDelete.categoryName || 'Global Monthly Budget'}" ({formatCurrency(budgetToDelete.amount)})? Your past transactions will not be affected.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setBudgetToDelete(null)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 border border-brand-border text-txt-secondary text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-brand-error text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default BudgetManagerModal;
