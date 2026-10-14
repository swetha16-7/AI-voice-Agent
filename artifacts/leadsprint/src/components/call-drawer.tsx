import { useState } from 'react';
import {
  X,
  PhoneCall,
  CalendarDays,
  MessageSquare,
  AlertTriangle,
  Clock,
  Play,
  Volume2,
  Copy,
  Check,
  User,
  Bot,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  getGetCallQueryKey,
  useGetCall,
  useStartCall,
  type Call,
} from '@workspace/api-client-react';
import { formatDuration } from '@/lib/call-helpers';

interface CallDrawerProps {
  callId: string | null;
  onClose: () => void;
  onOpenMessage?: (messageId: string) => void;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function sentimentTone(sentiment?: string | null) {
  const s = (sentiment || '').toLowerCase();
  if (s.includes('pos')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300';
  if (s.includes('neg')) return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300';
  if (s.includes('mix')) return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300';
  if (s.includes('neu')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300';
  return 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-300';
}

export function CallDrawer({ callId, onClose, onOpenMessage }: CallDrawerProps) {
  const callQuery = useGetCall(callId || '', {
    query: {
      queryKey: getGetCallQueryKey(callId || ''),
      enabled: Boolean(callId),
    },
  });
  const startCall = useStartCall();
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  if (!callId) return null;

  const call = callQuery.data;

  const copyTranscript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full max-w-[560px] overflow-y-auto bg-[hsl(var(--card))] p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">
                Receptionist Call Detail
              </p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">
                {call?.lead_name || 'Call Details'}
              </h2>
              {call?.phone && (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{call.phone}</p>
              )}
            </div>
            <button
              onClick={onClose}
              data-testid="button-close-call-drawer"
              className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
            >
              <X size={18} />
            </button>
          </div>

          {callQuery.isLoading ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
              <div className="h-44 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
            </div>
          ) : callQuery.isError || !call ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800">
              <AlertTriangle size={15} className="mr-1.5 inline" />
              Could not load call details.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              {call.status === 'in_progress' ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-semibold">Call is actively live with Retell AI</span>
                </div>
              ) : call.status === 'queued' ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                  <span className="relative inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                  <span className="font-semibold">Connecting to provider · awaiting call start</span>
                </div>
              ) : call.status === 'policy_blocked' ? (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>
                    <strong>Blocked by Safety Policy:</strong> {call.outcome || call.error_state}
                  </span>
                </div>
              ) : null}

              {/* Call Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border bg-[hsl(var(--muted)/.25)] p-3">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Call Type
                  </span>
                  <p className="mt-1 font-semibold uppercase text-[hsl(var(--accent))]">
                    {call.call_type || 'outbound'}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-[hsl(var(--muted)/.25)] p-3">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Virtual Agent
                  </span>
                  <p className="mt-1 font-semibold truncate">{call.agent_name || 'Default Script'}</p>
                </div>

                <div className="rounded-lg border border-border bg-[hsl(var(--muted)/.25)] p-3">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Duration
                  </span>
                  <p className="mt-1 font-mono font-semibold">
                    {formatDuration(call.duration_seconds)}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-[hsl(var(--muted)/.25)] p-3">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Started
                  </span>
                  <p className="mt-1">{formatTime(call.started_at)}</p>
                </div>

                {call.sentiment && (
                  <div className="col-span-2 rounded-lg border border-border bg-[hsl(var(--muted)/.25)] p-3 flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                      Sentiment
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${sentimentTone(
                        call.sentiment,
                      )}`}
                    >
                      <Sparkles size={11} /> {call.sentiment}
                    </span>
                  </div>
                )}
              </div>

              {/* Disconnection Reason */}
              {call.disconnection_reason && (
                <div className="rounded-lg border border-border bg-[hsl(var(--muted)/.3)] p-3 text-xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                    Disconnection Reason
                  </span>
                  <p className="mt-0.5 font-mono text-[11px] text-foreground">
                    {call.disconnection_reason}
                  </p>
                </div>
              )}

              {/* Audio Player */}
              {call.recording_url ? (
                <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Volume2 size={15} className="text-[hsl(var(--accent))]" />
                      <span>Call Recording</span>
                    </div>
                    <a
                      href={call.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[hsl(var(--accent))] hover:underline flex items-center gap-1"
                    >
                      <span>Download</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <audio
                    controls
                    src={call.recording_url}
                    className="w-full mt-2 h-9 rounded-lg"
                    data-testid="audio-recording-player"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  No recording available for this call
                </div>
              )}

              {/* Summary */}
              <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.35)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Summary & Outcome
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                  {call.summary || call.outcome || 'No outcome summary recorded.'}
                </p>
              </div>

              {/* Transcript */}
              {call.transcript && (
                <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Transcript
                    </span>
                    <button
                      onClick={() => copyTranscript(call.transcript || '')}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {copiedTranscript ? (
                        <>
                          <Check size={11} className="text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy Transcript</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-[hsl(var(--muted)/.2)] p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap text-foreground">
                    {call.transcript}
                  </div>
                </div>
              )}

              {/* Message Left Badge */}
              {call.message_left && (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Caller Left a Message</p>
                      <p className="text-[11px] opacity-80">Follow-up requested by caller</p>
                    </div>
                  </div>
                  {call.message_id && onOpenMessage && (
                    <button
                      onClick={() => onOpenMessage(call.message_id || '')}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs font-bold shadow-sm"
                    >
                      View Message
                    </button>
                  )}
                </div>
              )}

              {/* Appointment Booked */}
              {call.booked && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <CalendarDays size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-semibold">Appointment Booked</p>
                    <p className="text-[11px] opacity-80">Showing scheduled via Cal.com</p>
                  </div>
                </div>
              )}

              {/* Technical Identifiers */}
              <div className="border-t border-border pt-3 text-[11px] font-mono text-muted-foreground space-y-1">
                <div>LeadSprint Call ID: {call.id}</div>
                {(call as any).provider_call_id && (
                  <div>Retell Call ID: {(call as any).provider_call_id}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        {call && (
          <div className="border-t border-border pt-4 mt-6">
            <button
              onClick={() => {
                startCall.mutate({
                  data: {
                    lead_id: call.lead_id,
                    agent_id: call.agent_id || undefined,
                    call_type: call.call_type === 'test' ? 'test' : 'outbound',
                  },
                });
              }}
              disabled={startCall.isPending || call.status === 'in_progress'}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:brightness-110 disabled:opacity-50"
              data-testid="button-retry-call-drawer"
            >
              <PhoneCall size={14} />
              <span>
                {call.status === 'in_progress' ? 'Call is in progress' : 'Retry Call with Agent'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
