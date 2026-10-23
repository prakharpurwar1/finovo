/**
 * Finovo Budget Data Access & Calculation Layer
 * Repository providing budget operations against Supabase PostgreSQL public.budgets.
 * Enforces:
 * - Integer minor units (paise)
 * - Row Level Security (RLS) bound to auth.users
 * - Explicit error handling without silent failures
 * - Category-specific budgets and global wallet budgets
 * - Budget progress, remaining calculations, and over-budget alerting
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { toPaise, fromPaise } from '../utils/currency.js';
import { getTodayDateString, getCurrentMonthBoundaries } from '../utils/date.js';

/**
 * Maps a database row from public.budgets into domain Budget model.
 * @param {Object} row
 * @returns {Object}
 */
export function mapRowToBudget(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    categoryName: row.category_name || (row.category_id ? 'Custom Category' : 'Global Monthly Budget'),
    amount: fromPaise(row.amount_paise),
    amount_paise: row.amount_paise,
    currency: row.currency || 'INR',
    period: row.period || 'monthly',
    month: row.month,
    startDate: row.start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Calculates budget health and progress against transactions.
 * 
 * @param {Object} budget 
 * @param {Array<Object>} transactions 
 * @param {Object} [boundaries]
 * @returns {Object}
 */
export function calculateBudgetProgress(budget, transactions = [], boundaries = null) {
  const periodBoundaries = boundaries || getCurrentMonthBoundaries();
  const budgetAmount = Number(budget.amount || 0);

  // Filter transactions strictly within period boundary and exclude demo items
  const eligibleTransactions = transactions.filter(tx => {
    if (tx.isDemo) return false;
    const isWithinDate = tx.date >= periodBoundaries.startDate && tx.date <= periodBoundaries.endDate;
    if (!isWithinDate) return false;

    // If budget is for a specific category, filter strictly to that category
    if (budget.categoryId || (budget.categoryName && budget.categoryName !== 'Global Monthly Budget')) {
      const matchCat = (tx.category || '').toLowerCase().trim();
      const targetCat = (budget.categoryName || '').toLowerCase().trim();
      return matchCat === targetCat;
    }
    // Global budget applies to all expense transactions
    return tx.type === 'expense';
  });

  // Calculate net spend (deducting refunds if category is refunds, standard accounting)
  let actualSpend = 0;
  for (const tx of eligibleTransactions) {
    if (tx.type === 'expense') {
      actualSpend += Number(tx.amount || 0);
    } else if (tx.type === 'income' && (tx.category || '').toLowerCase() === 'refunds') {
      actualSpend = Math.max(0, actualSpend - Number(tx.amount || 0));
    }
  }

  const percentage = budgetAmount > 0 
    ? Math.round((actualSpend / budgetAmount) * 100)
    : 0;
  
  const remaining = Math.max(0, budgetAmount - actualSpend);
  const isExceeded = actualSpend > budgetAmount;
  const exceededAmount = isExceeded ? actualSpend - budgetAmount : 0;

  let status = 'safe';
  if (isExceeded) {
    status = 'exceeded';
  } else if (percentage >= 90) {
    status = 'danger';
  } else if (percentage >= 70) {
    status = 'warning';
  }

  return {
    budget,
    actualSpend,
    budgetAmount,
    remaining,
    percentage,
    isExceeded,
    exceededAmount,
    status,
    transactionCount: eligibleTransactions.length
  };
}

export const budgetService = {
  /**
   * Fetches all configured budgets for the authenticated user.
   * @param {string} userId
   * @returns {Promise<{ data: Array<Object>, error: Error|null }>}
   */
  async fetchBudgets(userId) {
    if (!userId) {
      return { data: [], error: new Error('User ID is required to fetch budgets.') };
    }
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: new Error('Supabase client is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      return { data: (data || []).map(mapRowToBudget), error: null };
    } catch (err) {
      return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetches the global monthly spending budget for the authenticated user.
   * @param {string} userId
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async fetchGlobalMonthlyBudget(userId) {
    if (!userId) {
      return { data: null, error: new Error('User ID is required.') };
    }
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: new Error('Supabase client is not configured.') };
    }

    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .is('category_id', null)
        .or('category_name.is.null,category_name.eq.Global Monthly Budget')
        .limit(1)
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: data ? mapRowToBudget(data) : null, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Upserts a budget limit in public.budgets for a category or global limit.
   * Prevents duplicate budgets for same user, category, and period.
   * 
   * @param {string} userId
   * @param {Object} budgetData
   * @param {number} budgetData.amount
   * @param {string} [budgetData.id]
   * @param {string|null} [budgetData.categoryId=null]
   * @param {string|null} [budgetData.categoryName=null]
   * @param {string} [budgetData.period='monthly']
   * @param {string} [budgetData.currency='INR']
   * @param {string} [budgetData.startDate]
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async upsertBudget(userId, { 
    id = null, 
    categoryId = null, 
    categoryName = null, 
    amount, 
    period = 'monthly', 
    currency = 'INR',
    startDate = null 
  }) {
    if (!userId) {
      return { data: null, error: new Error('User ID is required.') };
    }
    if (!amount || Number(amount) <= 0) {
      return { data: null, error: new Error('Budget amount must be a positive number greater than zero.') };
    }
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: new Error('Supabase client is not configured.') };
    }

    try {
      const isGlobal = !categoryId && (!categoryName || categoryName === 'Global Monthly Budget');
      const resolvedCategoryName = isGlobal ? null : (categoryName || null);

      const row = {
        user_id: userId,
        category_id: categoryId || null,
        category_name: resolvedCategoryName,
        amount_paise: toPaise(amount),
        currency: currency || 'INR',
        period: period || 'monthly',
        start_date: startDate || getTodayDateString()
      };

      let result;
      if (id) {
        // Explicit edit of existing budget row
        result = await supabase
          .from('budgets')
          .update(row)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Check for existing budget with same user_id, category, and period
        let checkQuery = supabase.from('budgets').select('id').eq('user_id', userId).eq('period', period);
        if (resolvedCategoryName) {
          checkQuery = checkQuery.eq('category_name', resolvedCategoryName);
        } else if (categoryId) {
          checkQuery = checkQuery.eq('category_id', categoryId);
        } else {
          checkQuery = checkQuery.is('category_id', null).is('category_name', null);
        }
        
        const { data: existing } = await checkQuery.limit(1).maybeSingle();

        if (existing?.id) {
          result = await supabase
            .from('budgets')
            .update(row)
            .eq('id', existing.id)
            .eq('user_id', userId)
            .select()
            .single();
        } else {
          result = await supabase
            .from('budgets')
            .insert(row)
            .select()
            .single();
        }
      }

      if (result.error) {
        return { data: null, error: new Error(result.error.message) };
      }

      return { data: mapRowToBudget(result.data), error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Deletes a budget row by ID.
   * @param {string} userId
   * @param {string} budgetId
   * @returns {Promise<{ success: boolean, error: Error|null }>}
   */
  async deleteBudget(userId, budgetId) {
    if (!userId || !budgetId) {
      return { success: false, error: new Error('Both userId and budgetId are required.') };
    }
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: new Error('Supabase client is not configured.') };
    }

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
};
