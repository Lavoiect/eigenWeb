import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    BarChart3,
    BookOpen,
    CalendarRange,
    Check,
    CheckCircle2,
    CircleAlert,
    FileText,
    FolderUp,
    Target,
    TrendingUp,
    UserPlus,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { dashboard } from '@/routes';
import { index as organizationCourses } from '@/routes/organizations/courses';
import { index as organizationResources } from '@/routes/organizations/resources';
import { index as organizationUsers } from '@/routes/organizations/users';
import type { Auth } from '@/types';

type DateRangeOption = {
    value: string;
    label: string;
};

type DateRange = {
    key: string;
    label: string;
    display_label: string;
    start: string | null;
    end: string;
    options: DateRangeOption[] | Record<string, DateRangeOption>;
};

type DashboardMetrics = {
    total_employees: number;
    active_learners: number;
    completion_rate: number;
    overdue_assignments: number;
    average_assessment_score: number | null;
    training_requiring_attention: number;
};

type TrainingProgress = {
    completed: number;
    in_progress: number;
    overdue: number;
    not_started: number;
};

type AttentionItem = {
    id: number;
    title: string;
    course: string;
    reason: string;
    affected_learners: number;
    completion_rate: number;
    overdue_assignments: number;
    average_score: number | null;
    course_url?: string;
};

type ActivityItem = {
    type: 'assignment_created' | 'lesson_completed' | 'course_completed';
    type_label: string;
    title: string;
    detail: string;
    timestamp: string;
    user_id: number | null;
};

type TeamComparison = {
    id: number;
    name: string;
    member_count: number;
    active_learners: number;
    completion_rate: number;
    overdue_assignments: number;
    average_score: number | null;
};

type Overview = {
    scope_label: string;
    scope_description: string;
    date_range: DateRange;
    metrics: DashboardMetrics;
    training_progress: TrainingProgress;
    attention_items: AttentionItem[];
    recent_activity: ActivityItem[];
    team_comparison: TeamComparison[];
};

type PageProps = {
    auth: Auth;
    overview: Overview;
};

type DashboardAction = {
    key: string;
    label: string;
    href: string;
    icon: LucideIcon;
    primary?: boolean;
};

type MetricCardProps = {
    label: string;
    value: string;
    context: string;
    icon: LucideIcon;
    tone: 'blue' | 'green' | 'amber' | 'slate';
    ringValue?: number;
};

const toneClasses = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
};

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number | null): string {
    return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function compactDateRange(range: DateRange): string {
    if (range.start === null) {
        return range.display_label;
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return `${formatter.format(new Date(range.start))}-${formatter.format(new Date(range.end))}`;
}

function greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
        return 'Good morning';
    }

    if (hour < 18) {
        return 'Good afternoon';
    }

    return 'Good evening';
}

function activityIcon(type: ActivityItem['type']): LucideIcon {
    switch (type) {
        case 'assignment_created':
            return CalendarRange;
        case 'course_completed':
            return CheckCircle2;
        default:
            return Check;
    }
}

function MetricCard({
    label,
    value,
    context,
    icon: Icon,
    tone,
    ringValue,
}: MetricCardProps) {
    return (
        <Card className="group gap-0 overflow-hidden border-slate-200/80 py-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10">
            <CardContent className="flex min-h-40 items-start justify-between gap-4 p-5">
                <div className="flex h-full min-w-0 flex-1 flex-col">
                    <p className="text-sm font-medium text-muted-foreground">
                        {label}
                    </p>
                    <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                        {value}
                    </p>
                    <p className="mt-auto pt-5 text-sm leading-5 text-muted-foreground">
                        {context}
                    </p>
                </div>

                {ringValue === undefined ? (
                    <span
                        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
                    >
                        <Icon className="size-5" />
                    </span>
                ) : (
                    <div
                        className="grid size-16 shrink-0 place-items-center rounded-full"
                        style={{
                            background: `conic-gradient(#1677ff ${Math.min(Math.max(ringValue, 0), 100) * 3.6}deg, rgba(148, 163, 184, 0.18) 0deg)`,
                        }}
                        role="img"
                        aria-label={`${ringValue}% complete`}
                    >
                        <div className="grid size-12 place-items-center rounded-full bg-card text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {Math.round(ringValue)}%
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const { auth, overview } = usePage<PageProps>().props;
    const organizationId =
        auth.managed_organization?.id ?? auth.user?.organization_id ?? null;
    const canManageUsers =
        Boolean(auth.abilities?.can_manage_users) && organizationId !== null;
    const canAuthorTraining =
        Boolean(auth.abilities?.can_author_training) && organizationId !== null;
    const canAssignTraining =
        Boolean(auth.abilities?.can_assign_training) && canAuthorTraining;
    const canViewReporting =
        Boolean(auth.abilities?.can_view_organization_reporting) &&
        organizationId !== null;
    const canManageResources =
        Boolean(auth.abilities?.can_manage_resources) &&
        organizationId !== null;
    const canViewTranscript = Boolean(auth.abilities?.can_view_own_training);
    const firstName = auth.user?.name.trim().split(/\s+/)[0] || 'there';
    const rangeOptions = Array.isArray(overview.date_range.options)
        ? overview.date_range.options
        : Object.values(overview.date_range.options ?? {});
    const compactRange = compactDateRange(overview.date_range);
    const totalTrainingItems = Object.values(overview.training_progress).reduce(
        (total, value) => total + value,
        0,
    );
    const actionItems: DashboardAction[] = [];

    if (canManageUsers && organizationId !== null) {
        actionItems.push({
            key: 'employee',
            label: 'Add employee',
            href: organizationUsers(organizationId).url,
            icon: UserPlus,
        });
    }

    if (canAssignTraining && organizationId !== null) {
        actionItems.push({
            key: 'assign',
            label: 'Assign training',
            href: organizationCourses(organizationId).url,
            icon: Target,
            primary: true,
        });
    }

    if (canAuthorTraining && organizationId !== null) {
        actionItems.push({
            key: 'course',
            label: 'Create course',
            href: organizationCourses(organizationId).url,
            icon: BookOpen,
        });
    }

    if (canManageResources && organizationId !== null) {
        actionItems.push({
            key: 'resource',
            label: 'Upload resource',
            href: organizationResources(organizationId).url,
            icon: FolderUp,
        });
    }

    if (canViewReporting && organizationId !== null) {
        actionItems.push({
            key: 'reports',
            label: 'View reports',
            href: `/organizations/${organizationId}/reports`,
            icon: BarChart3,
        });
    } else if (canViewTranscript) {
        actionItems.push({
            key: 'transcript',
            label: 'View transcript',
            href: '/transcript',
            icon: FileText,
        });
    }

    const progressRows = [
        {
            key: 'completed',
            label: 'Completed',
            value: overview.training_progress.completed,
            color: 'bg-emerald-500',
            dot: 'bg-emerald-500',
        },
        {
            key: 'in_progress',
            label: 'In progress',
            value: overview.training_progress.in_progress,
            color: 'bg-blue-500',
            dot: 'bg-blue-500',
        },
        {
            key: 'overdue',
            label: 'Overdue',
            value: overview.training_progress.overdue,
            color: 'bg-rose-500',
            dot: 'bg-rose-500',
        },
        {
            key: 'not_started',
            label: 'Not started',
            value: overview.training_progress.not_started,
            color: 'bg-slate-300 dark:bg-slate-600',
            dot: 'bg-slate-400',
        },
    ];

    const handleRangeChange = (value: string) => {
        router.get(
            dashboard({ query: { range: value } }).url,
            {},
            {
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head title="Dashboard" />

            <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
                <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[#071426] px-5 py-6 text-white shadow-[0_22px_70px_rgba(2,12,27,0.22)] sm:px-7 sm:py-7">
                    <div className="pointer-events-none absolute -top-28 -right-16 size-72 rounded-full bg-blue-500/25 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-2/3 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold tracking-[0.2em] text-blue-200 uppercase">
                                    {overview.scope_label}
                                </span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                                    {greeting()}, {firstName}
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                                    Here&apos;s how your workforce is
                                    progressing and where attention is needed.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                                <span>
                                    <strong className="font-semibold text-white">
                                        {formatNumber(
                                            overview.metrics.total_employees,
                                        )}
                                    </strong>{' '}
                                    employees in scope
                                </span>
                                <span>
                                    <strong className="font-semibold text-white">
                                        {formatNumber(
                                            overview.metrics
                                                .training_requiring_attention,
                                        )}
                                    </strong>{' '}
                                    training items need attention
                                </span>
                            </div>
                        </div>

                        <Select
                            value={overview.date_range.key}
                            onValueChange={handleRangeChange}
                        >
                            <SelectTrigger
                                className="h-12 w-full min-w-64 border-white/15 bg-white/10 px-4 text-white shadow-none hover:bg-white/15 lg:w-auto"
                                aria-label="Dashboard date range"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <CalendarRange className="size-4 text-blue-300" />
                                    <span className="font-medium">
                                        {overview.date_range.label}
                                    </span>
                                    <span className="text-white/40">·</span>
                                    <span className="truncate text-white/65">
                                        {compactRange}
                                    </span>
                                </span>
                            </SelectTrigger>
                            <SelectContent align="end">
                                {rangeOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </section>

                {actionItems.length > 0 && (
                    <nav
                        aria-label="Dashboard actions"
                        className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-card p-2 shadow-[0_6px_25px_rgba(15,23,42,0.035)] dark:border-white/10"
                    >
                        <span className="hidden px-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase xl:inline">
                            Quick actions
                        </span>
                        {actionItems.map((action) => {
                            const Icon = action.icon;

                            return (
                                <Button
                                    key={action.key}
                                    asChild
                                    variant={
                                        action.primary ? 'default' : 'ghost'
                                    }
                                    className={
                                        action.primary
                                            ? 'h-10 rounded-xl bg-slate-950 px-4 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'
                                            : 'h-10 rounded-xl px-3 text-muted-foreground hover:text-foreground'
                                    }
                                >
                                    <Link href={action.href}>
                                        <Icon className="size-4" />
                                        {action.label}
                                    </Link>
                                </Button>
                            );
                        })}
                    </nav>
                )}

                <section
                    aria-label="Training overview"
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                >
                    <MetricCard
                        label="Completion rate"
                        value={formatPercent(overview.metrics.completion_rate)}
                        context={`${formatNumber(overview.training_progress.completed)} of ${formatNumber(totalTrainingItems)} assigned training items complete`}
                        icon={TrendingUp}
                        tone="blue"
                        ringValue={overview.metrics.completion_rate}
                    />
                    <MetricCard
                        label="Active learners"
                        value={formatNumber(overview.metrics.active_learners)}
                        context={`${formatNumber(overview.metrics.active_learners)} of ${formatNumber(overview.metrics.total_employees)} employees active in this period`}
                        icon={Users}
                        tone="blue"
                    />
                    <MetricCard
                        label="Overdue training"
                        value={formatNumber(
                            overview.metrics.overdue_assignments,
                        )}
                        context={
                            overview.metrics.overdue_assignments === 0
                                ? 'All clear - no overdue assignments'
                                : `${formatNumber(overview.metrics.overdue_assignments)} assignment${overview.metrics.overdue_assignments === 1 ? '' : 's'} need follow-up`
                        }
                        icon={
                            overview.metrics.overdue_assignments === 0
                                ? CheckCircle2
                                : CircleAlert
                        }
                        tone={
                            overview.metrics.overdue_assignments === 0
                                ? 'green'
                                : 'amber'
                        }
                    />
                    <MetricCard
                        label="Average assessment score"
                        value={formatPercent(
                            overview.metrics.average_assessment_score,
                        )}
                        context={
                            overview.metrics.average_assessment_score === null
                                ? 'Scores appear after assessments are completed'
                                : 'Organization goal: 85%'
                        }
                        icon={Target}
                        tone="slate"
                    />
                </section>

                {totalTrainingItems === 0 ? (
                    <section
                        className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 px-5 py-4 text-blue-950 shadow-[0_8px_30px_rgba(59,130,246,0.06)] sm:flex-row sm:items-center dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100"
                        role="status"
                    >
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                            <BookOpen className="size-5" />
                        </span>
                        <div className="flex-1">
                            <h2 className="font-semibold">
                                No training assignments yet
                            </h2>
                            <p className="mt-0.5 text-sm text-blue-800 dark:text-blue-200/75">
                                Dashboard progress will appear after published
                                training is assigned to employees.
                            </p>
                        </div>
                        {canAuthorTraining && organizationId !== null && (
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={
                                        organizationCourses(organizationId).url
                                    }
                                >
                                    View training
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </Button>
                        )}
                    </section>
                ) : overview.attention_items.length === 0 ? (
                    <section
                        className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 text-emerald-950 shadow-[0_8px_30px_rgba(16,185,129,0.06)] sm:flex-row sm:items-center dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                        role="status"
                    >
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Check className="size-5" />
                        </span>
                        <div>
                            <h2 className="font-semibold">
                                Everything is on track
                            </h2>
                            <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200/75">
                                No overdue or failed training currently requires
                                follow-up.
                            </p>
                        </div>
                    </section>
                ) : (
                    <Card className="gap-0 overflow-hidden border-slate-200/80 py-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/10">
                        <CardHeader className="gap-2 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-300">
                                    <CircleAlert className="size-4" />
                                    Action required
                                </div>
                                <CardTitle className="text-xl tracking-tight">
                                    Training requiring attention
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Start here to clear risk and unblock learner
                                    progress.
                                </CardDescription>
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">
                                {formatNumber(
                                    overview.metrics
                                        .training_requiring_attention,
                                )}{' '}
                                flagged
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden grid-cols-[minmax(0,1.25fr)_9rem_minmax(0,1.4fr)_auto] gap-4 border-b border-border/60 bg-muted/30 px-6 py-2.5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase lg:grid">
                                <span>Training</span>
                                <span>Affected</span>
                                <span>Issue</span>
                                <span>Action</span>
                            </div>
                            {overview.attention_items.map((item, index) => {
                                const actionLabel =
                                    item.overdue_assignments > 0
                                        ? 'Send reminder'
                                        : item.average_score !== null &&
                                            item.average_score < 80
                                          ? 'Assign refresher'
                                          : 'Review training';
                                const actionHref = item.course_url
                                    ? `${item.course_url}?assignment_target_type=user`
                                    : organizationId !== null &&
                                        canAuthorTraining
                                      ? organizationCourses(organizationId).url
                                      : null;

                                return (
                                    <div
                                        key={item.id}
                                        className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.25fr)_9rem_minmax(0,1.4fr)_auto] lg:items-center lg:gap-4 lg:px-6"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">
                                                {item.title}
                                            </p>
                                            <p className="mt-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                                                {item.course}
                                            </p>
                                        </div>
                                        <div className="flex items-baseline gap-2 lg:block">
                                            <span className="text-xs font-medium text-muted-foreground lg:hidden">
                                                Affected
                                            </span>
                                            <span className="font-semibold">
                                                {formatNumber(
                                                    item.affected_learners ??
                                                        item.overdue_assignments,
                                                )}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                learner
                                                {(item.affected_learners ??
                                                    item.overdue_assignments) ===
                                                1
                                                    ? ''
                                                    : 's'}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-5 text-muted-foreground">
                                            {item.reason}
                                        </p>
                                        {actionHref && (
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="w-fit rounded-lg"
                                            >
                                                <Link href={actionHref}>
                                                    {actionLabel}
                                                    <ArrowRight className="size-3.5" />
                                                </Link>
                                            </Button>
                                        )}
                                        {index <
                                            overview.attention_items.length -
                                                1 && (
                                            <Separator className="col-span-full lg:hidden" />
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
                    <Card className="gap-0 border-slate-200/80 py-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/10">
                        <CardHeader className="px-5 pt-5 pb-2 sm:px-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg tracking-tight">
                                        Training progress
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Current status of assigned training.
                                    </CardDescription>
                                </div>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                    {formatNumber(totalTrainingItems)} total
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 px-5 pt-4 pb-6 sm:px-6">
                            {progressRows.map((row) => {
                                const percent =
                                    totalTrainingItems > 0
                                        ? Math.round(
                                              (row.value / totalTrainingItems) *
                                                  100,
                                          )
                                        : 0;

                                return (
                                    <div key={row.key} className="space-y-2">
                                        <div className="flex items-center justify-between gap-4 text-sm">
                                            <span className="flex items-center gap-2 font-medium">
                                                <span
                                                    className={`size-2 rounded-full ${row.dot}`}
                                                />
                                                {row.label}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums">
                                                <strong className="font-semibold text-foreground">
                                                    {formatNumber(row.value)}
                                                </strong>{' '}
                                                · {percent}%
                                            </span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                            <div
                                                className={`h-full rounded-full transition-[width] duration-500 ${row.color}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card className="gap-0 border-slate-200/80 py-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/10">
                        <CardHeader className="flex-row items-start justify-between gap-4 px-5 pt-5 pb-2 sm:px-6">
                            <div>
                                <CardTitle className="text-lg tracking-tight">
                                    Recent activity
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Latest workforce updates.
                                </CardDescription>
                            </div>
                            <Activity className="mt-0.5 size-5 text-blue-600 dark:text-blue-300" />
                        </CardHeader>
                        <CardContent className="px-5 pt-3 pb-5 sm:px-6">
                            {overview.recent_activity.length > 0 ? (
                                <div className="space-y-0">
                                    {overview.recent_activity
                                        .slice(0, 5)
                                        .map((item, index) => {
                                            const Icon = activityIcon(
                                                item.type,
                                            );

                                            return (
                                                <div
                                                    key={`${item.type}-${item.timestamp}-${index}`}
                                                >
                                                    <div className="flex gap-3 py-3">
                                                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                                            <Icon className="size-3.5" />
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm leading-5 font-medium">
                                                                {item.title}
                                                            </p>
                                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                                {item.detail} ·{' '}
                                                                {formatDateTime(
                                                                    item.timestamp,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {index <
                                                        Math.min(
                                                            overview
                                                                .recent_activity
                                                                .length,
                                                            5,
                                                        ) -
                                                            1 && <Separator />}
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                                    Activity will appear as learners complete
                                    training and receive assignments.
                                </div>
                            )}

                            {canViewReporting && organizationId !== null && (
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 w-full justify-between rounded-lg px-2 text-blue-700 hover:text-blue-800 dark:text-blue-300"
                                >
                                    <Link
                                        href={`/organizations/${organizationId}/reports`}
                                    >
                                        View all activity
                                        <ArrowRight className="size-3.5" />
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {overview.team_comparison.length > 0 && (
                    <Card className="gap-0 border-slate-200/80 py-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/10">
                        <CardHeader className="flex-col gap-3 border-b border-border/60 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase dark:text-blue-300">
                                    <TrendingUp className="size-4" />
                                    Team performance
                                </div>
                                <CardTitle className="text-xl tracking-tight">
                                    Compare teams at a glance
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Completion, activity, and risk across your
                                    organization.
                                </CardDescription>
                            </div>
                            {canViewReporting && organizationId !== null && (
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={`/organizations/${organizationId}/reports`}
                                    >
                                        Full comparison
                                        <ArrowRight className="size-3.5" />
                                    </Link>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="divide-y divide-border/60 p-0">
                            {overview.team_comparison.map((team) => (
                                <div
                                    key={team.id}
                                    className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(11rem,0.8fr)_minmax(16rem,1.4fr)_repeat(3,minmax(6rem,0.45fr))] lg:items-center"
                                >
                                    <div>
                                        <p className="font-semibold">
                                            {team.name}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {formatNumber(team.member_count)}{' '}
                                            people ·{' '}
                                            {formatNumber(team.active_learners)}{' '}
                                            active
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Completion</span>
                                            <span className="font-semibold text-foreground">
                                                {formatPercent(
                                                    team.completion_rate,
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-blue-500"
                                                style={{
                                                    width: `${Math.min(Math.max(team.completion_rate, 0), 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between lg:block">
                                        <span className="text-xs text-muted-foreground">
                                            Active learners
                                        </span>
                                        <p className="font-semibold tabular-nums lg:mt-1">
                                            {formatNumber(team.active_learners)}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between lg:block">
                                        <span className="text-xs text-muted-foreground">
                                            Overdue
                                        </span>
                                        <p
                                            className={`font-semibold tabular-nums lg:mt-1 ${team.overdue_assignments > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}
                                        >
                                            {formatNumber(
                                                team.overdue_assignments,
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between lg:block">
                                        <span className="text-xs text-muted-foreground">
                                            Avg. score
                                        </span>
                                        <p className="font-semibold tabular-nums lg:mt-1">
                                            {formatPercent(team.average_score)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
