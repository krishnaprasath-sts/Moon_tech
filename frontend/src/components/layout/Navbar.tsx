"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Moon, Sun, Menu, X, UserRound } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

/** Dispatch on window after reading notifications so the bell badge refreshes immediately. */
export const NOTIFICATIONS_CHANGED_EVENT = 'moontech-notifications-changed';

const UNREAD_POLL_INTERVAL_MS = 60_000;

// Visitors see the training company; plan pages appear only after login
const VISITOR_LINKS = [
  { label: 'Courses', href: '/#programs' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Why Clyvus Ventures', href: '/#why-us' },
  { label: 'FAQ', href: '/#faq' },
];

const CUSTOMER_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Plans', href: '/plans' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Investments', href: '/investments' },
  { label: 'Referrals', href: '/referrals' },
];

function useUnreadCount(token: string | null): number {
  const [result, setResult] = useState<{ token: string; count: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      api
        .getUnreadCount(token)
        .then((count) => {
          if (active) setResult({ token, count });
        })
        .catch(() => {
          // Background refresh: keep the last known count on failure
        });
    };

    refresh();
    const timer = window.setInterval(refresh, UNREAD_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [token]);

  // Keyed by token so a logout (or a different session) never shows a stale badge
  return result && result.token === token ? result.count : 0;
}

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { token, logout } = useAuth({ required: false });
  // Remembering the path the menu was opened on closes it automatically on navigation
  const [menu, setMenu] = useState<{ open: boolean; path: string }>({ open: false, path: '' });
  const mobileMenuOpen = menu.open && menu.path === pathname;

  const closeMenu = () => setMenu({ open: false, path: '' });

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu({ open: false, path: '' });
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileMenuOpen]);

  // A soft shadow appears once the page scrolls under the bar
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAuthenticated = Boolean(token);
  const unreadCount = useUnreadCount(token);
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const navLinks = isAuthenticated ? CUSTOMER_LINKS : VISITOR_LINKS;
  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  // Sun and moon swap with a spin
  const themeIcon = (
    <span className="relative block w-4 h-4" aria-hidden="true">
      <Sun
        className={`absolute inset-0 w-4 h-4 text-amber-400 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
        }`}
      />
      <Moon
        className={`absolute inset-0 w-4 h-4 text-zinc-700 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      />
    </span>
  );

  const bell = (
    <Link
      href="/notifications"
      onClick={closeMenu}
      className="relative p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04] rounded-lg transition"
      title="Notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {unreadLabel}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <header
        className={`vt-site-header sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-[background-color,border-color,box-shadow] duration-300 ${
          scrolled || mobileMenuOpen
            ? 'bg-white/85 dark:bg-[#09090b]/85 border-zinc-200/80 dark:border-white/[0.08] shadow-lg shadow-zinc-900/[0.06] dark:shadow-black/60'
            : 'bg-white/60 dark:bg-[#09090b]/60 border-transparent shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Custom Brand Logo */}
            <Logo size="md" className="min-w-0" />

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6" aria-label="Main">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative py-1 text-[13px] font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-blue-600 dark:text-white font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                    }`}
                  >
                    {link.label}
                    {/* Underline that slides out from the centre on hover, and stays on the current page */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400 origin-center transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right Actions */}
            <div className="hidden lg:flex items-center gap-2">
              {/* Adaptive Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04] rounded-lg transition cursor-pointer"
                title={themeLabel}
                aria-label={themeLabel}
              >
                {themeIcon}
              </button>

              {isAuthenticated && bell}

              <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 mx-1" />

              {isAuthenticated ? (
                <>
                  <Link href="/profile" className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 px-4 py-1.5 rounded-full transition active:scale-95 shadow-sm">
                    <UserRound className="w-3.5 h-3.5" />
                    My profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 px-2.5 py-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white px-3 py-1.5 transition">Log in</Link>
                  <Link href="/register" className="text-[13px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 px-4 py-1.5 rounded-full transition active:scale-95 shadow-sm">Get Started</Link>
                </>
              )}
            </div>

            {/* Mobile Actions */}
            <div className="flex lg:hidden items-center gap-0.5 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeLabel}
                className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                {themeIcon}
              </button>
              {isAuthenticated && bell}
              <button
                type="button"
                onClick={() => setMenu(mobileMenuOpen ? { open: false, path: '' } : { open: true, path: pathname })}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <span className="relative block w-5 h-5" aria-hidden="true">
                  <Menu
                    className={`absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-300 ${
                      mobileMenuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
                    }`}
                  />
                  <X
                    className={`absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-300 ${
                      mobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
                    }`}
                  />
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown: slides open (height animates via grid rows); hidden from keyboard and screen readers when closed */}
        <div
          className={`lg:hidden grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            mobileMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
          inert={!mobileMenuOpen}
        >
          <div className="overflow-hidden min-h-0">
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="bg-white dark:bg-[#0c0c0e] border-b border-zinc-200 dark:border-white/[0.08] px-4 pt-3 pb-6 space-y-1"
          >
            {navLinks.map((link, index) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={closeMenu}
                aria-current={pathname === link.href ? 'page' : undefined}
                style={{ transitionDelay: mobileMenuOpen ? `${60 + index * 35}ms` : '0ms' }}
                className={`block text-sm font-medium py-2 transition-[opacity,transform,color] duration-300 ${
                  mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                } ${
                  pathname === link.href
                    ? 'text-blue-600 dark:text-white font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <Link
                  href="/notifications"
                  onClick={closeMenu}
                  className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white py-2"
                >
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadLabel}
                    </span>
                  )}
                </Link>
                <Link
                  href="/calculator"
                  onClick={closeMenu}
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white py-2"
                >
                  Returns Calculator
                </Link>
              </>
            )}
            <div className="pt-4 mt-2 border-t border-zinc-200 dark:border-white/[0.08] flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link href="/profile" onClick={closeMenu} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg"><UserRound className="w-3.5 h-3.5" />Profile</Link>
                  <button type="button" onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-lg"><LogOut className="w-3.5 h-3.5" />Log out</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={closeMenu} className="flex-1 text-center py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/10 rounded-lg">Log in</Link>
                  <Link href="/register" onClick={closeMenu} className="flex-1 text-center py-2 text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg">Get Started</Link>
                </>
              )}
            </div>
          </nav>
          </div>
        </div>
      </header>

    </>
  );
};
