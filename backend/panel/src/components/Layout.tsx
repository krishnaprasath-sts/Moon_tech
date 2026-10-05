import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen min-w-0">
        <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {/* A crash inside one page keeps the navigation usable; the boundary resets on navigation */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        <footer className="py-4 px-4 sm:px-8 border-t border-slate-200 dark:border-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400">
          Moon Tech Solutions &copy; {new Date().getFullYear()} &bull; Investment Admin Panel
        </footer>
      </div>
    </div>
  );
};
