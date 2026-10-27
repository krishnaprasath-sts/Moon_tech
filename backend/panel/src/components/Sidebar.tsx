import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Network,
  ScrollText,
  Settings,
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
  MessageSquare,
  Landmark,
  ChevronsLeft,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBankChangePendingCount } from '../hooks/useBankChanges';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Key of a live counter shown as a badge */
  badge?: 'bankChanges';
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
      { name: 'Bank Changes', path: '/bank-changes', icon: Landmark, badge: 'bankChanges' },
      { name: 'Support', path: '/support', icon: MessageSquare },
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

interface SidebarProps {
  /** Mobile drawer open */
  isOpen: boolean;
  onClose?: () => void;
  /** Desktop: icons only */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/** Shared easing so the sidebar, its labels and the page padding move together */
const EASE = 'ease-[cubic-bezier(0.4,0,0.2,1)]';

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed = false, onToggleCollapsed }) => {
  // Text that fades out when the desktop sidebar collapses to icons
  const fadeText = `whitespace-nowrap transition-[opacity,transform] duration-200 ${EASE} ${
    collapsed ? 'md:opacity-0 md:-translate-x-2 md:pointer-events-none' : 'opacity-100'
  }`;
  const { logout, isEditor } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: bankChangeCount } = useBankChangePendingCount();
  const badgeCounts: Record<NonNullable<NavItem['badge']>, number> = {
    bankChanges: Number(bankChangeCount?.pendingCount) || 0,
  };

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
      {/* Mobile backdrop: fades in and out with the drawer */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        aria-label="Main navigation"
        className={`vt-sidebar fixed top-0 bottom-0 left-0 z-40 w-64 max-w-[85vw] overflow-hidden bg-white dark:bg-[#000000] border-r border-slate-200 dark:border-slate-800/80 flex flex-col shadow-2xl md:shadow-none md:translate-x-0 transition-[width,transform,background-color,border-color] duration-300 ${EASE} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-[72px]' : ''}`}
      >
        {/* Brand */}
        <div className="h-[73px] px-[18px] border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3 flex-shrink-0">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-blue-600 shadow-lg shadow-brand-500/20 text-white flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className={fadeText}>
            <p className="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              CLYVUS VENTURES
            </p>
            <p className="text-[10px] uppercase tracking-widest text-brand-600 dark:text-brand-400 font-semibold">
              Investment Admin
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-4 overflow-y-auto overflow-x-hidden">
          {NAV_GROUPS.filter((group) => !(group.managersOnly && isEditor)).map((group) => (
            <div key={group.label}>
              {/* Group title; a thin line takes its place when collapsed */}
              <div className="relative h-6 mb-1">
                <p className={`px-3 text-[11px] leading-6 font-semibold text-slate-400 uppercase tracking-wider ${fadeText}`}>
                  {group.label}
                </p>
                <span
                  aria-hidden="true"
                  className={`hidden md:block absolute left-3 right-3 top-1/2 h-px bg-slate-200 dark:bg-slate-800 transition-opacity duration-300 ${
                    collapsed ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const count = item.badge ? badgeCounts[item.badge] : 0;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      // Page area cross-fades; sidebar and top bar stay still (index.css)
                      viewTransition
                      title={collapsed ? item.name : undefined}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200 group ${
                          isActive
                            ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/25'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 transition-[color,transform] duration-200 group-hover:scale-110 ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                            }`}
                          />
                          <span className={`truncate ${fadeText}`}>{item.name}</span>
                          {count > 0 && (
                            <>
                              <span
                                aria-label={`${count} pending`}
                                className={`ml-auto min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums text-center ${fadeText} ${
                                  isActive ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
                                }`}
                              >
                                {count > 99 ? '99+' : count}
                              </span>
                              {/* Collapsed: a dot on the icon instead of the number */}
                              <span
                                aria-hidden="true"
                                className={`hidden md:block absolute top-1.5 left-7 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-black transition-[opacity,transform] duration-200 ${
                                  collapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                                }`}
                              />
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {isEditor && (
            <div
              className={`p-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-xl text-xs text-sky-700 dark:text-sky-300 ${
                collapsed ? 'md:hidden' : ''
              }`}
            >
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

        {/* Collapse (desktop) and sign out */}
        <div className="p-3 space-y-2 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0c1017] transition-colors duration-300 flex-shrink-0">
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              className="hidden md:flex w-full items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-200"
            >
              <ChevronsLeft
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${EASE} ${collapsed ? 'rotate-180' : ''}`}
              />
              <span className={fadeText}>Collapse</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            title={collapsed ? 'Sign out' : undefined}
            className={`w-full flex items-center justify-center px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-600 dark:hover:bg-rose-600 rounded-xl border border-rose-200 dark:border-rose-500/20 transition-[background-color,color,gap] duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              collapsed ? 'gap-2 md:gap-0' : 'gap-2'
            }`}
          >
            {isSigningOut ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <LogOut className="w-3.5 h-3.5 flex-shrink-0" />}
            <span
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ${EASE} ${
                collapsed ? 'max-w-[8rem] md:max-w-0 md:opacity-0' : 'max-w-[8rem] opacity-100'
              }`}
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
