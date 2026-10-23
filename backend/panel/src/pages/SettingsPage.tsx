import React, { useState } from 'react';
import { Shield, Key, CheckCircle2, XCircle, UserPlus, Users, Edit2, Trash2 } from 'lucide-react';
import { WalletSettingsCard } from '../components/WalletSettingsCard';
import { useAuth } from '../context/AuthContext';
import { useStaffList, useDeleteStaff } from '../hooks/useStaff';
import { useToast } from '../context/ToastContext';
import { RoleBadge } from '../components/RoleBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';
import { AddStaffModal } from '../components/AddStaffModal';
import { EditStaffRoleModal } from '../components/EditStaffRoleModal';
import { ActionModal } from '../components/ActionModal';
import { TableStateRow } from '../components/TableStateRow';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { StatusTabs } from '../components/StatusTabs';
import { StaffMember } from '../types';
import { btnPrimaryClass, btnRowClass, cardClass, tableCardClass, theadClass, tbodyClass, trClass, ViewOnlyNote } from '../components/ui';
import { formatDate, formatDateTime, getApiErrorMessage } from '../utils/finance';

type SettingsTab = 'wallet' | 'staff' | 'matrix';

const RBAC_MATRIX: Array<{ action: string; superAdmin: boolean; admin: boolean; editor: boolean }> = [
  { action: 'View dashboard, reports, ledger and every record', superAdmin: true, admin: true, editor: true },
  { action: 'View payment receipts, payout proofs and KYC documents', superAdmin: true, admin: true, editor: true },
  { action: 'Approve or reject UPI payments (credit wallets)', superAdmin: true, admin: true, editor: false },
  { action: 'Create, edit, activate or delete investment plans', superAdmin: true, admin: true, editor: false },
  { action: 'Cancel investments and allow early withdrawal', superAdmin: true, admin: true, editor: false },
  { action: 'Approve, reject and complete withdrawals (investment and wallet)', superAdmin: true, admin: true, editor: false },
  { action: 'See full customer bank account numbers (editors see masked numbers)', superAdmin: true, admin: true, editor: false },
  { action: 'Run the daily profit / referral commission payout on demand', superAdmin: true, admin: true, editor: false },
  { action: 'Adjust customer wallets', superAdmin: true, admin: true, editor: false },
  { action: 'Verify, reject or request resubmission of KYC', superAdmin: true, admin: true, editor: false },
  { action: 'Add customers and suspend / activate accounts', superAdmin: true, admin: true, editor: false },
  { action: 'Send announcements to all customers', superAdmin: true, admin: true, editor: false },
  { action: 'Change wallet and payment settings', superAdmin: true, admin: true, editor: false },
  { action: 'Manage staff accounts and roles', superAdmin: true, admin: false, editor: false },
];

const Permission: React.FC<{ allowed: boolean }> = ({ allowed }) =>
  allowed ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" aria-label="Allowed" />
  ) : (
    <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" aria-label="Not allowed" />
  );

export const SettingsPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { data: staffList = [], isLoading, isError, error, refetch, isFetching } = useStaffList();
  const deleteStaffMutation = useDeleteStaff();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('wallet');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      await deleteStaffMutation.mutateAsync(deletingStaff.id);
      toast.success(`${deletingStaff.email} no longer has access to the admin panel`, 'Staff removed');
      setDeletingStaff(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove the staff member'));
    }
  };

  const tabs = [
    { id: 'wallet', label: 'Wallet & Payments' },
    { id: 'staff', label: 'Staff', count: staffList.length || undefined },
    { id: 'matrix', label: 'Permissions' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Staff"
        description="Wallet top-up limits and UPI details, staff accounts and what each role is allowed to do."
        actions={
          <>
            {activeTab === 'staff' && <RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
            {activeTab === 'staff' && isSuperAdmin && (
              <button type="button" onClick={() => setIsAddStaffOpen(true)} className={btnPrimaryClass}>
                <UserPlus className="w-3.5 h-3.5" />
                Add Staff Member
              </button>
            )}
          </>
        }
      />

      <StatusTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as SettingsTab)} label="Settings sections" />

      {activeTab === 'wallet' && (
        <div className="max-w-3xl">
          <WalletSettingsCard />
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-4">
          {!isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs text-slate-600 dark:text-slate-300">
              <ViewOnlyNote />
              <span>Only Super Admins can add staff members or change roles. You can review the list.</span>
            </div>
          )}

          <div className={tableCardClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={theadClass}>
                  <tr>
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Login</th>
                    <th className="py-3.5 px-4">Created</th>
                    {isSuperAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className={tbodyClass}>
                  <TableStateRow
                    colSpan={isSuperAdmin ? 8 : 7}
                    isLoading={isLoading}
                    isError={isError}
                    isEmpty={staffList.length === 0}
                    loadingText="Loading staff..."
                    emptyIcon={Users}
                    emptyTitle="No staff members"
                    emptyText="Staff accounts appear here once they are created."
                    errorText={getApiErrorMessage(error, 'Failed to load staff members.')}
                    onRetry={() => refetch()}
                  />

                  {!isLoading &&
                    !isError &&
                    staffList.map((staff) => {
                      const isCurrentUser = user?.id === staff.id;
                      return (
                        <tr key={staff.id} className={trClass}>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">#{staff.id}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2 break-all">
                              {staff.email}
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded text-[10px] font-bold">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{staff.phone || '—'}</td>
                          <td className="py-3.5 px-4">
                            <RoleBadge role={staff.role} />
                          </td>
                          <td className="py-3.5 px-4">
                            <AccountStatusBadge status={staff.status} />
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : 'Never'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(staff.createdAt)}</td>
                          {isSuperAdmin && (
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button type="button" onClick={() => setEditingStaff(staff)} className={btnRowClass}>
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                {!isCurrentUser && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingStaff(staff)}
                                    aria-label={`Remove ${staff.email}`}
                                    title="Remove staff member"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${cardClass} space-y-4`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Your Account
            </h2>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] uppercase">Email</span>
                <span className="text-slate-900 dark:text-slate-200 font-semibold break-all">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] uppercase mb-0.5">Role</span>
                {user?.role && <RoleBadge role={user.role} />}
              </div>
            </div>

            <div className="p-4 bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-500/20 rounded-xl text-xs space-y-2">
              <div className="font-bold text-brand-700 dark:text-brand-300">Roles</div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                <strong>Super Admin</strong>: everything, including staff accounts and settings.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                <strong>Admin</strong>: approves payments, withdrawals and KYC, manages plans, wallets and customers.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                <strong>Editor</strong>: view-only access to every screen; cannot change anything.
              </p>
            </div>
          </div>

          <div className={`lg:col-span-2 ${cardClass} space-y-4`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Permissions by Role
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={theadClass}>
                  <tr>
                    <th className="py-3 px-3">Capability</th>
                    <th className="py-3 px-3 text-center">Super Admin</th>
                    <th className="py-3 px-3 text-center">Admin</th>
                    <th className="py-3 px-3 text-center">Editor</th>
                  </tr>
                </thead>
                <tbody className={tbodyClass}>
                  {RBAC_MATRIX.map((item) => (
                    <tr key={item.action} className={trClass}>
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">{item.action}</td>
                      <td className="py-3 px-3 text-center">
                        <Permission allowed={item.superAdmin} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Permission allowed={item.admin} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Permission allowed={item.editor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <>
          <AddStaffModal isOpen={isAddStaffOpen} onClose={() => setIsAddStaffOpen(false)} />
          <EditStaffRoleModal isOpen={!!editingStaff} onClose={() => setEditingStaff(null)} staff={editingStaff} />
          <ActionModal
            isOpen={!!deletingStaff}
            onClose={() => setDeletingStaff(null)}
            onSubmit={handleDeleteStaff}
            tone="danger"
            title="Remove Staff Member"
            subtitle="This cannot be undone"
            showInput={false}
            description={
              deletingStaff && (
                <>
                  Remove <strong className="text-slate-900 dark:text-white">{deletingStaff.email}</strong> from the admin
                  panel? They will lose access immediately. Their past actions stay in the activity log.
                </>
              )
            }
            confirmText="Remove Staff Member"
            isLoading={deleteStaffMutation.isPending}
          />
        </>
      )}
    </div>
  );
};
