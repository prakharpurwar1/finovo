/**
 * Finovo Date Utilities
 * Clean, timezone-safe date parsing, validation, and rolling spending aggregations.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the start and end date (YYYY-MM-DD) for the current month.
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ startDate: string, endDate: string }}
 */
export function getCurrentMonthBoundaries(referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const startMonth = String(month + 1).padStart(2, '0');
  const startDate = `${year}-${startMonth}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${startMonth}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

/**
 * Returns current time formatted as hh:mm AM/PM.
 * @returns {string}
 */
export function getCurrentTimeString() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Parses YYYY-MM-DD safely into a local Date without UTC offset shifts.
 * @param {string} dateString
 * @returns {Date|null}
 */
export function parseLocalDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

/**
 * Checks if a date string falls between startDate and endDate (inclusive).
 * @param {string} dateStr
 * @param {string} [startDateStr]
 * @param {string} [endDateStr]
 * @returns {boolean}
 */
export function isDateInRange(dateStr, startDateStr, endDateStr) {
  if (!dateStr) return false;
  if (startDateStr && dateStr < startDateStr) return false;
  if (endDateStr && dateStr > endDateStr) return false;
  return true;
}

/**
 * Computes the 7-day spending sparkline for the current week (Monday through Sunday)
 * or rolling past 7 days, matching ONLY transactions occurring in this window.
 * @param {Array} transactions
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Array<{ day: string, date: string, amount: number }>}
 */
export function getWeeklyDailySpending(transactions = [], { referenceDate = new Date() } = {}) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Determine Monday of current week
  const ref = new Date(referenceDate);
  const currentDay = ref.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = (currentDay === 0 ? -6 : 1) - currentDay;

  const monday = new Date(ref);
  monday.setDate(ref.getDate() + distanceToMonday);

  // Generate 7 days of this week
  const daysMap = {};
  const result = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${dayNum}`;
    const label = dayLabels[i];

    daysMap[dateKey] = i;
    result.push({
      day: label,
      date: dateKey,
      amount: 0
    });
  }

  // Aggregate only expense transactions that actually fall on these 7 days
  if (Array.isArray(transactions)) {
    for (const tx of transactions) {
      if (tx && tx.type === 'expense' && tx.date && daysMap[tx.date] !== undefined) {
        const index = daysMap[tx.date];
        const val = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0;
        result[index].amount = Math.round((result[index].amount + val) * 100) / 100;
      }
    }
  }

  return result;
}

/**
 * Computes hourly spending distribution for a specific day.
 * Analyzes tx.time (e.g. '01:30 PM') and bins into 5 day-segments.
 * @param {Array} transactions
 * @param {string} targetDate YYYY-MM-DD
 * @returns {Array<{ time: string, amount: number }>}
 */
export function getHourlySpendDistribution(transactions = [], targetDate) {
  const buckets = [
    { time: '9 AM', startH: 6, endH: 10, amount: 0 },
    { time: '12 PM', startH: 11, endH: 13, amount: 0 },
    { time: '3 PM', startH: 14, endH: 16, amount: 0 },
    { time: '6 PM', startH: 17, endH: 19, amount: 0 },
    { time: '9 PM', startH: 20, endH: 23, amount: 0 }
  ];

  if (!Array.isArray(transactions) || !targetDate) {
    return buckets.map(b => ({ time: b.time, amount: 0 }));
  }

  const dayExpenses = transactions.filter(t => t.date === targetDate && t.type === 'expense');

  for (const tx of dayExpenses) {
    const val = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0;
    let hour = 12; // default noon if unparseable

    if (tx.time) {
      const match = tx.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const meridiem = (match[3] || '').toUpperCase();
        if (meridiem === 'PM' && h < 12) h += 12;
        if (meridiem === 'AM' && h === 12) h = 0;
        hour = h;
      }
    }

    // Match to closest bucket
    let matched = false;
    for (const b of buckets) {
      if (hour >= b.startH && hour <= b.endH) {
        b.amount += val;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Default to 12 PM or 9 PM
      if (hour < 12) buckets[0].amount += val;
      else buckets[buckets.length - 1].amount += val;
    }
  }

  return buckets.map(b => ({
    time: b.time,
    amount: Math.round(b.amount * 100) / 100
  }));
}
