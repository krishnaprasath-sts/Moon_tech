import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';

const COLLAPSED_KEY = 'panel_sidebar_collapsed';

/** Saved choice; without one, narrower laptops (under 1280px) start with icons only so pages keep their room */
function readCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch {
    /* storage blocked: fall through to the screen-width default */
  }
  return window.innerWidth < 1280;
}

export const Layout: React.FC = () => {
  // Mobile: drawer open / closed. Desktop: full sidebar or icons only (remembered on this device).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage blocked: still works for this visit */
      }
      return next;
    });
  }, []);

  // Ctrl + B (Cmd + B on Mac) collapses / expands the desktop sidebar
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'b') {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
        event.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white transition-colors duration-300">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <div
        className={`flex flex-col flex-1 min-h-screen min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          collapsed ? 'md:pl-[72px]' : 'md:pl-64'
        }`}
      >
        <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {/* A crash inside one page keeps the navigation usable; the boundary resets on navigation */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        <footer className="py-4 px-4 sm:px-8 border-t border-slate-200 dark:border-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
          Clyvus Ventures &copy; {new Date().getFullYear()} &bull; Investment Admin Panel
        </footer>
      </div>
    </div>
  );
};
