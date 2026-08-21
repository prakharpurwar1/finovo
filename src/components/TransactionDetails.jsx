import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Trash2, Edit2, Tag, AlertCircle, CreditCard,
  Utensils, Car, ShoppingBag, Smartphone, HeartPulse,
  Film, GraduationCap, Grid, ShieldAlert
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

const TransactionDetails = ({ tx, onBack, onDelete, onUpdate, onMoveCategory, startInEditMode = false }) => {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [merchantName, setMerchantName] = useState(tx.merchant);
  const [amount, setAmount] = useState(tx.amount);
  const [notes, setNotes] = useState(tx.notes || '');
  const [date, setDate] = useState(tx.date);
  const [time, setTime] = useState(tx.time || '12:00 PM');
  const [paymentMethod, setPaymentMethod] = useState(tx.paymentMethod || 'UPI');
  const [status, setStatus] = useState(tx.status || 'Completed');

  const isUnknownMerchant = tx.merchant === 'Unknown Merchant' || !tx.merchant;
  const Icon = categoryIcons[tx.category] || Grid;

  const handleSave = () => {
    onUpdate({
      ...tx,
      merchant: merchantName || 'Unknown Merchant',
      amount: Number(amount),
      notes,
      date,
      time,
      paymentMethod,
      status
    });
    setIsEditing(false);
  };

  const handleAddMerchantManually = (name) => {
    onUpdate({
      ...tx,
      merchant: name
    });
    setMerchantName(name);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-brand-secondary/30 backdrop-blur-sm flex items-end justify-center">
      {/* Background Tap to Dismiss */}
      <div className="absolute inset-0 cursor-pointer" onClick={onBack} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative w-full max-w-md bg-bg-card border-t border-brand-border rounded-t-[24px] px-6 pt-6 pb-8 z-10 max-h-[90vh] overflow-y-auto text-txt-primary"
      >
        {/* Pull bar */}
        <div className="w-12 h-1 bg-brand-border rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold text-txt-secondary uppercase tracking-wider">Transaction Details</h2>
          <button 
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Main Amount Card */}
        <div className="flex flex-col items-center justify-center text-center mb-6 bg-bg-app border border-brand-border rounded-[16px] p-5">
          <div className={`w-12 h-12 rounded-xl bg-brand-primary/5 text-brand-primary border border-brand-border flex items-center justify-center mb-3`}>
            <Icon size={22} />
          </div>

          {isEditing ? (
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-2xl font-bold text-brand-primary">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent text-3xl font-bold text-txt-primary tracking-tight w-36 text-center placeholder:text-txt-secondary/20 outline-none border-b border-brand-primary"
              />
            </div>
          ) : (
            <h1 className="text-3xl font-bold text-txt-primary tracking-tight mb-1">
              {tx.type === 'expense' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
            </h1>
          )}
          <span className="text-[10px] text-brand-primary font-bold uppercase tracking-wider bg-brand-primary/5 px-3 py-0.5 rounded-full border border-brand-primary/10">
            {tx.category}
          </span>
        </div>

        {/* Unknown Merchant Warning */}
        {isUnknownMerchant && !isEditing && (
          <div className="mb-6 p-4 bg-brand-warning/5 border border-brand-warning/15 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-brand-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-brand-warning">Merchant not detected</p>
              <p className="text-[10px] text-txt-secondary mt-1">Please enter the merchant name manually to update this transaction.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Merchant Name"
                  id="manual-merchant-input"
                  className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      handleAddMerchantManually(e.target.value.trim());
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('manual-merchant-input');
                    if (el && el.value.trim()) {
                      handleAddMerchantManually(el.value.trim());
                    }
                  }}
                  className="px-3 bg-brand-warning text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:opacity-90 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div className="space-y-4 mb-6 bg-bg-app border border-brand-border rounded-[16px] p-4">
          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Merchant</span>
            {isEditing ? (
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary text-right w-44"
              />
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.merchant}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Date & Time</span>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[11px] text-txt-primary outline-none text-right"
                />
                <input
                  type="text"
                  value={time}
                  placeholder="12:00 PM"
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-[11px] text-txt-primary outline-none text-right w-20"
                />
              </div>
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.date} • {tx.time || '12:00 PM'}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Payment Method</span>
            {isEditing ? (
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-txt-primary outline-none"
              >
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Net Banking">Net Banking</option>
              </select>
            ) : (
              <span className="text-xs font-bold text-txt-primary">{tx.paymentMethod}</span>
            )}
          </div>

          <div className="flex justify-between items-center py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider">Status</span>
            {isEditing ? (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-bg-card border border-brand-border rounded-lg px-2 py-1 text-xs text-txt-primary outline-none"
              >
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            ) : (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${tx.status === 'Completed' ? 'bg-brand-success/10 text-brand-success' : tx.status === 'Pending' ? 'bg-brand-warning/10 text-brand-warning' : 'bg-brand-error/10 text-brand-error'}`}>
                {tx.status || 'Completed'}
              </span>
            )}
          </div>

          <div className="flex justify-between items-start py-0.5 border-b border-brand-border last:border-0">
            <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mt-1">Notes</span>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                rows={2}
                className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs text-txt-primary outline-none focus:border-brand-primary text-right w-44 resize-none"
              />
            ) : (
              <span className="text-xs font-medium text-txt-secondary max-w-[200px] text-right">
                {tx.notes || <span className="italic text-txt-secondary/40">No notes added</span>}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3.5 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={12} />
                  Edit Detail
                </button>
                <button
                  onClick={onMoveCategory}
                  className="flex-1 py-3.5 bg-bg-app border border-brand-border rounded-xl text-xs font-bold uppercase tracking-wider text-txt-secondary hover:text-txt-primary flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Tag size={12} />
                  Move Category
                </button>
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this transaction?')) {
                    onDelete(tx.id);
                  }
                }}
                className="w-full py-3.5 bg-brand-error/10 border border-brand-error/20 text-brand-error rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-error/15 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={12} />
                Delete Transaction
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionDetails;
