import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Award,
    BookOpenCheck,
    CalendarClock,
    CheckCircle2,
    Clock3,
    Download,
    ExternalLink,
    GraduationCap,
    ListChecks,
    ShieldCheck,
} from 'lucide-react';

import Heading from '@/components/heading';
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
    index as organizationUsersIndex,
    show as showEmployee,
} from '@/routes/organizations/users';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type TrainingProgress = {
    status: 'not_started' | 'in_progress' | 'completed';
    status_label: string;
    completed_lessons_count: number;
    total_lessons_count: number;
    progress_percent: number;
    score_percent: number | null;
    scored_questions_count: number;
    correct_questions_count: number;
    passed: boolean | null;
    completed_at: string | null;
    updated_at: string | null;
};

type TrainingRecord = {
    id: number;
    course: {
        id: number;
        title: string;
        slug: string;
        subject: string | null;
        lesson_count: number;
        estimated_minutes: number | null;
        passing_score: number | null;
    };
    status: 'completed' | 'overdue' | 'in_progress' | 'assigned';
    status_label: string;
    due_at: string | null;
    assigned_at: string | null;
    is_required: boolean;
    assignment_sources: string[];
    progress: TrainingProgress | null;
    last_completed_lesson: {
        id: number;
        title: string;
        slug: string;
    } | null;
    completed_at: string | null;
    certificate: {
        view_url: string;
        download_url: string;
    } | null;
};

type PageProps = {
    organization: Organization;
    user: {
        id: number;
        name: string;
        email: string;
        organization_role_label: string | null;
        account_status_label: string;
    };
    training: {
        summary: {
            completed_courses: number;
            assigned_courses: number;
            overdue_courses: number;
            average_score_percent: number | null;
        };
        completed: TrainingRecord[];
        assigned: TrainingRecord[];
        overdue: TrainingRecord[];
    };
};

function formatDate(value: string | null, fallback = 'Not set'): string {
    if (!value) {
        return fallback;
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

function overdueLabel(value: string | null): string {
    if (!value) {
        return 'Overdue';
    }

    const elapsed = Date.now() - new Date(value).getTime();
    const days = Math.max(1, Math.floor(elapsed / 86_400_000));

    return days + ' day' + (days === 1 ? '' : 's') + ' overdue';
}

function ProgressBar({
    value,
    tone = 'default',
}: {
    value: number;
    tone?: 'default' | 'danger' | 'success';
}) {
    const barColor = {
        default: 'bg-sky-500',
        danger: 'bg-red-500',
        success: 'bg-emerald-500',
    }[tone];

    return (
        <div
            className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            aria-label={value + '% complete'}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
        >
            <div
                className={'h-full rounded-full ' + barColor}
                style={{
                    width: Math.min(100, Math.max(0, value)) + '%',
                }}
            />
        </div>
    );
}

function CourseMeta({ record }: { record: TrainingRecord }) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
                <BookOpenCheck className="size-4" />
                {record.course.lesson_count}{' '}
                {record.course.lesson_count === 1 ? 'lesson' : 'lessons'}
            </span>
            {record.course.estimated_minutes ? (
                <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-4" />
                    About {record.course.estimated_minutes} min
                </span>
            ) : null}
            {record.assignment_sources.map((source) => (
                <Badge key={source} variant="secondary">
                    {source}
                </Badge>
            ))}
            {record.is_required ? (
                <Badge variant="outline">Required</Badge>
            ) : null}
        </div>
    );
}

function ActiveTrainingCard({
    record,
    overdue = false,
}: {
    record: TrainingRecord;
    overdue?: boolean;
}) {
    const progress = record.progress?.progress_percent ?? 0;

    return (
        <Card
            className={
                overdue
                    ? 'overflow-hidden border-red-200 bg-red-50/40 dark:border-red-950 dark:bg-red-950/15'
                    : 'overflow-hidden'
            }
        >
            <CardContent className="p-0">
                <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_190px] md:items-center md:p-6">
                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-lg font-semibold text-foreground">
                                    {record.course.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {record.course.subject ||
                                        'General training'}
                                </p>
                            </div>
                            <Badge
                                variant={overdue ? 'destructive' : 'outline'}
                                className={
                                    overdue
                                        ? undefined
                                        : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                                }
                            >
                                {overdue ? (
                                    <AlertTriangle className="size-3" />
                                ) : (
                                    <ListChecks className="size-3" />
                                )}
                                {record.status_label}
                            </Badge>
                        </div>

                        <CourseMeta record={record} />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <span className="font-medium">
                                    {progress}% complete
                                </span>
                                <span className="text-muted-foreground">
                                    {record.progress
                                        ? record.progress
                                              .completed_lessons_count +
                                          '/' +
                                          record.progress.total_lessons_count +
                                          ' lessons'
                                        : 'Not started'}
                                </span>
                            </div>
                            <ProgressBar
                                value={progress}
                                tone={overdue ? 'danger' : 'default'}
                            />
                        </div>
                    </div>

                    <div
                        className={
                            'rounded-xl border p-4 ' +
                            (overdue
                                ? 'border-red-200 bg-white/80 dark:border-red-900 dark:bg-red-950/30'
                                : 'bg-muted/30')
                        }
                    >
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            <CalendarClock className="size-4" />
                            Due date
                        </div>
                        <p
                            className={
                                'mt-2 font-semibold ' +
                                (overdue
                                    ? 'text-red-700 dark:text-red-300'
                                    : '')
                            }
                        >
                            {formatDate(record.due_at)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {overdue
                                ? overdueLabel(record.due_at)
                                : record.due_at
                                  ? 'Upcoming deadline'
                                  : 'No deadline assigned'}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CompletedTrainingCard({ record }: { record: TrainingRecord }) {
    const score = record.progress?.score_percent;
    const passed = record.progress?.passed;

    return (
        <Card className="overflow-hidden border-emerald-200/80 dark:border-emerald-950">
            <CardContent className="p-0">
                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center lg:p-6">
                    <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate text-lg font-semibold">
                                    {record.course.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Completed {formatDate(record.completed_at)}
                                </p>
                            </div>
                        </div>
                        <CourseMeta record={record} />
                    </div>

                    <div className="rounded-xl border bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                        <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">
                            Final score
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                            {score !== null && score !== undefined
                                ? score + '%'
                                : 'Complete'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {passed === true
                                ? 'Passing requirements met'
                                : passed === false
                                  ? 'Completion recorded'
                                  : 'No scored assessment'}
                        </p>
                    </div>

                    {record.certificate ? (
                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={record.certificate.view_url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="size-4" />
                                    View certificate
                                </a>
                            </Button>
                            <Button asChild size="sm">
                                <a href={record.certificate.download_url}>
                                    <Download className="size-4" />
                                    Download
                                </a>
                            </Button>
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function EmptySection({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof CheckCircle2;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
            <Icon className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 font-medium">{title}</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

export default function EmployeeTranscript() {
    const { organization, user, training } = usePage<PageProps>().props;

    return (
        <>
            <Head title={user.name + ' transcript'} />

            <div className="m-5 space-y-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                        <Heading
                            title={user.name + "'s training"}
                            description="See what is overdue, what is currently assigned, and every completed course in one place."
                        />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                                {user.email}
                            </span>
                            {user.organization_role_label ? (
                                <Badge variant="secondary">
                                    {user.organization_role_label}
                                </Badge>
                            ) : null}
                            <Badge variant="outline">
                                {user.account_status_label}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link
                                href={organizationUsersIndex.url(organization)}
                            >
                                <ArrowLeft className="size-4" />
                                Users
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link
                                href={showEmployee.url({
                                    organization,
                                    user: user.id,
                                })}
                            >
                                Employee profile
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-emerald-200/80 dark:border-emerald-950">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardDescription>Completed</CardDescription>
                                <CheckCircle2 className="size-5 text-emerald-600" />
                            </div>
                            <CardTitle className="text-3xl">
                                {training.summary.completed_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Finished courses with completion records.
                        </CardContent>
                    </Card>

                    <Card className="border-sky-200/80 dark:border-sky-950">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardDescription>Assigned</CardDescription>
                                <ListChecks className="size-5 text-sky-600" />
                            </div>
                            <CardTitle className="text-3xl">
                                {training.summary.assigned_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Current and upcoming training.
                        </CardContent>
                    </Card>

                    <Card
                        className={
                            training.summary.overdue_courses > 0
                                ? 'border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/15'
                                : ''
                        }
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardDescription>Overdue</CardDescription>
                                <AlertTriangle
                                    className={
                                        'size-5 ' +
                                        (training.summary.overdue_courses > 0
                                            ? 'text-red-600'
                                            : 'text-muted-foreground')
                                    }
                                />
                            </div>
                            <CardTitle
                                className={
                                    'text-3xl ' +
                                    (training.summary.overdue_courses > 0
                                        ? 'text-red-700 dark:text-red-300'
                                        : '')
                                }
                            >
                                {training.summary.overdue_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Assignments past their due date.
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardDescription>Average score</CardDescription>
                                <Award className="size-5 text-amber-600" />
                            </div>
                            <CardTitle className="text-3xl">
                                {training.summary.average_score_percent !== null
                                    ? training.summary.average_score_percent +
                                      '%'
                                    : 'N/A'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Average score across completed courses.
                        </CardContent>
                    </Card>
                </div>

                <section
                    className="space-y-4"
                    aria-labelledby="overdue-heading"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="size-5 text-red-600" />
                            <h2
                                id="overdue-heading"
                                className="text-xl font-semibold"
                            >
                                Overdue training
                            </h2>
                            {training.overdue.length > 0 ? (
                                <Badge variant="destructive">
                                    {training.overdue.length}
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Past-due assignments that need attention first.
                        </p>
                    </div>

                    {training.overdue.length > 0 ? (
                        <div className="space-y-3">
                            {training.overdue.map((record) => (
                                <ActiveTrainingCard
                                    key={record.id}
                                    record={record}
                                    overdue
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptySection
                            icon={ShieldCheck}
                            title="Nothing overdue"
                            description="This employee has no assignments past their due date."
                        />
                    )}
                </section>

                <section
                    className="space-y-4"
                    aria-labelledby="assigned-heading"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <ListChecks className="size-5 text-sky-600" />
                            <h2
                                id="assigned-heading"
                                className="text-xl font-semibold"
                            >
                                Assigned training
                            </h2>
                            <Badge variant="secondary">
                                {training.assigned.length}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Upcoming and in-progress courses, ordered by due
                            date.
                        </p>
                    </div>

                    {training.assigned.length > 0 ? (
                        <div className="space-y-3">
                            {training.assigned.map((record) => (
                                <ActiveTrainingCard
                                    key={record.id}
                                    record={record}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptySection
                            icon={CalendarClock}
                            title="No active assignments"
                            description="Newly assigned courses and training in progress will appear here."
                        />
                    )}
                </section>

                <section
                    className="space-y-4"
                    aria-labelledby="completed-heading"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <GraduationCap className="size-5 text-emerald-600" />
                            <h2
                                id="completed-heading"
                                className="text-xl font-semibold"
                            >
                                Completed training
                            </h2>
                            <Badge variant="secondary">
                                {training.completed.length}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Verified completion history with certificate access.
                        </p>
                    </div>

                    {training.completed.length > 0 ? (
                        <div className="space-y-3">
                            {training.completed.map((record) => (
                                <CompletedTrainingCard
                                    key={record.id}
                                    record={record}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptySection
                            icon={Award}
                            title="No completed courses yet"
                            description="Completed courses and downloadable certificates will appear here."
                        />
                    )}
                </section>
            </div>
        </>
    );
}
