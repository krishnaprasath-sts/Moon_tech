import React, { useState, useEffect, useId } from 'react';
import { Megaphone, Loader2, Save, Wrench, Gift } from 'lucide-react';
import { usePlatformSettings, useUpdatePlatformSettings } from '../hooks/useFinance';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PlatformSettings } from '../types';
import { Switch } from './Switch';
import { Field, FormError, ErrorState, Spinner, ViewOnlyNote, inputClass, textareaClass, btnPrimaryClass, cardClass } from './ui';
import { getApiErrorMessage } from '../utils/finance';

const ANNOUNCEMENT_MAX = 1000;
const MAINTENANCE_MAX = 500;

/**
 * Customer login page: the announcement shown above the sign-in form, and the maintenance
 * switch. While maintenance is on, customers cannot sign in or create an account; staff still
 * sign in here, and the 6:00 AM profit / referral payout job keeps running.
 */
export const LoginPageSettingsCard: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const formId = useId();

  const { data: settings, isLoading, isError, error, refetch } = usePlatformSettings();
  const { mutateAsync: updateSettings, isPending } = useUpdatePlatformSettings();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loginAnnouncement, setLoginAnnouncement] = useState('');
  const [loginAnnouncementTitle, setLoginAnnouncementTitle] = useState('');
  const [companyReferralCode, setCompanyReferralCode] = useState('');
  const [errors, setErrors] = useState<{ maintenanceMessage?: string; loginAnnouncement?: string; companyReferralCode?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const readOnly = !isAdmin;

  useEffect(() => {
    if (!settings) return;
    setMaintenanceMode(Boolean(settings.maintenanceMode));
    setMaintenanceMessage(settings.maintenanceMessage || '');
    setLoginAnnouncement(settings.loginAnnouncement || '');
    setLoginAnnouncementTitle(settings.loginAnnouncementTitle || '');
    setCompanyReferralCode(settings.companyReferralCode || '');
    setErrors({});
    setFormError(null);
  }, [settings]);

  const buildChanges = (): Partial<PlatformSettings> => {
    if (!settings) return {};
    const changes: Partial<PlatformSettings> = {};
    if (maintenanceMode !== Boolean(settings.maintenanceMode)) changes.maintenanceMode = maintenanceMode;
    if (maintenanceMessage.trim() !== (settings.maintenanceMessage || '')) changes.maintenanceMessage = maintenanceMessage.trim();
    if (loginAnnouncement.trim() !== (settings.loginAnnouncement || '')) changes.loginAnnouncement = loginAnnouncement.trim();
    if (loginAnnouncementTitle.trim() !== (settings.loginAnnouncementTitle || '')) changes.loginAnnouncementTitle = loginAnnouncementTitle.trim();
    if (companyReferralCode.trim().toUpperCase() !== (settings.companyReferralCode || '')) changes.companyReferralCode = companyReferralCode.trim().toUpperCase();
    return changes;
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (maintenanceMessage.trim().length > MAINTENANCE_MAX) next.maintenanceMessage = `Keep it under ${MAINTENANCE_MAX} characters`;
    if (loginAnnouncement.trim().length > ANNOUNCEMENT_MAX) next.loginAnnouncement = `Keep it under ${ANNOUNCEMENT_MAX} characters`;
    if (!/^[A-Z]{4}[0-9]{4}$/.test(companyReferralCode.trim().toUpperCase())) next.companyReferralCode = '4 letters followed by 4 digits, e.g. CLYV1001';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isPending) return;
    setFormError(null);

    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save');
      return;
    }
    if (!validate()) return;

    try {
      await updateSettings(changes);
      if (changes.maintenanceMode === true) {
        toast.success('Maintenance mode is ON. Customers cannot sign in or register until you switch it off; profit credits continue.', 'Settings saved');
      } else if (changes.maintenanceMode === false) {
        toast.success('Maintenance mode is OFF. Customers can sign in and register again.', 'Settings saved');
      } else {
        toast.success('Login page settings updated. Customers see the change on their next visit.', 'Settings saved');
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to save the login page settings');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Login Page, Registration & Maintenance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            The popup customers see on the sign-in page (set automatically when you push an announcement above), and the switch that pauses sign-in and registration
          </p>
        </div>
        {readOnly && <ViewOnlyNote />}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          <Spinner className="w-6 h-6 mx-auto mb-2" />
          Loading settings...
        </div>
      ) : isError || !settings ? (
        <ErrorState message={getApiErrorMessage(error, 'Failed to load settings.')} onRetry={() => refetch()} />
      ) : (
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormError message={formError} />

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Gift className="w-4 h-4 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Starting referral code</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Registration needs a referral code. Give this company code to the first customers: it always works, and
                  nobody earns commission on sign-ups made with it. Customers then refer each other with their own codes.
                </p>
              </div>
            </div>
            <Field label="Company referral code" htmlFor={`${formId}-company-code`} required error={errors.companyReferralCode} hint="4 letters + 4 digits">
              <input
                id={`${formId}-company-code`}
                type="text"
                value={companyReferralCode}
                disabled={readOnly}
                maxLength={8}
                onChange={(e) => {
                  setCompanyReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setErrors((prev) => ({ ...prev, companyReferralCode: undefined }));
                }}
                placeholder="CLYV1001"
                className={`${inputClass} font-mono uppercase tracking-wider max-w-xs`}
              />
            </Field>
          </div>

          <Field label="Popup heading" htmlFor={`${formId}-announcement-title`} hint="Defaults to the title of the last pushed announcement">
            <input
              id={`${formId}-announcement-title`}
              type="text"
              value={loginAnnouncementTitle}
              disabled={readOnly}
              maxLength={200}
              onChange={(e) => setLoginAnnouncementTitle(e.target.value)}
              placeholder="e.g. Profit credit for 2 October"
              className={inputClass}
            />
          </Field>

          <Field
            label="Login page popup text"
            htmlFor={`${formId}-announcement`}
            error={errors.loginAnnouncement}
            hint={`Opens as a popup when a customer visits the sign-in page (once per browser session). Leave empty to show no popup. ${loginAnnouncement.trim().length}/${ANNOUNCEMENT_MAX}`}
          >
            <textarea
              id={`${formId}-announcement`}
              rows={3}
              value={loginAnnouncement}
              disabled={readOnly}
              maxLength={ANNOUNCEMENT_MAX}
              onChange={(e) => {
                setLoginAnnouncement(e.target.value);
                setErrors((prev) => ({ ...prev, loginAnnouncement: undefined }));
              }}
              placeholder="e.g. Profit credits for 2 October will be paid on 3 October because of the bank holiday."
              className={textareaClass}
            />
          </Field>

          <div
            className={`rounded-2xl border p-4 space-y-3 ${
              maintenanceMode
                ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Wrench className={`w-4 h-4 mt-0.5 shrink-0 ${maintenanceMode ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Maintenance mode {maintenanceMode ? <span className="text-amber-700 dark:text-amber-400">(ON)</span> : '(off)'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    While on, customers cannot sign in or create an account and see the message below. Staff still sign in to
                    this panel, running investments keep earning, and the 6:00 AM profit and referral credits are paid as usual.
                  </p>
                </div>
              </div>
              <Switch
                checked={maintenanceMode}
                onChange={setMaintenanceMode}
                disabled={readOnly}
                label="Maintenance mode"
                title={maintenanceMode ? 'Switch maintenance mode off' : 'Switch maintenance mode on'}
              />
            </div>

            <Field
              label="Maintenance message"
              htmlFor={`${formId}-maintenance-message`}
              error={errors.maintenanceMessage}
              hint={`Shown on the sign-in and create-account pages while maintenance is on. ${maintenanceMessage.trim().length}/${MAINTENANCE_MAX}`}
            >
              <textarea
                id={`${formId}-maintenance-message`}
                rows={3}
                value={maintenanceMessage}
                disabled={readOnly}
                maxLength={MAINTENANCE_MAX}
                onChange={(e) => {
                  setMaintenanceMessage(e.target.value);
                  setErrors((prev) => ({ ...prev, maintenanceMessage: undefined }));
                }}
                placeholder="We are carrying out scheduled maintenance. Sign in and new registrations are paused for a short while; your investments and profit credits continue as usual."
                className={textareaClass}
              />
            </Field>
          </div>

          {!readOnly && (
            <div className="flex justify-end">
              <button type="submit" disabled={isPending} className={btnPrimaryClass}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isPending ? 'Saving...' : 'Save login page settings'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
