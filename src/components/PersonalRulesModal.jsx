import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Tag, Trash2, Edit2, Check, Sparkles, 
  History, Zap, Loader2,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { transactionService } from '../services/transactionService.js';

const allCategories = [
  'Food', 'Groceries', 'Travel', 'Shopping', 'Recharge', 
  'Subscriptions', 'Medicine', 'Education', 'Entertainment', 'Rent',
  'Salary', 'Freelance', 'Investments', 'Refunds', 'Gift', 
  'Others', 'Uncategorized'
];

export const PersonalRulesModal = ({
  isOpen,
  onClose,
  userRules = [],
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
  transactions = [],
  onApplyHistoricalRecategorisation,
  showToast = () => {}
}) => {
  // New rule form states
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState('Food');
  const [matchType, setMatchType] = useState('exact'); // 'exact', 'contains', 'regex'
  const [transactionType, setTransactionType] = useState('all'); // 'all', 'expense', 'income'
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Edit rule states
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editPattern, setEditPattern] = useState('');
  const [editCategory, setEditCategory] = useState('Food');
  const [editMatchType, setEditMatchType] = useState('exact');
  const [editTransactionType, setEditTransactionType] = useState('all');

  // Historical Recategorisation Review states
  const [reviewRule, setReviewRule] = useState(null);
  const [historicalCandidates, setHistoricalCandidates] = useState([]);
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplyingUpdates, setIsApplyingUpdates] = useState(false);
  const [previewStats, setPreviewStats] = useState({ totalMatching: 0, alreadyMatching: 0 });

  if (!isOpen) return null;

  // Add rule handler
  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!pattern.trim() || isSubmittingNew) return;

    setIsSubmittingNew(true);
    try {
      await onAddRule({
        merchantPattern: pattern.trim(),
        categoryName: category,
        matchType,
        transactionType,
        isActive: true
      });
      showToast(`Personal rule created for "${pattern.trim()}".`, 'success');
      setPattern('');
    } catch (err) {
      showToast(err.message || 'Failed to create rule.', 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Start editing a rule
  const handleStartEdit = (rule) => {
    setEditingRuleId(rule.id);
    setEditPattern(rule.merchantPattern);
    setEditCategory(rule.categoryName);
    setEditMatchType(rule.matchType || 'exact');
    setEditTransactionType(rule.transactionType || 'all');
  };

  // Save edited rule
  const handleSaveEdit = async (ruleId) => {
    if (!editPattern.trim()) return;
    try {
      await onUpdateRule(ruleId, {
        merchantPattern: editPattern.trim(),
        categoryName: editCategory,
        matchType: editMatchType,
        transactionType: editTransactionType
      });
      setEditingRuleId(null);
      showToast('Rule updated successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update rule.', 'error');
    }
  };

  // Start historical review workflow for a rule
  const handleOpenHistoricalReview = async (rule) => {
    setReviewRule(rule);
    setIsLoadingPreview(true);
    setSelectedTxIds(new Set());

    try {
      const res = await transactionService.previewHistoricalRecategorisation({
        userId: rule.userId || 'current',
        merchantPattern: rule.merchantPattern,
        matchType: rule.matchType || 'exact',
        transactionType: rule.transactionType || 'all',
        newCategoryName: rule.categoryName,
        currentTransactions: transactions
      });

      setHistoricalCandidates(res.candidates);
      setPreviewStats({
        totalMatching: res.totalMatching,
        alreadyMatching: res.alreadyMatching
      });

      // Default selection: select all candidate transactions EXCEPT those that were manually confirmed
      // To strictly avoid silently overwriting manual confirmations without explicit user opt-in
      const defaultSelected = new Set();
      for (const c of res.candidates) {
        if (!c.isManualCategory) {
          defaultSelected.add(c.id);
        }
      }
      setSelectedTxIds(defaultSelected);
    } catch (err) {
      showToast(err.message || 'Error scanning historical transactions.', 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Toggle selection of a historical transaction
  const handleToggleTxSelection = (id) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAllToggle = () => {
    if (selectedTxIds.size === historicalCandidates.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(historicalCandidates.map(c => c.id)));
    }
  };

  // Apply historical recategorisation to selected transactions
  const handleApplyHistoricalUpdates = async () => {
    if (selectedTxIds.size === 0 || !reviewRule || isApplyingUpdates) return;

    setIsApplyingUpdates(true);
    try {
      const updates = historicalCandidates
        .filter(c => selectedTxIds.has(c.id))
        .map(c => ({
          id: c.id,
          newCategoryName: reviewRule.categoryName
        }));

      if (onApplyHistoricalRecategorisation) {
        await onApplyHistoricalRecategorisation(updates);
      } else {
        await transactionService.applyHistoricalRecategorisation(reviewRule.userId || 'current', updates);
      }

      showToast(`Updated ${updates.length} historical transaction(s) to ${reviewRule.categoryName}.`, 'success');
      setReviewRule(null);
    } catch (err) {
      showToast(err.message || 'Failed to update historical transactions.', 'error');
    } finally {
      setIsApplyingUpdates(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-brand-secondary/40 backdrop-blur-sm flex items-end justify-center">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative w-full max-w-lg bg-bg-card border-t border-brand-border rounded-t-[28px] px-6 pt-6 pb-10 z-10 text-txt-primary max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-5 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
              <Tag size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-txt-primary">Personal Merchant Rules</h3>
              <p className="text-[10px] text-txt-secondary font-medium uppercase tracking-wider">
                User-Controlled Categorisation
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Rule Precedence Banner */}
        <div className="p-3 bg-brand-primary/5 border border-brand-primary/15 rounded-xl mb-4 shrink-0 text-xs text-txt-secondary leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-brand-primary mb-0.5">
            <Zap size={13} />
            <span>Rule Evaluation Precedence</span>
          </div>
          <p className="text-[11px]">
            Your personal rules take top priority over generic dictionaries and AI. Evaluation order: <strong>Exact Match</strong> &gt; <strong>Contains (Longer Substrings)</strong> &gt; <strong>Regex</strong>.
          </p>
        </div>

        {/* Add Rule Form */}
        <form onSubmit={handleCreateRule} className="p-3.5 bg-bg-app border border-brand-border rounded-xl mb-4 shrink-0 space-y-3">
          <span className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider block">
            Create Personal Rule
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Merchant or keyword (e.g. Swiggy)"
              className="bg-bg-card border border-brand-border rounded-lg px-3 py-2 text-xs text-txt-primary outline-none focus:border-brand-primary"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-2 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
            >
              {allCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-2">
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-txt-secondary outline-none focus:border-brand-primary cursor-pointer"
                title="Match Type"
              >
                <option value="exact">Match: Exact Name</option>
                <option value="contains">Match: Contains Keyword</option>
                <option value="regex">Match: Regex Expression</option>
              </select>

              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-txt-secondary outline-none focus:border-brand-primary cursor-pointer"
                title="Applicable Transaction Type"
              >
                <option value="all">Type: All (Expenses & Income)</option>
                <option value="expense">Type: Expenses Only</option>
                <option value="income">Type: Income Only</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!pattern.trim() || isSubmittingNew}
              className="px-3.5 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-brand-sm"
            >
              {isSubmittingNew ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>Add Rule</span>
            </button>
          </div>
        </form>

        {/* Existing Rules List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 mb-4 pr-1">
          {userRules.length === 0 ? (
            <div className="p-8 text-center bg-bg-app/40 border border-dashed border-brand-border rounded-xl">
              <Sparkles size={24} className="mx-auto text-brand-primary/40 mb-2" />
              <p className="text-xs font-bold text-txt-primary mb-1">No Custom Rules Created</p>
              <p className="text-[11px] text-txt-secondary leading-relaxed max-w-xs mx-auto">
                Add rules here or check &quot;Always categorise...&quot; when recording transactions to train your personal categorization.
              </p>
            </div>
          ) : (
            userRules.map((rule, idx) => {
              const isEditingThis = editingRuleId === rule.id;
              const isActive = rule.isActive !== false;

              if (isEditingThis) {
                return (
                  <div key={rule.id} className="p-3 bg-bg-app border-2 border-brand-primary rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                        Edit Rule #{idx + 1}
                      </span>
                      <button 
                        onClick={() => setEditingRuleId(null)}
                        className="text-[11px] text-txt-secondary hover:text-txt-primary cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editPattern}
                        onChange={(e) => setEditPattern(e.target.value)}
                        className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="bg-bg-card border border-brand-border rounded-lg px-2 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary cursor-pointer"
                      >
                        {allCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <select
                          value={editMatchType}
                          onChange={(e) => setEditMatchType(e.target.value)}
                          className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[10px] text-txt-secondary outline-none cursor-pointer"
                        >
                          <option value="exact">Exact</option>
                          <option value="contains">Contains</option>
                          <option value="regex">Regex</option>
                        </select>
                        <select
                          value={editTransactionType}
                          onChange={(e) => setEditTransactionType(e.target.value)}
                          className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[10px] text-txt-secondary outline-none cursor-pointer"
                        >
                          <option value="all">All</option>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(rule.id)}
                        className="px-3 py-1 bg-brand-primary text-white rounded-lg text-xs font-bold hover:opacity-90 cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={rule.id}
                  className={`p-3 bg-bg-app border rounded-xl transition-all ${
                    isActive 
                      ? 'border-brand-border hover:border-brand-border/90' 
                      : 'border-brand-border/40 opacity-60 bg-bg-app/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                        #{idx + 1} • {rule.matchType === 'exact' ? 'Exact' : rule.matchType === 'contains' ? 'Contains' : 'Regex'}
                      </span>
                      {rule.transactionType && rule.transactionType !== 'all' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-bg-card text-txt-secondary border border-brand-border capitalize">
                          {rule.transactionType}
                        </span>
                      )}
                      {!isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-warning/10 text-brand-warning border border-brand-warning/20">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Active/Inactive Toggle */}
                      <button
                        onClick={() => onToggleRule && onToggleRule(rule.id)}
                        title={isActive ? 'Disable rule' : 'Enable rule'}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-brand-success/10 text-brand-success border-brand-success/20 hover:bg-brand-success/20' 
                            : 'bg-bg-card text-txt-secondary border-brand-border hover:text-txt-primary'
                        }`}
                      >
                        {isActive ? 'Active' : 'Off'}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleStartEdit(rule)}
                        title="Edit Rule"
                        className="w-7 h-7 rounded-lg hover:bg-bg-card text-txt-secondary hover:text-txt-primary flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteRule && onDeleteRule(rule.id)}
                        title="Delete Rule"
                        className="w-7 h-7 rounded-lg hover:bg-brand-error/10 text-txt-secondary hover:text-brand-error flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xs font-bold text-txt-primary truncate">
                        &quot;{rule.merchantPattern}&quot;
                      </span>
                      <ArrowRight size={12} className="text-txt-secondary shrink-0" />
                      <span className="text-xs font-bold text-brand-primary px-2 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 shrink-0">
                        {rule.categoryName}
                      </span>
                    </div>

                    {/* Historical Review Trigger */}
                    <button
                      onClick={() => handleOpenHistoricalReview(rule)}
                      className="text-[10px] font-bold text-txt-secondary hover:text-brand-primary flex items-center gap-1 cursor-pointer shrink-0 ml-1"
                      title="Review past transactions matching this rule"
                    >
                      <History size={11} />
                      <span>Review Past</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Done Button */}
        <button 
          onClick={onClose}
          className="btn-primary rounded-xl shrink-0"
        >
          Done
        </button>
      </motion.div>

      {/* Historical Recategorisation Review Sub-Modal (Phase 3) */}
      <AnimatePresence>
        {reviewRule && (
          <div className="fixed inset-0 z-[150] bg-brand-secondary/50 backdrop-blur-md flex items-end justify-center">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setReviewRule(null)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-bg-card border-t border-brand-border rounded-t-[28px] px-6 pt-6 pb-10 z-10 text-txt-primary max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-5 shrink-0" />

              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-brand-primary" />
                  <h3 className="text-sm font-bold text-txt-primary">Historical Recategorisation</h3>
                </div>
                <button 
                  onClick={() => setReviewRule(null)}
                  className="w-7 h-7 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="p-3 bg-bg-app border border-brand-border rounded-xl mb-4 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-txt-primary mb-1">
                  <span>Rule:</span>
                  <span className="text-brand-primary">&quot;{reviewRule.merchantPattern}&quot;</span>
                  <ArrowRight size={12} className="text-txt-secondary" />
                  <span className="text-brand-primary">{reviewRule.categoryName}</span>
                </div>
                <p className="text-[11px] text-txt-secondary leading-relaxed">
                  {previewStats.totalMatching} transaction(s) match this merchant. {previewStats.alreadyMatching} already categorised as {reviewRule.categoryName}. Select candidate transactions to update.
                </p>
              </div>

              {isLoadingPreview ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2 flex-1">
                  <Loader2 size={24} className="animate-spin text-brand-primary" />
                  <span className="text-xs font-semibold text-txt-secondary">Scanning historical ledger...</span>
                </div>
              ) : historicalCandidates.length === 0 ? (
                <div className="p-8 text-center bg-bg-app/50 border border-dashed border-brand-border rounded-xl flex-1 flex flex-col items-center justify-center">
                  <CheckCircle2 size={28} className="text-brand-success mb-2" />
                  <p className="text-xs font-bold text-txt-primary mb-1">All Records Up to Date</p>
                  <p className="text-[11px] text-txt-secondary leading-relaxed max-w-xs">
                    All historical transactions matching &quot;{reviewRule.merchantPattern}&quot; are already categorised as {reviewRule.categoryName}.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                    <span className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider">
                      Candidate Records ({historicalCandidates.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllToggle}
                      className="text-[10px] font-bold text-brand-primary uppercase tracking-wider hover:underline cursor-pointer"
                    >
                      {selectedTxIds.size === historicalCandidates.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                    {historicalCandidates.map(candidate => {
                      const isSelected = selectedTxIds.has(candidate.id);
                      return (
                        <div
                          key={candidate.id}
                          onClick={() => handleToggleTxSelection(candidate.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-brand-primary/5 border-brand-primary' 
                              : 'bg-bg-app border-brand-border hover:border-brand-border/90'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-brand-primary border-brand-primary text-white' : 'border-brand-border bg-bg-card'
                            }`}>
                              {isSelected && <Check size={11} className="stroke-[3]" />}
                            </div>

                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-txt-primary truncate">
                                  {candidate.merchant}
                                </span>
                                <span className="text-[10px] text-txt-secondary font-medium">
                                  {candidate.date}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-txt-secondary line-through">
                                  {candidate.currentCategory}
                                </span>
                                <ArrowRight size={10} className="text-txt-secondary" />
                                <span className="text-[10px] font-bold text-brand-primary">
                                  {candidate.proposedCategory}
                                </span>
                                {candidate.isManualCategory && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-warning/15 text-brand-warning">
                                    Manual confirmation
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="text-xs font-bold text-txt-primary shrink-0">
                            {formatCurrency(candidate.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReviewRule(null)}
                      disabled={isApplyingUpdates}
                      className="flex-1 py-3 rounded-xl border border-brand-border text-xs font-bold text-txt-secondary hover:text-txt-primary cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyHistoricalUpdates}
                      disabled={selectedTxIds.size === 0 || isApplyingUpdates}
                      className="flex-1 py-3 rounded-xl bg-brand-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shadow-brand-sm transition-all"
                    >
                      {isApplyingUpdates ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Update Selected ({selectedTxIds.size})</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PersonalRulesModal;
