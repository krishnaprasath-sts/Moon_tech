import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, ShieldCheck, Network, ShieldAlert, Plus, FileText, Eye } from 'lucide-react';
import { useCustomer } from '../hooks';
import { kycApi, KycDocumentType } from '../api';
import { KycStatusBadge } from '../components/KycStatusBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';
import { AddManualKycModal } from '../components/AddManualKycModal';
import { FileViewerModal } from '../components/FileViewerModal';
import { CustomerFinanceSection } from '../components/CustomerFinanceSection';
import { CopyButton } from '../components/CopyButton';
import { useAuth } from '../context/AuthContext';
import { btnPrimaryClass, btnSecondaryClass, btnGhostClass, cardClass, ViewOnlyNote } from '../components/ui';
import { formatDate, formatDateTime, formatDateOnly, getApiErrorMessage, getErrorStatus, joinParts } from '../utils/finance';

const DetailRow: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div>
    <span className="text-slate-500 block text-[11px] uppercase">{label}</span>
    <span className={`text-slate-800 dark:text-slate-200 font-medium break-words ${mono ? 'font-mono' : ''}`}>{children}</span>
  </div>
);

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { data: customer, isLoading, isError, error, refetch } = useCustomer(id || '');
  const [isManualKycOpen, setIsManualKycOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<KycDocumentType | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Loading customer">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !customer) {
    const notFound = getErrorStatus(error) === 404;
    return (
      <div role="alert" className="p-8 text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {notFound ? 'Customer not found' : 'Could not load this customer'}
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">
          {notFound
            ? `There is no customer with ID ${id}. It may have been removed.`
            : getApiErrorMessage(error, 'Something went wrong while loading the customer profile.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/customers" className={btnGhostClass}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to customers
          </Link>
          {!notFound && (
            <button type="button" onClick={() => refetch()} className={btnSecondaryClass}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const p = customer.profile;
  const k = customer.kyc;
  const displayName = p?.fullName || customer.email;
  const address = joinParts([p?.address, p?.city, p?.state, p?.pincode]);
  const referrals = customer.referrals?.items || [];

  return (
    <div className="space-y-6">
      <Link
        to="/customers"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to customers
      </Link>

      {/* Header card */}
      <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              aria-hidden="true"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-brand-500/20 flex-shrink-0"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">{displayName}</h1>
                <AccountStatusBadge status={customer.status} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  Customer <strong className="text-slate-700 dark:text-slate-200">#{customer.id}</strong>
                </span>
                <span aria-hidden="true">•</span>
                <span>Joined {formatDate(customer.createdAt)}</span>
                <span aria-hidden="true">•</span>
                <span>Last login {formatDateTime(customer.lastLoginAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {k?.id && (
              <Link to={`/kyc/${k.id}`} className={btnPrimaryClass}>
                <ShieldCheck className="w-4 h-4" />
                Open KYC Review
              </Link>
            )}
            {isAdmin ? (
              <button type="button" onClick={() => setIsManualKycOpen(true)} className={btnSecondaryClass}>
                <Plus className="w-3.5 h-3.5" />
                {k?.id ? 'Update KYC Manually' : 'Submit KYC Manually'}
              </button>
            ) : (
              <ViewOnlyNote />
            )}
          </div>
        </div>
      </div>

      {/* Wallet & investments - primary for the investment product */}
      <CustomerFinanceSection customerId={customer.id} customerName={displayName} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal & contact */}
        <div className={`${cardClass} space-y-4`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Personal & Contact
          </h2>

          <div className="space-y-3 text-xs pt-2">
            <DetailRow label="Email">{customer.email}</DetailRow>
            <DetailRow label="Phone" mono>
              {customer.phone || '—'}
            </DetailRow>
            <DetailRow label="Date of Birth">{formatDateOnly(p?.dateOfBirth)}</DetailRow>
            <DetailRow label="Address">{address || 'No address provided'}</DetailRow>
            <DetailRow label="Customer ID" mono>
              {p?.customerId || '—'}
            </DetailRow>
            <div>
              <span className="text-slate-500 block text-[11px] uppercase">Referral Code</span>
              <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-300 font-bold inline-block">
                {p?.referralCode || '—'}
              </span>
            </div>
            {p?.referredBy && (
              <DetailRow label="Referred By" mono>
                {p.referredBy}
              </DetailRow>
            )}
          </div>
        </div>

        {/* KYC */}
        <div className={`${cardClass} space-y-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              KYC
            </h2>
            {k && <KycStatusBadge status={k.status} />}
          </div>

          {k ? (
            <div className="space-y-3.5 text-xs pt-2">
              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">PAN</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="font-bold text-brand-600 dark:text-brand-300 font-mono tracking-wider text-sm select-all">
                    {k.panNumber || k.panMasked || '—'}
                  </span>
                  {(k.panNumber || k.panMasked) && (
                    <CopyButton value={k.panNumber || k.panMasked} label="PAN" />
                  )}
                </div>
                {k.panNumber ? (
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Full decrypted PAN
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-400 mt-0.5">Masked for view-only roles</span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">Aadhaar</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="font-bold tracking-wider font-mono text-sm select-all text-slate-900 dark:text-white">
                    {k.aadhaarNumber || k.aadhaarMasked || '—'}
                  </span>
                  {(k.aadhaarNumber || k.aadhaarMasked) && (
                    <CopyButton value={k.aadhaarNumber || k.aadhaarMasked} label="Aadhaar" />
                  )}
                </div>
                {k.aadhaarNumber ? (
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Full Aadhaar reference
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-400 mt-0.5">Masked for view-only roles</span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">Bank Account</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="select-all font-bold tracking-wider font-mono text-sm text-slate-900 dark:text-white">
                    {k.bankAccountNumber || k.bankAccountMasked || '—'}
                  </span>
                  {(k.bankAccountNumber || k.bankAccountMasked) && (
                    <CopyButton value={k.bankAccountNumber || k.bankAccountMasked} label="bank account number" />
                  )}
                </div>
                <span className="block text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                  {k.bankAccountNumber ? 'From KYC · full number shown to managers for manual payouts' : 'From KYC · masked for view-only roles'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">Account Holder</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{k.accountHolderName || '—'}</span>
                  {k.accountHolderName && <CopyButton value={k.accountHolderName} label="account holder" />}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">IFSC</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{k.ifscCode || '—'}</span>
                  {k.ifscCode && <CopyButton value={k.ifscCode} label="IFSC" />}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <DetailRow label="Submitted">{formatDateTime(k.submittedAt)}</DetailRow>
                <DetailRow label="Reviewed">{formatDateTime(k.reviewedAt)}</DetailRow>
              </div>

              {k.rejectionReason && (
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                  <span className="text-[10px] text-rose-800 dark:text-rose-300 font-bold uppercase block mb-1">
                    Review Notes
                  </span>
                  <p className="text-rose-700 dark:text-rose-300 text-xs">{k.rejectionReason}</p>
                </div>
              )}

              {/* Uploaded Document Previews */}
              {(k.hasPassbookDoc || k.hasPanDoc || k.hasAadhaarDoc) && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-slate-500 block text-[11px] uppercase font-semibold">Uploaded Documents</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {k.hasPassbookDoc && (
                      <button
                        type="button"
                        onClick={() => setActiveDoc('passbook')}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 text-slate-700 dark:text-slate-300 text-xs transition"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-brand-600" />
                          Bank Passbook / Statement
                        </span>
                        <span className="text-[11px] text-brand-600 font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3" /> View
                        </span>
                      </button>
                    )}
                    {k.hasPanDoc && (
                      <button
                        type="button"
                        onClick={() => setActiveDoc('pan')}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 text-slate-700 dark:text-slate-300 text-xs transition"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-brand-600" />
                          PAN Card Document
                        </span>
                        <span className="text-[11px] text-brand-600 font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3" /> View
                        </span>
                      </button>
                    )}
                    {k.hasAadhaarDoc && (
                      <button
                        type="button"
                        onClick={() => setActiveDoc('aadhaar')}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 text-slate-700 dark:text-slate-300 text-xs transition"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-brand-600" />
                          Aadhaar Document
                        </span>
                        <span className="text-[11px] text-brand-600 font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3" /> View
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 space-y-3">
              <p>This customer has not submitted KYC yet.</p>
              {isAdmin && (
                <button type="button" onClick={() => setIsManualKycOpen(true)} className={btnPrimaryClass}>
                  <Plus className="w-3.5 h-3.5" />
                  Submit KYC Manually
                </button>
              )}
            </div>
          )}
        </div>

        {/* Referrals */}
        <div className={`${cardClass} space-y-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Referred Customers
            </h2>
            <span className="px-2 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold rounded-full border border-brand-500/20 tabular-nums">
              {customer.referrals?.totalReferrals || 0}
            </span>
          </div>

          <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
            {referrals.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">This customer has not referred anyone yet.</p>
            ) : (
              referrals.map((ref) => (
                <Link
                  key={ref.id}
                  to={`/customers/${ref.referredUserId}`}
                  className="block p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-brand-500/50 text-xs transition"
                >
                  <p className="font-bold text-slate-900 dark:text-white">{ref.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{ref.email}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Joined {formatDate(ref.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <AddManualKycModal
          isOpen={isManualKycOpen}
          onClose={() => setIsManualKycOpen(false)}
          preselectedCustomerId={customer.id}
          preselectedCustomerName={displayName}
        />
      )}

      {k?.id && activeDoc && (
        <FileViewerModal
          isOpen={!!activeDoc}
          onClose={() => setActiveDoc(null)}
          url={kycApi.getDocumentPath(k.id, activeDoc)}
          title={
            activeDoc === 'passbook'
              ? 'Bank Passbook / Statement'
              : activeDoc === 'pan'
              ? 'PAN Card Document'
              : 'Aadhaar Document'
          }
          subtitle={`${displayName} • KYC #${k.id}`}
          downloadName={`${displayName}_${activeDoc}`}
        />
      )}
    </div>
  );
};
