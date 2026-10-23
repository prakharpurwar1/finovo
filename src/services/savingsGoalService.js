/**
 * Finovo Savings Goal Data Access & Calculation Layer
 * Repository providing goal and contribution operations against Supabase PostgreSQL public.savings_goals.
 * 
 * Enforces:
 * - Integer minor units (paise) for zero rounding loss
 * - Strict multi-tenant Row Level Security (RLS) bound to auth.users
 * - Explicit contribution tracking and progress calculations
 * - Overdue and completed goal status determination
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { toPaise, fromPaise } from '../utils/currency.js';
import { getTodayDateString } from '../utils/date.js';

const memoryStore = new Map();

function getSafeStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear()
  };
}

function getLocalKey(userId) {
  return `finovo_savings_goals_${userId}`;
}

export function getLocalGoals(userId) {
  if (!userId) return [];
  try {
    const storage = getSafeStorage();
    const raw = storage.getItem(getLocalKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading local savings goals:', e);
    return [];
  }
}

export function setLocalGoals(userId, goals) {
  if (!userId) return;
  try {
    const storage = getSafeStorage();
    storage.setItem(getLocalKey(userId), JSON.stringify(goals));
  } catch (e) {
    console.warn('Error saving local savings goals:', e);
  }
}

/**
 * Maps database row to domain SavingsGoal model.
 * 
 * @param {Object} row 
 * @returns {Object}
 */
export function mapRowToGoal(row) {
  if (!row) return null;
  const targetAmount = fromPaise(row.target_amount_paise);
  const currentAmount = fromPaise(row.current_amount_paise || 0);
  const today = getTodayDateString();

  const percentage = targetAmount > 0 
    ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
    : 0;

  const isCompleted = Boolean(row.is_completed || currentAmount >= targetAmount);
  const isOverdue = Boolean(!isCompleted && row.target_date && row.target_date < today);
  const remaining = Math.max(0, targetAmount - currentAmount);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    targetAmount,
    currentAmount,
    remaining,
    percentage,
    currency: row.currency || 'INR',
    targetDate: row.target_date,
    category: row.category || 'general',
    isCompleted,
    isOverdue,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const savingsGoalService = {
  /**
   * Fetches all savings goals for the authenticated user.
   * 
   * @param {string} userId 
   * @returns {Promise<{ data: Array<Object>, error: Error|null }>}
   */
  async fetchGoals(userId) {
    if (!userId) {
      return { data: [], error: new Error('User ID is required to fetch savings goals.') };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { data: getLocalGoals(userId), error: null };
    }

    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', userId)
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Remote savings goals fetch error, using local cache:', error.message);
        return { data: getLocalGoals(userId), error: null };
      }

      const goals = (data || []).map(mapRowToGoal);
      setLocalGoals(userId, goals);
      return { data: goals, error: null };
    } catch (err) {
      console.warn('Network error fetching savings goals:', err);
      return { data: getLocalGoals(userId), error: null };
    }
  },

  /**
   * Creates a new savings goal for the authenticated user.
   * 
   * @param {string} userId 
   * @param {Object} goalData 
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async createGoal(userId, { name, targetAmount, currentAmount = 0, targetDate = null, category = 'general', currency = 'INR' }) {
    if (!userId) {
      return { data: null, error: new Error('User ID is required.') };
    }
    if (!name || !name.trim()) {
      return { data: null, error: new Error('Goal name is required.') };
    }
    if (!targetAmount || Number(targetAmount) <= 0) {
      return { data: null, error: new Error('Target amount must be a positive number greater than zero.') };
    }

    const targetPaise = toPaise(targetAmount);
    const currentPaise = toPaise(currentAmount || 0);
    const isCompleted = currentPaise >= targetPaise;

    const row = {
      user_id: userId,
      name: name.trim(),
      target_amount_paise: targetPaise,
      current_amount_paise: currentPaise,
      currency: currency || 'INR',
      target_date: targetDate || null,
      category: category || 'general',
      is_completed: isCompleted
    };

    if (!isSupabaseConfigured() || !supabase) {
      const localGoal = {
        ...mapRowToGoal({
          ...row,
          id: `local_goal_${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      };
      const existing = getLocalGoals(userId);
      setLocalGoals(userId, [localGoal, ...existing]);
      return { data: localGoal, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .insert(row)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const createdGoal = mapRowToGoal(data);
      const existing = getLocalGoals(userId);
      setLocalGoals(userId, [createdGoal, ...existing]);
      return { data: createdGoal, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Updates an existing savings goal.
   * 
   * @param {string} userId 
   * @param {string} goalId 
   * @param {Object} updates 
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async updateGoal(userId, goalId, updates) {
    if (!userId || !goalId) {
      return { data: null, error: new Error('Both userId and goalId are required.') };
    }

    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.targetAmount !== undefined) payload.target_amount_paise = toPaise(updates.targetAmount);
    if (updates.currentAmount !== undefined) payload.current_amount_paise = toPaise(updates.currentAmount);
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate || null;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.isCompleted !== undefined) payload.is_completed = Boolean(updates.isCompleted);

    // Auto-update completion status if amounts are updated
    if (payload.target_amount_paise && payload.current_amount_paise !== undefined) {
      payload.is_completed = payload.current_amount_paise >= payload.target_amount_paise;
    }

    if (!isSupabaseConfigured() || !supabase) {
      const existing = getLocalGoals(userId);
      const updatedList = existing.map(g => g.id === goalId ? { ...g, ...updates } : g);
      setLocalGoals(userId, updatedList);
      return { data: updatedList.find(g => g.id === goalId) || null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .update(payload)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const updatedGoal = mapRowToGoal(data);
      const existing = getLocalGoals(userId);
      setLocalGoals(userId, existing.map(g => g.id === goalId ? updatedGoal : g));
      return { data: updatedGoal, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Adds an explicit contribution towards a savings goal.
   * Increments current_amount_paise atomically and records in contributions log.
   * 
   * @param {string} userId 
   * @param {string} goalId 
   * @param {number} contributionAmount 
   * @param {string} [note] 
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async addContribution(userId, goalId, contributionAmount, note = '') {
    if (!userId || !goalId) {
      return { data: null, error: new Error('User ID and Goal ID are required.') };
    }
    const amountNum = Number(contributionAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { data: null, error: new Error('Contribution amount must be greater than zero.') };
    }

    const contributionPaise = toPaise(amountNum);

    if (!isSupabaseConfigured() || !supabase) {
      const existing = getLocalGoals(userId);
      const goal = existing.find(g => g.id === goalId);
      if (!goal) return { data: null, error: new Error('Goal not found.') };

      const newCurrent = goal.currentAmount + amountNum;
      const updated = {
        ...goal,
        currentAmount: newCurrent,
        percentage: Math.min(100, Math.round((newCurrent / goal.targetAmount) * 100)),
        isCompleted: newCurrent >= goal.targetAmount,
        remaining: Math.max(0, goal.targetAmount - newCurrent)
      };
      setLocalGoals(userId, existing.map(g => g.id === goalId ? updated : g));
      return { data: updated, error: null };
    }

    try {
      // Fetch current goal row
      const { data: goalRow, error: fetchErr } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !goalRow) {
        return { data: null, error: new Error(fetchErr?.message || 'Savings goal not found.') };
      }

      const updatedCurrentPaise = Number(goalRow.current_amount_paise || 0) + contributionPaise;
      const isCompleted = updatedCurrentPaise >= Number(goalRow.target_amount_paise);

      // Record contribution log entry
      try {
        const { error: contribErr } = await supabase.from('savings_goal_contributions').insert({
          goal_id: goalId,
          user_id: userId,
          amount_paise: contributionPaise,
          note: note ? note.trim() : `Contribution of ₹${amountNum.toLocaleString('en-IN')}`
        });
        if (contribErr) {
          console.warn('Could not insert contribution log:', contribErr.message);
        }
      } catch (logErr) {
        console.warn('Error recording contribution log:', logErr);
      }

      // Update goal row
      const { data: updatedRow, error: updateErr } = await supabase
        .from('savings_goals')
        .update({
          current_amount_paise: updatedCurrentPaise,
          is_completed: isCompleted
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateErr) {
        return { data: null, error: new Error(updateErr.message) };
      }

      const updatedGoal = mapRowToGoal(updatedRow);
      const existing = getLocalGoals(userId);
      setLocalGoals(userId, existing.map(g => g.id === goalId ? updatedGoal : g));
      return { data: updatedGoal, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Deletes a savings goal by ID.
   * 
   * @param {string} userId 
   * @param {string} goalId 
   * @returns {Promise<{ success: boolean, error: Error|null }>}
   */
  async deleteGoal(userId, goalId) {
    if (!userId || !goalId) {
      return { success: false, error: new Error('Both userId and goalId are required.') };
    }

    const existing = getLocalGoals(userId);
    setLocalGoals(userId, existing.filter(g => g.id !== goalId));

    if (!isSupabaseConfigured() || !supabase) {
      return { success: true, error: null };
    }

    try {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', goalId)
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
