"use client";

import React from 'react';
import Link from 'next/link';
import { Logo } from '../brand/Logo';
import { useAuth } from '@/lib/useAuth';

const TRAINING_LINKS = [
  { label: 'Programs', href: '/#programs' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Why MoonTech', href: '/#why-us' },
  { label: 'FAQ', href: '/#faq' },
];

const ACCOUNT_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Investment plans', href: '/plans' },
  { label: 'My investments', href: '/investments' },
  { label: 'Profile & bank details', href: '/profile' },
];

const VISITOR_LINKS = [
  { label: 'Log in', href: '/login' },
  { label: 'Create account', href: '/register' },
];

const linkClass = 'hover:text-zinc-950 dark:hover:text-white transition';

export const Footer: React.FC = () => {
  const { token } = useAuth({ required: false });
  const accountLinks = token ? ACCOUNT_LINKS : VISITOR_LINKS;

  return (
    <footer className="border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#09090b] text-zinc-600 dark:text-zinc-400 text-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-3">
            <Logo size="md" />
            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed max-w-sm pt-1">
              MoonTech Solutions provides stock market and trading training: foundations, technical analysis,
              derivatives and live mentorship for beginners and working professionals.
            </p>
            <div className="text-[11px] text-zinc-500 pt-2 font-mono">
              © {new Date().getFullYear()} MoonTech Solutions. All rights reserved.
            </div>
          </div>

          {/* Training */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Training</h4>
            <ul className="space-y-2 text-xs">
              {TRAINING_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Legal</h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <Link href="/terms" className={linkClass}>
                  Terms &amp; conditions
                </Link>
              </li>
              <li>Privacy policy</li>
              <li>Risk disclosure</li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              {token ? 'My account' : 'Account'}
            </h4>
            <ul className="space-y-2 text-xs">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-white/[0.04] text-[11px] text-zinc-500 leading-relaxed">
          <p>
            Disclaimer: training content is for education only and is not financial advice or a recommendation to buy or
            sell any security. Trading in the stock market carries risk, including the possible loss of capital. Consider
            your financial situation before you trade.
          </p>
        </div>
      </div>
    </footer>
  );
};
