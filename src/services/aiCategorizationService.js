/**
 * Finovo AI Categorization Client Service
 * Dispatches secure categorization requests to the server-side endpoint (/api/categorize).
 * 
 * Features:
 * - Client-side session token forwarding (never exposes Gemini API key).
 * - In-memory client caching to avoid duplicate requests for identical input.
 * - Request cancellation & timeout management.
 * - Handles offline, unavailable, rate-limit, and timeout errors gracefully.
 */

import { getCurrentSession } from '../lib/supabaseClient.js';

// In-memory client cache: key -> { suggestion, timestamp }
const aiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates cache key for a transaction tuple.
 * @param {string} transactionType 
 * @param {string} merchant 
 * @param {string} description 
 * @returns {string}
 */
export function getAiCacheKey(transactionType, merchant, description) {
  const normType = (transactionType || 'expense').toLowerCase().trim();
  const normMerchant = (merchant || '').toLowerCase().trim();
  const normDesc = (description || '').toLowerCase().trim();
  return `${normType}:::${normMerchant}:::${normDesc}`;
}

/**
 * Requests AI categorization from the server endpoint /api/categorize.
 * 
 * @param {Object} params
 * @param {string} [params.merchant]
 * @param {string} [params.description]
 * @param {'expense'|'income'} [params.transactionType='expense']
 * @param {Array<Object|string>} params.allowedCategories
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{
 *   available: boolean,
 *   success: boolean,
 *   suggestion?: Object,
 *   error?: string,
 *   rateLimited?: boolean,
 *   fromCache?: boolean
 * }>}
 */
export async function requestAiCategorization({
  merchant = '',
  description = '',
  transactionType = 'expense',
  allowedCategories = [],
  signal = null,
  enabled = true
}) {
  // Check user privacy preference
  let isAiEnabled = enabled !== false;
  if (isAiEnabled && typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem('finovo_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.aiCategorizationEnabled === false) {
          isAiEnabled = false;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!isAiEnabled) {
    return {
      available: false,
      success: false,
      disabledByUser: true,
      suggestion: null,
      error: 'AI categorisation is disabled in your Privacy settings.'
    };
  }

  const trimmedMerchant = merchant.trim();
  const trimmedDesc = description.trim();

  // If neither merchant nor description has text, nothing to categorize
  if (!trimmedMerchant && !trimmedDesc) {
    return {
      available: true,
      success: false,
      suggestion: null,
      error: 'Please provide a merchant name or description to categorize.'
    };
  }

  // 1. Check in-memory client cache
  const cacheKey = getAiCacheKey(transactionType, trimmedMerchant, trimmedDesc);
  const cached = aiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return {
      available: true,
      success: true,
      suggestion: cached.suggestion,
      fromCache: true
    };
  }

  // 2. Retrieve verified user session token
  const { data: { session } } = await getCurrentSession();
  const token = session?.access_token;

  if (!token) {
    return {
      available: false,
      success: false,
      suggestion: null,
      error: 'You must be signed in to use AI categorisation.'
    };
  }

  // 3. Extract names for allowed categories
  const categoryNames = allowedCategories.map(c => 
    typeof c === 'string' ? c : (c.name || c.id)
  );

  // 4. Timeout controller (10s threshold)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch('/api/categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        merchant: trimmedMerchant,
        description: trimmedDesc,
        transactionType,
        allowedCategories: categoryNames
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return {
        available: false,
        success: false,
        suggestion: null,
        error: 'Your session has expired. Please sign in again.'
      };
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      return {
        available: true,
        success: false,
        suggestion: null,
        rateLimited: true,
        error: data.error || 'Rate limit reached. Please wait a moment before trying again.'
      };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        available: true,
        success: false,
        suggestion: null,
        error: data.error || `Server returned error (${response.status}).`
      };
    }

    const data = await response.json();

    if (!data.available) {
      return {
        available: false,
        success: false,
        suggestion: null,
        error: data.error || 'AI categorisation service is currently unconfigured or unavailable.'
      };
    }

    if (!data.success || !data.suggestion) {
      return {
        available: true,
        success: false,
        suggestion: null,
        error: data.error || 'AI could not confidently categorize this transaction.'
      };
    }

    // Cache successful suggestion
    aiCache.set(cacheKey, {
      suggestion: data.suggestion,
      timestamp: Date.now()
    });

    return {
      available: true,
      success: true,
      suggestion: data.suggestion,
      model: data.model,
      provider: data.provider
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        available: true,
        success: false,
        suggestion: null,
        error: 'AI categorisation request timed out. Please try again.'
      };
    }
    return {
      available: true,
      success: false,
      suggestion: null,
      error: 'Network error communicating with AI categorization endpoint.'
    };
  }
}

/**
 * Clears in-memory client cache.
 */
export function clearAiCache() {
  aiCache.clear();
}
