import { createClient } from '@supabase/supabase-js';

const rawUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : '';
const rawAnonKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : '';

/**
 * Validates whether the Supabase project URL and Anon Key are valid and not placeholders.
 * @returns {boolean} True if real configuration parameters are supplied.
 */
export const isSupabaseConfigured = () => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  if (!rawAnonKey || typeof rawAnonKey !== 'string') return false;

  const trimmedUrl = rawUrl.trim();
  const trimmedKey = rawAnonKey.trim();

  // Guard against unconfigured placeholder strings
  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://localhost')) {
    return false;
  }
  if (trimmedUrl.includes('your-project-id') || trimmedUrl.includes('example.com')) {
    return false;
  }
  if (trimmedKey.includes('your-anon-key') || trimmedKey.length < 20) {
    return false;
  }

  return true;
};

/**
 * Returns diagnostic configuration status for development UI feedback.
 */
export const getSupabaseConfigStatus = () => {
  const configured = isSupabaseConfigured();
  return {
    isConfigured: configured,
    hasUrl: Boolean(rawUrl && !rawUrl.includes('your-project-id')),
    hasKey: Boolean(rawAnonKey && !rawAnonKey.includes('your-anon-key')),
    url: rawUrl ? `${rawUrl.substring(0, 16)}...` : null
  };
};

/**
 * Supabase client instance initialized with browser persistence.
 * Null if environment variables are not configured.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(rawUrl.trim(), rawAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    })
  : null;

/**
 * Sign in existing user with email and password
 */
export const signInWithEmail = async (email, password) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { 
      data: null, 
      error: new Error('Supabase backend configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.') 
    };
  }
  return await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
};

/**
 * Register a new user with email, password and optional display name
 */
export const signUpWithEmail = async (email, password, fullName) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { 
      data: null, 
      error: new Error('Supabase backend configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.') 
    };
  }
  return await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName ? fullName.trim() : email.split('@')[0]
      }
    }
  });
};

/**
 * Sign out current authenticated session
 */
export const signOutUser = async () => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: null };
  }
  return await supabase.auth.signOut();
};

/**
 * Send password reset email
 */
export const resetPassword = async (email) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { 
      data: null, 
      error: new Error('Supabase backend configuration is missing. Please configure your .env file.') 
    };
  }
  const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectOrigin
  });
};

/**
 * Retrieve current active session
 */
export const getCurrentSession = async () => {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: { session: null }, error: null };
  }
  return await supabase.auth.getSession();
};

/**
 * Subscribe to Supabase auth state changes
 */
export const onAuthStateChange = (callback) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
};

/**
 * Fetch user profile from public.profiles
 */
export const fetchUserProfile = async (userId) => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { data: null, error: null };
  }
  return await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
};

/**
 * Update user profile in public.profiles
 */
export const updateUserProfileRemote = async (userId, updates) => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { data: null, error: null };
  }
  return await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
};

/**
 * Fetch user preferences from public.user_preferences
 */
export const fetchUserPreferences = async (userId) => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { data: null, error: null };
  }
  return await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
};

/**
 * Upsert user preferences in public.user_preferences
 */
export const upsertUserPreferencesRemote = async (userId, preferences) => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return { data: null, error: null };
  }
  return await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString()
    });
};
