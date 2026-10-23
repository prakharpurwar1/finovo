/**
 * Finovo User-Defined Category Rules Service
 * Data access layer for smart categorisation rules.
 * 
 * Multi-Tenant Isolation & Resiliency:
 * - Backed by Supabase PostgreSQL `public.category_rules` with RLS.
 * - Local fallback and cache scoped strictly per authenticated user (`finovo_rules_${userId}`).
 * - Ensures account switching clears or reloads active user's rules without data leakage.
 * - Supports editing, enabling/disabling (isActive), transaction-type scoping, and precedence ranking.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';

const memoryStore = new Map();

export function getSafeStorage() {
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
  return `finovo_rules_${userId}`;
}

export function getLocalRules(userId) {
  if (!userId) return [];
  try {
    const storage = getSafeStorage();
    const raw = storage.getItem(getLocalKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading local category rules:', e);
    return [];
  }
}

export function setLocalRules(userId, rules) {
  if (!userId) return;
  try {
    const storage = getSafeStorage();
    storage.setItem(getLocalKey(userId), JSON.stringify(rules));
  } catch (e) {
    console.warn('Error saving local category rules:', e);
  }
}

export function mapRowToRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    merchantPattern: row.merchant_pattern,
    categoryName: row.category_name,
    categoryId: row.category_id || null,
    matchType: row.match_type || 'exact',
    transactionType: row.transaction_type || 'all',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Sorts category rules by deterministic precedence:
 * 1. Active rules before inactive rules.
 * 2. Specificity: Exact (highest) > Contains > Regex.
 * 3. For Contains: longer (more specific) merchant patterns first.
 * 4. Deterministic tie-breaker: newest updated or created first.
 * @param {Array<Object>} rules 
 * @returns {Array<Object>}
 */
export function sortRulesByPrecedence(rules) {
  if (!Array.isArray(rules)) return [];
  return [...rules].sort((a, b) => {
    // 1. Active rules come before inactive rules
    const activeA = a.isActive !== false;
    const activeB = b.isActive !== false;
    if (activeA !== activeB) {
      return activeA ? -1 : 1;
    }

    // 2. Specificity rank by matchType
    const typeRank = { exact: 3, contains: 2, regex: 1 };
    const rankA = typeRank[a.matchType] || 2;
    const rankB = typeRank[b.matchType] || 2;
    if (rankA !== rankB) {
      return rankB - rankA;
    }

    // 3. For contains matches: longer merchant pattern is more specific
    if (a.matchType === 'contains' && b.matchType === 'contains') {
      const lenA = (a.merchantPattern || '').trim().length;
      const lenB = (b.merchantPattern || '').trim().length;
      if (lenA !== lenB) {
        return lenB - lenA; // longer pattern first
      }
    }

    // 4. Deterministic tie-breaker: newest first
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

export const categoryRuleService = {
  /**
   * Fetches all custom rules for the authenticated user sorted by precedence.
   * @param {string} userId 
   * @returns {Promise<{ data: Array<Object>, error: Error|null }>}
   */
  async fetchUserRules(userId) {
    if (!userId) {
      return { data: [], error: new Error('User ID is required to fetch category rules.') };
    }

    const localRules = sortRulesByPrecedence(getLocalRules(userId));

    if (!isSupabaseConfigured() || !supabase) {
      return { data: localRules, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('category_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to local storage if remote table is not yet migrated
        return { data: localRules, error: null };
      }

      const remoteRules = sortRulesByPrecedence((data || []).map(mapRowToRule));
      if (remoteRules.length > 0) {
        setLocalRules(userId, remoteRules);
        return { data: remoteRules, error: null };
      }
      return { data: localRules, error: null };
    } catch (err) {
      console.warn('Network error fetching category rules, falling back to local cache:', err);
      return { data: localRules, error: null };
    }
  },

  /**
   * Creates a user-defined rule for a merchant pattern.
   * @param {string} userId 
   * @param {Object} ruleData 
   * @param {string} ruleData.merchantPattern 
   * @param {string} ruleData.categoryName 
   * @param {'exact'|'contains'|'regex'} [ruleData.matchType='exact'] 
   * @param {'all'|'expense'|'income'} [ruleData.transactionType='all']
   * @param {boolean} [ruleData.isActive=true]
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async createUserRule(userId, { 
    merchantPattern, 
    categoryName, 
    matchType = 'exact',
    transactionType = 'all',
    isActive = true 
  }) {
    if (!userId) {
      return { data: null, error: new Error('User ID is required.') };
    }
    if (!merchantPattern || !merchantPattern.trim()) {
      return { data: null, error: new Error('Merchant pattern is required.') };
    }
    if (!categoryName || !categoryName.trim()) {
      return { data: null, error: new Error('Category name is required.') };
    }

    const trimmedPattern = merchantPattern.trim();
    const trimmedCategory = categoryName.trim();

    const localRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      merchantPattern: trimmedPattern,
      categoryName: trimmedCategory,
      matchType,
      transactionType,
      isActive: Boolean(isActive),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update local cache immediately
    const existingRules = getLocalRules(userId);
    // Remove any existing rule with same pattern to avoid conflict
    const filteredRules = existingRules.filter(
      r => r.merchantPattern.toLowerCase() !== trimmedPattern.toLowerCase()
    );
    const updatedLocal = sortRulesByPrecedence([localRule, ...filteredRules]);
    setLocalRules(userId, updatedLocal);

    if (!isSupabaseConfigured() || !supabase) {
      return { data: localRule, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('category_rules')
        .upsert(
          {
            user_id: userId,
            merchant_pattern: trimmedPattern,
            category_name: trimmedCategory,
            match_type: matchType,
            transaction_type: transactionType,
            is_active: Boolean(isActive)
          },
          { onConflict: 'user_id, merchant_pattern' }
        )
        .select()
        .single();

      if (error) {
        console.warn('Remote rule upsert notice (persisted in local session):', error.message);
        return { data: localRule, error: null };
      }

      const remoteMapped = mapRowToRule(data);
      // Replace temporary ID with database ID
      const synced = sortRulesByPrecedence(
        updatedLocal.map(r => 
          r.merchantPattern.toLowerCase() === trimmedPattern.toLowerCase() ? remoteMapped : r
        )
      );
      setLocalRules(userId, synced);
      return { data: remoteMapped, error: null };
    } catch (err) {
      console.warn('Network error persisting rule to Supabase:', err);
      return { data: localRule, error: null };
    }
  },

  /**
   * Updates an existing user rule.
   * @param {string} userId 
   * @param {string} ruleId 
   * @param {Object} updates 
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async updateUserRule(userId, ruleId, updates = {}) {
    if (!userId || !ruleId) {
      return { data: null, error: new Error('User ID and Rule ID are required.') };
    }

    const existingRules = getLocalRules(userId);
    const targetRuleIndex = existingRules.findIndex(r => r.id === ruleId);

    if (targetRuleIndex === -1) {
      return { data: null, error: new Error('Rule not found.') };
    }

    const currentRule = existingRules[targetRuleIndex];
    const updatedRule = {
      ...currentRule,
      ...updates,
      merchantPattern: updates.merchantPattern ? updates.merchantPattern.trim() : currentRule.merchantPattern,
      categoryName: updates.categoryName ? updates.categoryName.trim() : currentRule.categoryName,
      matchType: updates.matchType || currentRule.matchType,
      transactionType: updates.transactionType || currentRule.transactionType || 'all',
      isActive: updates.isActive !== undefined ? Boolean(updates.isActive) : currentRule.isActive,
      updatedAt: new Date().toISOString()
    };

    existingRules[targetRuleIndex] = updatedRule;
    const sortedLocal = sortRulesByPrecedence(existingRules);
    setLocalRules(userId, sortedLocal);

    if (!isSupabaseConfigured() || !supabase) {
      return { data: updatedRule, error: null };
    }

    try {
      const dbUpdates = {
        updated_at: new Date().toISOString()
      };
      if (updates.merchantPattern !== undefined) dbUpdates.merchant_pattern = updates.merchantPattern.trim();
      if (updates.categoryName !== undefined) dbUpdates.category_name = updates.categoryName.trim();
      if (updates.matchType !== undefined) dbUpdates.match_type = updates.matchType;
      if (updates.transactionType !== undefined) dbUpdates.transaction_type = updates.transactionType;
      if (updates.isActive !== undefined) dbUpdates.is_active = Boolean(updates.isActive);

      const { data, error } = await supabase
        .from('category_rules')
        .update(dbUpdates)
        .eq('id', ruleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.warn('Remote rule update notice (saved locally):', error.message);
        return { data: updatedRule, error: null };
      }

      return { data: mapRowToRule(data), error: null };
    } catch (err) {
      console.warn('Network error updating rule:', err);
      return { data: updatedRule, error: null };
    }
  },

  /**
   * Toggles active state of a user rule.
   * @param {string} userId 
   * @param {string} ruleId 
   * @returns {Promise<{ data: Object|null, error: Error|null }>}
   */
  async toggleUserRule(userId, ruleId) {
    const existingRules = getLocalRules(userId);
    const rule = existingRules.find(r => r.id === ruleId);
    if (!rule) {
      return { data: null, error: new Error('Rule not found.') };
    }
    return this.updateUserRule(userId, ruleId, { isActive: !rule.isActive });
  },

  /**
   * Deletes a user rule.
   * @param {string} userId 
   * @param {string} ruleId 
   * @returns {Promise<{ success: boolean, error: Error|null }>}
   */
  async deleteUserRule(userId, ruleId) {
    if (!userId || !ruleId) {
      return { success: false, error: new Error('User ID and Rule ID are required.') };
    }

    // Update local cache
    const existingRules = getLocalRules(userId);
    const updated = existingRules.filter(r => r.id !== ruleId);
    setLocalRules(userId, updated);

    if (!isSupabaseConfigured() || !supabase) {
      return { success: true, error: null };
    }

    try {
      const { error } = await supabase
        .from('category_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        console.warn('Remote rule delete error:', error.message);
      }
      return { success: true, error: null };
    } catch (err) {
      console.warn('Network error deleting rule:', err);
      return { success: true, error: null };
    }
  },

  sortRulesByPrecedence
};
