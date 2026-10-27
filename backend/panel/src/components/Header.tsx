import React, { useEffect, useState } from 'react';
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

  // A soft shadow appears once the page scrolls under the bar
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayName = user?.fullName || user?.email || 'Staff';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header
      className={`vt-header sticky top-0 z-30 h-16 backdrop-blur-md border-b px-4 sm:px-8 flex items-center justify-between gap-3 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? 'bg-white/80 dark:bg-black/75 border-slate-200 dark:border-slate-800/80 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.18)] dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.8)]'
          : 'bg-white/95 dark:bg-black/95 border-slate-200/70 dark:border-slate-800/50 shadow-none'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:hidden transition"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate md:hidden">Clyvus Ventures</p>
          <p className="hidden md:block text-xs font-medium text-slate-500 dark:text-slate-400">
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
          {/* Sun and moon swap with a spin */}
          <span className="relative w-4 h-4 flex-shrink-0" aria-hidden="true">
            <Sun
              className={`absolute inset-0 w-4 h-4 text-amber-400 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
              }`}
            />
            <Moon
              className={`absolute inset-0 w-4 h-4 text-brand-600 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
              }`}
            />
          </span>
          <span className="hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
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
