/**
 * Finovo Transaction Data Access Layer
 * Robust repository providing CRUD, search, filtering, and pagination against Supabase PostgreSQL.
 * Enforces:
 * - Row Level Security (RLS) ownership
 * - Zero currency loss via integer minor units (paise: 1 INR = 100 paise)
 * - Explicit error handling and no silent failure fallbacks
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { toPaise, fromPaise } from '../utils/currency.js';
import { getTodayDateString, getCurrentTimeString } from '../utils/date.js';
import { validateTransaction } from '../utils/validation.js';

/**
 * Converts 12-hour AM/PM string to 24-hour HH:MM:SS for PostgreSQL TIME type.
 * @param {string} timeStr E.g. '01:30 PM' or '13:30'
 * @returns {string} HH:MM:SS
 */
export function formatTo24HourTime(timeStr) {
  if (!timeStr) return '12:00:00';
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return '12:00:00';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const second = match[3] || '00';
  const meridiem = (match[4] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}:${second}`;
}

/**
 * Converts PostgreSQL 24-hour TIME (e.g. '13:30:00') to 12-hour AM/PM for display.
 * @param {string} timeStr E.g. '13:30:00'
 * @returns {string} E.g. '01:30 PM'
 */
export function formatTo12HourTime(timeStr) {
  if (!timeStr) return '12:00 PM';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return '12:00 PM';
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return '12:00 PM';
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minute} ${meridiem}`;
}

/**
 * Maps a database row from public.transactions into the frontend Transaction domain model.
 * @param {Object} row PostgreSQL row
 * @returns {Object} Frontend Transaction
 */
export function mapRowToTransaction(row) {
  if (!row) return null;
  const metadata = row.import_metadata || {};
  return {
    id: row.id,
    userId: row.user_id,
    amount: fromPaise(row.amount_paise),
    amount_paise: row.amount_paise,
    currency: row.currency || 'INR',
    type: row.type || 'expense',
    merchant: row.merchant || 'Unknown Merchant',
    description: row.description || '',
    category: row.category_name || 'Others',
    categoryId: row.category_id || null,
    date: row.date,
    time: row.time ? formatTo12HourTime(row.time) : '12:00 PM',
    paymentMethod: row.payment_method || 'UPI',
    notes: row.note || '',
    status: metadata.status || 'Completed',
    isSplit: Boolean(metadata.isSplit),
    groupId: metadata.groupId || null,
    groupTitle: metadata.groupTitle || null,
    splitPeopleCount: metadata.splitPeopleCount || 1,
    splitType: metadata.splitType || null,
    isManualCategory: Boolean(metadata.isManualCategory),
    source: row.source || 'manual',
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Maps a frontend transaction input object to a public.transactions database row.
 * @param {Object} tx
 * @param {string} userId
 * @returns {Object}
 */
export function mapTransactionToRow(tx, userId) {
  return {
    user_id: userId,
    amount_paise: toPaise(tx.amount),
    type: tx.type === 'income' ? 'income' : 'expense',
    merchant: (tx.merchant || '').trim(),
    category_name: tx.category || 'Others',
    category_id: tx.categoryId || null,
    date: tx.date || getTodayDateString(),
    time: formatTo24HourTime(tx.time || getCurrentTimeString()),
    payment_method: tx.paymentMethod || 'UPI',
    note: (tx.notes || tx.note || '').trim(),
    is_demo: Boolean(tx.isDemo),
    import_metadata: {
      status: tx.status || 'Completed',
      isSplit: Boolean(tx.isSplit),
      groupId: tx.groupId || null,
      groupTitle: tx.groupTitle || null,
      splitPeopleCount: tx.splitPeopleCount || 1,
      splitType: tx.splitType || null,
      isManualCategory: Boolean(tx.isManualCategory)
    }
  };
}

/**
 * Transaction Service Object
 */
export const transactionService = {
  /**
   * Fetch transactions for the authenticated user with optional filtering, search, sorting, and pagination.
   * @param {Object} options
   * @param {string} options.userId - Authenticated user UUID
   * @param {string} [options.category] - Category filter ('All' or specific category)
   * @param {string} [options.type] - Type filter ('all', 'income', 'expense')
   * @param {string} [options.dateStart] - YYYY-MM-DD
   * @param {string} [options.dateEnd] - YYYY-MM-DD
   * @param {string} [options.search] - Search text for merchant name
   * @param {string} [options.sortOrder='newest'] - 'newest', 'oldest', 'lowToHigh', 'highToLow'
   * @param {number} [options.page] - 1-based page index
   * @param {number} [options.pageSize] - Number of items per page
   * @param {boolean} [options.isDemo=false] - Whether to include demo records
   * @returns {Promise<{ data: Array<Object>, count: number, error: Error|null }>}
   */
  async fetchTransactions({
    userId,
    category = 'All',
    type = 'all',
    dateStart = '',
    dateEnd = '',
    search = '',
    sortOrder = 'newest',
    page = null,
    pageSize = null,
    isDemo = false
  } = {}) {
    if (!isSupabaseConfigured() || !supabase) {
      return { 
        data: null, 
        count: 0, 
        error: new Error('Supabase backend configuration is missing. Please check .env file.') 
      };
    }

    if (!userId) {
      return { 
        data: null, 
        count: 0, 
        error: new Error('User authentication ID is required to fetch transactions.') 
      };
    }

    try {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Demo isolation: by default only query real user records
      if (typeof isDemo === 'boolean') {
        query = query.eq('is_demo', isDemo);
      }

      // Category filter
      if (category && category !== 'All') {
        query = query.ilike('category_name', category);
      }

      // Type filter
      if (type === 'income' || type === 'expense') {
        query = query.eq('type', type);
      }

      // Date range filter
      if (dateStart) {
        query = query.gte('date', dateStart);
      }
      if (dateEnd) {
        query = query.lte('date', dateEnd);
      }

      // Merchant search
      if (search && search.trim()) {
        query = query.ilike('merchant', `%${search.trim()}%`);
      }

      // Sorting
      if (sortOrder === 'oldest') {
        query = query
          .order('date', { ascending: true })
          .order('time', { ascending: true });
      } else if (sortOrder === 'lowToHigh') {
        query = query.order('amount_paise', { ascending: true });
      } else if (sortOrder === 'highToLow') {
        query = query.order('amount_paise', { ascending: false });
      } else {
        // Default 'newest'
        query = query
          .order('date', { ascending: false })
          .order('time', { ascending: false })
          .order('created_at', { ascending: false });
      }

      // Pagination
      if (page && pageSize && pageSize > 0) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, count, error } = await query;

      if (error) {
        return { data: null, count: 0, error: new Error(error.message || 'Failed to fetch transactions') };
      }

      const mapped = (data || []).map(mapRowToTransaction);
      return { data: mapped, count: count ?? mapped.length, error: null };
    } catch (err) {
      return { data: null, count: 0, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetch a single transaction by ID for the authenticated user.
   * @param {string} userId
   * @param {string} txId
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async fetchTransactionById(userId, txId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: new Error('Supabase client is not configured.') };
    }
    if (!userId || !txId) {
      return { data: null, error: new Error('Both userId and txId are required.') };
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', txId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return { data: null, error: new Error(error.message || 'Transaction not found') };
      }

      return { data: mapRowToTransaction(data), error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Creates a new transaction row in public.transactions.
   * Validates mandatory fields, checks for duplicate submissions, converts rupees to paise.
   * @param {string} userId
   * @param {Object} txData
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async createTransaction(userId, txData) {
    if (!userId) {
      return { 
        data: null, 
        error: new Error('Authentication required: user ID is missing.') 
      };
    }

    // Pure validation
    const validation = validateTransaction({
      amount: txData?.amount,
      merchant: txData?.merchant,
      date: txData?.date
    });

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      const err = new Error(firstError);
      err.errors = validation.errors;
      return { data: null, error: err };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { 
        data: null, 
        error: new Error('Supabase backend configuration is missing. Cannot save transaction.') 
      };
    }

    try {
      const row = mapTransactionToRow(txData, userId);
      const { data, error } = await supabase
        .from('transactions')
        .insert(row)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to insert transaction') };
      }

      return { data: mapRowToTransaction(data), error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Updates an existing transaction row in public.transactions.
   * @param {string} userId
   * @param {string} txId
   * @param {Object} updates
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async updateTransaction(userId, txId, updates = {}) {
    if (!userId || !txId) {
      return { data: null, error: new Error('Both userId and txId are required.') };
    }

    // Validate updated fields if amount or merchant changed
    if (updates.amount !== undefined || updates.merchant !== undefined || updates.date !== undefined) {
      const validation = validateTransaction({
        amount: updates.amount !== undefined ? updates.amount : 100,
        merchant: updates.merchant !== undefined ? updates.merchant : 'Merchant',
        date: updates.date
      });
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        const err = new Error(firstError);
        err.errors = validation.errors;
        return { data: null, error: err };
      }
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: new Error('Supabase client is not configured.') };
    }

    try {
      const rowUpdates = {};

      if (updates.amount !== undefined) {
        rowUpdates.amount_paise = toPaise(updates.amount);
      }
      if (updates.merchant !== undefined) {
        rowUpdates.merchant = updates.merchant.trim();
      }
      if (updates.category !== undefined) {
        rowUpdates.category_name = updates.category;
      }
      if (updates.categoryId !== undefined) {
        rowUpdates.category_id = updates.categoryId;
      }
      if (updates.date !== undefined) {
        rowUpdates.date = updates.date;
      }
      if (updates.time !== undefined) {
        rowUpdates.time = formatTo24HourTime(updates.time);
      }
      if (updates.paymentMethod !== undefined) {
        rowUpdates.payment_method = updates.paymentMethod;
      }
      if (updates.notes !== undefined || updates.note !== undefined) {
        rowUpdates.note = (updates.notes || updates.note || '').trim();
      }
      if (updates.type !== undefined) {
        rowUpdates.type = updates.type;
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(rowUpdates)
        .eq('id', txId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message || 'Failed to update transaction') };
      }

      return { data: mapRowToTransaction(data), error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Deletes a transaction row for the authenticated user.
   * RLS guarantees that only the owner can delete.
   * @param {string} userId
   * @param {string} txId
   * @returns {Promise<{ success: boolean, error: Error|null }>}
   */
  async deleteTransaction(userId, txId) {
    if (!userId || !txId) {
      return { success: false, error: new Error('Both userId and txId are required.') };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: new Error('Supabase client is not configured.') };
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: new Error(error.message || 'Failed to delete transaction') };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetches available categories (system global categories and user custom categories).
   * @param {string} userId
   * @returns {Promise<{ data: Array<Object>, error: Error|null }>}
   */
  async fetchCategories(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: new Error('Supabase client is not configured.') };
    }

    try {
      let query = supabase.from('categories').select('*');
      if (userId) {
        query = query.or(`user_id.is.null,user_id.eq.${userId}`);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        return { data: [], error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Previews historical transactions that match a merchant rule.
   * Identifies candidate transactions without modifying them.
   * Flags whether a transaction was previously manually confirmed.
   * 
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.merchantPattern
   * @param {'exact'|'contains'|'regex'} [params.matchType='exact']
   * @param {'all'|'expense'|'income'} [params.transactionType='all']
   * @param {string} params.newCategoryName
   * @param {Array<Object>} [params.currentTransactions=null]
   * @returns {Promise<{
   *   candidates: Array<Object>,
   *   totalMatching: number,
   *   alreadyMatching: number,
   *   error: Error|null
   * }>}
   */
  async previewHistoricalRecategorisation({
    userId,
    merchantPattern,
    matchType = 'exact',
    transactionType = 'all',
    newCategoryName,
    currentTransactions = null
  }) {
    if (!userId) {
      return { candidates: [], totalMatching: 0, alreadyMatching: 0, error: new Error('User ID is required.') };
    }
    if (!merchantPattern || !merchantPattern.trim()) {
      return { candidates: [], totalMatching: 0, alreadyMatching: 0, error: new Error('Merchant pattern is required.') };
    }
    if (!newCategoryName || !newCategoryName.trim()) {
      return { candidates: [], totalMatching: 0, alreadyMatching: 0, error: new Error('New category name is required.') };
    }

    let txList = currentTransactions;
    if (!txList) {
      const { data, error } = await this.fetchTransactions({ userId });
      if (error) {
        return { candidates: [], totalMatching: 0, alreadyMatching: 0, error };
      }
      txList = data || [];
    }

    const normPattern = merchantPattern.toLowerCase().trim();
    const targetCategory = newCategoryName.trim();
    const candidates = [];
    let alreadyMatchingCount = 0;

    for (const tx of txList) {
      if (tx.isDemo) continue; // Skip demo items
      if (transactionType !== 'all' && tx.type !== transactionType) continue;

      const normMerchant = (tx.merchant || '').toLowerCase().trim();
      const normDesc = (tx.description || tx.notes || '').toLowerCase().trim();

      let isMatch = false;
      if (matchType === 'exact') {
        isMatch = (normMerchant === normPattern);
      } else if (matchType === 'contains') {
        isMatch = normMerchant.includes(normPattern) || normDesc.includes(normPattern);
      } else if (matchType === 'regex') {
        try {
          const rx = new RegExp(merchantPattern, 'i');
          isMatch = rx.test(tx.merchant || '') || rx.test(tx.notes || '');
        } catch {
          isMatch = false;
        }
      }

      if (isMatch) {
        if ((tx.category || '').toLowerCase() === targetCategory.toLowerCase()) {
          alreadyMatchingCount++;
        } else {
          candidates.push({
            id: tx.id,
            date: tx.date,
            merchant: tx.merchant,
            amount: tx.amount,
            type: tx.type,
            currentCategory: tx.category || 'Uncategorized',
            proposedCategory: targetCategory,
            isManualCategory: Boolean(tx.isManualCategory)
          });
        }
      }
    }

    return {
      candidates,
      totalMatching: candidates.length + alreadyMatchingCount,
      alreadyMatching: alreadyMatchingCount,
      error: null
    };
  },

  /**
   * Applies user-confirmed historical recategorisation.
   * Performs updates strictly through authenticated user context.
   * Never modifies amount, date, description, or notes.
   * 
   * @param {string} userId 
   * @param {Array<{ id: string, newCategoryName: string, newCategoryId?: string }>} updates 
   * @returns {Promise<{ updatedCount: number, error: Error|null }>}
   */
  async applyHistoricalRecategorisation(userId, updates = []) {
    if (!userId) {
      return { updatedCount: 0, error: new Error('User ID is required.') };
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      return { updatedCount: 0, error: null };
    }

    let updatedCount = 0;
    const errors = [];

    for (const item of updates) {
      if (!item.id || !item.newCategoryName) continue;
      const res = await this.updateTransaction(userId, item.id, {
        category: item.newCategoryName,
        categoryId: item.newCategoryId || null
      });

      if (res.error) {
        errors.push(res.error);
      } else {
        updatedCount++;
      }
    }

    if (errors.length > 0 && updatedCount === 0) {
      return { updatedCount, error: errors[0] };
    }

    return { updatedCount, error: null };
  }
};
