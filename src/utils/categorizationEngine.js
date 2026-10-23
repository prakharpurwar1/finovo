/**
 * Finovo Smart Rule-Based Transaction Categorisation Engine
 * Pure, UI-independent module for deterministic categorization.
 * 
 * Precedence Pipeline:
 * 1. User-Defined Rules (Highest precedence, Confidence: HIGH / 1.0)
 * 2. Canonical / Known Merchant Dictionary (Confidence: HIGH / 0.95)
 * 3. Merchant Alias / Substring Match with Word Boundaries (Confidence: MEDIUM / 0.85)
 * 4. Contextual Keyword Rules in Description / Notes (Confidence: MEDIUM / 0.70)
 * 5. Ambiguous / Conflicting Keyword Matches (Confidence: LOW / 0.40, Review Required)
 * 6. Default Fallback (Confidence: NONE / 0.0, Review Required)
 * 
 * Safety & Integrity:
 * - Normalized tokens, word boundaries to prevent false substring matches (e.g. "bar" in "embarrassing").
 * - Strict type separation: expenses only map to expense categories, income only maps to income categories.
 * - Does not infer category from monetary amount alone.
 */

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  NONE: 'NONE'
};

export const MATCH_METHODS = {
  USER_RULE: 'USER_RULE',
  EXACT_MERCHANT: 'EXACT_MERCHANT',
  ALIAS_MERCHANT: 'ALIAS_MERCHANT',
  KEYWORD_RULE: 'KEYWORD_RULE',
  AMBIGUOUS_KEYWORD: 'AMBIGUOUS_KEYWORD',
  DEFAULT_FALLBACK: 'DEFAULT_FALLBACK'
};

/**
 * Normalizes text for robust comparison.
 * Lowercases, strips punctuation, normalizes whitespace.
 * @param {string} text 
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a search term matches within text using word boundaries.
 * Prevents "cat" matching "scatter", or "bar" matching "embarrassing".
 * @param {string} normalizedText 
 * @param {string} normalizedKeyword 
 * @returns {boolean}
 */
export function matchesWordBoundary(normalizedText, normalizedKeyword) {
  if (!normalizedText || !normalizedKeyword) return false;
  // If exact match
  if (normalizedText === normalizedKeyword) return true;
  
  // Word boundary regex
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
  return regex.test(normalizedText);
}

// ==============================================================================
// CANONICAL MERCHANT DICTIONARIES (Expense & Income)
// ==============================================================================

export const CANONICAL_MERCHANTS_EXPENSE = {
  Food: [
    'swiggy', 'zomato', 'mcdonalds', 'kfc', 'burger king', 'dominos', 'pizza hut',
    'starbucks', 'subway', 'eatclub', 'faasos', 'behrouz', 'haldirams', 'chai point',
    'chaayos', 'bikanervala', 'barbeque nation', 'box8', 'mojo pizza', 'wendys',
    'dunkin', 'cafe coffee day', 'tim hortons', 'taco bell', 'baskin robbins',
    'biryani by kilo', 'sweet truth', 'wow momo', 'theobroma', 'costa coffee',
    'krispy kreme', 'rebel foods', 'smoke house deli', 'mainland china'
  ],
  Groceries: [
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'natures basket',
    'jiomart', 'spencers', 'more retail', 'reliance fresh', 'star bazaar',
    'milk basket', 'country delight', 'bb daily', 'dunzo daily', 'otipy',
    'namdhari', 'grofers', 'spar hypermarket', 'modern bazaar'
  ],
  Travel: [
    'uber', 'ola', 'rapido', 'namma yatri', 'blusmart', 'irctc', 'makemytrip',
    'cleartrip', 'redbus', 'abhibus', 'indigo', 'air india', 'spicejet', 'vistara',
    'akasa air', 'fastag', 'toll', 'ixigo', 'yatra', 'goibibo', 'easemytrip',
    'metro recharge', 'delhi metro', 'bmtc', 'best bus', 'chalo app', 'zoomcar'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'tata cliq',
    'zara', 'h&m', 'hm', 'uniqlo', 'croma', 'vijay sales', 'reliance digital',
    'apple store', 'decathlon', 'shoppers stop', 'lifestyle', 'westside',
    'marks and spencer', 'pantaloons', 'ikea', 'urban ladder', 'pepperfry',
    'lenskart', 'titan', 'fastrack', 'zivame', 'bewakoof', 'snitch', 'boat lifestyle'
  ],
  Recharge: [
    'airtel', 'jio', 'vodafone', 'vi prepaid', 'vi postpaid', 'bescom', 'tata power',
    'adani electricity', 'torrent power', 'bses rajdhani', 'bses yamuna', 'igl',
    'mahanagar gas', 'act fibernet', 'hathway', 'airtel dth', 'tata play', 'dish tv',
    'sun direct', 'excitel', 'spectranet'
  ],
  Subscriptions: [
    'netflix', 'spotify', 'youtube premium', 'amazon prime', 'disney hotstar',
    'hotstar', 'apple services', 'icloud', 'google one', 'chatgpt', 'openai',
    'github', 'sonyliv', 'zee5', 'jiocinema', 'audible', 'kindle unlimited',
    'medium membership', 'crunchyroll', 'playstation plus', 'xbox game pass',
    'notion', 'canva', 'adobe', 'figma'
  ],
  Medicine: [
    'apollo pharmacy', 'netmeds', 'tata 1mg', '1mg', 'pharmeasy', 'medplus',
    'practo', 'dr lal pathlabs', 'max healthcare', 'fortis', 'apollo clinic',
    'pathkind', 'metropolis', 'manipal hospital', 'narayana hrudayalaya',
    'guardian pharmacy', 'wellness forever'
  ],
  Entertainment: [
    'bookmyshow', 'pvr', 'inox', 'cinepolis', 'steam games', 'playstation network',
    'nintendo', 'epic games', 'smaash', 'timezone', 'wonderla', 'imagicaa'
  ],
  Education: [
    'coursera', 'udemy', 'edx', 'upgrad', 'unacademy', 'byjus', 'skillshare',
    'duolingo', 'khan academy', 'codecademy', 'simplilearn', 'physics wallah',
    'allen career', 'resonance'
  ],
  Rent: [
    'nobroker', 'nestaway', 'housing com', 'magicbricks', '99acres',
    'cred rent', 'mygate society', 'nobrokerhood'
  ]
};

export const CANONICAL_MERCHANTS_INCOME = {
  Salary: [
    'salary credit', 'monthly salary', 'payroll', 'infosys payroll', 'tcs salary',
    'wipro salary', 'google direct deposit', 'microsoft payroll', 'accenture salary',
    'amazon pay corporate', 'deloitte salary', 'cognizant payroll'
  ],
  Freelance: [
    'upwork', 'fiverr', 'toptal', 'freelancer', 'stripe payout', 'razorpay payout',
    'paypal payout', 'client retainer', 'consulting payout', 'gumroad'
  ],
  Investments: [
    'zerodha', 'groww', 'angel one', 'upstox', 'kuvera', 'coin by zerodha',
    'indmoney', 'mutual fund dividend', 'stock dividend', 'interest credit',
    'fixed deposit interest', 'sbi interest', 'hdfc interest', 'icici interest'
  ],
  Refunds: [
    'amazon refund', 'flipkart refund', 'swiggy refund', 'zomato refund',
    'irctc refund', 'upi reversal', 'merchant reversal', 'cashback reward',
    'cred cashback', 'google pay reward'
  ]
};

// ==============================================================================
// CONTEXTUAL KEYWORD DICTIONARIES (Unambiguous semantic terms)
// ==============================================================================

export const KEYWORDS_EXPENSE = {
  Food: [
    'food', 'lunch', 'dinner', 'breakfast', 'brunch', 'cafe', 'restaurant',
    'bakery', 'coffee', 'tea', 'bistro', 'diner', 'snacks', 'shawarma',
    'burger', 'pizza', 'biryani', 'dessert', 'ice cream', 'dhaba', 'sweets'
  ],
  Groceries: [
    'grocery', 'groceries', 'vegetables', 'fruits', 'supermarket', 'mart',
    'kirana', 'dairy', 'milk', 'eggs', 'bread', 'provisions', 'spices'
  ],
  Travel: [
    'cab', 'taxi', 'auto', 'ride', 'travel', 'trip', 'flight', 'airline',
    'train', 'bus ticket', 'metro fare', 'tollway', 'toll tax', 'petrol',
    'diesel', 'fuel pump', 'cng', 'parking'
  ],
  Shopping: [
    'shopping', 'clothes', 'clothing', 'apparel', 'shoes', 'footwear',
    'electronics', 'laptop', 'mobile phone', 'gadget', 'furniture', 'decor',
    'handbag', 'watch', 'perfume', 'cosmetics', 'store purchase'
  ],
  Recharge: [
    'recharge', 'mobile bill', 'electricity bill', 'water bill', 'broadband',
    'wifi bill', 'cylinder', 'gas bill', 'dth recharge', 'power bill'
  ],
  Subscriptions: [
    'subscription', 'membership', 'monthly plan', 'annual plan', 'renew',
    'premium sub', 'cloud storage', 'saas'
  ],
  Medicine: [
    'medicine', 'medicines', 'medical', 'pharmacy', 'chemist', 'hospital',
    'clinic', 'doctor fee', 'consultation fee', 'diagnostic', 'blood test',
    'tablets', 'syrup'
  ],
  Entertainment: [
    'movie', 'cinema', 'theatre', 'concert', 'gaming', 'arcade',
    'amusement', 'show tickets'
  ],
  Education: [
    'tuition', 'school fee', 'college fee', 'course', 'exam fee', 'books',
    'stationery', 'coaching', 'training fee', 'certification'
  ],
  Rent: [
    'rent', 'house rent', 'apartment rent', 'society maintenance', 'flat rent',
    'landlord', 'room rent'
  ]
};

export const KEYWORDS_INCOME = {
  Salary: [
    'salary', 'payroll', 'stipend', 'wages', 'compensation', 'bonus',
    'annual bonus', 'appraisal bonus'
  ],
  Freelance: [
    'freelance', 'client payment', 'contract payment', 'consulting fee',
    'project milestone', 'retainer'
  ],
  Investments: [
    'dividend', 'interest', 'fd interest', 'mf redemption', 'stocks sale',
    'profit booking', 'capital gain', 'crypto payout'
  ],
  Refunds: [
    'refund', 'reversal', 'cashback', 'chargeback', 'credit reversal',
    'claim settled'
  ]
};

// ==============================================================================
// CORE CATEGORISATION ENGINE FUNCTION
// ==============================================================================

/**
 * Predicts the most accurate category for a transaction based on rule hierarchy.
 * 
 * @param {Object} params
 * @param {'expense'|'income'} [params.transactionType='expense']
 * @param {string} [params.merchant='']
 * @param {string} [params.description='']
 * @param {Array<Object>} [params.userRules=[]]
 * @param {Array<Object|string>} [params.availableCategories=[]]
 * @returns {Object} Structured suggestion result
 */
export function suggestCategory({
  transactionType = 'expense',
  merchant = '',
  description = '',
  userRules = [],
  availableCategories = []
}) {
  const normMerchant = normalizeText(merchant);
  const normDesc = normalizeText(description);
  const combinedText = `${normMerchant} ${normDesc}`.trim();

  // Helper to extract category name from list or string
  const getAvailableCategoryName = (targetName) => {
    if (!availableCategories || availableCategories.length === 0) return targetName;
    const found = availableCategories.find(c => {
      const name = typeof c === 'string' ? c : (c.name || c.id || '');
      return name.toLowerCase() === targetName.toLowerCase();
    });
    if (found) {
      return typeof found === 'string' ? found : found.name;
    }
    // If not found in available, return targetName directly
    return targetName;
  };

  const defaultCategory = transactionType === 'income' ? 'Others' : 'Others';

  // Return fallback if input is completely empty
  if (!normMerchant && !normDesc) {
    return {
      categoryId: defaultCategory.toLowerCase(),
      categoryName: defaultCategory,
      confidenceLevel: CONFIDENCE_LEVELS.NONE,
      confidenceScore: 0.0,
      matchMethod: MATCH_METHODS.DEFAULT_FALLBACK,
      explanation: 'No merchant or description provided to categorize.',
      reviewRecommended: true
    };
  }

  // ----------------------------------------------------------------------------
  // STAGE 1: User-Defined Rules (Highest Precedence)
  // ----------------------------------------------------------------------------
  if (Array.isArray(userRules) && userRules.length > 0) {
    // 1. Filter to active rules compatible with transactionType
    const activeRules = userRules.filter(r => {
      if (!r || !r.merchantPattern || !r.categoryName) return false;
      if (r.isActive === false) return false;
      if (r.transactionType && r.transactionType !== 'all' && r.transactionType !== transactionType) {
        return false;
      }
      return true;
    });

    const matches = [];

    for (const rule of activeRules) {
      const normPattern = normalizeText(rule.merchantPattern);
      if (!normPattern) continue;

      let isMatch = false;
      const matchType = rule.matchType || 'exact';

      if (matchType === 'exact') {
        isMatch = (normMerchant === normPattern);
      } else if (matchType === 'contains') {
        isMatch = matchesWordBoundary(normMerchant, normPattern) || 
                  matchesWordBoundary(normDesc, normPattern);
      } else if (matchType === 'regex') {
        try {
          const regex = new RegExp(rule.merchantPattern, 'i');
          isMatch = regex.test(merchant) || regex.test(description);
        } catch {
          isMatch = false;
        }
      }

      if (isMatch) {
        // Specificity score: exact = 300, contains = 200 + patternLength, regex = 100
        let specificity = 100;
        if (matchType === 'exact') specificity = 300;
        else if (matchType === 'contains') specificity = 200 + normPattern.length;

        matches.push({ rule, specificity });
      }
    }

    if (matches.length > 0) {
      // Sort matches by specificity descending
      matches.sort((a, b) => b.specificity - a.specificity);

      const topMatch = matches[0];
      const distinctCategories = Array.from(new Set(matches.map(m => m.rule.categoryName.toLowerCase())));

      if (distinctCategories.length === 1) {
        // Unanimous match
        const resolvedName = getAvailableCategoryName(topMatch.rule.categoryName);
        return {
          categoryId: resolvedName.toLowerCase(),
          categoryName: resolvedName,
          confidenceLevel: CONFIDENCE_LEVELS.HIGH,
          confidenceScore: 1.0,
          matchMethod: MATCH_METHODS.USER_RULE,
          explanation: `Matched your custom rule for "${topMatch.rule.merchantPattern}".`,
          reviewRecommended: false
        };
      } else {
        // Multiple matching rules point to different categories (Conflict!)
        // If top match is strictly more specific (e.g. exact vs contains, or longer pattern)
        const secondMatch = matches[1];
        if (topMatch.specificity > secondMatch.specificity) {
          const resolvedName = getAvailableCategoryName(topMatch.rule.categoryName);
          return {
            categoryId: resolvedName.toLowerCase(),
            categoryName: resolvedName,
            confidenceLevel: CONFIDENCE_LEVELS.HIGH,
            confidenceScore: 0.95,
            matchMethod: MATCH_METHODS.USER_RULE,
            explanation: `Matched specific personal rule "${topMatch.rule.merchantPattern}" over broader rule "${secondMatch.rule.merchantPattern}".`,
            reviewRecommended: false
          };
        } else {
          // Equal specificity conflict: resolve deterministically to top match, but flag for review
          const resolvedName = getAvailableCategoryName(topMatch.rule.categoryName);
          return {
            categoryId: resolvedName.toLowerCase(),
            categoryName: resolvedName,
            confidenceLevel: CONFIDENCE_LEVELS.LOW,
            confidenceScore: 0.45,
            matchMethod: MATCH_METHODS.AMBIGUOUS_KEYWORD,
            explanation: `Conflicting personal rules found ("${topMatch.rule.merchantPattern}" -> ${topMatch.rule.categoryName} vs "${secondMatch.rule.merchantPattern}" -> ${secondMatch.rule.categoryName}). Review recommended.`,
            reviewRecommended: true
          };
        }
      }
    }
  }

  // Choose appropriate dictionary based on transaction type
  const merchantDict = transactionType === 'income' 
    ? CANONICAL_MERCHANTS_INCOME 
    : CANONICAL_MERCHANTS_EXPENSE;

  const keywordDict = transactionType === 'income' 
    ? KEYWORDS_INCOME 
    : KEYWORDS_EXPENSE;

  // ----------------------------------------------------------------------------
  // STAGE 2: Canonical / Known Merchant Exact Match (Confidence: 0.95)
  // ----------------------------------------------------------------------------
  if (normMerchant) {
    for (const [category, merchantList] of Object.entries(merchantDict)) {
      for (const canonical of merchantList) {
        if (normMerchant === canonical) {
          const resolvedName = getAvailableCategoryName(category);
          return {
            categoryId: resolvedName.toLowerCase(),
            categoryName: resolvedName,
            confidenceLevel: CONFIDENCE_LEVELS.HIGH,
            confidenceScore: 0.95,
            matchMethod: MATCH_METHODS.EXACT_MERCHANT,
            explanation: `Recognized merchant "${merchant.trim()}" as ${resolvedName}.`,
            reviewRecommended: false
          };
        }
      }
    }
  }

  // ----------------------------------------------------------------------------
  // STAGE 3: Merchant Alias / Substring Match with Word Boundaries (Confidence: 0.85)
  // ----------------------------------------------------------------------------
  if (normMerchant || normDesc) {
    for (const [category, merchantList] of Object.entries(merchantDict)) {
      for (const canonical of merchantList) {
        // Must match either merchant with boundary or description with boundary
        const matchesMerchant = matchesWordBoundary(normMerchant, canonical);
        const matchesDescription = matchesWordBoundary(normDesc, canonical);

        if (matchesMerchant || matchesDescription) {
          const resolvedName = getAvailableCategoryName(category);
          return {
            categoryId: resolvedName.toLowerCase(),
            categoryName: resolvedName,
            confidenceLevel: CONFIDENCE_LEVELS.MEDIUM,
            confidenceScore: 0.85,
            matchMethod: MATCH_METHODS.ALIAS_MERCHANT,
            explanation: `Identified known merchant brand "${canonical}" in transaction.`,
            reviewRecommended: false
          };
        }
      }
    }
  }

  // ----------------------------------------------------------------------------
  // STAGE 4: Contextual Keyword Matching & Ambiguity Resolution
  // ----------------------------------------------------------------------------
  const matchedCategories = [];

  for (const [category, keywords] of Object.entries(keywordDict)) {
    for (const kw of keywords) {
      if (matchesWordBoundary(combinedText, kw)) {
        matchedCategories.push({ category, keyword: kw });
        break; // Count once per category
      }
    }
  }

  if (matchedCategories.length === 1) {
    // Unambiguous keyword match
    const match = matchedCategories[0];
    const resolvedName = getAvailableCategoryName(match.category);
    return {
      categoryId: resolvedName.toLowerCase(),
      categoryName: resolvedName,
      confidenceLevel: CONFIDENCE_LEVELS.MEDIUM,
      confidenceScore: 0.70,
      matchMethod: MATCH_METHODS.KEYWORD_RULE,
      explanation: `Matched keyword "${match.keyword}" for ${resolvedName}.`,
      reviewRecommended: false
    };
  } else if (matchedCategories.length > 1) {
    // Ambiguous: multiple categories matched
    // Take the first matching category deterministically, but flag low confidence
    const primaryMatch = matchedCategories[0];
    const conflictNames = matchedCategories.map(m => m.category).join(', ');
    const resolvedName = getAvailableCategoryName(primaryMatch.category);

    return {
      categoryId: resolvedName.toLowerCase(),
      categoryName: resolvedName,
      confidenceLevel: CONFIDENCE_LEVELS.LOW,
      confidenceScore: 0.40,
      matchMethod: MATCH_METHODS.AMBIGUOUS_KEYWORD,
      explanation: `Conflicting keywords found (${conflictNames}). Manual review suggested.`,
      reviewRecommended: true
    };
  }

  // ----------------------------------------------------------------------------
  // STAGE 5: Default Fallback (No Match)
  // ----------------------------------------------------------------------------
  return {
    categoryId: defaultCategory.toLowerCase(),
    categoryName: defaultCategory,
    confidenceLevel: CONFIDENCE_LEVELS.NONE,
    confidenceScore: 0.0,
    matchMethod: MATCH_METHODS.DEFAULT_FALLBACK,
    explanation: 'Could not determine category with high confidence. Defaulted to Others.',
    reviewRecommended: true
  };
}
