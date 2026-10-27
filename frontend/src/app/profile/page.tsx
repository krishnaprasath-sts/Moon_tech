"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import {
  api,
  getErrorMessage,
  PayoutDetails,
  PayoutMethod,
  Profile,
  UpdatePayoutDetailsInput,
  UpdateProfileInput,
} from '@/lib/api';
import { notifyAuthChange, useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDate, formatDateTime, formatINR, humanize, validateNewPassword } from '@/lib/format';
import { KycStatusCard } from '@/components/kyc/KycStatusCard';
import { BankAccountSection } from '@/components/profile/BankAccountSection';

function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the code is selectable next to the button
        }
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-white/10 text-[10px] font-sans font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
      aria-label={copied ? 'Referral code copied' : 'Copy referral code'}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
import {
  accentButtonClass,
  Alert,
  cardClass,
  ErrorState,
  FullPageMessage,
  helpTextClass,
  inputClass,
  labelClass,
  PageHeader,
  PageShell,
  primaryButtonClass,
  RequiredMark,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';

const sectionClass = `${cardClass} p-6`;

const IFSC_PATTERN = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{8,25}$/;

function SectionTitle({
  icon,
  title,
  description,
  tone = 'blue',
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: 'blue' | 'rose';
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex gap-3 min-w-0">
        <div
          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
            tone === 'rose'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-zinc-950 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Keeps the cached session user (used for greetings) in sync after a profile update. */
function syncStoredUser(profile: Profile) {
  try {
    const raw = localStorage.getItem('user');
    const stored = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      'user',
      JSON.stringify({ ...stored, fullName: profile.fullName, name: profile.fullName || stored.name })
    );
    notifyAuthChange();
  } catch {
    // The cached user is a convenience only
  }
}

export default function ProfilePage() {
  const { token, loading: authLoading, logout } = useAuth();

  const profileFetcher = useCallback(() => api.getProfile(token as string), [token]);
  const kycFetcher = useCallback(() => api.getKycInfo(token as string), [token]);
  const walletFetcher = useCallback(() => api.getWallet(token as string), [token]);
  const referralsFetcher = useCallback(() => api.getMyReferrals(token as string), [token]);

  const profileQuery = useAsyncData(token ? profileFetcher : null);
  const kyc = useAsyncData(token ? kycFetcher : null);
  const wallet = useAsyncData(token ? walletFetcher : null);
  const referrals = useAsyncData(token ? referralsFetcher : null);

  // Latest values returned by successful saves (avoids a refetch flash)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);
  const [savedPayout, setSavedPayout] = useState<PayoutDetails | null>(null);

  if (authLoading || !token) return <FullPageMessage>Loading profile...</FullPageMessage>;

  const profile = savedProfile || profileQuery.data;
  const payoutDetails = savedPayout || profile?.payoutDetails || null;
  // Once an account is on file it can only be changed through an approved change request
  const bankLocked = Boolean(payoutDetails && (payoutDetails.bankLocked ?? payoutDetails.accountNumberMasked));

  const kycStatus = kyc.data?.status || 'DRAFT';
  const kycRequired = Boolean(wallet.data?.config.requireKycForInvestment);
  const kycVerified = kycStatus === 'VERIFIED';
  const kycUnderReview = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';

  return (
    <PageShell width="max-w-4xl">
      <PageHeader
        title="My profile"
        subtitle="Your personal details, payout details and account security."
        actions={
          <Link href="/dashboard" className={secondaryButtonClass}>
            Go to dashboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      {profileQuery.error && !profile ? (
        <div className={cardClass}>
          <ErrorState message={profileQuery.error} onRetry={profileQuery.reload} />
        </div>
      ) : !profile ? (
        <div className="h-72 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
      ) : (
        <>
          {/* Account summary */}
          <section className={`${cardClass} overflow-hidden`} aria-label="Account summary">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5 border-b border-zinc-100 dark:border-white/[0.06]">
              <div className="w-14 h-14 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center text-lg font-bold shrink-0" aria-hidden="true">
                {(profile.fullName || profile.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white truncate">{profile.fullName || 'Clyvus Ventures member'}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{profile.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  profile.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20'
                }`}>
                  {profile.status === 'ACTIVE' && <CheckCircle2 className="w-3.5 h-3.5" />} Account {humanize(profile.status)}
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-white/[0.06] text-xs">
              <div className="p-5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mobile</dt><dd className="mt-1 font-medium font-mono text-zinc-900 dark:text-zinc-100">{profile.phone || 'Not provided'}</dd></div>
              <div className="p-5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Customer ID</dt>
                <dd className="mt-1 font-mono font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                  <span className="select-all">{profile.customerId || '—'}</span>
                  {profile.customerId && <CopyCodeButton value={profile.customerId} />}
                </dd>
                <dd className="mt-1 text-[11px] text-zinc-500">Quote this ID when you contact support.</dd>
              </div>
              <div className="p-5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Referral code</dt>
                <dd className="mt-1 font-mono font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                  <span className="select-all">{profile.referralCode || '—'}</span>
                  {profile.referralCode && <CopyCodeButton value={profile.referralCode} />}
                </dd>
                {referrals.data && (
                  <dd className="mt-1 text-[11px] text-zinc-500">
                    {referrals.data.totalReferrals} referred · earned{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatINR(referrals.data.totalCommissionEarned)}
                    </span>
                    {referrals.data.pendingCommission > 0 && ` · ${formatINR(referrals.data.pendingCommission)} pending`}
                    {' '}· {referrals.data.commissionPercent}% of every investment they make
                  </dd>
                )}
              </div>
              <div className="p-5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Member since</dt><dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatDate(profile.createdAt)}</dd></div>
            </dl>
          </section>

          {/* Personal details */}
          <section className={sectionClass} aria-labelledby="personal-details-title">
            <SectionTitle
              icon={<UserRound className="w-5 h-5" />}
              title="Personal details"
              description="Keep your name and address up to date. Email and mobile cannot be changed here."
            />
            <PersonalDetailsForm
              token={token}
              profile={profile}
              onSaved={(next) => {
                setSavedProfile(next);
                syncStoredUser(next);
              }}
            />
          </section>

          {/* KYC */}
          <section className={sectionClass} aria-label="Identity verification">
            <SectionTitle
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Identity verification (KYC)"
              description={
                kycRequired
                  ? 'KYC verification is required before you can invest.'
                  : 'KYC is optional. Verifying your identity helps us process payouts faster.'
              }
              aside={
                kyc.data ? (
                  <StatusBadge status={kycStatus} kind="kyc" />
                ) : (
                  <span className="text-[11px] text-zinc-500">Checking...</span>
                )
              }
            />
            <div className="mt-5 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/[0.06] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {kycVerified
                  ? 'Your identity is verified.'
                  : kycUnderReview
                  ? 'Your documents are with the compliance team. You will be notified once the review is complete.'
                  : kycRequired
                  ? 'Complete or resubmit your documents to unlock investments.'
                  : 'You can invest without KYC. Submit your documents whenever you are ready.'}
              </p>
              {kycVerified ? (
                <Link href="/plans" className={`shrink-0 ${primaryButtonClass}`}>
                  Invest now <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link href="/dashboard?kyc=true" className={`shrink-0 ${accentButtonClass}`}>
                  {kycUnderReview ? 'View KYC status' : 'Continue KYC'} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            {kyc.data && <KycStatusCard kyc={kyc.data} />}
          </section>

          {/* Payout details */}
          <section id="payout-details" className={`${sectionClass} scroll-mt-24`} aria-label="Bank account details">
            <SectionTitle
              icon={<Building2 className="w-5 h-5" />}
              title="Bank account details"
              description={
                bankLocked
                  ? 'Withdrawals are paid to this account. Changes are checked by our team before they take effect.'
                  : 'Withdrawals are paid to these details. Make sure they belong to you and are correct.'
              }
            />
            {bankLocked && payoutDetails ? (
              <BankAccountSection
                token={token}
                details={payoutDetails}
                defaultHolderName={profile.fullName || ''}
                onAccountChanged={() => {
                  setSavedPayout(null);
                  profileQuery.reload();
                }}
              />
            ) : (
              <PayoutDetailsForm
                token={token}
                details={payoutDetails}
                defaultHolderName={profile.fullName || ''}
                onSaved={setSavedPayout}
              />
            )}
          </section>

          {/* Change password */}
          <section className={sectionClass} aria-label="Change password">
            <SectionTitle
              icon={<KeyRound className="w-5 h-5" />}
              title="Change password"
              description="Use at least 8 characters with at least one letter and one digit."
            />
            <ChangePasswordForm token={token} />
          </section>

          {/* Sign out */}
          <section className={`${sectionClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`} aria-label="Sign out">
            <SectionTitle
              icon={<LogOut className="w-5 h-5" />}
              title="Sign out"
              description="End this session on this device."
              tone="rose"
            />
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition"
            >
              Log out
            </button>
          </section>
        </>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Personal details
// ---------------------------------------------------------------------------
function PersonalDetailsForm({
  token,
  profile,
  onSaved,
}: {
  token: string;
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '');
  const [address, setAddress] = useState(profile.address || '');
  const [city, setCity] = useState(profile.city || '');
  const [state, setState] = useState(profile.state || '');
  const [pincode, setPincode] = useState(profile.pincode || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<'fullName' | 'dateOfBirth' | 'pincode' | null>(null);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSuccess('');
    setInvalidField(null);

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setInvalidField('fullName');
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (dateOfBirth) {
      const date = new Date(`${dateOfBirth}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date.getTime() >= Date.now()) {
        setInvalidField('dateOfBirth');
        setError('Date of birth must be a valid date in the past.');
        return;
      }
    }
    const cleanPincode = pincode.trim();
    if (cleanPincode && !/^[0-9]{6}$/.test(cleanPincode)) {
      setInvalidField('pincode');
      setError('Pincode must be 6 digits.');
      return;
    }

    const input: UpdateProfileInput = {
      fullName: cleanName,
      dateOfBirth: dateOfBirth || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: cleanPincode || null,
    };

    setSaving(true);
    try {
      const updated = await api.updateProfile(token, input);
      setSuccess('Your profile has been updated.');
      onSaved(updated);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to update your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profile-name" className={labelClass}>Full name<RequiredMark /></label>
          <input id="profile-name" type="text" autoComplete="name" maxLength={255} value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving} aria-invalid={invalidField === 'fullName'} className={inputClass} />
        </div>
        <div>
          <label htmlFor="profile-dob" className={labelClass}>Date of birth</label>
          <input id="profile-dob" type="date" autoComplete="bday" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={saving} aria-invalid={invalidField === 'dateOfBirth'} className={inputClass} />
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass}>Email</label>
          <input id="profile-email" type="email" value={profile.email} readOnly disabled className={inputClass} />
          <p className={helpTextClass}>Contact support to change your email.</p>
        </div>
        <div>
          <label htmlFor="profile-phone" className={labelClass}>Mobile</label>
          <input id="profile-phone" type="tel" value={profile.phone || ''} readOnly disabled className={`${inputClass} font-mono`} />
          <p className={helpTextClass}>Contact support to change your mobile number.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="profile-address" className={labelClass}>Address</label>
          <textarea id="profile-address" rows={2} maxLength={500} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} className={`${inputClass} resize-y`} />
        </div>
        <div>
          <label htmlFor="profile-city" className={labelClass}>City</label>
          <input id="profile-city" type="text" maxLength={100} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} disabled={saving} className={inputClass} />
        </div>
        <div>
          <label htmlFor="profile-state" className={labelClass}>State</label>
          <input id="profile-state" type="text" maxLength={100} autoComplete="address-level1" value={state} onChange={(e) => setState(e.target.value)} disabled={saving} className={inputClass} />
        </div>
        <div>
          <label htmlFor="profile-pincode" className={labelClass}>Pincode</label>
          <input id="profile-pincode" type="text" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} disabled={saving} aria-invalid={invalidField === 'pincode'} aria-describedby="profile-pincode-help" className={`${inputClass} font-mono`} />
          <p id="profile-pincode-help" className={helpTextClass}>6 digits.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving && <Spinner />}
          <span>{saving ? 'Saving...' : 'Save changes'}</span>
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Payout details
// ---------------------------------------------------------------------------
function PayoutDetailsForm({
  token,
  details,
  defaultHolderName,
  onSaved,
}: {
  token: string;
  details: PayoutDetails | null;
  defaultHolderName: string;
  onSaved: (details: PayoutDetails) => void;
}) {
  // Withdrawals are paid to the bank account only
  const preferredMethod: PayoutMethod = 'BANK';
  const [accountHolderName, setAccountHolderName] = useState(details?.accountHolderName || defaultHolderName);
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState(details?.ifscCode || '');
  const [bankName, setBankName] = useState(details?.bankName || '');
  const [bankBranch, setBankBranch] = useState(details?.bankBranch || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<'holder' | 'account' | 'ifsc' | null>(null);
  const [success, setSuccess] = useState('');

  const hasStoredAccount = Boolean(details?.accountNumberMasked);

  const fail = (field: 'holder' | 'account' | 'ifsc', message: string) => {
    setInvalidField(field);
    setError(message);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSuccess('');
    setInvalidField(null);

    const cleanHolder = accountHolderName.trim();
    const cleanAccount = accountNumber.trim();
    const cleanIfsc = ifscCode.trim().toUpperCase();
    const cleanBank = bankName.trim();
    const bankTouched = Boolean(cleanAccount || cleanIfsc || hasStoredAccount);

    if (cleanAccount && !ACCOUNT_PATTERN.test(cleanAccount)) {
      fail('account', 'Bank account number must be 8 to 25 digits.');
      return;
    }
    if (cleanIfsc && !IFSC_PATTERN.test(cleanIfsc)) {
      fail('ifsc', 'Enter a valid IFSC code (e.g. HDFC0001234). The 5th character must be zero.');
      return;
    }
    if (preferredMethod === 'BANK' || bankTouched) {
      if (preferredMethod === 'BANK' && !cleanAccount && !hasStoredAccount) {
        fail('account', 'A bank account number is required for bank payouts.');
        return;
      }
      if ((cleanAccount || hasStoredAccount) && cleanHolder.length < 2) {
        fail('holder', 'Account holder name must be at least 2 characters.');
        return;
      }
      if ((cleanAccount || hasStoredAccount) && !cleanIfsc) {
        fail('ifsc', 'An IFSC code is required with a bank account.');
        return;
      }
      if (cleanIfsc && !cleanAccount && !hasStoredAccount) {
        fail('account', 'Enter the bank account number for this IFSC code.');
        return;
      }
    }

    const input: UpdatePayoutDetailsInput = {
      preferredMethod,
      upiId: null,
      accountHolderName: cleanHolder || null,
      ifscCode: cleanIfsc || null,
      bankName: cleanBank || null,
      bankBranch: bankBranch.trim() || null,
    };
    // Leaving the account number blank keeps the stored one
    if (cleanAccount) input.accountNumber = cleanAccount;

    setSaving(true);
    try {
      const updated = await api.updatePayoutDetails(token, input);
      setSuccess('Your payout details have been saved.');
      setAccountNumber('');
      onSaved(updated);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save your payout details. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {!details && (
        <Alert tone="info">
          You have not added payout details yet. Add your bank account so you can request withdrawals.
        </Alert>
      )}

      <Alert tone="info">
        Withdrawals are paid to this bank account. Please check the details carefully: once saved, any future change
        needs a proof document and approval from our team. If you complete KYC, the bank account from your KYC is used.
      </Alert>


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="payout-holder" className={labelClass}>
            Account holder name {preferredMethod === 'BANK' && <RequiredMark />}
          </label>
          <input id="payout-holder" type="text" maxLength={255} autoComplete="name" placeholder="Name as printed on the bank account" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} disabled={saving} aria-invalid={invalidField === 'holder'} className={inputClass} />
        </div>
        <div>
          <label htmlFor="payout-account" className={labelClass}>
            Account number {preferredMethod === 'BANK' && !hasStoredAccount && <RequiredMark />}
          </label>
          <input id="payout-account" type="text" inputMode="numeric" maxLength={25} autoComplete="off" placeholder={hasStoredAccount ? 'Leave blank to keep the stored number' : '8 to 25 digits'} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} disabled={saving} aria-invalid={invalidField === 'account'} aria-describedby="payout-account-help" className={`${inputClass} font-mono tracking-wider`} />
          <p id="payout-account-help" className={helpTextClass}>
            {hasStoredAccount ? (
              <>
                Stored account: <span className="font-mono text-zinc-800 dark:text-zinc-200">{details?.accountNumberMasked}</span>. Leave
                this field blank to keep it, or enter a new number to replace it.
              </>
            ) : (
              'For your security only the last digits are shown after saving.'
            )}
          </p>
        </div>
        <div>
          <label htmlFor="payout-ifsc" className={labelClass}>
            IFSC code {preferredMethod === 'BANK' && <RequiredMark />}
          </label>
          <input id="payout-ifsc" type="text" maxLength={11} autoComplete="off" placeholder="HDFC0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase().trim())} disabled={saving} aria-invalid={invalidField === 'ifsc'} aria-describedby="payout-ifsc-help" className={`${inputClass} font-mono tracking-wider uppercase`} />
          <p id="payout-ifsc-help" className={helpTextClass}>11 characters; the 5th is always zero.</p>
        </div>
        <div>
          <label htmlFor="payout-bank" className={labelClass}>Bank name</label>
          <input id="payout-bank" type="text" maxLength={100} autoComplete="off" placeholder="e.g. HDFC Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={saving} className={inputClass} />
        </div>
        <div>
          <label htmlFor="payout-branch" className={labelClass}>Bank branch</label>
          <input id="payout-branch" type="text" maxLength={100} autoComplete="off" placeholder="e.g. Anna Nagar, Chennai" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} disabled={saving} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-zinc-500">
          {details?.updatedAt ? `Last updated ${formatDateTime(details.updatedAt)}` : ''}
        </p>
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving && <Spinner />}
          <span>{saving ? 'Saving...' : 'Save payout details'}</span>
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------
function ChangePasswordForm({ token }: { token: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<'current' | 'new' | 'confirm' | null>(null);
  const [success, setSuccess] = useState('');

  const fail = (field: 'current' | 'new' | 'confirm', message: string) => {
    setInvalidField(field);
    setError(message);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSuccess('');
    setInvalidField(null);

    if (!currentPassword) {
      fail('current', 'Enter your current password.');
      return;
    }
    const problem = validateNewPassword(newPassword);
    if (problem) {
      fail('new', problem);
      return;
    }
    if (newPassword === currentPassword) {
      fail('new', 'The new password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      fail('confirm', 'The new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(token, currentPassword, newPassword);
      setSuccess('Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to change your password. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="current-password" className={labelClass}>Current password<RequiredMark /></label>
          <div className="relative">
            <input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              aria-invalid={invalidField === 'current'}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((v) => !v)}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              aria-pressed={showCurrentPassword}
            >
              {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="new-password" className={labelClass}>New password<RequiredMark /></label>
          <div className="relative">
            <input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              aria-invalid={invalidField === 'new'}
              aria-describedby="new-password-help"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              aria-pressed={showNewPassword}
            >
              {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p id="new-password-help" className={helpTextClass}>At least 8 characters with a letter and a digit.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>Confirm new password<RequiredMark /></label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              aria-invalid={invalidField === 'confirm'}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving && <Spinner />}
          <span>{saving ? 'Updating...' : 'Change password'}</span>
        </button>
      </div>
    </form>
  );
}
