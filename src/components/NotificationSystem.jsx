import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Utensils, Car, Smartphone, 
  MoreHorizontal, Users, ShieldAlert, Zap,
  CheckCircle2, AlertTriangle, Bell
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const CategoryButton = ({ icon: Icon, label, onClick, color = "bg-bg-app" }) => (
  <motion.button
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    className={`${color} hover:opacity-90 border border-brand-border px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all group cursor-pointer`}
  >
    <Icon size={12} className="text-txt-secondary group-hover:text-brand-primary transition-colors" />
    <span className="text-[10px] font-bold text-txt-secondary group-hover:text-txt-primary uppercase tracking-wider">{label}</span>
  </motion.button>
);

const NotificationSystem = ({ show, onClose, message, onAction }) => {
  const { toast, hideToast } = useNotifications();

  return (
    <div className="fixed top-4 left-0 right-0 z-[150] px-4 pointer-events-none flex flex-col items-center gap-3">
      {/* 1. Global Toast Messages (Enabled / Disabled / Warnings / Confirmations) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id || 'toast'}
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto max-w-sm w-full bg-bg-card/95 backdrop-blur-md border border-brand-border rounded-2xl p-4 shadow-brand-lg flex items-center justify-between gap-3 text-txt-primary"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border
                ${toast.type === 'success' ? 'bg-brand-success/15 border-brand-success/30 text-brand-success' :
                  toast.type === 'warning' ? 'bg-brand-warning/15 border-brand-warning/30 text-brand-warning' :
                  'bg-brand-primary/15 border-brand-primary/30 text-brand-primary'}`}
              >
                {toast.type === 'success' ? <CheckCircle2 size={16} /> :
                 toast.type === 'warning' ? <AlertTriangle size={16} /> :
                 <Bell size={16} />}
              </div>
              <div>
                {toast.title && (
                  <h5 className="text-xs font-bold text-txt-primary leading-tight">{toast.title}</h5>
                )}
                <p className="text-xs font-semibold text-txt-primary/90 leading-tight">
                  {toast.message}
                </p>
              </div>
            </div>

            <button
              onClick={hideToast}
              className="w-7 h-7 rounded-lg bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer shrink-0"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Interactive Auto-Tracking & Spend Category Notification Banner */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="pointer-events-auto max-w-md w-full text-txt-primary"
          >
            <div className="bg-bg-card border border-brand-border rounded-[20px] p-5 shadow-brand-lg overflow-hidden relative group">
              {/* Top Accent Line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand-border rounded-full" />
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-txt-secondary uppercase tracking-wider">Finovo Smart Pay</h4>
                    <p className="text-[10px] text-txt-secondary/60 font-semibold">Just now</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Main Content */}
              <div className="mb-4">
                <h3 className="text-base font-bold text-txt-primary tracking-tight leading-snug">
                  {message || "₹850 spent at Swiggy"}
                </h3>
                <p className="text-[10px] text-txt-secondary/70 font-semibold uppercase tracking-wider mt-1">
                  {!message && "Categorize this expense to keep your budget accurate"}
                  {message && "Finovo Hub auto-tracker alert"}
                </p>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-3 gap-2">
                <CategoryButton icon={Utensils} label="Food" onClick={() => onAction && onAction('Food')} />
                <CategoryButton icon={Car} label="Travel" onClick={() => onAction && onAction('Travel')} />
                <CategoryButton icon={Smartphone} label="Bill" onClick={() => onAction && onAction('Recharge')} />
                <CategoryButton icon={Users} label="Group" onClick={() => onAction && onAction('Group')} />
                <CategoryButton icon={MoreHorizontal} label="More" onClick={() => onAction && onAction('More')} />
                <CategoryButton 
                  icon={ShieldAlert} 
                  label="Ignore" 
                  onClick={onClose}
                  color="bg-brand-error/10 border-brand-error/20 !text-brand-error" 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;
