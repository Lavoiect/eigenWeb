import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenCheck,
    Clock3,
    FileText,
    ShieldCheck,
    UserX,
    Users,
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
import { deactivate as deactivateEmployee, index as organizationUsersIndex, transcript as viewTranscript } from '@/routes/organizations/users';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type UserTeam = {
    id: number;
    name: string;
};

type TrainingSummary = {
    assigned_courses: number;
    completed_courses: number;
    overdue_courses: number;
    average_score_percent: number | null;
};

type UserRow = {
    id: number;
    name: string;
    email: string;
    organization_role: 'organization_admin' | 'manager' | 'learner' | null;
    organization_role_label: string | null;
    account_status: 'active' | 'deactivated';
    account_status_label: string;
    is_current_user: boolean;
    team_assignment_mode: 'admin' | 'manager' | 'learner';
    assigned_team_ids: number[];
    filter_team_ids: number[];
    teams: UserTeam[];
    managed_teams: UserTeam[];
    training_status: 'unassigned' | 'in_progress' | 'overdue' | 'completed';
    training_status_label: string;
    training_summary: TrainingSummary;
};

type TranscriptRecord = {
    id: number;
    course: {
        id: number;
        title: string;
        slug: string;
        subject: string | null;
        lesson_count: number;
        passing_score: number | null;
        progress: {
            status: string;
            status_label: string;
            progress_percent: number;
            score_percent: number | null;
            completed_lessons_count: number;
            total_lessons_count: number;
            passed: boolean | null;
            completed_at: string | null;
            updated_at: string | null;
        };
    };
    progress: {
        status: string;
        status_label: string;
        progress_percent: number;
        score_percent: number | null;
        completed_lessons_count: number;
        total_lessons_count: number;
        passed: boolean | null;
        completed_at: string | null;
        updated_at: string | null;
    };
    last_completed_lesson: {
        id: number;
        title: string;
        slug: string;
    } | null;
};

type PathwayProgress = {
    pathway: {
        id: number;
        name: string;
        description: string | null;
    };
    completion_percent: number;
    required_item_count: number;
    completed_required_count: number;
    current_item: {
        id: number;
        item_type: 'course' | 'microlearning';
        title: string;
    } | null;
    sequential_completion: boolean;
    expected_completion_days: number | null;
    milestones: {
        id: number;
        title: string;
        description: string | null;
        threshold_percent: number;
        reached: boolean;
    }[];
};

type PageProps = {
    organization: Organization;
    user: UserRow;
    transcript: {
        summary: {
            total_courses: number;
            completed_courses: number;
            passed_courses: number;
            average_score_percent: number | null;
            latest_completion_at: string | null;
        };
        records: TranscriptRecord[];
    };
    pathway_progress: PathwayProgress | null;
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Never';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function roleBadgeVariant(role: UserRow['organization_role']) {
    switch (role) {
        case 'organization_admin':
            return 'default';
        case 'manager':
            return 'outline';
        case 'learner':
            return 'secondary';
        default:
            return 'secondary';
    }
}

function statusBadgeVariant(status: UserRow['account_status']) {
    switch (status) {
        case 'deactivated':
            return 'destructive';
        default:
            return 'secondary';
    }
}

function trainingBadgeVariant(
    status: UserRow['training_status'],
) {
    switch (status) {
        case 'completed':
            return 'default';
        case 'overdue':
            return 'destructive';
        case 'in_progress':
            return 'outline';
        default:
            return 'secondary';
    }
}

function progressBadgeVariant(status: string) {
    switch (status) {
        case 'completed':
            return 'default';
        case 'in_progress':
            return 'outline';
        default:
            return 'secondary';
    }
}

export default function EmployeeProfile() {
    const { organization, user, transcript, pathway_progress } =
        usePage<PageProps>().props;
    const assignedTeams =
        user.team_assignment_mode === 'manager'
            ? user.managed_teams
            : user.teams;

    const handleDeactivate = () => {
        if (
            !window.confirm(
                `Deactivate ${user.name}? They will not be able to log in until reactivated.`,
            )
        ) {
            return;
        }

        router.patch(
            deactivateEmployee.url({
                organization,
                user: user.id,
            }),
            {},
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <Head title={`${user.name} profile`} />

            <div className="space-y-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <Heading
                            title={user.name}
                            description="Employee profile, training summary, and transcript preview."
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="w-fit">
                                <Link href={organizationUsersIndex.url(organization)}>
                                    <ArrowLeft className="size-4" />
                                    Back to users
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-fit">
                                <Link href={viewTranscript.url({ organization, user: user.id })}>
                                    <ArrowRight className="size-4" />
                                    View transcript
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="destructive"
                        disabled={user.is_current_user || user.account_status === 'deactivated'}
                        onClick={handleDeactivate}
                    >
                        <UserX className="size-4" />
                        {user.account_status === 'deactivated'
                            ? 'Deactivated'
                            : 'Deactivate employee'}
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Role</CardDescription>
                            <CardTitle className="text-3xl">
                                {user.organization_role_label ?? 'Unassigned'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <Badge variant={roleBadgeVariant(user.organization_role)}>
                                {user.organization_role_label ?? 'Unassigned'}
                            </Badge>
                            <p>Scoped to {user.team_assignment_mode} access.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Account status</CardDescription>
                            <CardTitle className="text-3xl">
                                {user.account_status_label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <Badge variant={statusBadgeVariant(user.account_status)}>
                                {user.account_status_label}
                            </Badge>
                            <p>
                                {user.account_status === 'active'
                                    ? 'This account can sign in.'
                                    : 'This account is currently blocked from sign in.'}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Training status</CardDescription>
                            <CardTitle className="text-3xl">
                                {user.training_status_label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <Badge variant={trainingBadgeVariant(user.training_status)}>
                                {user.training_status_label}
                            </Badge>
                            <p>{user.training_summary.assigned_courses} assigned courses</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Average score</CardDescription>
                            <CardTitle className="text-3xl">
                                {user.training_summary.average_score_percent !== null
                                    ? `${user.training_summary.average_score_percent}%`
                                    : 'N/A'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p>
                                {user.training_summary.completed_courses} completed, {user.training_summary.overdue_courses} overdue
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {pathway_progress && (
                    <Card>
                        <CardHeader className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle>Pathway progress</CardTitle>
                                    <CardDescription>
                                        The pathway assigned through this
                                        employee's job title.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline">
                                    {pathway_progress.completion_percent}%
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                    {pathway_progress.completed_required_count} of{' '}
                                    {pathway_progress.required_item_count}{' '}
                                    required items complete
                                </Badge>
                                {pathway_progress.sequential_completion && (
                                    <Badge variant="secondary">
                                        Sequential completion
                                    </Badge>
                                )}
                                {pathway_progress.expected_completion_days && (
                                    <Badge variant="secondary">
                                        {pathway_progress.expected_completion_days}{' '}
                                        day window
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 lg:grid-cols-3">
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        Pathway
                                    </div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {pathway_progress.pathway.name}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {pathway_progress.pathway.description ??
                                            'No description yet.'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        Current step
                                    </div>
                                    <div className="mt-2 text-lg font-semibold">
                                        {pathway_progress.current_item?.title ??
                                            'All required items complete'}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {pathway_progress.current_item
                                            ? pathway_progress.current_item.item_type ===
                                              'course'
                                                ? 'Course'
                                                : 'Microlearning'
                                            : 'No blocker right now'}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        Milestones
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {pathway_progress.milestones.length > 0 ? (
                                            pathway_progress.milestones.map(
                                                (milestone) => (
                                                    <Badge
                                                        key={milestone.id}
                                                        variant={
                                                            milestone.reached
                                                                ? 'default'
                                                                : 'outline'
                                                        }
                                                    >
                                                        {milestone.title}
                                                    </Badge>
                                                ),
                                            )
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                No milestones yet.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Employee details</CardTitle>
                            <CardDescription>
                                Contact information, team scope, and current
                                account state.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <p className="font-medium text-foreground">Email</p>
                                <p className="text-muted-foreground">{user.email}</p>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">Teams</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {assignedTeams.length > 0 ? (
                                        assignedTeams.map((team) => (
                                            <Badge
                                                key={team.id}
                                                variant="secondary"
                                            >
                                                {team.name}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-muted-foreground">
                                            No team assignments yet.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">
                                    Current scope
                                </p>
                                <p className="text-muted-foreground">
                                    {user.team_assignment_mode === 'manager'
                                        ? 'Manager scope'
                                        : user.team_assignment_mode === 'learner'
                                          ? 'Learner scope'
                                          : 'Organization admin'}
                                </p>
                            </div>
                            <div className="rounded-xl border bg-muted/30 p-4 text-muted-foreground">
                                <p className="font-medium text-foreground">
                                    Action history
                                </p>
                                <p className="mt-2">
                                    Use the transcript view to review training
                                    progress, scores, and completion history.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Transcript preview</CardTitle>
                                <CardDescription>
                                    A quick look at the employee's saved course
                                    progress.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        <FileText className="size-4" />
                                        Courses
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {transcript.summary.total_courses}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Total transcript rows.
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        <BookOpenCheck className="size-4" />
                                        Completed
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {transcript.summary.completed_courses}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Completed courses.
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        <ShieldCheck className="size-4" />
                                        Passed
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                        {transcript.summary.passed_courses}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Passed courses.
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                        <Clock3 className="size-4" />
                                        Latest
                                    </div>
                                    <div className="mt-2 text-sm font-medium">
                                        {formatDate(
                                            transcript.summary.latest_completion_at,
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Latest completion timestamp.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {transcript.records.length > 0 ? (
                            <div className="space-y-4">
                                {transcript.records.slice(0, 3).map((record) => (
                                    <Card key={record.id} className="overflow-hidden">
                                        <CardHeader className="gap-3 border-b bg-gradient-to-r from-slate-50 to-white">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-xl">
                                                        {record.course.title}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {record.course.subject ||
                                                            'No subject'}
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    variant={progressBadgeVariant(
                                                        record.progress.status,
                                                    )}
                                                >
                                                    {record.progress.status_label}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <BookOpenCheck className="size-4" />
                                                    Progress
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {record.progress.progress_percent}%
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {record.progress.completed_lessons_count} of{' '}
                                                    {record.progress.total_lessons_count}{' '}
                                                    lessons completed
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <ShieldCheck className="size-4" />
                                                    Score
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {record.progress.score_percent !== null
                                                        ? `${record.progress.score_percent}%`
                                                        : 'N/A'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Passing score{' '}
                                                    {record.course.passing_score !== null
                                                        ? `${record.course.passing_score}%`
                                                        : 'not set'}
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <Users className="size-4" />
                                                    Result
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {record.progress.passed === true
                                                        ? 'Passed'
                                                        : record.progress.passed === false
                                                          ? 'Review'
                                                          : 'Pending'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Last completed lesson:{' '}
                                                    {record.last_completed_lesson?.title ||
                                                        'None yet'}
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <Clock3 className="size-4" />
                                                    Updated
                                                </div>
                                                <div className="text-sm font-medium">
                                                    {formatDate(
                                                        record.progress.updated_at,
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Completed at{' '}
                                                    {formatDate(
                                                        record.progress.completed_at,
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>No transcript yet</CardTitle>
                                    <CardDescription>
                                        This employee has not started a course
                                        yet.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
