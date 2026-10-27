"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Loader2, LogIn, MessageCircle, Send, X } from 'lucide-react';
import { api, ApiError, getErrorMessage, SupportTopic } from '@/lib/api';
import { useAuth, useStoredItem, writeStoredItem } from '@/lib/useAuth';
import { formatDateTime } from '@/lib/format';

/**
 * Support chat, on every page.
 * - Signed-in customers chat about their own account (KYC, deposits, withdrawals, plans).
 * - Visitors (home, sign-in and registration pages) can chat before signing in: the first
 *   message asks for name, email and phone; the conversation is remembered in this browser and
 *   the admin's replies also arrive by email.
 */

const POLL_INTERVAL_MS = 20_000;
const MESSAGE_MAX = 2000;
const GUEST_SESSION_KEY = 'clyvus_support_guest';

const TOPICS: { value: SupportTopic; label: string }[] = [
  { value: 'KYC', label: 'KYC' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAWAL', label: 'Withdrawal' },
  { value: 'PLANS', label: 'Plans' },
];

const TOPIC_LABELS: Record<SupportTopic, string> = {
  KYC: 'KYC',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  PLANS: 'Plans',
};

const FAQ = [
  {
    question: 'How do I open an account?',
    answer:
      'Choose Create account, enter your details with a referral code, and confirm your email with the link we send. Then complete KYC (PAN, Aadhaar and bank details) from your dashboard.',
  },
  {
    question: 'How do I add money to my wallet?',
    answer:
      'After signing in, go to Wallet, choose Add money and transfer the amount to the company bank account shown (NEFT, IMPS or RTGS). Enter the transfer reference and upload the receipt; your wallet is credited once we verify it.',
  },
  {
    question: 'How is the profit calculated?',
    answer:
      'Each plan states a monthly rate on your invested capital. Regular plans pay it as 20 equal credits on working days at 6:00 AM IST; the Deposit Plan pays it once a month on your start date.',
  },
  {
    question: 'When can I withdraw?',
    answer:
      'Profit any time. Capital any time too: matured investments are paid in full, while closing a running plan early deducts the early withdrawal fee shown before you confirm.',
  },
];

/** The fields every chat bubble needs; customer and visitor messages share them */
interface ChatMessage {
  id: number;
  sender: 'CUSTOMER' | 'ADMIN';
  topic: SupportTopic;
  message: string;
  createdAt: string;
}

interface GuestSession {
  token: string;
  name: string;
  email: string;
}

function parseGuestSession(raw: string | null): GuestSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GuestSession>;
    if (typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token)) {
      return { token: value.token, name: String(value.name || ''), email: String(value.email || '') };
    }
  } catch {
    // Corrupt value: treat as no session
  }
  return null;
}

const panelClass =
  'mb-4 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200 animate-fade-in';

const headerClass =
  'bg-zinc-50 dark:bg-zinc-950 px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between';

const fieldClass =
  'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition';

function topicChipClass(selected: boolean): string {
  return `px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
    selected
      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20'
  }`;
}

function PanelHeader({ subtitle, onClose }: { subtitle: string; onClose: () => void }) {
  return (
    <div className={headerClass}>
      <div className="flex items-center gap-2.5">
        <MessageCircle className="w-4 h-4 text-blue-600" aria-hidden="true" />
        <div>
          <h4 className="font-semibold text-xs text-zinc-950 dark:text-white">Support</h4>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close support chat"
        className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-1 rounded-lg"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function TopicPicker({ topic, onChange }: { topic: SupportTopic | null; onChange: (t: SupportTopic) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
        Topic <span className="text-rose-500">*</span>
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Support topic">
        {TOPICS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={topic === t.value}
            onClick={() => onChange(t.value)}
            className={topicChipClass(topic === t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation (shared by customers and visitors)
// ---------------------------------------------------------------------------
function ChatPanel({
  subtitle,
  load,
  send,
  onClose,
  onLoaded,
  onSessionLost,
  footer,
}: {
  subtitle: string;
  load: () => Promise<ChatMessage[]>;
  send: (topic: SupportTopic, message: string) => Promise<ChatMessage[]>;
  onClose: () => void;
  onLoaded?: () => void;
  /** Called when the server no longer knows this conversation (visitor token expired) */
  onSessionLost?: () => void;
  footer?: React.ReactNode;
}) {
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);

  // Initial load + polling while the panel is open; `reloadKey` re-runs it from the Retry button
  useEffect(() => {
    let active = true;

    const refresh = (force: boolean) => {
      if (!force && document.visibilityState !== 'visible') return;
      load()
        .then((items) => {
          if (!active) return;
          setMessages(items);
          setLoadError(null);
          // Default the topic to the latest one, so a follow-up needs no extra click
          const last = items[items.length - 1];
          if (last) setTopic((current) => current ?? last.topic);
          onLoaded?.();
        })
        .catch((err) => {
          if (!active) return;
          if (onSessionLost && err instanceof ApiError && (err.status === 401 || err.status === 404)) {
            onSessionLost();
            return;
          }
          setLoadError(getErrorMessage(err, 'Could not load the conversation.'));
        });
    };

    refresh(true);
    const timer = window.setInterval(() => refresh(false), POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load, onLoaded, onSessionLost, reloadKey]);

  // Keep the newest message in view when something new arrives
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const newestId = messages[messages.length - 1].id;
    if (newestId !== lastIdRef.current) {
      lastIdRef.current = newestId;
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!topic) {
      setSendError('Choose a topic first.');
      return;
    }
    if (text.length < 2) {
      setSendError('Write at least a couple of characters.');
      return;
    }
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      const added = await send(topic, text);
      setMessages((prev) => [...(prev || []), ...added]);
      setDraft('');
    } catch (err) {
      setSendError(getErrorMessage(err, 'Message could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(topic) && draft.trim().length >= 2 && !sending;

  return (
    <div role="dialog" aria-label="Support chat" className={panelClass}>
      <PanelHeader subtitle={subtitle} onClose={onClose} />

      <div className="px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-white/[0.06] bg-white dark:bg-zinc-900">
        <TopicPicker
          topic={topic}
          onChange={(t) => {
            setTopic(t);
            setSendError(null);
          }}
        />
      </div>

      <div
        ref={listRef}
        className="p-3 h-72 overflow-y-auto space-y-2 text-xs bg-zinc-50/50 dark:bg-zinc-950/60"
        aria-live="polite"
      >
        {messages === null && !loadError ? (
          <div className="h-full flex items-center justify-center text-zinc-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading conversation...
          </div>
        ) : loadError && (messages === null || messages.length === 0) ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-rose-600 dark:text-rose-400">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
            >
              Retry
            </button>
          </div>
        ) : messages && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 dark:text-zinc-400 px-4">
            <MessageCircle className="w-6 h-6 mb-2 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Start a conversation</p>
            <p className="text-[11px] mt-1 leading-relaxed">
              Pick a topic above and tell us what you need help with. Our team replies here and you get a notification.
            </p>
          </div>
        ) : (
          (messages || []).map((m) => {
            const mine = m.sender === 'CUSTOMER';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-xs ${
                    mine
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 rounded-bl-md'
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-semibold mb-0.5 ${
                      mine ? 'text-blue-100' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <span>{mine ? 'You' : 'Support'}</span>
                    <span aria-hidden="true">•</span>
                    <span>{TOPIC_LABELS[m.topic] || m.topic}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.message}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-blue-100/80' : 'text-zinc-400'}`}>
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10 space-y-1.5"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSendError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) handleSend(e);
              }
            }}
            rows={2}
            maxLength={MESSAGE_MAX}
            placeholder={topic ? `Ask about ${TOPIC_LABELS[topic].toLowerCase()}...` : 'Choose a topic, then type your message'}
            aria-label="Message to support"
            className={`flex-1 resize-none ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          {sendError ? (
            <p className="text-rose-600 dark:text-rose-400" role="alert">
              {sendError}
            </p>
          ) : (
            <p className="text-zinc-400">Enter to send, Shift+Enter for a new line</p>
          )}
          <span className="text-zinc-400 tabular-nums shrink-0">
            {draft.length}/{MESSAGE_MAX}
          </span>
        </div>
        {footer}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed-in customer
// ---------------------------------------------------------------------------
function CustomerChat({ token, onClose, onUnreadCleared }: { token: string; onClose: () => void; onUnreadCleared: () => void }) {
  const load = useCallback(async () => (await api.getSupportMessages(token)).items as ChatMessage[], [token]);
  const send = useCallback(
    async (topic: SupportTopic, message: string) => {
      const { autoReply, ...sent } = await api.sendSupportMessage(token, { topic, message });
      return [sent, ...(autoReply ? [autoReply] : [])] as ChatMessage[];
    },
    [token]
  );
  return (
    <ChatPanel
      subtitle="We reply here and by email, usually within a working day"
      load={load}
      send={send}
      onClose={onClose}
      onLoaded={onUnreadCleared}
    />
  );
}

// ---------------------------------------------------------------------------
// Visitor, first message: contact details + question (+ quick answers)
// ---------------------------------------------------------------------------
function GuestStartPanel({ onClose, onStarted }: { onClose: () => void; onStarted: (session: GuestSession) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address';
    if (phone && !/^[6-9][0-9]{9}$/.test(phone)) next.phone = 'Enter a 10-digit mobile number';
    if (!topic) next.topic = 'Choose a topic';
    if (message.trim().length < 2) next.message = 'Write your question';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !validate() || !topic) return;
    setSending(true);
    setFormError(null);
    try {
      const result = await api.sendGuestSupportMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone ? `+91${phone}` : '',
        topic,
        message: message.trim(),
      });
      onStarted({ token: result.token, name: result.guest.name, email: result.guest.email });
    } catch (err) {
      if (err instanceof ApiError && err.errors.length > 0) {
        setErrors(Object.fromEntries(err.errors.map((fe) => [fe.field, fe.message])));
      }
      setFormError(getErrorMessage(err, 'Message could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-400" role="alert">
        {errors[key]}
      </p>
    ) : null;

  const clear = (key: string) => setErrors((prev) => ({ ...prev, [key]: '' }));

  return (
    <div role="dialog" aria-label="Support chat" className={panelClass}>
      <PanelHeader subtitle="Ask us anything, no account needed" onClose={onClose} />

      <form onSubmit={handleSubmit} noValidate className="p-3 space-y-2.5 text-xs bg-zinc-50/50 dark:bg-zinc-950/60 max-h-[70vh] overflow-y-auto">
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Questions about accounts, KYC, deposits, withdrawals or plans? Leave your details and our team replies in this chat
          and by email, usually within a working day.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label htmlFor="support-guest-name" className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Your name <span className="text-rose-500">*</span>
            </label>
            <input
              id="support-guest-name"
              type="text"
              autoComplete="name"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                clear('name');
              }}
              placeholder="e.g. Priya Sharma"
              className={fieldClass}
            />
            {fieldError('name')}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="support-guest-email" className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              id="support-guest-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              maxLength={255}
              onChange={(e) => {
                setEmail(e.target.value);
                clear('email');
              }}
              placeholder="you@example.com"
              className={fieldClass}
            />
            {fieldError('email')}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="support-guest-phone" className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Mobile (optional)
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-2 rounded-l-xl border border-r-0 border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300">
                +91
              </span>
              <input
                id="support-guest-phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                value={phone}
                maxLength={10}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  clear('phone');
                }}
                placeholder="98765 43210"
                className={`${fieldClass} rounded-l-none`}
              />
            </div>
            {fieldError('phone')}
          </div>
        </div>

        <div>
          <TopicPicker
            topic={topic}
            onChange={(t) => {
              setTopic(t);
              clear('topic');
            }}
          />
          {fieldError('topic')}
        </div>

        <div>
          <label htmlFor="support-guest-message" className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
            Your question <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="support-guest-message"
            rows={3}
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => {
              setMessage(e.target.value);
              clear('message');
            }}
            placeholder={topic ? `Ask about ${TOPIC_LABELS[topic].toLowerCase()}...` : 'How can we help?'}
            className={`resize-none ${fieldClass}`}
          />
          {fieldError('message')}
        </div>

        {formError && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400" role="alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60 transition active:scale-[0.99]"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending...' : 'Start chat'}
        </button>

        <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Already a customer?{' '}
          <Link href="/login" onClick={onClose} className="inline-flex items-center gap-0.5 font-semibold text-blue-600 hover:underline">
            <LogIn className="w-3 h-3" /> Sign in
          </Link>{' '}
          for help with your own account.
        </p>

        <div className="border-t border-zinc-200 dark:border-white/10 pt-2">
          <button
            type="button"
            onClick={() => setShowFaq((v) => !v)}
            aria-expanded={showFaq}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 py-1"
          >
            Quick answers
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFaq ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showFaq && (
            <div className="mt-1.5 space-y-1.5">
              {FAQ.map((item, index) => {
                const expanded = openFaq === index;
                return (
                  <div key={item.question} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(expanded ? null : index)}
                      aria-expanded={expanded}
                      className="w-full text-left px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2"
                    >
                      <span>{item.question}</span>
                      <span className="text-zinc-400 shrink-0" aria-hidden="true">
                        {expanded ? '−' : '+'}
                      </span>
                    </button>
                    {expanded && <p className="px-3 pb-2.5 text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.answer}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visitor with a conversation in this browser
// ---------------------------------------------------------------------------
function GuestChat({
  session,
  onClose,
  onUnreadCleared,
  onEnd,
}: {
  session: GuestSession;
  onClose: () => void;
  onUnreadCleared: () => void;
  onEnd: () => void;
}) {
  const { token } = session;
  const load = useCallback(async () => (await api.getGuestSupportThread(token)).messages as ChatMessage[], [token]);
  const send = useCallback(
    async (topic: SupportTopic, message: string) => {
      const result = await api.sendGuestSupportMessage({ token, topic, message });
      return [result.message, ...(result.autoReply ? [result.autoReply] : [])] as ChatMessage[];
    },
    [token]
  );

  return (
    <ChatPanel
      subtitle={`Replies also go to ${session.email || 'your email'}`}
      load={load}
      send={send}
      onClose={onClose}
      onLoaded={onUnreadCleared}
      onSessionLost={onEnd}
      footer={
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          <Link href="/login" onClick={onClose} className="font-semibold text-blue-600 hover:underline">
            Sign in to your account
          </Link>
          <button type="button" onClick={onEnd} className="font-semibold hover:text-zinc-900 dark:hover:text-white">
            New conversation
          </button>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Floating button + panel
// ---------------------------------------------------------------------------
export const FloatingSupport: React.FC = () => {
  const { token } = useAuth({ required: false });
  const guestRaw = useStoredItem(GUEST_SESSION_KEY);
  const guest = useMemo(() => parseGuestSession(guestRaw), [guestRaw]);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState<{ key: string; count: number } | null>(null);

  // Whose unread badge: the signed-in customer, else the visitor's conversation in this browser
  const badgeKey = token ? `c:${token}` : guest ? `g:${guest.token}` : null;

  // Unread badge: poll while the panel is closed (opening it marks everything read)
  useEffect(() => {
    if (!badgeKey || isOpen) return;
    let active = true;
    const fetchCount = token
      ? () => api.getSupportUnreadCount(token)
      : () => api.getGuestSupportUnreadCount(guest!.token);
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      fetchCount()
        .then((count) => {
          if (active) setUnread({ key: badgeKey, count });
        })
        .catch(() => {
          // Background refresh: keep the last known count on failure
        });
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [badgeKey, isOpen, token, guest]);

  const clearUnread = useCallback(() => {
    if (badgeKey) setUnread({ key: badgeKey, count: 0 });
  }, [badgeKey]);

  const startGuest = useCallback((session: GuestSession) => {
    writeStoredItem(GUEST_SESSION_KEY, JSON.stringify(session));
  }, []);

  const endGuest = useCallback(() => {
    writeStoredItem(GUEST_SESSION_KEY, null);
  }, []);

  const unreadCount = badgeKey && unread && unread.key === badgeKey ? unread.count : 0;
  const close = () => setIsOpen(false);

  let panel: React.ReactNode = null;
  if (isOpen) {
    if (token) panel = <CustomerChat token={token} onClose={close} onUnreadCleared={clearUnread} />;
    else if (guest) panel = <GuestChat key={guest.token} session={guest} onClose={close} onUnreadCleared={clearUnread} onEnd={endGuest} />;
    else panel = <GuestStartPanel onClose={close} onStarted={startGuest} />;
  }

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end">
      {panel}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close support' : unreadCount > 0 ? `Open support chat, ${unreadCount} unread` : 'Open support chat'}
        className="relative w-12 h-12 rounded-full bg-blue-600 text-white hover:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-600/30 transition active:scale-95"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-zinc-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
