import React from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, Shield, Smartphone, Moon, 
  Download, LogOut, ChevronRight, Settings, 
  Wallet, Heart, Star 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

const SettingItem = ({ icon: Icon, label, sublabel, color, onClick, rightElement }) => (
  <motion.button
    whileHover={{ x: 2 }}
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-bg-card border border-brand-border rounded-xl mb-3 hover:opacity-95 transition-all group cursor-pointer"
  >
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center border border-brand-border shrink-0`}>
        <Icon size={16} className="text-txt-primary" />
      </div>
      <div className="text-left">
        <h4 className="text-sm font-semibold text-txt-primary">{label}</h4>
        <p className="text-[10px] text-txt-secondary font-medium uppercase tracking-wider mt-0.5">{sublabel}</p>
      </div>
    </div>
    {rightElement ? rightElement : <ChevronRight size={16} className="text-txt-secondary group-hover:text-txt-primary transition-all" />}
  </motion.button>
);

const Profile = ({ onLogout, userProfile }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { notificationsEnabled, toggleNotifications } = useNotifications();

  const userName = userProfile?.name || 'Alex Fischer';
  const monthlyLimit = userProfile?.budgetLimit ? userProfile.budgetLimit.toLocaleString('en-IN') : '45,000';

  return (
    <div className="p-6 pt-12 bg-bg-app min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-txt-primary">Profile</h2>
        <button className="w-10 h-10 rounded-xl bg-bg-card border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary transition-all cursor-pointer">
          <Settings size={18} />
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-bg-card border border-brand-border rounded-[20px] p-6 mb-8 shadow-brand-sm">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-bg-subtle border border-brand-border p-1 mb-4 relative">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-success rounded-full flex items-center justify-center border-2 border-bg-card text-white shadow-brand-sm">
              <Star size={10} fill="currentColor" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-txt-primary mb-0.5">{userName}</h3>
          <p className="text-txt-secondary text-[10px] font-bold uppercase tracking-wider mb-6">Premium Member • since 2024</p>
          
          <div className="flex gap-3 w-full">
            <div className="flex-1 bg-bg-app rounded-xl p-3 border border-brand-border">
              <span className="text-txt-secondary text-[9px] font-bold uppercase tracking-wider mb-1 block">Trust Score</span>
              <p className="text-base font-bold text-brand-success">98.5</p>
            </div>
            <div className="flex-1 bg-bg-app rounded-xl p-3 border border-brand-border">
              <span className="text-txt-secondary text-[9px] font-bold uppercase tracking-wider mb-1 block">Badges</span>
              <p className="text-base font-bold text-txt-primary">12</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Account Management</h3>
        <SettingItem 
          icon={Wallet} 
          label="Budget Settings" 
          sublabel={`Monthly Limit: ₹${monthlyLimit}`} 
          color="bg-brand-primary/10 text-brand-primary" 
        />
        <SettingItem 
          icon={Bell} 
          label="Notifications" 
          sublabel={notificationsEnabled ? "Smart Alerts Enabled" : "Alerts Muted"} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={toggleNotifications}
          rightElement={
            <div
              onClick={(e) => { e.stopPropagation(); toggleNotifications(); }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 relative shrink-0 focus:outline-none cursor-pointer flex items-center
                ${notificationsEnabled ? 'bg-brand-success' : 'bg-brand-border'}`}
            >
              <motion.div
                layout
                className="w-4.5 h-4.5 bg-white rounded-full shadow-brand-sm"
                animate={{ x: notificationsEnabled ? 22 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          }
        />
        <SettingItem 
          icon={Smartphone} 
          label="SMS Permissions" 
          sublabel="Syncing: Real-time" 
          color="bg-brand-primary/10 text-brand-primary" 
        />
      </div>

      {/* Preferences Settings */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Preferences</h3>
        <SettingItem 
          icon={Moon} 
          label="Dark Mode" 
          sublabel={darkMode ? "Enabled" : "Disabled"} 
          color="bg-brand-primary/10 text-brand-primary" 
          onClick={toggleDarkMode}
          rightElement={
            <div
              onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 relative shrink-0 focus:outline-none cursor-pointer flex items-center
                ${darkMode ? 'bg-brand-primary' : 'bg-brand-border'}`}
            >
              <motion.div
                layout
                className="w-4.5 h-4.5 bg-white rounded-full shadow-brand-sm"
                animate={{ x: darkMode ? 22 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          }
        />
        <SettingItem 
          icon={Shield} 
          label="Privacy & Security" 
          sublabel="Biometrics Enabled" 
          color="bg-brand-primary/10 text-brand-primary" 
        />
        <SettingItem 
          icon={Download} 
          label="Export Data" 
          sublabel="CSV, JSON, PDF" 
          color="bg-brand-primary/10 text-brand-primary" 
        />
      </div>

      {/* Support Settings */}
      <div className="mb-8">
        <h3 className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider mb-3 px-1">Support</h3>
        <SettingItem 
          icon={Heart} 
          label="Share Finovo" 
          sublabel="Get 1 Month Premium" 
          color="bg-brand-primary/10 text-brand-primary" 
        />
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full bg-brand-error/10 border border-brand-error/20 p-4 rounded-xl flex items-center justify-center gap-2 text-brand-error font-semibold text-sm hover:bg-brand-error/20 transition-all mb-12 cursor-pointer"
      >
        <LogOut size={16} />
        Logout Session
      </button>

      {/* Version Tag */}
      <p className="text-center text-[10px] text-txt-secondary font-bold uppercase tracking-widest pb-12">
        Finovo v4.2.0 • Build 845
      </p>
    </div>
  );
};

export default Profile;
