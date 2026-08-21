import React from 'react';
import { motion } from 'framer-motion';
import { Home, Clock, Users, User, Plus } from 'lucide-react';

const Layout = ({ children, activeTab, onTabChange, onAdd }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'history', icon: Clock, label: 'History' },
    { id: 'splits', icon: Users, label: 'Splits' },
    { id: 'profile', icon: User, label: 'Profile' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full w-full relative bg-bg-app">
      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
        {children}
      </main>

      {/* Floating Add Button */}
      <div className="absolute bottom-28 right-6 z-20">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAdd}
          className="w-14 h-14 bg-brand-primary rounded-full shadow-brand-lg flex items-center justify-center text-white hover:opacity-90 transition-all duration-200 cursor-pointer"
        >
          <Plus size={28} />
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-8 pt-4 bg-gradient-to-t from-bg-app via-bg-app/90 to-transparent">
        <div className="bg-bg-card border border-brand-border rounded-[24px] px-2 py-2 flex items-center justify-between shadow-brand-md">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center py-2 px-6 flex-1 cursor-pointer"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-brand-primary/5 rounded-[16px]"
                    transition={{ type: "spring", duration: 0.5 }}
                  />
                )}
                <tab.icon 
                  size={20} 
                  className={`transition-colors duration-200 ${isActive ? 'text-brand-primary' : 'text-txt-secondary'}`} 
                />
                <span className={`text-[10px] mt-1 font-semibold tracking-wide transition-colors duration-200 ${isActive ? 'text-brand-primary' : 'text-txt-secondary'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
