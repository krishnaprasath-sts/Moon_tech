import React, { useState, useEffect, useId } from 'react';
import { KeyRound, Loader2, UserCheck, UserX } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useUpdateStaffRole, useUpdateStaffStatus } from '../hooks/useStaff';
import { useToast } from '../context/ToastContext';
import { StaffMember, UserRole, UserStatus } from '../types';
import { RoleBadge } from './RoleBadge';
import { ROLE_OPTIONS } from './AddStaffModal';
import { Field, FormError, inputClass, btnGhostClass, btnPrimaryClass, labelClass } from './ui';
import { getApiErrorMessage } from '../utils/finance';

interface EditStaffRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  onSuccess?: () => void;
}

export const EditStaffRoleModal: React.FC<EditStaffRoleModalProps> = ({ isOpen, onClose, staff, onSuccess }) => {
  const formId = useId();
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [status, setStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const updateRoleMutation = useUpdateStaffRole();
  const updateStatusMutation = useUpdateStaffStatus();
  const { toast } = useToast();

  const isSaving = updateRoleMutation.isPending || updateStatusMutation.isPending;

  // Reset to the selected operator every time the dialog opens
  useEffect(() => {
    if (isOpen && staff) {
      setRole(staff.role);
      setStatus(staff.status === UserStatus.SUSPENDED ? UserStatus.SUSPENDED : UserStatus.ACTIVE);
      setStatusReason('');
      setFormError(null);
    }
  }, [isOpen, staff]);

  const hasChanges = !!staff && (role !== staff.role || status !== staff.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || isSaving) return;
    setFormError(null);

    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    try {
      if (role !== staff.role) {
        await updateRoleMutation.mutateAsync({ id: staff.id, role });
      }
      if (status !== staff.status) {
        await updateStatusMutation.mutateAsync({
          id: staff.id,
          status,
          reason: statusReason.trim() || undefined,
        });
      }

      toast.success(`${staff.email} has been updated`, 'Staff updated');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to update the staff member');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen && !!staff}
      onClose={onClose}
      title="Edit Role & Status"
      subtitle={staff?.email}
      icon={KeyRound}
      maxWidthClass="max-w-lg"
      disableClose={isSaving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isSaving} className={btnGhostClass}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isSaving || !hasChanges} className={btnPrimaryClass}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </>
      }
    >
      {staff && (
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormError message={formError} />

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">{staff.email}</div>
              <div className="text-[11px] text-slate-500 font-mono">{staff.phone || 'No phone on file'}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] text-slate-400 block uppercase mb-0.5">Current role</span>
              <RoleBadge role={staff.role} />
            </div>
          </div>

          <div>
            <p className={labelClass}>Role</p>
            <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = role === option.role;
                return (
                  <button
                    key={option.role}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setRole(option.role)}
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? `${option.activeClass} ring-2 ring-offset-1 ring-current/20 dark:ring-offset-slate-900`
                        : 'border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold">{option.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5 leading-snug">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className={labelClass}>Account status</p>
            <div role="radiogroup" aria-label="Account status" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={status === UserStatus.ACTIVE}
                onClick={() => setStatus(UserStatus.ACTIVE)}
                className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                  status === UserStatus.ACTIVE
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <div className="text-left text-xs">
                  <div className="font-bold">Active</div>
                  <div className="text-[10px] opacity-80">Can sign in</div>
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={status === UserStatus.SUSPENDED}
                onClick={() => setStatus(UserStatus.SUSPENDED)}
                className={`p-3 rounded-xl border flex items-center gap-2 transition ${
                  status === UserStatus.SUSPENDED
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                }`}
              >
                <UserX className="w-4 h-4 flex-shrink-0" />
                <div className="text-left text-xs">
                  <div className="font-bold">Suspended</div>
                  <div className="text-[10px] opacity-80">Access blocked</div>
                </div>
              </button>
            </div>

            {status === UserStatus.SUSPENDED && staff.status !== UserStatus.SUSPENDED && (
              <Field label="Reason for suspension" htmlFor={`${formId}-reason`} optional className="mt-3">
                <input
                  id={`${formId}-reason`}
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Left the company"
                  className={inputClass}
                />
              </Field>
            )}
          </div>
        </form>
      )}
    </ModalShell>
  );
};
