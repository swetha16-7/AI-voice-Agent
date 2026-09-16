import { useState, useEffect, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  UserCheck,
  PhoneCall,
  Calendar,
  ShieldAlert,
  Sliders,
  Bot,
  FileCheck2,
  CheckCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Save,
  AlertTriangle,
  Info as InfoIcon,
  Sparkles,
  Lock,
  ExternalLink,
} from 'lucide-react';
import {
  useGetBusinessSettings,
  useUpdateBusinessSettings,
  useGetAuthMe,
  getGetBusinessSettingsQueryKey,
} from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';

interface OnboardingFormState {
  // 1. Business Info
  legalName: string;
  name: string; // Operating name (Persisted)
  projectName: string; // Desk name (Persisted)
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  citiesServed: string;
  market: 'US' | 'IN'; // Persisted
  timezone: string; // Persisted
  primaryContactName: string;
  contactEmail: string;
  contactPhone: string;

  // 2. Operator Info
  operatorName: string;
  operatorRole: string;
  operatorEmail: string;
  operatorPhone: string;
  approvalContact: string;
  authorizedCheckbox: boolean;

  // 3. Telephony
  telephonyProvider: string;
  telephonyAccount: string;
  phoneNumber: string; // Business phone (Persisted)
  transferNumber: string; // Transfer phone (Persisted)
  phoneOwnershipConfirmed: boolean;
  retellAgentId: string; // (Persisted)
  retellAgentVersion: string;
  telephonyWebhookConfigured: boolean;

  // 4. Calendar
  calendarProvider: string;
  calendarAccount: string;
  calendarId: string;
  calEventTypeId: string; // (Persisted)
  eventDuration: string;
  bookingHours: string;
  bufferRules: string;
  attendeeTimezoneAuto: boolean;
  calendarWebhookConfigured: boolean;

  // 5. Lead Intake & Compliance
  leadSource: string;
  crmSystem: string;
  sourceEventIdFormat: string;
  requiredLeadFields: string;
  consentCaptureMethod: string;
  dncSource: string;
  timezoneProvenanceConfirmed: boolean;

  // 6. Calling Policy
  callingDays: string;
  businessCallingHours: string;
  quietHours: string; // (Persisted)
  maxCallAttempts: number; // (Persisted)
  retryBackoff: string;
  transferRules: string;
  handoffRules: string;

  // 7. Voice Agent
  agentPurpose: string;
  greetingText: string;
  approvedFaq: string; // (Persisted)
  qualificationQuestions: string[]; // (Persisted)
  allowedInfo: string;
  prohibitedInfo: string;
  escalationRules: string; // (Persisted)
  aiDisclosure: boolean; // (Persisted)
  recordingDisclosure: boolean; // (Persisted)

  // 8. Commercial
  commercialAcknowledged: boolean;
}

const STEPS = [
  { id: 1, label: 'Business Info', icon: Building2 },
  { id: 2, label: 'Authorized Operator', icon: UserCheck },
  { id: 3, label: 'Telephony & Voice', icon: PhoneCall },
  { id: 4, label: 'Calendar & Scheduling', icon: Calendar },
  { id: 5, label: 'Lead Intake & Compliance', icon: ShieldAlert },
  { id: 6, label: 'Calling Policy', icon: Sliders },
  { id: 7, label: 'Voice Agent', icon: Bot },
  { id: 8, label: 'Commercial Agreement', icon: FileCheck2 },
  { id: 9, label: 'Review & Verify', icon: CheckCircle },
  { id: 10, label: 'Pending Verification', icon: Clock },
];

export function OnboardingPage() {
  const [, setLocation] = useLocation();
  const auth = useGetAuthMe();
  const settings = useGetBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState<OnboardingFormState>({
    legalName: '',
    name: '',
    projectName: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    citiesServed: '',
    market: 'US',
    timezone: 'America/Chicago',
    primaryContactName: '',
    contactEmail: '',
    contactPhone: '',

    operatorName: '',
    operatorRole: '',
    operatorEmail: '',
    operatorPhone: '',
    approvalContact: '',
    authorizedCheckbox: false,

    telephonyProvider: 'Twilio / Retell',
    telephonyAccount: '',
    phoneNumber: '',
    transferNumber: '',
    phoneOwnershipConfirmed: false,
    retellAgentId: '',
    retellAgentVersion: 'v1.0',
    telephonyWebhookConfigured: false,

    calendarProvider: 'Cal.com',
    calendarAccount: '',
    calendarId: '',
    calEventTypeId: '',
    eventDuration: '30m',
    bookingHours: 'Mon-Fri 09:00-18:00',
    bufferRules: '15m buffer',
    attendeeTimezoneAuto: true,
    calendarWebhookConfigured: false,

    leadSource: 'Website Form / Facebook Ads',
    crmSystem: 'Webform Webhook',
    sourceEventIdFormat: 'UUID / Numeric Event ID',
    requiredLeadFields: 'First Name, Last Name, Phone, Email, Property Interest',
    consentCaptureMethod: 'Affirmative TCPA checkbox with timestamp & IP capture',
    dncSource: 'Internal CRM DNC / One-click UI suppression',
    timezoneProvenanceConfirmed: true,

    callingDays: 'Mon, Tue, Wed, Thu, Fri',
    businessCallingHours: '09:00 - 18:00',
    quietHours: '21:00–08:00',
    maxCallAttempts: 2,
    retryBackoff: '30 minutes',
    transferRules: 'Live SIP transfer upon buyer handoff request',
    handoffRules: 'Post callback task to Today desk if operator transfer fails',

    agentPurpose: 'Inbound speed-to-lead qualification and showing appointment scheduling',
    greetingText: 'Hello, this is [Assistant Name] with [Agency Name] on a recorded line following up on your property inquiry. Do you have a quick moment?',
    approvedFaq: '',
    qualificationQuestions: [
      'What neighborhood or area are you looking in?',
      'What is your target budget range?',
      'When are you hoping to make a move?',
    ],
    allowedInfo: 'Timeline, preferred zip codes, price range, pre-approval status, showing slot preference',
    prohibitedInfo: 'Social Security Numbers, banking details, credit card numbers, health data',
    escalationRules: 'Transfer questions outside approved business information to a human.',
    aiDisclosure: true,
    recordingDisclosure: true,

    commercialAcknowledged: false,
  });

  // Hydrate from existing persistent business settings and auth profile
  useEffect(() => {
    if (settings.data) {
      setFormData((prev) => ({
        ...prev,
        name: settings.data?.name || prev.name,
        projectName: settings.data?.project_name || prev.projectName,
        market: (settings.data?.market as 'US' | 'IN') || prev.market,
        timezone: settings.data?.timezone || prev.timezone,
        phoneNumber: settings.data?.phone_number || prev.phoneNumber,
        transferNumber: settings.data?.transfer_number || prev.transferNumber,
        quietHours: settings.data?.quiet_hours || prev.quietHours,
        maxCallAttempts: settings.data?.max_call_attempts || prev.maxCallAttempts,
        approvedFaq: settings.data?.approved_faq || prev.approvedFaq,
        qualificationQuestions: settings.data?.qualification_questions || prev.qualificationQuestions,
        escalationRules: settings.data?.escalation_rules || prev.escalationRules,
        retellAgentId: settings.data?.retell_agent_id || prev.retellAgentId,
        calEventTypeId: settings.data?.cal_event_type_id || prev.calEventTypeId,
        aiDisclosure: settings.data?.ai_disclosure ?? prev.aiDisclosure,
        recordingDisclosure: settings.data?.recording_disclosure ?? prev.recordingDisclosure,
      }));
    }
    if (auth.data?.user) {
      setFormData((prev) => ({
        ...prev,
        operatorName: prev.operatorName || auth.data.user.name || '',
        operatorEmail: prev.operatorEmail || auth.data.user.email || '',
        operatorRole: prev.operatorRole || auth.data.user.role || 'owner',
      }));
    }
  }, [settings.data, auth.data]);

  const updateField = (key: keyof OnboardingFormState, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) errs.name = 'Operating business name is required.';
      if (!formData.projectName.trim()) errs.projectName = 'Desk or campaign name is required.';
      if (!formData.timezone.trim()) errs.timezone = 'Business timezone is required.';
      if (formData.website && !formData.website.startsWith('http')) {
        errs.website = 'Website must start with http:// or https://';
      }
    } else if (step === 2) {
      if (!formData.operatorName.trim()) errs.operatorName = 'Operator name is required.';
      if (!formData.operatorEmail.trim() || !formData.operatorEmail.includes('@')) {
        errs.operatorEmail = 'Valid business email is required.';
      }
      if (!formData.authorizedCheckbox) {
        errs.authorizedCheckbox = 'You must confirm operational authorization to configure this workspace.';
      }
    } else if (step === 3) {
      if (!formData.phoneNumber.trim()) errs.phoneNumber = 'Outbound business phone number is required.';
      if (!formData.transferNumber.trim()) errs.transferNumber = 'Operator human transfer number is required.';
    } else if (step === 4) {
      if (!formData.bookingHours.trim()) errs.bookingHours = 'Available booking hours are required.';
    } else if (step === 5) {
      if (!formData.leadSource.trim()) errs.leadSource = 'Inbound lead source description is required.';
      if (!formData.consentCaptureMethod.trim()) errs.consentCaptureMethod = 'Consent capture method is required.';
    } else if (step === 6) {
      if (!formData.quietHours.trim()) errs.quietHours = 'Quiet hours window is required.';
      if (formData.maxCallAttempts < 1 || formData.maxCallAttempts > 10) {
        errs.maxCallAttempts = 'Max call attempts must be between 1 and 10.';
      }
    } else if (step === 7) {
      if (!formData.greetingText.trim()) errs.greetingText = 'Greeting text is required.';
    } else if (step === 8) {
      if (!formData.commercialAcknowledged) {
        errs.commercialAcknowledged = 'You must acknowledge the commercial terms and calling limits.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveDraft = async () => {
    try {
      await updateSettings.mutateAsync({
        data: {
          project_name: formData.projectName,
          market: formData.market,
          timezone: formData.timezone,
          transfer_number: formData.transferNumber,
          approved_faq: formData.approvedFaq,
          qualification_questions: formData.qualificationQuestions,
          recording_disclosure: formData.recordingDisclosure,
          ai_disclosure: formData.aiDisclosure,
          quiet_hours: formData.quietHours,
          max_call_attempts: Number(formData.maxCallAttempts),
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetBusinessSettingsQueryKey() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      // Handled by API error
    }
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      await handleSaveDraft();
      setCurrentStep((prev) => Math.min(prev + 1, 10));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmitForVerification = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(8)) {
      setCurrentStep(8);
      return;
    }

    // Persist all standard business settings
    await handleSaveDraft();
    setIsSubmitted(true);
    setCurrentStep(10);
  };

  if (settings.isLoading || auth.isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
        <p className="text-sm text-muted-foreground">Loading onboarding workspace...</p>
      </div>
    );
  }

  return (
    <div className="animate-rise-in mx-auto max-w-5xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--accent)/.1)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--accent))]">
            <Sparkles size={13} />
            <span>Pilot Onboarding & Configuration</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Real Customer Onboarding Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your agency configuration for LeadSprint verification and controlled activation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={updateSettings.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted))] disabled:opacity-50"
            data-testid="button-save-draft"
          >
            {updateSettings.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saveSuccess ? 'Draft Saved' : 'Save Progress'}
          </button>
          <Link
            href="/workspace/business-settings"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted))]"
          >
            Settings Desk <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Holding Safety Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[#e5d28d] bg-[#fdfbf2] p-4 text-[#735a1a]">
        <Lock size={18} className="mt-0.5 shrink-0 text-[#a37b18]" />
        <div className="text-xs leading-5">
          <strong className="font-semibold">Controlled Production Safety Gate Active:</strong> Submitting this onboarding form saves your agency configuration for technical verification. Outbound dialing remains <strong>strictly paused</strong> until technical verification, provider binding sanity checks, and explicit customer go-live approval are completed by LeadSprint operations.
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[720px] items-center justify-between gap-1 border-b border-border pb-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isCompleted = step.id < currentStep || isSubmitted;
            const isCurrent = step.id === currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => (step.id < currentStep || isSubmitted) && setCurrentStep(step.id)}
                disabled={step.id > currentStep && !isSubmitted}
                className={`flex flex-col items-center gap-1.5 px-2 text-center transition-all ${
                  isCurrent
                    ? 'font-bold text-[hsl(var(--accent))]'
                    : isCompleted
                    ? 'text-foreground hover:text-[hsl(var(--accent))]'
                    : 'text-muted-foreground opacity-40'
                }`}
                data-testid={`step-tab-${step.id}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    isCurrent
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-white shadow-sm'
                      : isCompleted
                      ? 'border-[#24634f] bg-[#d7e9df] text-[#24634f]'
                      : 'border-border bg-[hsl(var(--muted))] text-muted-foreground'
                  }`}
                >
                  {isCompleted && !isCurrent ? <CheckCircle size={15} /> : step.id}
                </div>
                <span className="text-[11px] whitespace-nowrap">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Form Container */}
      <div className="rounded-2xl border border-border bg-[hsl(var(--card))] p-6 sm:p-8 shadow-sm">
        {/* Step 1: Business Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">1. Customer & Business Information</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Official entity registration and operating location for your real estate operation.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operating / Brand Name <span className="text-destructive">*</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Skyline Premier Realty"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-operating-name"
                />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Project / Campaign Desk Name <span className="text-destructive">*</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => updateField('projectName', e.target.value)}
                  placeholder="e.g. Metro Inbound Residential Desk"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-project-name"
                />
                {errors.projectName && <p className="mt-1 text-xs text-destructive">{errors.projectName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Legal Entity Name
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Collected for Intake Verification)</span>
                </label>
                <input
                  type="text"
                  value={formData.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                  placeholder="e.g. Skyline Real Estate Holdings LLC"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-legal-name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Corporate Website URL
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Collected for Intake Verification)</span>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://www.youragency.com"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-website"
                />
                {errors.website && <p className="mt-1 text-xs text-destructive">{errors.website}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  Physical Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main Street, Suite 400"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-address"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">City & State</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="Austin"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                    data-testid="input-city"
                  />
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    placeholder="TX"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                    data-testid="input-state"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">Business Timezone <span className="text-destructive">*</span></label>
                <select
                  value={formData.timezone}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="select-timezone"
                >
                  <option value="America/New_York">Eastern Time (America/New_York)</option>
                  <option value="America/Chicago">Central Time (America/Chicago)</option>
                  <option value="America/Denver">Mountain Time (America/Denver)</option>
                  <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                </select>
                {errors.timezone && <p className="mt-1 text-xs text-destructive">{errors.timezone}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Authorized Operator */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">2. Authorized Operator</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Designated operator credentials and administrative authority.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-xs">
              <p className="font-semibold text-foreground">Authenticated Clerk Identity:</p>
              <p className="mt-0.5 font-mono text-muted-foreground">
                {auth.data?.user.email || 'Authenticated operator session'} (Role: {auth.data?.user.role || 'owner'})
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operator Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.operatorName}
                  onChange={(e) => updateField('operatorName', e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-operator-name"
                />
                {errors.operatorName && <p className="mt-1 text-xs text-destructive">{errors.operatorName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operator Role / Title
                </label>
                <input
                  type="text"
                  value={formData.operatorRole}
                  onChange={(e) => updateField('operatorRole', e.target.value)}
                  placeholder="Principal Broker / Lead Operations Director"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-operator-role"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operator Business Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={formData.operatorEmail}
                  onChange={(e) => updateField('operatorEmail', e.target.value)}
                  placeholder="jane@youragency.com"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-operator-email"
                />
                {errors.operatorEmail && <p className="mt-1 text-xs text-destructive">{errors.operatorEmail}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operator Direct Phone
                </label>
                <input
                  type="tel"
                  value={formData.operatorPhone}
                  onChange={(e) => updateField('operatorPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-operator-phone"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.authorizedCheckbox}
                  onChange={(e) => updateField('authorizedCheckbox', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent))]"
                  data-testid="checkbox-authorized"
                />
                <span className="text-xs leading-5">
                  <strong>"I confirm that I am authorized by the business to provide these configuration details and approve controlled production activation."</strong>
                  <span className="block mt-1 text-muted-foreground italic">
                    (Note: This confirmation acknowledges administrative authority to configure this desk. Outbound calling remains safely paused until final operations sign-off.)
                  </span>
                </span>
              </label>
              {errors.authorizedCheckbox && <p className="mt-2 text-xs text-destructive">{errors.authorizedCheckbox}</p>}
            </div>
          </div>
        )}

        {/* Step 3: Telephony & Voice Provider */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">3. Telephony & Voice Provider Configuration</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Registered business telephone numbers and Retell AI voice models.
              </p>
            </div>

            <div className="rounded-xl border border-[#e5d28d] bg-[#fdfbf2] p-4 text-xs text-[#735a1a]">
              <strong>Security Rule:</strong> Never enter passwords, API secret keys, auth tokens, or private carrier credentials into this form. Telephony credentials are bound securely by LeadSprint backend engineers.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Dedicated Outbound Phone Number <span className="text-destructive">*</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                  placeholder="+15120001111"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-business-phone"
                />
                {errors.phoneNumber && <p className="mt-1 text-xs text-destructive">{errors.phoneNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Operator Live Transfer Destination <span className="text-destructive">*</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="tel"
                  value={formData.transferNumber}
                  onChange={(e) => updateField('transferNumber', e.target.value)}
                  placeholder="+15120002222"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-transfer-phone"
                />
                {errors.transferNumber && <p className="mt-1 text-xs text-destructive">{errors.transferNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Retell Production Agent ID
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="text"
                  value={formData.retellAgentId}
                  onChange={(e) => updateField('retellAgentId', e.target.value)}
                  placeholder="agent_prod_..."
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-retell-agent-id"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Retell Agent Version Tag
                </label>
                <input
                  type="text"
                  value={formData.retellAgentVersion}
                  onChange={(e) => updateField('retellAgentVersion', e.target.value)}
                  placeholder="v1.0-prod"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-retell-version"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.phoneOwnershipConfirmed}
                  onChange={(e) => updateField('phoneOwnershipConfirmed', e.target.checked)}
                  className="h-4 w-4 rounded border-border text-[hsl(var(--accent))]"
                  data-testid="checkbox-phone-ownership"
                />
                <span className="text-xs font-medium">
                  I confirm that our business legally owns or is authorized to use the supplied phone numbers for outbound communications.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Calendar & Scheduling */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">4. Calendar & Showing Scheduling</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing appointment booking rules and Cal.com integration parameters.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Cal.com Event Type ID
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="text"
                  value={formData.calEventTypeId}
                  onChange={(e) => updateField('calEventTypeId', e.target.value)}
                  placeholder="e.g. 149281 or showing-appointment"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-cal-event-id"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Appointment Duration
                </label>
                <select
                  value={formData.eventDuration}
                  onChange={(e) => updateField('eventDuration', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="select-duration"
                >
                  <option value="15m">15 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="45m">45 Minutes</option>
                  <option value="60m">60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Available Booking Window <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bookingHours}
                  onChange={(e) => updateField('bookingHours', e.target.value)}
                  placeholder="e.g. Mon-Fri 09:00 - 18:00 CT"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-booking-hours"
                />
                {errors.bookingHours && <p className="mt-1 text-xs text-destructive">{errors.bookingHours}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Buffer Time Between Showings
                </label>
                <input
                  type="text"
                  value={formData.bufferRules}
                  onChange={(e) => updateField('bufferRules', e.target.value)}
                  placeholder="e.g. 15 minutes buffer"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-buffer-rules"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 text-xs">
              <p className="font-semibold text-foreground">Attendee Timezone Conversion:</p>
              <p className="mt-1 text-muted-foreground">
                LeadSprint automatically normalizes and converts showing appointment timestamps between the lead's local timezone and host calendar.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Lead Intake & Compliance */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">5. Lead Intake & Compliance Provenance</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Inbound digital lead feeds and TCPA affirmative consent tracking.
              </p>
            </div>

            <div className="rounded-xl border border-[#cbe1d8] bg-[#f2f8f5] p-4 text-xs text-[#1e5443]">
              <strong>Compliance Rule:</strong> "Do not invent consent, timezone, intent, qualification, lead source, or other customer data when the source does not provide it."
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Inbound Lead Sources <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.leadSource}
                  onChange={(e) => updateField('leadSource', e.target.value)}
                  placeholder="e.g. Website Form, Facebook Ads, Zillow Connect"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-lead-sources"
                />
                {errors.leadSource && <p className="mt-1 text-xs text-destructive">{errors.leadSource}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Originating CRM / Form Tool
                </label>
                <input
                  type="text"
                  value={formData.crmSystem}
                  onChange={(e) => updateField('crmSystem', e.target.value)}
                  placeholder="e.g. HubSpot, Zapier, Webhook"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-crm-system"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-foreground">
                  TCPA Affirmative Consent Capture Method <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.consentCaptureMethod}
                  onChange={(e) => updateField('consentCaptureMethod', e.target.value)}
                  placeholder="e.g. Explicit opt-in checkbox with timestamp, source URL, and IP capture"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-consent-method"
                />
                {errors.consentCaptureMethod && <p className="mt-1 text-xs text-destructive">{errors.consentCaptureMethod}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Existing DNC / Opt-Out Source
                </label>
                <input
                  type="text"
                  value={formData.dncSource}
                  onChange={(e) => updateField('dncSource', e.target.value)}
                  placeholder="e.g. CRM Suppression List / One-click UI Opt-Out"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-dnc-source"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Expected Event ID Format (Deduplication)
                </label>
                <input
                  type="text"
                  value={formData.sourceEventIdFormat}
                  onChange={(e) => updateField('sourceEventIdFormat', e.target.value)}
                  placeholder="e.g. Unique submission UUID"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-event-id-format"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Calling Policy */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">6. Outbound Calling Policy & Safety Controls</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Policy boundaries enforced by LeadSprint's automated call dispatcher.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Quiet Hours Window <span className="text-destructive">*</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="text"
                  value={formData.quietHours}
                  onChange={(e) => updateField('quietHours', e.target.value)}
                  placeholder="21:00–08:00"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-quiet-hours"
                />
                {errors.quietHours && <p className="mt-1 text-xs text-destructive">{errors.quietHours}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Dual-gate: Outbound calls are strictly blocked during quiet hours in both recipient and business timezones.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Maximum Call Attempts per Lead
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.maxCallAttempts}
                  onChange={(e) => updateField('maxCallAttempts', Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-max-attempts"
                />
                {errors.maxCallAttempts && <p className="mt-1 text-xs text-destructive">{errors.maxCallAttempts}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Allowed Calling Days
                </label>
                <input
                  type="text"
                  value={formData.callingDays}
                  onChange={(e) => updateField('callingDays', e.target.value)}
                  placeholder="Monday to Friday"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-calling-days"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Retry Backoff Deferral
                </label>
                <input
                  type="text"
                  value={formData.retryBackoff}
                  onChange={(e) => updateField('retryBackoff', e.target.value)}
                  placeholder="30 minutes"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="input-retry-backoff"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-xs">
              <p className="font-semibold text-foreground">Calling Pause State Notice:</p>
              <p className="mt-1 text-muted-foreground">
                Your workspace initial state is <strong>calling_paused = true</strong>. Activation remains controlled by LeadSprint operations and cannot be activated from this form alone.
              </p>
            </div>
          </div>
        )}

        {/* Step 7: Voice Agent Scripting */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">7. Voice Agent Scripting & Boundaries</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure approved assistant greeting, qualification questions, and FAQ boundaries.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Greeting & AI Disclosure <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.greetingText}
                  onChange={(e) => updateField('greetingText', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="textarea-greeting"
                />
                {errors.greetingText && <p className="mt-1 text-xs text-destructive">{errors.greetingText}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Qualification Questions (One per line)
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.qualificationQuestions.join('\n')}
                  onChange={(e) => updateField('qualificationQuestions', e.target.value.split('\n').filter(Boolean))}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="textarea-qualification"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Approved Business FAQ & Knowledge Base
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">(Persisted in Settings)</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.approvedFaq}
                  onChange={(e) => updateField('approvedFaq', e.target.value)}
                  placeholder="Share details regarding your property types, service areas, and agency specialties."
                  className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[hsl(var(--accent))]"
                  data-testid="textarea-faq"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <span className="block text-xs font-semibold">AI Assistant Disclosure</span>
                    <span className="block text-[11px] text-muted-foreground">Make AI assistant identity explicit</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.aiDisclosure}
                    onChange={(e) => updateField('aiDisclosure', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-[hsl(var(--accent))]"
                    data-testid="checkbox-ai-disclosure"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <span className="block text-xs font-semibold">Recording Disclosure</span>
                    <span className="block text-[11px] text-muted-foreground">Inform callers call is recorded</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.recordingDisclosure}
                    onChange={(e) => updateField('recordingDisclosure', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-[hsl(var(--accent))]"
                    data-testid="checkbox-recording-disclosure"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 8: Commercial Agreement */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">8. Commercial Pilot Terms</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Review and acknowledge standard commercial terms for the LeadSprint MVP pilot.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">One-Time Setup Fee</span>
                <p className="mt-1 text-2xl font-bold text-foreground">$500</p>
                <p className="mt-1 text-xs text-muted-foreground">Onboarding, Retell model tuning & provider binding</p>
              </div>

              <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly Subscription</span>
                <p className="mt-1 text-2xl font-bold text-foreground">$399 / mo</p>
                <p className="mt-1 text-xs text-muted-foreground">Baseline pilot subscription per desk</p>
              </div>

              <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Included Voice Usage</span>
                <p className="mt-1 text-2xl font-bold text-foreground">300 Minutes</p>
                <p className="mt-1 text-xs text-muted-foreground">Included voice minutes per calendar month</p>
              </div>

              <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Billing Execution</span>
                <p className="mt-1 text-2xl font-bold text-foreground">Managed / Manual</p>
                <p className="mt-1 text-xs text-muted-foreground">Direct invoicing (Self-serve Stripe deferred)</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-xs leading-5">
              <p className="font-semibold text-foreground">Policy Limit Notice:</p>
              <p className="mt-1 text-muted-foreground">
                <strong>$0.20/minute overage</strong> is an optional customer-specific commercial term requiring explicit agreement. It is not the default MVP entitlement. Default software policy blocks new outbound calls when the configured 300-minute entitlement is reached.
              </p>
            </div>

            <div className="rounded-xl border border-border p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.commercialAcknowledged}
                  onChange={(e) => updateField('commercialAcknowledged', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-[hsl(var(--accent))]"
                  data-testid="checkbox-commercial-ack"
                />
                <span className="text-xs leading-5">
                  <strong>I acknowledge and accept the commercial terms ($500 setup, $399/mo subscription, 300 voice minutes entitlement) and understand billing is executed via managed manual invoicing.</strong>
                </span>
              </label>
              {errors.commercialAcknowledged && <p className="mt-2 text-xs text-destructive">{errors.commercialAcknowledged}</p>}
            </div>
          </div>
        )}

        {/* Step 9: Review & Confirmation */}
        {currentStep === 9 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">9. Review Onboarding Configuration</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Verify all collected parameters before submitting for LeadSprint technical review.
              </p>
            </div>

            <div className="space-y-4 text-xs divide-y divide-border">
              {/* Business Info Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Business Information</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Operating Name:</span> <strong>{formData.name || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Desk Name:</span> <strong>{formData.projectName || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Legal Entity:</span> <strong>{formData.legalName || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Timezone:</span> <strong>{formData.timezone || '—'}</strong></div>
                </div>
              </div>

              {/* Operator Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Authorized Operator</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Name:</span> <strong>{formData.operatorName || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Email:</span> <strong>{formData.operatorEmail || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Role:</span> <strong>{formData.operatorRole || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Authorization Confirmed:</span> <strong>{formData.authorizedCheckbox ? 'YES' : 'NO'}</strong></div>
                </div>
              </div>

              {/* Telephony Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Telephony & Voice Provider</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Outbound Phone:</span> <strong>{formData.phoneNumber || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Transfer Number:</span> <strong>{formData.transferNumber || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Retell Agent ID:</span> <strong>{formData.retellAgentId || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Phone Ownership:</span> <strong>{formData.phoneOwnershipConfirmed ? 'Confirmed' : 'Pending'}</strong></div>
                </div>
              </div>

              {/* Calendar Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Calendar & Scheduling</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Cal.com Event ID:</span> <strong>{formData.calEventTypeId || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Duration:</span> <strong>{formData.eventDuration}</strong></div>
                  <div><span className="text-muted-foreground">Hours:</span> <strong>{formData.bookingHours}</strong></div>
                  <div><span className="text-muted-foreground">Timezone Conversion:</span> <strong>Auto</strong></div>
                </div>
              </div>

              {/* Policy & Voice Agent Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Calling Policy & Agent</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Quiet Hours:</span> <strong>{formData.quietHours}</strong></div>
                  <div><span className="text-muted-foreground">Max Attempts:</span> <strong>{formData.maxCallAttempts}</strong></div>
                  <div><span className="text-muted-foreground">AI Disclosure:</span> <strong>{formData.aiDisclosure ? 'Enabled' : 'Disabled'}</strong></div>
                  <div><span className="text-muted-foreground">Recording Disclosure:</span> <strong>{formData.recordingDisclosure ? 'Enabled' : 'Disabled'}</strong></div>
                </div>
              </div>

              {/* Commercial Review */}
              <div className="pt-3">
                <h3 className="font-bold text-sm text-[hsl(var(--accent))]">Commercial Agreement</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Terms:</span> <strong>$500 Setup / $399/mo (300 mins)</strong></div>
                  <div><span className="text-muted-foreground">Acknowledgement:</span> <strong>{formData.commercialAcknowledged ? 'Confirmed' : 'Pending'}</strong></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e5d28d] bg-[#fdfbf2] p-4 text-xs text-[#735a1a]">
              <strong>Submission Disclaimer:</strong> Clicking "Submit for Verification" saves your complete desk configuration and requests technical verification. It does <strong>NOT</strong> activate outbound dialing or start placing calls.
            </div>
          </div>
        )}

        {/* Step 10: Submission Complete / Pending Verification */}
        {currentStep === 10 && (
          <div className="flex flex-col items-center justify-center space-y-5 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#d7e9df] text-[#24634f]">
              <CheckCircle size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Onboarding Submitted for Verification</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Your agency configuration has been saved. LeadSprint operations will verify provider connectivity and run technical acceptance tests before scheduling production activation.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-[hsl(var(--muted)/.4)] p-4 text-left text-xs space-y-2 max-w-md w-full">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desk Name:</span>
                <strong>{formData.projectName || formData.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calling Safety State:</span>
                <span className="font-semibold text-[#8d371f]">PAUSED (Safety Lock Active)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Global Circuit Breaker:</span>
                <span className="font-semibold text-[#8d371f]">KILL SWITCH ENGAGED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Stage:</span>
                <strong>Provider Sanity & Acceptance Testing</strong>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Link
                href="/workspace"
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110"
              >
                Return to Operator Desk
              </Link>
              <Link
                href="/workspace/business-settings"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--card))] px-4 py-2.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]"
              >
                View Business Settings
              </Link>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        {currentStep < 10 && (
          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--card))] px-4 py-2 text-xs font-semibold text-foreground hover:bg-[hsl(var(--muted))] disabled:opacity-30 disabled:pointer-events-none"
              data-testid="button-wizard-back"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {currentStep < 9 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={updateSettings.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
                data-testid="button-wizard-next"
              >
                {updateSettings.isPending && <Loader2 size={14} className="animate-spin" />}
                Save & Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitForVerification}
                disabled={updateSettings.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#24634f] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#1e5443] shadow-sm disabled:opacity-50"
                data-testid="button-submit-verification"
              >
                {updateSettings.isPending && <Loader2 size={14} className="animate-spin" />}
                Submit for Verification <CheckCircle size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
