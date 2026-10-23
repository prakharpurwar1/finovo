import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, X, Search, Edit2, Receipt, Plus,
  Utensils, Car, ShoppingBag, Smartphone, HeartPulse,
  GraduationCap, Film, Grid, ShieldAlert,
  AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
  Download
} from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';
import { isDemoItem } from '../data/demoFixtures.js';

const categoryIcons = {
  Food: Utensils,
  Travel: Car,
  Shopping: ShoppingBag,
  Recharge: Smartphone,
  Medicine: HeartPulse,
  Education: GraduationCap,
  Entertainment: Film,
  Others: Grid,
  Uncategorized: ShieldAlert
};

const categories = [
  'All',
  'Food',
  'Travel',
  'Shopping',
  'Recharge',
  'Medicine',
  'Salary',
  'Investments',
  'Freelance',
  'Others'
];

const History = ({ 
  transactions = [], 
  onSelectTx, 
  onAdd, 
  onOpenExport,
  isLoading = false, 
  error = null, 
  onRetry = null 
}) => {
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Advanced Filters State
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    type: 'all', // 'all', 'income', 'expense'
    sortOrder: 'newest', // 'newest', 'oldest', 'lowToHigh', 'highToLow'
    merchant: '',
    category: 'All'
  });

  // Working state for filter sheet (before apply is clicked)
  const [tempFilters, setTempFilters] = useState({ ...filters });

  const openFilterSheet = () => {
    setTempFilters({ ...filters });
    setShowFilterSheet(true);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setCurrentPage(1);
    setShowFilterSheet(false);
  };

  const resetFilters = () => {
    const defaultFilters = {
      dateStart: '',
      dateEnd: '',
      type: 'all',
      sortOrder: 'newest',
      merchant: '',
      category: 'All'
    };
    setTempFilters(defaultFilters);
    setFilters(defaultFilters);
    setSearchQuery('');
    setSelectedCategoryTab('All');
    setCurrentPage(1);
  };

  // Filtered & Sorted Transactions
  const processedTransactions = useMemo(() => {
    let list = [...transactions];

    // Category filter from top horizontal tabs
    if (selectedCategoryTab !== 'All') {
      list = list.filter(tx => (tx.category || '').toLowerCase() === selectedCategoryTab.toLowerCase());
    }

    // Advanced Category filter (if not set to All)
    if (filters.category !== 'All') {
      list = list.filter(tx => (tx.category || '').toLowerCase() === filters.category.toLowerCase());
    }

    // Type filter
    if (filters.type === 'income') {
      list = list.filter(tx => tx.type === 'income');
    } else if (filters.type === 'expense') {
      list = list.filter(tx => tx.type === 'expense');
    }

    // Search filter (searches merchant, description, and notes)
    const activeSearch = (filters.merchant || searchQuery).toLowerCase().trim();
    if (activeSearch) {
      list = list.filter(tx => {
        const merchantMatch = (tx.merchant || '').toLowerCase().includes(activeSearch);
        const descMatch = (tx.description || '').toLowerCase().includes(activeSearch);
        const noteMatch = (tx.notes || tx.note || '').toLowerCase().includes(activeSearch);
        return merchantMatch || descMatch || noteMatch;
      });
    }

    // Date Range filter
    if (filters.dateStart) {
      list = list.filter(tx => tx.date >= filters.dateStart);
    }
    if (filters.dateEnd) {
      list = list.filter(tx => tx.date <= filters.dateEnd);
    }

    // Sorting
    list.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || '12:00 PM'}`);
      const dateB = new Date(`${b.date} ${b.time || '12:00 PM'}`);

      if (filters.sortOrder === 'newest') {
        return dateB - dateA;
      } else if (filters.sortOrder === 'oldest') {
        return dateA - dateB;
      } else if (filters.sortOrder === 'lowToHigh') {
        return a.amount - b.amount;
      } else if (filters.sortOrder === 'highToLow') {
        return b.amount - a.amount;
      }
      return 0;
    });

    return list;
  }, [transactions, selectedCategoryTab, filters, searchQuery]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(processedTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedTransactions.slice(startIndex, startIndex + pageSize);
  }, [processedTransactions, currentPage, pageSize]);

  const hasActiveFilters = Object.values(filters).some(v => v !== 'all' && v !== 'newest' && v !== 'All' && v !== '') || searchQuery.trim() !== '';

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">History</h2>
          <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-0.5">Transactions & Logs</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenExport && (
            <button
              onClick={onOpenExport}
              aria-label="Export transactions to CSV"
              className="w-10 h-10 rounded-xl flex items-center justify-center border border-brand-border bg-bg-card text-txt-secondary hover:text-txt-primary transition-all cursor-pointer shadow-brand-sm"
            >
              <Download size={17} />
            </button>
          )}
          <button 
            onClick={openFilterSheet}
            aria-label="Open filter sheet"
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer
              ${showFilterSheet || hasActiveFilters
                ? 'bg-brand-primary border-brand-primary text-white shadow-brand-sm' 
                : 'bg-bg-card border-brand-border text-txt-secondary hover:text-txt-primary'}`}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-6 group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-txt-secondary/60 group-focus-within:text-brand-primary transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text"
          placeholder="Search merchant, description, notes..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full bg-bg-card border border-brand-border rounded-xl py-4.5 pl-12 pr-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none focus:border-brand-primary/80 transition-all"
        />
      </div>

      {/* Horizontal Tabs for Categories */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 -mx-6 px-6 scrollbar-none">
        {categories.map((cat) => {
          const isActive = selectedCategoryTab === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategoryTab(cat);
                setCurrentPage(1);
              }}
              className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all relative cursor-pointer
                ${isActive 
                  ? 'text-white border-brand-primary bg-brand-primary shadow-brand-sm' 
                  : 'text-txt-secondary border-brand-border bg-bg-card hover:text-txt-primary'}`}
            >
              <span className="relative z-10">{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <span className="text-[9px] font-bold text-txt-secondary/60 uppercase tracking-wider">Active filters:</span>
          {filters.type !== 'all' && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase">
              {filters.type}
            </span>
          )}
          {filters.sortOrder !== 'newest' && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase">
              {filters.sortOrder === 'lowToHigh' ? 'L-H' : filters.sortOrder === 'highToLow' ? 'H-L' : 'Oldest'}
            </span>
          )}
          {filters.category !== 'All' && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase">
              {filters.category}
            </span>
          )}
          {(filters.dateStart || filters.dateEnd) && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase">
              Date Filtered
            </span>
          )}
          {(filters.merchant || searchQuery) && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase max-w-[120px] truncate">
              "{filters.merchant || searchQuery}"
            </span>
          )}
          <button 
            onClick={resetFilters}
            className="text-[10px] text-brand-error hover:opacity-80 font-bold uppercase tracking-wider ml-auto cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className="bg-bg-card border border-brand-border rounded-xl p-4 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-border/40" />
                  <div className="space-y-2">
                    <div className="w-28 h-3.5 bg-brand-border/40 rounded" />
                    <div className="w-40 h-2.5 bg-brand-border/30 rounded" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="w-16 h-3.5 bg-brand-border/40 rounded ml-auto" />
                  <div className="w-10 h-2 bg-brand-border/30 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-brand-error/20 rounded-2xl p-6">
            <div className="w-12 h-12 bg-brand-error/10 text-brand-error rounded-xl flex items-center justify-center mb-3">
              <AlertCircle size={22} />
            </div>
            <h4 className="text-sm font-bold text-txt-primary">Failed to load transactions</h4>
            <p className="text-xs text-txt-secondary mt-1 max-w-[240px] leading-relaxed mb-4">
              {error}
            </p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl hover:opacity-90 inline-flex items-center gap-2 cursor-pointer shadow-brand-sm"
              >
                <RefreshCw size={13} /> Retry
              </button>
            )}
          </div>
        ) : paginatedTransactions.length > 0 ? (
          <>
            {paginatedTransactions.map((tx) => {
              const Icon = categoryIcons[tx.category] || Grid;
              const isExpense = tx.type === 'expense';
              const isUnknown = tx.merchant === 'Unknown Merchant' || !tx.merchant;

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bg-card border border-brand-border rounded-xl p-4 flex items-center justify-between active:bg-bg-card/85 transition-colors group cursor-pointer"
                  onClick={() => onSelectTx(tx, false)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl bg-brand-primary/5 text-brand-primary flex items-center justify-center shrink-0 border border-brand-border`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-sm font-semibold truncate transition-colors ${isUnknown ? 'text-txt-secondary/60 italic' : 'text-txt-primary'}`}>
                          {isUnknown ? 'Unknown Merchant' : tx.merchant}
                        </h4>
                        {isDemoItem(tx) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-warning/15 text-brand-warning border border-brand-warning/25 uppercase shrink-0">
                            Demo
                          </span>
                        )}
                        {tx.source === 'csv_import' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase shrink-0">
                            CSV
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-txt-secondary font-medium tracking-wide mt-0.5 truncate">
                        {tx.date} • {tx.category} {tx.description ? `• ${tx.description}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isExpense ? 'text-txt-primary' : 'text-brand-success'}`}>
                        {isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                      </p>
                      <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider block mt-0.5">
                        {tx.paymentMethod}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTx(tx, true);
                      }}
                      aria-label="Edit transaction"
                      className="w-8 h-8 rounded-lg bg-brand-primary/5 border border-brand-border flex items-center justify-center text-txt-secondary hover:text-brand-primary active:scale-90 transition-all cursor-pointer"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-4 pb-2 border-t border-brand-border/60 flex items-center justify-between text-xs text-txt-secondary">
                <span className="text-[11px] font-medium">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, processedTransactions.length)} of {processedTransactions.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    aria-label="Previous page"
                    className="w-8 h-8 rounded-lg bg-bg-card border border-brand-border flex items-center justify-center text-txt-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 text-xs font-bold text-txt-primary">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    aria-label="Next page"
                    className="w-8 h-8 rounded-lg bg-bg-card border border-brand-border flex items-center justify-center text-txt-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl border border-brand-border flex items-center justify-center text-brand-primary mb-4 shadow-brand-sm">
              <Receipt size={26} />
            </div>
            <h4 className="text-sm font-bold text-txt-primary">No transactions found</h4>
            <p className="text-xs text-txt-secondary mt-1 max-w-[240px] leading-relaxed mb-5">
              You haven't recorded any expenses or income yet.
            </p>
            {onAdd && (
              <button 
                onClick={onAdd} 
                className="btn-primary py-2.5 px-5 text-xs w-auto inline-flex items-center gap-1.5 shadow-brand-sm"
              >
                <Plus size={14} /> Add First Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-bg-card rounded-xl border border-brand-border flex items-center justify-center text-txt-secondary/40 mb-3">
              <Search size={22} />
            </div>
            <h4 className="text-txt-primary font-bold text-xs">No transactions match</h4>
            <p className="text-txt-secondary text-xs mt-1 max-w-[220px] leading-relaxed mb-4">
              Try adjusting your search criteria or resetting applied filters.
            </p>
            <button 
              onClick={resetFilters} 
              className="px-3.5 py-1.5 bg-bg-card border border-brand-border text-brand-primary text-xs font-semibold rounded-lg hover:bg-bg-subtle cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Advanced Filters Drawer (Bottom Sheet) */}
      <AnimatePresence>
        {showFilterSheet && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowFilterSheet(false)} />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              role="dialog"
              aria-modal="true"
              aria-label="Filter Transactions"
              className="relative w-full max-w-md bg-bg-card border-t border-brand-border rounded-t-[24px] px-6 pt-6 pb-8 z-10 max-h-[85vh] overflow-y-auto shadow-brand-xl"
            >
              {/* Pull Bar */}
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-6" />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Filter Transactions</h3>
                <button 
                  onClick={() => setShowFilterSheet(false)}
                  aria-label="Close filters"
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Date Range Selection */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider mb-1 block">Start Date</span>
                    <input 
                      type="date" 
                      value={tempFilters.dateStart}
                      onChange={(e) => setTempFilters({ ...tempFilters, dateStart: e.target.value })}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-3 py-2 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider mb-1 block">End Date</span>
                    <input 
                      type="date" 
                      value={tempFilters.dateEnd}
                      onChange={(e) => setTempFilters({ ...tempFilters, dateEnd: e.target.value })}
                      className="w-full bg-bg-app border border-brand-border rounded-xl px-3 py-2 text-xs font-semibold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Type Selection */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['all', 'expense', 'income'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTempFilters({ ...tempFilters, type: t })}
                      className={`py-2 text-xs font-bold rounded-xl border capitalize transition-all cursor-pointer
                        ${tempFilters.type === t 
                          ? 'bg-brand-primary text-white border-brand-primary shadow-brand-sm' 
                          : 'bg-bg-app text-txt-secondary border-brand-border hover:text-txt-primary'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Sort By</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'newest', label: 'Newest First' },
                    { id: 'oldest', label: 'Oldest First' },
                    { id: 'highToLow', label: 'Highest Amount' },
                    { id: 'lowToHigh', label: 'Lowest Amount' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setTempFilters({ ...tempFilters, sortOrder: s.id })}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-left cursor-pointer
                        ${tempFilters.sortOrder === s.id 
                          ? 'bg-brand-primary text-white border-brand-primary shadow-brand-sm font-bold' 
                          : 'bg-bg-app text-txt-secondary border-brand-border hover:text-txt-primary'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 py-3 text-xs font-bold text-brand-error bg-brand-error/10 border border-brand-error/20 rounded-xl hover:bg-brand-error/20 transition-all cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={applyFilters}
                  className="flex-2 py-3 text-xs font-bold text-white bg-brand-primary rounded-xl shadow-brand-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;
