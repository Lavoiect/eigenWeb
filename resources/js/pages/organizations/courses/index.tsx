import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Archive,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Copy,
    Ellipsis,
    Eye,
    FileUp,
    Layers3,
    Milestone,
    Pencil,
    Plus,
    Route,
    Search,
    Sparkles,
    Trash2,
    Upload,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type CourseStatus = 'draft' | 'published' | 'archived';
type CourseType = 'course' | 'microlearning';
type CreateMode = CourseType | 'import';
type SortOption =
    | 'recently_updated'
    | 'title'
    | 'most_assigned'
    | 'lowest_completion'
    | 'drafts_first';

type CourseRow = {
    id: number;
    pathway_id: number | null;
    content_type: CourseType;
    pathway: {
        id: number;
        name: string;
        description: string | null;
    } | null;
    title: string;
    subject: string | null;
    description: string | null;
    estimated_minutes: number | null;
    status: CourseStatus;
    status_label: string;
    lesson_count: number;
    assignment_count: number;
    assigned_count: number;
    completed_count: number;
    completion_rate: number | null;
    assessment_count: number;
    health: {
        tone: 'ready' | 'warning' | 'neutral';
        label: string;
        issue_count: number;
        view: 'build' | 'settings';
    };
    can_delete: boolean;
    delete_block_reason: string | null;
    updated_at: string | null;
};

type PathwayOption = {
    id: number;
    name: string;
    description: string | null;
    sequential_completion: boolean;
    expected_completion_days: number | null;
    course_count: number;
    item_count: number;
    milestone_count: number;
    job_title_count: number;
    employee_count: number;
};

type PageProps = {
    auth: Auth;
    organization: Organization;
    microlearning_templates: {
        key: string;
        label: string;
        description: string;
        duration_minutes: number;
    }[];
    pathways: PathwayOption[];
    courses: CourseRow[];
    active_tab: 'courses' | 'pathways';
};

const selectClassName =
    'h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function statusVariant(status: CourseStatus) {
    if (status === 'published') {
        return 'default';
    }

    if (status === 'archived') {
        return 'secondary';
    }

    return 'outline';
}

function contentTypeLabel(contentType: CourseType) {
    return contentType === 'microlearning' ? 'Microlearning' : 'Full course';
}

function formatUpdatedAt(value: string | null) {
    if (value === null) {
        return 'Not updated yet';
    }

    return `Updated ${new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year:
            new Date(value).getFullYear() === new Date().getFullYear()
                ? undefined
                : 'numeric',
    }).format(new Date(value))}`;
}

function CreateFormatCard({
    active,
    description,
    icon,
    onClick,
    title,
}: {
    active: boolean;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group relative flex min-h-40 flex-col items-start rounded-xl border p-5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active && 'border-primary bg-primary/5 ring-1 ring-primary',
            )}
        >
            <span
                className={cn(
                    'mb-5 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground',
                    active && 'bg-primary text-primary-foreground',
                )}
            >
                {icon}
            </span>
            <span className="font-semibold">{title}</span>
            <span className="mt-1 text-sm leading-5 text-muted-foreground">
                {description}
            </span>
            {active && (
                <span className="absolute top-4 right-4 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                </span>
            )}
        </button>
    );
}

export default function OrganizationCoursesIndex() {
    const {
        organization,
        pathways,
        courses,
        microlearning_templates,
        active_tab: activeTab,
    } = usePage<PageProps>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | CourseStatus>(
        'all',
    );
    const [typeFilter, setTypeFilter] = useState<'all' | CourseType>('all');
    const [pathwayFilter, setPathwayFilter] = useState<'all' | 'none' | string>(
        'all',
    );
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [sortBy, setSortBy] = useState<SortOption>('recently_updated');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState<'format' | 'details'>(
        'format',
    );
    const [createMode, setCreateMode] = useState<CreateMode>('course');
    const [starterTemplate, setStarterTemplate] = useState(
        microlearning_templates[0]?.key ?? 'quick_policy_refresher',
    );
    const [pathwayCourse, setPathwayCourse] = useState<CourseRow | null>(null);
    const [pathwaySearch, setPathwaySearch] = useState('');
    const [pathwayModalOpen, setPathwayModalOpen] = useState(false);

    const counts = useMemo(
        () => ({
            all: courses.length,
            published: courses.filter((course) => course.status === 'published')
                .length,
            draft: courses.filter((course) => course.status === 'draft').length,
            archived: courses.filter((course) => course.status === 'archived')
                .length,
        }),
        [courses],
    );

    const subjects = useMemo(
        () =>
            [
                ...new Set(
                    courses.map((course) => course.subject).filter(Boolean),
                ),
            ].sort((left, right) =>
                String(left).localeCompare(String(right)),
            ) as string[],
        [courses],
    );

    const hasFilters =
        searchQuery.trim() !== '' ||
        statusFilter !== 'all' ||
        typeFilter !== 'all' ||
        pathwayFilter !== 'all' ||
        subjectFilter !== 'all';

    const visibleCourses = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return [...courses]
            .filter((course) => {
                if (statusFilter !== 'all' && course.status !== statusFilter) {
                    return false;
                }

                if (
                    typeFilter !== 'all' &&
                    course.content_type !== typeFilter
                ) {
                    return false;
                }

                if (pathwayFilter === 'none' && course.pathway_id !== null) {
                    return false;
                }

                if (
                    pathwayFilter !== 'all' &&
                    pathwayFilter !== 'none' &&
                    String(course.pathway_id ?? '') !== pathwayFilter
                ) {
                    return false;
                }

                if (
                    subjectFilter !== 'all' &&
                    course.subject !== subjectFilter
                ) {
                    return false;
                }

                if (normalizedQuery === '') {
                    return true;
                }

                return [
                    course.title,
                    course.subject,
                    course.description,
                    course.pathway?.name,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedQuery);
            })
            .sort((left, right) => {
                if (sortBy === 'title') {
                    return left.title.localeCompare(right.title);
                }

                if (sortBy === 'most_assigned') {
                    return (
                        right.assigned_count - left.assigned_count ||
                        left.title.localeCompare(right.title)
                    );
                }

                if (sortBy === 'lowest_completion') {
                    return (
                        (left.completion_rate ?? 101) -
                            (right.completion_rate ?? 101) ||
                        left.title.localeCompare(right.title)
                    );
                }

                if (sortBy === 'drafts_first') {
                    return (
                        Number(right.status === 'draft') -
                            Number(left.status === 'draft') ||
                        new Date(right.updated_at ?? 0).getTime() -
                            new Date(left.updated_at ?? 0).getTime()
                    );
                }

                return (
                    new Date(right.updated_at ?? 0).getTime() -
                    new Date(left.updated_at ?? 0).getTime()
                );
            });
    }, [
        courses,
        pathwayFilter,
        searchQuery,
        sortBy,
        statusFilter,
        subjectFilter,
        typeFilter,
    ]);

    const visiblePathways = useMemo(() => {
        const query = pathwaySearch.trim().toLowerCase();

        if (query === '') {
            return pathways;
        }

        return pathways.filter((pathway) =>
            `${pathway.name} ${pathway.description ?? ''}`
                .toLowerCase()
                .includes(query),
        );
    }, [pathwaySearch, pathways]);

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setTypeFilter('all');
        setPathwayFilter('all');
        setSubjectFilter('all');
    };

    const openCreateModal = (mode: CreateMode = 'course') => {
        setCreateMode(mode);
        setCreateStep(mode === 'import' ? 'details' : 'format');
        setCreateModalOpen(true);
    };

    const handleDuplicate = (course: CourseRow) => {
        router.post(
            `/organizations/${organization.id}/courses/${course.id}/duplicate`,
        );
    };

    const handleArchive = (course: CourseRow) => {
        if (
            !window.confirm(
                `Archive ${course.title}? Learner history will be preserved, but the course will be hidden from learners.`,
            )
        ) {
            return;
        }

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/archive`,
            {},
            { preserveScroll: true },
        );
    };

    const handleDelete = (course: CourseRow) => {
        if (!course.can_delete) {
            return;
        }

        if (
            !window.confirm(
                `Permanently delete ${course.title}? This cannot be undone.`,
            )
        ) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/courses/${course.id}`,
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={`${organization.name} training`} />

            <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            {organization.name}
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Training
                        </h1>
                        <p className="text-sm text-muted-foreground sm:text-base">
                            Build courses and organize role-based learning
                            pathways delivered through the employee app.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeTab === 'courses' ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => openCreateModal('import')}
                                >
                                    <Upload className="size-4" />
                                    Import content
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => openCreateModal('course')}
                                >
                                    <Plus className="size-4" />
                                    Create course
                                </Button>
                            </>
                        ) : (
                            <Button
                                type="button"
                                onClick={() => setPathwayModalOpen(true)}
                            >
                                <Plus className="size-4" />
                                Create pathway
                            </Button>
                        )}
                    </div>
                </header>

                <nav
                    aria-label="Training sections"
                    className="flex gap-1 border-b"
                >
                    {(
                        [
                            ['courses', 'Courses', courses.length],
                            ['pathways', 'Pathways', pathways.length],
                        ] as const
                    ).map(([value, label, count]) => (
                        <Link
                            key={value}
                            href={`/organizations/${organization.id}/courses${value === 'pathways' ? '?tab=pathways' : ''}`}
                            preserveScroll
                            className={cn(
                                '-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
                                activeTab === value
                                    ? 'border-foreground text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                            <span
                                className={cn(
                                    'rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums',
                                    activeTab === value &&
                                        'bg-foreground text-background',
                                )}
                            >
                                {count}
                            </span>
                        </Link>
                    ))}
                </nav>

                <nav
                    aria-label="Course status"
                    className={cn(
                        'flex gap-1 overflow-x-auto border-b',
                        activeTab !== 'courses' && 'hidden',
                    )}
                >
                    {(
                        [
                            ['all', 'All', counts.all],
                            ['published', 'Published', counts.published],
                            ['draft', 'Drafts', counts.draft],
                            ['archived', 'Archived', counts.archived],
                        ] as const
                    ).map(([value, label, count]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setStatusFilter(value)}
                            className={cn(
                                '-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors',
                                statusFilter === value
                                    ? 'border-foreground text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                            <span
                                className={cn(
                                    'rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums',
                                    statusFilter === value &&
                                        'bg-foreground text-background',
                                )}
                            >
                                {count}
                            </span>
                        </button>
                    ))}
                </nav>

                <Card
                    className={cn(
                        'overflow-hidden py-0',
                        activeTab !== 'courses' && 'hidden',
                    )}
                >
                    <CardContent className="p-0">
                        <div className="grid gap-3 border-b bg-muted/25 p-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.8fr)_minmax(140px,.7fr)_minmax(150px,.8fr)_minmax(140px,.7fr)_minmax(190px,.9fr)]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    aria-label="Search courses"
                                    value={searchQuery}
                                    onChange={(event) =>
                                        setSearchQuery(event.target.value)
                                    }
                                    className="h-10 bg-background pl-9"
                                    placeholder="Search courses"
                                />
                            </div>
                            <select
                                aria-label="Filter by type"
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(
                                        event.target.value as
                                            'all' | CourseType,
                                    )
                                }
                                className={selectClassName}
                            >
                                <option value="all">All types</option>
                                <option value="course">Full course</option>
                                <option value="microlearning">
                                    Microlearning
                                </option>
                            </select>
                            <select
                                aria-label="Filter by pathway"
                                value={pathwayFilter}
                                onChange={(event) =>
                                    setPathwayFilter(event.target.value)
                                }
                                className={selectClassName}
                            >
                                <option value="all">All pathways</option>
                                <option value="none">No pathway</option>
                                {pathways.map((pathway) => (
                                    <option key={pathway.id} value={pathway.id}>
                                        {pathway.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                aria-label="Filter by subject"
                                value={subjectFilter}
                                onChange={(event) =>
                                    setSubjectFilter(event.target.value)
                                }
                                className={selectClassName}
                            >
                                <option value="all">All subjects</option>
                                {subjects.map((subject) => (
                                    <option key={subject} value={subject}>
                                        {subject}
                                    </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <select
                                    aria-label="Sort courses"
                                    value={sortBy}
                                    onChange={(event) =>
                                        setSortBy(
                                            event.target.value as SortOption,
                                        )
                                    }
                                    className={cn(
                                        selectClassName,
                                        'min-w-0 flex-1',
                                    )}
                                >
                                    <option value="recently_updated">
                                        Recently updated
                                    </option>
                                    <option value="title">Title A-Z</option>
                                    <option value="most_assigned">
                                        Most assigned
                                    </option>
                                    <option value="lowest_completion">
                                        Lowest completion
                                    </option>
                                    <option value="drafts_first">
                                        Drafts first
                                    </option>
                                </select>
                                {hasFilters && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={resetFilters}
                                        aria-label="Clear filters"
                                        title="Clear filters"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {visibleCourses.length === 0 ? (
                            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
                                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                    <BookOpen className="size-6" />
                                </span>
                                <h2 className="font-semibold">
                                    {courses.length === 0
                                        ? 'Create your first training course'
                                        : 'No courses match these filters'}
                                </h2>
                                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                                    {courses.length === 0
                                        ? 'Build structured onboarding, short microlearning, assessments, and procedure training for your workforce.'
                                        : 'Try a different search or clear the current filters to see the full library.'}
                                </p>
                                <div className="mt-5 flex flex-wrap justify-center gap-2">
                                    {courses.length === 0 ? (
                                        <>
                                            <Button
                                                type="button"
                                                onClick={() =>
                                                    openCreateModal('course')
                                                }
                                            >
                                                <Plus className="size-4" />
                                                Create course
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    openCreateModal('import')
                                                }
                                            >
                                                <Upload className="size-4" />
                                                Upload existing content
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={resetFilters}
                                        >
                                            Clear filters
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {visibleCourses.map((course) => {
                                    const courseUrl = `/organizations/${organization.id}/courses/${course.id}`;

                                    return (
                                        <article
                                            key={course.id}
                                            className="group p-4 transition-colors hover:bg-muted/20 sm:p-5"
                                        >
                                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                                                <div className="flex min-w-0 flex-1 gap-4">
                                                    <Link
                                                        href={courseUrl}
                                                        aria-label={`Edit ${course.title}`}
                                                        className={cn(
                                                            'hidden size-20 shrink-0 items-center justify-center rounded-xl sm:flex',
                                                            course.content_type ===
                                                                'microlearning'
                                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
                                                        )}
                                                    >
                                                        {course.content_type ===
                                                        'microlearning' ? (
                                                            <Sparkles className="size-7" />
                                                        ) : (
                                                            <BookOpen className="size-7" />
                                                        )}
                                                    </Link>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Link
                                                                href={courseUrl}
                                                                className="truncate text-base font-semibold hover:underline"
                                                            >
                                                                {course.title}
                                                            </Link>
                                                            <Badge
                                                                variant={statusVariant(
                                                                    course.status,
                                                                )}
                                                            >
                                                                {
                                                                    course.status_label
                                                                }
                                                            </Badge>
                                                        </div>

                                                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                                            {course.subject && (
                                                                <span>
                                                                    {
                                                                        course.subject
                                                                    }
                                                                </span>
                                                            )}
                                                            {course.subject && (
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="text-border"
                                                                >
                                                                    /
                                                                </span>
                                                            )}
                                                            <span>
                                                                {contentTypeLabel(
                                                                    course.content_type,
                                                                )}
                                                            </span>
                                                            <span
                                                                aria-hidden="true"
                                                                className="text-border"
                                                            >
                                                                /
                                                            </span>
                                                            <span>
                                                                {
                                                                    course.lesson_count
                                                                }{' '}
                                                                {course.lesson_count ===
                                                                1
                                                                    ? 'lesson'
                                                                    : 'lessons'}
                                                            </span>
                                                            {course.estimated_minutes !==
                                                                null && (
                                                                <>
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className="text-border"
                                                                    >
                                                                        /
                                                                    </span>
                                                                    <span>
                                                                        {
                                                                            course.estimated_minutes
                                                                        }{' '}
                                                                        min
                                                                    </span>
                                                                </>
                                                            )}
                                                        </p>

                                                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                                                            {course.description ??
                                                                'Add a description so managers and learners know what this course covers.'}
                                                        </p>

                                                        <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3 sm:gap-6">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Assigned
                                                                </p>
                                                                <p className="mt-1 font-semibold tabular-nums">
                                                                    {
                                                                        course.assigned_count
                                                                    }
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Completed
                                                                </p>
                                                                <p className="mt-1 font-semibold tabular-nums">
                                                                    {
                                                                        course.completed_count
                                                                    }
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Completion
                                                                </p>
                                                                <p className="mt-1 font-semibold tabular-nums">
                                                                    {course.completion_rate ===
                                                                    null
                                                                        ? 'Not assigned'
                                                                        : `${course.completion_rate}%`}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {course.completion_rate !==
                                                            null && (
                                                            <div className="mt-3 h-1.5 max-w-2xl overflow-hidden rounded-full bg-muted">
                                                                <div
                                                                    className="h-full rounded-full bg-emerald-600 transition-[width]"
                                                                    style={{
                                                                        width: `${course.completion_rate}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                                            {course.pathway ? (
                                                                <Link
                                                                    href={`/organizations/${organization.id}/pathways/${course.pathway.id}`}
                                                                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                                                                >
                                                                    <Route className="size-3.5" />
                                                                    Used in 1
                                                                    pathway
                                                                </Link>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPathwayCourse(
                                                                            course,
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                                                                >
                                                                    <Route className="size-3.5" />
                                                                    Add to a
                                                                    pathway
                                                                </button>
                                                            )}
                                                            <span>
                                                                {formatUpdatedAt(
                                                                    course.updated_at,
                                                                )}
                                                            </span>
                                                        </div>

                                                        <Link
                                                            href={`${courseUrl}?view=${course.health.view}`}
                                                            className={cn(
                                                                'mt-4 inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium',
                                                                course.health
                                                                    .tone ===
                                                                    'warning' &&
                                                                    'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
                                                                course.health
                                                                    .tone ===
                                                                    'ready' &&
                                                                    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
                                                                course.health
                                                                    .tone ===
                                                                    'neutral' &&
                                                                    'bg-muted text-muted-foreground',
                                                            )}
                                                        >
                                                            {course.health
                                                                .tone ===
                                                            'warning' ? (
                                                                <AlertTriangle className="size-3.5" />
                                                            ) : (
                                                                <CheckCircle2 className="size-3.5" />
                                                            )}
                                                            {
                                                                course.health
                                                                    .label
                                                            }
                                                            {course.health
                                                                .issue_count >
                                                                1 &&
                                                                course.health
                                                                    .tone ===
                                                                    'warning' && (
                                                                    <span className="opacity-70">
                                                                        +
                                                                        {course
                                                                            .health
                                                                            .issue_count -
                                                                            1}{' '}
                                                                        more
                                                                    </span>
                                                                )}
                                                        </Link>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <Link
                                                            href={`${courseUrl}?view=build&preview=full`}
                                                        >
                                                            <Eye className="size-4" />
                                                            Preview
                                                        </Link>
                                                    </Button>
                                                    <Button asChild size="sm">
                                                        <Link href={courseUrl}>
                                                            <Pencil className="size-4" />
                                                            Edit course
                                                        </Link>
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                className="size-8"
                                                                aria-label={`More actions for ${course.title}`}
                                                            >
                                                                <Ellipsis className="size-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="w-56"
                                                        >
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    handleDuplicate(
                                                                        course,
                                                                    )
                                                                }
                                                            >
                                                                <Copy />
                                                                Duplicate
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={`${courseUrl}?view=assignments`}
                                                                >
                                                                    <Users />
                                                                    View
                                                                    assignments
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    setPathwayCourse(
                                                                        course,
                                                                    )
                                                                }
                                                            >
                                                                <Route />
                                                                {course.pathway
                                                                    ? 'Change pathway'
                                                                    : 'Add to pathway'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {course.status !==
                                                                'archived' && (
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        handleArchive(
                                                                            course,
                                                                        )
                                                                    }
                                                                >
                                                                    <Archive />
                                                                    Archive
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                disabled={
                                                                    !course.can_delete
                                                                }
                                                                title={
                                                                    course.delete_block_reason ??
                                                                    undefined
                                                                }
                                                                onSelect={() =>
                                                                    handleDelete(
                                                                        course,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 />
                                                                Delete
                                                                permanently
                                                            </DropdownMenuItem>
                                                            {!course.can_delete && (
                                                                <p className="px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                                                                    Archive to
                                                                    preserve
                                                                    learner
                                                                    history.
                                                                </p>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <section
                    className={cn(
                        'space-y-4',
                        activeTab !== 'pathways' && 'hidden',
                    )}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Pathway management
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Sequence training and automate enrollment
                                through job titles.
                            </p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                aria-label="Search pathways"
                                value={pathwaySearch}
                                onChange={(event) =>
                                    setPathwaySearch(event.target.value)
                                }
                                className="h-10 pl-9"
                                placeholder="Search pathways"
                            />
                        </div>
                    </div>

                    {visiblePathways.length === 0 ? (
                        <Card className="border-dashed py-0">
                            <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                    <Route className="size-6" />
                                </span>
                                <h3 className="font-semibold">
                                    {pathways.length === 0
                                        ? 'Create your first pathway'
                                        : 'No pathways match this search'}
                                </h3>
                                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                                    {pathways.length === 0
                                        ? 'Group courses and microlearning into an ordered program that can be assigned automatically by job title.'
                                        : 'Try another search to find the pathway you need.'}
                                </p>
                                {pathways.length === 0 ? (
                                    <Button
                                        type="button"
                                        className="mt-5"
                                        onClick={() =>
                                            setPathwayModalOpen(true)
                                        }
                                    >
                                        <Plus className="size-4" />
                                        Create pathway
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="mt-5"
                                        onClick={() => setPathwaySearch('')}
                                    >
                                        Clear search
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {visiblePathways.map((pathway) => (
                                <Card
                                    key={pathway.id}
                                    className="py-0 transition-colors hover:border-foreground/20"
                                >
                                    <CardContent className="flex h-full flex-col p-5 sm:p-6">
                                        <div className="flex items-start gap-4">
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                <Route className="size-5" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Link
                                                        href={`/organizations/${organization.id}/pathways/${pathway.id}`}
                                                        className="font-semibold hover:underline"
                                                    >
                                                        {pathway.name}
                                                    </Link>
                                                    <Badge variant="outline">
                                                        {pathway.sequential_completion
                                                            ? 'Sequential'
                                                            : 'Flexible order'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                                    {pathway.description ??
                                                        'Add a description to clarify who this pathway is for.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <div className="rounded-lg bg-muted/50 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Training
                                                </p>
                                                <p className="mt-1 font-semibold tabular-nums">
                                                    {pathway.item_count}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Milestones
                                                </p>
                                                <p className="mt-1 font-semibold tabular-nums">
                                                    {pathway.milestone_count}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Job titles
                                                </p>
                                                <p className="mt-1 font-semibold tabular-nums">
                                                    {pathway.job_title_count}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Employees
                                                </p>
                                                <p className="mt-1 font-semibold tabular-nums">
                                                    {pathway.employee_count}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Clock3 className="size-3.5" />
                                                {pathway.expected_completion_days
                                                    ? `${pathway.expected_completion_days} day completion window`
                                                    : 'No completion window'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Milestone className="size-3.5" />
                                                {pathway.course_count}{' '}
                                                {pathway.course_count === 1
                                                    ? 'course linked'
                                                    : 'courses linked'}
                                            </span>
                                        </div>

                                        <div className="mt-auto flex justify-end pt-5">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    href={`/organizations/${organization.id}/pathways/${pathway.id}`}
                                                >
                                                    Manage pathway
                                                    <ChevronRight className="size-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <Dialog open={pathwayModalOpen} onOpenChange={setPathwayModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create pathway</DialogTitle>
                        <DialogDescription>
                            Create an ordered training program. You can add
                            courses, microlearning, and milestones next.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action={`/organizations/${organization.id}/pathways`}
                        method="post"
                        resetOnSuccess
                        className="space-y-5"
                        onSuccess={() => setPathwayModalOpen(false)}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="pathway-name">
                                        Pathway name
                                    </Label>
                                    <Input
                                        id="pathway-name"
                                        name="pathway_name"
                                        required
                                        autoFocus
                                        placeholder="New manager onboarding"
                                    />
                                    <InputError message={errors.pathway_name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="pathway-description">
                                        Description
                                    </Label>
                                    <textarea
                                        id="pathway-description"
                                        name="pathway_description"
                                        rows={3}
                                        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        placeholder="Who this pathway is for and what it prepares them to do."
                                    />
                                    <InputError
                                        message={errors.pathway_description}
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="pathway-window">
                                            Completion window
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="pathway-window"
                                                name="expected_completion_days"
                                                type="number"
                                                min="1"
                                                max="3650"
                                                className="pr-14"
                                                placeholder="30"
                                            />
                                            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                                                days
                                            </span>
                                        </div>
                                        <InputError
                                            message={
                                                errors.expected_completion_days
                                            }
                                        />
                                    </div>
                                    <label className="flex min-h-10 items-center gap-3 self-end rounded-md border px-3 py-2 text-sm">
                                        <input
                                            type="hidden"
                                            name="sequential_completion"
                                            value="0"
                                        />
                                        <input
                                            type="checkbox"
                                            name="sequential_completion"
                                            value="1"
                                            className="size-4 rounded border-input"
                                        />
                                        Require sequential completion
                                    </label>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setPathwayModalOpen(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={processing}>
                                        {processing && <Spinner />}
                                        <Plus className="size-4" />
                                        Create pathway
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={createModalOpen}
                onOpenChange={(open) => {
                    setCreateModalOpen(open);

                    if (!open) {
                        setCreateStep('format');
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {createStep === 'format'
                                ? 'What are you creating?'
                                : createMode === 'import'
                                  ? 'Import existing content'
                                  : 'Course details'}
                        </DialogTitle>
                        <DialogDescription>
                            {createStep === 'format'
                                ? 'Choose a format now. You can adjust settings later in the course builder.'
                                : createMode === 'import'
                                  ? 'Name the training first, then add your PDF, video, or job aid in the builder.'
                                  : 'Add the essentials. Your new draft will open directly in the builder.'}
                        </DialogDescription>
                    </DialogHeader>

                    {createStep === 'format' ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <CreateFormatCard
                                    active={createMode === 'course'}
                                    title="Full course"
                                    description="Multi-lesson training with checks and a final assessment."
                                    icon={<Layers3 className="size-5" />}
                                    onClick={() => setCreateMode('course')}
                                />
                                <CreateFormatCard
                                    active={createMode === 'microlearning'}
                                    title="Microlearning"
                                    description="A short, focused lesson for one behavior or update."
                                    icon={<Sparkles className="size-5" />}
                                    onClick={() =>
                                        setCreateMode('microlearning')
                                    }
                                />
                                <CreateFormatCard
                                    active={createMode === 'import'}
                                    title="Upload content"
                                    description="Start from an existing PDF, video, or job aid."
                                    icon={<FileUp className="size-5" />}
                                    onClick={() => setCreateMode('import')}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    onClick={() => setCreateStep('details')}
                                >
                                    Continue
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <Form
                            action={`/organizations/${organization.id}/courses`}
                            method="post"
                            className="space-y-5"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <input
                                        type="hidden"
                                        name="content_type"
                                        value={
                                            createMode === 'microlearning'
                                                ? 'microlearning'
                                                : 'course'
                                        }
                                    />
                                    <input
                                        type="hidden"
                                        name="status"
                                        value="draft"
                                    />

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-course-title">
                                            Course title
                                        </Label>
                                        <Input
                                            id="create-course-title"
                                            name="title"
                                            required
                                            autoFocus
                                            placeholder="Safety onboarding"
                                        />
                                        <InputError message={errors.title} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="create-course-description">
                                            Description
                                        </Label>
                                        <textarea
                                            id="create-course-description"
                                            name="description"
                                            rows={3}
                                            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                            placeholder="What should employees learn from this training?"
                                        />
                                        <InputError
                                            message={errors.description}
                                        />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="create-course-subject">
                                                Subject
                                            </Label>
                                            <Input
                                                id="create-course-subject"
                                                name="subject"
                                                placeholder="Workplace safety"
                                            />
                                            <InputError
                                                message={errors.subject}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="create-course-pathway">
                                                Intended audience
                                            </Label>
                                            <select
                                                id="create-course-pathway"
                                                name="pathway_id"
                                                defaultValue=""
                                                className={selectClassName}
                                            >
                                                <option value="">
                                                    Choose later
                                                </option>
                                                {pathways.map((pathway) => (
                                                    <option
                                                        key={pathway.id}
                                                        value={pathway.id}
                                                    >
                                                        {pathway.name} pathway
                                                    </option>
                                                ))}
                                            </select>
                                            <InputError
                                                message={errors.pathway_id}
                                            />
                                        </div>
                                    </div>

                                    {createMode === 'microlearning' && (
                                        <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
                                            <Label htmlFor="starter-template">
                                                Starter template
                                            </Label>
                                            <select
                                                id="starter-template"
                                                name="starter_template"
                                                value={starterTemplate}
                                                onChange={(event) =>
                                                    setStarterTemplate(
                                                        event.target.value,
                                                    )
                                                }
                                                className={selectClassName}
                                            >
                                                {microlearning_templates.map(
                                                    (template) => (
                                                        <option
                                                            key={template.key}
                                                            value={template.key}
                                                        >
                                                            {template.label} /{' '}
                                                            {
                                                                template.duration_minutes
                                                            }{' '}
                                                            min
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            <p className="text-xs leading-5 text-muted-foreground">
                                                {
                                                    microlearning_templates.find(
                                                        (template) =>
                                                            template.key ===
                                                            starterTemplate,
                                                    )?.description
                                                }
                                            </p>
                                        </div>
                                    )}

                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setCreateStep('format')
                                            }
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing ? (
                                                <Spinner />
                                            ) : createMode === 'import' ? (
                                                <FileUp className="size-4" />
                                            ) : (
                                                <Plus className="size-4" />
                                            )}
                                            {createMode === 'import'
                                                ? 'Continue to upload'
                                                : 'Create draft'}
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={pathwayCourse !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPathwayCourse(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Course pathway</DialogTitle>
                        <DialogDescription>
                            Choose where {pathwayCourse?.title} belongs. Pathway
                            rules can automate learner assignments by job title.
                        </DialogDescription>
                    </DialogHeader>
                    {pathwayCourse && (
                        <Form
                            action={`/organizations/${organization.id}/courses/${pathwayCourse.id}`}
                            method="patch"
                            className="space-y-4"
                            onSuccess={() => setPathwayCourse(null)}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="course-pathway">
                                            Pathway
                                        </Label>
                                        <select
                                            id="course-pathway"
                                            name="pathway_id"
                                            defaultValue={
                                                pathwayCourse.pathway_id ?? ''
                                            }
                                            className={cn(
                                                selectClassName,
                                                'w-full',
                                            )}
                                        >
                                            <option value="">No pathway</option>
                                            {pathways.map((pathway) => (
                                                <option
                                                    key={pathway.id}
                                                    value={pathway.id}
                                                >
                                                    {pathway.name}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={errors.pathway_id}
                                        />
                                    </div>
                                    {pathways.length === 0 && (
                                        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                                            Create a pathway from the Users page
                                            before organizing courses here.
                                        </p>
                                    )}
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setPathwayCourse(null)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Save pathway
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
