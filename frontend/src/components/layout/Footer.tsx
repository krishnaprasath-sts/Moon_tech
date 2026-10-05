import React from 'react';
import Link from 'next/link';
import { Logo } from '../brand/Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#09090b] text-zinc-600 dark:text-zinc-400 text-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-3">
            <Logo size="md" />
            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed max-w-sm pt-1">
              MoonTech Solutions offers stock market investment plans in rupees, with UPI wallet top-ups and payouts to your bank account or UPI at maturity.
            </p>
            <div className="text-[11px] text-zinc-500 pt-2 font-mono">
              © {new Date().getFullYear()} MoonTech Solutions Ltd. All rights reserved.
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Products</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/plans" className="hover:text-zinc-950 dark:hover:text-white transition">Investment Plans</Link></li>
              <li><Link href="/calculator" className="hover:text-zinc-950 dark:hover:text-white transition">Returns Calculator</Link></li>
              <li><Link href="/offers" className="hover:text-zinc-950 dark:hover:text-white transition">Featured Plans</Link></li>
            </ul>
          </div>

          {/* Platform */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Security & Legal</h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>AML / KYC Policy</li>
              <li>Terms of Service</li>
              <li>Privacy Policy</li>
              <li>Risk Disclosure</li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">My Account</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/dashboard" className="hover:text-zinc-950 dark:hover:text-white transition">Dashboard</Link></li>
              <li><Link href="/wallet" className="hover:text-zinc-950 dark:hover:text-white transition">Wallet</Link></li>
              <li><Link href="/investments" className="hover:text-zinc-950 dark:hover:text-white transition">My Investments</Link></li>
              <li><Link href="/transactions" className="hover:text-zinc-950 dark:hover:text-white transition">Transactions</Link></li>
              <li><Link href="/profile" className="hover:text-zinc-950 dark:hover:text-white transition">Profile & payout details</Link></li>
            </ul>
          </div>

        </div>

        {/* Minimal Disclaimer */}
        <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-white/[0.04] text-[11px] text-zinc-500 leading-relaxed">
          <p>
            Risk Disclaimer: Investments carry risk, including the possible loss of principal. Profit figures are expected amounts as per each plan&apos;s terms and are not guaranteed. Read the plan details carefully and consider your financial situation before you invest.
          </p>
        </div>
      </div>
    </footer>
  );
};
