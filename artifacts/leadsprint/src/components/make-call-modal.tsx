import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PhoneCall,
  X,
  AlertTriangle,
  Shield,
  Bot,
  User,
  CheckCircle2,
  Phone,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import {
  useStartCall,
  useGetAgents,
  useGetLeads,
  useGetBusinessSettings,
  getGetCallsQueryKey,
  type StartCallInput,
} from '@workspace/api-client-react';

interface MakeCallModalProps {
  open: boolean;
  onClose: () => void;
  preselectedLeadId?: string;
  preselectedPhone?: string;
  preselectedName?: string;
  onSuccessCall?: (callId: string) => void;
}

export function MakeCallModal({
  open,
  onClose,
  preselectedLeadId,
  preselectedPhone,
  preselectedName,
  onSuccessCall,
}: MakeCallModalProps) {
  const queryClient = useQueryClient();
  const startCallMutation = useStartCall();
  const agentsQuery = useGetAgents();
  const leadsQuery = useGetLeads();
  const settingsQuery = useGetBusinessSettings();

  const [mode, setMode] = useState<'existing' | 'direct'>(
    preselectedLeadId ? 'existing' : preselectedPhone ? 'direct' : 'existing',
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string>(preselectedLeadId || '');
  const [directPhone, setDirectPhone] = useState(preselectedPhone || '');
  const [directName, setDirectName] = useState(preselectedName || '');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [callType, setCallType] = useState<'outbound' | 'test'>('outbound');
  const [confirmed, setConfirmed] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);

  if (!open) return null;

  const agents = agentsQuery.data || [];
  const leads = leadsQuery.data || [];
  const business = settingsQuery.data;
  const callingPaused = business?.calling_paused ?? false;

  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  const targetPhone = mode === 'existing' ? selectedLead?.phone : directPhone;
  const targetName = mode === 'existing' ? selectedLead?.name : directName || 'Direct Contact';
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    const payload: StartCallInput = {
      agent_id: selectedAgentId || undefined,
      call_type: callType,
    };

    if (mode === 'existing' && selectedLeadId) {
      payload.lead_id = selectedLeadId;
    } else if (directPhone.trim()) {
      payload.phone = directPhone.trim();
      payload.customer_name = directName.trim() || undefined;
    } else {
      return;
    }

    startCallMutation.mutate(
      { data: payload },
      {
        onSuccess: (data) => {
          setCallResult(data);
          queryClient.invalidateQueries({ queryKey: getGetCallsQueryKey() });
          onSuccessCall?.(data.id);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-[hsl(var(--card))] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]">
                <PhoneCall size={16} />
              </span>
              <h3 className="text-lg font-bold">Initiate Outbound Call</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dispatch an AI receptionist call with safety policy evaluation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workspace calling paused warning */}
        {callingPaused && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Calling is currently paused for this workspace</p>
                <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                  New calls will be safely blocked with status{' '}
                  <span className="font-mono font-bold">policy_blocked</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {!callResult ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {startCallMutation.isError && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                Failed to initiate call: {(startCallMutation.error as any)?.message || 'Server error'}
              </div>
            )}

            {/* Step 1: Mode selector */}
            {!confirmed && (
              <>
                <div className="flex rounded-lg border border-border bg-[hsl(var(--muted)/.4)] p-1">
                  <button
                    type="button"
                    onClick={() => setMode('existing')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition ${
                      mode === 'existing'
                        ? 'bg-[hsl(var(--card))] text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Select Pipeline Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('direct')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition ${
                      mode === 'direct'
                        ? 'bg-[hsl(var(--card))] text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Direct Phone Number
                  </button>
                </div>

                {/* Mode A: Select Lead */}
                {mode === 'existing' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Target Lead *
                    </label>
                    <select
                      value={selectedLeadId}
                      onChange={(e) => setSelectedLeadId(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                      data-testid="select-target-lead"
                    >
                      <option value="">Select a contact…</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} — {l.phone} ({l.property_type || l.project})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* Mode B: Direct Phone */
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Phone Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={directPhone}
                        onChange={(e) => setDirectPhone(e.target.value)}
                        placeholder="+12125550199"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                        data-testid="input-direct-phone"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={directName}
                        onChange={(e) => setDirectName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                        data-testid="input-direct-name"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Select AI Agent */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned AI Agent
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                    data-testid="select-call-agent"
                  >
                    <option value="">Default Receptionist Script</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.voice_id} · {a.language})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Select a virtual receptionist or use your workspace default.
                  </p>
                </div>

                {/* Call Type */}
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">
                    Call Purpose:
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="callType"
                      checked={callType === 'outbound'}
                      onChange={() => setCallType('outbound')}
                    />
                    <span>Standard Outbound</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="callType"
                      checked={callType === 'test'}
                      onChange={() => setCallType('test')}
                    />
                    <span>Safe Test Simulation</span>
                  </label>
                </div>
              </>
            )}

            {/* Step 3: Explicit Confirmation Screen */}
            {confirmed && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.3)] p-4 text-xs space-y-2">
                  <p className="font-bold text-sm text-foreground">Confirm Outbound Dispatch</p>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Target Recipient:</span>
                    <span className="font-semibold">{targetName} ({targetPhone})</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Assigned Agent:</span>
                    <span className="font-semibold">{selectedAgent?.name || 'Default Script'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Call Type:</span>
                    <span className="font-bold uppercase text-[hsl(var(--accent))]">{callType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Safety Checks:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Shield size={12} /> Policy gate evaluated at dispatch
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-500/10 p-3 text-[11px] text-amber-900 dark:text-amber-200">
                  ⚠️ Calls are subject to workspace pause, quiet hours, and consent verification.
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
              {confirmed ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmed(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={startCallMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
                    data-testid="button-confirm-initiate-call"
                  >
                    <PhoneCall size={14} />
                    <span>{startCallMutation.isPending ? 'Dispatching…' : 'Confirm & Dispatch Call'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mode === 'existing' ? !selectedLeadId : !directPhone.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
                    data-testid="button-next-confirm-call"
                  >
                    <span>Review Dispatch</span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>
          </form>
        ) : (
          /* Step 4: Real Backend Status Display */
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Call ID:</span>
                <span className="font-mono">{callResult.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Target:</span>
                <span>{callResult.lead_name || targetName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Backend Status:</span>
                <span
                  className={`rounded px-2 py-0.5 font-bold uppercase text-[11px] ${
                    callResult.status === 'in_progress'
                      ? 'bg-emerald-100 text-emerald-800'
                      : callResult.status === 'queued'
                      ? 'bg-amber-100 text-amber-800'
                      : callResult.status === 'policy_blocked'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {callResult.status}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="font-semibold text-muted-foreground">Outcome:</span>
                <span className="text-right max-w-xs">{callResult.outcome || callResult.summary}</span>
              </div>
              {callResult.error_state && (
                <div className="flex items-start justify-between text-rose-600 dark:text-rose-400">
                  <span className="font-semibold">Reason:</span>
                  <span className="text-right">{callResult.error_state}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => {
                  setCallResult(null);
                  setConfirmed(false);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
              >
                Place Another
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
