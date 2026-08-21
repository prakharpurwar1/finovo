import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, Tag, FileText, ArrowRight, ChevronDown, Clock, 
  Users, Info 
} from 'lucide-react';

const categories = [
  { id: 'food', name: 'Food', emoji: '🍔' },
  { id: 'travel', name: 'Travel', emoji: '🚕' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️' },
  { id: 'recharge', name: 'Recharge', emoji: '📱' },
  { id: 'medicine', name: 'Medicine', emoji: '💊' },
  { id: 'education', name: 'Education', emoji: '📚' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬' },
  { id: 'others', name: 'Others', emoji: '➕' }
];

const AddExpense = ({ onBack, onAddTransaction }) => {
  // Form States
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const [note, setNote] = useState('');

  // Group Expense toggle & states
  const [isGroupExpense, setIsGroupExpense] = useState(false);
  const [numPeople, setNumPeople] = useState(2);
  const [splitType, setSplitType] = useState('equal'); // 'equal', 'custom'

  const handleAddExpenseSubmit = () => {
    if (!amount || Number(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const matchedCat = categories.find(c => c.id === selectedCategory);
    let categoryName = matchedCat ? matchedCat.name : 'Others';
    
    if (isGroupExpense) {
      categoryName = 'Group Expense';
    }

    const finalNotes = isGroupExpense 
      ? `${note ? note + ' • ' : ''}Split between ${numPeople} people (${splitType === 'equal' ? 'Equally' : 'Custom'})`
      : note;

    onAddTransaction({
      merchant: merchant.trim() || 'Unknown Merchant',
      amount: Number(amount),
      category: categoryName,
      date,
      time,
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: finalNotes,
      // Metadata for split transaction
      isSplit: isGroupExpense,
      splitPeopleCount: isGroupExpense ? numPeople : 1,
      splitType: isGroupExpense ? splitType : null
    });
    onBack();
  };

  const handleCategoryCardClick = (catId) => {
    setSelectedCategory(catId);
  };

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
          className="w-10 h-10 rounded-xl bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
        <h2 className="text-xs font-bold uppercase tracking-wider text-txt-primary/80">Add Expense</h2>
        <button 
          onClick={handleAddExpenseSubmit}
          className="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          Save
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 space-y-6 relative z-0">
        
        {/* Large Amount Input */}
        <div className="text-center bg-bg-card border border-brand-border rounded-[20px] p-6 shadow-brand-sm">
          <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-2 block">Enter Expense Amount</span>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-brand-primary">₹</span>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="bg-transparent text-4xl font-bold text-txt-primary tracking-tight w-48 text-center placeholder:text-txt-secondary/20 outline-none"
              style={{ caretColor: 'var(--color-primary)' }}
            />
          </div>
        </div>

        {/* Category Select Dropdown */}
        <div className="group">
          <label className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider mb-2 block px-1">
            Category Selector
          </label>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary appearance-none"
            >
              {categories.map((c) => (
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
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryCardClick(cat.id)}
                  className={`aspect-square rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer
                    ${isSelected 
                      ? 'bg-brand-primary/5 border-brand-primary text-brand-primary' 
                      : 'bg-bg-card border-brand-border text-txt-secondary hover:text-txt-primary'}`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Merchant Name */}
        <div className="group">
          <div className="flex items-center gap-1.5 mb-2 px-1 text-txt-secondary">
            <Tag size={13} />
            <label className="text-[10px] font-bold uppercase tracking-wider">
              Merchant Name
            </label>
          </div>
          <input 
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Enter merchant name"
            className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none focus:border-brand-primary"
          />
          {/* Quick Examples Chips */}
          <div className="flex gap-2 mt-2 px-1">
            {['Swiggy', 'Uber', 'Amazon'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMerchant(m)}
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
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary outline-none focus:border-brand-primary"
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
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add notes..."
            className="w-full bg-bg-card border border-brand-border rounded-xl py-3.5 px-4 text-sm font-semibold text-txt-primary placeholder:text-txt-secondary/40 outline-none focus:border-brand-primary"
          />
        </div>

        {/* Group Expense Toggle */}
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
                {/* Number of People */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Number of People</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNumPeople(prev => Math.max(2, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-bg-app hover:bg-bg-card text-txt-primary border border-brand-border flex items-center justify-center font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{numPeople}</span>
                    <button
                      type="button"
                      onClick={() => setNumPeople(prev => prev + 1)}
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
                      onClick={() => setSplitType('custom')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all relative cursor-pointer
                        ${splitType === 'custom' ? 'text-txt-primary' : 'text-txt-secondary/60 hover:text-txt-secondary'}`}
                    >
                      {splitType === 'custom' && (
                        <motion.div layoutId="activeSplitType" className="absolute inset-0 bg-bg-card border border-brand-border rounded-lg shadow-brand-sm" />
                      )}
                      <span className="relative z-10">Custom Split</span>
                    </button>
                  </div>
                </div>

                {/* Split breakdown info */}
                {amount && Number(amount) > 0 && splitType === 'equal' && (
                  <div className="p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-xl flex items-center gap-3">
                    <Info size={14} className="text-brand-primary shrink-0" />
                    <span className="text-[11px] font-bold text-brand-primary">
                      Each person pays: ₹{(Number(amount) / numPeople).toFixed(2)}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Fixed Footer Bottom Action Button */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent pt-8">
        <button
          onClick={handleAddExpenseSubmit}
          className="btn-primary rounded-xl"
        >
          Add Expense
          <ArrowRight size={18} />
        </button>
      </div>
    </motion.div>
  );
};

export default AddExpense;
