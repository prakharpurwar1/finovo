/**
 * Finovo Split Expense Calculation & Debt Simplification Engine
 * 
 * Strict invariants:
 * 1. Integer minor units (paise: 1 INR = 100 paise) eliminate rounding drift.
 * 2. Sum of allocated shares must ALWAYS equal total expense amount exactly.
 * 3. Net balance convention:
 *    - Positive (> 0): Member is owed money (+)
 *    - Negative (< 0): Member owes money (-)
 *    - Zero (= 0): Fully settled
 * 4. Debt simplification preserves total debt while minimizing required transfer transactions.
 */

import { toPaise, fromPaise } from './currency.js';

export const SPLIT_METHODS = Object.freeze({
  EQUAL: 'equal',
  UNEQUAL: 'unequal',
  PERCENTAGE: 'percentage'
});

/**
 * Calculates equal shares among selected participants with exact remainder distribution.
 * e.g., ₹1000 across 3 members -> ₹333.34, ₹333.33, ₹333.33 (Sum = ₹1000.00).
 * 
 * @param {Object} params
 * @param {number|string} params.totalAmount Total expense amount in rupees
 * @param {Array<Object>} params.participants List of member objects with { id, name }
 * @returns {{ valid: boolean, shares: Array<Object>, error: string|null }}
 */
export function calculateEqualSplit({ totalAmount, participants = [] }) {
  const totalPaise = toPaise(totalAmount);
  if (totalPaise <= 0) {
    return { valid: false, shares: [], error: 'Total expense amount must be greater than zero.' };
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    return { valid: false, shares: [], error: 'At least one participant must be selected for the split.' };
  }

  const count = participants.length;
  const basePaise = Math.floor(totalPaise / count);
  let remainderPaise = totalPaise % count;

  const shares = participants.map((participant, index) => {
    const allocatedPaise = basePaise + (index < remainderPaise ? 1 : 0);
    return {
      memberId: participant.id || participant.memberId,
      name: participant.name,
      allocatedSharePaise: allocatedPaise,
      allocatedShare: fromPaise(allocatedPaise),
      percentage: Number(((allocatedPaise / totalPaise) * 100).toFixed(2))
    };
  });

  return { valid: true, shares, error: null };
}

/**
 * Validates and compiles unequal shares where each participant has an explicit amount.
 * 
 * @param {Object} params
 * @param {number|string} params.totalAmount
 * @param {Array<Object>} params.customShares Array of { memberId, name, amount }
 * @returns {{ valid: boolean, shares: Array<Object>, error: string|null, remainingPaise: number }}
 */
export function calculateUnequalSplit({ totalAmount, customShares = [] }) {
  const totalPaise = toPaise(totalAmount);
  if (totalPaise <= 0) {
    return { valid: false, shares: [], error: 'Total expense amount must be greater than zero.', remainingPaise: 0 };
  }
  if (!Array.isArray(customShares) || customShares.length === 0) {
    return { valid: false, shares: [], error: 'At least one participant must be specified.', remainingPaise: totalPaise };
  }

  let allocatedSumPaise = 0;
  const shares = customShares.map((item) => {
    const sharePaise = Math.max(0, toPaise(item.amount || 0));
    allocatedSumPaise += sharePaise;
    return {
      memberId: item.memberId || item.id,
      name: item.name,
      allocatedSharePaise: sharePaise,
      allocatedShare: fromPaise(sharePaise),
      percentage: totalPaise > 0 ? Number(((sharePaise / totalPaise) * 100).toFixed(2)) : 0
    };
  });

  const remainingPaise = totalPaise - allocatedSumPaise;
  if (remainingPaise !== 0) {
    const diff = Math.abs(fromPaise(remainingPaise));
    const errorMsg = remainingPaise > 0 
      ? `Allocated shares are short by ₹${diff.toFixed(2)}. Sum must equal total amount.`
      : `Allocated shares exceed total by ₹${diff.toFixed(2)}. Sum must equal total amount.`;
    return { valid: false, shares, error: errorMsg, remainingPaise };
  }

  return { valid: true, shares, error: null, remainingPaise: 0 };
}

/**
 * Calculates percentage-based shares with exact rounding remainder distribution.
 * 
 * @param {Object} params
 * @param {number|string} params.totalAmount
 * @param {Array<Object>} params.percentageShares Array of { memberId, name, percentage }
 * @returns {{ valid: boolean, shares: Array<Object>, error: string|null }}
 */
export function calculatePercentageSplit({ totalAmount, percentageShares = [] }) {
  const totalPaise = toPaise(totalAmount);
  if (totalPaise <= 0) {
    return { valid: false, shares: [], error: 'Total expense amount must be greater than zero.' };
  }
  if (!Array.isArray(percentageShares) || percentageShares.length === 0) {
    return { valid: false, shares: [], error: 'At least one participant must be specified.' };
  }

  let totalPercent = 0;
  for (const item of percentageShares) {
    totalPercent += Number(item.percentage || 0);
  }

  // Allow floating point tolerance around 100%
  if (Math.abs(totalPercent - 100) > 0.05) {
    return { 
      valid: false, 
      shares: [], 
      error: `Total percentage must equal 100% (currently ${totalPercent.toFixed(1)}%).` 
    };
  }

  let allocatedSumPaise = 0;
  const shares = percentageShares.map((item, idx) => {
    const pct = Number(item.percentage || 0);
    // For all items except the last, round normally; give remaining to last to guarantee sum equality
    let sharePaise;
    if (idx === percentageShares.length - 1) {
      sharePaise = Math.max(0, totalPaise - allocatedSumPaise);
    } else {
      sharePaise = Math.round((totalPaise * pct) / 100);
      allocatedSumPaise += sharePaise;
    }

    return {
      memberId: item.memberId || item.id,
      name: item.name,
      allocatedSharePaise: sharePaise,
      allocatedShare: fromPaise(sharePaise),
      percentage: pct
    };
  });

  return { valid: true, shares, error: null };
}

/**
 * Calculates net balances for all group members from expenses and confirmed settlements.
 * 
 * Invariant formula:
 * Net Balance = Total Paid by Member - Total Allocated Shares + Received Settlements - Outgoing Settlements
 * 
 * @param {Object} params
 * @param {Array<Object>} params.members
 * @param {Array<Object>} params.expenses List of group expenses with payer_member_id, amount_paise, status, shares
 * @param {Array<Object>} params.settlements List of settlements with payer_member_id, recipient_member_id, amount_paise, status
 * @returns {Object} { memberBalances, totalSharedPaise, totalSettledPaise, totalOwedToUserPaise, totalUserOwesPaise }
 */
export function calculateMemberBalances({ members = [], expenses = [], settlements = [] }) {
  const balanceMap = new Map();

  // Initialize members
  for (const member of members) {
    const memberId = member.id || member.memberId;
    balanceMap.set(memberId, {
      memberId,
      name: member.name || 'Member',
      userId: member.user_id || member.userId || null,
      role: member.role || 'member',
      status: member.status || 'active',
      paidPaise: 0,
      sharePaise: 0,
      settledInPaise: 0,
      settledOutPaise: 0,
      netBalancePaise: 0
    });
  }

  let totalSharedPaise = 0;
  // Process Active Expenses & Shares
  for (const exp of expenses) {
    if (exp.status === 'deleted' || exp.status === 'cancelled') continue;
    const amountPaise = Number(exp.amount_paise || toPaise(exp.amount || 0));
    totalSharedPaise += amountPaise;

    const payerId = exp.payer_member_id || exp.payerId;
    if (balanceMap.has(payerId)) {
      const payer = balanceMap.get(payerId);
      payer.paidPaise += amountPaise;
    }

    const shares = exp.shares || [];
    for (const share of shares) {
      const memberId = share.member_id || share.memberId;
      const sharePaise = Number(share.allocated_share_paise || toPaise(share.allocatedShare || 0));
      if (balanceMap.has(memberId)) {
        const mem = balanceMap.get(memberId);
        mem.sharePaise += sharePaise;
      }
    }
  }

  let totalSettledPaise = 0;
  // Process Confirmed Settlements
  for (const setl of settlements) {
    if (setl.status !== 'confirmed') continue;
    const amountPaise = Number(setl.amount_paise || toPaise(setl.amount || 0));
    totalSettledPaise += amountPaise;

    const payerId = setl.payer_member_id || setl.payerId;
    const recId = setl.recipient_member_id || setl.recipientId;

    if (balanceMap.has(payerId)) {
      balanceMap.get(payerId).settledOutPaise += amountPaise;
    }
    if (balanceMap.has(recId)) {
      balanceMap.get(recId).settledInPaise += amountPaise;
    }
  }

  // Calculate final net balances
  const memberBalances = [];
  for (const record of balanceMap.values()) {
    // When a member receives settlement, their credit is paid down (- settledInPaise)
    // When a member pays settlement, their debt is paid down (+ settledOutPaise)
    const netPaise = (record.paidPaise - record.sharePaise) - record.settledInPaise + record.settledOutPaise;
    record.netBalancePaise = netPaise;
    record.netPaise = netPaise;
    record.netBalance = fromPaise(netPaise);
    record.paid = fromPaise(record.paidPaise);
    record.share = fromPaise(record.sharePaise);
    record.settledIn = fromPaise(record.settledInPaise);
    record.settledOut = fromPaise(record.settledOutPaise);

    if (netPaise > 0) {
      record.balanceStatus = 'owed'; // Others owe this member money
    } else if (netPaise < 0) {
      record.balanceStatus = 'owes'; // This member owes money
    } else {
      record.balanceStatus = 'settled'; // Zero balance
    }

    memberBalances.push(record);
  }

  return {
    memberBalances,
    totalSharedPaise,
    totalShared: fromPaise(totalSharedPaise),
    totalSettledPaise,
    totalSettled: fromPaise(totalSettledPaise)
  };
}

/**
 * Calculates a simplified debt settlement plan using a greedy min-transfers algorithm.
 * Guarantees minimum number of settlement payments while strictly preserving net balance conservation.
 * 
 * @param {Array<Object>} memberBalances
 * @returns {Array<Object>} Array of suggested transfers: { fromMemberId, fromName, toMemberId, toName, amount, amountPaise }
 */
export function calculateSimplifiedDebts(memberBalances = []) {
  // Extract non-zero debtors (< 0) and creditors (> 0)
  const debtors = [];
  const creditors = [];

  for (const m of memberBalances) {
    const paise = m.netBalancePaise || toPaise(m.netBalance || 0);
    if (paise < -1) {
      debtors.push({ memberId: m.memberId, name: m.name, amount: -paise });
    } else if (paise > 1) {
      creditors.push({ memberId: m.memberId, name: m.name, amount: paise });
    }
  }

  // Sort largest to smallest for greedy convergence
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const simplifiedPlan = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0) {
      simplifiedPlan.push({
        fromMemberId: debtor.memberId,
        fromName: debtor.name,
        toMemberId: creditor.memberId,
        toName: creditor.name,
        amountPaise: settledAmount,
        amount: fromPaise(settledAmount)
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount <= 1) dIdx++;
    if (creditor.amount <= 1) cIdx++;
  }

  return simplifiedPlan;
}
