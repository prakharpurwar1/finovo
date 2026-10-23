import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  suggestCategory, 
  normalizeText, 
  matchesWordBoundary,
  CONFIDENCE_LEVELS,
  MATCH_METHODS
} from '../utils/categorizationEngine.js';

describe('Smart Rule-Based Transaction Categorisation Engine', () => {

  // 1. Text Normalization & Word Boundary Safety
  describe('Text Normalization & Boundary Protection', () => {
    it('normalizes uppercase, trailing whitespace, and harmless punctuation', () => {
      assert.equal(normalizeText('  SWIGGY!!!  '), 'swiggy');
      assert.equal(normalizeText('Zomato - Order #12345'), 'zomato order 12345');
      assert.equal(normalizeText(' Uber   Trip\nReceipt '), 'uber trip receipt');
    });

    it('handles empty and null values safely without crashing', () => {
      assert.equal(normalizeText(null), '');
      assert.equal(normalizeText(undefined), '');
      assert.equal(normalizeText(''), '');
    });

    it('strictly prevents partial substring matches inside unrelated words', () => {
      // "cat" must not match "scatter" or "catalog"
      assert.equal(matchesWordBoundary('scattered documents', 'cat'), false);
      assert.equal(matchesWordBoundary('clothing catalog', 'cat'), false);

      // "bar" must not match "embarrassing"
      assert.equal(matchesWordBoundary('embarrassing moment', 'bar'), false);

      // But standalone "bar" or "bar counter" must match
      assert.equal(matchesWordBoundary('visited the bar', 'bar'), true);
      assert.equal(matchesWordBoundary('bar counter', 'bar'), true);
    });
  });

  // 2. Canonical Known Merchant Matches
  describe('Canonical Known Merchant Matches', () => {
    it('correctly matches Food merchants with High Confidence (0.95)', () => {
      const res1 = suggestCategory({ merchant: 'Swiggy', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Food');
      assert.equal(res1.confidenceLevel, CONFIDENCE_LEVELS.HIGH);
      assert.equal(res1.confidenceScore, 0.95);
      assert.equal(res1.matchMethod, MATCH_METHODS.EXACT_MERCHANT);
      assert.equal(res1.reviewRecommended, false);

      const res2 = suggestCategory({ merchant: 'Zomato', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Food');
      assert.equal(res2.confidenceScore, 0.95);

      const res3 = suggestCategory({ merchant: "Domino's Pizza", transactionType: 'expense' });
      // normalized to dominos pizza -> alias/merchant match
      assert.equal(res3.categoryName, 'Food');
      assert.equal(res3.confidenceLevel, CONFIDENCE_LEVELS.MEDIUM);
    });

    it('correctly matches Grocery merchants (Blinkit, Zepto, DMart)', () => {
      const res1 = suggestCategory({ merchant: 'Blinkit', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Groceries');
      assert.equal(res1.confidenceScore, 0.95);

      const res2 = suggestCategory({ merchant: 'Zepto', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Groceries');

      const res3 = suggestCategory({ merchant: 'DMart', transactionType: 'expense' });
      assert.equal(res3.categoryName, 'Groceries');
    });

    it('correctly matches Transportation merchants (Uber, Ola, Rapido)', () => {
      const res1 = suggestCategory({ merchant: 'Uber', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Travel');
      assert.equal(res1.confidenceScore, 0.95);

      const res2 = suggestCategory({ merchant: 'Ola Cabs', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Travel');

      const res3 = suggestCategory({ merchant: 'Rapido', transactionType: 'expense' });
      assert.equal(res3.categoryName, 'Travel');
    });

    it('correctly matches Subscription merchants (Netflix, Spotify, ChatGPT)', () => {
      const res1 = suggestCategory({ merchant: 'Netflix', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Subscriptions');
      assert.equal(res1.confidenceScore, 0.95);

      const res2 = suggestCategory({ merchant: 'Spotify India', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Subscriptions');

      const res3 = suggestCategory({ merchant: 'ChatGPT Subscription', transactionType: 'expense' });
      assert.equal(res3.categoryName, 'Subscriptions');
    });

    it('correctly matches Utilities & Recharge merchants (Airtel, BESCOM, Tata Power)', () => {
      const res1 = suggestCategory({ merchant: 'Airtel', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Recharge');
      assert.equal(res1.confidenceScore, 0.95);

      const res2 = suggestCategory({ merchant: 'BESCOM Electricity', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Recharge');
    });

    it('correctly matches Healthcare merchants (Apollo Pharmacy, 1mg, Netmeds)', () => {
      const res1 = suggestCategory({ merchant: 'Apollo Pharmacy', transactionType: 'expense' });
      assert.equal(res1.categoryName, 'Medicine');
      assert.equal(res1.confidenceScore, 0.95);

      const res2 = suggestCategory({ merchant: 'Netmeds', transactionType: 'expense' });
      assert.equal(res2.categoryName, 'Medicine');
    });
  });

  // 3. Strict Type Separation (Income vs Expense)
  describe('Income vs Expense Classification Safety', () => {
    it('correctly categorises Income transactions for Salary, Freelance, and Investments', () => {
      const res1 = suggestCategory({ 
        merchant: 'Infosys Payroll', 
        description: 'Monthly Salary Credit', 
        transactionType: 'income' 
      });
      assert.equal(res1.categoryName, 'Salary');
      assert.equal(res1.confidenceLevel, CONFIDENCE_LEVELS.HIGH);

      const res2 = suggestCategory({ 
        merchant: 'Upwork Global', 
        description: 'Freelance Design Milestone', 
        transactionType: 'income' 
      });
      assert.equal(res2.categoryName, 'Freelance');

      const res3 = suggestCategory({ 
        merchant: 'Zerodha Broking', 
        description: 'Dividend payout', 
        transactionType: 'income' 
      });
      assert.equal(res3.categoryName, 'Investments');
    });

    it('handles refunds as Income with category Refunds', () => {
      const res = suggestCategory({ 
        merchant: 'Amazon', 
        description: 'Amazon Refund for returned book', 
        transactionType: 'income' 
      });
      assert.equal(res.categoryName, 'Refunds');
      assert.equal(res.confidenceScore >= 0.7, true);
    });

    it('prevents expense transactions from being classified as income even if keywords appear', () => {
      // E.g. paying salary to household help
      const res = suggestCategory({ 
        merchant: 'Maid Salary Transfer', 
        description: 'Salary for cleaning', 
        transactionType: 'expense' 
      });
      // Must NOT be classified as Salary Income
      assert.notEqual(res.categoryName, 'Salary');
    });
  });

  // 4. Keyword Context & Ambiguity Handling
  describe('Keyword Context & Ambiguity Handling', () => {
    it('accurately resolves single unambiguous keywords', () => {
      const res = suggestCategory({ 
        merchant: 'Corner Store', 
        description: 'Bought dinner with friends', 
        transactionType: 'expense' 
      });
      assert.equal(res.categoryName, 'Food');
      assert.equal(res.matchMethod, MATCH_METHODS.KEYWORD_RULE);
      assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.MEDIUM);
      assert.equal(res.reviewRecommended, false);
    });

    it('flags conflicting keywords with Low Confidence and recommends review', () => {
      const res = suggestCategory({ 
        merchant: 'Holiday Resort', 
        description: 'Dinner and flight booking combo package', 
        transactionType: 'expense' 
      });
      // Both Food (dinner) and Travel (flight) are present
      assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.LOW);
      assert.equal(res.confidenceScore, 0.40);
      assert.equal(res.matchMethod, MATCH_METHODS.AMBIGUOUS_KEYWORD);
      assert.equal(res.reviewRecommended, true);
    });

    it('returns unknown fallback with None Confidence for unrecognized merchants', () => {
      const res = suggestCategory({ 
        merchant: 'Random XYZ Pvt Ltd', 
        description: 'Transfer 987654', 
        transactionType: 'expense' 
      });
      assert.equal(res.categoryName, 'Others');
      assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.NONE);
      assert.equal(res.confidenceScore, 0.0);
      assert.equal(res.matchMethod, MATCH_METHODS.DEFAULT_FALLBACK);
      assert.equal(res.reviewRecommended, true);
    });
  });

  // 5. User-Defined Rule Precedence
  describe('User-Defined Rule Precedence', () => {
    it('user rules take supreme precedence over canonical merchant defaults', () => {
      // Swiggy is normally Food, but user defined rule says Swiggy is Entertainment
      const customRules = [
        {
          id: 'rule-1',
          merchantPattern: 'Swiggy',
          categoryName: 'Entertainment',
          matchType: 'exact'
        }
      ];

      const res = suggestCategory({ 
        merchant: 'Swiggy', 
        transactionType: 'expense',
        userRules: customRules 
      });

      assert.equal(res.categoryName, 'Entertainment');
      assert.equal(res.confidenceLevel, CONFIDENCE_LEVELS.HIGH);
      assert.equal(res.confidenceScore, 1.0);
      assert.equal(res.matchMethod, MATCH_METHODS.USER_RULE);
      assert.equal(res.reviewRecommended, false);
      assert.equal(res.explanation.includes('Matched your custom rule'), true);
    });

    it('supports contains matching in user rules', () => {
      const customRules = [
        {
          id: 'rule-2',
          merchantPattern: 'Chai',
          categoryName: 'Food',
          matchType: 'contains'
        }
      ];

      const res = suggestCategory({ 
        merchant: 'Local Chai Tapri Shop', 
        transactionType: 'expense',
        userRules: customRules 
      });

      assert.equal(res.categoryName, 'Food');
      assert.equal(res.matchMethod, MATCH_METHODS.USER_RULE);
    });
  });

  // 6. Mapping against User-Available Categories
  describe('Available Categories Resolution', () => {
    it('maps to specified available categories safely', () => {
      const availableCategories = [
        { id: 'cat-1', name: 'Food' },
        { id: 'cat-2', name: 'Travel' },
        { id: 'cat-3', name: 'Others' }
      ];

      const res = suggestCategory({ 
        merchant: 'Uber', 
        transactionType: 'expense',
        availableCategories 
      });

      assert.equal(res.categoryName, 'Travel');
    });
  });
});
