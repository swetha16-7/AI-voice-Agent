import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Plus,
  PhoneCall,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import {
  useGetAgents,
  useCreateAgent,
  useUpdateAgent,
  useTestAgent,
  getGetAgentsQueryKey,
  type Agent,
} from '@workspace/api-client-react';

const VOICES = [
  { id: 'retell-Cimo', name: 'Cimo', gender: 'Female', tone: 'Warm & Friendly (Receptionist)' },
  { id: 'retell-11labs-rachel', name: 'Rachel', gender: 'Female', tone: 'Calm & Professional (Executive)' },
  { id: 'retell-11labs-charlie', name: 'Charlie', gender: 'Male', tone: 'Conversational & Engaging' },
  { id: 'retell-11labs-george', name: 'George', gender: 'Male', tone: 'Warm & Authoritative (British)' },
  { id: 'retell-11labs-sarah', name: 'Sarah', gender: 'Female', tone: 'Energetic & Articulate' },
];

const LANGUAGES = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'es-ES', label: 'Spanish (Spain / LatAm)' },
];

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

export function AgentsPage() {
  const queryClient = useQueryClient();
  const agentsQuery = useGetAgents();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);

  const agents = agentsQuery.data || [];
  const syncedCount = agents.filter((a) => a.sync_status === 'synced').length;
  const activeCount = agents.filter((a) => a.is_active).length;

  return (
    <div className="animate-rise-in space-y-7">
      {/* Header Banner & Stats */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]">
              <Bot size={18} />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">AI Receptionist Agents</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure Retell voice agents, greetings, instructions, and synchronization states.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:brightness-110"
          data-testid="button-create-agent"
        >
          <Plus size={16} />
          <span>New AI Agent</span>
        </button>
      </div>

      {/* Overview Metric Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Total Agents</span>
            <Bot size={16} />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono">{agents.length}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Configured in workspace</p>
        </div>

        <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Retell Synced</span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {syncedCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Active on Retell API</p>
        </div>

        <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Active Desk Status</span>
            <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono">{activeCount}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Eligible for incoming/outbound calls</p>
        </div>
      </div>

      {/* Agent List */}
      {agentsQuery.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
          ))}
        </div>
      ) : agentsQuery.isError ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.04)] p-8 text-center">
          <AlertTriangle className="mb-3 text-[hsl(var(--destructive))]" size={22} />
          <h3 className="font-semibold">Could not load AI agents</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The service did not respond. Your configurations are safe.
          </p>
          <button
            onClick={() => agentsQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[hsl(var(--card)/.45)] p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary)/.35)] text-[hsl(var(--primary))]">
            <Bot size={24} />
          </div>
          <h3 className="font-semibold text-foreground">No AI Agents Configured</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first virtual receptionist to answer inquiries, capture messages, and book showings.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
          >
            <Plus size={16} />
            <span>Create AI Agent</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => setEditingAgent(agent)}
              onTest={() => setTestingAgent(agent)}
            />
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      {createModalOpen && (
        <CreateAgentModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            queryClient.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
          }}
        />
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSuccess={() => {
            setEditingAgent(null);
            queryClient.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
          }}
        />
      )}

      {/* Safe Test Call Modal */}
      {testingAgent && (
        <TestAgentModal agent={testingAgent} onClose={() => setTestingAgent(null)} />
      )}
    </div>
  );
}

function SyncStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 size={12} /> Retell Synced
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Clock size={12} className="animate-spin" /> Sync Pending
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertTriangle size={12} /> Sync Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Shield size={12} /> Saved Locally (Safe Mode)
        </span>
      );
  }
}

function AgentCard({
  agent,
  onEdit,
  onTest,
}: {
  agent: Agent;
  onEdit: () => void;
  onTest: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const voice = VOICES.find((v) => v.id === agent.voice_id) || {
    name: agent.voice_id,
    gender: 'Voice',
    tone: 'Configured',
  };

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-border bg-[hsl(var(--card))] p-5 shadow-sm transition hover:shadow-md"
      data-testid={`card-agent-${agent.id}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{agent.name}</h3>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  agent.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={agent.is_active ? 'Active' : 'Inactive'}
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {agent.language} · {voice.name} ({voice.tone})
            </p>
          </div>
          <SyncStatusBadge status={agent.sync_status} />
        </div>

        {/* Greeting excerpt */}
        <div className="mt-4 rounded-lg bg-[hsl(var(--muted)/.4)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Greeting
          </p>
          <p className="mt-1 line-clamp-2 text-xs italic text-foreground">
            "{agent.greeting || 'Hello! Thank you for calling.'}"
          </p>
        </div>

        {/* Prompt excerpt */}
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Instructions
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {agent.prompt || 'Professional virtual receptionist instructions.'}
          </p>
        </div>

        {/* Technical IDs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] font-mono text-muted-foreground">
          <span>ID: {agent.id.slice(0, 14)}…</span>
          {agent.retell_agent_id ? (
            <button
              onClick={() => copyId(agent.retell_agent_id || '')}
              className="inline-flex items-center gap-1 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 hover:text-foreground"
              title="Click to copy Retell Agent ID"
            >
              <span>Retell: {agent.retell_agent_id.slice(0, 12)}…</span>
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
            </button>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Retell ID pending</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          Synced: {formatDate(agent.last_synced_at || agent.updated_at)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onTest}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-[hsl(var(--muted))]"
            data-testid={`button-test-agent-${agent.id}`}
          >
            <PhoneCall size={13} className="text-[hsl(var(--accent))]" />
            <span>Test Agent</span>
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-[hsl(var(--muted))]"
            data-testid={`button-edit-agent-${agent.id}`}
          >
            <Settings2 size={13} />
            <span>Configure</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAgentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createMutation = useCreateAgent();
  const [name, setName] = useState('');
  const [voiceId, setVoiceId] = useState('retell-Cimo');
  const [language, setLanguage] = useState('en-US');
  const [greeting, setGreeting] = useState(
    'Hello! Thank you for calling our office. How may I direct your call today?',
  );
  const [prompt, setPrompt] = useState(
    'You are a professional, courteous front desk receptionist. Your goal is to identify the caller, understand their inquiry, answer questions about our services using verified information, and either schedule a showing or take a detailed message for a callback.',
  );
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate(
      {
        data: {
          name: name.trim(),
          voice_id: voiceId,
          language,
          greeting: greeting.trim(),
          prompt: prompt.trim(),
          is_active: isActive,
        },
      },
      {
        onSuccess,
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-[hsl(var(--card))] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold">Create Virtual Receptionist</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Configure name, persona, voice, and greetings for Retell AI synchronization.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {createMutation.isError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle size={14} className="mr-1.5 inline" />
              Failed to create agent: {(createMutation.error as any)?.message || 'Server error'}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Agent Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Desk Daytime Receptionist"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              data-testid="input-agent-name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Voice Persona
              </label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                data-testid="select-agent-voice"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.tone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Spoken Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                data-testid="select-agent-language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Opening Greeting
            </label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="First phrase the agent speaks when answering..."
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              data-testid="input-agent-greeting"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Instructions & Prompt
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Instructions defining persona, scope of authority, FAQ, escalation guidelines..."
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              data-testid="input-agent-prompt"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-[hsl(var(--primary))]"
            />
            <label htmlFor="is_active" className="text-xs font-semibold text-foreground">
              Activate agent immediately for calls
            </label>
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
              disabled={createMutation.isPending || !name.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
              data-testid="button-submit-create-agent"
            >
              {createMutation.isPending ? 'Synchronizing…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAgentModal({
  agent,
  onClose,
  onSuccess,
}: {
  agent: Agent;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const updateMutation = useUpdateAgent();
  const [name, setName] = useState(agent.name);
  const [voiceId, setVoiceId] = useState(agent.voice_id);
  const [language, setLanguage] = useState(agent.language);
  const [greeting, setGreeting] = useState(agent.greeting || '');
  const [prompt, setPrompt] = useState(agent.prompt || '');
  const [isActive, setIsActive] = useState(agent.is_active);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        id: agent.id,
        data: {
          name: name.trim(),
          voice_id: voiceId,
          language,
          greeting: greeting.trim(),
          prompt: prompt.trim(),
          is_active: isActive,
        },
      },
      {
        onSuccess,
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-[hsl(var(--card))] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold">Configure Agent: {agent.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Edits are automatically pushed to Retell API.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {updateMutation.isError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle size={14} className="mr-1.5 inline" />
              Failed to update agent: {(updateMutation.error as any)?.message || 'Server error'}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Agent Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Voice Persona
              </label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.tone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Spoken Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Opening Greeting
            </label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Instructions & Prompt
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit_is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-[hsl(var(--primary))]"
            />
            <label htmlFor="edit_is_active" className="text-xs font-semibold text-foreground">
              Agent is active and ready for dispatch
            </label>
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
              disabled={updateMutation.isPending || !name.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving & Syncing…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TestAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const testMutation = useTestAgent();
  const [phoneNumber, setPhoneNumber] = useState('+12125550199');
  const [customerName, setCustomerName] = useState('Safety Quality Tester');
  const [testResult, setTestResult] = useState<any>(null);

  const handleTest = (e: FormEvent) => {
    e.preventDefault();
    testMutation.mutate(
      {
        id: agent.id,
        data: {
          phone_number: phoneNumber.trim(),
          customer_name: customerName.trim(),
        },
      },
      {
        onSuccess: (data) => {
          setTestResult(data);
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
              <Shield size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-bold">Safe Test Simulation</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Verify agent configuration for "{agent.name}" without placing live calls.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Safety Invariant Notice */}
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
          <p className="font-semibold">🛡️ Safety Protection Active</p>
          <p className="mt-0.5 leading-relaxed text-[11px] opacity-90">
            This endpoint exercises the entire call creation pipeline and verifies agent assignment
            while enforcing the global kill switch. Real phone numbers will not ring.
          </p>
        </div>

        {!testResult ? (
          <form onSubmit={handleTest} className="mt-5 space-y-4">
            {testMutation.isError && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                Failed to initiate test call: {(testMutation.error as any)?.message || 'Server error'}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Test Recipient Phone
              </label>
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+12125550199"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                data-testid="input-test-phone"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Test Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Safety Inspector"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                data-testid="input-test-customer"
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
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
                data-testid="button-submit-test-call"
              >
                <PhoneCall size={14} />
                <span>{testMutation.isPending ? 'Verifying…' : 'Run Safe Test'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Call ID:</span>
                <span className="font-mono">{testResult.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Agent:</span>
                <span>{testResult.agent_name || agent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Call Type:</span>
                <span className="font-bold uppercase text-[hsl(var(--accent))]">
                  {testResult.call_type || 'test'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Safety Status:</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {testResult.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Outcome:</span>
                <span className="text-right">{testResult.outcome}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => setTestResult(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--muted))]"
              >
                Run Another Test
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
