import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare, Send, Inbox, Mail, Phone, UserRound, Globe } from 'lucide-react';
import {
  useReplyToSupport,
  useSupportThread,
  useSupportThreads,
  useSupportUnreadCount,
  useDebouncedValue,
  useGuestThreads,
  useGuestThread,
  useReplyToGuest,
} from '../hooks';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { SearchInput } from '../components/SearchInput';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorState, Spinner, ViewOnlyNote, btnPrimaryClass, cardClass, selectClass, textareaClass } from '../components/ui';
import { formatDateTime, formatNumber, getApiErrorMessage } from '../utils/finance';
import { SupportSender, SupportTopic } from '../types';

type InboxKind = 'customers' | 'visitors';

/** One row in the conversation list, for either inbox */
interface InboxItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  topics: SupportTopic[];
  lastMessage: string;
  lastSender: SupportSender;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface InboxMessage {
  id: number;
  topic: SupportTopic;
  sender: SupportSender;
  adminUserId: number | null;
  adminEmail: string | null;
  message: string;
  createdAt: string;
}

interface InboxThread {
  customer: { userId: number; name: string; email: string; phone: string };
  messages: InboxMessage[];
}

const MESSAGE_MAX = 2000;

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

const TOPIC_CHIP: Record<SupportTopic, string> = {
  KYC: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/20',
  DEPOSIT: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
  WITHDRAWAL: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
  PLANS: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/20',
};

const TopicChip: React.FC<{ topic: SupportTopic; className?: string }> = ({ topic, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${TOPIC_CHIP[topic]} ${className}`}
  >
    {TOPIC_LABELS[topic] || topic}
  </span>
);

const UnreadBadge: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <span
      aria-label={`${count} unread`}
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[10px] font-bold"
    >
      {count > 99 ? '99+' : count}
    </span>
  ) : null;

const topicFilterOptions = [{ value: '', label: 'All topics' }, ...TOPICS.map((t) => ({ value: t.value, label: t.label }))];

export const SupportPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Customers (signed in) or visitors (wrote from the website before signing in)
  const [inbox, setInbox] = useState<InboxKind>('customers');
  const isVisitors = inbox === 'visitors';

  // Thread list filters
  const [page, setPage] = useState(1);
  const [topicFilter, setTopicFilter] = useState<SupportTopic | ''>('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'all'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  // Selected thread
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [replyTopic, setReplyTopic] = useState<SupportTopic | null>(null);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const listParams = useMemo(
    () => ({
      page,
      limit: 20,
      topic: topicFilter || undefined,
      status: statusFilter,
      search: debouncedSearch || undefined,
    }),
    [page, topicFilter, statusFilter, debouncedSearch]
  );

  const guestListParams = useMemo(
    () => ({ page, limit: 20, status: statusFilter, search: debouncedSearch || undefined }),
    [page, statusFilter, debouncedSearch]
  );

  const customerThreadsQuery = useSupportThreads(listParams);
  const guestThreadsQuery = useGuestThreads(guestListParams, isVisitors);
  const unreadQuery = useSupportUnreadCount();
  const customerThreadQuery = useSupportThread(isVisitors ? null : selectedUserId);
  const guestThreadQuery = useGuestThread(isVisitors ? selectedUserId : null);
  const { mutateAsync: sendCustomerReply, isPending: customerPending } = useReplyToSupport();
  const { mutateAsync: sendGuestReply, isPending: guestPending } = useReplyToGuest();
  const isPending = customerPending || guestPending;

  const threadsQuery = isVisitors ? guestThreadsQuery : customerThreadsQuery;
  const threadQuery = isVisitors ? guestThreadQuery : customerThreadQuery;

  const threads: InboxItem[] = isVisitors
    ? (guestThreadsQuery.data?.threads || []).map((t) => ({
        id: t.guestId,
        name: t.name,
        email: t.email,
        phone: t.phone,
        topics: t.topics,
        lastMessage: t.lastMessage,
        lastSender: t.lastSender,
        lastMessageAt: t.lastMessageAt,
        unreadCount: t.unreadCount,
      }))
    : (customerThreadsQuery.data?.threads || []).map((t) => ({
        id: t.userId,
        name: t.customerName,
        email: t.customerEmail,
        phone: t.customerPhone,
        topics: t.topics,
        lastMessage: t.lastMessage,
        lastSender: t.lastSender,
        lastMessageAt: t.lastMessageAt,
        unreadCount: t.unreadCount,
      }));

  const guestData = guestThreadQuery.data;
  const thread: InboxThread | undefined = isVisitors
    ? guestData
      ? {
          customer: {
            userId: guestData.guest.guestId,
            name: guestData.guest.name,
            email: guestData.guest.email,
            phone: guestData.guest.phone,
          },
          messages: guestData.messages,
        }
      : undefined
    : customerThreadQuery.data;
  const messages = thread?.messages || [];

  const switchInbox = (next: InboxKind) => {
    if (next === inbox) return;
    setInbox(next);
    setPage(1);
    setSelectedUserId(null);
    setReplyTopic(null);
    setReply('');
    setReplyError(null);
  };

  // Default the reply topic to the customer's latest topic when a thread opens
  useEffect(() => {
    if (!thread || replyTopic) return;
    const last = messages.length > 0 ? messages[messages.length - 1] : null;
    if (last) setReplyTopic(last.topic);
  }, [thread, messages, replyTopic]);

  // Keep the newest message in view
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, selectedUserId]);

  const selectThread = (userId: number) => {
    if (userId === selectedUserId) return;
    setSelectedUserId(userId);
    setReplyTopic(null);
    setReply('');
    setReplyError(null);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending || selectedUserId === null) return;
    const text = reply.trim();
    if (!replyTopic) {
      setReplyError('Choose the topic this reply is about');
      return;
    }
    if (text.length < 2) {
      setReplyError('Reply must be at least 2 characters');
      return;
    }
    setReplyError(null);
    try {
      if (isVisitors) {
        await sendGuestReply({ guestId: selectedUserId, topic: replyTopic, message: text });
        toast.success('The visitor sees it in the website chat and gets it by email.', 'Reply sent');
      } else {
        await sendCustomerReply({ userId: selectedUserId, topic: replyTopic, message: text });
        toast.success('The customer has been notified in the app and by email.', 'Reply sent');
      }
      setReply('');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to send the reply');
      setReplyError(msg);
      toast.error(msg);
    }
  };

  const unread = unreadQuery.data;
  const refreshAll = () => {
    threadsQuery.refetch();
    unreadQuery.refetch();
    if (selectedUserId !== null) threadQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Questions about KYC, deposits, withdrawals and plans from customers and from website visitors who are not signed in. Every reply is also sent by email."
        viewOnly={!isAdmin}
        actions={
          <>
            {unread && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <Inbox className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                {formatNumber(unread.unreadCount)} unread in {formatNumber(unread.openThreads)} thread
                {unread.openThreads === 1 ? '' : 's'}
              </span>
            )}
            <RefreshButton onClick={refreshAll} isFetching={threadsQuery.isFetching || threadQuery.isFetching} />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Thread list */}
        <div className={`lg:col-span-2 ${cardClass} p-0 overflow-hidden flex flex-col`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div
              role="tablist"
              aria-label="Inbox"
              className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 dark:border-slate-700/80 p-1 bg-slate-50 dark:bg-[#000000]"
            >
              {[
                { value: 'customers' as const, label: 'Customers', Icon: UserRound, count: unread?.customers?.unreadCount ?? 0 },
                { value: 'visitors' as const, label: 'Website visitors', Icon: Globe, count: unread?.visitors?.unreadCount ?? 0 },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={inbox === tab.value}
                  onClick={() => switchInbox(tab.value)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    inbox === tab.value
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <tab.Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  <UnreadBadge count={tab.count} />
                </button>
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by name, email or phone"
              label={isVisitors ? 'Search visitors' : 'Search customers'}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Filter by status"
                className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700/80 p-0.5 bg-slate-50 dark:bg-[#000000]"
              >
                {(['open', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === s}
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      statusFilter === s
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s === 'open' ? 'Needs reply' : 'All'}
                  </button>
                ))}
              </div>
              {!isVisitors && (
              <select
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value as SupportTopic | '');
                  setPage(1);
                }}
                aria-label="Filter by topic"
                className={selectClass}
              >
                {topicFilterOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {threadsQuery.isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400" role="status">
                <Spinner className="w-6 h-6 mx-auto mb-2" />
                Loading conversations...
              </div>
            ) : threadsQuery.isError ? (
              <ErrorState
                message={getApiErrorMessage(threadsQuery.error, 'Failed to load support threads.')}
                onRetry={() => threadsQuery.refetch()}
              />
            ) : threads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {statusFilter === 'open' ? 'Nothing waiting for a reply' : 'No conversations yet'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {statusFilter === 'open'
                    ? 'Every customer message has been answered.'
                    : isVisitors
                      ? 'Questions sent from the website chat before signing in will appear here.'
                      : 'Customer messages from the support chat will appear here.'}
                </p>
              </div>
            ) : (
              threads.map((t) => {
                const active = t.id === selectedUserId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectThread(t.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3 transition ${
                      active
                        ? 'bg-brand-50 dark:bg-brand-500/10 border-l-2 border-brand-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-sm truncate ${
                            t.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {t.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDateTime(t.lastMessageAt)}</span>
                        <UnreadBadge count={t.unreadCount} />
                      </div>
                    </div>
                    <p
                      className={`mt-1.5 text-xs truncate ${
                        t.unreadCount > 0 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span className="font-semibold">{t.lastSender === 'ADMIN' ? 'You: ' : ''}</span>
                      {t.lastMessage}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.topics.map((topic) => (
                        <TopicChip key={topic} topic={topic} />
                      ))}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Pagination meta={threadsQuery.data?.meta} onPageChange={setPage} />
        </div>

        {/* Conversation */}
        <div className={`lg:col-span-3 ${cardClass} p-0 overflow-hidden flex flex-col min-h-[60vh]`}>
          {selectedUserId === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Select a conversation</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                Pick a {isVisitors ? 'visitor' : 'customer'} on the left to read their messages and reply.
              </p>
            </div>
          ) : threadQuery.isLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400" role="status">
              <Spinner className="w-6 h-6 mr-2" />
              Loading conversation...
            </div>
          ) : threadQuery.isError ? (
            <ErrorState
              message={getApiErrorMessage(threadQuery.error, 'Failed to load this conversation.')}
              onRetry={() => threadQuery.refetch()}
              className="flex-1"
            />
          ) : thread ? (
            <>
              {/* Customer header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{thread.customer.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" /> {thread.customer.email}
                      </span>
                      {thread.customer.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {thread.customer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isVisitors ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 whitespace-nowrap">
                    <Globe className="w-3 h-3" /> Website visitor, not signed in
                  </span>
                ) : (
                  <Link
                    to={`/customers/${thread.customer.userId}`}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
                  >
                    View customer
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/60 dark:bg-slate-900/30 max-h-[50vh]">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-10">No messages in this conversation yet.</p>
                ) : (
                  messages.map((m) => {
                    const fromAdmin = m.sender === 'ADMIN';
                    return (
                      <div key={m.id} className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                            fromAdmin
                              ? 'bg-brand-600 text-white rounded-br-md'
                              : 'bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md'
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 text-[10px] font-semibold mb-1 ${
                              fromAdmin ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <span>{fromAdmin ? m.adminEmail || (m.adminUserId ? 'Admin' : 'Support auto-reply') : thread.customer.name}</span>
                            <TopicChip topic={m.topic} className={fromAdmin ? 'bg-white/15 text-white border-white/20' : ''} />
                          </div>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.message}</p>
                          <p className={`text-[10px] mt-1.5 ${fromAdmin ? 'text-white/70' : 'text-slate-400'}`}>
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Reply box */}
              <div className="border-t border-slate-200 dark:border-slate-800 p-4">
                {isAdmin ? (
                  <form onSubmit={handleReply} noValidate className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Reply about</span>
                      {TOPICS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => {
                            setReplyTopic(t.value);
                            setReplyError(null);
                          }}
                          aria-pressed={replyTopic === t.value}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                            replyTopic === t.value
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      value={reply}
                      onChange={(e) => {
                        setReply(e.target.value);
                        setReplyError(null);
                      }}
                      maxLength={MESSAGE_MAX}
                      placeholder={`Write your reply to ${thread.customer.name}`}
                      aria-label="Reply"
                      className={textareaClass}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px]">
                        {replyError ? (
                          <span className="text-rose-600 dark:text-rose-400" role="alert">
                            {replyError}
                          </span>
                        ) : (
                          <span className="text-slate-400 tabular-nums">
                            {reply.length}/{MESSAGE_MAX}
                          </span>
                        )}
                      </div>
                      <button type="submit" disabled={isPending || reply.trim().length < 2 || !replyTopic} className={btnPrimaryClass}>
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send reply
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <ViewOnlyNote />
                    <span>Only managers (Super Admin and Admin) can reply.</span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
