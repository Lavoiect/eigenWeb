import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ExternalLink,
    FileText,
    ImageIcon,
    MessageSquarePlus,
    RotateCcw,
    Send,
    UserRound,
    Video,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { sanitizeRichTextHtml } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type ReviewUser = {
    id: number;
    name: string;
    email: string;
};

type SnapshotBlock = {
    id?: string;
    type?: string;
    [key: string]: unknown;
};

type SnapshotLesson = {
    id: number;
    title: string;
    slug: string;
    body: string | null;
    position: number;
    duration_minutes: number | null;
    is_final_assessment: boolean;
    content: SnapshotBlock[];
};

type Review = {
    id: number;
    course_id: number;
    revision_number: number;
    status: 'in_review' | 'changes_requested' | 'approved';
    status_label: string;
    content_matches: boolean;
    submitter_note: string | null;
    decision_note: string | null;
    due_at: string | null;
    submitted_at: string | null;
    decided_at: string | null;
    submitter: ReviewUser | null;
    reviewer: ReviewUser | null;
    snapshot: {
        course: {
            id: number;
            title: string;
            slug: string;
            content_type: 'course' | 'microlearning';
            subject: string | null;
            description: string | null;
            learning_objectives: string[];
            estimated_minutes: number | null;
            passing_score: number | null;
            pathway_id: number | null;
        };
        lessons: SnapshotLesson[];
    };
};

type ReviewComment = {
    id: number;
    lesson_id: number | null;
    block_id: string | null;
    body: string;
    resolved_at: string | null;
    user: Pick<ReviewUser, 'id' | 'name'> | null;
    created_at: string | null;
};

type ReviewHistoryItem = {
    id: number;
    revision_number: number;
    status: Review['status'];
    status_label: string;
    submitted_at: string | null;
    reviewer: Pick<ReviewUser, 'id' | 'name'> | null;
    url: string;
};

type Props = {
    organization: Organization;
    review: Review;
    comments: ReviewComment[];
    review_history: ReviewHistoryItem[];
    can_decide: boolean;
    can_edit_course: boolean;
};

type CommentAnchor = {
    lessonId: number | null;
    blockId: string | null;
    label: string;
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Not set';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Not set';
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function blockTitle(block: SnapshotBlock, index: number): string {
    const type = String(block.type ?? 'content');

    return (
        {
            text: 'Text',
            image: 'Image',
            video: 'Video',
            document: 'Resource',
            callout: 'Callout',
            multiple_choice: 'Multiple choice',
            true_false: 'True or false',
            ordering: 'Ordering activity',
            matching: 'Matching activity',
            scenario: 'Scenario',
        }[type] ?? `Content block ${index + 1}`
    );
}

function stringList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
}

function ReviewBlock({ block }: { block: SnapshotBlock }) {
    const type = String(block.type ?? 'text');

    if (type === 'text') {
        const richText = String(block.rich_text ?? '').trim();

        return richText ? (
            <div
                className="text-base leading-7 text-slate-800 [&_h1]:my-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{
                    __html: sanitizeRichTextHtml(richText),
                }}
            />
        ) : (
            <p className="text-base leading-7 whitespace-pre-wrap text-slate-800">
                {String(block.text ?? '').trim() || 'No text was added.'}
            </p>
        );
    }

    if (type === 'image') {
        const url = String(block.url ?? '').trim();

        return (
            <div className="space-y-3">
                {url ? (
                    <div className="flex justify-center overflow-hidden rounded-2xl border bg-slate-50 p-2">
                        <img
                            src={url}
                            alt={
                                String(block.alt ?? '').trim() || 'Course image'
                            }
                            className="max-h-[34rem] max-w-full rounded-xl object-contain"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                ) : (
                    <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-slate-500">
                        <ImageIcon className="mr-2 size-5" /> No image added
                    </div>
                )}
                {String(block.caption ?? '').trim() && (
                    <p className="text-sm leading-6 text-muted-foreground">
                        {String(block.caption).trim()}
                    </p>
                )}
            </div>
        );
    }

    if (type === 'video' || type === 'document') {
        const url = String(block.url ?? '').trim();

        return (
            <div className="flex items-center gap-4 rounded-2xl border bg-slate-50 p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                    {type === 'video' ? (
                        <Video className="size-5" />
                    ) : (
                        <FileText className="size-5" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                        {String(
                            block.title ??
                                block.caption ??
                                block.description ??
                                '',
                        ).trim() ||
                            (type === 'video'
                                ? 'Course video'
                                : 'Course resource')}
                    </p>
                    {url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
                        >
                            Open {type === 'video' ? 'video' : 'resource'}
                            <ExternalLink className="size-3.5" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    if (type === 'callout' || type === 'scenario') {
        return (
            <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-950">
                <p className="text-xs font-bold tracking-widest uppercase">
                    {type === 'scenario'
                        ? 'Scenario'
                        : String(block.style ?? 'Information')}
                </p>
                <p className="mt-2 leading-7 whitespace-pre-wrap">
                    {String(block.prompt ?? block.text ?? '').trim() ||
                        'No content added.'}
                </p>
                {String(block.guidance ?? '').trim() && (
                    <p className="mt-3 border-t border-amber-200 pt-3 text-sm">
                        {String(block.guidance).trim()}
                    </p>
                )}
            </div>
        );
    }

    if (type === 'multiple_choice') {
        return (
            <div>
                <p className="text-lg font-semibold">
                    {String(block.prompt ?? '').trim() || 'Question prompt'}
                </p>
                <div className="mt-4 grid gap-2">
                    {stringList(block.choices).map((choice, index) => (
                        <div
                            key={`${choice}-${index}`}
                            className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm"
                        >
                            <span className="flex size-7 items-center justify-center rounded-full border text-xs font-bold">
                                {String.fromCharCode(65 + index)}
                            </span>
                            {choice}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'true_false') {
        return (
            <div>
                <p className="text-lg font-semibold">
                    {String(block.statement ?? '').trim() ||
                        'True or false statement'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {['True', 'False'].map((choice) => (
                        <div
                            key={choice}
                            className="rounded-xl border bg-white px-4 py-3 text-center text-sm font-medium"
                        >
                            {choice}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'ordering') {
        return (
            <div>
                <p className="text-lg font-semibold">
                    {String(block.prompt ?? '').trim() ||
                        'Put these steps in order'}
                </p>
                <div className="mt-4 grid gap-2">
                    {stringList(block.items).map((item, index) => (
                        <div
                            key={`${item}-${index}`}
                            className="flex gap-3 rounded-xl border bg-white px-4 py-3 text-sm"
                        >
                            <span className="font-bold text-muted-foreground">
                                {index + 1}
                            </span>
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'matching') {
        const pairs = Array.isArray(block.pairs) ? block.pairs : [];

        return (
            <div>
                <p className="text-lg font-semibold">
                    {String(block.prompt ?? '').trim() || 'Match the items'}
                </p>
                <div className="mt-4 grid gap-2">
                    {pairs.map((pair, index) => {
                        const value = pair as {
                            left?: unknown;
                            right?: unknown;
                        };

                        return (
                            <div
                                key={index}
                                className="grid gap-2 rounded-xl border bg-white px-4 py-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                            >
                                <span>{String(value.left ?? '')}</span>
                                <span className="text-muted-foreground">
                                    matches
                                </span>
                                <span>{String(value.right ?? '')}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <p className="text-sm text-muted-foreground">
            This content block has no reviewer preview.
        </p>
    );
}

function reviewStatusClass(status: Review['status']): string {
    return {
        approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        changes_requested: 'border-amber-200 bg-amber-50 text-amber-900',
        in_review: 'border-sky-200 bg-sky-50 text-sky-800',
    }[status];
}

export default function CourseReviewPage({
    organization,
    review,
    comments,
    review_history,
    can_decide,
    can_edit_course,
}: Props) {
    const lessons = review.snapshot.lessons;
    const [selectedLessonId, setSelectedLessonId] = useState<number | null>(
        lessons[0]?.id ?? null,
    );
    const [commentAnchor, setCommentAnchor] = useState<CommentAnchor>({
        lessonId: null,
        blockId: null,
        label: 'Course overview',
    });
    const [commentBody, setCommentBody] = useState('');
    const [decisionNote, setDecisionNote] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const selectedLesson =
        lessons.find((lesson) => lesson.id === selectedLessonId) ??
        lessons[0] ??
        null;
    const commentCounts = useMemo(
        () =>
            comments.reduce<Record<string, number>>((counts, comment) => {
                const key = `${comment.lesson_id ?? 'course'}:${comment.block_id ?? 'all'}`;
                counts[key] = (counts[key] ?? 0) + 1;

                return counts;
            }, {}),
        [comments],
    );

    const submitComment = () => {
        if (!commentBody.trim()) {
            setErrors({ body: 'Add a comment before posting.' });

            return;
        }

        setProcessing(true);
        setErrors({});
        router.post(
            `/organizations/${organization.id}/course-reviews/${review.id}/comments`,
            {
                body: commentBody.trim(),
                lesson_id: commentAnchor.lessonId,
                block_id: commentAnchor.blockId,
            },
            {
                preserveScroll: true,
                onSuccess: () => setCommentBody(''),
                onError: (nextErrors) =>
                    setErrors(nextErrors as Record<string, string>),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const makeDecision = (decision: 'approved' | 'changes_requested') => {
        if (decision === 'changes_requested' && !decisionNote.trim()) {
            setErrors({
                note: 'Explain what the author should change.',
            });

            return;
        }

        setProcessing(true);
        setErrors({});
        router.patch(
            `/organizations/${organization.id}/course-reviews/${review.id}/decision`,
            {
                decision,
                note: decisionNote.trim() || null,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) =>
                    setErrors(nextErrors as Record<string, string>),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <>
            <Head title={`Review ${review.snapshot.course.title}`} />

            <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <Button asChild variant="ghost" size="icon">
                            <Link
                                href={
                                    can_edit_course
                                        ? `/organizations/${organization.id}/courses/${review.course_id}`
                                        : '/dashboard'
                                }
                                aria-label="Back"
                            >
                                <ArrowLeft className="size-4" />
                            </Link>
                        </Button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    {review.snapshot.course.title}
                                </h1>
                                <Badge
                                    variant="outline"
                                    className={reviewStatusClass(review.status)}
                                >
                                    {review.status_label}
                                </Badge>
                                <Badge variant="outline">
                                    Revision {review.revision_number}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Frozen review copy submitted by{' '}
                                {review.submitter?.name ?? 'Unknown author'} on{' '}
                                {formatDate(review.submitted_at)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                            <UserRound className="size-4 text-muted-foreground" />
                            {review.reviewer?.name ?? 'Reviewer unavailable'}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                            <CalendarDays className="size-4 text-muted-foreground" />
                            Due {formatDate(review.due_at)}
                        </span>
                    </div>
                </div>

                {!review.content_matches && (
                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-semibold">
                                The working course has changed
                            </p>
                            <p className="mt-1 leading-6">
                                You are reviewing the frozen submitted revision.
                                The author must send the latest changes through
                                review again before publishing.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
                    <Card className="h-fit xl:sticky xl:top-5">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Course outline
                            </CardTitle>
                            <CardDescription>
                                {lessons.length}{' '}
                                {lessons.length === 1 ? 'lesson' : 'lessons'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            {lessons.map((lesson, index) => (
                                <button
                                    key={lesson.id}
                                    type="button"
                                    onClick={() =>
                                        setSelectedLessonId(lesson.id)
                                    }
                                    className={cn(
                                        'rounded-xl border px-3 py-3 text-left transition-colors',
                                        selectedLesson?.id === lesson.id
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'hover:bg-muted/50',
                                    )}
                                >
                                    <span className="block text-xs font-semibold opacity-70">
                                        {lesson.is_final_assessment
                                            ? 'Final assessment'
                                            : `Lesson ${index + 1}`}
                                    </span>
                                    <span className="mt-1 block text-sm font-semibold">
                                        {lesson.title}
                                    </span>
                                </button>
                            ))}
                            {review_history.length > 1 && (
                                <div className="mt-3 space-y-2 border-t pt-4">
                                    <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                                        Revision history
                                    </p>
                                    {review_history.map((item) => (
                                        <Link
                                            key={item.id}
                                            href={item.url}
                                            className={cn(
                                                'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
                                                item.id === review.id &&
                                                    'border-primary bg-primary/5',
                                            )}
                                        >
                                            <span>
                                                Revision {item.revision_number}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.status_label}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader className="border-b">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <CardDescription>
                                        {selectedLesson?.is_final_assessment
                                            ? 'Final assessment'
                                            : `Lesson ${selectedLesson?.position ?? ''}`}
                                    </CardDescription>
                                    <CardTitle className="mt-1 text-2xl">
                                        {selectedLesson?.title ??
                                            'No lessons added'}
                                    </CardTitle>
                                </div>
                                {selectedLesson?.duration_minutes && (
                                    <Badge variant="outline">
                                        {selectedLesson.duration_minutes} min
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            {!selectedLesson ? (
                                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                                    This revision has no lessons.
                                </div>
                            ) : selectedLesson.content.length === 0 ? (
                                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                                    This lesson has no content blocks.
                                </div>
                            ) : (
                                selectedLesson.content.map((block, index) => {
                                    const id = String(
                                        block.id ?? `block-${index + 1}`,
                                    );
                                    const key = `${selectedLesson.id}:${id}`;

                                    return (
                                        <section
                                            key={id}
                                            className="rounded-2xl border bg-muted/20 p-4 sm:p-5"
                                        >
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <p className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
                                                    {blockTitle(block, index)}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setCommentAnchor({
                                                            lessonId:
                                                                selectedLesson.id,
                                                            blockId: id,
                                                            label: `${selectedLesson.title}: ${blockTitle(block, index)}`,
                                                        })
                                                    }
                                                >
                                                    <MessageSquarePlus className="size-4" />
                                                    Comment
                                                    {commentCounts[key]
                                                        ? ` (${commentCounts[key]})`
                                                        : ''}
                                                </Button>
                                            </div>
                                            <ReviewBlock block={block} />
                                        </section>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
                        {review.submitter_note && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Author note
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                                        {review.submitter_note}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-base">
                                        Review comments
                                    </CardTitle>
                                    <Badge variant="secondary">
                                        {comments.length}
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Comment on the course, a lesson, or a
                                    specific block.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border bg-muted/30 p-3 text-xs">
                                    <span className="font-semibold">
                                        Commenting on:
                                    </span>{' '}
                                    {commentAnchor.label}
                                    {commentAnchor.lessonId !== null && (
                                        <button
                                            type="button"
                                            className="ml-2 font-semibold text-primary hover:underline"
                                            onClick={() =>
                                                setCommentAnchor({
                                                    lessonId: null,
                                                    blockId: null,
                                                    label: 'Course overview',
                                                })
                                            }
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="review-comment">
                                        Comment
                                    </Label>
                                    <textarea
                                        id="review-comment"
                                        value={commentBody}
                                        onChange={(event) =>
                                            setCommentBody(event.target.value)
                                        }
                                        rows={4}
                                        placeholder="Share clear, actionable feedback..."
                                        className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <InputError message={errors.body} />
                                </div>
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={submitComment}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Spinner />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                    Post comment
                                </Button>

                                <div className="max-h-80 space-y-3 overflow-y-auto border-t pt-4">
                                    {comments.length === 0 ? (
                                        <p className="py-4 text-center text-sm text-muted-foreground">
                                            No comments yet.
                                        </p>
                                    ) : (
                                        [...comments]
                                            .reverse()
                                            .map((comment) => {
                                                const lesson = lessons.find(
                                                    (item) =>
                                                        item.id ===
                                                        comment.lesson_id,
                                                );
                                                const anchor = comment.block_id
                                                    ? `${lesson?.title ?? 'Lesson'} · Content block`
                                                    : (lesson?.title ??
                                                      'Course overview');

                                                return (
                                                    <div
                                                        key={comment.id}
                                                        className="rounded-xl border p-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 text-xs">
                                                            <span className="font-semibold">
                                                                {comment.user
                                                                    ?.name ??
                                                                    'Former user'}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {formatDate(
                                                                    comment.created_at,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs font-medium text-emerald-700">
                                                            {anchor}
                                                        </p>
                                                        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                                                            {comment.body}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {(can_decide || review.decision_note) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Decision
                                    </CardTitle>
                                    <CardDescription>
                                        {review.status === 'in_review'
                                            ? 'Leave an optional approval note or explain required changes.'
                                            : `This revision is ${review.status_label.toLowerCase()}.`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {review.status === 'in_review' &&
                                    can_decide ? (
                                        <>
                                            <textarea
                                                value={decisionNote}
                                                onChange={(event) =>
                                                    setDecisionNote(
                                                        event.target.value,
                                                    )
                                                }
                                                rows={4}
                                                placeholder="Decision note..."
                                                className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                            <InputError
                                                message={
                                                    errors.note ??
                                                    errors.decision
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full border-amber-300 text-amber-900 hover:bg-amber-50"
                                                onClick={() =>
                                                    makeDecision(
                                                        'changes_requested',
                                                    )
                                                }
                                                disabled={processing}
                                            >
                                                <RotateCcw className="size-4" />
                                                Request changes
                                            </Button>
                                            <Button
                                                type="button"
                                                className="w-full bg-emerald-700 hover:bg-emerald-800"
                                                onClick={() =>
                                                    makeDecision('approved')
                                                }
                                                disabled={processing}
                                            >
                                                {processing ? (
                                                    <Spinner />
                                                ) : (
                                                    <CheckCircle2 className="size-4" />
                                                )}
                                                Approve revision
                                            </Button>
                                        </>
                                    ) : (
                                        <div
                                            className={cn(
                                                'rounded-xl border p-3 text-sm',
                                                reviewStatusClass(
                                                    review.status,
                                                ),
                                            )}
                                        >
                                            <p className="font-semibold">
                                                {review.status_label}
                                            </p>
                                            {review.decision_note && (
                                                <p className="mt-2 leading-6 whitespace-pre-wrap">
                                                    {review.decision_note}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
