import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Moon Tech Solutions',
  description: 'Terms and conditions for opening and using a Moon Tech Solutions account.',
};

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: '1. Your account',
    items: [
      'You must be at least 18 years old and an Indian resident to open an account.',
      'The name, mobile number, email address and bank account you register must be your own and must match your KYC documents.',
      'A valid referral code from an existing member is required to open an account.',
      'Keep your password and sign-in codes private. Every sign-in is confirmed with a code sent to your registered email.',
    ],
  },
  {
    title: '2. KYC verification',
    items: [
      'Plans and withdrawals are available only after your PAN, Aadhaar and bank details have been verified by our compliance team.',
      'We may ask for additional documents at any time and may suspend an account whose details cannot be verified.',
    ],
  },
  {
    title: '3. Adding money',
    items: [
      'Money is added to your capital wallet by bank transfer (NEFT, IMPS or RTGS) to the company account shown in the app.',
      'Every transfer must be submitted with its UTR and a receipt. It is credited only after an admin matches it against the money received.',
      'Transfers from a bank account that is not in your name may be rejected and returned.',
    ],
  },
  {
    title: '4. Plans and profit',
    items: [
      'Plan rates are monthly rates on the capital placed in a plan, paid as equal credits on working days (Monday to Friday) at 6:00 AM IST into your profit wallet.',
      'The first credit is made after the plan has run for a full day. Weekends are skipped.',
      'Profit can be withdrawn at any time. Capital can also be withdrawn at any time: in full and without fee from your capital wallet or once a plan has matured, and less the early withdrawal fee shown before you confirm when you close a running plan before it ends.',
      'Plans carry market risk. Rates and plans may be changed for new plans; running plans keep the terms they were opened with.',
    ],
  },
  {
    title: '5. Withdrawals',
    items: [
      'Withdrawals are paid only to the verified bank account registered in your profile, after admin verification.',
      'Processing times depend on your bank. We are not responsible for delays caused by banks or incorrect account details you provided.',
    ],
  },
  {
    title: '6. Referral commission',
    items: [
      'A one-time commission on each amount placed in a plan by someone you referred is credited to your profit wallet immediately.',
      'If that plan is cancelled by our team, the commission is reversed from your profit wallet.',
    ],
  },
  {
    title: '7. Acceptable use',
    items: [
      'One account per person. Fake, duplicate or shared accounts, and any attempt to abuse referrals or submit false payment proofs, lead to suspension and forfeiture of pending commissions.',
      'We may suspend or close an account that breaks these terms or applicable law, and may report suspicious activity to the authorities.',
    ],
  },
  {
    title: '8. Changes and contact',
    items: [
      'We may update these terms. Material changes are announced in the app, and continued use after a change means you accept it.',
      'Questions about these terms can be sent to the support email shown on your dashboard.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <header className="w-full max-w-3xl flex items-center justify-between mb-6">
        <Logo size="md" />
        <Link href="/register" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to registration
        </Link>
      </header>

      <main className="w-full max-w-3xl rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-white/[0.09] shadow-2xl p-5 sm:p-8 lg:p-10">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">Terms and Conditions</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              These terms apply to every Moon Tech Solutions account. By registering you agree to them.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">{section.title}</h2>
              <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed list-disc pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 pt-5 border-t border-zinc-200 dark:border-white/[0.08] text-[11px] text-zinc-500 dark:text-zinc-400">
          Plans carry market risk. Past returns do not guarantee future returns.
        </p>
      </main>

      <footer className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200 transition">
          ← Back to MoonTech Homepage
        </Link>
      </footer>
    </div>
  );
}
