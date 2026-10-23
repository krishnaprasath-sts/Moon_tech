import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Network,
  ScrollText,
  Settings,
  Moon,
  LogOut,
  Loader2,
  Eye,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Banknote,
  Wallet,
  FileBarChart,
  Megaphone,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  /** Hidden from EDITOR (view-only) staff */
  managersOnly?: boolean;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Investment Operations',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Payments', path: '/payments', icon: CreditCard },
      { name: 'Investment Plans', path: '/investment-plans', icon: PiggyBank },
      { name: 'Investments', path: '/investments', icon: TrendingUp },
      { name: 'Withdrawals', path: '/withdrawals', icon: Banknote },
      { name: 'Wallet Ledger', path: '/wallet-transactions', icon: Wallet },
      { name: 'Reports', path: '/reports', icon: FileBarChart },
      { name: 'Announcements', path: '/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Customers & Compliance',
    items: [
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'KYC Queue', path: '/kyc', icon: ShieldCheck },
      { name: 'Referrals', path: '/referrals', icon: Network },
      { name: 'Activity Logs', path: '/activity-logs', icon: ScrollText },
    ],
  },
  {
    label: 'Administration',
    // Managers only: editors are view-only staff
    managersOnly: true,
    items: [{ name: 'Settings & Staff', path: '/settings', icon: Settings }],
  },
];

export const Sidebar: React.FC<{ isOpen: boolean; onClose?: () => void }> = ({ isOpen, onClose }) => {
  const { logout, isEditor } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 max-w-[85vw] bg-white dark:bg-[#000000] border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-blue-600 shadow-lg shadow-brand-500/20 text-white">
            <Moon className="w-5 h-5 fill-white" />
          </div>
          <div>
            <p className="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              MOON TECH
            </p>
            <p className="text-[10px] uppercase tracking-widest text-brand-600 dark:text-brand-400 font-semibold">
              Investment Admin
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {NAV_GROUPS.filter((group) => !(group.managersOnly && isEditor)).map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 group ${
                          isActive
                            ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/25'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 transition flex-shrink-0 ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {isEditor && (
            <div className="p-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-xl text-xs text-sky-700 dark:text-sky-300">
              <div className="flex items-center gap-1.5 font-semibold text-sky-800 dark:text-sky-200 mb-1">
                <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                View-only access
              </div>
              <p className="text-[11px] text-sky-700/90 dark:text-sky-300/80 leading-relaxed">
                Editors can review every record but cannot approve, reject, create or change anything.
              </p>
            </div>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0c1017]">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-600 dark:hover:bg-rose-600 rounded-xl border border-rose-200 dark:border-rose-500/20 transition duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
