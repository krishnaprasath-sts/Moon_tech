'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock, FileText, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { KycHistoryEntry, KycStatusInfo } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

/**
 * Customer-facing KYC progress: a 3-step tracker, what was submitted, the
 * reviewer's remarks and the exact next action. Used on the profile page.
 */
export function KycStatusCard({ kyc }: { kyc: KycStatusInfo }) {
  const status = kyc.status;
  const verified = status === 'VERIFIED';
  const inReview = status === 'PENDING' || status === 'UNDER_REVIEW';
  const needsAction = status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED';
  const submitted = status !== 'DRAFT';

  const steps: { label: string; state: 'done' | 'active' | 'todo' | 'error'; caption?: string }[] = [
    {
      label: 'Documents submitted',
      state: submitted ? 'done' : 'active',
      caption: kyc.submittedAt ? formatDateTime(kyc.submittedAt) : 'PAN, Aadhaar and bank passbook',
    },
    {
      label: 'Under review',
      state: verified ? 'done' : inReview ? 'active' : needsAction ? 'error' : 'todo',
      caption: verified
        ? kyc.reviewedAt
          ? `Reviewed ${formatDateTime(kyc.reviewedAt)}`
          : 'Reviewed'
        : inReview
        ? 'Usually within 1 working day'
        : needsAction
        ? kyc.reviewedAt
          ? `Reviewed ${formatDateTime(kyc.reviewedAt)}`
          : 'Action needed'
        : 'After you submit',
    },
    {
      label: 'Verified',
      state: verified ? 'done' : 'todo',
      caption: verified ? 'You can invest and withdraw' : 'Unlocks investing and withdrawals',
    },
  ];

  const docs = [
    { label: 'PAN card', ok: kyc.hasPan },
    { label: 'Aadhaar front', ok: kyc.hasAadhaar },
    { label: 'Aadhaar back', ok: kyc.hasAadhaarBack },
    { label: 'Bank passbook', ok: kyc.hasPassbook },
  ];

  return (
    <div className="mt-5 space-y-4">
      {/* Step tracker */}
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="KYC progress">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className={`rounded-xl border p-3 flex gap-3 ${
              step.state === 'done'
                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5'
                : step.state === 'active'
                ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5'
                : step.state === 'error'
                ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5'
                : 'border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-black/20'
            }`}
          >
            <StepIcon state={step.state} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Step {i + 1}</div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">{step.label}</div>
              {step.caption && <div className="text-[11px] text-zinc-500 mt-0.5">{step.caption}</div>}
            </div>
          </li>
        ))}
      </ol>

      {/* Guidance */}
      {kyc.nextStep && (
        <div
          className={`rounded-xl p-4 text-xs leading-relaxed flex gap-3 ${
            needsAction
              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
              : verified
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'bg-zinc-50 dark:bg-black/20 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {needsAction ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : verified ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div>
            <p>{kyc.nextStep}</p>
            {needsAction && kyc.rejectionReason && (
              <p className="mt-2">
                <span className="font-semibold">Reviewer&apos;s note:</span> {kyc.rejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Submitted details */}
      {submitted && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Documents
            </div>
            <ul className="mt-2 space-y-1.5">
              {docs.map((d) => (
                <li key={d.label} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300">{d.label}</span>
                  {d.ok ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  ) : verified ? (
                    <span className="text-zinc-500">Verified by our team</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <Circle className="w-3.5 h-3.5" /> Missing
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Details on file</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-zinc-500">PAN</dt>
              <dd className="font-mono text-zinc-800 dark:text-zinc-200 text-right">{kyc.details?.maskedPan || '—'}</dd>
              <dt className="text-zinc-500">Aadhaar</dt>
              <dd className="font-mono text-zinc-800 dark:text-zinc-200 text-right">{kyc.details?.maskedAadhaar || '—'}</dd>
              <dt className="text-zinc-500">Bank account</dt>
              <dd className="font-mono text-zinc-800 dark:text-zinc-200 text-right">{kyc.details?.maskedAccountNumber || '—'}</dd>
              <dt className="text-zinc-500">Account holder</dt>
              <dd className="text-zinc-800 dark:text-zinc-200 text-right truncate">{kyc.details?.accountHolderName || '—'}</dd>
              <dt className="text-zinc-500">IFSC</dt>
              <dd className="font-mono text-zinc-800 dark:text-zinc-200 text-right">{kyc.details?.ifscCode || '—'}</dd>
            </dl>
          </div>
        </div>
      )}

      {/* Review history */}
      {kyc.history.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Review history</div>
          <ol className="space-y-2">
            {kyc.history.map((h) => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: 'done' | 'active' | 'todo' | 'error' }) {
  if (state === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (state === 'error') return <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
  if (state === 'active') return <Clock className="w-5 h-5 text-blue-600 shrink-0" />;
  return <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 shrink-0" />;
}

const ACTION_LABELS: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  VERIFY: { label: 'Verified', tone: 'text-emerald-600', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REJECT: { label: 'Rejected', tone: 'text-rose-600', icon: <XCircle className="w-3.5 h-3.5" /> },
  REQUEST_RESUBMISSION: { label: 'Resubmission requested', tone: 'text-amber-600', icon: <RotateCcw className="w-3.5 h-3.5" /> },
  PUT_UNDER_REVIEW: { label: 'Review started', tone: 'text-blue-600', icon: <Clock className="w-3.5 h-3.5" /> },
  SUSPEND: { label: 'Suspended', tone: 'text-rose-600', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

function HistoryRow({ entry }: { entry: KycHistoryEntry }) {
  const meta = ACTION_LABELS[entry.action] || { label: entry.action, tone: 'text-zinc-500', icon: <Circle className="w-3.5 h-3.5" /> };
  return (
    <li className="flex gap-3 text-xs">
      <span className={`${meta.tone} shrink-0 mt-0.5`}>{meta.icon}</span>
      <div className="min-w-0">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{meta.label}</span>
        <span className="text-zinc-500"> · {formatDateTime(entry.createdAt)}</span>
        {entry.remarks && <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{entry.remarks}</p>}
      </div>
    </li>
  );
}
