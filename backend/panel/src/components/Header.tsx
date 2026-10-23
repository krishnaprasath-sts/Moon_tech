import React from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RoleBadge } from './RoleBadge';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const displayName = user?.fullName || user?.email || 'Staff';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#000000]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 flex items-center justify-between gap-3 transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl lg:hidden transition"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate lg:hidden">Moon Tech</p>
          <p className="hidden lg:block text-xs font-medium text-slate-500 dark:text-slate-400">
            Investment Admin Console
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-brand-600" />
              <span className="hidden md:inline">Dark</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800 min-w-0">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand-500/20 flex-shrink-0"
          >
            {initial}
          </div>
          <div className="hidden md:block text-right min-w-0">
            {/* <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{displayName}</p> */}
            {user?.role && <RoleBadge role={user.role} className="mt-0.5" />}
          </div>
        </div>
      </div>
    </header>
  );
};
