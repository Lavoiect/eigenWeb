import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Check,
    ChevronDown,
    ChevronUp,
    CircleHelp,
    Download,
    Filter,
    GraduationCap,
    Search,
    Target,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

type DateRangeOption = { value: string; label: string };
type DateRange = {
    key: string;
    label: string;
    display_label: string;
    start: string | null;
    end: string;
    options: DateRangeOption[];
};
type ReportRow = {
    id?: number | null;
    label: string;
    employees: number;
    assigned: number;
    completed: number;
    completion_rate: number | null;
    overdue: number;
    average_score: number | null;
    notes: string;
    detail_url?: string | null;
};
type EmployeeReportRow = ReportRow & {
    id: number;
    name: string;
    email: string;
    role_label: string;
    job_title: string | null;
    location: string | null;
    account_status: 'active' | 'deactivated';
    last_active_at: string | null;
    needs_attention: boolean;
    detail_url: string;
};
type MissedQuestionRow = ReportRow & {
    course_label: string;
    lesson_label: string;
    procedure_label: string;
    competency_label: string;
    question_type_label: string;
    top_team_label: string;
    top_location_label: string;
    affected_learners: string[];
    failure_rate: number;
    refresher_target_label: string;
    refresher_action_url: string;
    correct_answer: string | null;
};
type AttentionItem = {
    issue: string;
    severity: 'high' | 'medium';
    affected: number;
    affected_label: string;
    details: string;
    action_label: string;
    action_url: string;
};
type ReportingSummary = {
    total_employees: number;
    assigned_learners: number;
    active_learners: number;
    completion_rate: number | null;
    overdue_training: number;
    average_assessment_score: number | null;
    employees_requiring_intervention: number;
    training_gap_summary: number;
    completed_lessons: number;
    completed_courses: number;
    scored_assessments: number;
};
type ReportFilters = {
    job_title_id: number | null;
    team_id: number | null;
    location_id: number | null;
    pathway_id: number | null;
    course_id: number | null;
    employee_status: 'active' | 'deactivated' | 'all';
};
type FilterOption = { value: string; label: string };
type FilterOptions = {
    job_titles: FilterOption[];
    teams: FilterOption[];
    locations: FilterOption[];
    pathways: FilterOption[];
    courses: FilterOption[];
    employee_statuses: FilterOption[];
};
type Reporting = {
    scope_description: string;
    date_range: DateRange;
    summary: ReportingSummary;
    assignment_status: {
        completed: number;
        in_progress: number;
        not_started: number;
        overdue: number;
    };
    assessment_summary: {
        scored_assessments: number;
        passed: number;
        failed: number;
        pass_rate: number | null;
    };
    completion_by_course: ReportRow[];
    completion_by_job_title: ReportRow[];
    completion_by_team: ReportRow[];
    completion_by_location: ReportRow[];
    completion_by_pathway: ReportRow[];
    overdue_training: ReportRow[];
    assessment_scores: ReportRow[];
    employees_requiring_intervention: ReportRow[];
    attention_items: AttentionItem[];
    employee_rows: EmployeeReportRow[];
    missed_questions: MissedQuestionRow[];
    knowledge_gap_threshold: number;
    insufficient_question_groups: number;
    definitions: Array<{ label: string; description: string }>;
    filters: ReportFilters;
    filter_options: FilterOptions;
    active_filter_labels: string[];
    export_url: string;
};
type Organization = { id: number; name: string; slug: string };
type PageProps = { organization: Organization; reporting: Reporting };
type ReportTab =
    | 'overview'
    | 'completion'
    | 'assessments'
    | 'compliance'
    | 'knowledge_gaps'
    | 'employees';
type Breakdown = 'course' | 'job_title' | 'team' | 'location' | 'pathway';

const selectClass =
    'h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30';

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number | null): string {
    return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function relativeDate(value: string | null): string {
    if (!value) {
        return 'No activity';
    }

    const days = Math.max(
        0,
        Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
    );

    if (days === 0) {
        return 'Today';
    }

    if (days === 1) {
        return 'Yesterday';
    }

    if (days < 30) {
        return `${days} days ago`;
    }

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

function ProgressBar({
    value,
    danger = false,
}: {
    value: number | null;
    danger?: boolean;
}) {
    return (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
                className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${value ?? 0}%` }}
            />
        </div>
    );
}

function EmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof Check;
    title: string;
    description: string;
}) {
    return (
        <div className="grid min-h-44 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
            <div className="max-w-lg">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950">
                    <Icon className="size-5" />
                </span>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

export default function OrganizationReportsIndex() {
    const { organization, reporting } = usePage<PageProps>().props;
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [breakdown, setBreakdown] = useState<Breakdown>('course');
    const [filterOpen, setFilterOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [draftFilters, setDraftFilters] = useState({
        job_title: reporting.filters.job_title_id?.toString() ?? '',
        team: reporting.filters.team_id?.toString() ?? '',
        location: reporting.filters.location_id?.toString() ?? '',
        pathway: reporting.filters.pathway_id?.toString() ?? '',
        course: reporting.filters.course_id?.toString() ?? '',
        employee_status: reporting.filters.employee_status,
    });

    const reportUrl = `/organizations/${organization.id}/reports`;
    const currentFilterQuery = {
        job_title: reporting.filters.job_title_id ?? undefined,
        team: reporting.filters.team_id ?? undefined,
        location: reporting.filters.location_id ?? undefined,
        pathway: reporting.filters.pathway_id ?? undefined,
        course: reporting.filters.course_id ?? undefined,
        employee_status:
            reporting.filters.employee_status === 'active'
                ? undefined
                : reporting.filters.employee_status,
    };

    const handleRangeChange = (range: string) => {
        router.get(
            reportUrl,
            { range, ...currentFilterQuery },
            { preserveState: true, replace: true },
        );
    };

    const applyFilters = () => {
        router.get(
            reportUrl,
            {
                range: reporting.date_range.key,
                ...draftFilters,
                employee_status:
                    draftFilters.employee_status === 'active'
                        ? undefined
                        : draftFilters.employee_status,
            },
            {
                preserveState: true,
                replace: true,
                onSuccess: () => setFilterOpen(false),
            },
        );
    };

    const clearFilters = () => {
        setDraftFilters({
            job_title: '',
            team: '',
            location: '',
            pathway: '',
            course: '',
            employee_status: 'active',
        });
        router.get(
            reportUrl,
            { range: reporting.date_range.key },
            { preserveState: true, replace: true },
        );
    };

    const exportType: Record<ReportTab, string> = {
        overview: 'completion',
        completion: 'completion',
        assessments: 'assessments',
        compliance: 'overdue',
        knowledge_gaps: 'knowledge_gaps',
        employees: 'employees',
    };
    const exportHref = (type: string) =>
        `${reporting.export_url}&report=${type}`;

    const breakdownRows: Record<Breakdown, ReportRow[]> = {
        course: reporting.completion_by_course,
        job_title: reporting.completion_by_job_title,
        team: reporting.completion_by_team,
        location: reporting.completion_by_location,
        pathway: reporting.completion_by_pathway,
    };

    const filteredEmployees = reporting.employee_rows.filter((employee) => {
        const query = employeeSearch.trim().toLowerCase();

        return (
            query === '' ||
            `${employee.name} ${employee.email} ${employee.job_title ?? ''} ${employee.location ?? ''}`
                .toLowerCase()
                .includes(query)
        );
    });

    return (
        <>
            <Head title={`${organization.name} training reports`} />

            <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            {organization.name}
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Training reports
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                            {reporting.scope_description}
                        </p>
                        <p className="pt-1 text-sm text-muted-foreground">
                            Reporting on{' '}
                            <span className="font-medium text-foreground">
                                {formatNumber(
                                    reporting.summary.total_employees,
                                )}{' '}
                                employees
                            </span>{' '}
                            ·{' '}
                            {formatNumber(reporting.summary.assigned_learners)}{' '}
                            with assigned training ·{' '}
                            {formatNumber(reporting.summary.active_learners)}{' '}
                            learners active during this period
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={reporting.date_range.key}
                            onValueChange={handleRangeChange}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Date range" />
                            </SelectTrigger>
                            <SelectContent>
                                {reporting.date_range.options.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            onClick={() => setFilterOpen(true)}
                        >
                            <Filter className="size-4" />
                            Filters
                            {reporting.active_filter_labels.length > 0 && (
                                <Badge
                                    className="ml-1 px-1.5"
                                    variant="secondary"
                                >
                                    {reporting.active_filter_labels.length}
                                </Badge>
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button>
                                    <Download className="size-4" />
                                    Export
                                    <ChevronDown className="size-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuLabel>
                                    {reporting.date_range.label} ·{' '}
                                    {reporting.active_filter_labels.length ||
                                        'No'}{' '}
                                    filters
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <a href={exportHref(exportType[activeTab])}>
                                        Export current view
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportHref('completion')}>
                                        Completion report
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportHref('overdue')}>
                                        Overdue assignments
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportHref('assessments')}>
                                        Assessment results
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportHref('employees')}>
                                        Employee report
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={exportHref('knowledge_gaps')}>
                                        Knowledge gaps
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {reporting.active_filter_labels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/25 px-4 py-3 text-sm">
                        <Filter className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            Filtered by
                        </span>
                        <span className="font-medium">
                            {reporting.active_filter_labels.join(' · ')}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </Button>
                    </div>
                )}

                <nav
                    className="flex gap-1 overflow-x-auto border-b"
                    aria-label="Report sections"
                >
                    {(
                        [
                            ['overview', 'Overview'],
                            ['completion', 'Completion'],
                            ['assessments', 'Assessments'],
                            ['compliance', 'Compliance'],
                            ['knowledge_gaps', 'Knowledge gaps'],
                            ['employees', 'Employees'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setActiveTab(value)}
                            className={`relative min-h-11 shrink-0 px-3 text-sm font-medium transition-colors ${activeTab === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {label}
                            {activeTab === value && (
                                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground" />
                            )}
                        </button>
                    ))}
                </nav>

                {activeTab === 'overview' && (
                    <Overview
                        reporting={reporting}
                        breakdown={breakdown}
                        setBreakdown={setBreakdown}
                        rows={breakdownRows[breakdown]}
                        openReport={setActiveTab}
                        openHelp={() => setHelpOpen(true)}
                    />
                )}

                {activeTab === 'completion' && (
                    <section className="space-y-5">
                        <SectionHeading
                            title="Completion report"
                            description="Compare assignment completion across courses and workforce groups."
                        />
                        <CompletionBreakdown
                            breakdown={breakdown}
                            setBreakdown={setBreakdown}
                            rows={breakdownRows[breakdown]}
                        />
                    </section>
                )}

                {activeTab === 'assessments' && (
                    <section className="space-y-5">
                        <SectionHeading
                            title="Assessment performance"
                            description="Scores include only completed, scored assessments in the selected period."
                        />
                        <AssessmentPerformance reporting={reporting} />
                        <ReportTable
                            title="Scores by course"
                            rows={reporting.assessment_scores}
                            emptyText="No scored assessments were completed during this period."
                        />
                    </section>
                )}

                {activeTab === 'compliance' && (
                    <section className="space-y-5">
                        <SectionHeading
                            title="Compliance and follow-up"
                            description="Prioritize overdue and stalled training without searching multiple reports."
                        />
                        <NeedsAttention items={reporting.attention_items} />
                        <ReportTable
                            title="Overdue assignments by course"
                            rows={reporting.overdue_training}
                            emptyText="There are no overdue assignments in this report scope."
                        />
                    </section>
                )}

                {activeTab === 'knowledge_gaps' && (
                    <section className="space-y-5">
                        <SectionHeading
                            title="Knowledge gaps"
                            description={`Questions appear after at least ${reporting.knowledge_gap_threshold} attempts so small samples are not presented as reliable trends.`}
                        />
                        <KnowledgeGaps reporting={reporting} />
                    </section>
                )}

                {activeTab === 'employees' && (
                    <section className="space-y-5">
                        <SectionHeading
                            title="Employee training status"
                            description="Find individual learners who need follow-up and open their full training record."
                        />
                        <Card className="gap-0 py-0">
                            <div className="border-b p-4">
                                <div className="relative max-w-md">
                                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={employeeSearch}
                                        onChange={(event) =>
                                            setEmployeeSearch(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Search employees"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <EmployeeTable rows={filteredEmployees} />
                        </Card>
                    </section>
                )}

                <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Data through{' '}
                        {new Intl.DateTimeFormat('en', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                        }).format(new Date(reporting.date_range.end))}
                        . {reporting.summary.completed_lessons} lessons and{' '}
                        {reporting.summary.completed_courses} courses completed
                        during this period.
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHelpOpen(true)}
                    >
                        <CircleHelp className="size-4" /> Metric definitions
                    </Button>
                </div>
            </main>

            <FilterDialog
                open={filterOpen}
                onOpenChange={setFilterOpen}
                options={reporting.filter_options}
                filters={draftFilters}
                setFilters={setDraftFilters}
                onApply={applyFilters}
                onClear={clearFilters}
            />

            <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader className="border-b p-6">
                        <SheetTitle>Metric definitions</SheetTitle>
                        <SheetDescription>
                            How Eigen calculates the numbers shown in this
                            report.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-5 p-6">
                        {reporting.definitions.map((definition) => (
                            <div key={definition.label}>
                                <p className="font-medium">
                                    {definition.label}
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                    {definition.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}

function Overview({
    reporting,
    breakdown,
    setBreakdown,
    rows,
    openReport,
    openHelp,
}: {
    reporting: Reporting;
    breakdown: Breakdown;
    setBreakdown: (value: Breakdown) => void;
    rows: ReportRow[];
    openReport: (value: ReportTab) => void;
    openHelp: () => void;
}) {
    const assigned = Object.values(reporting.assignment_status).reduce(
        (sum, value) => sum + value,
        0,
    );
    const metrics = [
        {
            label: 'Completion rate',
            value:
                reporting.summary.completion_rate === null
                    ? 'No assigned training'
                    : formatPercent(reporting.summary.completion_rate),
            detail: `${formatNumber(reporting.assignment_status.completed)} of ${formatNumber(assigned)} assignments`,
            icon: TrendingUp,
        },
        {
            label: 'Overdue training',
            value: formatNumber(reporting.summary.overdue_training),
            detail:
                reporting.summary.overdue_training === 0
                    ? 'All clear'
                    : 'Assignments need follow-up',
            icon: AlertTriangle,
            alert: reporting.summary.overdue_training > 0,
        },
        {
            label: 'Average assessment score',
            value: formatPercent(reporting.summary.average_assessment_score),
            detail: `${formatNumber(reporting.summary.scored_assessments)} scored assessments`,
            icon: Target,
        },
        {
            label: 'Employees needing attention',
            value: formatNumber(
                reporting.summary.employees_requiring_intervention,
            ),
            detail:
                reporting.summary.employees_requiring_intervention === 0
                    ? 'No intervention required'
                    : 'Review priority learners',
            icon: Users,
            alert: reporting.summary.employees_requiring_intervention > 0,
        },
    ];

    return (
        <section className="space-y-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {metrics.map((metric) => (
                    <Card
                        key={metric.label}
                        className={`gap-0 py-0 ${metric.alert ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' : ''}`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {metric.label}
                                </p>
                                <button
                                    type="button"
                                    onClick={openHelp}
                                    title={`Learn how ${metric.label.toLowerCase()} is calculated`}
                                >
                                    <metric.icon
                                        className={`size-4 ${metric.alert ? 'text-amber-700' : 'text-muted-foreground'}`}
                                    />
                                </button>
                            </div>
                            <p
                                className={`mt-2 font-semibold tracking-tight ${metric.value.length > 10 ? 'text-lg' : 'text-2xl'}`}
                            >
                                {metric.value}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {metric.detail}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <AssignmentStatus status={reporting.assignment_status} />
                <AssessmentPerformance reporting={reporting} />
            </div>

            <div className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                    <SectionHeading
                        title="Completion breakdown"
                        description="Compare completion across the organization."
                    />
                    <Button
                        variant="ghost"
                        onClick={() => openReport('completion')}
                    >
                        View report <ArrowRight className="size-4" />
                    </Button>
                </div>
                <CompletionBreakdown
                    breakdown={breakdown}
                    setBreakdown={setBreakdown}
                    rows={rows.slice(0, 5)}
                    compact
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                    <SectionHeading
                        title="Needs attention"
                        description="Issues that can be acted on now."
                    />
                    <Button
                        variant="ghost"
                        onClick={() => openReport('compliance')}
                    >
                        View report <ArrowRight className="size-4" />
                    </Button>
                </div>
                <NeedsAttention items={reporting.attention_items.slice(0, 4)} />
            </div>

            <div className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                    <SectionHeading
                        title="Most frequently missed questions"
                        description="Reliable question-level trends from assessment attempts."
                    />
                    <Button
                        variant="ghost"
                        onClick={() => openReport('knowledge_gaps')}
                    >
                        View report <ArrowRight className="size-4" />
                    </Button>
                </div>
                <KnowledgeGaps
                    reporting={{
                        ...reporting,
                        missed_questions: reporting.missed_questions.slice(
                            0,
                            3,
                        ),
                    }}
                    compact
                />
            </div>
        </section>
    );
}

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function AssignmentStatus({
    status,
}: {
    status: Reporting['assignment_status'];
}) {
    const total = Object.values(status).reduce((sum, value) => sum + value, 0);
    const items = [
        { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
        { key: 'in_progress', label: 'In progress', color: 'bg-sky-500' },
        {
            key: 'not_started',
            label: 'Not started',
            color: 'bg-slate-300 dark:bg-slate-600',
        },
        { key: 'overdue', label: 'Overdue', color: 'bg-red-500' },
    ] as const;

    return (
        <Card className="gap-0 py-0">
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold">Assignment status</h3>
                        <p className="text-sm text-muted-foreground">
                            {formatNumber(total)} assigned training items
                        </p>
                    </div>
                    <BarChart3 className="size-5 text-muted-foreground" />
                </div>
                {total === 0 ? (
                    <div className="mt-6 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                        No assignments in this report scope.
                    </div>
                ) : (
                    <>
                        <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-muted">
                            {items.map(
                                (item) =>
                                    status[item.key] > 0 && (
                                        <div
                                            key={item.key}
                                            className={item.color}
                                            style={{
                                                width: `${(status[item.key] / total) * 100}%`,
                                            }}
                                            title={`${item.label}: ${status[item.key]}`}
                                        />
                                    ),
                            )}
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {items.map((item) => (
                                <div key={item.key}>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span
                                            className={`size-2 rounded-full ${item.color}`}
                                        />
                                        {item.label}
                                    </div>
                                    <p className="mt-1 pl-4 font-semibold tabular-nums">
                                        {formatNumber(status[item.key])}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function AssessmentPerformance({ reporting }: { reporting: Reporting }) {
    const summary = reporting.assessment_summary;

    return (
        <Card className="gap-0 py-0">
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold">
                            Assessment performance
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Completed during{' '}
                            {reporting.date_range.label.toLowerCase()}
                        </p>
                    </div>
                    <Target className="size-5 text-muted-foreground" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            Average score
                        </p>
                        <p className="mt-1 text-3xl font-semibold">
                            {formatPercent(
                                reporting.summary.average_assessment_score,
                            )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {summary.scored_assessments} scored assessments
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">
                            Pass rate
                        </p>
                        <p className="mt-1 text-3xl font-semibold">
                            {formatPercent(summary.pass_rate)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {summary.passed} passed · {summary.failed} failed
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CompletionBreakdown({
    breakdown,
    setBreakdown,
    rows,
    compact = false,
}: {
    breakdown: Breakdown;
    setBreakdown: (value: Breakdown) => void;
    rows: ReportRow[];
    compact?: boolean;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="flex gap-1 overflow-x-auto border-b p-3">
                {(
                    [
                        ['course', 'Course'],
                        ['job_title', 'Job title'],
                        ['team', 'Team'],
                        ['location', 'Location'],
                        ['pathway', 'Pathway'],
                    ] as const
                ).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setBreakdown(value)}
                        className={`min-h-9 shrink-0 rounded-md px-3 text-sm font-medium ${breakdown === value ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {rows.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon={GraduationCap}
                        title="No assigned training"
                        description="No employees with assigned training match this report scope."
                    />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-muted/35 text-xs tracking-wide text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-3 py-3 text-right">
                                    Learners
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Assigned
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Completed
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Overdue
                                </th>
                                <th className="w-52 px-4 py-3">Completion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map((row) => (
                                <tr
                                    key={`${breakdown}-${row.id ?? row.label}`}
                                    className="hover:bg-muted/30"
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-medium">
                                            {row.label}
                                        </div>
                                        {!compact && (
                                            <div className="mt-0.5 text-xs text-muted-foreground">
                                                {row.notes}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {row.employees}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {row.assigned}
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {row.completed}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right tabular-nums ${row.overdue > 0 ? 'font-medium text-red-600' : ''}`}
                                    >
                                        {row.overdue}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="mb-2 flex items-center justify-between text-xs">
                                            <span>
                                                {row.completion_rate === null
                                                    ? 'No assigned training'
                                                    : formatPercent(
                                                          row.completion_rate,
                                                      )}
                                            </span>
                                            {row.detail_url && (
                                                <Link
                                                    href={row.detail_url}
                                                    className="font-medium hover:underline"
                                                >
                                                    View
                                                </Link>
                                            )}
                                        </div>
                                        <ProgressBar
                                            value={row.completion_rate}
                                            danger={row.overdue > 0}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

function NeedsAttention({ items }: { items: AttentionItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                icon={Check}
                title="Everything is on track"
                description="No overdue assignments, stalled learners, or low assessment scores were found for this period."
            />
        );
    }

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-muted/35 text-xs tracking-wide text-muted-foreground uppercase">
                        <tr>
                            <th className="px-4 py-3">Issue</th>
                            <th className="px-3 py-3">Affected</th>
                            <th className="px-3 py-3">Details</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {items.map((item, index) => (
                            <tr key={`${item.issue}-${item.details}-${index}`}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`size-2 rounded-full ${item.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`}
                                        />
                                        <span className="font-medium">
                                            {item.issue}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    {item.affected} {item.affected_label}
                                </td>
                                <td className="px-3 py-3 text-muted-foreground">
                                    {item.details}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={item.action_url}>
                                            {item.action_label}
                                        </Link>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function ReportTable({
    title,
    rows,
    emptyText,
}: {
    title: string;
    rows: ReportRow[];
    emptyText: string;
}) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b px-4 py-4">
                <h3 className="font-semibold">{title}</h3>
            </div>
            {rows.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon={Check}
                        title="Nothing to report"
                        description={emptyText}
                    />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-muted/35 text-xs tracking-wide text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-3 py-3 text-right">
                                    Learners
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Completed
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Overdue
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Completion
                                </th>
                                <th className="px-4 py-3 text-right">
                                    Avg. score
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map((row) => (
                                <tr
                                    key={row.label}
                                    className="hover:bg-muted/30"
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-medium">
                                            {row.detail_url ? (
                                                <Link
                                                    href={row.detail_url}
                                                    className="hover:underline"
                                                >
                                                    {row.label}
                                                </Link>
                                            ) : (
                                                row.label
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {row.notes}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        {row.employees}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        {row.completed}
                                    </td>
                                    <td
                                        className={`px-3 py-3 text-right ${row.overdue > 0 ? 'font-medium text-red-600' : ''}`}
                                    >
                                        {row.overdue}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        {row.completion_rate === null
                                            ? 'No training'
                                            : formatPercent(
                                                  row.completion_rate,
                                              )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {formatPercent(row.average_score)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

function KnowledgeGaps({
    reporting,
    compact = false,
}: {
    reporting: Reporting;
    compact?: boolean;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (reporting.missed_questions.length === 0) {
        return (
            <EmptyState
                icon={Target}
                title="Not enough assessment attempts"
                description={
                    reporting.insufficient_question_groups > 0
                        ? `${reporting.insufficient_question_groups} question groups have fewer than ${reporting.knowledge_gap_threshold} attempts. More responses are needed before showing a reliable miss rate.`
                        : 'No reliable question-level knowledge gaps were found for this period.'
                }
            />
        );
    }

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                    <thead className="bg-muted/35 text-xs tracking-wide text-muted-foreground uppercase">
                        <tr>
                            <th className="px-4 py-3">Question</th>
                            <th className="px-3 py-3">Course</th>
                            <th className="px-3 py-3 text-right">Miss rate</th>
                            <th className="px-3 py-3 text-right">Affected</th>
                            <th className="px-3 py-3">Group</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {reporting.missed_questions.map((row) => {
                            const key = `${row.course_label}-${row.lesson_label}-${row.label}`;
                            const isExpanded = expanded === key;

                            return (
                                <tr key={key}>
                                    <td colSpan={6} className="p-0">
                                        <div className="grid grid-cols-[minmax(260px,2fr)_minmax(150px,1fr)_100px_100px_minmax(140px,1fr)_150px] items-center">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpanded(
                                                        isExpanded ? null : key,
                                                    )
                                                }
                                                className="flex items-start gap-2 px-4 py-4 text-left font-medium"
                                            >
                                                <span className="mt-0.5">
                                                    {isExpanded ? (
                                                        <ChevronUp className="size-4" />
                                                    ) : (
                                                        <ChevronDown className="size-4" />
                                                    )}
                                                </span>
                                                {row.label}
                                            </button>
                                            <div className="px-3 py-4 text-muted-foreground">
                                                {row.course_label}
                                            </div>
                                            <div className="px-3 py-4 text-right font-semibold">
                                                {formatPercent(
                                                    row.failure_rate,
                                                )}
                                            </div>
                                            <div className="px-3 py-4 text-right">
                                                {row.employees}
                                            </div>
                                            <div className="px-3 py-4 text-muted-foreground">
                                                {row.top_team_label !==
                                                'Unassigned'
                                                    ? row.top_team_label
                                                    : row.top_location_label}
                                            </div>
                                            <div className="px-4 py-4 text-right">
                                                <Button asChild size="sm">
                                                    <Link
                                                        href={
                                                            row.refresher_action_url
                                                        }
                                                    >
                                                        Assign refresher
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        {isExpanded && !compact && (
                                            <div className="grid gap-4 border-t bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-4">
                                                <div>
                                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        Correct answer
                                                    </p>
                                                    <p className="mt-1">
                                                        {row.correct_answer ??
                                                            'Review the related lesson'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        Attempts
                                                    </p>
                                                    <p className="mt-1">
                                                        {row.assigned} total ·{' '}
                                                        {row.overdue} missed
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        Employees affected
                                                    </p>
                                                    <p className="mt-1">
                                                        {row.affected_learners.join(
                                                            ', ',
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                        Related training
                                                    </p>
                                                    <p className="mt-1">
                                                        {row.course_label}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {row.lesson_label} ·{' '}
                                                        {row.procedure_label}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function EmployeeTable({ rows }: { rows: EmployeeReportRow[] }) {
    if (rows.length === 0) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={Search}
                    title="No employees found"
                    description="Try another search or adjust the report filters."
                />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-muted/35 text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-3 py-3">Job title</th>
                        <th className="px-3 py-3">Assignments</th>
                        <th className="px-3 py-3">Completion</th>
                        <th className="px-3 py-3">Avg. score</th>
                        <th className="px-3 py-3">Last activity</th>
                        <th className="px-4 py-3 text-right">Record</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                                <p className="font-medium">{row.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {row.email}
                                </p>
                            </td>
                            <td className="px-3 py-3">
                                <p>{row.job_title ?? 'No job title'}</p>
                                <p className="text-xs text-muted-foreground">
                                    {row.location ?? 'No location'}
                                </p>
                            </td>
                            <td className="px-3 py-3">
                                {row.assigned === 0
                                    ? 'No assigned training'
                                    : `${row.completed} of ${row.assigned} completed`}
                            </td>
                            <td className="w-40 px-3 py-3">
                                <div className="mb-2 flex justify-between text-xs">
                                    <span>
                                        {row.completion_rate === null
                                            ? 'N/A'
                                            : formatPercent(
                                                  row.completion_rate,
                                              )}
                                    </span>
                                    {row.overdue > 0 && (
                                        <span className="text-red-600">
                                            {row.overdue} overdue
                                        </span>
                                    )}
                                </div>
                                <ProgressBar
                                    value={row.completion_rate}
                                    danger={row.overdue > 0}
                                />
                            </td>
                            <td className="px-3 py-3">
                                {formatPercent(row.average_score)}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                                {relativeDate(row.last_active_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={row.detail_url}>
                                        View <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FilterDialog({
    open,
    onOpenChange,
    options,
    filters,
    setFilters,
    onApply,
    onClear,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    options: FilterOptions;
    filters: {
        job_title: string;
        team: string;
        location: string;
        pathway: string;
        course: string;
        employee_status: string;
    };
    setFilters: React.Dispatch<
        React.SetStateAction<{
            job_title: string;
            team: string;
            location: string;
            pathway: string;
            course: string;
            employee_status: 'active' | 'deactivated' | 'all';
        }>
    >;
    onApply: () => void;
    onClear: () => void;
}) {
    const fields = [
        { key: 'job_title', label: 'Job title', options: options.job_titles },
        { key: 'team', label: 'Team', options: options.teams },
        { key: 'location', label: 'Location', options: options.locations },
        { key: 'pathway', label: 'Pathway', options: options.pathways },
        { key: 'course', label: 'Course', options: options.courses },
    ] as const;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Filter training reports</DialogTitle>
                    <DialogDescription>
                        These filters apply to every report tab and export.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                        <div key={field.key} className="grid gap-2">
                            <Label htmlFor={`report-${field.key}`}>
                                {field.label}
                            </Label>
                            <select
                                id={`report-${field.key}`}
                                className={selectClass}
                                value={filters[field.key]}
                                onChange={(event) =>
                                    setFilters((current) => ({
                                        ...current,
                                        [field.key]: event.target.value,
                                    }))
                                }
                            >
                                <option value="">
                                    All {field.label.toLowerCase()}s
                                </option>
                                {field.options.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="grid gap-2">
                        <Label htmlFor="report-employee-status">
                            Employee status
                        </Label>
                        <select
                            id="report-employee-status"
                            className={selectClass}
                            value={filters.employee_status}
                            onChange={(event) =>
                                setFilters((current) => ({
                                    ...current,
                                    employee_status: event.target.value as
                                        'active' | 'deactivated' | 'all',
                                }))
                            }
                        >
                            {options.employee_statuses.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={onClear}>
                        Clear filters
                    </Button>
                    <Button onClick={onApply}>Apply filters</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
