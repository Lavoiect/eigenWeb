import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    GripVertical,
    Plus,
    Save,
    Target,
    Trash2,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import Heading from '@/components/heading';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type CourseOption = {
    id: number;
    title: string;
    description: string | null;
    status: string;
    lesson_count: number;
};

type LessonOption = {
    id: number;
    title: string;
    description: string | null;
    course_id: number;
    course_title: string;
    status: string;
};

type JobTitleOption = {
    id: number;
    name: string;
    employee_count: number;
    pathway_id: number | null;
    pathway: {
        id: number;
        name: string;
    } | null;
};

type PathwayItem = {
    id: number;
    pathway_id: number;
    item_type: 'course' | 'microlearning';
    title: string;
    description: string | null;
    sort_order: number;
    is_required: boolean;
    course: {
        id: number;
        title: string;
        status: string;
    } | null;
    lesson: {
        id: number;
        title: string;
        slug: string;
        course: {
            id: number;
            title: string;
        } | null;
    } | null;
};

type PathwayMilestone = {
    id: number;
    title: string;
    description: string | null;
    sort_order: number;
    threshold_percent: number;
    reached: boolean;
};

type PathwayProgressRow = {
    user: {
        id: number;
        name: string;
        email: string;
        organization_role: string | null;
        job_title: {
            id: number;
            name: string;
        } | null;
        location: {
            id: number;
            name: string;
        } | null;
    };
    pathway: {
        id: number;
        name: string;
    };
    completion_percent: number;
    required_item_count: number;
    completed_required_count: number;
    current_item: {
        id: number;
        item_type: 'course' | 'microlearning';
        title: string;
    } | null;
    items: Array<{
        id: number;
        item_type: 'course' | 'microlearning';
        title: string;
        description: string | null;
        sort_order: number;
        is_required: boolean;
        status: 'completed' | 'available' | 'blocked';
        status_label: string;
        course: {
            id: number;
            title: string;
            status: string;
        } | null;
        lesson: {
            id: number;
            title: string;
            slug: string;
            course: {
                id: number;
                title: string;
            } | null;
        } | null;
    }>;
    milestones: PathwayMilestone[];
    sequential_completion: boolean;
    expected_completion_days: number | null;
    status: string;
    status_label: string;
};

type Pathway = {
    id: number;
    name: string;
    description: string | null;
    sequential_completion: boolean;
    expected_completion_days: number | null;
    job_title_count: number;
    course_count: number;
    item_count: number;
    milestone_count: number;
    items: PathwayItem[];
    milestones: PathwayMilestone[];
};

type PageProps = {
    organization: Organization;
    pathway: Pathway;
    courseOptions: CourseOption[];
    lessonOptions: LessonOption[];
    jobTitles: JobTitleOption[];
    progress: PathwayProgressRow[];
};

type ItemDraft = {
    itemType: 'course' | 'microlearning';
    courseId: string;
    lessonId: string;
    title: string;
    description: string;
    isRequired: boolean;
};

type MilestoneDraft = {
    title: string;
    description: string;
};

type SettingsDraft = {
    name: string;
    description: string;
    sequentialCompletion: boolean;
    expectedCompletionDays: string;
};

const panelClass = 'rounded-3xl border bg-card/95 shadow-sm';
const fieldClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClass =
    'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex) {
        return [...items];
    }

    const next = [...items];
    const [spliced] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, spliced);

    return next;
}

function progressVariant(percent: number) {
    if (percent >= 100) {
        return 'default';
    }

    if (percent >= 50) {
        return 'secondary';
    }

    return 'outline';
}

function itemTypeLabel(type: PathwayItem['item_type']) {
    return type === 'course' ? 'Course' : 'Microlearning';
}

export default function OrganizationPathwayShow() {
    const {
        organization,
        pathway,
        courseOptions,
        lessonOptions,
        jobTitles,
        progress,
    } = usePage<PageProps>().props;

    const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
        name: pathway.name,
        description: pathway.description ?? '',
        sequentialCompletion: pathway.sequential_completion,
        expectedCompletionDays: pathway.expected_completion_days
            ? String(pathway.expected_completion_days)
            : '',
    });
    const [settingsErrors, setSettingsErrors] = useState<
        Record<string, string>
    >({});
    const [savingSettings, setSavingSettings] = useState(false);
    const [selectedJobTitleIds, setSelectedJobTitleIds] = useState<number[]>(
        jobTitles
            .filter((jobTitle) => jobTitle.pathway_id === pathway.id)
            .map((jobTitle) => jobTitle.id),
    );
    const [jobTitleSearch, setJobTitleSearch] = useState('');
    const [jobTitleErrors, setJobTitleErrors] = useState<
        Record<string, string>
    >({});
    const [savingJobTitles, setSavingJobTitles] = useState(false);

    const [itemDraft, setItemDraft] = useState<ItemDraft>({
        itemType: 'course',
        courseId: String(courseOptions[0]?.id ?? ''),
        lessonId: String(lessonOptions[0]?.id ?? ''),
        title: '',
        description: '',
        isRequired: true,
    });
    const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
    const [savingItem, setSavingItem] = useState(false);

    const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>({
        title: '',
        description: '',
    });
    const [milestoneErrors, setMilestoneErrors] = useState<
        Record<string, string>
    >({});
    const [savingMilestone, setSavingMilestone] = useState(false);
    const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<number | null>(null);
    const [draggingMilestoneId, setDraggingMilestoneId] = useState<
        number | null
    >(null);
    const [dragOverMilestoneId, setDragOverMilestoneId] = useState<
        number | null
    >(null);

    const progressSummary = useMemo(() => {
        const total = progress.length;
        const average =
            total > 0
                ? Math.round(
                      progress.reduce(
                          (sum, row) => sum + row.completion_percent,
                          0,
                      ) / total,
                  )
                : 0;

        return {
            total,
            average,
            completed: progress.filter((row) => row.status === 'completed')
                .length,
        };
    }, [progress]);

    const assignedJobTitles = jobTitles.filter((jobTitle) =>
        selectedJobTitleIds.includes(jobTitle.id),
    );
    const filteredJobTitles = jobTitles.filter((jobTitle) =>
        jobTitle.name.toLowerCase().includes(jobTitleSearch.toLowerCase()),
    );

    const currentCourse = courseOptions.find(
        (course) => String(course.id) === itemDraft.courseId,
    );
    const currentLesson = lessonOptions.find(
        (lesson) => String(lesson.id) === itemDraft.lessonId,
    );

    const createSettings = () => {
        setSavingSettings(true);
        setSettingsErrors({});

        router.patch(
            `/organizations/${organization.id}/pathways/${pathway.id}`,
            {
                name: settingsDraft.name.trim(),
                description: settingsDraft.description.trim() || null,
                sequential_completion: settingsDraft.sequentialCompletion,
                expected_completion_days:
                    settingsDraft.expectedCompletionDays.trim() === ''
                        ? null
                        : Number(settingsDraft.expectedCompletionDays),
            },
            {
                preserveScroll: true,
                onError: (errors) => {
                    setSettingsErrors(errors as Record<string, string>);
                },
                onFinish: () => {
                    setSavingSettings(false);
                },
            },
        );
    };

    const toggleJobTitle = (jobTitleId: number) => {
        setSelectedJobTitleIds((current) =>
            current.includes(jobTitleId)
                ? current.filter((id) => id !== jobTitleId)
                : [...current, jobTitleId],
        );
    };

    const saveJobTitles = () => {
        setSavingJobTitles(true);
        setJobTitleErrors({});

        router.put(
            `/organizations/${organization.id}/pathways/${pathway.id}/job-titles`,
            { job_title_ids: selectedJobTitleIds },
            {
                preserveScroll: true,
                onError: (errors) => {
                    setJobTitleErrors(errors as Record<string, string>);
                },
                onFinish: () => {
                    setSavingJobTitles(false);
                },
            },
        );
    };

    const createItem = () => {
        setSavingItem(true);
        setItemErrors({});

        const payload =
            itemDraft.itemType === 'course'
                ? {
                      item_type: itemDraft.itemType,
                      course_id:
                          itemDraft.courseId === ''
                              ? null
                              : Number(itemDraft.courseId),
                      lesson_id: null,
                      title: null,
                      description: itemDraft.description.trim() || null,
                      is_required: itemDraft.isRequired,
                  }
                : {
                      item_type: itemDraft.itemType,
                      course_id: null,
                      lesson_id:
                          itemDraft.lessonId === ''
                              ? null
                              : Number(itemDraft.lessonId),
                      title: itemDraft.title.trim() || null,
                      description: itemDraft.description.trim() || null,
                      is_required: itemDraft.isRequired,
                  };

        router.post(
            `/organizations/${organization.id}/pathways/${pathway.id}/items`,
            payload,
            {
                preserveScroll: true,
                onError: (errors) => {
                    setItemErrors(errors as Record<string, string>);
                },
                onSuccess: () => {
                    setItemDraft((current) => ({
                        ...current,
                        title: '',
                        description: '',
                        isRequired: true,
                    }));
                },
                onFinish: () => {
                    setSavingItem(false);
                },
            },
        );
    };

    const createMilestone = () => {
        setSavingMilestone(true);
        setMilestoneErrors({});

        router.post(
            `/organizations/${organization.id}/pathways/${pathway.id}/milestones`,
            {
                title: milestoneDraft.title.trim(),
                description: milestoneDraft.description.trim() || null,
            },
            {
                preserveScroll: true,
                onError: (errors) => {
                    setMilestoneErrors(errors as Record<string, string>);
                },
                onSuccess: () => {
                    setMilestoneDraft({
                        title: '',
                        description: '',
                    });
                },
                onFinish: () => {
                    setSavingMilestone(false);
                },
            },
        );
    };

    const reorderPathwayItems = (fromIndex: number, toIndex: number) => {
        const nextItems = moveItem(pathway.items, fromIndex, toIndex);

        router.patch(
            `/organizations/${organization.id}/pathways/${pathway.id}/items/reorder`,
            {
                item_ids: nextItems.map((item) => item.id),
            },
            {
                preserveScroll: true,
            },
        );
    };

    const endItemDrag = () => {
        setDraggingItemId(null);
        setDragOverItemId(null);
    };

    const handleItemDragStart = (
        event: DragEvent<HTMLDivElement>,
        itemId: number,
    ) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(itemId));
        setDraggingItemId(itemId);
        setDragOverItemId(itemId);
    };

    const handleItemDragOver = (
        event: DragEvent<HTMLDivElement>,
        itemId: number,
    ) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverItemId(itemId);
    };

    const handleItemDrop = (targetId: number) => {
        if (draggingItemId === null || draggingItemId === targetId) {
            endItemDrag();

            return;
        }

        const fromIndex = pathway.items.findIndex(
            (item) => item.id === draggingItemId,
        );
        const toIndex = pathway.items.findIndex((item) => item.id === targetId);

        if (fromIndex === -1 || toIndex === -1) {
            endItemDrag();

            return;
        }

        reorderPathwayItems(fromIndex, toIndex);
        endItemDrag();
    };

    const reorderMilestones = (fromIndex: number, toIndex: number) => {
        const nextMilestones = moveItem(pathway.milestones, fromIndex, toIndex);

        router.patch(
            `/organizations/${organization.id}/pathways/${pathway.id}/milestones/reorder`,
            {
                milestone_ids: nextMilestones.map((milestone) => milestone.id),
            },
            {
                preserveScroll: true,
            },
        );
    };

    const endMilestoneDrag = () => {
        setDraggingMilestoneId(null);
        setDragOverMilestoneId(null);
    };

    const handleMilestoneDragStart = (
        event: DragEvent<HTMLDivElement>,
        milestoneId: number,
    ) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(milestoneId));
        setDraggingMilestoneId(milestoneId);
        setDragOverMilestoneId(milestoneId);
    };

    const handleMilestoneDragOver = (
        event: DragEvent<HTMLDivElement>,
        milestoneId: number,
    ) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverMilestoneId(milestoneId);
    };

    const handleMilestoneDrop = (targetId: number) => {
        if (draggingMilestoneId === null || draggingMilestoneId === targetId) {
            endMilestoneDrag();

            return;
        }

        const fromIndex = pathway.milestones.findIndex(
            (milestone) => milestone.id === draggingMilestoneId,
        );
        const toIndex = pathway.milestones.findIndex(
            (milestone) => milestone.id === targetId,
        );

        if (fromIndex === -1 || toIndex === -1) {
            endMilestoneDrag();

            return;
        }

        reorderMilestones(fromIndex, toIndex);
        endMilestoneDrag();
    };

    const deleteItem = (item: PathwayItem) => {
        if (!window.confirm(`Remove ${item.title} from this pathway?`)) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/pathways/${pathway.id}/items/${item.id}`,
            {
                preserveScroll: true,
            },
        );
    };

    const deleteMilestone = (milestone: PathwayMilestone) => {
        if (!window.confirm(`Remove milestone ${milestone.title}?`)) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/pathways/${pathway.id}/milestones/${milestone.id}`,
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <Head title={`${pathway.name} pathway`} />

            <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="rounded-3xl border bg-background/95 p-4 shadow-sm backdrop-blur">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="-ml-2"
                                >
                                    <Link
                                        href={`/organizations/${organization.id}/courses?tab=pathways`}
                                    >
                                        <ArrowLeft className="size-4" />
                                        Pathways
                                    </Link>
                                </Button>
                                <Heading
                                    title={pathway.name}
                                    description="Manage the learning sequence, milestones, and progress by job title."
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                    {pathway.course_count} course
                                    {pathway.course_count === 1 ? '' : 's'}
                                </Badge>
                                <Badge variant="outline">
                                    {pathway.item_count} item
                                    {pathway.item_count === 1 ? '' : 's'}
                                </Badge>
                                <Badge variant="outline">
                                    {pathway.milestone_count} milestone
                                    {pathway.milestone_count === 1 ? '' : 's'}
                                </Badge>
                                {pathway.sequential_completion && (
                                    <Badge variant="secondary">
                                        Sequential completion
                                    </Badge>
                                )}
                                {pathway.expected_completion_days && (
                                    <Badge variant="secondary">
                                        {pathway.expected_completion_days} day
                                        window
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2 text-sm text-muted-foreground xl:text-right">
                            <div className="inline-flex items-center gap-2 xl:justify-end">
                                <Users className="size-4" />
                                {pathway.job_title_count} job title
                                {pathway.job_title_count === 1 ? '' : 's'}{' '}
                                assigned
                            </div>
                            <div className="inline-flex items-center gap-2 xl:justify-end">
                                <Clock3 className="size-4" />
                                Expected completion:{' '}
                                {pathway.expected_completion_days
                                    ? `${pathway.expected_completion_days} days`
                                    : 'Not set'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-6">
                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Pathway settings</CardTitle>
                                        <CardDescription>
                                            Control how learners move through
                                            this pathway.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        onClick={createSettings}
                                        disabled={savingSettings}
                                    >
                                        {savingSettings && <Spinner />}
                                        <Save className="size-4" />
                                        Save
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="pathway-name">
                                        Pathway name
                                    </Label>
                                    <Input
                                        id="pathway-name"
                                        value={settingsDraft.name}
                                        onChange={(event) =>
                                            setSettingsDraft((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                        className={fieldClass}
                                    />
                                    <InputError message={settingsErrors.name} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="pathway-description">
                                        Description
                                    </Label>
                                    <textarea
                                        id="pathway-description"
                                        value={settingsDraft.description}
                                        onChange={(event) =>
                                            setSettingsDraft((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        className={textareaClass}
                                        rows={4}
                                    />
                                    <InputError
                                        message={settingsErrors.description}
                                    />
                                </div>

                                <label className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={
                                            settingsDraft.sequentialCompletion
                                        }
                                        onChange={(event) =>
                                            setSettingsDraft((current) => ({
                                                ...current,
                                                sequentialCompletion:
                                                    event.target.checked,
                                            }))
                                        }
                                        className="size-4 rounded border-input"
                                    />
                                    Require sequential completion
                                </label>

                                <div className="grid gap-2">
                                    <Label htmlFor="pathway-window">
                                        Expected completion window
                                    </Label>
                                    <Input
                                        id="pathway-window"
                                        type="number"
                                        min="1"
                                        value={
                                            settingsDraft.expectedCompletionDays
                                        }
                                        onChange={(event) =>
                                            setSettingsDraft((current) => ({
                                                ...current,
                                                expectedCompletionDays:
                                                    event.target.value,
                                            }))
                                        }
                                        className={fieldClass}
                                        placeholder="30"
                                    />
                                    <InputError
                                        message={
                                            settingsErrors.expected_completion_days
                                        }
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle>
                                            Job title enrollment
                                        </CardTitle>
                                        <CardDescription>
                                            Automatically assign this pathway to
                                            employees with the selected job
                                            titles.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                        {assignedJobTitles.length} selected
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {jobTitles.length === 0 ? (
                                    <div className="space-y-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                        <p>
                                            Create a job title before assigning
                                            this pathway.
                                        </p>
                                        <Button asChild variant="outline">
                                            <Link
                                                href={`/organizations/${organization.id}/users`}
                                            >
                                                Manage job titles
                                            </Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            value={jobTitleSearch}
                                            onChange={(event) =>
                                                setJobTitleSearch(
                                                    event.target.value,
                                                )
                                            }
                                            className={fieldClass}
                                            placeholder="Search job titles"
                                            aria-label="Search job titles"
                                        />

                                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                            {filteredJobTitles.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                                    No job titles match your
                                                    search.
                                                </div>
                                            ) : (
                                                filteredJobTitles.map(
                                                    (jobTitle) => {
                                                        const checked =
                                                            selectedJobTitleIds.includes(
                                                                jobTitle.id,
                                                            );
                                                        const assignedElsewhere =
                                                            jobTitle.pathway !==
                                                                null &&
                                                            jobTitle.pathway
                                                                .id !==
                                                                pathway.id;

                                                        return (
                                                            <label
                                                                key={
                                                                    jobTitle.id
                                                                }
                                                                className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-background p-3 transition-colors hover:border-primary/40"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        checked
                                                                    }
                                                                    onChange={() =>
                                                                        toggleJobTitle(
                                                                            jobTitle.id,
                                                                        )
                                                                    }
                                                                    className="mt-1 size-4 rounded border-input"
                                                                />
                                                                <span className="min-w-0 flex-1 space-y-1">
                                                                    <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                                                                        <span>
                                                                            {
                                                                                jobTitle.name
                                                                            }
                                                                        </span>
                                                                        <Badge variant="outline">
                                                                            {
                                                                                jobTitle.employee_count
                                                                            }{' '}
                                                                            employee
                                                                            {jobTitle.employee_count ===
                                                                            1
                                                                                ? ''
                                                                                : 's'}
                                                                        </Badge>
                                                                    </span>
                                                                    {assignedElsewhere && (
                                                                        <span className="block text-xs text-amber-700 dark:text-amber-400">
                                                                            Currently
                                                                            assigned
                                                                            to{' '}
                                                                            {
                                                                                jobTitle
                                                                                    .pathway
                                                                                    ?.name
                                                                            }
                                                                            .
                                                                            Selecting
                                                                            it
                                                                            here
                                                                            will
                                                                            move
                                                                            it.
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </label>
                                                        );
                                                    },
                                                )
                                            )}
                                        </div>

                                        <InputError
                                            message={
                                                jobTitleErrors.job_title_ids ??
                                                jobTitleErrors[
                                                    'job_title_ids.0'
                                                ]
                                            }
                                        />

                                        <Button
                                            onClick={saveJobTitles}
                                            disabled={savingJobTitles}
                                            className="w-full"
                                        >
                                            {savingJobTitles && <Spinner />}
                                            <Save className="size-4" />
                                            Save job titles
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Add training</CardTitle>
                                        <CardDescription>
                                            Add a course or a microlearning
                                            lesson to this pathway.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">
                                        {pathway.items.length} item
                                        {pathway.items.length === 1 ? '' : 's'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="item-type">Item type</Label>
                                    <select
                                        id="item-type"
                                        value={itemDraft.itemType}
                                        onChange={(event) =>
                                            setItemDraft((current) => ({
                                                ...current,
                                                itemType: event.target
                                                    .value as ItemDraft['itemType'],
                                            }))
                                        }
                                        className={fieldClass}
                                    >
                                        <option value="course">Course</option>
                                        <option value="microlearning">
                                            Microlearning
                                        </option>
                                    </select>
                                </div>

                                {itemDraft.itemType === 'course' ? (
                                    <div className="grid gap-2">
                                        <Label htmlFor="course-id">
                                            Course
                                        </Label>
                                        <select
                                            id="course-id"
                                            value={itemDraft.courseId}
                                            onChange={(event) =>
                                                setItemDraft((current) => ({
                                                    ...current,
                                                    courseId:
                                                        event.target.value,
                                                }))
                                            }
                                            className={fieldClass}
                                        >
                                            {courseOptions.map((course) => (
                                                <option
                                                    key={course.id}
                                                    value={course.id}
                                                >
                                                    {course.title}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={itemErrors.course_id}
                                        />
                                        {currentCourse && (
                                            <p className="text-xs text-muted-foreground">
                                                {currentCourse.lesson_count}{' '}
                                                lesson
                                                {currentCourse.lesson_count ===
                                                1
                                                    ? ''
                                                    : 's'}{' '}
                                                in this course.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        <Label htmlFor="lesson-id">
                                            Microlearning lesson
                                        </Label>
                                        <select
                                            id="lesson-id"
                                            value={itemDraft.lessonId}
                                            onChange={(event) =>
                                                setItemDraft((current) => ({
                                                    ...current,
                                                    lessonId:
                                                        event.target.value,
                                                }))
                                            }
                                            className={fieldClass}
                                        >
                                            {lessonOptions.map((lesson) => (
                                                <option
                                                    key={lesson.id}
                                                    value={lesson.id}
                                                >
                                                    {lesson.title} ·{' '}
                                                    {lesson.course_title}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={itemErrors.lesson_id}
                                        />
                                        <div className="grid gap-2">
                                            <Label htmlFor="microlearning-title">
                                                Optional title override
                                            </Label>
                                            <Input
                                                id="microlearning-title"
                                                value={itemDraft.title}
                                                onChange={(event) =>
                                                    setItemDraft((current) => ({
                                                        ...current,
                                                        title: event.target
                                                            .value,
                                                    }))
                                                }
                                                className={fieldClass}
                                                placeholder={
                                                    currentLesson?.title ??
                                                    'Microlearning title'
                                                }
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label htmlFor="item-description">
                                        Notes
                                    </Label>
                                    <textarea
                                        id="item-description"
                                        value={itemDraft.description}
                                        onChange={(event) =>
                                            setItemDraft((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        className={textareaClass}
                                        rows={3}
                                        placeholder="Why does this item belong in the pathway?"
                                    />
                                    <InputError
                                        message={itemErrors.description}
                                    />
                                </div>

                                <label className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={itemDraft.isRequired}
                                        onChange={(event) =>
                                            setItemDraft((current) => ({
                                                ...current,
                                                isRequired:
                                                    event.target.checked,
                                            }))
                                        }
                                        className="size-4 rounded border-input"
                                    />
                                    Required item
                                </label>

                                <Button
                                    onClick={createItem}
                                    disabled={savingItem}
                                >
                                    {savingItem && <Spinner />}
                                    <Plus className="size-4" />
                                    Add item
                                </Button>

                                {itemDraft.itemType === 'course' ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
                                        Courses are assigned to learners through
                                        the job title pathway mapping.
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
                                        Microlearning is tracked with lesson
                                        completion, so learners can finish it
                                        inside the mobile app.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Add milestone</CardTitle>
                                        <CardDescription>
                                            Mark the moments that matter in the
                                            learner journey.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">
                                        {pathway.milestones.length} milestone
                                        {pathway.milestones.length === 1
                                            ? ''
                                            : 's'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="milestone-title">
                                        Milestone name
                                    </Label>
                                    <Input
                                        id="milestone-title"
                                        value={milestoneDraft.title}
                                        onChange={(event) =>
                                            setMilestoneDraft((current) => ({
                                                ...current,
                                                title: event.target.value,
                                            }))
                                        }
                                        className={fieldClass}
                                        placeholder="Shadow a manager"
                                    />
                                    <InputError
                                        message={milestoneErrors.title}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="milestone-description">
                                        Description
                                    </Label>
                                    <textarea
                                        id="milestone-description"
                                        value={milestoneDraft.description}
                                        onChange={(event) =>
                                            setMilestoneDraft((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        className={textareaClass}
                                        rows={3}
                                    />
                                    <InputError
                                        message={milestoneErrors.description}
                                    />
                                </div>

                                <Button
                                    onClick={createMilestone}
                                    disabled={savingMilestone}
                                >
                                    {savingMilestone && <Spinner />}
                                    <Plus className="size-4" />
                                    Add milestone
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Training sequence</CardTitle>
                                        <CardDescription>
                                            Drag cards to reorder courses and
                                            microlearning to match the real
                                            onboarding flow.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                        {pathway.items.length} total steps
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {pathway.items.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                        Add training items to begin building the
                                        pathway.
                                    </div>
                                ) : (
                                    pathway.items.map((item, index) => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(event) =>
                                                handleItemDragStart(
                                                    event,
                                                    item.id,
                                                )
                                            }
                                            onDragOver={(event) =>
                                                handleItemDragOver(
                                                    event,
                                                    item.id,
                                                )
                                            }
                                            onDrop={() =>
                                                handleItemDrop(item.id)
                                            }
                                            onDragEnd={endItemDrag}
                                            className={`rounded-2xl border bg-background p-4 shadow-sm transition ${
                                                draggingItemId === item.id
                                                    ? 'opacity-60'
                                                    : ''
                                            } ${
                                                dragOverItemId === item.id
                                                    ? 'border-primary/60 ring-2 ring-primary/30'
                                                    : ''
                                            }`}
                                        >
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className="mt-0.5 rounded-xl border bg-muted/30 p-2 text-muted-foreground"
                                                        aria-hidden="true"
                                                    >
                                                        <GripVertical className="size-4" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge variant="outline">
                                                                {itemTypeLabel(
                                                                    item.item_type,
                                                                )}
                                                            </Badge>
                                                            {item.is_required ? (
                                                                <Badge variant="default">
                                                                    Required
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary">
                                                                    Optional
                                                                </Badge>
                                                            )}
                                                            <Badge variant="secondary">
                                                                Step {index + 1}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-sm font-medium">
                                                            {item.title}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.description ??
                                                                'No notes added yet.'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.item_type ===
                                                            'course'
                                                                ? (item.course
                                                                      ?.title ??
                                                                  'Course removed')
                                                                : item.lesson
                                                                  ? `${item.lesson.title} · ${item.lesson.course?.title ?? 'Microlearning'}`
                                                                  : 'Lesson removed'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() =>
                                                            deleteItem(item)
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Milestones</CardTitle>
                                        <CardDescription>
                                            Drag milestones to reorder visible
                                            checkpoints in the learner journey.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                        {pathway.milestones.length} tracked
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {pathway.milestones.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                        Add your first milestone to break the
                                        pathway into meaningful phases.
                                    </div>
                                ) : (
                                    pathway.milestones.map(
                                        (milestone, index) => (
                                            <div
                                                key={milestone.id}
                                                draggable
                                                onDragStart={(event) =>
                                                    handleMilestoneDragStart(
                                                        event,
                                                        milestone.id,
                                                    )
                                                }
                                                onDragOver={(event) =>
                                                    handleMilestoneDragOver(
                                                        event,
                                                        milestone.id,
                                                    )
                                                }
                                                onDrop={() =>
                                                    handleMilestoneDrop(
                                                        milestone.id,
                                                    )
                                                }
                                                onDragEnd={endMilestoneDrag}
                                                className={`rounded-2xl border bg-background p-4 shadow-sm transition ${
                                                    draggingMilestoneId ===
                                                    milestone.id
                                                        ? 'opacity-60'
                                                        : ''
                                                } ${
                                                    dragOverMilestoneId ===
                                                    milestone.id
                                                        ? 'border-primary/60 ring-2 ring-primary/30'
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className="mt-0.5 rounded-xl border bg-muted/30 p-2 text-muted-foreground"
                                                            aria-hidden="true"
                                                        >
                                                            <GripVertical className="size-4" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge
                                                                    variant={
                                                                        milestone.reached
                                                                            ? 'default'
                                                                            : 'outline'
                                                                    }
                                                                >
                                                                    {milestone.reached
                                                                        ? 'Reached'
                                                                        : 'Upcoming'}
                                                                </Badge>
                                                                <Badge variant="secondary">
                                                                    Milestone{' '}
                                                                    {index + 1}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {
                                                                        milestone.threshold_percent
                                                                    }
                                                                    % target
                                                                </Badge>
                                                            </div>
                                                            <div className="text-sm font-medium">
                                                                {
                                                                    milestone.title
                                                                }
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {milestone.description ??
                                                                    'No description yet.'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                deleteMilestone(
                                                                    milestone,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    )
                                )}
                            </CardContent>
                        </Card>

                        <Card className={panelClass}>
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>
                                            Individual progress
                                        </CardTitle>
                                        <CardDescription>
                                            See how each learner is moving
                                            through the pathway.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                        {progressSummary.total} learner
                                        {progressSummary.total === 1 ? '' : 's'}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                        <CheckCircle2 className="size-4" />
                                        {progressSummary.completed} completed
                                    </span>
                                    <span className="inline-flex items-center gap-2">
                                        <Target className="size-4" />
                                        Average {progressSummary.average}%
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {progress.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                        No learners are mapped to this pathway
                                        yet. Assign a job title to see progress
                                        here.
                                    </div>
                                ) : (
                                    progress.map((row) => (
                                        <div
                                            key={row.user.id}
                                            className="rounded-2xl border bg-background p-4 shadow-sm"
                                        >
                                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant={progressVariant(
                                                                row.completion_percent,
                                                            )}
                                                        >
                                                            {
                                                                row.completion_percent
                                                            }
                                                            %
                                                        </Badge>
                                                        <Badge variant="outline">
                                                            {row.status_label}
                                                        </Badge>
                                                        {row.sequential_completion && (
                                                            <Badge variant="secondary">
                                                                Sequential
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-medium">
                                                        {row.user.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.user.email}
                                                        {row.user.job_title
                                                            ?.name
                                                            ? ` • ${row.user.job_title.name}`
                                                            : ''}
                                                        {row.user.location?.name
                                                            ? ` • ${row.user.location.name}`
                                                            : ''}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {
                                                            row.completed_required_count
                                                        }{' '}
                                                        of{' '}
                                                        {
                                                            row.required_item_count
                                                        }{' '}
                                                        required items complete
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Current step:{' '}
                                                        {row.current_item
                                                            ?.title ??
                                                            'All required items complete'}
                                                    </div>
                                                </div>

                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    <Link
                                                        href={`/organizations/${organization.id}/users/${row.user.id}`}
                                                    >
                                                        Open profile
                                                    </Link>
                                                </Button>
                                            </div>

                                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                                {row.milestones.map(
                                                    (milestone) => (
                                                        <div
                                                            key={milestone.id}
                                                            className="rounded-2xl border px-3 py-2 text-xs"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-medium">
                                                                    {
                                                                        milestone.title
                                                                    }
                                                                </span>
                                                                <Badge
                                                                    variant={
                                                                        milestone.reached
                                                                            ? 'default'
                                                                            : 'outline'
                                                                    }
                                                                >
                                                                    {milestone.reached
                                                                        ? 'Reached'
                                                                        : `${milestone.threshold_percent}%`}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
