import { Form, Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    BarChart3,
    CalendarClock,
    Check,
    Clock3,
    FileSpreadsheet,
    Inbox,
    Mail,
    MailCheck,
    MessageSquareReply,
    Pause,
    Play,
    Plus,
    Search,
    Send,
    Settings,
    ShieldCheck,
    Sparkles,
    Upload,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { ReactNode } from 'react';

import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Section =
    'dashboard' | 'campaigns' | 'campaign' | 'leads' | 'inbox' | 'settings';

type Stats = {
    leads: number;
    active_campaigns: number;
    scheduled_today: number;
    sent_today: number;
    replies: number;
    interested: number;
    bounces: number;
};

type EmailAccount = {
    id: number;
    email: string;
    provider: string;
    status: string;
    daily_limit: number;
    timezone: string;
    sending_start: string;
    sending_end: string;
    last_error: string | null;
    token_expires_at: string | null;
};

type Lead = {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    job_title: string | null;
    city: string | null;
    industry: string | null;
    custom_1: string | null;
    status: string;
    status_label: string;
    last_contacted_at: string | null;
    created_at: string | null;
};

type Campaign = {
    id: number;
    name: string;
    status: string;
    daily_limit: number;
    created_at: string;
    contacts_count: number;
    replied_count: number;
    interested_count: number;
    bounced_count: number;
    sent_count: number;
    email_account: Pick<EmailAccount, 'id' | 'email' | 'status'> | null;
};

type CampaignStep = {
    id?: number;
    position: number;
    delay_days: number;
    subject: string;
    body: string;
};

type SelectedCampaign = {
    id: number;
    name: string;
    status: string;
    email_account_id: number;
    daily_limit: number;
    timezone: string;
    sending_start: string;
    sending_end: string;
    contacts_count: number;
    active_count: number;
    replied_count: number;
    bounced_count: number;
    sent_count: number;
    sent_today_count: number;
    steps: CampaignStep[];
};

type InboxMessage = {
    id: number;
    subject: string | null;
    body: string | null;
    status: string;
    received_at: string | null;
    lead: Pick<
        Lead,
        'id' | 'email' | 'first_name' | 'last_name' | 'company' | 'status'
    > | null;
    campaign: Pick<Campaign, 'id' | 'name'> | null;
};

type PageProps = {
    active_section: Section;
    lead_statuses: Record<string, string>;
    stats: Stats;
    campaigns: Campaign[];
    leads: Lead[];
    email_accounts: EmailAccount[];
    inbox: InboxMessage[];
    selected_campaign: SelectedCampaign | null;
    mailgun_configured: boolean;
    mailgun_domain: string | null;
    mailgun_inbound_domain: string | null;
};

const navItems = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        href: '/platform/email-campaigns',
        icon: BarChart3,
    },
    {
        key: 'campaigns',
        label: 'Campaigns',
        href: '/platform/email-campaigns/campaigns',
        icon: Send,
    },
    {
        key: 'leads',
        label: 'Leads',
        href: '/platform/email-campaigns/leads',
        icon: Users,
    },
    {
        key: 'inbox',
        label: 'Inbox',
        href: '/platform/email-campaigns/inbox',
        icon: Inbox,
    },
    {
        key: 'settings',
        label: 'Settings',
        href: '/platform/email-campaigns/settings',
        icon: Settings,
    },
] as const;

const variables = [
    'first_name',
    'company',
    'job_title',
    'city',
    'industry',
    'custom_1',
];
const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'UTC',
];

function formatDate(
    value: string | null | undefined,
    includeTime = false,
): string {
    if (!value) {
        return 'Never';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    }).format(new Date(value));
}

function displayName(
    lead: Pick<Lead, 'first_name' | 'last_name' | 'email'>,
): string {
    return (
        [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
        lead.email
    );
}

function statusStyle(status: string): string {
    if (
        ['active', 'interested', 'meeting_booked', 'connected'].includes(status)
    ) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200';
    }

    if (['replied', 'completed'].includes(status)) {
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200';
    }

    if (
        ['bounced', 'not_interested', 'unsubscribed', 'failed'].includes(status)
    ) {
        return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200';
    }

    if (['paused', 'follow_up_later'].includes(status)) {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
    }

    return 'border-border bg-muted/50 text-muted-foreground';
}

function MetricCard({
    label,
    value,
    icon: Icon,
    detail,
}: {
    label: string;
    value: number;
    icon: typeof Users;
    detail: string;
}) {
    return (
        <Card className="gap-3 py-5 shadow-none">
            <CardContent className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight">
                        {value.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {detail}
                    </p>
                </div>
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <Icon className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}

function WorkspaceHeader({ stats }: { stats: Stats }) {
    return (
        <section className="overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_38%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)))] p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        <Sparkles className="size-4" /> Eigen outbound
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Email campaigns
                    </h1>
                    <p className="text-muted-foreground">
                        Turn a lead list into a thoughtful outreach sequence.
                        Follow-ups stop automatically when a reply is detected.
                    </p>
                </div>
                <div className="flex gap-3 rounded-xl border bg-background/80 px-4 py-3 backdrop-blur">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            Sent today
                        </p>
                        <p className="text-xl font-semibold">
                            {stats.sent_today}
                        </p>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                        <p className="text-xs text-muted-foreground">Replies</p>
                        <p className="text-xl font-semibold">{stats.replies}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function WorkspaceNav({ active }: { active: Section }) {
    const normalized = active === 'campaign' ? 'campaigns' : active;

    return (
        <nav
            className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1"
            aria-label="Email campaign sections"
        >
            {navItems.map(({ key, label, href, icon: Icon }) => (
                <Link
                    key={key}
                    href={href}
                    className={cn(
                        'flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
                        normalized === key
                            ? 'bg-foreground text-background shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                >
                    <Icon className="size-4" /> {label}
                </Link>
            ))}
        </nav>
    );
}

function CampaignStatus({ value }: { value: string }) {
    return (
        <Badge
            variant="outline"
            className={cn('capitalize', statusStyle(value))}
        >
            {value.replaceAll('_', ' ')}
        </Badge>
    );
}

function DashboardSection({
    stats,
    campaigns,
    mailgunConnected,
}: {
    stats: Stats;
    campaigns: Campaign[];
    mailgunConnected: boolean;
}) {
    const workflow = [
        ['Upload CSV', FileSpreadsheet],
        ['Choose leads', Users],
        ['Write sequence', Mail],
        ['Set limits', CalendarClock],
        ['Start campaign', Play],
    ] as const;

    return (
        <div className="space-y-6">
            {!mailgunConnected && (
                <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <ShieldCheck />
                    <AlertTitle>Add a Mailgun sender before sending</AlertTitle>
                    <AlertDescription>
                        Campaigns can be drafted now, but sending and automatic
                        reply detection require Mailgun configuration and an
                        approved sender address.
                        <Button variant="link" className="h-auto p-0" asChild>
                            <Link href="/platform/email-campaigns/settings">
                                Open settings
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Leads"
                    value={stats.leads}
                    icon={Users}
                    detail="Available for outreach"
                />
                <MetricCard
                    label="Active campaigns"
                    value={stats.active_campaigns}
                    icon={Activity}
                    detail="Sending automatically"
                />
                <MetricCard
                    label="Scheduled today"
                    value={stats.scheduled_today}
                    icon={Clock3}
                    detail="Waiting in the sequence"
                />
                <MetricCard
                    label="Interested"
                    value={stats.interested}
                    icon={MailCheck}
                    detail="Qualified responses"
                />
            </div>

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>From spreadsheet to conversation</CardTitle>
                    <CardDescription>
                        The shortest path to launching the next Eigen prospect
                        list.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-5">
                    {workflow.map(([label, Icon], index) => (
                        <div
                            key={label}
                            className="relative rounded-xl border bg-muted/20 p-4"
                        >
                            <div className="mb-7 flex items-center justify-between">
                                <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                    <Icon className="size-4" />
                                </div>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    0{index + 1}
                                </span>
                            </div>
                            <p className="text-sm font-semibold">{label}</p>
                            {index < workflow.length - 1 && (
                                <ArrowRight className="absolute top-1/2 -right-5 z-10 hidden size-4 text-muted-foreground md:block" />
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <Card className="shadow-none">
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent campaigns</CardTitle>
                            <CardDescription>
                                Current sending health at a glance.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/platform/email-campaigns/campaigns">
                                View all
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {campaigns.slice(0, 5).map((campaign) => (
                            <Link
                                key={campaign.id}
                                href={`/platform/email-campaigns/campaigns/${campaign.id}`}
                                className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/40"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {campaign.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {campaign.contacts_count} leads ·{' '}
                                        {campaign.sent_count} sent
                                    </p>
                                </div>
                                <CampaignStatus value={campaign.status} />
                            </Link>
                        ))}
                        {campaigns.length === 0 && (
                            <EmptyState
                                icon={Send}
                                title="No campaigns yet"
                                text="Import leads, then build your first outreach sequence."
                            />
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Today</CardTitle>
                        <CardDescription>
                            Only real sending activity is shown.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <SummaryRow
                            label="Scheduled"
                            value={stats.scheduled_today}
                        />
                        <SummaryRow label="Sent" value={stats.sent_today} />
                        <SummaryRow label="Replies" value={stats.replies} />
                        <SummaryRow
                            label="Bounces"
                            value={stats.bounces}
                            danger={stats.bounces > 0}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function SummaryRow({
    label,
    value,
    danger = false,
}: {
    label: string;
    value: number;
    danger?: boolean;
}) {
    return (
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className={cn('font-semibold', danger && 'text-rose-600')}>
                {value}
            </span>
        </div>
    );
}

function EmptyState({
    icon: Icon,
    title,
    text,
}: {
    icon: typeof Send;
    title: string;
    text: string;
}) {
    return (
        <div className="rounded-xl border border-dashed p-10 text-center">
            <Icon className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

function CampaignsSection({
    campaigns,
    accounts,
    leads,
}: {
    campaigns: Campaign[];
    accounts: EmailAccount[];
    leads: Lead[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
    const connectedAccounts = accounts.filter(
        (account) => account.status === 'connected',
    );
    const contactableLeads = leads.filter(
        (lead) =>
            !['bounced', 'unsubscribed', 'not_interested'].includes(
                lead.status,
            ),
    );

    return (
        <>
            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Campaigns
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Draft, launch, and monitor every outreach sequence.
                        </p>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        disabled={
                            connectedAccounts.length === 0 ||
                            contactableLeads.length === 0
                        }
                    >
                        <Plus /> Create campaign
                    </Button>
                </div>
                {(connectedAccounts.length === 0 ||
                    contactableLeads.length === 0) && (
                    <Alert>
                        <Activity />
                        <AlertTitle>Complete setup first</AlertTitle>
                        <AlertDescription>
                            {connectedAccounts.length === 0
                                ? 'Add a Mailgun sender in Settings. '
                                : ''}
                            {contactableLeads.length === 0
                                ? 'Import or add at least one contactable lead.'
                                : ''}
                        </AlertDescription>
                    </Alert>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                    {campaigns.map((campaign) => (
                        <Card
                            key={campaign.id}
                            className="gap-4 shadow-none transition-shadow hover:shadow-md"
                        >
                            <CardHeader className="flex-row items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <CardTitle className="truncate text-lg">
                                        {campaign.name}
                                    </CardTitle>
                                    <CardDescription>
                                        {campaign.email_account?.email ??
                                            'No sender'}{' '}
                                        · {campaign.daily_limit}/day
                                    </CardDescription>
                                </div>
                                <CampaignStatus value={campaign.status} />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-4 gap-2">
                                    <MiniStat
                                        label="Leads"
                                        value={campaign.contacts_count}
                                    />
                                    <MiniStat
                                        label="Sent"
                                        value={campaign.sent_count}
                                    />
                                    <MiniStat
                                        label="Replies"
                                        value={campaign.replied_count}
                                    />
                                    <MiniStat
                                        label="Interested"
                                        value={campaign.interested_count}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    asChild
                                >
                                    <Link
                                        href={`/platform/email-campaigns/campaigns/${campaign.id}`}
                                    >
                                        Open campaign <ArrowRight />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                {campaigns.length === 0 && (
                    <EmptyState
                        icon={Send}
                        title="Build your first campaign"
                        text="Choose a sender, select leads, and write the first email in one step."
                    />
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Create campaign</DialogTitle>
                        <DialogDescription>
                            Start with the initial email. Follow-ups can be
                            added on the next screen.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action="/platform/email-campaigns/campaigns"
                        method="post"
                        className="space-y-5"
                        onSuccess={() => setCreateOpen(false)}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Campaign name"
                                        error={errors.name}
                                    >
                                        <Input
                                            name="name"
                                            required
                                            autoFocus
                                            placeholder="Field service companies"
                                        />
                                    </Field>
                                    <Field
                                        label="Sending account"
                                        error={errors.email_account_id}
                                    >
                                        <select
                                            name="email_account_id"
                                            required
                                            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                                        >
                                            {connectedAccounts.map(
                                                (account) => (
                                                    <option
                                                        key={account.id}
                                                        value={account.id}
                                                    >
                                                        {account.email}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </Field>
                                </div>
                                <Field
                                    label="Daily sending limit"
                                    error={errors.daily_limit}
                                >
                                    <Input
                                        name="daily_limit"
                                        type="number"
                                        min="1"
                                        max="500"
                                        defaultValue="25"
                                    />
                                </Field>
                                <div className="rounded-xl border p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">
                                                Choose leads
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {selectedLeads.length} selected
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setSelectedLeads(
                                                    selectedLeads.length ===
                                                        contactableLeads.length
                                                        ? []
                                                        : contactableLeads.map(
                                                              (lead) => lead.id,
                                                          ),
                                                )
                                            }
                                        >
                                            {selectedLeads.length ===
                                            contactableLeads.length
                                                ? 'Clear all'
                                                : 'Select all'}
                                        </Button>
                                    </div>
                                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                        {contactableLeads.map((lead) => (
                                            <label
                                                key={lead.id}
                                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted"
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="lead_ids[]"
                                                    value={lead.id}
                                                    checked={selectedLeads.includes(
                                                        lead.id,
                                                    )}
                                                    onChange={() =>
                                                        setSelectedLeads(
                                                            (current) =>
                                                                current.includes(
                                                                    lead.id,
                                                                )
                                                                    ? current.filter(
                                                                          (
                                                                              id,
                                                                          ) =>
                                                                              id !==
                                                                              lead.id,
                                                                      )
                                                                    : [
                                                                          ...current,
                                                                          lead.id,
                                                                      ],
                                                        )
                                                    }
                                                    className="size-4 accent-emerald-600"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">
                                                        {displayName(lead)}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {lead.company ||
                                                            lead.email}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <InputError message={errors.lead_ids} />
                                </div>
                                <Field
                                    label="Email 1 subject"
                                    error={errors.subject}
                                >
                                    <Input
                                        name="subject"
                                        required
                                        placeholder="Quick question"
                                    />
                                </Field>
                                <Field
                                    label="Email 1 message"
                                    error={errors.body}
                                >
                                    <textarea
                                        name="body"
                                        required
                                        rows={9}
                                        className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                        placeholder={
                                            'Hi {{first_name}},\n\nHow are you currently handling training for your field employees?'
                                        }
                                    />
                                </Field>
                                <VariableChips />
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCreateOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={
                                            processing ||
                                            selectedLeads.length === 0
                                        }
                                    >
                                        {processing && <Spinner />} Create and
                                        edit sequence
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    );
}

function VariableChips() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
                Personalize with
            </span>
            {variables.map((variable) => (
                <button
                    key={variable}
                    type="button"
                    onClick={() =>
                        navigator.clipboard?.writeText(`{{${variable}}}`)
                    }
                    className="rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs hover:bg-muted"
                    title="Copy variable"
                >{`{{${variable}}}`}</button>
            ))}
        </div>
    );
}

function CampaignEditor({
    campaign,
    accounts,
}: {
    campaign: SelectedCampaign;
    accounts: EmailAccount[];
}) {
    const [steps, setSteps] = useState<CampaignStep[]>(campaign.steps);
    const editingLocked = campaign.status === 'active';

    const updateStep = (
        index: number,
        field: keyof CampaignStep,
        value: string | number,
    ) =>
        setSteps((current) =>
            current.map((step, stepIndex) =>
                stepIndex === index ? { ...step, [field]: value } : step,
            ),
        );
    const removeStep = (index: number) =>
        setSteps((current) =>
            current
                .filter((_, stepIndex) => stepIndex !== index)
                .map((step, stepIndex) => ({
                    ...step,
                    position: stepIndex + 1,
                })),
        );
    const addStep = () =>
        setSteps((current) => [
            ...current,
            {
                position: current.length + 1,
                delay_days: current.length === 1 ? 3 : 4,
                subject: current[0]?.subject
                    ? `Re: ${current[0].subject.replace(/^Re:\s*/i, '')}`
                    : '',
                body: '',
            },
        ]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <CampaignStatus value={campaign.status} />
                        <span className="text-xs text-muted-foreground">
                            Campaign #{campaign.id}
                        </span>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {campaign.name}
                    </h2>
                </div>
                <div className="flex gap-2">
                    {campaign.status === 'active' ? (
                        <Button
                            variant="outline"
                            onClick={() =>
                                router.post(
                                    `/platform/email-campaigns/campaigns/${campaign.id}/pause`,
                                )
                            }
                        >
                            <Pause /> Pause campaign
                        </Button>
                    ) : campaign.status === 'completed' ? (
                        <Button variant="outline" disabled>
                            <Check /> Campaign complete
                        </Button>
                    ) : (
                        <Button
                            onClick={() =>
                                router.post(
                                    `/platform/email-campaigns/campaigns/${campaign.id}/start`,
                                )
                            }
                        >
                            <Play /> Start campaign
                        </Button>
                    )}
                </div>
            </div>
            {editingLocked && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
                    <Activity />
                    <AlertTitle>This campaign is live</AlertTitle>
                    <AlertDescription>
                        Pause it before changing the sequence or sending
                        settings. Reply detection remains active while paused.
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <MiniStat label="Leads" value={campaign.contacts_count} />
                <MiniStat label="Active" value={campaign.active_count} />
                <MiniStat
                    label="Sent today"
                    value={campaign.sent_today_count}
                />
                <MiniStat label="Total sent" value={campaign.sent_count} />
                <MiniStat label="Replies" value={campaign.replied_count} />
                <MiniStat label="Bounces" value={campaign.bounced_count} />
            </div>
            <Form
                action={`/platform/email-campaigns/campaigns/${campaign.id}`}
                method="put"
                className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="space-y-4">
                            {steps.map((step, index) => (
                                <Card
                                    key={`${step.id ?? 'new'}-${index}`}
                                    className="gap-4 shadow-none"
                                >
                                    <CardHeader className="flex-row items-start justify-between gap-4">
                                        <div className="flex gap-3">
                                            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-700">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <CardTitle>
                                                    {index === 0
                                                        ? 'Initial email'
                                                        : `Follow-up #${index}`}
                                                </CardTitle>
                                                <CardDescription>
                                                    {index === 0
                                                        ? 'Sent when the campaign starts.'
                                                        : `Sent ${step.delay_days} days after the previous email if there is no reply.`}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {index > 0 && !editingLocked && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove follow-up ${index}`}
                                                onClick={() =>
                                                    removeStep(index)
                                                }
                                            >
                                                <X />
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <input
                                            type="hidden"
                                            name={`steps[${index}][position]`}
                                            value={index + 1}
                                        />
                                        {index > 0 && (
                                            <Field label="Wait after previous email">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        name={`steps[${index}][delay_days]`}
                                                        type="number"
                                                        min="1"
                                                        max="365"
                                                        value={step.delay_days}
                                                        disabled={editingLocked}
                                                        onChange={(event) =>
                                                            updateStep(
                                                                index,
                                                                'delay_days',
                                                                Number(
                                                                    event.target
                                                                        .value,
                                                                ),
                                                            )
                                                        }
                                                        className="w-24"
                                                    />
                                                    <span className="text-sm text-muted-foreground">
                                                        days
                                                    </span>
                                                </div>
                                            </Field>
                                        )}
                                        {index === 0 && (
                                            <input
                                                type="hidden"
                                                name="steps[0][delay_days]"
                                                value="0"
                                            />
                                        )}
                                        <Field
                                            label="Subject"
                                            error={
                                                errors[`steps.${index}.subject`]
                                            }
                                        >
                                            <Input
                                                name={`steps[${index}][subject]`}
                                                value={step.subject}
                                                disabled={editingLocked}
                                                onChange={(event) =>
                                                    updateStep(
                                                        index,
                                                        'subject',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label="Message"
                                            error={
                                                errors[`steps.${index}.body`]
                                            }
                                        >
                                            <textarea
                                                name={`steps[${index}][body]`}
                                                value={step.body}
                                                disabled={editingLocked}
                                                onChange={(event) =>
                                                    updateStep(
                                                        index,
                                                        'body',
                                                        event.target.value,
                                                    )
                                                }
                                                rows={10}
                                                className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                                            />
                                        </Field>
                                        <VariableChips />
                                    </CardContent>
                                </Card>
                            ))}
                            {!editingLocked && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-dashed"
                                    onClick={addStep}
                                >
                                    <Plus /> Add follow-up
                                </Button>
                            )}
                        </div>
                        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                            <Card className="gap-4 shadow-none">
                                <CardHeader>
                                    <CardTitle>Campaign settings</CardTitle>
                                    <CardDescription>
                                        Protect deliverability with a deliberate
                                        pace.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Field
                                        label="Campaign name"
                                        error={errors.name}
                                    >
                                        <Input
                                            name="name"
                                            defaultValue={campaign.name}
                                            disabled={editingLocked}
                                        />
                                    </Field>
                                    <Field
                                        label="Sending account"
                                        error={errors.email_account_id}
                                    >
                                        <select
                                            name="email_account_id"
                                            defaultValue={
                                                campaign.email_account_id
                                            }
                                            disabled={editingLocked}
                                            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                                        >
                                            {accounts
                                                .filter(
                                                    (account) =>
                                                        account.status ===
                                                        'connected',
                                                )
                                                .map((account) => (
                                                    <option
                                                        key={account.id}
                                                        value={account.id}
                                                    >
                                                        {account.email}
                                                    </option>
                                                ))}
                                        </select>
                                    </Field>
                                    <Field
                                        label="Daily limit"
                                        error={errors.daily_limit}
                                    >
                                        <Input
                                            name="daily_limit"
                                            type="number"
                                            min="1"
                                            max="500"
                                            defaultValue={campaign.daily_limit}
                                            disabled={editingLocked}
                                        />
                                    </Field>
                                    <Field
                                        label="Timezone"
                                        error={errors.timezone}
                                    >
                                        <select
                                            name="timezone"
                                            defaultValue={campaign.timezone}
                                            disabled={editingLocked}
                                            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                                        >
                                            {timezones.map((timezone) => (
                                                <option
                                                    key={timezone}
                                                    value={timezone}
                                                >
                                                    {timezone}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field
                                            label="Start"
                                            error={errors.sending_start}
                                        >
                                            <Input
                                                name="sending_start"
                                                type="time"
                                                defaultValue={campaign.sending_start.slice(
                                                    0,
                                                    5,
                                                )}
                                                disabled={editingLocked}
                                            />
                                        </Field>
                                        <Field
                                            label="End"
                                            error={errors.sending_end}
                                        >
                                            <Input
                                                name="sending_end"
                                                type="time"
                                                defaultValue={campaign.sending_end.slice(
                                                    0,
                                                    5,
                                                )}
                                                disabled={editingLocked}
                                            />
                                        </Field>
                                    </div>
                                    {!editingLocked && (
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />} Save
                                            sequence
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                            <Alert>
                                <MessageSquareReply />
                                <AlertTitle>Replies stop follow-ups</AlertTitle>
                                <AlertDescription>
                                    Mailgun forwards replies to Eigen as they
                                    arrive. A verified reply immediately marks
                                    the lead as Replied and stops this sequence.
                                </AlertDescription>
                            </Alert>
                        </aside>
                    </>
                )}
            </Form>
        </div>
    );
}

function LeadsSection({
    leads,
    statuses,
}: {
    leads: Lead[];
    statuses: Record<string, string>;
}) {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.toLowerCase());
    const [status, setStatus] = useState('all');
    const [addOpen, setAddOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const filtered = leads.filter(
        (lead) =>
            (status === 'all' || lead.status === status) &&
            [lead.email, lead.first_name, lead.last_name, lead.company].some(
                (value) => value?.toLowerCase().includes(deferredQuery),
            ),
    );

    return (
        <>
            <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Leads
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            A lightweight prospect list with clear outreach
                            status.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setImportOpen(true)}
                        >
                            <Upload /> Import CSV
                        </Button>
                        <Button onClick={() => setAddOpen(true)}>
                            <UserPlus /> Add lead
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search name, email, or company"
                            className="pl-9"
                        />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full sm:w-52">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            {Object.entries(statuses).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Card className="gap-0 overflow-hidden py-0 shadow-none">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left text-sm">
                            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-5 py-3 font-medium">
                                        Lead
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Company
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Job title
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Last contacted
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className="hover:bg-muted/20"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="font-medium">
                                                {displayName(lead)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {lead.email}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            {lead.company || '—'}
                                        </td>
                                        <td className="px-5 py-4 text-muted-foreground">
                                            {lead.job_title || '—'}
                                        </td>
                                        <td className="px-5 py-4 text-muted-foreground">
                                            {formatDate(lead.last_contacted_at)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <Select
                                                value={lead.status}
                                                onValueChange={(value) =>
                                                    router.patch(
                                                        `/platform/email-campaigns/leads/${lead.id}`,
                                                        { status: value },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    className={cn(
                                                        'w-44',
                                                        statusStyle(
                                                            lead.status,
                                                        ),
                                                    )}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(
                                                        statuses,
                                                    ).map(([value, label]) => (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="p-6">
                            <EmptyState
                                icon={Users}
                                title="No matching leads"
                                text="Adjust the filters or add a new prospect."
                            />
                        </div>
                    )}
                </Card>
            </div>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import leads</DialogTitle>
                        <DialogDescription>
                            Upload a CSV and map fields automatically from the
                            header names.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action="/platform/email-campaigns/leads/import"
                        method="post"
                        onSuccess={() => setImportOpen(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                                    <FileSpreadsheet className="mx-auto mb-3 size-8 text-emerald-700" />
                                    <Label
                                        htmlFor="lead-csv"
                                        className="cursor-pointer font-semibold"
                                    >
                                        Choose a CSV file
                                    </Label>
                                    <Input
                                        id="lead-csv"
                                        name="csv"
                                        type="file"
                                        required
                                        accept=".csv,text/csv"
                                        className="mt-3"
                                    />
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Recognized: First Name, Last Name,
                                        Email, Company, Job Title, City,
                                        Industry, Custom 1
                                    </p>
                                    <InputError message={errors.csv} />
                                </div>
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0"
                                    asChild
                                >
                                    <a href="/platform/email-campaigns/leads/template">
                                        Download the CSV template
                                    </a>
                                </Button>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setImportOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button disabled={processing}>
                                        {processing && <Spinner />} Import leads
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add lead</DialogTitle>
                        <DialogDescription>
                            Add one prospect now. You can enrich the optional
                            fields later.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action="/platform/email-campaigns/leads"
                        method="post"
                        className="space-y-4"
                        onSuccess={() => setAddOpen(false)}
                        resetOnSuccess
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="First name"
                                        error={errors.first_name}
                                    >
                                        <Input name="first_name" autoFocus />
                                    </Field>
                                    <Field
                                        label="Last name"
                                        error={errors.last_name}
                                    >
                                        <Input name="last_name" />
                                    </Field>
                                    <Field label="Email" error={errors.email}>
                                        <Input
                                            name="email"
                                            type="email"
                                            required
                                        />
                                    </Field>
                                    <Field
                                        label="Company"
                                        error={errors.company}
                                    >
                                        <Input name="company" />
                                    </Field>
                                    <Field
                                        label="Job title"
                                        error={errors.job_title}
                                    >
                                        <Input name="job_title" />
                                    </Field>
                                    <Field label="City" error={errors.city}>
                                        <Input name="city" />
                                    </Field>
                                    <Field
                                        label="Industry"
                                        error={errors.industry}
                                    >
                                        <Input name="industry" />
                                    </Field>
                                    <Field
                                        label="Custom personalization"
                                        error={errors.custom_1}
                                    >
                                        <Input
                                            name="custom_1"
                                            placeholder="75 field technicians"
                                        />
                                    </Field>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setAddOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button disabled={processing}>
                                        {processing && <Spinner />} Add lead
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function InboxSection({
    messages,
    statuses,
}: {
    messages: InboxMessage[];
    statuses: Record<string, string>;
}) {
    const [selectedId, setSelectedId] = useState<number | null>(
        messages[0]?.id ?? null,
    );
    const selected =
        messages.find((message) => message.id === selectedId) ?? messages[0];

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Inbox
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Replies received through the verified Mailgun route.
                    </p>
                </div>
                <Badge variant="outline" className="gap-2">
                    <Activity className="size-3" /> Live webhook
                </Badge>
            </div>
            {messages.length > 0 ? (
                <div className="grid min-h-[560px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[360px_1fr]">
                    <div className="border-b lg:border-r lg:border-b-0">
                        {messages.map((message) => (
                            <button
                                key={message.id}
                                type="button"
                                onClick={() => setSelectedId(message.id)}
                                className={cn(
                                    'w-full border-b p-4 text-left hover:bg-muted/40',
                                    selected?.id === message.id && 'bg-muted',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="truncate font-medium">
                                        {message.lead
                                            ? displayName(message.lead)
                                            : 'Unknown sender'}
                                    </p>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                        {formatDate(message.received_at)}
                                    </span>
                                </div>
                                <p className="mt-1 truncate text-sm">
                                    {message.subject || '(No subject)'}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {message.body}
                                </p>
                            </button>
                        ))}
                    </div>
                    {selected && (
                        <div className="p-5 sm:p-7">
                            <div className="border-b pb-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="text-xl font-semibold">
                                            {selected.subject || '(No subject)'}
                                        </h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            From{' '}
                                            {selected.lead?.email ?? 'unknown'}{' '}
                                            ·{' '}
                                            {formatDate(
                                                selected.received_at,
                                                true,
                                            )}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Campaign:{' '}
                                            {selected.campaign?.name ??
                                                'Unknown'}
                                        </p>
                                    </div>
                                    {selected.lead && (
                                        <Select
                                            value={selected.lead.status}
                                            onValueChange={(value) =>
                                                router.patch(
                                                    `/platform/email-campaigns/leads/${selected.lead!.id}`,
                                                    { status: value },
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-44">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(statuses).map(
                                                    ([value, label]) => (
                                                        <SelectItem
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 text-sm leading-7 whitespace-pre-wrap">
                                {selected.body ||
                                    'No message body was available.'}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <EmptyState
                    icon={Inbox}
                    title="No replies yet"
                    text="When a lead replies, their sequence stops and their message appears here."
                />
            )}
        </div>
    );
}

function SettingsSection({
    accounts,
    configured,
    domain,
    inboundDomain,
}: {
    accounts: EmailAccount[];
    configured: boolean;
    domain: string | null;
    inboundDomain: string | null;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                    Sending settings
                </h2>
                <p className="text-sm text-muted-foreground">
                    Manage Mailgun sender identities, sending hours, and volume.
                </p>
            </div>
            {!configured && (
                <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <ShieldCheck />
                    <AlertTitle>Mailgun configuration is required</AlertTitle>
                    <AlertDescription>
                        Add <code>MAILGUN_DOMAIN</code>,{' '}
                        <code>MAILGUN_SECRET</code>,{' '}
                        <code>MAILGUN_WEBHOOK_SIGNING_KEY</code>, and{' '}
                        <code>MAILGUN_INBOUND_DOMAIN</code> to the environment,
                        then clear the configuration cache.
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-4">
                    {accounts.map((account) => (
                        <Card key={account.id} className="shadow-none">
                            <CardHeader className="flex-row items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mail className="size-5" />{' '}
                                        {account.email}
                                    </CardTitle>
                                    <CardDescription>
                                        Mailgun sender · Replies routed by
                                        webhook
                                    </CardDescription>
                                </div>
                                <CampaignStatus value={account.status} />
                            </CardHeader>
                            <CardContent>
                                <Form
                                    action={`/platform/email-campaigns/settings/accounts/${account.id}`}
                                    method="patch"
                                    className="space-y-4"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <Field
                                                    label="Daily account limit"
                                                    error={errors.daily_limit}
                                                >
                                                    <Input
                                                        name="daily_limit"
                                                        type="number"
                                                        min="1"
                                                        max="500"
                                                        defaultValue={
                                                            account.daily_limit
                                                        }
                                                    />
                                                </Field>
                                                <Field
                                                    label="Timezone"
                                                    error={errors.timezone}
                                                >
                                                    <select
                                                        name="timezone"
                                                        defaultValue={
                                                            account.timezone
                                                        }
                                                        className="h-9 rounded-md border bg-transparent px-3 text-sm"
                                                    >
                                                        {timezones.map(
                                                            (timezone) => (
                                                                <option
                                                                    key={
                                                                        timezone
                                                                    }
                                                                    value={
                                                                        timezone
                                                                    }
                                                                >
                                                                    {timezone}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </Field>
                                                <Field
                                                    label="Sending starts"
                                                    error={errors.sending_start}
                                                >
                                                    <Input
                                                        name="sending_start"
                                                        type="time"
                                                        defaultValue={account.sending_start.slice(
                                                            0,
                                                            5,
                                                        )}
                                                    />
                                                </Field>
                                                <Field
                                                    label="Sending ends"
                                                    error={errors.sending_end}
                                                >
                                                    <Input
                                                        name="sending_end"
                                                        type="time"
                                                        defaultValue={account.sending_end.slice(
                                                            0,
                                                            5,
                                                        )}
                                                    />
                                                </Field>
                                            </div>
                                            {account.last_error && (
                                                <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                                                    {account.last_error}
                                                </p>
                                            )}
                                            <div className="flex justify-between">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() =>
                                                        router.delete(
                                                            `/platform/email-campaigns/settings/accounts/${account.id}`,
                                                        )
                                                    }
                                                >
                                                    Remove sender
                                                </Button>
                                                <Button disabled={processing}>
                                                    {processing && <Spinner />}{' '}
                                                    Save settings
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </CardContent>
                        </Card>
                    ))}
                    {accounts.length === 0 && (
                        <EmptyState
                            icon={Mail}
                            title="No Mailgun sender added"
                            text="Add an address from your verified Mailgun sending domain."
                        />
                    )}
                </div>
                <Card className="h-fit shadow-none">
                    <CardHeader>
                        <CardTitle>Add Mailgun sender</CardTitle>
                        <CardDescription>
                            The API key remains in the environment. Only the
                            approved From address is stored here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3 text-sm">
                            <div className="flex gap-3">
                                <Check className="mt-0.5 size-4 text-emerald-600" />
                                <span>
                                    Send through your verified Mailgun domain
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <Check className="mt-0.5 size-4 text-emerald-600" />
                                <span>
                                    Stop follow-ups through inbound routing
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <Check className="mt-0.5 size-4 text-emerald-600" />
                                <span>
                                    Respect daily limits and sending hours
                                </span>
                            </div>
                        </div>
                        <Form
                            action="/platform/email-campaigns/settings/accounts"
                            method="post"
                            className="space-y-3"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <Field
                                        label="Sender email"
                                        error={errors.email}
                                    >
                                        <Input
                                            name="email"
                                            type="email"
                                            required
                                            disabled={!configured}
                                            placeholder="outreach@mg.eigenlearning.com"
                                        />
                                    </Field>
                                    <Field
                                        label="Daily sending limit"
                                        error={errors.daily_limit}
                                    >
                                        <Input
                                            name="daily_limit"
                                            type="number"
                                            min="1"
                                            max="500"
                                            defaultValue="25"
                                            disabled={!configured}
                                        />
                                    </Field>
                                    <Button
                                        className="w-full"
                                        disabled={!configured || processing}
                                    >
                                        {processing ? (
                                            <Spinner />
                                        ) : (
                                            <MailCheck />
                                        )}
                                        {configured
                                            ? 'Add sender'
                                            : 'Configure Mailgun first'}
                                    </Button>
                                </>
                            )}
                        </Form>
                        <div className="space-y-3 border-t pt-4 text-xs">
                            <p className="font-semibold">Mailgun setup</p>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                    Sending domain
                                </p>
                                <code className="mt-1 block break-all">
                                    {domain || 'Not configured'}
                                </code>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-muted-foreground">
                                    Inbound domain
                                </p>
                                <code className="mt-1 block break-all">
                                    {inboundDomain || 'Not configured'}
                                </code>
                            </div>
                            <div>
                                <p className="font-medium">Inbound route URL</p>
                                <code className="mt-1 block break-all text-muted-foreground">
                                    /webhooks/mailgun/inbound
                                </code>
                            </div>
                            <div>
                                <p className="font-medium">
                                    Permanent failure webhook
                                </p>
                                <code className="mt-1 block break-all text-muted-foreground">
                                    /webhooks/mailgun/events
                                </code>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function EmailCampaignWorkspace(props: PageProps) {
    const {
        active_section,
        stats,
        campaigns,
        leads,
        email_accounts,
        inbox,
        selected_campaign,
        lead_statuses,
        mailgun_configured,
        mailgun_domain,
        mailgun_inbound_domain,
    } = props;

    return (
        <>
            <Head title="Email Campaigns" />
            <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
                <WorkspaceHeader stats={stats} />
                <WorkspaceNav active={active_section} />
                {active_section === 'dashboard' && (
                    <DashboardSection
                        stats={stats}
                        campaigns={campaigns}
                        mailgunConnected={email_accounts.some(
                            (account) => account.status === 'connected',
                        )}
                    />
                )}
                {active_section === 'campaigns' && (
                    <CampaignsSection
                        campaigns={campaigns}
                        accounts={email_accounts}
                        leads={leads}
                    />
                )}
                {active_section === 'campaign' && selected_campaign && (
                    <CampaignEditor
                        key={selected_campaign.id}
                        campaign={selected_campaign}
                        accounts={email_accounts}
                    />
                )}
                {active_section === 'leads' && (
                    <LeadsSection leads={leads} statuses={lead_statuses} />
                )}
                {active_section === 'inbox' && (
                    <InboxSection messages={inbox} statuses={lead_statuses} />
                )}
                {active_section === 'settings' && (
                    <SettingsSection
                        accounts={email_accounts}
                        configured={mailgun_configured}
                        domain={mailgun_domain}
                        inboundDomain={mailgun_inbound_domain}
                    />
                )}
            </main>
        </>
    );
}
