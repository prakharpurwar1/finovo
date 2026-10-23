import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Download, Calendar, Filter, FileSpreadsheet 
} from 'lucide-react';
import { generateTransactionsCsv, downloadCsvFile } from '../services/csvService.js';
import { getCurrentMonthBoundaries, getTodayDateString } from '../utils/date.js';

const allCategories = [
  'All',
  'Food',
  'Groceries',
  'Travel',
  'Shopping',
  'Recharge',
  'Subscriptions',
  'Medicine',
  'Education',
  'Entertainment',
  'Rent',
  'Salary',
  'Freelance',
  'Investments',
  'Refunds',
  'Others',
  'Uncategorized'
];

export const CsvExportModal = ({
  isOpen,
  onClose,
  transactions = []
}) => {
  const [dateRangeMode, setDateRangeMode] = useState('all'); // 'all', 'this_month', 'last_month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('all'); // 'all', 'expense', 'income'

  // Compute active date boundaries unconditionally
  const activeBoundaries = useMemo(() => {
    if (dateRangeMode === 'this_month') {
      return getCurrentMonthBoundaries();
    }
    if (dateRangeMode === 'last_month') {
      const now = new Date();
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        startDate: toISO(firstDayPrevMonth),
        endDate: toISO(lastDayPrevMonth)
      };
    }
    if (dateRangeMode === 'custom') {
      return {
        startDate: customStartDate || null,
        endDate: customEndDate || null
      };
    }
    return { startDate: null, endDate: null };
  }, [dateRangeMode, customStartDate, customEndDate]);

  // Compute matching transactions count unconditionally
  const matchingTransactions = useMemo(() => {
    let list = transactions.filter(t => !t.isDemo);

    if (selectedType !== 'all') {
      list = list.filter(t => t.type === selectedType);
    }
    if (selectedCategory !== 'All') {
      list = list.filter(t => (t.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }
    if (activeBoundaries.startDate) {
      list = list.filter(t => t.date >= activeBoundaries.startDate);
    }
    if (activeBoundaries.endDate) {
      list = list.filter(t => t.date <= activeBoundaries.endDate);
    }
    return list;
  }, [transactions, selectedType, selectedCategory, activeBoundaries]);

  const handleExport = () => {
    if (matchingTransactions.length === 0) return;

    const csvData = generateTransactionsCsv(transactions, {
      startDate: activeBoundaries.startDate,
      endDate: activeBoundaries.endDate,
      category: selectedCategory,
      type: selectedType
    });

    const filename = `finovo-transactions-${getTodayDateString()}.csv`;
    downloadCsvFile(csvData, filename);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-export-title"
        className="w-full max-w-md bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-bg-app/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center border border-brand-primary/20 shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 id="csv-export-title" className="text-base font-bold text-txt-primary">Export to CSV</h3>
              <p className="text-[11px] text-txt-secondary font-medium">Download spreadsheet-ready ledger</p>
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

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Date Range Selector */}
          <div>
            <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={13} className="text-brand-primary" /> Date Period
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'all', label: 'All Transactions' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom Range' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDateRangeMode(opt.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    dateRangeMode === opt.id 
                      ? 'bg-brand-primary text-white border-brand-primary shadow-brand-sm' 
                      : 'bg-bg-app border-brand-border text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {dateRangeMode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-brand-border/60">
                <div>
                  <span className="text-[10px] text-txt-secondary font-bold uppercase">From</span>
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-lg p-2 text-xs font-semibold text-txt-primary outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-txt-secondary font-bold uppercase">To</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-bg-app border border-brand-border rounded-lg p-2 text-xs font-semibold text-txt-primary outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={13} className="text-brand-primary" /> Category Filter
            </label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-bg-app border border-brand-border rounded-xl p-3 text-xs font-semibold text-txt-primary outline-none"
            >
              {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-bold text-txt-primary uppercase tracking-wider mb-1.5">
              Transaction Flow
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'expense', label: 'Expenses' },
                { id: 'income', label: 'Income' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedType === t.id 
                      ? 'bg-brand-primary text-white border-brand-primary shadow-brand-sm' 
                      : 'bg-bg-app border-brand-border text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formula Injection & Privacy Notice */}
          <div className="p-3 bg-bg-app border border-brand-border rounded-xl text-[11px] text-txt-secondary leading-relaxed">
            <span className="font-semibold text-txt-primary">🛡️ Spreadsheet Security:</span> Cells beginning with formula characters (=, +, -, @) are automatically sanitized to prevent CSV formula injection.
          </div>

          {/* Preview Record Count */}
          <div className="flex items-center justify-between p-3.5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
            <span className="text-xs font-medium text-txt-primary">Matching Transactions:</span>
            <span className="text-sm font-bold text-brand-primary">
              {matchingTransactions.length} Record{matchingTransactions.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-brand-border flex items-center justify-between bg-bg-app/40">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-brand-border text-txt-secondary hover:text-txt-primary text-xs font-semibold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            disabled={matchingTransactions.length === 0}
            onClick={handleExport}
            className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-brand-sm hover:opacity-95 disabled:opacity-40"
          >
            <Download size={14} /> Download CSV
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CsvExportModal;
