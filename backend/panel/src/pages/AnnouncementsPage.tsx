import React, { useState, useId } from 'react';
import { Megaphone, Send, Loader2, Users } from 'lucide-react';
import { useAnnouncements, useCreateAnnouncement } from '../hooks';
import { Pagination } from '../components/Pagination';
import { PageHeader } from '../components/PageHeader';
import { RefreshButton } from '../components/RefreshButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field, FormError, ErrorState, Spinner, ViewOnlyNote, inputClass, textareaClass, btnPrimaryClass, cardClass, tableCardClass } from '../components/ui';
import { formatDateTime, formatNumber, getApiErrorMessage } from '../utils/finance';

const TITLE_MAX = 200;
const MESSAGE_MAX = 2000;

export const AnnouncementsPage: React.FC = () => {
  const formId = useId();
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ title?: string; message?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch, isFetching } = useAnnouncements({ page, limit: 10 });
  const { mutateAsync: createAnnouncement, isPending } = useCreateAnnouncement();

  const announcements = data?.announcements || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const next: typeof errors = {};
    if (cleanTitle.length < 3) next.title = 'Title must be at least 3 characters';
    if (cleanMessage.length < 5) next.message = 'Message must be at least 5 characters';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    try {
      const res = await createAnnouncement({ title: cleanTitle, message: cleanMessage });
      const recipients = res.data?.recipientsCount;
      toast.success(
        typeof recipients === 'number'
          ? `"${cleanTitle}" was sent to ${formatNumber(recipients)} customer${recipients === 1 ? '' : 's'}`
          : `"${cleanTitle}" was sent to all customers`,
        'Announcement sent'
      );
      setTitle('');
      setMessage('');
      setPage(1);
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to send the announcement');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast a notification to every customer and review what has already been sent."
        viewOnly={!isAdmin}
        actions={<RefreshButton onClick={() => refetch()} isFetching={isFetching} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Compose */}
        <div className={`${cardClass} space-y-4`}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            New Announcement
          </h3>

          {isAdmin ? (
            <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
              <FormError message={formError} />

              <Field label="Title" htmlFor={`${formId}-title`} required error={errors.title}>
                <input
                  id={`${formId}-title`}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  maxLength={TITLE_MAX}
                  placeholder="e.g. New 180 day plan is now live"
                  className={inputClass}
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={`${formId}-message`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {message.length}/{MESSAGE_MAX}
                  </span>
                </div>
                <textarea
                  id={`${formId}-message`}
                  rows={6}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  maxLength={MESSAGE_MAX}
                  placeholder="Write the announcement customers will see in their notifications"
                  className={textareaClass}
                />
                {errors.message && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1" role="alert">
                    {errors.message}
                  </p>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                The announcement is delivered immediately to every customer with an active account and cannot be recalled.
              </p>

              <button type="submit" disabled={isPending} className={`${btnPrimaryClass} w-full py-2.5`}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to All Customers
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <ViewOnlyNote />
              <p>Only managers (Super Admin and Admin) can send announcements. You can review the history.</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className={`lg:col-span-2 ${tableCardClass}`}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Announcement History</h3>
          </div>

          <div className="p-4 space-y-2.5">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400" role="status">
                <Spinner className="w-6 h-6 mx-auto mb-2" />
                Loading announcements...
              </div>
            ) : isError ? (
              <ErrorState message={getApiErrorMessage(error, 'Failed to load announcements.')} onRetry={() => refetch()} />
            ) : announcements.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3">
                  <Megaphone className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No announcements yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAdmin ? 'Use the form to send the first one.' : 'Sent announcements will be listed here.'}
                </p>
              </div>
            ) : (
              announcements.map((item) => (
                <article
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white break-words">{item.title}</h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 whitespace-nowrap self-start">
                      <Users className="w-3 h-3" />
                      {formatNumber(item.recipientsCount)} recipient{Number(item.recipientsCount) === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
                  <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    Sent by {item.createdBy || 'System'} • {formatDateTime(item.createdAt)}
                  </div>
                </article>
              ))
            )}
          </div>

          <Pagination meta={data?.meta} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
};
