/**
 * Finovo Validation Utilities
 * Centralized, pure validation functions returning structured field error objects.
 */

/**
 * Validates transaction fields for AddExpense and TransactionDetails.
 * @param {Object} data
 * @param {number|string} data.amount
 * @param {string} data.merchant
 * @param {string} [data.category]
 * @param {string} [data.date]
 * @returns {{ isValid: boolean, errors: Object.<string, string> }}
 */
export function validateTransaction(data = {}) {
  const errors = {};

  // Validate amount
  const rawAmount = data.amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
    errors.amount = 'Amount is required';
  } else {
    const num = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
    if (isNaN(num)) {
      errors.amount = 'Amount must be a valid number';
    } else if (num <= 0) {
      errors.amount = 'Amount must be greater than zero';
    } else if (num > 100000000) {
      errors.amount = 'Amount cannot exceed ₹10,00,00,000';
    }
  }

  // Validate merchant
  const merchant = typeof data.merchant === 'string' ? data.merchant.trim() : '';
  if (!merchant) {
    errors.merchant = 'Merchant name is required';
  } else if (merchant.length > 80) {
    errors.merchant = 'Merchant name must be 80 characters or less';
  }

  // Validate date if present
  if (data.date) {
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(data.date);
    if (!isIsoDate) {
      errors.date = 'Date must be formatted as YYYY-MM-DD';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates group creation data in Splits.
 * @param {Object} data
 * @param {string} data.title
 * @param {number|string} data.members
 * @returns {{ isValid: boolean, errors: Object.<string, string> }}
 */
export function validateGroup(data = {}) {
  const errors = {};

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) {
    errors.title = 'Group name is required';
  } else if (title.length < 2) {
    errors.title = 'Group name must be at least 2 characters';
  } else if (title.length > 60) {
    errors.title = 'Group name must be 60 characters or less';
  }

  const members = parseInt(data.members, 10);
  if (isNaN(members) || members < 2) {
    errors.members = 'A group must have at least 2 members';
  } else if (members > 100) {
    errors.members = 'Members count cannot exceed 100';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates monthly budget setting in Profile / Onboarding.
 * @param {number|string} amount
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateBudget(amount) {
  if (amount === undefined || amount === null || amount === '') {
    return { isValid: false, error: 'Budget limit is required' };
  }
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { isValid: false, error: 'Budget limit must be greater than zero' };
  }
  if (num > 50000000) {
    return { isValid: false, error: 'Budget limit cannot exceed ₹5,00,00,000' };
  }
  return { isValid: true, error: null };
}

/**
 * Validates user authentication form inputs.
 * @param {Object} data
 * @param {string} data.email
 * @param {string} data.password
 * @param {string} [data.name]
 * @param {boolean} [isSignup=false]
 * @returns {{ isValid: boolean, errors: Object.<string, string> }}
 */
export function validateAuthForm(data = {}, isSignup = false) {
  const errors = {};

  // Email
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    errors.email = 'Email address is required';
  } else if (!emailRegex.test(email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Password
  const password = typeof data.password === 'string' ? data.password : '';
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  // Name (only for signup)
  if (isSignup) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      errors.name = 'Full name is required';
    } else if (name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
