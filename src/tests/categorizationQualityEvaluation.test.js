import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  suggestCategory, 
  CONFIDENCE_LEVELS, 
  MATCH_METHODS
} from '../utils/categorizationEngine.js';
import { categoryRuleService } from '../services/categoryRuleService.js';
import { transactionService } from '../services/transactionService.js';
import { requestAiCategorization } from '../services/aiCategorizationService.js';
import { classifyWithGemini } from '../server/aiCategorizer.js';

/**
 * Phase 5C Quality Evaluation Suite
 * 
 * Measures:
 * 1. Rule-based categorisation accuracy on a standard 40-item fictional dataset.
 * 2. Invalid or out-of-taxonomy detection and sanitisation.
 * 3. Unknown-merchant handling and review recommendation.
 * 4. User-defined merchant rule specificity and deterministic conflict resolution.
 * 5. Inactive / disabled rule exclusion.
 * 6. Historical recategorisation candidate identification and manual override preservation.
 * 7. AI privacy gating when disabled by user preference.
 * 8. Fallback behaviour when external provider is unavailable or returns errors.
 */

// 40 Fictional and representative merchant test fixture
const QUALITY_FIXTURE = [
  // Food
  { description: 'Haldiram Sweets Connaught Place', type: 'expense', expectedCategory: 'Food' },
  { description: 'Dominos Pizza Online Order', type: 'expense', expectedCategory: 'Food' },
  { description: 'Blue Tokai Coffee Roasters Saket', type: 'expense', expectedCategory: 'Food' },
  { description: 'Starbucks Coffee Aerocity', type: 'expense', expectedCategory: 'Food' },
  { description: 'Subway Sandwiches CyberHub', type: 'expense', expectedCategory: 'Food' },
  // Groceries
  { description: 'Blinkit Instant Delivery Gurgaon', type: 'expense', expectedCategory: 'Groceries' },
  { description: 'Zepto Quick Commerce Indiranagar', type: 'expense', expectedCategory: 'Groceries' },
  { description: 'BigBasket Fresh Daily Market', type: 'expense', expectedCategory: 'Groceries' },
  { description: 'Nature Basket Supermarket Bandra', type: 'expense', expectedCategory: 'Groceries' },
  { description: 'D-Mart Hypermarket Thane', type: 'expense', expectedCategory: 'Groceries' },
  // Travel
  { description: 'Uber India Technology Rides', type: 'expense', expectedCategory: 'Travel' },
  { description: 'Ola Cabs Trip Bangalore', type: 'expense', expectedCategory: 'Travel' },
  { description: 'IRCTC Train Ticket E-Catering', type: 'expense', expectedCategory: 'Travel' },
  { description: 'MakeMyTrip Air Flight Booking', type: 'expense', expectedCategory: 'Travel' },
  { description: 'Rapido Bike Taxi Delhi', type: 'expense', expectedCategory: 'Travel' },
  // Shopping
  { description: 'Amazon India Marketplace Retail', type: 'expense', expectedCategory: 'Shopping' },
  { description: 'Flipkart Internet Pvt Ltd', type: 'expense', expectedCategory: 'Shopping' },
  { description: 'Myntra Fashion App Bangalore', type: 'expense', expectedCategory: 'Shopping' },
  { description: 'Zara Retail Store Promenade', type: 'expense', expectedCategory: 'Shopping' },
  { description: 'Decathlon Sports India Ansal', type: 'expense', expectedCategory: 'Shopping' },
  // Recharge
  { description: 'Airtel Prepaid Mobile Recharge', type: 'expense', expectedCategory: 'Recharge' },
  { description: 'Jio Fiber Broadband Payment', type: 'expense', expectedCategory: 'Recharge' },
  { description: 'Tata Power Electricity Bill Discom', type: 'expense', expectedCategory: 'Recharge' },
  { description: 'Bescom Bangalore Electricity Utility', type: 'expense', expectedCategory: 'Recharge' },
  { description: 'Indane Gas Cylinder Booking HPCL', type: 'expense', expectedCategory: 'Recharge' },
  // Subscriptions
  { description: 'Netflix Monthly Streaming Subscription', type: 'expense', expectedCategory: 'Subscriptions' },
  { description: 'Spotify Premium Family Plan', type: 'expense', expectedCategory: 'Subscriptions' },
  { description: 'YouTube Premium Membership Recurring', type: 'expense', expectedCategory: 'Subscriptions' },
  { description: 'iCloud Apple Storage Monthly Plan', type: 'expense', expectedCategory: 'Subscriptions' },
  { description: 'ChatGPT Plus OpenAI Monthly Sub', type: 'expense', expectedCategory: 'Subscriptions' },
  // Medicine
  { description: 'Apollo Pharmacy Retail South Ex', type: 'expense', expectedCategory: 'Medicine' },
  { description: '1mg Health Technologies Healthcare', type: 'expense', expectedCategory: 'Medicine' },
  { description: 'Netmeds Pharmacy Prescription Online', type: 'expense', expectedCategory: 'Medicine' },
  { description: 'Fortis Hospital Consultation Doctor Fee', type: 'expense', expectedCategory: 'Medicine' },
  // Entertainment
  { description: 'PVR Cinemas IMAX Multiplex Ticket', type: 'expense', expectedCategory: 'Entertainment' },
  { description: 'BookMyShow Live Events Booking', type: 'expense', expectedCategory: 'Entertainment' },
  // Education
  { description: 'Coursera Inc Online Technical Course', type: 'expense', expectedCategory: 'Education' },
  { description: 'Udemy Online Learning Training Fee', type: 'expense', expectedCategory: 'Education' },
  // Income
  { description: 'Tech Mahindra Monthly Salary Payroll', type: 'income', expectedCategory: 'Salary' },
  { description: 'Upwork Global Freelance Client Retainer', type: 'income', expectedCategory: 'Freelance' }
];

describe('Phase 5C — Quality Evaluation & System Accuracy Metrics', () => {

  it('measures rule-based categorisation accuracy on standard 40-item test fixture', () => {
    let correctCount = 0;
    const totalCount = QUALITY_FIXTURE.length;
    const failures = [];

    for (const item of QUALITY_FIXTURE) {
      const result = suggestCategory({
        merchant: item.description,
        transactionType: item.type,
        userRules: []
      });

      if (result.categoryName.toLowerCase() === item.expectedCategory.toLowerCase()) {
        correctCount++;
      } else {
        failures.push({
          description: item.description,
          expected: item.expectedCategory,
          actual: result.categoryName,
          confidence: result.confidenceLevel,
          method: result.matchMethod
        });
      }
    }

    const accuracyPercentage = (correctCount / totalCount) * 100;
    
    // Log measured benchmark for Phase 5 audit
    console.log(`\n================ QUALITY EVALUATION BENCHMARK ================`);
    console.log(`Evaluated Fixtures: ${totalCount}`);
    console.log(`Correctly Categorised: ${correctCount}`);
    console.log(`Measured Rule-Engine Accuracy: ${accuracyPercentage.toFixed(2)}%`);
    if (failures.length > 0) {
      console.log(`Misclassifications (${failures.length}):`, failures);
    }
    console.log(`==============================================================\n`);

    // Must exceed 95% baseline accuracy on this curated benchmark
    assert.ok(accuracyPercentage >= 95, `Expected accuracy >= 95%, got ${accuracyPercentage}%`);
    assert.equal(failures.length <= 2, true);
  });

  it('handles completely unknown merchants safely with Others fallback and review flag', () => {
    const unknownMerchants = [
      'X92847 Venturi Corp Special',
      'Global Alpha Quantum Holding Ref-4819',
      'Miscellaneous Mystery Transfer 110022'
    ];

    for (const merchant of unknownMerchants) {
      const res = suggestCategory({
        merchant,
        transactionType: 'expense',
        userRules: []
      });

      assert.equal(res.categoryName, 'Others');
      assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.NONE);
      assert.equal(res.confidenceScore, 0.0);
      assert.equal(res.reviewRecommended, true);
    }
  });

  it('validates server-side taxonomy and rejects out-of-taxonomy AI hallucinations', async () => {
    // Valid categories should pass validation
    const validClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            categoryName: 'Food',
            confidence: 0.9,
            explanation: 'Recognized restaurant meal.'
          })
        })
      }
    };
    const validResult = await classifyWithGemini({
      merchant: 'Dominos Pizza',
      description: 'Order',
      transactionType: 'expense',
      allowedCategories: ['Food', 'Groceries', 'Travel', 'Others'],
      apiKey: 'test-key',
      genAiClient: validClient
    });
    assert.equal(validResult.available, true);
    assert.equal(validResult.success, true);
    assert.equal(validResult.suggestion.categoryName, 'Food');

    // Hallucinated category not in the system taxonomy must be rejected
    const hallucinatedClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            categoryName: 'Crypto Speculation',
            confidence: 0.95,
            explanation: 'High-frequency trading.'
          })
        })
      }
    };
    const invalidResult = await classifyWithGemini({
      merchant: 'Coinbase',
      description: 'Token buy',
      transactionType: 'expense',
      allowedCategories: ['Food', 'Groceries', 'Travel', 'Others'],
      apiKey: 'test-key',
      genAiClient: hallucinatedClient
    });
    assert.equal(invalidResult.available, true);
    assert.equal(invalidResult.success, false);
    assert.match(invalidResult.error, /not in the permitted categories list/i);
  });

  it('resolves conflicting personal rules deterministically and flags review for equal specificity', () => {
    // Conflicting rules with equal specificity (both contains, length 6)
    const conflictingRules = [
      {
        id: 'rule-coffee-1',
        merchantPattern: 'coffee',
        categoryName: 'Food',
        matchType: 'contains',
        isActive: true,
        transactionType: 'expense',
        createdAt: '2026-10-20T10:00:00Z'
      },
      {
        id: 'rule-coffee-2',
        merchantPattern: 'coffee',
        categoryName: 'Shopping',
        matchType: 'contains',
        isActive: true,
        transactionType: 'expense',
        createdAt: '2026-10-21T10:00:00Z'
      }
    ];

    const res = suggestCategory({
      merchant: 'Artisan Coffee Roasters',
      transactionType: 'expense',
      userRules: conflictingRules
    });

    // Resolves deterministically to top rule (Food), but marks confidence as LOW and flags reviewRecommended
    assert.equal(res.categoryName, 'Food');
    assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.LOW);
    assert.equal(res.confidenceScore, 0.45);
    assert.equal(res.reviewRecommended, true);
    assert.equal(res.matchMethod, MATCH_METHODS.AMBIGUOUS_KEYWORD);
  });

  it('prioritises more specific rules over broader rules (Exact > Contains > Regex)', () => {
    const rules = [
      {
        id: 'broad-rule',
        merchantPattern: 'tokai',
        categoryName: 'Shopping',
        matchType: 'contains',
        isActive: true,
        transactionType: 'expense'
      },
      {
        id: 'specific-exact-rule',
        merchantPattern: 'Blue Tokai Saket',
        categoryName: 'Food',
        matchType: 'exact',
        isActive: true,
        transactionType: 'expense'
      }
    ];

    const res = suggestCategory({
      merchant: 'Blue Tokai Saket',
      transactionType: 'expense',
      userRules: rules
    });

    // Exact match (specificity 300) must win over Contains (specificity 205)
    assert.equal(res.categoryName, 'Food');
    assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.HIGH);
    assert.equal(res.confidenceScore, 0.95);
    assert.ok(res.explanation.includes('specific personal rule'));
  });

  it('ignores inactive/disabled user rules and falls back safely', () => {
    const rules = [
      {
        id: 'disabled-rule',
        merchantPattern: 'Starbucks',
        categoryName: 'Shopping', // User had set Starbucks to Shopping, but disabled it
        matchType: 'exact',
        isActive: false,
        transactionType: 'expense'
      }
    ];

    const res = suggestCategory({
      merchant: 'Starbucks',
      transactionType: 'expense',
      userRules: rules
    });

    // Inactive rule must be skipped; fallback to canonical dictionary (Food)
    assert.equal(res.categoryName, 'Food');
    assert.equal(res.matchMethod, MATCH_METHODS.EXACT_MERCHANT);
  });

  it('respects transactionType compatibility for user rules', () => {
    const rules = [
      {
        id: 'expense-only-rule',
        merchantPattern: 'Paytm Transfer',
        categoryName: 'Recharge',
        matchType: 'contains',
        isActive: true,
        transactionType: 'expense'
      }
    ];

    // Same merchant incoming as an income transaction
    const res = suggestCategory({
      merchant: 'Paytm Transfer',
      transactionType: 'income',
      userRules: rules
    });

    // Must not match expense rule; should fall back to income categories
    assert.notEqual(res.categoryName, 'Recharge');
  });

  it('sorts rules by strict precedence order (Active > Specificity > Newest)', () => {
    const unsortedRules = [
      { id: '1', merchantPattern: 'uber', matchType: 'contains', isActive: true, createdAt: '2026-10-01' },
      { id: '2', merchantPattern: 'uber rides delhi', matchType: 'exact', isActive: true, createdAt: '2026-10-02' },
      { id: '3', merchantPattern: 'uber india private limited', matchType: 'contains', isActive: true, createdAt: '2026-10-03' },
      { id: '4', merchantPattern: 'uber eats', matchType: 'exact', isActive: false, createdAt: '2026-10-04' }
    ];

    const sorted = categoryRuleService.sortRulesByPrecedence(unsortedRules);

    // Active rules first
    assert.equal(sorted[3].id, '4'); // inactive rule at end
    // Exact match comes first among active
    assert.equal(sorted[0].id, '2'); // exact
    // Longer contains comes before shorter contains
    assert.equal(sorted[1].id, '3'); // 'uber india private limited' (len 26) > 'uber' (len 4)
    assert.equal(sorted[2].id, '1');
  });

  it('correctly previews historical recategorisation candidates and protects manual confirmations', async () => {
    const existingTransactions = [
      {
        id: 'tx-1',
        merchant: 'Blue Tokai Cafe Connaught Place',
        category: 'Uncategorized',
        type: 'expense',
        isManualCategory: false
      },
      {
        id: 'tx-2',
        merchant: 'Blue Tokai Saket',
        category: 'Food', // Already has the target category
        type: 'expense',
        isManualCategory: false
      },
      {
        id: 'tx-3',
        merchant: 'Blue Tokai Airport',
        category: 'Travel',
        type: 'expense',
        isManualCategory: true // User manually confirmed this earlier!
      },
      {
        id: 'tx-4',
        merchant: 'Blinkit Instant Delivery',
        category: 'Groceries',
        type: 'expense',
        isManualCategory: false
      }
    ];

    const preview = await transactionService.previewHistoricalRecategorisation({
      userId: 'test-user-1',
      merchantPattern: 'Blue Tokai',
      matchType: 'contains',
      transactionType: 'expense',
      newCategoryName: 'Food',
      currentTransactions: existingTransactions
    });

    assert.equal(preview.candidates.length, 2); // tx-1 and tx-3 (tx-2 skipped because category already matches)
    assert.equal(preview.alreadyMatching, 1);
    assert.equal(preview.totalMatching, 3);

    const candidate1 = preview.candidates.find(c => c.id === 'tx-1');
    assert.ok(candidate1);
    assert.equal(candidate1.isManualCategory, false);

    // CRITICAL: Manually confirmed transaction must be flagged with isManualCategory: true
    const candidate3 = preview.candidates.find(c => c.id === 'tx-3');
    assert.ok(candidate3);
    assert.equal(candidate3.isManualCategory, true);
  });

  it('guarantees AI requests are completely suppressed when privacy toggle is disabled', async () => {
    const disabledProfile = {
      id: 'privacy-user-1',
      aiCategorizationEnabled: false
    };

    const result = await requestAiCategorization({
      merchant: 'Starbucks Coffee',
      notes: 'Morning coffee',
      type: 'expense',
      userProfile: disabledProfile,
      enabled: false // explicit disable
    });

    // Must return disabled state immediately without network invocation
    assert.equal(result.available, false);
    assert.equal(result.disabledByUser, true);
    assert.equal(result.suggestion, null);
  });

  it('falls back seamlessly to local rule suggestion when AI returns an error or is unavailable', async () => {
    // When AI endpoint fails or is unconfigured
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'AI provider service unavailable' })
      };
    };

    try {
      const aiResult = await requestAiCategorization({
        merchant: 'Swiggy Food Order',
        type: 'expense',
        userProfile: { aiCategorizationEnabled: true }
      });

      assert.equal(aiResult.available, false);
      assert.equal(aiResult.suggestion, null);

      // Local rule engine continues running independently
      const localResult = suggestCategory({
        merchant: 'Swiggy Food Order',
        transactionType: 'expense',
        userRules: []
      });

      assert.equal(localResult.categoryName, 'Food');
      assert.ok(localResult.confidenceLevel === CONFIDENCE_LEVELS.HIGH || localResult.confidenceLevel === CONFIDENCE_LEVELS.MEDIUM);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
