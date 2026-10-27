'use client';

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Smartphone } from 'lucide-react';
import { accentButtonClass, secondaryButtonClass } from '@/components/ui/primitives';

/**
 * Builds the UPI intent query (`pa`, `pn`, `am`, `cu`, `tn`) shared by the
 * generic `upi://pay` link, the app-specific schemes and the QR code.
 */
export function upiQuery(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'Merchant',
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return params.toString();
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|windows phone/i.test(navigator.userAgent);
}

const APP_LINKS: { label: string; build: (q: string) => string }[] = [
  { label: 'Google Pay', build: (q) => `tez://upi/pay?${q}` },
  { label: 'PhonePe', build: (q) => `phonepe://pay?${q}` },
  { label: 'Paytm', build: (q) => `paytmmp://pay?${q}` },
];

/**
 * UPI payment step: a QR code on computers (scan with any UPI app), and an
 * "open UPI app" button plus app-specific buttons on phones. If no app takes
 * over the screen within a few seconds, a fallback hint is shown.
 */
export function UpiPayment({
  upiId,
  payeeName,
  amount,
  note = 'Clyvus Ventures wallet top-up',
  qrImageUrl,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  /** Admin-uploaded QR image; when set it replaces the generated QR */
  qrImageUrl?: string;
}) {
  const query = useMemo(() => upiQuery(upiId, payeeName, amount, note), [upiId, payeeName, amount, note]);
  const genericLink = `upi://pay?${query}`;
  // Rendered only inside the client-side Add Money dialog, so the device check can run during the first render
  const [mobile] = useState(() => isMobileDevice());
  const [qr, setQr] = useState<string>('');
  const [noAppHint, setNoAppHint] = useState(false);

  useEffect(() => {
    let active = true;
    // An uploaded QR image takes priority in the render; nothing to generate
    if (qrImageUrl) return undefined;
    QRCode.toDataURL(genericLink, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr('');
      });
    return () => {
      active = false;
    };
  }, [genericLink, qrImageUrl]);

  /**
   * Navigates to the deep link. If the page is still visible ~2.5s later no app
   * handled it, so we show the manual fallback.
   */
  const openApp = (href: string) => {
    setNoAppHint(false);
    let handled = false;
    const onHide = () => {
      handled = true;
    };
    document.addEventListener('visibilitychange', onHide, { once: true });
    window.addEventListener('blur', onHide, { once: true });
    window.location.href = href;
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onHide);
      if (!handled && document.visibilityState === 'visible') setNoAppHint(true);
    }, 2500);
  };

  return (
    <div className="space-y-3">
      {!mobile && (
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950/40 p-4 flex flex-col sm:flex-row items-center gap-4">
          {qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImageUrl} alt={`UPI QR code to pay ${payeeName || upiId}`} width={160} height={160} className="rounded-lg bg-white p-1 shrink-0 object-contain" />
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`UPI QR code to pay ${payeeName || upiId}`} width={160} height={160} className="rounded-lg bg-white p-1 shrink-0" />
          ) : (
            <div className="w-40 h-40 rounded-lg bg-zinc-100 dark:bg-white/[0.06] animate-pulse shrink-0" aria-hidden="true" />
          )}
          <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Scan to pay from your phone</div>
            Open Google Pay, PhonePe, Paytm or any UPI app, tap <strong>Scan</strong> and point it at this code.{' '}
            {qrImageUrl
              ? 'Enter the exact amount shown above if your app asks for it.'
              : 'The UPI ID and amount are filled in automatically.'}{' '}
            If you are on your phone right now, open this page there and tap the button below instead.
          </div>
        </div>
      )}

      <button type="button" onClick={() => openApp(genericLink)} className={`${accentButtonClass} w-full`}>
        <Smartphone className="w-3.5 h-3.5" />
        <span>{mobile ? 'Pay with UPI app' : 'Open UPI app on this device'}</span>
      </button>

      {mobile && (
        <div className="grid grid-cols-3 gap-2">
          {APP_LINKS.map((app) => (
            <button key={app.label} type="button" onClick={() => openApp(app.build(query))} className={`${secondaryButtonClass} justify-center`}>
              {app.label}
            </button>
          ))}
        </div>
      )}

      {noAppHint && (
        <div className="flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed" role="status">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            No UPI app opened on this device.{' '}
            {mobile
              ? 'Try one of the app buttons above, or open your UPI app, choose "Pay to UPI ID", and paste the UPI ID and amount shown above.'
              : 'Computers cannot open UPI apps. Scan the QR code with your phone, or pay the UPI ID shown above from your phone.'}
          </span>
        </div>
      )}
    </div>
  );
}
