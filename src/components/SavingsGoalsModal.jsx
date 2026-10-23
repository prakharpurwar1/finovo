import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Target, CheckCircle2, AlertTriangle, 
  Trash2, Edit2, Coins, 
  Loader2, Check, Clock
} from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';

export const SavingsGoalsModal = ({
  isOpen,
  onClose,
  goals = [],
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddContribution
}) => {
  // Modes: 'list', 'create', 'edit'
  const [viewMode, setViewMode] = useState('list');
  const [editingGoal, setEditingGoal] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formTargetAmount, setFormTargetAmount] = useState('');
  const [formInitialAmount, setFormInitialAmount] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contribution sub-dialog state
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [isContributing, setIsContributing] = useState(false);

  // Delete confirmation state
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingGoal(null);
    setFormName('');
    setFormTargetAmount('');
    setFormInitialAmount('');
    setFormTargetDate('');
    setFormCategory('general');
    setFormError(null);
    setViewMode('create');
  };

  const startEdit = (goal) => {
    setEditingGoal(goal);
    setFormName(goal.name);
    setFormTargetAmount(String(goal.targetAmount));
    setFormInitialAmount(String(goal.currentAmount));
    setFormTargetDate(goal.targetDate || '');
    setFormCategory(goal.category || 'general');
    setFormError(null);
    setViewMode('edit');
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Please provide a name for your savings goal.');
      return;
    }

    const targetNum = parseFloat(formTargetAmount);
    if (isNaN(targetNum) || targetNum <= 0) {
      setFormError('Target amount must be a positive number.');
      return;
    }

    const initialNum = parseFloat(formInitialAmount) || 0;
    if (initialNum < 0) {
      setFormError('Initial saved amount cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGoal) {
        await onUpdateGoal(editingGoal.id, {
          name: formName.trim(),
          targetAmount: targetNum,
          currentAmount: initialNum,
          targetDate: formTargetDate || null,
          category: formCategory
        });
      } else {
        await onCreateGoal({
          name: formName.trim(),
          targetAmount: targetNum,
          currentAmount: initialNum,
          targetDate: formTargetDate || null,
          category: formCategory,
          currency: 'INR'
        });
      }
      setViewMode('list');
    } catch (err) {
      setFormError(err.message || 'Failed to save savings goal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteContribution = async (e) => {
    e.preventDefault();
    if (!contributeGoal) return;

    const amt = parseFloat(contributionAmount);
    if (isNaN(amt) || amt <= 0) {
      return;
    }

    setIsContributing(true);
    try {
      await onAddContribution(contributeGoal.id, amt, contributionNote);
      setContributeGoal(null);
      setContributionAmount('');
      setContributionNote('');
    } catch (err) {
      console.error('Failed to contribute:', err);
    } finally {
      setIsContributing(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteGoal(goalToDelete.id);
      setGoalToDelete(null);
    } catch (err) {
      console.error('Failed to delete goal:', err);
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
        aria-labelledby="savings-modal-title"
        className="w-full max-w-lg bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-bg-app/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-success/10 text-brand-success flex items-center justify-center border border-brand-success/20 shrink-0">
              <Target size={20} />
            </div>
            <div>
              <h3 id="savings-modal-title" className="text-base font-bold text-txt-primary">Savings Goals</h3>
              <p className="text-[11px] text-txt-secondary font-medium">Build wealth & reach targets</p>
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
                  Your Financial Goals ({goals.length})
                </span>
                <button
                  onClick={startCreate}
                  className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-brand-sm cursor-pointer hover:opacity-95"
                >
                  <Plus size={13} /> New Goal
                </button>
              </div>

              {goals.length === 0 ? (
                <div className="text-center py-12 px-4 bg-bg-app border border-brand-border rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-brand-success/10 text-brand-success flex items-center justify-center mx-auto mb-3">
                    <Coins size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-txt-primary mb-1">No Savings Goals Yet</h4>
                  <p className="text-xs text-txt-secondary max-w-xs mx-auto mb-4">
                    Set a target for an emergency fund, travel, new gadget, or investments.
                  </p>
                  <button
                    onClick={startCreate}
                    className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer"
                  >
                    Create First Goal
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map(goal => {
                    const isCompleted = goal.isCompleted;
                    const isOverdue = goal.isOverdue;

                    return (
                      <div 
                        key={goal.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isCompleted
                            ? 'bg-brand-success/5 border-brand-success/30'
                            : isOverdue
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-bg-app border-brand-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-txt-primary">{goal.name}</span>
                            {isCompleted ? (
                              <span className="px-1.5 py-0.2 bg-brand-success text-white rounded text-[9px] font-bold uppercase flex items-center gap-1">
                                <CheckCircle2 size={9} /> Completed
                              </span>
                            ) : isOverdue ? (
                              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-bold uppercase flex items-center gap-1">
                                <Clock size={9} /> Target Date Passed
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1">
                            {!isCompleted && (
                              <button
                                onClick={() => setContributeGoal(goal)}
                                className="px-2.5 py-1 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/20 rounded-lg text-[10px] font-bold transition-all cursor-pointer mr-1"
                              >
                                + Contribute
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(goal)}
                              aria-label={`Edit ${goal.name}`}
                              className="p-1.5 text-txt-secondary hover:text-brand-primary rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setGoalToDelete(goal)}
                              aria-label={`Delete ${goal.name}`}
                              className="p-1.5 text-txt-secondary hover:text-brand-error rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-bg-card border border-brand-border rounded-full overflow-hidden mb-2">
                          <div 
                            style={{ width: `${goal.percentage}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCompleted 
                                ? 'bg-brand-success' 
                                : 'bg-brand-primary'
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-txt-secondary">
                            Saved: <span className="font-bold text-txt-primary">{formatCurrency(goal.currentAmount)}</span> of {formatCurrency(goal.targetAmount)}
                          </span>
                          <span className="font-bold text-txt-primary">
                            {isCompleted ? 'Goal Reached!' : `${formatCurrency(goal.remaining)} remaining`} ({goal.percentage}%)
                          </span>
                        </div>

                        {goal.targetDate && (
                          <div className="mt-2 pt-2 border-t border-brand-border/40 text-[10px] text-txt-secondary flex items-center justify-between">
                            <span>Target Date: {goal.targetDate}</span>
                            <span>Category: {goal.category}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* CREATE OR EDIT FORM */
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <h4 className="text-xs font-bold text-txt-primary uppercase tracking-wider">
                {viewMode === 'edit' ? 'Edit Savings Goal' : 'Create New Savings Goal'}
              </h4>

              {formError && (
                <div className="p-3 bg-brand-error/10 border border-brand-error/20 text-brand-error text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                  Goal Name <span className="text-brand-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Fund, Japan Trip, New Laptop"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                    Target Amount (₹) <span className="text-brand-error">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 100000"
                    value={formTargetAmount}
                    onChange={(e) => setFormTargetAmount(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-sm font-bold text-txt-primary outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                    Already Saved (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formInitialAmount}
                    onChange={(e) => setFormInitialAmount(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-sm font-bold text-txt-primary outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                    Target Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
                    Category Tag
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                  >
                    <option value="emergency">Emergency Fund</option>
                    <option value="travel">Travel & Vacation</option>
                    <option value="gadget">Tech & Gadgets</option>
                    <option value="investment">Wealth & Investments</option>
                    <option value="vehicle">Car & Bike</option>
                    <option value="home">Home & Renovation</option>
                    <option value="general">General Savings</option>
                  </select>
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
                  {viewMode === 'edit' ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* CONTRIBUTION MODAL */}
        <AnimatePresence>
          {contributeGoal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-bg-card border border-brand-border rounded-2xl p-5 shadow-brand-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-txt-primary">Contribute to {contributeGoal.name}</h4>
                  <button onClick={() => setContributeGoal(null)} className="text-txt-secondary hover:text-txt-primary">
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={handleExecuteContribution} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-txt-secondary uppercase mb-1">
                      Contribution Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      placeholder="e.g. 5000"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-sm font-bold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>

                  {/* Quick pills */}
                  <div className="flex gap-2">
                    {[500, 1000, 2000, 5000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setContributionAmount(String(val))}
                        className="px-2.5 py-1 bg-bg-app border border-brand-border rounded-lg text-xs font-semibold text-txt-secondary hover:text-txt-primary cursor-pointer"
                      >
                        +₹{val}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-txt-secondary uppercase mb-1">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Monthly salary savings"
                      value={contributionNote}
                      onChange={(e) => setContributionNote(e.target.value)}
                      className="w-full bg-bg-app border border-brand-border rounded-xl p-2.5 text-xs text-txt-primary outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setContributeGoal(null)}
                      className="px-3.5 py-2 border border-brand-border text-txt-secondary text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isContributing}
                      className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer disabled:opacity-50"
                    >
                      {isContributing ? 'Saving...' : 'Add Contribution'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DELETE CONFIRMATION MODAL */}
        <AnimatePresence>
          {goalToDelete && (
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
                <h4 className="text-sm font-bold text-txt-primary">Delete Savings Goal?</h4>
                <p className="text-xs text-txt-secondary leading-relaxed">
                  Are you sure you want to delete "{goalToDelete.name}"? Progress of {formatCurrency(goalToDelete.currentAmount)} will be removed.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setGoalToDelete(null)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 border border-brand-border text-txt-secondary text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteGoal}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-brand-error text-white text-xs font-bold rounded-xl shadow-brand-sm cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Goal'}
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

export default SavingsGoalsModal;
