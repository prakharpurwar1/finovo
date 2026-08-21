import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Utensils, Car, Smartphone, ShoppingBag,
  Film, GraduationCap, HeartPulse, Grid, X,
  ArrowRight, Check
} from 'lucide-react';

const categories = [
  { id: 'food', name: 'Food', icon: Utensils },
  { id: 'travel', name: 'Travel', icon: Car },
  { id: 'recharge', name: 'Recharge', icon: Smartphone },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag },
  { id: 'entertainment', name: 'Entertainment', icon: Film },
  { id: 'education', name: 'Education', icon: GraduationCap },
  { id: 'medicine', name: 'Medicine', icon: HeartPulse },
  { id: 'others', name: 'Others', icon: Grid },
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

const CategorySelect = ({ onBack, tx, onConfirmCategory }) => {
  const [selectedId, setSelectedId] = useState(() => {
    if (!tx || tx.category === 'Uncategorized') return 'food';
    const match = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
    return match ? match.id : 'others';
  });
  const [search, setSearch] = useState('');

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = () => {
    if (!tx) return;
    const matchedCategory = categories.find(c => c.id === selectedId);
    if (matchedCategory) {
      onConfirmCategory(tx.id, matchedCategory.name);
    }
  };

  const merchant = tx ? tx.merchant : 'Unknown';
  const amount = tx ? tx.amount : '0';

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

      <div className="flex-1 overflow-y-auto px-6 pb-32 relative">
        {/* Transaction Hero */}
        <div className="py-10 text-center">
          <motion.h1
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold text-txt-primary tracking-tight mb-2"
          >
            ₹{amount.toLocaleString('en-IN')}
          </motion.h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-primary/5 border border-brand-primary/10 rounded-full">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Select Category Below</span>
          </div>
        </div>

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
        <div className="grid grid-cols-2 gap-3">
          {filteredCategories.map((cat) => (
            <CategoryChip
              key={cat.id}
              category={cat}
              isSelected={selectedId === cat.id}
              onClick={() => setSelectedId(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer Action */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent pt-8 z-10">
        <button
          onClick={handleConfirm}
          className="btn-primary rounded-xl"
        >
          Confirm Category
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default CategorySelect;
