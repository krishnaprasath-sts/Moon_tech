import React, { useState, useId } from 'react';
import {
  FileBarChart,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Users,
  Wallet,
  TrendingUp,
  IndianRupee,
  CalendarClock,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  LucideIcon,
} from 'lucide-react';
import { useFinanceReport, UseFinanceReportParams } from '../hooks';
import { financeApi, ReportDownloadFormat } from '../api';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { ReportCellType, ReportCellValue, ReportType } from '../types';
import { btnPrimaryClass, btnSecondaryClass, filterCardClass, selectClass, tableCardClass, theadClass, tbodyClass, trClass } from '../components/ui';
import {
  formatINR,
  formatDateTime,
  formatDateOnly,
  formatNumber,
  getApiErrorMessage,
  getBlobErrorMessage,
  downloadBlob,
} from '../utils/finance';

const REPORT_TYPES: Array<{ id: ReportType; label: string; description: string; icon: LucideIcon }> = [
  { id: 'users', label: 'User Report', description: 'Registered customers and balances', icon: Users },
  { id: 'wallet', label: 'Wallet Report', description: 'Wallet balances per customer', icon: Wallet },
  { id: 'investments', label: 'Investment Report', description: 'All investments created', icon: TrendingUp },
  { id: 'profit', label: 'Profit Report', description: 'Profit paid to customers', icon: IndianRupee },
  { id: 'maturity', label: 'Maturity Report', description: 'Investments by maturity date', icon: CalendarClock },
  { id: 'withdrawals', label: 'Withdrawal Report', description: 'Withdrawal requests and payouts', icon: Banknote },
  { id: 'payments', label: 'Payment Report', description: 'UPI payment submissions', icon: CreditCard },
  { id: 'transactions', label: 'Date-wise Transactions', description: 'Wallet ledger entries', icon: ArrowLeftRight },
];

const formatCell = (value: ReportCellValue, type: ReportCellType | 'money' | 'number' | 'text'): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  switch (type) {
    case 'money':
      return formatINR(value);
    case 'date':
      return formatDateTime(String(value));
    case 'number':
      return formatNumber(value);
    default:
      return String(value);
  }
};

export const ReportsPage: React.FC = () => {
  const id = useId();
  const [reportType, setReportType] = useState<ReportType>('investments');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [request, setRequest] = useState<UseFinanceReportParams | null>(null);
  const [downloading, setDownloading] = useState<ReportDownloadFormat | null>(null);

  const { toast } = useToast();
  const { data: report, isFetching, isError, error, refetch } = useFinanceReport(request);

  const isDateRangeInvalid = !!startDate && !!endDate && startDate > endDate;
  const selectedType = REPORT_TYPES.find((t) => t.id === reportType);

  const handleGenerate = () => {
    if (isDateRangeInvalid) {
      toast.error('Start date cannot be after the end date');
      return;
    }
    setRequest({
      type: reportType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      requestId: Date.now(),
    });
  };

  const handleDownload = async (format: ReportDownloadFormat) => {
    if (downloading) return;
    if (isDateRangeInvalid) {
      toast.error('Start date cannot be after the end date');
      return;
    }

    const formatLabel = format.toUpperCase();
    setDownloading(format);
    try {
      const blob = await financeApi.downloadReport(
        reportType,
        { startDate: startDate || undefined, endDate: endDate || undefined },
        format
      );
      const range = startDate || endDate ? `_${startDate || 'start'}_to_${endDate || 'today'}` : '';
      downloadBlob(blob, `${reportType}_report${range}.${format}`);
      toast.success(`${selectedType?.label || 'Report'} downloaded as ${formatLabel}`, 'Download complete');
    } catch (err) {
      toast.error(await getBlobErrorMessage(err, `Failed to download the ${formatLabel} report`));
    } finally {
      setDownloading(null);
    }
  };

  // The table on screen belongs to the last generated request, not the current selection
  const isStale =
    !!request &&
    (request.type !== reportType || (request.startDate || '') !== startDate || (request.endDate || '') !== endDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate user, wallet, investment, profit, maturity, withdrawal, payment and transaction reports, on screen or as CSV / PDF."
      />

      {/* Report type */}
      <div role="radiogroup" aria-label="Report type" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          const isActive = reportType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setReportType(type.id)}
              className={`p-4 rounded-2xl border text-left transition ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-500 shadow-sm'
                  : 'bg-white dark:bg-[#000000] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 mb-2 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">{type.label}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{type.description}</p>
            </button>
          );
        })}
      </div>

      {/* Date range & actions */}
      <div className={`${filterCardClass} flex flex-col md:flex-row md:items-end gap-3`}>
        <div>
          <label htmlFor={`${id}-start`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Start date
          </label>
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className={`${selectClass} w-full`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
            End date
          </label>
          <input
            id={`${id}-end`}
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={`${selectClass} w-full`}
          />
        </div>
        {isDateRangeInvalid && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 md:self-center" role="alert">
            Start date cannot be after the end date
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2.5 md:ml-auto">
          <button
            type="button"
            onClick={() => handleDownload('csv')}
            disabled={!!downloading || isDateRangeInvalid}
            aria-busy={downloading === 'csv'}
            className={btnSecondaryClass}
          >
            {downloading === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={!!downloading || isDateRangeInvalid}
            aria-busy={downloading === 'pdf'}
            className={btnSecondaryClass}
          >
            {downloading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Download PDF
          </button>
          <button type="button" onClick={handleGenerate} disabled={isFetching || isDateRangeInvalid} className={btnPrimaryClass}>
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileBarChart className="w-3.5 h-3.5" />}
            Generate
          </button>
        </div>
      </div>

      {/* Output */}
      {!request ? (
        <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <FileBarChart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No report generated yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose a report type and an optional date range, then click Generate.
          </p>
        </div>
      ) : isFetching ? (
        <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-400 shadow-sm" role="status">
          <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-2" />
          Generating report...
        </div>
      ) : isError || !report ? (
        <div role="alert" className="p-8 text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">{getApiErrorMessage(error, 'Failed to generate the report')}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Adjust the filters or try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">{report.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.startDate || report.endDate
                  ? `${report.startDate ? formatDateOnly(report.startDate) : 'Beginning'} to ${
                      report.endDate ? formatDateOnly(report.endDate) : 'today'
                    }`
                  : 'All dates'}{' '}
                • {formatNumber(report.rows.length)} rows • Generated {formatDateTime(report.generatedAt)}
              </p>
            </div>
            {isStale && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Filters changed - click Generate to refresh
              </span>
            )}
          </div>

          {report.summary?.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {report.summary.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className="rounded-2xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm dark:shadow-lg"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="text-xl font-bold mt-1 tracking-tight tabular-nums text-slate-900 dark:text-white break-words">
                    {formatCell(item.value, item.type)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {report.truncated && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                This report is limited to the first 5,000 rows (on screen and in the CSV / PDF downloads). Narrow the
                date range to see every row.
              </span>
            </div>
          )}

          <div className={tableCardClass}>
            <div className="overflow-auto max-h-[640px]">
              <table className="w-full text-left text-xs">
                <thead className={`sticky top-0 z-10 ${theadClass} bg-slate-50 dark:bg-[#0c1017]`}>
                  <tr>
                    {report.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`py-3.5 px-4 whitespace-nowrap ${col.type === 'money' || col.type === 'number' ? 'text-right' : ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={tbodyClass}>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, report.columns.length)} className="text-center py-12 text-slate-500">
                        No records found for this report and date range.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, idx) => (
                      <tr key={idx} className={trClass}>
                        {report.columns.map((col) => (
                          <td
                            key={col.key}
                            className={`py-3 px-4 whitespace-nowrap ${
                              col.type === 'money' || col.type === 'number'
                                ? 'text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {formatCell(row[col.key], col.type)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
