import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Calendar, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BRAND = '#3b82f6';

interface RegistrationChartProps {
  data: Array<{ date: string; count: number }>;
}

const formatTickDate = (str: string) => {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length === 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${MONTHS[monthIndex] || parts[1]} ${day}`;
  }
  return str;
};

const formatTooltipDate = (str: string) => {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, monthIndex, day);
    if (Number.isNaN(d.getTime())) return str;
    return `${DAYS[d.getDay()]}, ${MONTHS[monthIndex]} ${day}, ${year}`;
  }
  return str;
};

export const RegistrationChart: React.FC<RegistrationChartProps> = ({ data }) => {
  const { isDark } = useTheme();

  const safeData = (data || []).map((d) => ({ date: d.date, count: Number(d.count) || 0 }));
  const total = safeData.reduce((acc, curr) => acc + curr.count, 0);
  const dailyAvg = safeData.length > 0 ? (total / safeData.length).toFixed(1) : '0';
  const peak = safeData.reduce((max, curr) => (curr.count > max ? curr.count : max), 0);

  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full flex flex-col">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            {total.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">New Customers</span>
        </div>
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{dailyAvg}</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Daily Avg</span>
        </div>
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-brand-600 dark:text-brand-400 font-mono">{peak}</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Peak Day</span>
        </div>
      </div>

      {safeData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-500">
          No registrations recorded in the last 7 days.
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.38} />
                  <stop offset="60%" stopColor={BRAND} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={tickColor}
                tick={{ fill: tickColor }}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                tickFormatter={formatTickDate}
              />
              <YAxis
                stroke={tickColor}
                tick={{ fill: tickColor }}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: gridColor }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const val = Number(payload[0].value || 0);
                    const sharePct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
                    return (
                      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[150px]">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium mb-1.5">
                          <Calendar className="w-3 h-3 text-brand-500" />
                          <span>{formatTooltipDate(String(label))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-brand-500 ring-2 ring-brand-500/20" />
                            <span className="text-slate-700 dark:text-slate-300 font-medium">New Customers</span>
                          </div>
                          <span className="font-mono font-black text-slate-900 dark:text-white text-sm">{val}</span>
                        </div>
                        {total > 0 && (
                          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                            {sharePct}% of 7-day total
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="New Customers"
                stroke={BRAND}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#regGradient)"
                activeDot={{ r: 5, fill: BRAND, stroke: isDark ? '#000000' : '#ffffff', strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

interface KycDistributionChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

// One distinct colour per KYC state, matching the KycStatusBadge palette
const STATUS_COLORS: Record<string, string> = {
  Verified: '#10b981',
  Pending: '#f59e0b',
  'Under Review': '#0ea5e9',
  Rejected: '#f43f5e',
  Resubmit: '#f97316',
  Resubmission: '#f97316',
  Suspended: '#e11d48',
  Draft: '#94a3b8',
};

const sliceColor = (name: string, fallback?: string) => STATUS_COLORS[name] || fallback || '#94a3b8';

export const KycDistributionChart: React.FC<KycDistributionChartProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const safeData = (data || []).map((d) => ({ ...d, value: Number(d.value) || 0 }));
  const total = safeData.reduce((acc, curr) => acc + curr.value, 0);
  const pieData = safeData.filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No KYC records yet</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
          The breakdown fills in as customers submit their KYC documents.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className="relative h-48 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={80}
              paddingAngle={pieData.length > 1 ? 4 : 0}
              cornerRadius={4}
              dataKey="value"
              nameKey="name"
              onMouseEnter={(entry) => setHoveredName(entry.name)}
              onMouseLeave={() => setHoveredName(null)}
              animationDuration={600}
            >
              {pieData.map((entry) => {
                const isSelected = hoveredName === entry.name;
                const isDimmed = hoveredName !== null && !isSelected;
                return (
                  <Cell
                    key={entry.name}
                    fill={sliceColor(entry.name, entry.color)}
                    stroke={isDark ? '#000000' : '#ffffff'}
                    strokeWidth={3}
                    opacity={isDimmed ? 0.35 : 1}
                    style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0];
                  const item = entry.payload as { name: string; color?: string };
                  const count = Number(entry.value || 0);
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl text-xs min-w-[150px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sliceColor(item.name, item.color) }}
                        />
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
                          <span>Applications:</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">{count}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
                          <span>Share:</span>
                          <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">{percentage}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {safeData.map((item) => {
          const isSelected = hoveredName === item.name;
          const isDimmed = hoveredName !== null && !isSelected;
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

          return (
            <div
              key={item.name}
              onMouseEnter={() => setHoveredName(item.name)}
              onMouseLeave={() => setHoveredName(null)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-slate-100 dark:bg-slate-800 border-brand-500/50 shadow-sm'
                  : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60'
              } ${isDimmed ? 'opacity-35' : 'opacity-100'}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sliceColor(item.name, item.color) }}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 pl-1 flex-shrink-0">
                <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">{item.value}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
