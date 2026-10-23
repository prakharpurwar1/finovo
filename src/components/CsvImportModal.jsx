import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  X, UploadCloud, FileText, CheckCircle2, AlertCircle, 
  ArrowRight, ArrowLeft, Download, Loader2,
  Calendar, Tag, Layers, Check, ShieldAlert
} from 'lucide-react';
import { 
  parseCsv, 
  autoDetectMapping, 
  validateCsvRow, 
  checkDuplicateTransactions, 
  generateSampleCsv, 
  downloadCsvFile 
} from '../services/csvService.js';

export const CsvImportModal = ({
  isOpen,
  onClose,
  existingTransactions = [],
  onImportTransactions
}) => {
  // Wizard steps: 'upload' -> 'mapping' -> 'preview' -> 'complete'
  const [step, setStep] = useState('upload');
  
  // File state
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [parsedRawRows, setParsedRawRows] = useState([]);
  const [fileError, setFileError] = useState(null);

  // Column mapping state
  const [mapping, setMapping] = useState({
    date: null,
    merchant: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    type: null,
    category: null,
    bankTxId: null
  });

  // Date format state ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')
  const [preferredDateFormat, setPreferredDateFormat] = useState('DD/MM/YYYY');

  // Preview & selection state
  const [validatedRows, setValidatedRows] = useState([]); // array of { candidate, duplicateType, matchedTx, reason }
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [invalidRows, setInvalidRows] = useState([]);

  // Import execution state
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetAll = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setParsedRawRows([]);
    setFileError(null);
    setValidatedRows([]);
    setSelectedRowIndices(new Set());
    setInvalidRows([]);
    setIsImporting(false);
    setImportSummary(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // 1. File Upload Processing
  const processFile = (file) => {
    setFileError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setFileError('Please select a valid CSV file (.csv).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds the 5MB limit.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;

      const parsed = parseCsv(text);
      if (parsed.error || parsed.headers.length === 0) {
        setFileError(parsed.error || 'Failed to parse CSV headers.');
        return;
      }

      setHeaders(parsed.headers);
      setParsedRawRows(parsed.rows);

      // Auto-detect column mapping
      const detected = autoDetectMapping(parsed.headers);
      setMapping(detected);

      setStep('mapping');
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // 2. Validate Mapping & Advance to Preview
  const handleProceedToPreview = () => {
    if (!mapping.date) {
      setFileError('Please select a column for Date.');
      return;
    }
    if (!mapping.amount && !mapping.debit && !mapping.credit) {
      setFileError('Please select either an Amount column or Debit/Credit columns.');
      return;
    }
    setFileError(null);

    const validCandidates = [];
    const rejected = [];

    parsedRawRows.forEach(row => {
      const result = validateCsvRow(row, mapping, preferredDateFormat);
      if (result.valid) {
        validCandidates.push(result.parsedTransaction);
      } else {
        rejected.push({
          rowNumber: row.__rowNumber,
          error: result.error,
          data: row
        });
      }
    });

    const evaluatedDuplicates = checkDuplicateTransactions(validCandidates, existingTransactions);

    // Initialise selection: default-select 'none' and 'possible' duplicates, but uncheck 'exact' duplicates
    const initialSelected = new Set();
    evaluatedDuplicates.forEach((item, idx) => {
      if (item.duplicateType !== 'exact') {
        initialSelected.add(idx);
      }
    });

    setValidatedRows(evaluatedDuplicates);
    setSelectedRowIndices(initialSelected);
    setInvalidRows(rejected);
    setStep('preview');
  };

  // Toggle selection
  const toggleRowSelection = (index) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllValid = () => {
    const all = new Set(validatedRows.map((_, i) => i));
    setSelectedRowIndices(all);
  };

  const deselectExactDuplicates = () => {
    const nonDuplicates = new Set();
    validatedRows.forEach((item, i) => {
      if (item.duplicateType !== 'exact') {
        nonDuplicates.add(i);
      }
    });
    setSelectedRowIndices(nonDuplicates);
  };

  // 3. Execute Import
  const handleExecuteImport = async () => {
    const rowsToImport = validatedRows
      .filter((_, idx) => selectedRowIndices.has(idx))
      .map(item => item.candidate);

    if (rowsToImport.length === 0) {
      setFileError('No transactions selected for import.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await onImportTransactions(rowsToImport);
      setImportSummary({
        importedCount: result?.importedCount || rowsToImport.length,
        skippedCount: validatedRows.length - rowsToImport.length,
        rejectedCount: invalidRows.length,
        failedCount: result?.failedCount || 0
      });
      setStep('complete');
    } catch (err) {
      setFileError(err.message || 'Import failed. Please check network and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-modal-title"
        className="w-full max-w-xl bg-bg-card border border-brand-border rounded-2xl shadow-brand-xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between bg-bg-app/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center border border-brand-primary/20 shrink-0">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 id="csv-modal-title" className="text-base font-bold text-txt-primary">Import Transactions</h3>
              <p className="text-[11px] text-txt-secondary font-medium">Bank statements & CSV files</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-bg-app border border-brand-border flex items-center justify-center text-txt-secondary hover:text-txt-primary cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step Progress Pill Indicator */}
        <div className="px-6 py-2.5 bg-bg-app/20 border-b border-brand-border/60 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-txt-secondary shrink-0">
          <span className={step === 'upload' ? 'text-brand-primary' : ''}>1. Upload</span>
          <span>&rarr;</span>
          <span className={step === 'mapping' ? 'text-brand-primary' : ''}>2. Map Columns</span>
          <span>&rarr;</span>
          <span className={step === 'preview' ? 'text-brand-primary' : ''}>3. Review & Import</span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {fileError && (
            <div className="p-3 bg-brand-error/10 border border-brand-error/20 text-brand-error text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-5 text-center">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-brand-border hover:border-brand-primary/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-bg-app/40 hover:bg-bg-app/70 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud size={28} />
                </div>
                <h4 className="text-sm font-bold text-txt-primary mb-1">Choose a CSV file or drag & drop here</h4>
                <p className="text-xs text-txt-secondary max-w-sm mb-3">
                  Supports bank statements from HDFC, SBI, ICICI, Axis, Paytm, or custom exported CSV files up to 5MB.
                </p>
                <span className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-sm group-hover:opacity-95">
                  Browse File
                </span>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv,text/csv" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
              </div>

              {/* Sample Template Download */}
              <div className="flex items-center justify-between p-3.5 bg-bg-app border border-brand-border rounded-xl text-left">
                <div className="flex items-center gap-2.5">
                  <FileText size={18} className="text-brand-primary shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-txt-primary">Need a format to start?</h5>
                    <p className="text-[11px] text-txt-secondary">Download our recommended CSV template</p>
                  </div>
                </div>
                <button
                  onClick={() => downloadCsvFile(generateSampleCsv(), 'finovo-sample-template.csv')}
                  className="px-3 py-1.5 bg-bg-card hover:bg-bg-app border border-brand-border text-txt-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-brand-sm"
                >
                  <Download size={13} /> Sample CSV
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-txt-primary uppercase tracking-wider">Map CSV Columns</h4>
                  <p className="text-[11px] text-txt-secondary">Found {headers.length} columns in "{fileName}"</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-txt-secondary">Date Format:</span>
                  <select 
                    value={preferredDateFormat} 
                    onChange={(e) => setPreferredDateFormat(e.target.value)}
                    className="bg-bg-app border border-brand-border rounded-lg px-2 py-1 text-xs font-semibold text-txt-primary outline-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* Date Mapping */}
                <div className="p-3 bg-bg-app border border-brand-border rounded-xl flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                      <Calendar size={13} className="text-brand-primary" /> Date Column <span className="text-brand-error">*</span>
                    </label>
                    <p className="text-[10px] text-txt-secondary">Date of the transaction</p>
                  </div>
                  <select 
                    value={mapping.date || ''} 
                    onChange={(e) => setMapping(prev => ({ ...prev, date: e.target.value || null }))}
                    className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs font-semibold text-txt-primary outline-none max-w-[200px]"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Merchant / Description Mapping */}
                <div className="p-3 bg-bg-app border border-brand-border rounded-xl flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                      <Tag size={13} className="text-brand-primary" /> Merchant / Description <span className="text-brand-error">*</span>
                    </label>
                    <p className="text-[10px] text-txt-secondary">Payee, vendor or transaction narration</p>
                  </div>
                  <select 
                    value={mapping.merchant || ''} 
                    onChange={(e) => setMapping(prev => ({ ...prev, merchant: e.target.value || null }))}
                    className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs font-semibold text-txt-primary outline-none max-w-[200px]"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Amount OR Debit/Credit Mode */}
                <div className="p-3 bg-bg-app border border-brand-border rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                        <Layers size={13} className="text-brand-primary" /> Single Amount Column
                      </label>
                      <p className="text-[10px] text-txt-secondary">If file has one unified amount column</p>
                    </div>
                    <select 
                      value={mapping.amount || ''} 
                      onChange={(e) => setMapping(prev => ({ ...prev, amount: e.target.value || null, debit: null, credit: null }))}
                      className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs font-semibold text-txt-primary outline-none max-w-[200px]"
                    >
                      <option value="">-- Optional / None --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="border-t border-brand-border/60 pt-2 flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-txt-primary">Or Separate Debit & Credit</label>
                      <p className="text-[10px] text-txt-secondary">Traditional bank statement columns</p>
                    </div>
                    <div className="flex gap-2">
                      <select 
                        value={mapping.debit || ''} 
                        onChange={(e) => setMapping(prev => ({ ...prev, debit: e.target.value || null, amount: null }))}
                        className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-1 text-xs font-semibold text-txt-primary outline-none max-w-[120px]"
                      >
                        <option value="">Debit (Dr)</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select 
                        value={mapping.credit || ''} 
                        onChange={(e) => setMapping(prev => ({ ...prev, credit: e.target.value || null, amount: null }))}
                        className="bg-bg-card border border-brand-border rounded-lg px-2.5 py-1 text-xs font-semibold text-txt-primary outline-none max-w-[120px]"
                      >
                        <option value="">Credit (Cr)</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Optional Category & Reference ID */}
                <div className="p-3 bg-bg-app border border-brand-border rounded-xl flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-txt-primary">Category Column (Optional)</label>
                    <p className="text-[10px] text-txt-secondary">Pre-assigned category if provided</p>
                  </div>
                  <select 
                    value={mapping.category || ''} 
                    onChange={(e) => setMapping(prev => ({ ...prev, category: e.target.value || null }))}
                    className="bg-bg-card border border-brand-border rounded-lg px-3 py-1.5 text-xs font-semibold text-txt-primary outline-none max-w-[200px]"
                  >
                    <option value="">-- Auto-Categorize --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & DUPLICATE REVIEW */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 bg-bg-app border border-brand-border rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-txt-secondary">Selected Rows</span>
                  <p className="text-base font-bold text-brand-primary">{selectedRowIndices.size} / {validatedRows.length}</p>
                </div>
                <div className="p-2.5 bg-bg-app border border-brand-border rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-txt-secondary">Exact Duplicates</span>
                  <p className="text-base font-bold text-amber-500">
                    {validatedRows.filter(r => r.duplicateType === 'exact').length}
                  </p>
                </div>
                <div className="p-2.5 bg-bg-app border border-brand-border rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-txt-secondary">Invalid Rows</span>
                  <p className="text-base font-bold text-brand-error">{invalidRows.length}</p>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2">
                  <button 
                    onClick={selectAllValid} 
                    className="text-[11px] font-bold text-brand-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-txt-secondary">•</span>
                  <button 
                    onClick={deselectExactDuplicates} 
                    className="text-[11px] font-bold text-txt-secondary hover:text-txt-primary cursor-pointer"
                  >
                    Deselect Exact Duplicates
                  </button>
                </div>
                <span className="text-[10px] text-txt-secondary">
                  Unchecked rows will be safely skipped
                </span>
              </div>

              {/* Parsed Rows List */}
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 border border-brand-border rounded-xl p-2 bg-bg-app/40">
                {validatedRows.map((item, index) => {
                  const isSelected = selectedRowIndices.has(index);
                  const isExact = item.duplicateType === 'exact';
                  const isPossible = item.duplicateType === 'possible';

                  return (
                    <div 
                      key={index}
                      onClick={() => toggleRowSelection(index)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-bg-card border-brand-primary/40 shadow-brand-sm' 
                          : 'bg-bg-app/80 border-brand-border opacity-65'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                          isSelected ? 'bg-brand-primary text-white border-brand-primary' : 'border-brand-border'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-txt-primary">{item.candidate.merchant}</span>
                            {isExact && (
                              <span className="px-1.5 py-0.2 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold uppercase shrink-0">
                                Exact Duplicate
                              </span>
                            )}
                            {isPossible && (
                              <span className="px-1.5 py-0.2 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded text-[9px] font-bold uppercase shrink-0">
                                Possible Duplicate
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-txt-secondary">
                            {item.candidate.date} • {item.candidate.category}
                            {item.reason ? ` (${item.reason})` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className={`font-bold ${item.candidate.type === 'income' ? 'text-brand-success' : 'text-txt-primary'}`}>
                          {item.candidate.type === 'income' ? '+' : '-'}₹{Number(item.candidate.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Show invalid/rejected rows if any */}
                {invalidRows.length > 0 && (
                  <div className="pt-2">
                    <h5 className="text-[10px] font-bold uppercase text-brand-error mb-1.5 flex items-center gap-1">
                      <ShieldAlert size={12} /> Rejected Rows ({invalidRows.length})
                    </h5>
                    {invalidRows.map((rej, i) => (
                      <div key={i} className="p-2 bg-brand-error/5 border border-brand-error/20 rounded-lg text-[10px] text-brand-error mb-1">
                        Row {rej.rowNumber}: {rej.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === 'complete' && importSummary && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-brand-success/10 text-brand-success flex items-center justify-center mx-auto border border-brand-success/20">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-txt-primary">Import Completed</h4>
                <p className="text-xs text-txt-secondary mt-1">Transactions have been saved to your ledger.</p>
              </div>

              <div className="p-4 bg-bg-app border border-brand-border rounded-xl max-w-sm mx-auto space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-txt-secondary">Successfully Imported:</span>
                  <span className="font-bold text-brand-success">{importSummary.importedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-secondary">Skipped Duplicates:</span>
                  <span className="font-bold text-txt-primary">{importSummary.skippedCount}</span>
                </div>
                {importSummary.rejectedCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-txt-secondary">Rejected Invalid Rows:</span>
                    <span className="font-bold text-brand-error">{importSummary.rejectedCount}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleClose}
                className="w-full max-w-xs px-4 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-brand-md cursor-pointer hover:opacity-95"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {step !== 'complete' && (
          <div className="p-4 border-t border-brand-border flex items-center justify-between bg-bg-app/40 shrink-0">
            {step === 'upload' ? (
              <button 
                onClick={handleClose}
                className="px-4 py-2 border border-brand-border text-txt-secondary hover:text-txt-primary text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button 
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                className="px-4 py-2 border border-brand-border text-txt-secondary hover:text-txt-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}

            {step === 'mapping' && (
              <button 
                onClick={handleProceedToPreview}
                className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-brand-sm hover:opacity-95"
              >
                Next: Review Rows <ArrowRight size={13} />
              </button>
            )}

            {step === 'preview' && (
              <button 
                disabled={isImporting || selectedRowIndices.size === 0}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-brand-sm hover:opacity-95 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    Import {selectedRowIndices.size} Transaction{selectedRowIndices.size === 1 ? '' : 's'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CsvImportModal;
