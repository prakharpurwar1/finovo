import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, 
  ShieldCheck, Wallet, AlertCircle, AlertTriangle, Loader2 
} from 'lucide-react';
import { validateAuthForm } from '../utils/validation.js';
import { 
  isSupabaseConfigured, 
  signInWithEmail, 
  signUpWithEmail, 
  resetPassword, 
  supabase 
} from '../lib/supabaseClient.js';

const InputField = ({ label, type = 'text', icon: Icon, value, onChange, placeholder, error, disabled = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] uppercase font-bold tracking-wider text-txt-secondary">
          {label}
        </label>
        {error && (
          <span className="text-[10px] font-bold text-brand-error flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </span>
        )}
      </div>
      <div className="relative flex items-center">
        <div className="absolute left-4 text-txt-secondary flex items-center justify-center pointer-events-none">
          <Icon size={18} />
        </div>
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-bg-card border rounded-[14px] py-3.5 pl-11 pr-11 text-sm font-medium text-txt-primary placeholder:text-txt-secondary/40 focus:outline-none transition-all ${
            error 
              ? 'border-brand-error/70 ring-1 ring-brand-error/40' 
              : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 text-txt-secondary hover:text-txt-primary transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};

const AuthFlow = ({ onComplete }) => {
  const [view, setView] = useState('login'); // 'login', 'signup', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const backendConfigured = isSupabaseConfigured();

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.08 }
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
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

  const handleClearMessages = () => {
    setErrors({});
    setGeneralError('');
    setSuccessNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    handleClearMessages();

    const isSignup = view === 'signup';
    const validation = validateAuthForm({ email, password, name }, isSignup);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (!backendConfigured) {
      setGeneralError('Supabase is not configured. Real authentication requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await signUpWithEmail(email, password, name);
        if (error) {
          setGeneralError(error.message);
          return;
        }

        if (data?.user) {
          if (data.session) {
            onComplete({
              id: data.user.id,
              name: data.user.user_metadata?.full_name || name.trim() || email.split('@')[0],
              email: data.user.email,
              createdAt: data.user.created_at || new Date().toISOString(),
              isPremium: false
            });
          } else {
            setSuccessNotice('Account registered! A confirmation link has been sent to your email. Please verify your address to sign in.');
          }
        }
      } else {
        const { data, error } = await signInWithEmail(email, password);
        if (error) {
          setGeneralError(error.message);
          return;
        }

        if (data?.user) {
          onComplete({
            id: data.user.id,
            name: data.user.user_metadata?.full_name || (data.user.email ? data.user.email.split('@')[0] : 'Finovo Member'),
            email: data.user.email,
            createdAt: data.user.created_at || new Date().toISOString(),
            isPremium: false
          });
        }
      }
    } catch (err) {
      setGeneralError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRecovery = async (e) => {
    e.preventDefault();
    handleClearMessages();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Valid registered email is required' });
      return;
    }

    if (!backendConfigured) {
      setGeneralError('Supabase is not configured. Please supply project credentials in .env to enable password recovery.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        setGeneralError(error.message);
        return;
      }
      setRecoverySent(true);
      setTimeout(() => {
        setView('login');
        setRecoverySent(false);
      }, 3500);
    } catch (err) {
      setGeneralError(err.message || 'Failed to dispatch recovery instructions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    handleClearMessages();
    if (!backendConfigured || !supabase) {
      setGeneralError('Google authentication requires an active Supabase project configuration in .env.');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : ''
      }
    });
    if (error) {
      setGeneralError(error.message);
      setIsLoading(false);
    }
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
            <div className="mb-6 flex flex-col items-center">
              <motion.div 
                variants={itemVariants}
                className="w-16 h-16 bg-brand-primary rounded-[16px] mb-5 flex items-center justify-center shadow-brand-sm border border-brand-border/20 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Wallet size={28} className="text-white" />
              </motion.div>
              
              <motion.h2 
                variants={itemVariants} 
                className="text-2xl font-bold tracking-tight text-txt-primary mb-1"
              >
                Finovo
              </motion.h2>
              <motion.p 
                variants={itemVariants} 
                className="text-xs font-semibold text-txt-secondary"
              >
                Track. Understand. <span className="text-brand-primary font-bold">Grow Your Money.</span>
              </motion.p>
            </div>

            {/* Backend Configuration Notice (Displays when .env is unconfigured) */}
            {!backendConfigured && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Backend Setup Required</p>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Supabase credentials are not configured. Add <code className="font-mono text-[10px] bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono text-[10px] bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono text-[10px] bg-amber-500/15 px-1 py-0.5 rounded">.env</code> to enable live authentication.
                  </p>
                </div>
              </motion.div>
            )}

            {/* General Feedback Banners */}
            {generalError && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/30 text-brand-error text-xs font-semibold flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </motion.div>
            )}

            {successNotice && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-brand-success/10 border border-brand-success/30 text-brand-success text-xs font-semibold flex items-start gap-2"
              >
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>{successNotice}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Email Address"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.email}
                  placeholder="name@email.com"
                  disabled={isLoading}
                />
                <InputField
                  label="Password"
                  type="password"
                  icon={Lock}
                  value={password}
                  onChange={(val) => {
                    setPassword(val);
                    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.password}
                  placeholder="••••••••"
                  disabled={isLoading}
                />

                <div className="flex justify-end -mt-1">
                  <button 
                    type="button"
                    onClick={() => {
                      handleClearMessages();
                      setView('forgot');
                    }}
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
                  disabled={isLoading}
                  className="btn-primary rounded-[14px] shadow-brand-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span> <ArrowRight size={18} />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="my-6 flex items-center gap-4">
                  <div className="h-[1px] flex-1 bg-brand-border" />
                  <span className="text-[10px] text-txt-secondary/60 uppercase tracking-[0.2em] font-bold">Secure Access</span>
                  <div className="h-[1px] flex-1 bg-brand-border" />
                </div>

                {/* Google Sign In button */}
                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="btn-secondary rounded-[14px] flex items-center justify-center gap-2"
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
                  onClick={() => {
                    handleClearMessages();
                    setView('signup');
                  }}
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
              onClick={() => {
                handleClearMessages();
                setView('login');
              }}
              className="w-10 h-10 bg-bg-card border border-brand-border rounded-xl flex items-center justify-center mb-6 text-txt-secondary hover:text-txt-primary transition-all self-start cursor-pointer"
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="mb-6">
              <motion.h2 variants={itemVariants} className="text-2xl font-bold tracking-tight mb-2">Create Account</motion.h2>
              <motion.p variants={itemVariants} className="text-txt-secondary text-sm font-medium leading-relaxed">Experience a new standard of wealth management.</motion.p>
            </div>

            {/* Backend Configuration Warning */}
            {!backendConfigured && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Backend Setup Required</p>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Account registration requires active Supabase backend credentials in <code className="font-mono text-[10px] bg-amber-500/15 px-1 py-0.5 rounded">.env</code>.
                  </p>
                </div>
              </motion.div>
            )}

            {generalError && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/30 text-brand-error text-xs font-semibold flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </motion.div>
            )}

            {successNotice && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-brand-success/10 border border-brand-success/30 text-brand-success text-xs font-semibold flex items-start gap-2"
              >
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>{successNotice}</span>
              </motion.div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Full Name"
                  type="text"
                  icon={ShieldCheck}
                  value={name}
                  onChange={(val) => {
                    setName(val);
                    if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.name}
                  placeholder="Your Full Name"
                  disabled={isLoading}
                />
                <InputField
                  label="Email Address"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.email}
                  placeholder="name@email.com"
                  disabled={isLoading}
                />
                <InputField
                  label="Password"
                  type="password"
                  icon={Lock}
                  value={password}
                  onChange={(val) => {
                    setPassword(val);
                    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.password}
                  placeholder="••••••••"
                  disabled={isLoading}
                />

                <div className="mb-6 mt-4 flex items-start gap-4 p-4 bg-brand-primary/5 rounded-[12px] border border-brand-border">
                  <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 accent-brand-primary rounded bg-bg-card border-brand-border" />
                  <p className="text-[10px] text-txt-secondary leading-relaxed font-semibold uppercase tracking-wider">
                    I accept the <span className="text-brand-primary font-bold">Terms of Wealth</span> and the <span className="text-brand-primary font-bold">Privacy Protocol</span>.
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary rounded-[14px] shadow-brand-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Access Account</span> <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            <motion.div variants={itemVariants} className="text-center pb-8 mt-6">
              <p className="text-xs text-txt-secondary font-medium">
                Already have an account?{' '}
                <button 
                  onClick={() => {
                    handleClearMessages();
                    setView('login');
                  }}
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
              onClick={() => {
                handleClearMessages();
                setView('login');
              }}
              className="w-10 h-10 bg-bg-card border border-brand-border rounded-xl flex items-center justify-center mb-6 text-txt-secondary hover:text-txt-primary transition-all self-start cursor-pointer"
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="mb-6">
              <motion.h2 variants={itemVariants} className="text-2xl font-bold tracking-tight mb-2">Protocol Reset</motion.h2>
              <motion.p variants={itemVariants} className="text-txt-secondary text-sm font-medium">Verify your registered email to regain access.</motion.p>
            </div>

            {/* Backend Configuration Warning */}
            {!backendConfigured && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Backend Setup Required</p>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Password recovery requires configured Supabase credentials in <code className="font-mono text-[10px] bg-amber-500/15 px-1 py-0.5 rounded">.env</code>.
                  </p>
                </div>
              </motion.div>
            )}

            {generalError && (
              <motion.div
                variants={itemVariants}
                className="mb-5 p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/30 text-brand-error text-xs font-semibold flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </motion.div>
            )}

            <form onSubmit={handleSendRecovery} className="flex-1 flex flex-col justify-between">
              <motion.div variants={itemVariants} className="space-y-4">
                <InputField
                  label="Registered Email"
                  type="email"
                  icon={Mail}
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                    if (generalError) setGeneralError('');
                  }}
                  error={errors.email}
                  placeholder="name@email.com"
                  disabled={isLoading}
                />

                {recoverySent && (
                  <div className="p-3 bg-brand-success/10 border border-brand-success/20 rounded-xl text-xs font-semibold text-brand-success flex items-center gap-2">
                    <ShieldCheck size={16} />
                    <span>✓ Recovery instructions dispatched. Redirecting to sign in...</span>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-6 mt-6">
                <button
                  type="submit"
                  disabled={isLoading || recoverySent}
                  className="btn-primary rounded-[14px] shadow-brand-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Dispatching Key...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Recovery Key</span> <ArrowRight size={18} />
                    </>
                  )}
                </button>
                
                <div className="flex items-center gap-4 p-5 bg-bg-card border border-brand-border rounded-[16px]">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary flex-shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <p className="text-[10px] text-txt-secondary font-bold uppercase tracking-widest leading-normal">
                    256-bit encrypted authentication recovery channel.
                  </p>
                </div>
              </motion.div>
            </form>

            <motion.div variants={itemVariants} className="text-center pb-8 mt-6">
              <button 
                onClick={() => {
                  handleClearMessages();
                  setView('login');
                }}
                className="text-xs text-brand-primary font-bold uppercase tracking-widest hover:opacity-80 transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthFlow;
