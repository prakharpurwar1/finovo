/**
 * Finovo CSV Import & Export Service
 * RFC 4180 compliant parsing, flexible column mapping, date resolution,
 * duplicate detection, formula injection prevention, and template generation.
 */

import { toPaise } from '../utils/currency.js';
import { getTodayDateString } from '../utils/date.js';

// Supported standard and bank column aliases
const FIELD_ALIASES = {
  date: ['date', 'transaction date', 'txn date', 'tx date', 'value date', 'posted date', 'booking date'],
  merchant: ['merchant', 'payee', 'vendor', 'beneficiary', 'party name', 'party', 'narration', 'merchant name'],
  description: ['description', 'particulars', 'remarks', 'notes', 'memo', 'details', 'transaction details'],
  amount: ['amount', 'txn amount', 'transaction amount', 'net amount', 'total'],
  debit: ['debit', 'withdrawal', 'dr', 'paid out', 'debit amount', 'spent'],
  credit: ['credit', 'deposit', 'cr', 'received', 'credit amount', 'income'],
  type: ['type', 'transaction type', 'txn type', 'cr/dr', 'dr/cr'],
  category: ['category', 'expense category', 'tag', 'classification'],
  bankTxId: ['reference', 'ref no', 'ref number', 'utr', 'bank ref', 'transaction id', 'txn id', 'cheque no']
};

/**
 * Neutralizes spreadsheet formula injection (CSV/DDE injection).
 * If a text cell begins with dangerous formula triggers (=, +, -, @, tab, cr),
 * prefix with a single quote so spreadsheet software treats it purely as text.
 * 
 * @param {any} value 
 * @returns {string}
 */
export function sanitizeForCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escapes a cell value for standard CSV (wrapping in quotes if contains comma, quote, or newline).
 * 
 * @param {any} value 
 * @returns {string}
 */
export function escapeCsvCell(value) {
  const sanitized = sanitizeForCsv(value);
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * RFC 4180 compliant CSV Parser.
 * Correctly parses multi-line rows, escaped quotes (""), and commas inside fields.
 * 
 * @param {string} csvText 
 * @returns {{ headers: string[], rows: Array<Record<string, string>>, error?: string }}
 */
export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], error: 'Empty or invalid CSV content.' };
  }

  // Remove potential UTF-8 Byte Order Mark (BOM)
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n in CRLF
      }
      currentRow.push(currentField.trim());
      // Only push non-empty rows
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Push final field/row if exists
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], error: 'No data rows found in CSV.' };
  }

  const rawHeaders = lines[0];
  const headers = rawHeaders.map((h, idx) => h.trim() || `Column_${idx + 1}`);

  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const rowValues = lines[r];
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = rowValues[idx] !== undefined ? rowValues[idx] : '';
    });
    rowObj.__rowNumber = r + 1; // 1-indexed line number in original file
    rows.push(rowObj);
  }

  return { headers, rows, totalRows: rows.length };
}

/**
 * Automatically detects column mapping based on header names.
 * 
 * @param {Array<string>} headers 
 * @returns {Record<string, string|null>}
 */
export function autoDetectMapping(headers) {
  const mapping = {
    date: null,
    merchant: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    type: null,
    category: null,
    bankTxId: null
  };

  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: h.toLowerCase().replace(/[_\-.]/g, ' ').trim()
  }));

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const h of normalizedHeaders) {
      if (aliases.some(alias => h.normalized === alias || h.normalized.includes(alias))) {
        if (!mapping[field]) {
          mapping[field] = h.original;
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Parses dates supporting common Indian & International formats.
 * Resolves ambiguity using user preference ('DD/MM/YYYY' or 'MM/DD/YYYY').
 * 
 * @param {string} dateString 
 * @param {'DD/MM/YYYY'|'MM/DD/YYYY'|'YYYY-MM-DD'} [preferredFormat='DD/MM/YYYY'] 
 * @returns {{ date: string|null, isAmbiguous: boolean }}
 */
export function parseDateString(dateString, preferredFormat = 'DD/MM/YYYY') {
  if (!dateString || typeof dateString !== 'string') {
    return { date: null, isAmbiguous: false };
  }

  const clean = dateString.trim().split(' ')[0]; // Discard time if present

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return { date: `${year}-${month}-${day}`, isAmbiguous: false };
  }

  // 3-part date with delimiter: DD/MM/YYYY or MM/DD/YYYY
  const partsMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (partsMatch) {
    const first = parseInt(partsMatch[1], 10);
    const second = parseInt(partsMatch[2], 10);
    let year = partsMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }

    // Unambiguous: if first > 12, it MUST be day (DD/MM)
    if (first > 12 && second <= 12) {
      return { 
        date: `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`,
        isAmbiguous: false 
      };
    }
    // Unambiguous: if second > 12, it MUST be day (MM/DD)
    if (second > 12 && first <= 12) {
      return { 
        date: `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`,
        isAmbiguous: false 
      };
    }

    // Both first and second are <= 12: ambiguous format
    const isAmbiguous = (first !== second);
    if (preferredFormat === 'MM/DD/YYYY') {
      return {
        date: `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`,
        isAmbiguous
      };
    } else {
      // Default Indian banking convention: DD/MM/YYYY
      return {
        date: `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`,
        isAmbiguous
      };
    }
  }

  // Fallback to Date parser
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, isAmbiguous: false };
  }

  return { date: null, isAmbiguous: false };
}

/**
 * Validates a single parsed row using the column mapping.
 * 
 * @param {Record<string, string>} row 
 * @param {Record<string, string|null>} mapping 
 * @param {'DD/MM/YYYY'|'MM/DD/YYYY'} [dateFormat='DD/MM/YYYY']
 * @returns {{ valid: boolean, error?: string, parsedTransaction?: Object }}
 */
export function validateCsvRow(row, mapping, dateFormat = 'DD/MM/YYYY') {
  const rowNumber = row.__rowNumber || '?';

  // 1. Date Validation
  const rawDate = mapping.date ? row[mapping.date] : null;
  if (!rawDate) {
    return { valid: false, error: `Row ${rowNumber}: Date column is empty.` };
  }
  const { date: parsedDate } = parseDateString(rawDate, dateFormat);
  if (!parsedDate) {
    return { valid: false, error: `Row ${rowNumber}: Invalid date format "${rawDate}".` };
  }

  // 2. Amount and Type Resolution
  let finalAmount;
  let finalType;

  if (mapping.debit || mapping.credit) {
    // Separate debit/credit columns
    const debitVal = mapping.debit ? parseFloat(String(row[mapping.debit] || '').replace(/[^0-9.-]/g, '')) : 0;
    const creditVal = mapping.credit ? parseFloat(String(row[mapping.credit] || '').replace(/[^0-9.-]/g, '')) : 0;

    if (!isNaN(debitVal) && debitVal > 0) {
      finalAmount = debitVal;
      finalType = 'expense';
    } else if (!isNaN(creditVal) && creditVal > 0) {
      finalAmount = creditVal;
      finalType = 'income';
    } else {
      return { valid: false, error: `Row ${rowNumber}: Neither valid debit nor credit amount found.` };
    }
  } else if (mapping.amount) {
    const rawAmt = String(row[mapping.amount] || '').replace(/,/g, '').trim();
    const isNegative = rawAmt.startsWith('-') || rawAmt.startsWith('(');
    const cleanedAmt = parseFloat(rawAmt.replace(/[^0-9.]/g, ''));

    if (isNaN(cleanedAmt) || cleanedAmt <= 0) {
      return { valid: false, error: `Row ${rowNumber}: Invalid transaction amount "${row[mapping.amount]}".` };
    }
    finalAmount = cleanedAmt;

    // Check explicit type column if present
    if (mapping.type && row[mapping.type]) {
      const typeStr = String(row[mapping.type]).toLowerCase();
      if (typeStr.includes('income') || typeStr.includes('cr') || typeStr.includes('deposit') || typeStr.includes('credit')) {
        finalType = 'income';
      } else {
        finalType = 'expense';
      }
    } else {
      // If negative, it was income reversal or vice-versa; standard convention: negative is debit/expense
      finalType = isNegative ? 'expense' : 'expense';
    }
  } else {
    return { valid: false, error: `Row ${rowNumber}: No amount or debit/credit column mapped.` };
  }

  // 3. Merchant & Description Validation
  const rawMerchant = mapping.merchant ? String(row[mapping.merchant] || '').trim() : '';
  const rawDesc = mapping.description ? String(row[mapping.description] || '').trim() : '';
  
  const merchant = rawMerchant || rawDesc || 'Unknown Merchant';
  const description = rawDesc && rawDesc !== merchant ? rawDesc : '';

  // 4. Category
  const rawCategory = mapping.category ? String(row[mapping.category] || '').trim() : '';
  const category = rawCategory || 'Uncategorized';

  // 5. Bank reference ID
  const bankTxId = mapping.bankTxId ? String(row[mapping.bankTxId] || '').trim() : null;

  return {
    valid: true,
    parsedTransaction: {
      date: parsedDate,
      merchant,
      description,
      amount: finalAmount,
      type: finalType,
      category,
      currency: 'INR',
      bankTxId,
      source: 'csv_import',
      originalRowNumber: rowNumber
    }
  };
}

/**
 * Detects duplicates against existing user transactions.
 * Distinguishes exact duplicates (same date, amount, merchant) from possible duplicates.
 * 
 * @param {Array<Object>} candidates 
 * @param {Array<Object>} existingTransactions 
 * @returns {Array<{ row: Object, duplicateType: 'none'|'exact'|'possible', matchedTx?: Object }>}
 */
export function checkDuplicateTransactions(candidates, existingTransactions = []) {
  return candidates.map(candidate => {
    // 1. Bank Tx ID Check (Strongest match)
    if (candidate.bankTxId) {
      const bankMatch = existingTransactions.find(t => 
        t.bankTxId === candidate.bankTxId ||
        t.importMetadata?.bankTxId === candidate.bankTxId ||
        t.import_metadata?.bankTxId === candidate.bankTxId
      );
      if (bankMatch) {
        return { candidate, duplicateType: 'exact', matchedTx: bankMatch, reason: 'Matched Bank Transaction ID' };
      }
    }

    // 2. Exact Match: Same Date, Same Amount (Paise), and Same Merchant
    const candPaise = toPaise(candidate.amount);
    const candMerchant = candidate.merchant.toLowerCase().trim();

    const exactMatch = existingTransactions.find(t => {
      const tPaise = toPaise(t.amount);
      const tMerchant = (t.merchant || '').toLowerCase().trim();
      return t.date === candidate.date && tPaise === candPaise && tMerchant === candMerchant;
    });

    if (exactMatch) {
      return { candidate, duplicateType: 'exact', matchedTx: exactMatch, reason: 'Exact match (Date, Amount & Merchant)' };
    }

    // 3. Possible Duplicate: Same Date and Same Amount, but different merchant text
    const possibleMatch = existingTransactions.find(t => {
      const tPaise = toPaise(t.amount);
      return t.date === candidate.date && tPaise === candPaise;
    });

    if (possibleMatch) {
      return { 
        candidate, 
        duplicateType: 'possible', 
        matchedTx: possibleMatch, 
        reason: `Same date and amount as "${possibleMatch.merchant}"` 
      };
    }

    return { candidate, duplicateType: 'none' };
  });
}

/**
 * Generates an RFC 4180 compliant CSV template for users to populate.
 * 
 * @returns {string}
 */
export function generateSampleCsv() {
  const headers = ['Date', 'Merchant', 'Description', 'Amount', 'Type', 'Category', 'Reference ID'];
  const sampleRows = [
    ['2026-10-21', 'Swiggy', 'Dinner order', '450.00', 'expense', 'Food', 'UPI928374829'],
    ['2026-10-20', 'Amazon India', 'Office supplies', '1299.00', 'expense', 'Shopping', 'AMZ83920193'],
    ['2026-10-18', 'Uber Rides', 'Trip to airport', '650.00', 'expense', 'Travel', 'UBR92839201'],
    ['2026-10-01', 'Tech Mahindra', 'Monthly Salary', '85000.00', 'income', 'Salary', 'SAL82910382']
  ];

  const headerLine = headers.join(',');
  const rowLines = sampleRows.map(row => row.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Generates an exported CSV string from authenticated user transactions.
 * Protects against formula injection and supports active filters.
 * 
 * @param {Array<Object>} transactions 
 * @param {Object} [filters={}] 
 * @returns {string}
 */
export function generateTransactionsCsv(transactions, filters = {}) {
  let list = [...transactions];

  // Exclude demo transactions by default
  list = list.filter(t => !t.isDemo);

  // Apply optional filters
  if (filters.type && filters.type !== 'all') {
    list = list.filter(t => t.type === filters.type);
  }
  if (filters.category && filters.category !== 'All') {
    list = list.filter(t => (t.category || '').toLowerCase() === filters.category.toLowerCase());
  }
  if (filters.startDate) {
    list = list.filter(t => t.date >= filters.startDate);
  }
  if (filters.endDate) {
    list = list.filter(t => t.date <= filters.endDate);
  }

  // Sort newest first
  list.sort((a, b) => new Date(`${b.date} ${b.time || '12:00 PM'}`) - new Date(`${a.date} ${a.time || '12:00 PM'}`));

  const headers = [
    'Date',
    'Time',
    'Merchant',
    'Type',
    'Category',
    'Amount (INR)',
    'Payment Method',
    'Notes',
    'Source'
  ];

  const lines = [headers.join(',')];

  for (const tx of list) {
    const row = [
      escapeCsvCell(tx.date || ''),
      escapeCsvCell(tx.time || ''),
      escapeCsvCell(tx.merchant || ''),
      escapeCsvCell(tx.type || 'expense'),
      escapeCsvCell(tx.category || 'Uncategorized'),
      escapeCsvCell(Number(tx.amount || 0).toFixed(2)),
      escapeCsvCell(tx.paymentMethod || 'UPI'),
      escapeCsvCell(tx.notes || tx.note || ''),
      escapeCsvCell(tx.source || 'manual')
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers a browser download of a CSV file.
 * 
 * @param {string} csvContent 
 * @param {string} filename 
 */
export function downloadCsvFile(csvContent, filename = `finovo-transactions-${getTodayDateString()}.csv`) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
