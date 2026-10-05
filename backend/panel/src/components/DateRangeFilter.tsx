import React, { useId } from 'react';
import { X } from 'lucide-react';
import { selectClass } from './ui';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

// Inclusive YYYY-MM-DD range that maps directly onto the API's startDate / endDate filters
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ startDate, endDate, onChange }) => {
  const id = useId();
  const hasValue = !!(startDate || endDate);

  return (
    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
      <label htmlFor={`${id}-start`} className="sr-only">
        Start date
      </label>
      <input
        id={`${id}-start`}
        type="date"
        value={startDate}
        max={endDate || undefined}
        onChange={(e) => onChange(e.target.value, endDate)}
        className={`${selectClass} flex-1 md:flex-none min-w-0`}
      />
      <span className="text-slate-400 text-xs" aria-hidden="true">
        to
      </span>
      <label htmlFor={`${id}-end`} className="sr-only">
        End date
      </label>
      <input
        id={`${id}-end`}
        type="date"
        value={endDate}
        min={startDate || undefined}
        onChange={(e) => onChange(startDate, e.target.value)}
        className={`${selectClass} flex-1 md:flex-none min-w-0`}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          aria-label="Clear date range"
          title="Clear date range"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
