import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    BarChart3,
    BookOpenCheck,
    CheckCircle2,
    Clock3,
    FileText,
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
import type { Auth } from '@/types';

type Progress = {
    id: number;
    course_id: number;
    status: 'not_started' | 'in_progress' | 'completed';
    status_label: string;
    completed_lessons_count: number;
    total_lessons_count: number;
    progress_percent: number;
    score_percent: number | null;
    scored_questions_count: number;
    correct_questions_count: number;
    passed: boolean | null;
    last_completed_lesson_id: number | null;
    completed_at: string | null;
    updated_at: string | null;
};

type Course = {
    id: number;
    organization_id: number;
    title: string;
    slug: string;
    subject: string | null;
    description: string | null;
    estimated_minutes: number | null;
    passing_score: number | null;
    status: string;
    status_label: string;
    published_at: string | null;
    lesson_count: number;
    assignment_sources: string[];
    progress: Progress | null;
};

type TranscriptRecord = {
    id: number;
    course: Course;
    progress: Progress;
    last_completed_lesson: {
        id: number;
        title: string;
        slug: string;
    } | null;
};

type PageProps = {
    auth: Auth;
    summary: {
        total_courses: number;
        completed_courses: number;
        passed_courses: number;
        average_score_percent: number | null;
        latest_completion_at: string | null;
    };
    records: TranscriptRecord[];
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Not completed yet';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function progressBadgeVariant(status: Progress['status']) {
    switch (status) {
        case 'completed':
            return 'default';
        case 'in_progress':
            return 'outline';
        default:
            return 'secondary';
    }
}

export default function Transcript() {
    const { summary, records } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Transcript" />

            <div className="space-y-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <Heading
                            title="Training transcript"
                            description="A simple record of completed lessons, score summaries, and the latest progress pulled from the learner record."
                        />
                        <Button asChild variant="outline" className="w-fit">
                            <Link href="/dashboard">
                                <ArrowLeft className="mr-2 size-4" />
                                Back to dashboard
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Total courses</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.total_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Courses with progress records attached to your
                            account.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Completed</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.completed_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Courses marked completed in the learner flow.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Passed</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.passed_courses}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Courses where the recorded score met the passing
                            score.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Average score</CardDescription>
                            <CardTitle className="text-3xl">
                                {summary.average_score_percent !== null
                                    ? `${summary.average_score_percent}%`
                                    : 'N/A'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            The average of all saved scored checks.
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                        {records.length > 0 ? (
                            records.map((record) => {
                                const progress = record.progress;
                                const passed =
                                    progress.passed ??
                                    (progress.score_percent !== null &&
                                        record.course.passing_score !== null
                                        ? progress.score_percent >=
                                          record.course.passing_score
                                        : null);

                                return (
                                    <Card key={record.id} className="overflow-hidden">
                                        <CardHeader className="gap-3 border-b bg-gradient-to-r from-slate-50 to-white">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-xl">
                                                        {record.course.title}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {record.course.subject ||
                                                            'No subject'}{' '}
                                                        {record.course.lesson_count
                                                            ? `• ${record.course.lesson_count} lesson${record.course.lesson_count === 1 ? '' : 's'}`
                                                            : ''}
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    variant={progressBadgeVariant(
                                                        progress.status,
                                                    )}
                                                >
                                                    {progress.status_label}
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
                                                    {progress.progress_percent}%
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {progress.completed_lessons_count} of{' '}
                                                    {progress.total_lessons_count}{' '}
                                                    lessons completed
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <BadgeCheck className="size-4" />
                                                    Score
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {progress.score_percent !== null
                                                        ? `${progress.score_percent}%`
                                                        : 'N/A'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {progress.correct_questions_count} of{' '}
                                                    {progress.scored_questions_count}{' '}
                                                    checks correct
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <CheckCircle2 className="size-4" />
                                                    Result
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {passed === true
                                                        ? 'Passed'
                                                        : passed === false
                                                          ? 'Review'
                                                          : 'Pending'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {record.course.passing_score !== null
                                                        ? `Passing score ${record.course.passing_score}%`
                                                        : 'No passing score set'}
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-2xl border bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                                                    <Clock3 className="size-4" />
                                                    Last update
                                                </div>
                                                <div className="text-sm font-medium">
                                                    {formatDate(progress.updated_at)}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Last completed lesson:{' '}
                                                    {record.last_completed_lesson?.title ||
                                                        'None yet'}
                                                </div>
                                            </div>
                                        </CardContent>
                                        <div className="border-t px-6 py-4 text-sm text-muted-foreground">
                                            Completed at {formatDate(progress.completed_at)}
                                        </div>
                                    </Card>
                                );
                            })
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>No transcript yet</CardTitle>
                                    <CardDescription>
                                        Once you start completing courses, your
                                        progress and score history will appear
                                        here.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </div>

                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Transcript notes</CardTitle>
                            <CardDescription>
                                What is saved here is the same course progress
                                record the learner app uses.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <div className="rounded-2xl border border-dashed p-4">
                                <FileText className="mb-2 size-4" />
                                Progress shows completed lessons and the latest
                                course status.
                            </div>
                            <div className="rounded-2xl border border-dashed p-4">
                                <BarChart3 className="mb-2 size-4" />
                                Scores only appear when a lesson completion
                                includes a scored check summary.
                            </div>
                            <div className="rounded-2xl border border-dashed p-4">
                                <Clock3 className="mb-2 size-4" />
                                The latest completion timestamp is updated each
                                time you finish a lesson.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
