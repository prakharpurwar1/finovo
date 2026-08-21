import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { CheckCircle2, ChevronRight, Smartphone, Check, Wallet } from 'lucide-react';

const ProgressBar = ({ current, total }) => (
  <div className="flex gap-2 mb-12 px-2">
    {[...Array(total)].map((_, i) => (
      <div
        key={i}
        className="h-1.5 flex-1 rounded-full overflow-hidden bg-brand-border/40"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: i <= current ? '100%' : '0%' }}
          transition={{ duration: 0.4, ease: "circOut" }}
          className="h-full bg-brand-primary"
        />
      </div>
    ))}
  </div>
);

const AnimatedNumber = ({ value }) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { stiffness: 95, damping: 20, mass: 0.8 });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `₹${Math.round(latest).toLocaleString('en-IN')}`;
      }
    });
  }, [springValue]);

  return <span ref={ref}>₹{value.toLocaleString('en-IN')}</span>;
};

const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(15000);
  const [smsTracking, setSmsTracking] = useState(true);
  const [catPreference, setCatPreference] = useState('instant');

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete({ budget });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, x: 15 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -15, transition: { duration: 0.25 } }
  };

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  const percentage = (budget - 500) / 99500;
  const dailyAverage = Math.round(budget / 30);
  
  const getBudgetInfo = (val) => {
    if (val <= 10000) return { label: 'Conservative', desc: 'Minimal spending limit. Great for tight controls.' };
    if (val <= 30000) return { label: 'Balanced', desc: 'Ideal for standard food, transit, & subscription costs.' };
    if (val <= 60000) return { label: 'Comfortable', desc: 'Allows room for leisure, dining out, & shopping.' };
    return { label: 'High Limit', desc: 'Flexible buffer for high tracking & premium expenses.' };
  };

  const budgetInfo = getBudgetInfo(budget);
  const chips = [5000, 10000, 15000, 20000];

  return (
    <div className="w-full h-full flex flex-col p-8 pt-12 bg-bg-app text-txt-primary min-h-screen">
      <ProgressBar current={step} total={4} />

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col justify-between"
          >
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 bg-brand-primary rounded-[20px] flex items-center justify-center mb-10 shadow-brand-md"
              >
                <Wallet size={36} className="text-white" />
              </motion.div>

              <h1 className="text-3xl font-bold mb-3 tracking-tight leading-tight">
                Every Rupee. <br />
                <span className="text-brand-primary">Under Control.</span>
              </h1>
              <p className="text-txt-secondary text-sm font-medium leading-relaxed max-w-[280px]">
                Track expenses with minimal effort and maximal style.
              </p>
            </div>

            <div className="pb-8">
              <button
                onClick={handleNext}
                className="btn-primary rounded-[14px]"
              >
                Start Journey <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="budget"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col justify-between"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2 tracking-tight">Set your budget</h2>
              <p className="text-txt-secondary text-xs font-semibold uppercase tracking-wider">How much do you plan to spend this month?</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {/* Progress Circle Visual Container */}
              <div className="relative w-56 h-56 flex items-center justify-center mb-6">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="112"
                    cy="112"
                    r="96"
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="8"
                    className="opacity-40"
                  />
                  
                  {/* Active Track */}
                  <motion.circle
                    cx="112"
                    cy="112"
                    r="96"
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="8"
                    strokeDasharray="603"
                    initial={{ strokeDashoffset: 603 }}
                    animate={{ strokeDashoffset: 603 - (603 * percentage) }}
                    transition={{ type: "spring", stiffness: 95, damping: 20 }}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Centered Budget details */}
                <div className="text-center z-10 select-none">
                  <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-[0.2em] mb-1 block">Monthly Budget</span>
                  <div className="text-3xl font-bold text-txt-primary tracking-tight mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <AnimatedNumber value={budget} />
                  </div>
                  <motion.div
                    key={budgetInfo.label}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] text-brand-primary font-bold uppercase tracking-widest"
                  >
                    {budgetInfo.label} • ₹{dailyAverage}/day
                  </motion.div>
                </div>
              </div>

              {/* Subtext description */}
              <div className="text-center text-xs text-txt-secondary max-w-[250px] mb-8 min-h-[32px] flex items-center justify-center font-medium leading-relaxed">
                {budgetInfo.desc}
              </div>

              {/* Slider */}
              <div className="w-full px-2">
                <input
                  type="range"
                  min="500"
                  max="100000"
                  step="1"
                  value={budget}
                  onChange={(e) => {
                    setBudget(parseInt(e.target.value));
                    triggerHaptic();
                  }}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer premium-slider bg-brand-border"
                />
                <div className="flex justify-between mt-3 text-[10px] text-txt-secondary/60 font-extrabold tracking-widest uppercase">
                  <span>₹500</span>
                  <span>₹1,00,000</span>
                </div>
              </div>

              {/* Quick select Chips */}
              <div className="flex gap-2 w-full px-2 mt-8 justify-between">
                {chips.map((val) => {
                  const isSelected = budget === val;
                  return (
                    <motion.button
                      key={val}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setBudget(val);
                        triggerHaptic();
                      }}
                      className={`flex-1 py-3 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center relative border
                        ${isSelected 
                          ? 'bg-brand-primary border-transparent text-white shadow-brand-sm' 
                          : 'bg-bg-card border-brand-border text-txt-secondary hover:text-txt-primary'
                        }`}
                    >
                      ₹{val.toLocaleString('en-IN')}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="pb-8 pt-4">
              <button
                onClick={handleNext}
                className="btn-primary rounded-[14px]"
              >
                Confirm Budget <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="sms"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col h-full justify-between"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 tracking-tight">Smart Detection</h2>
              <p className="text-txt-secondary text-xs font-semibold uppercase tracking-wider">Configure your tracking engine</p>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-1 pb-4 scrollbar-none">
              {/* SECTION 1 - SMS TRANSACTION TRACKING */}
              <div className="bg-bg-card border border-brand-border p-5 rounded-[16px] relative overflow-hidden">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200
                      ${smsTracking ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-brand-border/40 border-brand-border text-txt-disabled'}`}>
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-txt-primary">SMS Transaction Tracking</h4>
                      <p className="text-xs text-txt-secondary leading-relaxed mt-1">
                        Allow Finovo Hub to detect banking transaction SMS and automatically track your expenses.
                      </p>
                    </div>
                  </div>

                  {/* Modern Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => setSmsTracking(!smsTracking)}
                    className={`w-12 h-6 rounded-full p-1 transition-all relative shrink-0 focus:outline-none mt-1.5 cursor-pointer
                      ${smsTracking ? 'bg-brand-primary' : 'bg-brand-border'}`}
                  >
                    <motion.div
                      layout
                      className="w-4 h-4 bg-white rounded-full shadow-md"
                      animate={{ x: smsTracking ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Privacy note */}
                <div className="pt-4 border-t border-brand-border text-[11px] text-txt-secondary font-medium leading-relaxed">
                  <span className="text-brand-primary font-bold">Privacy note:</span> We only read banking transaction messages for expense tracking. Personal chats, OTPs, and private messages are never accessed.
                </div>
              </div>

              {/* SECTION 2 - CATEGORIZATION PREFERENCE */}
              <div className="bg-bg-card border border-brand-border p-5 rounded-[16px] relative overflow-hidden">
                <div className="mb-4">
                  <h4 className="font-bold text-sm text-txt-primary">Categorization Preference</h4>
                  <p className="text-xs text-txt-secondary mt-1">Choose when you want to review and categorize expenses.</p>
                </div>

                <div className="space-y-3">
                  {/* Option 1 */}
                  <div
                    onClick={() => setCatPreference('instant')}
                    className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer
                      ${catPreference === 'instant' ? 'bg-brand-primary/5 border-brand-primary' : 'bg-bg-app border-brand-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⚡</span>
                      <div>
                        <h5 className="text-xs font-bold text-txt-primary">Categorize After Every Transaction</h5>
                        <p className="text-[10px] text-txt-secondary mt-0.5">Get notified immediately after every new expense.</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200
                      ${catPreference === 'instant' ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-border bg-transparent'}`}>
                      {catPreference === 'instant' && <Check size={10} className="stroke-[3px]" />}
                    </div>
                  </div>

                  {/* Option 2 */}
                  <div
                    onClick={() => setCatPreference('daily')}
                    className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer
                      ${catPreference === 'daily' ? 'bg-brand-primary/5 border-brand-primary' : 'bg-bg-app border-brand-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🌙</span>
                      <div>
                        <h5 className="text-xs font-bold text-txt-primary">Daily Review (9:00 PM)</h5>
                        <p className="text-[10px] text-txt-secondary mt-0.5">Receive one consolidated reminder every night at 9 PM.</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200
                      ${catPreference === 'daily' ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-border bg-transparent'}`}>
                      {catPreference === 'daily' && <Check size={10} className="stroke-[3px]" />}
                    </div>
                  </div>

                  {/* Option 3 */}
                  <div
                    onClick={() => setCatPreference('weekend')}
                    className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer
                      ${catPreference === 'weekend' ? 'bg-brand-primary/5 border-brand-primary' : 'bg-bg-app border-brand-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📅</span>
                      <div>
                        <h5 className="text-xs font-bold text-txt-primary">Weekend Review</h5>
                        <p className="text-[10px] text-txt-secondary mt-0.5">Review and categorize all expenses together on weekends.</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200
                      ${catPreference === 'weekend' ? 'border-brand-primary bg-brand-primary text-white' : 'border-brand-border bg-transparent'}`}>
                      {catPreference === 'weekend' && <Check size={10} className="stroke-[3px]" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pb-8 pt-4">
              <button
                onClick={handleNext}
                className="btn-primary rounded-[14px]"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="completion"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col justify-between"
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="w-32 h-32 bg-brand-success/10 rounded-full flex items-center justify-center mb-10 relative"
              >
                <CheckCircle2 size={64} className="text-brand-success" />
              </motion.div>

              <h2 className="text-3xl font-bold mb-3 tracking-tight">You're all set!</h2>
              <p className="text-txt-secondary text-sm font-medium leading-relaxed max-w-[280px]">
                Welcome to the future of <br />
                <span className="text-brand-success font-semibold">smart saving.</span>
              </p>
            </div>

            <div className="pb-8">
              <button
                onClick={() => onComplete({ budget })}
                className="btn-primary rounded-[14px]"
              >
                Enter Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
