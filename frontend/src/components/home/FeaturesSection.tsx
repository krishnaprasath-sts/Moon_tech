import React from 'react';
import { Lock, Zap, RefreshCw, BarChart3, Bell, Shield } from 'lucide-react';

const FEATURES = [
  {
    icon: Lock,
    title: 'Verified Wallet Credits',
    desc: 'Every UPI payment is checked against your receipt before your wallet is credited.',
  },
  {
    icon: Zap,
    title: 'Know Your Expected Profit Upfront',
    desc: 'See the expected profit, maturity amount and maturity date before you confirm an investment, as per the plan terms.',
  },
  {
    icon: RefreshCw,
    title: 'Withdraw at Maturity',
    desc: 'Request your principal and profit once the plan matures, paid to your bank account or UPI.',
  },
  {
    icon: BarChart3,
    title: 'Complete Transaction History',
    desc: 'Deposits, investments, profit, withdrawals and adjustments are all listed with a unique reference.',
  },
  {
    icon: Bell,
    title: 'Timely Notifications',
    desc: 'Get notified when a payment is verified, an investment matures or a withdrawal is completed.',
  },
  {
    icon: Shield,
    title: 'Account Security',
    desc: 'Optional KYC verification, masked bank details and a ledger entry for every balance change.',
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="text-center max-w-xl mx-auto mb-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
          Built for Clarity and Control
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
          Everything you need to fund your wallet, invest and track your money in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f, idx) => {
          const Icon = f.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.16] shadow-xs transition duration-200"
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-zinc-300 mb-4">
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
