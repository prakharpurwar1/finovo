import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, X, Search, Edit2, 
  Utensils, Car, ShoppingBag, Smartphone, HeartPulse,
  GraduationCap, Film, Grid, ShieldAlert
} from 'lucide-react';

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
  'Education',
  'Entertainment',
  'Others'
];

const History = ({ transactions, onSelectTx }) => {
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  };

  // Filtered & Sorted Transactions
  const processedTransactions = useMemo(() => {
    let list = [...transactions];

    // Category filter from the top horizontal tabs
    if (selectedCategoryTab !== 'All') {
      list = list.filter(tx => tx.category.toLowerCase() === selectedCategoryTab.toLowerCase());
    }

    // Advanced Category filter (if not set to All)
    if (filters.category !== 'All') {
      list = list.filter(tx => tx.category.toLowerCase() === filters.category.toLowerCase());
    }

    // Type filter
    if (filters.type === 'income') {
      list = list.filter(tx => tx.type === 'income');
    } else if (filters.type === 'expense') {
      list = list.filter(tx => tx.type === 'expense');
    }

    // Merchant filter (search bar or filter input)
    const activeMerchantFilter = filters.merchant || searchQuery;
    if (activeMerchantFilter.trim()) {
      list = list.filter(tx => 
        tx.merchant.toLowerCase().includes(activeMerchantFilter.toLowerCase())
      );
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

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-txt-primary">History</h2>
          <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-0.5">Transactions & Logs</p>
        </div>
        <button 
          onClick={openFilterSheet}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer
            ${showFilterSheet || Object.values(filters).some(v => v !== 'all' && v !== 'newest' && v !== 'All' && v !== '')
              ? 'bg-brand-primary border-brand-primary text-white shadow-brand-sm' 
              : 'bg-bg-card border-brand-border text-txt-secondary hover:text-txt-primary'}`}
        >
          <Filter size={18} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-6 group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-txt-secondary/60 group-focus-within:text-brand-primary transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text"
          placeholder="Search by merchant..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
              onClick={() => setSelectedCategoryTab(cat)}
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
      {Object.values(filters).some(v => v !== 'all' && v !== 'newest' && v !== 'All' && v !== '') && (
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
          {filters.merchant && (
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase max-w-[100px] truncate">
              "{filters.merchant}"
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
        {processedTransactions.length > 0 ? (
          processedTransactions.map((tx) => {
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
                    <h4 className={`text-sm font-semibold truncate transition-colors ${isUnknown ? 'text-txt-secondary/60 italic' : 'text-txt-primary'}`}>
                      {isUnknown ? 'Unknown Merchant' : tx.merchant}
                    </h4>
                    <p className="text-[11px] text-txt-secondary/75 font-medium mt-0.5 truncate">
                      {tx.category} • {tx.date} • {tx.time || '12:00 PM'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <p className={`text-sm font-bold ${isExpense ? 'text-txt-primary' : 'text-brand-success'}`}>
                      {isExpense ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider block mt-0.5">
                      {tx.paymentMethod}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTx(tx, true); // Opens details sheet directly with edit mode active
                    }}
                    className="w-8 h-8 rounded-lg bg-brand-primary/5 border border-brand-border flex items-center justify-center text-txt-secondary hover:text-brand-primary active:scale-90 transition-all cursor-pointer"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 bg-bg-card rounded-xl border border-brand-border flex items-center justify-center text-txt-secondary/40 mb-4">
              <Search size={22} />
            </div>
            <h4 className="text-txt-secondary/60 font-bold uppercase tracking-wider text-xs">No transactions match</h4>
            <p className="text-txt-secondary/40 text-[11px] mt-1 max-w-[200px] leading-relaxed">
              Try adjusting your search criteria or applying different filters.
            </p>
          </div>
        )}
      </div>

      {/* Advanced Filters Drawer (Bottom Sheet) */}
      <AnimatePresence>
        {showFilterSheet && (
          <div className="fixed inset-0 z-[120] bg-brand-secondary/30 backdrop-blur-sm flex items-end justify-center">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setShowFilterSheet(false)} />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-bg-card border-t border-brand-border rounded-t-[24px] px-6 pt-6 pb-8 z-10 max-h-[85vh] overflow-y-auto"
            >
              {/* Pull Bar */}
              <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-6" />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Filter Transactions</h3>
                <button 
                  onClick={() => setShowFilterSheet(false)}
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
                      className="w-full bg-bg-app border border-brand-border rounded-xl py-3 px-4 text-xs font-bold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-txt-secondary/60 uppercase tracking-wider mb-1 block">End Date</span>
                    <input 
                      type="date"
                      value={tempFilters.dateEnd}
                      onChange={(e) => setTempFilters({ ...tempFilters, dateEnd: e.target.value })}
                      className="w-full bg-bg-app border border-brand-border rounded-xl py-3 px-4 text-xs font-bold text-txt-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Type Filter */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Transaction Type</label>
                <div className="flex bg-bg-app border border-brand-border p-1 rounded-xl">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'income', label: 'Income' },
                    { id: 'expense', label: 'Expense' }
                  ].map((t) => {
                    const isSelected = tempFilters.type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTempFilters({ ...tempFilters, type: t.id })}
                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                          ${isSelected ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
                      >
                        {isSelected && (
                          <motion.div layoutId="activeTempTypeTab" className="absolute inset-0 bg-bg-card border border-brand-border rounded-lg shadow-brand-sm" />
                        )}
                        <span className="relative z-10">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort Order */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Sort By</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'newest', label: 'Date: Newest' },
                    { id: 'oldest', label: 'Date: Oldest' },
                    { id: 'lowToHigh', label: 'Amount: Low to High' },
                    { id: 'highToLow', label: 'Amount: High to Low' }
                  ].map((s) => {
                    const isSelected = tempFilters.sortOrder === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setTempFilters({ ...tempFilters, sortOrder: s.id })}
                        className={`py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider border text-center transition-all cursor-pointer
                          ${isSelected 
                            ? 'text-white border-brand-primary bg-brand-primary' 
                            : 'text-txt-secondary border-brand-border bg-bg-app hover:text-txt-primary'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Merchant Search Filter */}
              <div className="mb-5">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Merchant Name</label>
                <input 
                  type="text"
                  placeholder="Filter by merchant name..."
                  value={tempFilters.merchant}
                  onChange={(e) => setTempFilters({ ...tempFilters, merchant: e.target.value })}
                  className="w-full bg-bg-app border border-brand-border rounded-xl py-3 px-4 text-xs font-bold text-txt-primary outline-none focus:border-brand-primary"
                />
              </div>

              {/* Category Dropdown Selection */}
              <div className="mb-6">
                <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block">Category</label>
                <select
                  value={tempFilters.category}
                  onChange={(e) => setTempFilters({ ...tempFilters, category: e.target.value })}
                  className="w-full bg-bg-app border border-brand-border rounded-xl py-3 px-4 text-xs font-bold text-txt-primary outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Recharge">Recharge</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Education">Education</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Others">Others</option>
                  <option value="Uncategorized">Uncategorized</option>
                </select>
              </div>

              {/* Drawer Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="flex-1 py-3.5 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer"
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
