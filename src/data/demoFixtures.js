/**
 * Finovo Demo Fixtures
 * Isolated mock and sample data strictly labeled with `isDemo: true` so that
 * sample fixtures are never conflated with real authenticated user financial records.
 */

import { getTodayDateString } from '../utils/date.js';

/**
 * Returns clean, unpolluted default user profile state.
 */
export const INITIAL_USER_PROFILE = Object.freeze({
  name: 'Finovo Member',
  email: 'user@finovo.io',
  budgetLimit: 45000,
  createdAt: new Date().toISOString(),
  isPremium: false,
  smsPermission: 'Not Requested'
});

/**
 * Isolated demo transactions used ONLY when the user explicitly triggers
 * the "Import SMS Demo" walkthrough action.
 * Every record is explicitly stamped with `isDemo: true` and `demoTag`.
 * @returns {Array<Object>}
 */
export function getDemoTransactions() {
  const today = getTodayDateString();
  const timestamp = Date.now();

  return [
    {
      id: `demo-tx-${timestamp}-1`,
      merchant: 'Swiggy',
      category: 'Food',
      amount: 450,
      date: today,
      time: '01:30 PM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: '[Demo Data] Lunch order sample simulation',
      isDemo: true,
      demoTag: 'SMS_SIMULATION'
    },
    {
      id: `demo-tx-${timestamp}-2`,
      merchant: 'Uber',
      category: 'Travel',
      amount: 280,
      date: today,
      time: '09:15 AM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: '[Demo Data] Office ride sample simulation',
      isDemo: true,
      demoTag: 'SMS_SIMULATION'
    },
    {
      id: `demo-tx-${timestamp}-3`,
      merchant: 'Unknown Merchant',
      category: 'Uncategorized',
      amount: 650,
      date: today,
      time: '04:00 PM',
      type: 'expense',
      paymentMethod: 'UPI',
      status: 'Completed',
      notes: '[Demo Data] Auto-detected payment needing categorization',
      isDemo: true,
      demoTag: 'SMS_SIMULATION'
    }
  ];
}

/**
 * Checks if a transaction or group object is an isolated demo fixture.
 * @param {Object} item
 * @returns {boolean}
 */
export function isDemoItem(item) {
  return Boolean(item && item.isDemo === true);
}

/**
 * Separates real financial records from demo fixtures.
 * @param {Array} list
 * @returns {Array} List containing only genuine user-created records
 */
export function filterOutDemoData(list = []) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => !isDemoItem(item));
}
