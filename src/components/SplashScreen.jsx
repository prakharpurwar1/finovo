import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet } from 'lucide-react';

const SplashScreen = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 600);
    const timer2 = setTimeout(() => setStep(2), 1600);
    const timer3 = setTimeout(() => onComplete(), 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-app overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="w-20 h-20 mb-6 flex items-center justify-center bg-brand-primary rounded-[20px] shadow-brand-md relative overflow-hidden"
        >
          <Wallet size={36} className="text-white" />
          <motion.div
            animate={{
              x: [-100, 150],
              transition: { duration: 1.8, repeat: Infinity, ease: "linear" }
            }}
            className="absolute inset-0 bg-white/10 -skew-x-12 w-1/3 h-full pointer-events-none"
          />
        </motion.div>

        {/* Text Animation */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <h1 className="text-3xl font-bold tracking-tight text-txt-primary mb-2">
                Finovo
              </h1>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {step >= 2 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="text-txt-secondary font-medium tracking-[0.2em] text-[11px] uppercase text-center"
            >
              Track smarter. Spend better.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Loading Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-20 flex flex-col items-center gap-3"
      >
        <div className="w-32 h-[2px] bg-brand-border rounded-full overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="w-full h-full bg-brand-primary"
          />
        </div>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
