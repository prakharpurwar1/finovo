import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, ShieldCheck, Wallet } from 'lucide-react';

const InputField = ({ label, type, icon: Icon, value, onChange, placeholder }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full mb-5 relative group">
      {/* Icon */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none transition-colors duration-200 z-10 ${isFocused ? 'text-brand-primary' : 'text-txt-secondary/60'}`}>
        <Icon size={18} />
      </div>

      {/* Input Field */}
      <input
        type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? placeholder : ''}
        className={`w-full bg-bg-card border border-brand-border rounded-[14px] pt-6 pb-2 pl-12 pr-12 text-sm text-txt-primary outline-none transition-all duration-200 
          ${isFocused ? 'border-brand-primary/80 ring-1 ring-brand-primary/20' : 'hover:border-brand-border/85'}`}
      />

      {/* Floating Label */}
      <label 
        className={`absolute left-12 pointer-events-none transition-all duration-200 font-bold uppercase tracking-widest
          ${(isFocused || value) 
            ? 'top-2 text-[9px] text-brand-primary' 
            : 'top-1/2 -translate-y-1/2 text-xs text-txt-secondary/50'}`}
      >
        {label}
      </label>

      {/* Password Toggle Visibility */}
      {type === 'password' && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-txt-secondary/50 hover:text-txt-primary transition-colors z-10 cursor-pointer"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
};

const AuthFlow = ({ onComplete }) => {
  const [view, setView] = useState('login'); // login, signup, forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Framer Motion Variants for Staggered Fade-in Page Load
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.05,
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    onComplete({
      name: name.trim() || (email ? email.split('@')[0] : 'Alex Fischer'),
      email: email.trim() || 'alex@finovo.io'
    });
  };

  return (
    <div className="w-full h-full flex flex-col p-8 pt-12 bg-bg-app text-txt-primary min-h-screen">
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div
            key="login"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col h-full relative z-10"
          >
            {/* Logo and Tagline Area */}
            <div className="mb-10 flex flex-col items-center">
              <motion.div 
                variants={itemVariants}
                className="w-16 h-16 bg-brand-primary rounded-[16px] mb-6 flex items-center justify-center shadow-brand-sm border border-brand-border/20 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Wallet size={28} className="text-white" />
              </motion.div>
              
              <motion.h2 
                variants={itemVariants}
                className="text-3xl font-bold tracking-tight text-txt-primary mb-2"
              >
                Finovo
              </motion.h2>
              
              <motion.p 
                variants={itemVariants}
                className="text-txt-secondary text-sm font-medium tracking-wide text-center"
              >
                Track. Understand. <span className="text-brand-primary font-semibold">Grow Your Money.</span>
              </motion.p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Email Address"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                  placeholder="alex@finovo.io"
                />
                <InputField
                  label="Password"
                  type="password"
                  icon={Lock}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />

                <div className="flex justify-end -mt-1">
                  <button 
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs text-txt-secondary font-bold hover:text-brand-primary transition-colors uppercase tracking-widest cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="mt-8">
                {/* Large primary Sign In button */}
                <button
                  type="submit"
                  className="btn-primary rounded-[14px]"
                >
                  Sign In <ArrowRight size={18} />
                </button>

                {/* Divider */}
                <div className="my-6 flex items-center gap-4">
                  <div className="h-[1px] flex-1 bg-brand-border" />
                  <span className="text-[10px] text-txt-secondary/60 uppercase tracking-[0.2em] font-bold">Secure Access</span>
                  <div className="h-[1px] flex-1 bg-brand-border" />
                </div>

                {/* Modern Google Sign In button */}
                <button 
                  type="button"
                  className="btn-secondary rounded-[14px]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-widest text-txt-primary/80">Continue with Google</span>
                </button>
              </motion.div>
            </form>

            {/* Bottom Link */}
            <motion.div variants={itemVariants} className="text-center pb-8 mt-6">
              <p className="text-xs text-txt-secondary font-medium">
                New to Finovo?{' '}
                <button 
                  onClick={() => setView('signup')}
                  className="text-brand-primary font-bold uppercase tracking-widest hover:opacity-80 transition-colors cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}

        {view === 'signup' && (
          <motion.div
            key="signup"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col h-full relative z-10"
          >
            {/* Back to Login Button */}
            <motion.button 
              variants={itemVariants}
              onClick={() => setView('login')}
              className="w-10 h-10 bg-bg-card border border-brand-border rounded-xl flex items-center justify-center mb-8 text-txt-secondary hover:text-txt-primary transition-all self-start cursor-pointer"
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="mb-8">
              <motion.h2 variants={itemVariants} className="text-2xl font-bold tracking-tight mb-2">Create Account</motion.h2>
              <motion.p variants={itemVariants} className="text-txt-secondary text-sm font-medium leading-relaxed">Experience a new standard of wealth management.</motion.p>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleLogin} className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Full Name"
                  type="text"
                  icon={ShieldCheck}
                  value={name}
                  onChange={setName}
                  placeholder="Alex Harrison"
                />
                <InputField
                  label="Email Address"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                  placeholder="alex@finovo.io"
                />
                <InputField
                  label="Password"
                  type="password"
                  icon={Lock}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />

                <div className="mb-6 mt-4 flex items-start gap-4 p-4 bg-brand-primary/5 rounded-[12px] border border-brand-border">
                  <input type="checkbox" className="mt-1 w-4 h-4 accent-brand-primary rounded bg-bg-card border-brand-border" />
                  <p className="text-[10px] text-txt-secondary leading-relaxed font-semibold uppercase tracking-wider">
                    I accept the <span className="text-brand-primary font-bold">Terms of Wealth</span> and the <span className="text-brand-primary font-bold">Privacy Protocol</span>.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="mt-6">
                <button
                  type="submit"
                  className="btn-primary rounded-[14px]"
                >
                  Access Account <ArrowRight size={18} />
                </button>
              </motion.div>
            </form>

            <motion.div variants={itemVariants} className="text-center pb-8 mt-6">
              <p className="text-xs text-txt-secondary font-medium">
                Already have an account?{' '}
                <button 
                  onClick={() => setView('login')}
                  className="text-brand-primary font-bold uppercase tracking-widest hover:opacity-80 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}

        {view === 'forgot' && (
          <motion.div
            key="forgot"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col h-full relative z-10"
          >
            {/* Back Button */}
            <motion.button 
              variants={itemVariants}
              onClick={() => setView('login')}
              className="w-10 h-10 bg-bg-card border border-brand-border rounded-xl flex items-center justify-center mb-8 text-txt-secondary hover:text-txt-primary transition-all self-start cursor-pointer"
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="mb-8">
              <motion.h2 variants={itemVariants} className="text-2xl font-bold tracking-tight mb-2">Protocol Reset</motion.h2>
              <motion.p variants={itemVariants} className="text-txt-secondary text-sm font-medium">Verify your identity to regain access.</motion.p>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Registered Email"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                  placeholder="alex@finovo.io"
                />
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-6 mt-6">
                <button
                  onClick={() => setView('login')}
                  className="btn-primary rounded-[14px]"
                >
                  Send Recovery Key <ArrowRight size={18} />
                </button>
                
                <div className="flex items-center gap-4 p-5 bg-bg-card border border-brand-border rounded-[16px]">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary flex-shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-widest leading-normal">
                    An encrypted recovery link will be sent to your primary email address.
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthFlow;
