import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  PhoneCall,
  User,
  Mail,
  AlertTriangle,
  RefreshCw,
  X,
  Check,
  ChevronRight,
  Filter,
  FileText,
} from 'lucide-react';
import {
  useGetMessages,
  useUpdateMessage,
  getGetMessagesQueryKey,
  type Message,
} from '@workspace/api-client-react';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function relativeTime(value?: string | null) {
  if (!value) return 'Just now';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export function MessagesPage({
  onOpenCall,
  onInitiateCall,
}: {
  onOpenCall?: (callId: string) => void;
  onInitiateCall?: (params: { phone: string; customerName: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unhandled' | 'handled'>('unhandled');
  const [search, setSearch] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const messagesParams =
    filter === 'unhandled'
      ? { is_handled: false, search: search.trim() || undefined }
      : filter === 'handled'
      ? { is_handled: true, search: search.trim() || undefined }
      : { search: search.trim() || undefined };

  const messagesQuery = useGetMessages(messagesParams);
  const allMessagesQuery = useGetMessages(); // for total counts

  const allMessages = allMessagesQuery.data || [];
  const totalCount = allMessages.length;
  const unhandledCount = allMessages.filter((m) => !m.is_handled).length;
  const handledCount = totalCount - unhandledCount;

  const displayedMessages = messagesQuery.data || [];

  return (
    <div className="animate-rise-in space-y-7">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]">
              <MessageSquare size={18} />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Messages & Callbacks</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Inquiries and callback requests captured by AI receptionists when human operators were unavailable.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => setFilter('unhandled')}
          className={`flex flex-col text-left rounded-xl border p-4 transition ${
            filter === 'unhandled'
              ? 'border-amber-500/60 bg-amber-500/5 shadow-sm'
              : 'border-border bg-[hsl(var(--card))] hover:border-border/80'
          }`}
          data-testid="filter-metric-unhandled"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Needs Follow-up</span>
            <span className="relative flex h-2 w-2">
              {unhandledCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${unhandledCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
            </span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {unhandledCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Pending operator response</p>
        </button>

        <button
          onClick={() => setFilter('handled')}
          className={`flex flex-col text-left rounded-xl border p-4 transition ${
            filter === 'handled'
              ? 'border-emerald-500/60 bg-emerald-500/5 shadow-sm'
              : 'border-border bg-[hsl(var(--card))] hover:border-border/80'
          }`}
          data-testid="filter-metric-handled"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Resolved</span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {handledCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Handled and closed</p>
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`flex flex-col text-left rounded-xl border p-4 transition ${
            filter === 'all'
              ? 'border-[hsl(var(--primary)/.6)] bg-[hsl(var(--primary)/.05)] shadow-sm'
              : 'border-border bg-[hsl(var(--card))] hover:border-border/80'
          }`}
          data-testid="filter-metric-all"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Total Messages</span>
            <FileText size={16} />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono">{totalCount}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">All logged messages</p>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-[hsl(var(--muted)/.4)] p-1">
          <button
            onClick={() => setFilter('unhandled')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              filter === 'unhandled'
                ? 'bg-[hsl(var(--card))] text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-unhandled"
          >
            Unhandled ({unhandledCount})
          </button>
          <button
            onClick={() => setFilter('handled')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              filter === 'handled'
                ? 'bg-[hsl(var(--card))] text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-handled"
          >
            Handled ({handledCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-[hsl(var(--card))] text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-all"
          >
            All Messages ({totalCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search caller name, phone, reason…"
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            data-testid="input-search-messages"
          />
        </div>
      </div>

      {/* Messages List */}
      {messagesQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
          ))}
        </div>
      ) : messagesQuery.isError ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.04)] p-8 text-center">
          <AlertTriangle className="mb-3 text-[hsl(var(--destructive))]" size={22} />
          <h3 className="font-semibold">Could not load messages</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The service did not respond. Your records remain safe.
          </p>
          <button
            onClick={() => messagesQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      ) : displayedMessages.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[hsl(var(--card)/.45)] p-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--secondary)/.35)] text-[hsl(var(--primary))]">
            <CheckCircle2 size={20} />
          </div>
          <h3 className="font-semibold text-foreground">
            {filter === 'unhandled'
              ? 'All caught up! No unhandled callback requests.'
              : 'No messages match your search filter.'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When callers leave inquiries or requests with your AI receptionists, they appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col justify-between gap-4 rounded-xl border bg-[hsl(var(--card))] p-4 shadow-sm transition sm:flex-row sm:items-center sm:p-5 ${
                !msg.is_handled
                  ? 'border-amber-500/30 bg-amber-500/[0.015]'
                  : 'border-border'
              }`}
              data-testid={`row-message-${msg.id}`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{msg.caller_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {msg.caller_phone}
                  </span>
                  {msg.caller_email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      · <Mail size={12} /> {msg.caller_email}
                    </span>
                  )}
                  {!msg.is_handled ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      <Clock size={11} /> Unhandled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 size={11} /> Handled
                    </span>
                  )}
                </div>

                <p className="text-xs text-foreground font-medium line-clamp-2">
                  <span className="text-muted-foreground font-normal">Reason: </span>
                  {msg.reason}
                </p>

                {msg.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                    <span className="font-semibold not-italic">Operator notes: </span>
                    {msg.notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                  <span>Logged: {relativeTime(msg.created_at)} ({formatDate(msg.created_at)})</span>
                  {msg.assigned_to && (
                    <span>· Assigned: <strong className="text-foreground">{msg.assigned_to}</strong></span>
                  )}
                  {msg.call_id && (
                    <button
                      onClick={() => onOpenCall?.(msg.call_id || '')}
                      className="text-[hsl(var(--accent))] hover:underline flex items-center gap-0.5 font-semibold"
                      data-testid={`link-related-call-${msg.id}`}
                    >
                      <span>Related Call</span>
                      <ChevronRight size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {onInitiateCall && (
                  <button
                    onClick={() =>
                      onInitiateCall({
                        phone: msg.caller_phone,
                        customerName: msg.caller_name,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-[hsl(var(--muted))]"
                    title="Initiate outbound call back"
                    data-testid={`button-callback-${msg.id}`}
                  >
                    <PhoneCall size={13} className="text-[hsl(var(--accent))]" />
                    <span>Call Back</span>
                  </button>
                )}

                <button
                  onClick={() => setEditingMessage(msg)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    !msg.is_handled
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110'
                      : 'border border-border bg-[hsl(var(--card))] text-foreground hover:bg-[hsl(var(--muted))]'
                  }`}
                  data-testid={`button-update-message-${msg.id}`}
                >
                  <Check size={13} />
                  <span>{msg.is_handled ? 'Edit Notes' : 'Mark Handled'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Resolution Modal */}
      {editingMessage && (
        <MessageResolutionModal
          message={editingMessage}
          onClose={() => setEditingMessage(null)}
          onSuccess={() => {
            setEditingMessage(null);
            queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey() });
          }}
        />
      )}
    </div>
  );
}

function MessageResolutionModal({
  message,
  onClose,
  onSuccess,
}: {
  message: Message;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const updateMutation = useUpdateMessage();
  const [isHandled, setIsHandled] = useState(message.is_handled);
  const [notes, setNotes] = useState(message.notes || '');
  const [assignedTo, setAssignedTo] = useState(message.assigned_to || '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        id: message.id,
        data: {
          is_handled: isHandled,
          notes: notes.trim(),
          assigned_to: assignedTo.trim() || undefined,
        },
      },
      {
        onSuccess,
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-[hsl(var(--card))] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold">Follow-up: {message.caller_name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {message.caller_phone} · Logged {formatDate(message.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-[hsl(var(--muted)/.4)] p-3 text-xs">
          <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
            Inquiry Reason
          </p>
          <p className="mt-1 text-foreground">{message.reason}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {updateMutation.isError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
              Failed to update message: {(updateMutation.error as any)?.message || 'Server error'}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_handled"
              checked={isHandled}
              onChange={(e) => setIsHandled(e.target.checked)}
              className="h-4 w-4 rounded border-border text-[hsl(var(--primary))]"
              data-testid="checkbox-is-handled"
            />
            <label htmlFor="is_handled" className="text-xs font-semibold text-foreground">
              Mark this inquiry as Handled / Resolved
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Assigned Operator
            </label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="e.g. Maya Patel"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              data-testid="input-assigned-to"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Follow-up Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record details of callback, customer requirements, or resolution..."
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              data-testid="input-followup-notes"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
              data-testid="button-save-message"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
