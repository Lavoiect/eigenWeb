import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    BarChart3,
    BookOpen,
    CheckCircle2,
    Bell,
    Copy,
    Ellipsis,
    Eye,
    Download,
    FileText,
    GripVertical,
    ImageIcon,
    Layers3,
    Plus,
    Save,
    Settings2,
    Search,
    Sparkles,
    RotateCcw,
    Trash2,
    Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import InputError from '@/components/input-error';
import RichTextEditor from '@/components/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { richTextToPlainText } from '@/lib/rich-text';
import type { Auth } from '@/types';
import CourseTestRunner from './course-test-runner';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type CourseAsset = {
    id: number;
    course_id: number;
    uploaded_by_id: number | null;
    kind: 'video' | 'document';
    sort_order: number;
    disk: string;
    path: string;
    url: string;
    original_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    usage_count: number;
    usage_lessons: {
        lesson_id: number;
        lesson_title: string;
        block_count: number;
    }[];
    created_at: string | null;
    updated_at: string | null;
};

type Course = {
    id: number;
    pathway_id: number | null;
    content_type: 'course' | 'microlearning';
    pathway: {
        id: number;
        name: string;
        description: string | null;
    } | null;
    title: string;
    slug: string;
    subject: string | null;
    description: string | null;
    learning_objectives: string[] | null;
    assets: CourseAsset[];
    estimated_minutes: number | null;
    passing_score: number | null;
    status: 'draft' | 'published' | 'archived';
    status_label: string;
    published_at: string | null;
    archived_at: string | null;
    lesson_count: number;
    assignment_count: number;
    created_at: string | null;
    updated_at: string | null;
};

type LessonBlock = {
    id: string;
    type: string;
    [key: string]: unknown;
};

type Lesson = {
    id: number;
    course_id: number;
    title: string;
    slug: string;
    body: string | null;
    position: number;
    duration_minutes: number | null;
    is_final_assessment: boolean;
    status: 'draft' | 'published';
    status_label: string;
    published_at: string | null;
    content: LessonBlock[];
    created_at: string | null;
    updated_at: string | null;
};

type PageProps = {
    auth: Auth;
    organization: Organization;
    microlearning_templates: {
        key: string;
        label: string;
        description: string;
        duration_minutes: number;
        activity_count: number;
        block_types: string[];
    }[];
    pathways: {
        id: number;
        name: string;
        description: string | null;
        course_count: number;
    }[];
    course: Course;
    lessons: Lesson[];
    selected_lesson_id: number | null;
    selected_assignment_target_type: Exclude<
        AssignmentTargetType,
        'pathway'
    > | null;
    selected_assignment_target_id: number | null;
    selected_assignment_due_at: string | null;
    selected_workspace_view: WorkspaceView | null;
    selected_preview_mode: 'current' | 'full';
    assignments: CourseAssignmentRow[];
    teams: OrganizationTeam[];
    jobTitles: OrganizationJobTitle[];
    locations: OrganizationLocation[];
    employees: OrganizationEmployee[];
};

type OrganizationTeam = {
    id: number;
    name: string;
};

type OrganizationJobTitle = {
    id: number;
    name: string;
};

type OrganizationLocation = {
    id: number;
    name: string;
};

type OrganizationEmployee = {
    id: number;
    name: string;
    email: string;
    organization_role: string | null;
    job_title_id: number | null;
    job_title: {
        id: number;
        name: string;
    } | null;
    location_id: number | null;
    location: {
        id: number;
        name: string;
    } | null;
    team_ids: number[];
};

type AssignmentTargetType =
    'user' | 'team' | 'job_title' | 'location' | 'pathway';

type CourseAssignmentRow = {
    id: number;
    course_id: number;
    assigned_by_id: number | null;
    assigned_to: {
        type: AssignmentTargetType;
        id: number | null;
        name: string | null;
    };
    due_at: string | null;
    is_required: boolean;
    recurs_every_days: number | null;
    reminder_count: number;
    last_reminded_at: string | null;
    status: 'not_started' | 'in_progress' | 'overdue' | 'completed' | string;
    status_label: string;
    recipient_count: number;
    completed_count: number;
    overdue_count: number;
    failed_count: number;
    failed_user_ids: number[];
    created_at: string | null;
    updated_at: string | null;
};

type AssignmentDraft = {
    targetType: Exclude<AssignmentTargetType, 'pathway'>;
    targetId: string;
    dueAt: string;
    isRequired: boolean;
    recursEveryDays: string;
};

type CourseDraft = {
    title: string;
    slug: string;
    content_type: 'course' | 'microlearning';
    subject: string;
    description: string;
    learning_objectives: string;
    estimated_minutes: string;
    passing_score: string;
    pathway_id: string;
    status: 'draft' | 'published' | 'archived';
    published_at: string;
};

type LessonDraft = {
    id: number;
    title: string;
    slug: string;
    body: string;
    position: number;
    duration_minutes: string;
    is_final_assessment: boolean;
    status: 'draft' | 'published';
    published_at: string;
    content: LessonBlock[];
};

type SaveTarget = 'course' | 'lesson' | null;

type WorkspaceView = 'build' | 'settings' | 'media' | 'assignments' | 'results';

type ActivityDefinition = {
    type: string;
    label: string;
    description: string;
    icon: typeof FileText;
};

const baseFieldClass =
    'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const textareaClass =
    'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const panelClass = 'rounded-3xl border bg-card/95 shadow-sm';

const assetKindRank: Record<CourseAsset['kind'], number> = {
    video: 0,
    document: 1,
};

const sortCourseAssets = (assets: CourseAsset[]) =>
    [...assets].sort((left, right) => {
        if (left.kind !== right.kind) {
            return assetKindRank[left.kind] - assetKindRank[right.kind];
        }

        if (left.sort_order !== right.sort_order) {
            return left.sort_order - right.sort_order;
        }

        const leftUpdated = left.updated_at ?? '';
        const rightUpdated = right.updated_at ?? '';

        if (leftUpdated !== rightUpdated) {
            return rightUpdated.localeCompare(leftUpdated);
        }

        return left.id - right.id;
    });

const activityGroups: Array<{
    title: string;
    items: ActivityDefinition[];
}> = [
    {
        title: 'Content',
        items: [
            {
                type: 'text',
                label: 'Text',
                description: 'Add headings, instructions, steps, or body text.',
                icon: FileText,
            },
            {
                type: 'image',
                label: 'Image',
                description:
                    'Upload a photo, diagram, screenshot, or illustration.',
                icon: ImageIcon,
            },
            {
                type: 'video',
                label: 'Video',
                description: 'Upload a video or embed a supported link.',
                icon: Video,
            },
            {
                type: 'document',
                label: 'File or resource',
                description: 'Attach a job aid, guide, or downloadable file.',
                icon: BookOpen,
            },
            {
                type: 'callout',
                label: 'Callout',
                description:
                    'Highlight information, tips, warnings, or stop conditions.',
                icon: AlertTriangle,
            },
        ],
    },
    {
        title: 'Knowledge checks',
        items: [
            {
                type: 'multiple_choice',
                label: 'Multiple choice',
                description: 'Ask a question with one correct answer.',
                icon: CheckCircle2,
            },
            {
                type: 'true_false',
                label: 'True / False',
                description: 'Add a quick two-option knowledge check.',
                icon: CheckCircle2,
            },
            {
                type: 'ordering',
                label: 'Put in order',
                description:
                    'Have learners arrange steps in the correct sequence.',
                icon: Layers3,
            },
            {
                type: 'matching',
                label: 'Match pairs',
                description: 'Match terms, tools, procedures, or definitions.',
                icon: Layers3,
            },
        ],
    },
];

const gradedBlockTypes = new Set([
    'multiple_choice',
    'true_false',
    'ordering',
    'matching',
]);

function isGradedBlock(block: LessonBlock): boolean {
    return gradedBlockTypes.has(block.type);
}

function courseToDraft(course: Course): CourseDraft {
    return {
        title: course.title,
        slug: course.slug,
        content_type: course.content_type,
        subject: course.subject ?? '',
        description: course.description ?? '',
        learning_objectives: Array.isArray(course.learning_objectives)
            ? course.learning_objectives.join('\n')
            : '',
        estimated_minutes:
            course.estimated_minutes !== null
                ? String(course.estimated_minutes)
                : '',
        passing_score:
            course.passing_score !== null ? String(course.passing_score) : '',
        pathway_id: course.pathway_id !== null ? String(course.pathway_id) : '',
        status: course.status,
        published_at: toDatetimeLocal(course.published_at),
    };
}

function lessonToDraft(lesson: Lesson): LessonDraft {
    return {
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        body: lesson.body ?? '',
        position: lesson.position,
        duration_minutes:
            lesson.duration_minutes !== null
                ? String(lesson.duration_minutes)
                : '',
        is_final_assessment: lesson.is_final_assessment,
        status: lesson.status,
        published_at: toDatetimeLocal(lesson.published_at),
        content: normalizeBlocks(lesson.content, lesson.body),
    };
}

function normalizeBlocks(
    blocks: LessonBlock[] | null | undefined,
    body: string | null,
): LessonBlock[] {
    if (Array.isArray(blocks) && blocks.length > 0) {
        return blocks.map((block) => ({
            ...cloneBlock(block),
            id:
                typeof block.id === 'string' && block.id !== ''
                    ? block.id
                    : uid(),
        }));
    }

    if (body && body.trim() !== '') {
        return [
            {
                id: uid(),
                type: 'text',
                text: body,
            },
        ];
    }

    return [];
}

function cloneBlock(block: LessonBlock): LessonBlock {
    return JSON.parse(JSON.stringify(block)) as LessonBlock;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex) {
        return [...items];
    }

    const next = [...items];
    const [spliced] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, spliced);

    return next;
}

function uid(prefix = 'block'): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toDatetimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);

    return local.toISOString().slice(0, 16);
}

function fromNumberField(value: string): number | null {
    if (value.trim() === '') {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}

function fieldError(
    errors: Record<string, string>,
    key: string,
): string | undefined {
    return errors[key];
}

function courseStatusVariant(
    status: Course['status'],
): 'default' | 'outline' | 'secondary' {
    if (status === 'published') {
        return 'default';
    }

    if (status === 'archived') {
        return 'secondary';
    }

    return 'outline';
}

function courseContentTypeLabel(contentType: Course['content_type']): string {
    return contentType === 'microlearning' ? 'Microlearning' : 'Full course';
}

function formatAssetSize(sizeBytes: number | null): string {
    if (sizeBytes === null || !Number.isFinite(sizeBytes)) {
        return 'Unknown size';
    }

    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetKindLabel(kind: CourseAsset['kind']): string {
    return kind === 'video' ? 'Video' : 'Document';
}

function assignmentTargetTypeLabel(type: AssignmentTargetType): string {
    switch (type) {
        case 'user':
            return 'Employee';
        case 'team':
            return 'Team';
        case 'job_title':
            return 'Job title';
        case 'location':
            return 'Location';
        case 'pathway':
            return 'Pathway';
        default:
            return 'Target';
    }
}

function assignmentStatusVariant(
    status: CourseAssignmentRow['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'completed':
            return 'default';
        case 'overdue':
            return 'destructive';
        case 'in_progress':
            return 'secondary';
        default:
            return 'outline';
    }
}

function formatAssignmentDate(value: string | null): string {
    if (!value) {
        return 'No due date';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'No due date';
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatAssignmentDateTime(value: string | null): string {
    if (!value) {
        return 'Never';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Never';
    }

    return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function blockLabel(type: string): string {
    switch (type) {
        case 'text':
            return 'Text';
        case 'image':
            return 'Image';
        case 'video':
            return 'Video';
        case 'document':
            return 'File or resource';
        case 'callout':
            return 'Callout';
        case 'multiple_choice':
            return 'Multiple Choice';
        case 'true_false':
            return 'True / False';
        case 'ordering':
            return 'Ordering';
        case 'matching':
            return 'Matching';
        case 'scenario':
            return 'Scenario';
        default:
            return 'Block';
    }
}

function formatBlockTypeSummary(blockTypes: string[]): string {
    if (blockTypes.length === 0) {
        return 'No content yet';
    }

    return blockTypes.map((type) => blockLabel(type)).join(' • ');
}

function createBlock(type: string): LessonBlock {
    switch (type) {
        case 'image':
            return { id: uid(), type, url: '', alt: '', caption: '' };
        case 'video':
            return { id: uid(), type, url: '', caption: '' };
        case 'document':
            return { id: uid(), type, title: '', url: '', description: '' };
        case 'callout':
            return {
                id: uid(),
                type,
                style: 'information',
                text: '',
            };
        case 'multiple_choice':
            return {
                id: uid(),
                type,
                prompt: '',
                choices: [''],
                correct_index: 0,
                correct_feedback: '',
                incorrect_feedback: '',
            };
        case 'true_false':
            return {
                id: uid(),
                type,
                statement: '',
                correct_answer: true,
                correct_feedback: '',
                incorrect_feedback: '',
            };
        case 'ordering':
            return {
                id: uid(),
                type,
                prompt: '',
                items: ['', ''],
            };
        case 'matching':
            return {
                id: uid(),
                type,
                prompt: '',
                pairs: [{ left: '', right: '' }],
            };
        case 'scenario':
            return {
                id: uid(),
                type,
                prompt: '',
                guidance: '',
            };
        case 'text':
        default:
            return { id: uid(), type: 'text', text: '' };
    }
}

function lessonHasContent(lesson: LessonDraft): boolean {
    return lesson.content.some((block) => {
        switch (block.type) {
            case 'text':
                return Boolean(
                    richTextToPlainText(
                        String(block.rich_text ?? block.text ?? ''),
                    ).trim(),
                );
            case 'image':
            case 'video':
            case 'document':
                return Boolean(
                    String(block.url ?? '').trim() ||
                    String(block.caption ?? '').trim() ||
                    String(block.title ?? '').trim(),
                );
            case 'callout':
                return Boolean(String(block.text ?? '').trim());
            case 'multiple_choice':
                return Boolean(String(block.prompt ?? '').trim());
            case 'true_false':
                return Boolean(String(block.statement ?? '').trim());
            case 'ordering':
                return (
                    Boolean(String(block.prompt ?? '').trim()) &&
                    Array.isArray(block.items) &&
                    block.items.filter((item) =>
                        Boolean(String(item ?? '').trim()),
                    ).length >= 2
                );
            case 'matching':
                return Boolean(String(block.prompt ?? '').trim());
            case 'scenario':
                return Boolean(String(block.prompt ?? '').trim());
            default:
                return false;
        }
    });
}

function getBlockSummary(block: LessonBlock): string {
    switch (block.type) {
        case 'text':
            return (
                richTextToPlainText(
                    String(block.rich_text ?? block.text ?? ''),
                ).trim() || 'Empty text block'
            );
        case 'image':
            return (
                String(block.caption ?? block.alt ?? block.url ?? '').trim() ||
                'Image block'
            );
        case 'video':
            return (
                String(block.caption ?? block.url ?? '').trim() || 'Video block'
            );
        case 'document':
            return (
                String(block.title ?? block.url ?? '').trim() ||
                'File or resource'
            );
        case 'callout':
            return String(block.text ?? '').trim() || 'Callout message';
        case 'multiple_choice':
            return (
                String(block.prompt ?? '').trim() || 'Multiple choice question'
            );
        case 'true_false':
            return (
                String(block.statement ?? '').trim() || 'True / False question'
            );
        case 'ordering':
            return String(block.prompt ?? '').trim() || 'Ordering activity';
        case 'matching':
            return String(block.prompt ?? '').trim() || 'Matching activity';
        case 'scenario':
            return String(block.prompt ?? '').trim() || 'Scenario activity';
        default:
            return 'Activity';
    }
}

function CourseBuilderPage({
    organization,
    microlearning_templates,
    pathways,
    course,
    lessons,
    selected_lesson_id,
    selected_assignment_target_type,
    selected_assignment_target_id,
    selected_assignment_due_at,
    selected_workspace_view,
    selected_preview_mode,
    assignments,
    teams,
    jobTitles,
    locations,
    employees,
}: PageProps) {
    const settingsRef = useRef<HTMLDivElement | null>(null);
    const assignmentRef = useRef<HTMLDivElement | null>(null);
    const hasAutoScrolledToAssignmentRef = useRef(false);
    const blockElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const [courseDraft, setCourseDraft] = useState<CourseDraft>(() =>
        courseToDraft(course),
    );
    const [lessonDrafts, setLessonDrafts] = useState<LessonDraft[]>(() =>
        lessons.map((lesson) => lessonToDraft(lesson)),
    );
    const [selectedLessonId, setSelectedLessonId] = useState<number | null>(
        selected_lesson_id ?? lessons[0]?.id ?? null,
    );
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
    const [saveState, setSaveState] = useState<
        'saved' | 'dirty' | 'saving' | 'error'
    >('saved');
    const [courseHasChanges, setCourseHasChanges] = useState(false);
    const [dirtyLessonIds, setDirtyLessonIds] = useState<number[]>([]);
    const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(
        () =>
            selected_workspace_view ??
            (selected_assignment_target_type !== null
                ? 'assignments'
                : 'build'),
    );
    const [activityPickerOpen, setActivityPickerOpen] = useState(false);
    const [activitySearch, setActivitySearch] = useState('');
    const [blockInsertionIndex, setBlockInsertionIndex] = useState<
        number | null
    >(null);
    const [pendingFocusBlockId, setPendingFocusBlockId] = useState<
        string | null
    >(null);
    const [isTesting, setIsTesting] = useState(
        selected_preview_mode === 'full',
    );
    const [readinessOpen, setReadinessOpen] = useState(false);
    const [publishReviewOpen, setPublishReviewOpen] = useState(false);
    const [publishLessonIds, setPublishLessonIds] = useState<number[]>([]);
    const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false);
    const [hasPreviewedAsLearner, setHasPreviewedAsLearner] = useState(
        selected_preview_mode === 'full',
    );
    const [draggingLessonId, setDraggingLessonId] = useState<number | null>(
        null,
    );
    const [dragOverLessonId, setDragOverLessonId] = useState<number | null>(
        null,
    );
    const [draggingBlockIndex, setDraggingBlockIndex] = useState<number | null>(
        null,
    );
    const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(
        null,
    );
    const [courseErrors, setCourseErrors] = useState<Record<string, string>>(
        {},
    );
    const [lessonErrors, setLessonErrors] = useState<Record<string, string>>(
        {},
    );
    const [courseAssets, setCourseAssets] = useState<CourseAsset[]>(() =>
        sortCourseAssets(course.assets ?? []),
    );
    const [assetSearch, setAssetSearch] = useState('');
    const [uploadingMediaBlockId, setUploadingMediaBlockId] = useState<
        string | null
    >(null);
    const [mediaUploadError, setMediaUploadError] = useState<string | null>(
        null,
    );
    const [uploadingAssetKind, setUploadingAssetKind] = useState<
        CourseAsset['kind'] | null
    >(null);
    const [updatingAssetId, setUpdatingAssetId] = useState<number | null>(null);
    const [reorderingAssetKind, setReorderingAssetKind] = useState<
        CourseAsset['kind'] | null
    >(null);
    const [draggingAssetId, setDraggingAssetId] = useState<number | null>(null);
    const [dragOverAssetId, setDragOverAssetId] = useState<number | null>(null);
    const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);
    const [starterTemplateKey, setStarterTemplateKey] = useState(
        microlearning_templates[0]?.key ?? 'quick_policy_refresher',
    );
    const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>({
        targetType: selected_assignment_target_type ?? 'user',
        targetId:
            selected_assignment_target_id !== null
                ? String(selected_assignment_target_id)
                : '',
        dueAt: selected_assignment_due_at ?? '',
        isRequired: true,
        recursEveryDays: '',
    });
    const [assignmentErrors, setAssignmentErrors] = useState<
        Record<string, string>
    >({});
    const [isAssignmentSaving, setIsAssignmentSaving] = useState(false);
    const [pendingAssignmentAction, setPendingAssignmentAction] = useState<{
        id: number;
        kind: 'remind' | 'reassign' | 'delete';
    } | null>(null);

    const selectedPathway = pathways.find(
        (pathway) => pathway.id === Number(courseDraft.pathway_id),
    );
    const isMicrolearning = courseDraft.content_type === 'microlearning';

    const selectedLesson = useMemo(
        () =>
            lessonDrafts.find((lesson) => lesson.id === selectedLessonId) ??
            lessonDrafts[0] ??
            null,
        [lessonDrafts, selectedLessonId],
    );
    const finalAssessment = lessonDrafts.find(
        (lesson) => lesson.is_final_assessment,
    );
    const hasUnsavedChanges = courseHasChanges || dirtyLessonIds.length > 0;

    const activeBlock = selectedLesson?.content[activeBlockIndex] ?? null;

    const readinessChecklist = useMemo(
        () => [
            {
                label: 'Course title added',
                complete: Boolean(courseDraft.title.trim()),
                required: true,
                view: 'settings' as WorkspaceView,
            },
            {
                label: 'Description added',
                complete: Boolean(courseDraft.description.trim()),
                required: true,
                view: 'settings' as WorkspaceView,
            },
            {
                label: 'At least one lesson contains content',
                complete:
                    lessonDrafts.length > 0 &&
                    lessonDrafts.some(lessonHasContent),
                required: true,
                view: 'build' as WorkspaceView,
            },
            {
                label: 'Estimated duration added',
                complete: Boolean(courseDraft.estimated_minutes.trim()),
                required: false,
                view: 'settings' as WorkspaceView,
            },
            {
                label: 'Final assessment added',
                complete: Boolean(finalAssessment?.content.some(isGradedBlock)),
                required: false,
                view: 'build' as WorkspaceView,
            },
            {
                label: 'Learner preview checked',
                complete: hasPreviewedAsLearner,
                required: false,
                view: 'build' as WorkspaceView,
            },
            {
                label: 'Assignment rules configured',
                complete: assignments.length > 0,
                required: false,
                view: 'assignments' as WorkspaceView,
            },
        ],
        [
            assignments.length,
            courseDraft,
            finalAssessment,
            hasPreviewedAsLearner,
            lessonDrafts,
        ],
    );
    const readinessIncompleteCount = readinessChecklist.filter(
        (item) => !item.complete,
    ).length;
    const readinessPercent = Math.round(
        ((readinessChecklist.length - readinessIncompleteCount) /
            readinessChecklist.length) *
            100,
    );
    const selectedPublishLessons = lessonDrafts.filter((lesson) =>
        publishLessonIds.includes(lesson.id),
    );
    const selectedPublishLessonsMissingContent = selectedPublishLessons.filter(
        (lesson) => !lessonHasContent(lesson),
    );
    const finalAssessmentHasQuestions = Boolean(
        finalAssessment?.content.some(isGradedBlock),
    );
    const finalAssessmentMissingFromPublish = Boolean(
        finalAssessment && !publishLessonIds.includes(finalAssessment.id),
    );
    const publishIsBlocked =
        readinessChecklist.some((item) => item.required && !item.complete) ||
        publishLessonIds.length === 0 ||
        selectedPublishLessonsMissingContent.length > 0 ||
        finalAssessmentMissingFromPublish ||
        Boolean(finalAssessment && !finalAssessmentHasQuestions);

    const issues = useMemo(() => {
        const next: string[] = [];

        if (!courseDraft.title.trim()) {
            next.push('Course title is missing.');
        }

        if (
            courseDraft.status === 'published' &&
            !courseDraft.passing_score.trim()
        ) {
            next.push('Published courses should have a passing score.');
        }

        if (
            courseDraft.status === 'published' &&
            !courseDraft.learning_objectives.trim()
        ) {
            next.push('Published courses should include learning objectives.');
        }

        if (
            courseDraft.status === 'published' &&
            !courseDraft.pathway_id.trim()
        ) {
            next.push('Published courses should belong to a pathway.');
        }

        if (lessonDrafts.length === 0) {
            next.push('Add at least one lesson to the outline.');
        }

        const emptyLessons = lessonDrafts.filter(
            (lesson) => !lessonHasContent(lesson),
        );

        if (emptyLessons.length > 0) {
            next.push(
                `${emptyLessons.length} lesson${emptyLessons.length === 1 ? '' : 's'} still need content.`,
            );
        }

        return next;
    }, [courseDraft, lessonDrafts]);

    const resultsSummary = useMemo(() => {
        const recipients = assignments.reduce(
            (total, assignment) => total + assignment.recipient_count,
            0,
        );
        const completed = assignments.reduce(
            (total, assignment) => total + assignment.completed_count,
            0,
        );

        return {
            recipients,
            completed,
            overdue: assignments.reduce(
                (total, assignment) => total + assignment.overdue_count,
                0,
            ),
            failed: assignments.reduce(
                (total, assignment) => total + assignment.failed_count,
                0,
            ),
            completionRate:
                recipients > 0 ? Math.round((completed / recipients) * 100) : 0,
        };
    }, [assignments]);

    const selectedLessonIndex = lessonDrafts.findIndex(
        (lesson) => lesson.id === selectedLessonId,
    );

    const learningObjectives = useMemo(
        () =>
            courseDraft.learning_objectives
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean),
        [courseDraft.learning_objectives],
    );

    const orderedCourseAssets = useMemo(
        () => sortCourseAssets(courseAssets),
        [courseAssets],
    );

    const visibleActivityGroups = useMemo(() => {
        const query = activitySearch.trim().toLowerCase();
        const availableGroups = selectedLesson?.is_final_assessment
            ? activityGroups.filter(
                  (group) => group.title === 'Knowledge checks',
              )
            : activityGroups;

        if (!query) {
            return availableGroups;
        }

        return availableGroups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                    [group.title, item.label, item.description]
                        .join(' ')
                        .toLowerCase()
                        .includes(query),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [activitySearch, selectedLesson?.is_final_assessment]);
    const selectedStarterTemplate = useMemo(
        () =>
            microlearning_templates.find(
                (template) => template.key === starterTemplateKey,
            ) ??
            microlearning_templates[0] ??
            null,
        [microlearning_templates, starterTemplateKey],
    );
    const selectedLessonActivitySummary = useMemo(
        () =>
            formatBlockTypeSummary(
                selectedLesson?.content.map((block) => block.type) ?? [],
            ),
        [selectedLesson],
    );
    const selectedStarterTemplateActivitySummary = useMemo(
        () =>
            selectedStarterTemplate
                ? formatBlockTypeSummary(selectedStarterTemplate.block_types)
                : 'No content yet',
        [selectedStarterTemplate],
    );

    const normalizedAssetSearch = assetSearch.trim().toLowerCase();

    const assetMatchesSearch = useCallback(
        (asset: CourseAsset) => {
            if (!normalizedAssetSearch) {
                return true;
            }

            const searchableTerms = [
                asset.original_name,
                asset.mime_type ?? '',
                asset.url,
                asset.kind,
                ...asset.usage_lessons.map((lesson) => lesson.lesson_title),
            ]
                .join(' ')
                .toLowerCase();

            return searchableTerms.includes(normalizedAssetSearch);
        },
        [normalizedAssetSearch],
    );

    const videoAssets = useMemo(
        () =>
            orderedCourseAssets.filter(
                (asset) => asset.kind === 'video' && assetMatchesSearch(asset),
            ),
        [orderedCourseAssets, assetMatchesSearch],
    );

    const documentAssets = useMemo(
        () =>
            orderedCourseAssets.filter(
                (asset) =>
                    asset.kind === 'document' && assetMatchesSearch(asset),
            ),
        [orderedCourseAssets, assetMatchesSearch],
    );

    const visibleAssetCount = videoAssets.length + documentAssets.length;

    const assignmentTargetOptions = useMemo(() => {
        switch (assignmentDraft.targetType) {
            case 'user':
                return employees.map((employee) => ({
                    id: employee.id,
                    label: employee.name,
                    description:
                        [
                            employee.email,
                            employee.job_title?.name,
                            employee.location?.name,
                        ]
                            .filter(Boolean)
                            .join(' • ') || null,
                }));
            case 'team':
                return teams.map((team) => ({
                    id: team.id,
                    label: team.name,
                    description: null,
                }));
            case 'job_title':
                return jobTitles.map((jobTitle) => ({
                    id: jobTitle.id,
                    label: jobTitle.name,
                    description: null,
                }));
            case 'location':
                return locations.map((location) => ({
                    id: location.id,
                    label: location.name,
                    description: null,
                }));
            default:
                return [];
        }
    }, [assignmentDraft.targetType, employees, jobTitles, locations, teams]);

    const assignmentTargetValue = useMemo(() => {
        if (assignmentTargetOptions.length === 0) {
            return '';
        }

        const hasSelection = assignmentTargetOptions.some(
            (option) => String(option.id) === assignmentDraft.targetId,
        );

        return hasSelection
            ? assignmentDraft.targetId
            : String(assignmentTargetOptions[0].id);
    }, [assignmentDraft.targetId, assignmentTargetOptions]);

    const assignmentStatusCounts = useMemo(
        () => ({
            total: assignments.length,
            completed: assignments.filter(
                (assignment) => assignment.status === 'completed',
            ).length,
            overdue: assignments.filter(
                (assignment) => assignment.status === 'overdue',
            ).length,
            inProgress: assignments.filter(
                (assignment) => assignment.status === 'in_progress',
            ).length,
        }),
        [assignments],
    );

    const selectedAssignmentTarget = useMemo(
        () =>
            assignmentTargetOptions.find(
                (option) => String(option.id) === assignmentTargetValue,
            ) ?? null,
        [assignmentTargetOptions, assignmentTargetValue],
    );

    const assignmentTargetError =
        fieldError(assignmentErrors, 'targetId') ||
        fieldError(assignmentErrors, 'assigned_to_user_id') ||
        fieldError(assignmentErrors, 'assigned_to_team_id') ||
        fieldError(assignmentErrors, 'assigned_to_job_title_id') ||
        fieldError(assignmentErrors, 'assigned_to_location_id');

    useEffect(() => {
        if (
            selected_assignment_target_type === null ||
            selected_assignment_target_id === null ||
            hasAutoScrolledToAssignmentRef.current
        ) {
            return;
        }

        setWorkspaceView('assignments');
        hasAutoScrolledToAssignmentRef.current = true;
    }, [selected_assignment_target_id, selected_assignment_target_type]);

    useEffect(() => {
        if (!pendingFocusBlockId) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const blockElement =
                blockElementRefs.current.get(pendingFocusBlockId);

            if (!blockElement) {
                return;
            }

            blockElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });

            const firstField = blockElement.querySelector<HTMLElement>(
                'textarea, input:not([type="file"]), select, [contenteditable="true"]',
            );
            firstField?.focus({ preventScroll: true });
            setPendingFocusBlockId(null);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [pendingFocusBlockId, selectedLesson]);

    const updateCourseDraft = (patch: Partial<CourseDraft>) => {
        setCourseDraft((current) => ({ ...current, ...patch }));
        setCourseHasChanges(true);
        setSaveState('dirty');
        setCourseErrors({});
    };

    const updateLessonDraft = (
        lessonId: number,
        updater: (lesson: LessonDraft) => LessonDraft,
    ) => {
        setLessonDrafts((current) =>
            current.map((lesson) =>
                lesson.id === lessonId ? updater(lesson) : lesson,
            ),
        );
        setDirtyLessonIds((current) =>
            current.includes(lessonId) ? current : [...current, lessonId],
        );
        setSaveState('dirty');
        setLessonErrors({});
    };

    const updateSelectedLesson = (
        updater: (lesson: LessonDraft) => LessonDraft,
    ) => {
        if (selectedLessonId === null) {
            return;
        }

        updateLessonDraft(selectedLessonId, updater);
    };

    const syncLessonOrder = (nextLessons: LessonDraft[]) => {
        setSaveTarget('lesson');
        setSaveState('saving');
        setLessonErrors({});

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/lessons/reorder`,
            {
                lesson_ids: nextLessons.map((lesson) => lesson.id),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => {
                    setSaveState('dirty');
                },
                onSuccess: () => {
                    setSaveState('saved');
                },
                onFinish: () => {
                    setSaveTarget(null);
                },
            },
        );
    };

    const updateSelectedBlock = (
        index: number,
        updater: (block: LessonBlock) => LessonBlock,
    ) => {
        updateSelectedLesson((lesson) => ({
            ...lesson,
            content: lesson.content.map((block, blockIndex) =>
                blockIndex === index ? updater(block) : block,
            ),
        }));
    };

    const reorderSelectedBlocks = (fromIndex: number, toIndex: number) => {
        if (!selectedLesson) {
            return;
        }

        const activeBlockId =
            selectedLesson.content[activeBlockIndex]?.id ?? null;
        const nextBlocks = moveItem(selectedLesson.content, fromIndex, toIndex);

        updateSelectedLesson((lesson) => ({
            ...lesson,
            content: nextBlocks,
        }));

        if (!activeBlockId) {
            setActiveBlockIndex(toIndex);

            return;
        }

        const nextIndex = nextBlocks.findIndex(
            (block) => block.id === activeBlockId,
        );
        setActiveBlockIndex(nextIndex >= 0 ? nextIndex : toIndex);
    };

    const openActivityPicker = (insertionIndex: number) => {
        setBlockInsertionIndex(insertionIndex);
        setActivitySearch('');
        setActivityPickerOpen(true);
    };

    const addBlock = (type: string) => {
        const block = createBlock(type);
        const fallbackIndex = selectedLesson?.content.length ?? 0;
        const insertionIndex = Math.min(
            Math.max(blockInsertionIndex ?? fallbackIndex, 0),
            fallbackIndex,
        );

        updateSelectedLesson((lesson) => {
            const content = [...lesson.content];
            content.splice(insertionIndex, 0, block);

            return { ...lesson, content };
        });
        setActiveBlockIndex(insertionIndex);
        setPendingFocusBlockId(block.id);
        setActivityPickerOpen(false);
        setBlockInsertionIndex(null);
    };

    const duplicateBlock = (index: number) => {
        if (!selectedLesson) {
            return;
        }

        updateSelectedLesson((lesson) => {
            const source = lesson.content[index];

            if (!source) {
                return lesson;
            }

            const duplicate = { ...source, id: uid() };
            const content = [...lesson.content];
            content.splice(index + 1, 0, duplicate);

            return { ...lesson, content };
        });
        setActiveBlockIndex(index + 1);
    };

    const removeBlock = (index: number) => {
        if (!selectedLesson) {
            return;
        }

        updateSelectedLesson((lesson) => ({
            ...lesson,
            content: lesson.content.filter(
                (_, blockIndex) => blockIndex !== index,
            ),
        }));

        setActiveBlockIndex((current) => {
            if (current > index) {
                return current - 1;
            }

            if (current === index) {
                return Math.max(0, index - 1);
            }

            return current;
        });
    };

    const reorderLessons = (fromLessonId: number, toLessonId: number) => {
        if (fromLessonId === toLessonId) {
            setDraggingLessonId(null);
            setDragOverLessonId(null);

            return;
        }

        const fromIndex = lessonDrafts.findIndex(
            (lesson) => lesson.id === fromLessonId,
        );
        const toIndex = lessonDrafts.findIndex(
            (lesson) => lesson.id === toLessonId,
        );

        if (fromIndex < 0 || toIndex < 0) {
            setDraggingLessonId(null);
            setDragOverLessonId(null);

            return;
        }

        const movedLessons = moveItem(lessonDrafts, fromIndex, toIndex);
        const assessment = movedLessons.find(
            (lesson) => lesson.is_final_assessment,
        );
        const orderedLessons = assessment
            ? [
                  ...movedLessons.filter(
                      (lesson) => !lesson.is_final_assessment,
                  ),
                  assessment,
              ]
            : movedLessons;
        const nextLessons = orderedLessons.map((lesson, index) => ({
            ...lesson,
            position: index + 1,
        }));

        setLessonDrafts(nextLessons);
        syncLessonOrder(nextLessons);
        setDraggingLessonId(null);
        setDragOverLessonId(null);
    };

    const saveCourse = (
        nextStatus?: CourseDraft['status'],
        publishedLessonIds?: number[],
        onSaved?: () => void,
    ) => {
        setSaveTarget('course');
        setSaveState('saving');
        setCourseErrors({});

        const payload = {
            title: courseDraft.title.trim(),
            slug: courseDraft.slug.trim() || null,
            content_type: courseDraft.content_type,
            subject: courseDraft.subject.trim() || null,
            description: courseDraft.description.trim() || null,
            learning_objectives: courseDraft.learning_objectives.trim() || null,
            estimated_minutes: fromNumberField(courseDraft.estimated_minutes),
            passing_score: fromNumberField(courseDraft.passing_score),
            pathway_id: fromNumberField(courseDraft.pathway_id),
            status: nextStatus ?? courseDraft.status,
            published_at: courseDraft.published_at || null,
            ...(publishedLessonIds !== undefined
                ? { published_lesson_ids: publishedLessonIds }
                : {}),
        };

        if (
            (nextStatus ?? courseDraft.status) === 'published' &&
            !payload.published_at
        ) {
            payload.published_at = new Date().toISOString();
        }

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}`,
            payload,
            {
                preserveScroll: true,
                onError: (errors) => {
                    setCourseErrors(errors as Record<string, string>);
                    setSaveState('error');
                },
                onSuccess: () => {
                    if (nextStatus) {
                        setCourseDraft((current) => ({
                            ...current,
                            status: nextStatus,
                            published_at:
                                payload.published_at ?? current.published_at,
                        }));
                    }

                    if (publishedLessonIds !== undefined) {
                        const publishedLessonIdSet = new Set(
                            publishedLessonIds,
                        );

                        setLessonDrafts((current) =>
                            current.map((lesson) => ({
                                ...lesson,
                                status: publishedLessonIdSet.has(lesson.id)
                                    ? 'published'
                                    : 'draft',
                                published_at: publishedLessonIdSet.has(
                                    lesson.id,
                                )
                                    ? lesson.published_at ||
                                      new Date().toISOString()
                                    : '',
                            })),
                        );
                        setPublishReviewOpen(false);
                    }

                    setCourseHasChanges(false);
                    setSaveState('saved');

                    if (onSaved) {
                        window.setTimeout(onSaved, 0);
                    }
                },
                onFinish: () => {
                    setSaveTarget(null);
                },
            },
        );
    };

    const openPublishReview = () => {
        const currentlyPublishedLessonIds = lessonDrafts
            .filter((lesson) => lesson.status === 'published')
            .map((lesson) => lesson.id);
        const readyLessonIds = lessonDrafts
            .filter(lessonHasContent)
            .map((lesson) => lesson.id);
        const initialLessonIds =
            courseDraft.status === 'published' &&
            currentlyPublishedLessonIds.length > 0
                ? currentlyPublishedLessonIds
                : readyLessonIds;

        if (finalAssessment && finalAssessmentHasQuestions) {
            initialLessonIds.push(finalAssessment.id);
        }

        setPublishLessonIds(Array.from(new Set(initialLessonIds)));
        setPublishReviewOpen(true);
    };

    const uploadCourseAsset = async (file: File, kind: CourseAsset['kind']) => {
        const formData = new FormData();
        formData.append('asset_kind', kind);
        formData.append('file', file);

        const csrfToken = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
        )?.content;

        const response = await fetch(
            `/organizations/${organization.id}/courses/${course.id}/assets`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                body: formData,
            },
        );

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
                message?: string;
                errors?: Record<string, string[]>;
            } | null;
            const message =
                payload?.message ??
                Object.values(payload?.errors ?? {})
                    .flat()
                    .filter(Boolean)
                    .join(' ') ??
                'Upload failed.';

            throw new Error(message);
        }

        const payload = (await response.json()) as {
            asset?: CourseAsset;
            url: string;
            original_name: string;
            kind: CourseAsset['kind'];
        };

        if (payload.asset) {
            setCourseAssets((current) =>
                sortCourseAssets([
                    ...current.filter(
                        (asset) => asset.id !== payload.asset?.id,
                    ),
                    payload.asset as CourseAsset,
                ]),
            );

            return payload.asset;
        }

        return null;
    };

    const replaceCourseAsset = async (asset: CourseAsset, file: File) => {
        setUpdatingAssetId(asset.id);
        setMediaUploadError(null);

        try {
            const formData = new FormData();
            formData.append('_method', 'PATCH');
            formData.append('file', file);

            const csrfToken = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;

            const response = await fetch(
                `/organizations/${organization.id}/courses/${course.id}/assets/${asset.id}`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
                    body: formData,
                },
            );

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as {
                    message?: string;
                    errors?: Record<string, string[]>;
                } | null;
                const message =
                    payload?.message ??
                    Object.values(payload?.errors ?? {})
                        .flat()
                        .filter(Boolean)
                        .join(' ') ??
                    'Replace failed.';

                throw new Error(message);
            }

            const payload = (await response.json()) as {
                asset?: CourseAsset;
            };

            if (payload.asset) {
                setCourseAssets((current) =>
                    current.map((currentAsset) =>
                        currentAsset.id === payload.asset?.id
                            ? (payload.asset as CourseAsset)
                            : currentAsset,
                    ),
                );
            }
        } catch (error) {
            setMediaUploadError(
                error instanceof Error ? error.message : 'Replace failed.',
            );
        } finally {
            setUpdatingAssetId(null);
        }
    };

    const deleteCourseAsset = async (asset: CourseAsset) => {
        if (
            !window.confirm(
                asset.usage_count > 0
                    ? `Delete ${asset.original_name}? It is used in ${asset.usage_count} lesson block${asset.usage_count === 1 ? '' : 's'}, so deleting it may break those lessons.`
                    : `Delete ${asset.original_name}?`,
            )
        ) {
            return;
        }

        setUpdatingAssetId(asset.id);
        setMediaUploadError(null);

        try {
            const csrfToken = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;

            const response = await fetch(
                `/organizations/${organization.id}/courses/${course.id}/assets/${asset.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
                },
            );

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as {
                    message?: string;
                    errors?: Record<string, string[]>;
                } | null;
                const message =
                    payload?.message ??
                    Object.values(payload?.errors ?? {})
                        .flat()
                        .filter(Boolean)
                        .join(' ') ??
                    'Delete failed.';

                throw new Error(message);
            }

            setCourseAssets((current) =>
                current.filter((currentAsset) => currentAsset.id !== asset.id),
            );
        } catch (error) {
            setMediaUploadError(
                error instanceof Error ? error.message : 'Delete failed.',
            );
        } finally {
            setUpdatingAssetId(null);
        }
    };

    const reorderCourseAssets = async (
        kind: CourseAsset['kind'],
        nextAssets: CourseAsset[],
    ) => {
        const previousAssets = courseAssets;

        setReorderingAssetKind(kind);
        setCourseAssets((current) => {
            const nextOrder = new Map(
                nextAssets.map((asset, index) => [asset.id, index + 1]),
            );

            return sortCourseAssets(
                current.map((asset) =>
                    asset.kind === kind && nextOrder.has(asset.id)
                        ? {
                              ...asset,
                              sort_order:
                                  nextOrder.get(asset.id) ?? asset.sort_order,
                          }
                        : asset,
                ),
            );
        });

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/assets/reorder`,
            {
                kind,
                asset_ids: nextAssets.map((asset) => asset.id),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => {
                    setCourseAssets(previousAssets);
                },
                onFinish: () => {
                    setReorderingAssetKind(null);
                },
            },
        );
    };

    const startAssetDrag = (assetId: number) => {
        if (normalizedAssetSearch) {
            return;
        }

        setDraggingAssetId(assetId);
        setDragOverAssetId(assetId);
    };

    const cancelAssetDrag = () => {
        setDraggingAssetId(null);
        setDragOverAssetId(null);
    };

    const handleAssetDrop = (kind: CourseAsset['kind'], targetId: number) => {
        if (draggingAssetId === null || normalizedAssetSearch) {
            cancelAssetDrag();

            return;
        }

        const assetsInGroup = orderedCourseAssets.filter(
            (asset) => asset.kind === kind,
        );
        const fromIndex = assetsInGroup.findIndex(
            (asset) => asset.id === draggingAssetId,
        );
        const toIndex = assetsInGroup.findIndex(
            (asset) => asset.id === targetId,
        );

        if (fromIndex < 0 || toIndex < 0) {
            cancelAssetDrag();

            return;
        }

        const nextAssets = moveItem(assetsInGroup, fromIndex, toIndex).map(
            (asset, index) => ({
                ...asset,
                sort_order: index + 1,
            }),
        );

        void reorderCourseAssets(kind, nextAssets);
        cancelAssetDrag();
    };

    const uploadBlockAsset = async (
        index: number,
        file: File,
        kind: CourseAsset['kind'],
    ) => {
        if (!selectedLesson) {
            return;
        }

        const block = selectedLesson.content[index];

        if (!block) {
            return;
        }

        setUploadingMediaBlockId(block.id);
        setMediaUploadError(null);

        try {
            const asset = await uploadCourseAsset(file, kind);

            if (!asset) {
                return;
            }

            updateSelectedBlock(index, (current) => {
                if (kind === 'video') {
                    return {
                        ...current,
                        url: asset.url,
                        caption:
                            String(current.caption ?? '').trim() ||
                            asset.original_name,
                    };
                }

                const baseName = asset.original_name.replace(/\.[^.]+$/, '');

                return {
                    ...current,
                    url: asset.url,
                    title: String(current.title ?? '').trim() || baseName,
                };
            });
        } catch (error) {
            setMediaUploadError(
                error instanceof Error ? error.message : 'Upload failed.',
            );
        } finally {
            setUploadingMediaBlockId(null);
        }
    };

    const uploadPanelAsset = async (file: File, kind: CourseAsset['kind']) => {
        setUploadingAssetKind(kind);
        setMediaUploadError(null);

        try {
            await uploadCourseAsset(file, kind);
        } catch (error) {
            setMediaUploadError(
                error instanceof Error ? error.message : 'Upload failed.',
            );
        } finally {
            setUploadingAssetKind(null);
        }
    };

    const applyAssetToSelectedBlock = (asset: CourseAsset) => {
        if (!selectedLesson) {
            return;
        }

        const block = selectedLesson.content[activeBlockIndex];

        if (!block) {
            return;
        }

        if (
            (asset.kind === 'video' && block.type !== 'video') ||
            (asset.kind === 'document' && block.type !== 'document')
        ) {
            return;
        }

        updateSelectedBlock(activeBlockIndex, (current) => {
            if (asset.kind === 'video') {
                return {
                    ...current,
                    url: asset.url,
                    caption:
                        String(current.caption ?? '').trim() ||
                        asset.original_name,
                };
            }

            return {
                ...current,
                url: asset.url,
                title:
                    String(current.title ?? '').trim() ||
                    asset.original_name.replace(/\.[^.]+$/, ''),
            };
        });
    };

    const copyAssetUrl = async (asset: CourseAsset) => {
        try {
            await navigator.clipboard.writeText(asset.url);
            setCopiedAssetId(asset.id);
            window.setTimeout(() => {
                setCopiedAssetId((current) =>
                    current === asset.id ? null : current,
                );
            }, 1500);
        } catch {
            setMediaUploadError(
                'Could not copy the link. You can still use the URL field.',
            );
        }
    };

    const duplicateCourse = () => {
        router.post(
            `/organizations/${organization.id}/courses/${course.id}/duplicate`,
            {},
            {
                preserveScroll: true,
            },
        );
    };

    const archiveCourse = () => {
        if (
            !window.confirm(
                `Archive ${courseDraft.title || 'this course'}? It will stay in the library but disappear from learner views.`,
            )
        ) {
            return;
        }

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/archive`,
            {},
            {
                preserveScroll: true,
            },
        );
    };

    const saveLesson = (
        onSaved?: () => void,
        lessonToSave: LessonDraft | null = selectedLesson,
    ) => {
        if (!lessonToSave) {
            return;
        }

        setSaveTarget('lesson');
        setSaveState('saving');
        setLessonErrors({});

        const payload = {
            title: lessonToSave.title.trim(),
            slug: lessonToSave.slug.trim() || null,
            body: lessonToSave.body.trim() || null,
            content: lessonToSave.content,
            position: lessonToSave.position,
            duration_minutes: fromNumberField(lessonToSave.duration_minutes),
            status: lessonToSave.status,
            published_at: lessonToSave.published_at || null,
        };

        if (lessonToSave.status === 'published' && !payload.published_at) {
            payload.published_at = new Date().toISOString();
        }

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/lessons/${lessonToSave.id}`,
            payload as any,
            {
                preserveScroll: true,
                onError: (errors) => {
                    setLessonErrors(errors as Record<string, string>);
                    setSaveState('error');
                },
                onSuccess: () => {
                    setDirtyLessonIds((current) =>
                        current.filter((id) => id !== lessonToSave.id),
                    );
                    setSaveState('saved');

                    if (onSaved) {
                        window.setTimeout(onSaved, 0);
                    }
                },
                onFinish: () => {
                    setSaveTarget(null);
                },
            },
        );
    };

    const saveChanges = (onSaved?: () => void) => {
        const lessonsToSave = dirtyLessonIds
            .map((lessonId) =>
                lessonDrafts.find((lesson) => lesson.id === lessonId),
            )
            .filter((lesson): lesson is LessonDraft => lesson !== undefined);

        const saveCourseChanges = () => {
            if (courseHasChanges) {
                saveCourse(undefined, undefined, onSaved);

                return;
            }

            setSaveState('saved');
            onSaved?.();
        };

        const saveNextLesson = (index: number) => {
            const lesson = lessonsToSave[index];

            if (!lesson) {
                saveCourseChanges();

                return;
            }

            saveLesson(() => saveNextLesson(index + 1), lesson);
        };

        if (lessonsToSave.length > 0) {
            saveNextLesson(0);

            return;
        }

        saveCourseChanges();
    };

    const createLessonRecord = (isFinalAssessment = false) => {
        const title = isFinalAssessment
            ? 'Final assessment'
            : isMicrolearning
              ? 'Quick lesson'
              : 'Untitled lesson';
        setSaveState('saving');
        setSaveTarget('lesson');
        setLessonErrors({});

        router.post(
            `/organizations/${organization.id}/courses/${course.id}/lessons`,
            {
                title,
                status: 'draft',
                is_final_assessment: isFinalAssessment,
                position: isFinalAssessment
                    ? lessonDrafts.length + 1
                    : selectedLesson
                      ? selectedLesson.position + 1
                      : undefined,
            },
            {
                preserveScroll: true,
                onError: (errors) => {
                    setLessonErrors(errors as Record<string, string>);
                    setSaveState('dirty');
                },
                onSuccess: () => {
                    setSaveState('saved');
                },
                onFinish: () => {
                    setSaveTarget(null);
                },
            },
        );
    };

    const createLesson = () => {
        if (saveState === 'saving') {
            return;
        }

        if (hasUnsavedChanges) {
            saveChanges(createLessonRecord);

            return;
        }

        createLessonRecord();
    };

    const createFinalAssessment = () => {
        if (
            saveState === 'saving' ||
            isMicrolearning ||
            finalAssessment !== undefined
        ) {
            return;
        }

        if (hasUnsavedChanges) {
            saveChanges(() => createLessonRecord(true));

            return;
        }

        createLessonRecord(true);
    };

    const replaceStarterTemplate = () => {
        if (!isMicrolearning) {
            return;
        }

        router.patch(
            `/organizations/${organization.id}/courses/${course.id}/starter-template`,
            {
                starter_template: starterTemplateKey,
            },
            {
                preserveScroll: true,
                onError: (errors) => {
                    setCourseErrors(errors as Record<string, string>);
                },
            },
        );
    };

    const createAssignment = () => {
        if (assignmentTargetOptions.length === 0) {
            setAssignmentErrors({
                targetId:
                    'Add at least one valid target before assigning the course.',
            });

            return;
        }

        const targetId = fromNumberField(assignmentTargetValue);

        if (targetId === null) {
            setAssignmentErrors({
                targetId: 'Choose a target for the assignment.',
            });

            return;
        }

        setIsAssignmentSaving(true);
        setAssignmentErrors({});

        const payload: Record<string, string | number | boolean | null> = {
            due_at: assignmentDraft.dueAt || null,
            is_required: assignmentDraft.isRequired,
            recurs_every_days: fromNumberField(assignmentDraft.recursEveryDays),
        };

        switch (assignmentDraft.targetType) {
            case 'user':
                payload.assigned_to_user_id = targetId;
                break;
            case 'team':
                payload.assigned_to_team_id = targetId;
                break;
            case 'job_title':
                payload.assigned_to_job_title_id = targetId;
                break;
            case 'location':
                payload.assigned_to_location_id = targetId;
                break;
        }

        router.post(
            `/organizations/${organization.id}/courses/${course.id}/assignments`,
            payload,
            {
                preserveScroll: true,
                onError: (errors) => {
                    setAssignmentErrors(errors as Record<string, string>);
                },
                onSuccess: () => {
                    setAssignmentDraft((current) => ({
                        ...current,
                        dueAt: '',
                        isRequired: true,
                        recursEveryDays: '',
                    }));
                },
                onFinish: () => {
                    setIsAssignmentSaving(false);
                },
            },
        );
    };

    const runAssignmentAction = (
        assignment: CourseAssignmentRow,
        kind: 'remind' | 'reassign' | 'delete',
    ) => {
        setPendingAssignmentAction({
            id: assignment.id,
            kind,
        });

        const options = {
            preserveScroll: true,
            onFinish: () => {
                setPendingAssignmentAction(null);
            },
        } as const;

        if (kind === 'delete') {
            if (
                !window.confirm(
                    `Delete this assignment for ${assignment.assigned_to.name ?? 'the selected audience'}?`,
                )
            ) {
                setPendingAssignmentAction(null);

                return;
            }

            router.delete(
                `/organizations/${organization.id}/courses/${course.id}/assignments/${assignment.id}`,
                options,
            );

            return;
        }

        router.post(
            `/organizations/${organization.id}/courses/${course.id}/assignments/${assignment.id}/${kind === 'remind' ? 'remind' : 'reassign'}`,
            kind === 'reassign'
                ? {
                      due_at:
                          assignment.due_at === null
                              ? null
                              : assignment.due_at.slice(0, 10),
                  }
                : ({} as Record<string, string | number | boolean | null>),
            options,
        );
    };

    const deleteCourse = () => {
        if (
            !window.confirm(
                `Delete ${courseDraft.title || 'this course'}? This cannot be undone.`,
            )
        ) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/courses/${course.id}`,
            {
                preserveScroll: true,
            },
        );
    };

    const deleteLesson = () => {
        if (!selectedLesson) {
            return;
        }

        if (
            !window.confirm(
                courseDraft.status === 'published'
                    ? `Remove ${selectedLesson.title || 'this lesson'}? This affects assigned learners. Existing completion records will be preserved.`
                    : `Delete ${selectedLesson.title || 'this lesson'}? This cannot be undone.`,
            )
        ) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/courses/${course.id}/lessons/${selectedLesson.id}`,
            {
                preserveScroll: true,
            },
        );
    };

    const duplicateLesson = () => {
        if (!selectedLesson || isMicrolearning) {
            return;
        }

        router.post(
            `/organizations/${organization.id}/courses/${course.id}/lessons/${selectedLesson.id}/duplicate`,
            {},
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={`${course.title} builder`} />

            <main className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-6 lg:p-8">
                <div className="sticky top-4 z-30 rounded-3xl border bg-background/95 p-4 shadow-sm backdrop-blur">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button asChild variant="ghost" className="-ml-2">
                                <Link
                                    href={`/organizations/${organization.id}/courses`}
                                >
                                    <ArrowLeft className="size-4" />
                                    Courses
                                </Link>
                            </Button>

                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-2xl font-semibold tracking-tight">
                                        {courseDraft.title || 'Untitled course'}
                                    </h1>
                                    <Badge variant="outline">
                                        {courseContentTypeLabel(
                                            courseDraft.content_type,
                                        )}
                                    </Badge>
                                    {isMicrolearning && (
                                        <Badge variant="secondary">
                                            One lesson by default
                                        </Badge>
                                    )}
                                    <Badge
                                        variant={courseStatusVariant(
                                            courseDraft.status,
                                        )}
                                    >
                                        {courseDraft.status === 'published'
                                            ? 'Published'
                                            : 'Draft'}
                                    </Badge>
                                    {saveState === 'saving' ? (
                                        <Badge variant="outline">
                                            <Spinner />
                                            Saving {saveTarget ?? 'changes'}…
                                        </Badge>
                                    ) : saveState === 'error' ? (
                                        <Badge variant="destructive">
                                            Changes could not be saved
                                        </Badge>
                                    ) : hasUnsavedChanges ? null : (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                            <CheckCircle2 className="size-3.5" />
                                            All changes saved
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {courseDraft.subject ||
                                        selectedPathway?.name ||
                                        (isMicrolearning
                                            ? 'Keep this lesson short and focused on one behavior.'
                                            : 'Use the outline and content editor to build the course.')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {hasUnsavedChanges && (
                                <Button
                                    variant="outline"
                                    onClick={() => saveChanges()}
                                    disabled={saveState === 'saving'}
                                >
                                    {saveState === 'saving' ? (
                                        <Spinner />
                                    ) : (
                                        <Save className="size-4" />
                                    )}
                                    {saveState === 'saving'
                                        ? 'Saving changes'
                                        : 'Save changes'}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setHasPreviewedAsLearner(true);
                                    setIsTesting(true);
                                }}
                                disabled={lessonDrafts.length === 0}
                            >
                                <Eye className="size-4" />
                                Preview as learner
                            </Button>
                            <Button onClick={openPublishReview}>
                                <Save className="size-4" />
                                {courseDraft.status === 'published'
                                    ? 'Publish changes'
                                    : 'Publish course'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border bg-card/95 p-2 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div
                            className="flex gap-1 overflow-x-auto"
                            role="tablist"
                            aria-label="Course builder workspace"
                        >
                            {(
                                [
                                    {
                                        id: 'build',
                                        label: 'Content',
                                        icon: Layers3,
                                    },
                                    {
                                        id: 'settings',
                                        label: 'Settings',
                                        icon: Settings2,
                                    },
                                    {
                                        id: 'assignments',
                                        label: 'Assignments',
                                        icon: Bell,
                                    },
                                    {
                                        id: 'results',
                                        label: 'Results',
                                        icon: BarChart3,
                                    },
                                ] as const
                            ).map((item) => {
                                const Icon = item.icon;
                                const active = workspaceView === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() =>
                                            setWorkspaceView(item.id)
                                        }
                                        className={`flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-left whitespace-nowrap transition-colors ${
                                            active
                                                ? 'bg-slate-950 text-white shadow-sm'
                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                        }`}
                                    >
                                        <Icon className="size-4 shrink-0" />
                                        <span className="text-sm font-semibold">
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => setReadinessOpen(true)}
                            className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted lg:min-w-64"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="font-medium">
                                        Course readiness
                                    </span>
                                    <span className="font-semibold">
                                        {readinessPercent}%
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                                        style={{
                                            width: `${readinessPercent}%`,
                                        }}
                                    />
                                </div>
                            </div>
                            {readinessIncompleteCount > 0 && (
                                <Badge variant="outline">
                                    {readinessIncompleteCount} to review
                                </Badge>
                            )}
                        </button>
                    </div>
                </div>

                <div
                    className={`grid gap-6 ${
                        workspaceView === 'build'
                            ? 'xl:grid-cols-[280px_minmax(0,1fr)]'
                            : 'grid-cols-1'
                    }`}
                >
                    <div className="space-y-6">
                        <div
                            ref={settingsRef}
                            className={
                                workspaceView === 'settings' ? '' : 'hidden'
                            }
                        >
                            <Card className={panelClass}>
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle>
                                                {isMicrolearning
                                                    ? 'Microlearning structure'
                                                    : 'Course structure'}
                                            </CardTitle>
                                            <CardDescription>
                                                {isMicrolearning
                                                    ? 'Keep one lesson focused, short, and mobile-friendly.'
                                                    : 'Set the course-level details before drilling into lessons.'}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline">
                                            {lessonDrafts.length} lesson
                                            {lessonDrafts.length === 1
                                                ? ''
                                                : 's'}
                                        </Badge>
                                    </div>
                                    {issues.length > 0 && (
                                        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                                            <div className="flex items-center gap-2 font-medium">
                                                <AlertTriangle className="size-4" />
                                                {issues.length} issue
                                                {issues.length === 1
                                                    ? ''
                                                    : 's'}{' '}
                                                need attention
                                            </div>
                                            <ul className="space-y-1">
                                                {issues
                                                    .slice(0, 3)
                                                    .map((issue) => (
                                                        <li key={issue}>
                                                            • {issue}
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="course-title">
                                            Course name
                                        </Label>
                                        <Input
                                            id="course-title"
                                            value={courseDraft.title}
                                            onChange={(event) =>
                                                updateCourseDraft({
                                                    title: event.target.value,
                                                })
                                            }
                                            className={baseFieldClass}
                                            placeholder="Forklift Safety"
                                        />
                                        <InputError
                                            message={fieldError(
                                                courseErrors,
                                                'title',
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="course-content-type">
                                            Builder mode
                                        </Label>
                                        <select
                                            id="course-content-type"
                                            value={courseDraft.content_type}
                                            onChange={(event) =>
                                                updateCourseDraft({
                                                    content_type: event.target
                                                        .value as CourseDraft['content_type'],
                                                })
                                            }
                                            className={baseFieldClass}
                                        >
                                            <option value="course">
                                                Full course
                                            </option>
                                            <option value="microlearning">
                                                Microlearning
                                            </option>
                                        </select>
                                        <InputError
                                            message={fieldError(
                                                courseErrors,
                                                'content_type',
                                            )}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Full courses are best for multi-step
                                            training. Microlearning works best
                                            for short, focused lessons.
                                        </p>
                                    </div>

                                    {isMicrolearning && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="starter-template">
                                                Starter template
                                            </Label>
                                            <select
                                                id="starter-template"
                                                value={starterTemplateKey}
                                                onChange={(event) =>
                                                    setStarterTemplateKey(
                                                        event.target.value,
                                                    )
                                                }
                                                className={baseFieldClass}
                                            >
                                                {microlearning_templates.map(
                                                    (template) => (
                                                        <option
                                                            key={template.key}
                                                            value={template.key}
                                                        >
                                                            {template.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                            <p className="text-xs text-muted-foreground">
                                                {selectedStarterTemplate?.description ??
                                                    'A focused starter lesson will be created automatically.'}{' '}
                                                {selectedStarterTemplate
                                                    ? `About ${selectedStarterTemplate.duration_minutes} min.`
                                                    : ''}
                                            </p>
                                            {selectedStarterTemplate && (
                                                <div className="rounded-2xl border bg-muted/25 p-4">
                                                    <div className="mb-3 flex items-start justify-between gap-3">
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-semibold">
                                                                Replace preview
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Compare the
                                                                current starter
                                                                lesson with the
                                                                selected preset
                                                                before we
                                                                rewrite it.
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline">
                                                            {
                                                                selectedStarterTemplate.activity_count
                                                            }{' '}
                                                            {selectedStarterTemplate.activity_count ===
                                                            1
                                                                ? 'activity'
                                                                : 'activities'}
                                                        </Badge>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                                                        <div className="rounded-xl border bg-background p-3">
                                                            <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                                                                Current
                                                            </p>
                                                            <p className="mt-1 text-sm font-semibold">
                                                                {selectedLesson?.title ??
                                                                    'No lesson selected'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {selectedLesson?.duration_minutes !==
                                                                    null &&
                                                                selectedLesson?.duration_minutes !==
                                                                    undefined
                                                                    ? `${selectedLesson.duration_minutes} min`
                                                                    : 'No duration set'}
                                                            </p>
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                {
                                                                    selectedLessonActivitySummary
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center justify-center text-muted-foreground">
                                                            <RotateCcw className="h-4 w-4" />
                                                        </div>
                                                        <div className="rounded-xl border bg-background p-3">
                                                            <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                                                                After swap
                                                            </p>
                                                            <p className="mt-1 text-sm font-semibold">
                                                                {
                                                                    selectedStarterTemplate.label
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                About{' '}
                                                                {
                                                                    selectedStarterTemplate.duration_minutes
                                                                }{' '}
                                                                min
                                                            </p>
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                {
                                                                    selectedStarterTemplateActivitySummary
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="mt-3 text-xs text-muted-foreground">
                                                        This rewrites the
                                                        starter lesson content
                                                        only.
                                                    </p>
                                                </div>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={replaceStarterTemplate}
                                                disabled={
                                                    lessonDrafts.length > 1 ||
                                                    selectedStarterTemplate ===
                                                        null
                                                }
                                            >
                                                Replace starter template
                                            </Button>
                                            <p className="text-xs text-muted-foreground">
                                                {lessonDrafts.length > 1
                                                    ? 'Reduce the course to one lesson before replacing the starter template.'
                                                    : 'This rewrites the starter lesson only.'}
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="course-subject">
                                            Subject
                                        </Label>
                                        <Input
                                            id="course-subject"
                                            value={courseDraft.subject}
                                            onChange={(event) =>
                                                updateCourseDraft({
                                                    subject: event.target.value,
                                                })
                                            }
                                            className={baseFieldClass}
                                            placeholder="Warehouse Safety"
                                        />
                                        <InputError
                                            message={fieldError(
                                                courseErrors,
                                                'subject',
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="course-pathway">
                                            Pathway
                                        </Label>
                                        <select
                                            id="course-pathway"
                                            value={courseDraft.pathway_id}
                                            onChange={(event) =>
                                                updateCourseDraft({
                                                    pathway_id:
                                                        event.target.value,
                                                })
                                            }
                                            className={baseFieldClass}
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
                                            message={fieldError(
                                                courseErrors,
                                                'pathway_id',
                                            )}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Learners inherit this course through
                                            their job title's pathway.
                                        </p>
                                    </div>

                                    <details
                                        className="rounded-2xl border border-dashed bg-slate-50/50 p-4"
                                        open={!isMicrolearning}
                                    >
                                        <summary className="cursor-pointer list-none text-sm font-medium">
                                            Advanced settings
                                        </summary>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {isMicrolearning
                                                ? 'Optional details stay tucked away for quick lessons.'
                                                : 'These settings help larger courses stay organized.'}
                                        </p>
                                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2 sm:col-span-2">
                                                <Label htmlFor="course-description">
                                                    Description
                                                </Label>
                                                <textarea
                                                    id="course-description"
                                                    value={
                                                        courseDraft.description
                                                    }
                                                    onChange={(event) =>
                                                        updateCourseDraft({
                                                            description:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    className={textareaClass}
                                                    placeholder="What will learners be able to do after this course?"
                                                    rows={4}
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        courseErrors,
                                                        'description',
                                                    )}
                                                />
                                            </div>

                                            <div className="grid gap-2 sm:col-span-2">
                                                <Label htmlFor="course-objectives">
                                                    Learning objectives
                                                </Label>
                                                <textarea
                                                    id="course-objectives"
                                                    value={
                                                        courseDraft.learning_objectives
                                                    }
                                                    onChange={(event) =>
                                                        updateCourseDraft({
                                                            learning_objectives:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    className={textareaClass}
                                                    placeholder={
                                                        'One objective per line\nIdentify the proper PPE\nComplete the pre-shift inspection'
                                                    }
                                                    rows={4}
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        courseErrors,
                                                        'learning_objectives',
                                                    )}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Use one objective per line.
                                                    {isMicrolearning
                                                        ? ' Keep it to a single outcome if possible.'
                                                        : ' These help learners and managers know what the course is meant to achieve.'}
                                                </p>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="course-minutes">
                                                    Estimated time
                                                </Label>
                                                <Input
                                                    id="course-minutes"
                                                    type="number"
                                                    min="1"
                                                    value={
                                                        courseDraft.estimated_minutes
                                                    }
                                                    onChange={(event) =>
                                                        updateCourseDraft({
                                                            estimated_minutes:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    className={baseFieldClass}
                                                    placeholder="15"
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        courseErrors,
                                                        'estimated_minutes',
                                                    )}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="course-passing">
                                                    Passing score
                                                </Label>
                                                <Input
                                                    id="course-passing"
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={
                                                        courseDraft.passing_score
                                                    }
                                                    onChange={(event) =>
                                                        updateCourseDraft({
                                                            passing_score:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    className={baseFieldClass}
                                                    placeholder="80"
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        courseErrors,
                                                        'passing_score',
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </details>

                                    <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-medium">
                                                Save when you are ready
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Use Save changes after editing.
                                                Publishing remains separate so
                                                you control when learners see
                                                the course.
                                            </p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline">
                                                    <Ellipsis className="size-4" />
                                                    Course actions
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={duplicateCourse}
                                                >
                                                    <Copy />
                                                    Duplicate course
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={archiveCourse}
                                                >
                                                    <Trash2 />
                                                    Archive course
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onSelect={deleteCourse}
                                                >
                                                    <Trash2 />
                                                    Delete permanently
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card
                            className={`${panelClass} ${
                                workspaceView === 'build'
                                    ? 'xl:flex xl:h-[calc(100vh-16rem)] xl:min-h-[32rem] xl:flex-col xl:overflow-hidden'
                                    : 'hidden'
                            }`}
                        >
                            <CardHeader className="space-y-1 xl:shrink-0">
                                <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                                    Course outline
                                </p>
                                <CardDescription>
                                    Drag lessons to reorder them.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                                <div className="space-y-3">
                                    {lessonDrafts.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                                            No lessons yet. Create the first one
                                            below and start authoring.
                                        </div>
                                    ) : (
                                        lessonDrafts.map((lesson, index) => {
                                            const selected =
                                                lesson.id === selectedLessonId;
                                            const empty =
                                                !lessonHasContent(lesson);

                                            return (
                                                <div
                                                    key={lesson.id}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        setDragOverLessonId(
                                                            lesson.id,
                                                        );
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();

                                                        if (
                                                            draggingLessonId !==
                                                            null
                                                        ) {
                                                            reorderLessons(
                                                                draggingLessonId,
                                                                lesson.id,
                                                            );
                                                        }
                                                    }}
                                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                                        selected
                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                            : 'border-border bg-background hover:border-foreground/20'
                                                    } ${
                                                        dragOverLessonId ===
                                                        lesson.id
                                                            ? 'ring-2 ring-primary/40'
                                                            : ''
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {lesson.is_final_assessment ? (
                                                            <CheckCircle2
                                                                className="mt-3 size-4 shrink-0 text-emerald-600"
                                                                aria-hidden="true"
                                                            />
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                draggable
                                                                onDragStart={() => {
                                                                    setDraggingLessonId(
                                                                        lesson.id,
                                                                    );
                                                                    setDragOverLessonId(
                                                                        lesson.id,
                                                                    );
                                                                }}
                                                                onDragEnd={() => {
                                                                    setDraggingLessonId(
                                                                        null,
                                                                    );
                                                                    setDragOverLessonId(
                                                                        null,
                                                                    );
                                                                }}
                                                                className="mt-2 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                                                                aria-label={`Drag ${lesson.title || 'untitled lesson'} to reorder`}
                                                            >
                                                                <GripVertical className="size-4" />
                                                            </button>
                                                        )}
                                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                                            {index + 1}
                                                        </span>
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            {lesson.is_final_assessment && (
                                                                <Badge variant="secondary">
                                                                    Final
                                                                    assessment
                                                                </Badge>
                                                            )}
                                                            <Input
                                                                value={
                                                                    lesson.title
                                                                }
                                                                onFocus={() => {
                                                                    setSelectedLessonId(
                                                                        lesson.id,
                                                                    );
                                                                    setActiveBlockIndex(
                                                                        0,
                                                                    );
                                                                    setActivityPickerOpen(
                                                                        false,
                                                                    );
                                                                    setBlockInsertionIndex(
                                                                        null,
                                                                    );
                                                                }}
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateLessonDraft(
                                                                        lesson.id,
                                                                        (
                                                                            current,
                                                                        ) => ({
                                                                            ...current,
                                                                            title: event
                                                                                .target
                                                                                .value,
                                                                        }),
                                                                    )
                                                                }
                                                                className="h-8 border-transparent bg-transparent px-1 text-sm font-medium shadow-none hover:border-input focus-visible:bg-background"
                                                                placeholder="Untitled lesson"
                                                                aria-label={`Lesson ${index + 1} name`}
                                                            />
                                                            {selected && (
                                                                <InputError
                                                                    message={fieldError(
                                                                        lessonErrors,
                                                                        'title',
                                                                    )}
                                                                />
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedLessonId(
                                                                        lesson.id,
                                                                    );
                                                                    setActiveBlockIndex(
                                                                        0,
                                                                    );
                                                                    setActivityPickerOpen(
                                                                        false,
                                                                    );
                                                                    setBlockInsertionIndex(
                                                                        null,
                                                                    );
                                                                }}
                                                                className={`block px-1 text-left text-xs ${empty ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}
                                                            >
                                                                {empty
                                                                    ? lesson.is_final_assessment
                                                                        ? 'Add at least one question'
                                                                        : 'Incomplete'
                                                                    : `${lesson.content.length} ${lesson.content.length === 1 ? 'block' : 'blocks'}`}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="rounded-2xl border border-dashed p-3">
                                    {isMicrolearning ? (
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium">
                                                Microlearning keeps one lesson.
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                The starter lesson is already in
                                                place, and this mode stays
                                                focused on one short learning
                                                moment.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                                onClick={createLesson}
                                                disabled={
                                                    saveState === 'saving'
                                                }
                                            >
                                                {saveState === 'saving' ? (
                                                    <Spinner />
                                                ) : (
                                                    <Plus className="size-4" />
                                                )}
                                                {saveState === 'saving'
                                                    ? 'Saving changes'
                                                    : 'Add lesson'}
                                            </Button>
                                            {finalAssessment === undefined ? (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start"
                                                    onClick={
                                                        createFinalAssessment
                                                    }
                                                    disabled={
                                                        saveState === 'saving'
                                                    }
                                                >
                                                    <CheckCircle2 className="size-4" />
                                                    Add final assessment
                                                </Button>
                                            ) : (
                                                <p className="px-3 text-xs text-muted-foreground">
                                                    The final assessment stays
                                                    at the end of the course.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className={`${panelClass} ${
                                workspaceView === 'media' ? '' : 'hidden'
                            }`}
                        >
                            <CardHeader className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>Course assets</CardTitle>
                                        <CardDescription>
                                            Uploaded videos and job aids stay
                                            available for reuse across lessons.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">
                                        {courseAssets.length} asset
                                        {courseAssets.length === 1 ? '' : 's'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-2 rounded-2xl border border-dashed p-4">
                                        <div className="flex items-center gap-2">
                                            <Video className="size-4 text-muted-foreground" />
                                            <div className="text-sm font-medium">
                                                Videos
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Upload MP4, MOV, or WEBM files for
                                            lesson blocks.
                                        </p>
                                        <Input
                                            type="file"
                                            accept="video/*"
                                            disabled={
                                                uploadingAssetKind === 'video'
                                            }
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0];

                                                if (file) {
                                                    void uploadPanelAsset(
                                                        file,
                                                        'video',
                                                    );
                                                }

                                                event.target.value = '';
                                            }}
                                        />
                                        {uploadingAssetKind === 'video' && (
                                            <p className="text-xs text-muted-foreground">
                                                Uploading video...
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2 rounded-2xl border border-dashed p-4">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="size-4 text-muted-foreground" />
                                            <div className="text-sm font-medium">
                                                PDFs and job aids
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Upload PDFs, Word docs, or SOP
                                            references for learners.
                                        </p>
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx,application/pdf"
                                            disabled={
                                                uploadingAssetKind ===
                                                'document'
                                            }
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0];

                                                if (file) {
                                                    void uploadPanelAsset(
                                                        file,
                                                        'document',
                                                    );
                                                }

                                                event.target.value = '';
                                            }}
                                        />
                                        {uploadingAssetKind === 'document' && (
                                            <p className="text-xs text-muted-foreground">
                                                Uploading document...
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <InputError
                                    message={mediaUploadError ?? undefined}
                                />

                                <div className="grid gap-2">
                                    <Label
                                        htmlFor="asset-search"
                                        className="text-xs tracking-[0.18em] text-muted-foreground uppercase"
                                    >
                                        Search assets
                                    </Label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="asset-search"
                                            value={assetSearch}
                                            onChange={(event) =>
                                                setAssetSearch(
                                                    event.target.value,
                                                )
                                            }
                                            className="pl-9"
                                            placeholder="Search filenames, URLs, or lesson titles"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Drag and drop is available when search
                                        is cleared.
                                    </p>
                                </div>

                                {courseAssets.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        No uploads yet. Add a file here or from
                                        a video/document block.
                                    </div>
                                ) : visibleAssetCount === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        No assets match that search.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {[
                                            {
                                                title: 'Videos',
                                                kind: 'video' as const,
                                                items: videoAssets,
                                            },
                                            {
                                                title: 'Documents',
                                                kind: 'document' as const,
                                                items: documentAssets,
                                            },
                                        ].map((group) => (
                                            <div
                                                key={group.title}
                                                className="space-y-3"
                                            >
                                                {group.items.length > 0 && (
                                                    <>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="text-sm font-semibold">
                                                                {group.title}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {reorderingAssetKind ===
                                                                    group.kind && (
                                                                    <Badge variant="secondary">
                                                                        Saving
                                                                        order...
                                                                    </Badge>
                                                                )}
                                                                <Badge variant="secondary">
                                                                    {
                                                                        group
                                                                            .items
                                                                            .length
                                                                    }
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {group.items.map(
                                                                (asset) => {
                                                                    const canInsert =
                                                                        activeBlock !==
                                                                            null &&
                                                                        ((group.kind ===
                                                                            'video' &&
                                                                            activeBlock.type ===
                                                                                'video') ||
                                                                            (group.kind ===
                                                                                'document' &&
                                                                                activeBlock.type ===
                                                                                    'document'));
                                                                    const isDragging =
                                                                        draggingAssetId ===
                                                                        asset.id;
                                                                    const isDragTarget =
                                                                        dragOverAssetId ===
                                                                        asset.id;

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                asset.id
                                                                            }
                                                                            onDragOver={(
                                                                                event,
                                                                            ) => {
                                                                                if (
                                                                                    normalizedAssetSearch ||
                                                                                    draggingAssetId ===
                                                                                        null
                                                                                ) {
                                                                                    return;
                                                                                }

                                                                                event.preventDefault();
                                                                                event.dataTransfer.dropEffect =
                                                                                    'move';
                                                                                setDragOverAssetId(
                                                                                    asset.id,
                                                                                );
                                                                            }}
                                                                            onDragLeave={() => {
                                                                                if (
                                                                                    dragOverAssetId ===
                                                                                    asset.id
                                                                                ) {
                                                                                    setDragOverAssetId(
                                                                                        null,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            onDrop={(
                                                                                event,
                                                                            ) => {
                                                                                event.preventDefault();
                                                                                handleAssetDrop(
                                                                                    group.kind,
                                                                                    asset.id,
                                                                                );
                                                                            }}
                                                                            className={`rounded-2xl border bg-background p-4 shadow-sm transition ${
                                                                                isDragging
                                                                                    ? 'opacity-50'
                                                                                    : ''
                                                                            } ${
                                                                                isDragTarget
                                                                                    ? 'ring-2 ring-ring'
                                                                                    : ''
                                                                            }`}
                                                                        >
                                                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                                <div className="flex min-w-0 gap-3">
                                                                                    <button
                                                                                        type="button"
                                                                                        draggable
                                                                                        disabled={
                                                                                            normalizedAssetSearch !==
                                                                                                '' ||
                                                                                            reorderingAssetKind ===
                                                                                                group.kind
                                                                                        }
                                                                                        onDragStart={(
                                                                                            event,
                                                                                        ) => {
                                                                                            if (
                                                                                                normalizedAssetSearch
                                                                                            ) {
                                                                                                event.preventDefault();

                                                                                                return;
                                                                                            }

                                                                                            event.dataTransfer.effectAllowed =
                                                                                                'move';
                                                                                            event.dataTransfer.setData(
                                                                                                'text/plain',
                                                                                                String(
                                                                                                    asset.id,
                                                                                                ),
                                                                                            );
                                                                                            startAssetDrag(
                                                                                                asset.id,
                                                                                            );
                                                                                        }}
                                                                                        onDragEnd={
                                                                                            cancelAssetDrag
                                                                                        }
                                                                                        className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                                                                        aria-label={`Drag ${asset.original_name} to reorder`}
                                                                                    >
                                                                                        <GripVertical className="size-4" />
                                                                                    </button>
                                                                                    <div className="min-w-0 space-y-2">
                                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                                            <Badge variant="outline">
                                                                                                {assetKindLabel(
                                                                                                    asset.kind,
                                                                                                )}
                                                                                            </Badge>
                                                                                            {asset.usage_count >
                                                                                                0 && (
                                                                                                <Badge variant="secondary">
                                                                                                    Used
                                                                                                    in{' '}
                                                                                                    {
                                                                                                        asset.usage_count
                                                                                                    }{' '}
                                                                                                    block
                                                                                                    {asset.usage_count ===
                                                                                                    1
                                                                                                        ? ''
                                                                                                        : 's'}
                                                                                                </Badge>
                                                                                            )}
                                                                                            <div className="min-w-0 text-sm font-medium break-words">
                                                                                                {
                                                                                                    asset.original_name
                                                                                                }
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            {formatAssetSize(
                                                                                                asset.size_bytes,
                                                                                            )}{' '}
                                                                                            •{' '}
                                                                                            {asset.mime_type ??
                                                                                                'Unknown mime type'}
                                                                                        </div>
                                                                                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs break-all text-muted-foreground">
                                                                                            {
                                                                                                asset.url
                                                                                            }
                                                                                        </div>
                                                                                        {asset
                                                                                            .usage_lessons
                                                                                            .length >
                                                                                            0 && (
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {asset.usage_lessons
                                                                                                    .slice(
                                                                                                        0,
                                                                                                        2,
                                                                                                    )
                                                                                                    .map(
                                                                                                        (
                                                                                                            lesson,
                                                                                                        ) => (
                                                                                                            <Badge
                                                                                                                key={
                                                                                                                    lesson.lesson_id
                                                                                                                }
                                                                                                                variant="outline"
                                                                                                                className="bg-slate-50"
                                                                                                            >
                                                                                                                {
                                                                                                                    lesson.lesson_title
                                                                                                                }{' '}
                                                                                                                ·{' '}
                                                                                                                {
                                                                                                                    lesson.block_count
                                                                                                                }{' '}
                                                                                                                block
                                                                                                                {lesson.block_count ===
                                                                                                                1
                                                                                                                    ? ''
                                                                                                                    : 's'}
                                                                                                            </Badge>
                                                                                                        ),
                                                                                                    )}
                                                                                                {asset
                                                                                                    .usage_lessons
                                                                                                    .length >
                                                                                                    2 && (
                                                                                                    <Badge variant="secondary">
                                                                                                        +
                                                                                                        {asset
                                                                                                            .usage_lessons
                                                                                                            .length -
                                                                                                            2}{' '}
                                                                                                        more
                                                                                                    </Badge>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex flex-wrap gap-2">
                                                                                    <Button
                                                                                        asChild
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                    >
                                                                                        <a
                                                                                            href={
                                                                                                asset.url
                                                                                            }
                                                                                            download={
                                                                                                asset.original_name
                                                                                            }
                                                                                        >
                                                                                            <Download className="size-4" />
                                                                                            Download
                                                                                        </a>
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        onClick={() =>
                                                                                            void copyAssetUrl(
                                                                                                asset,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Copy className="size-4" />
                                                                                        {copiedAssetId ===
                                                                                        asset.id
                                                                                            ? 'Copied'
                                                                                            : 'Copy link'}
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        onClick={() =>
                                                                                            applyAssetToSelectedBlock(
                                                                                                asset,
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            !canInsert
                                                                                        }
                                                                                    >
                                                                                        Use
                                                                                        in
                                                                                        block
                                                                                    </Button>
                                                                                    <div className="grid gap-2">
                                                                                        <Label
                                                                                            htmlFor={`replace-asset-${asset.id}`}
                                                                                            className="text-xs tracking-[0.18em] text-muted-foreground uppercase"
                                                                                        >
                                                                                            Replace
                                                                                        </Label>
                                                                                        <Input
                                                                                            id={`replace-asset-${asset.id}`}
                                                                                            type="file"
                                                                                            accept={
                                                                                                asset.kind ===
                                                                                                'video'
                                                                                                    ? 'video/*'
                                                                                                    : '.pdf,.doc,.docx,application/pdf'
                                                                                            }
                                                                                            disabled={
                                                                                                updatingAssetId ===
                                                                                                asset.id
                                                                                            }
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) => {
                                                                                                const file =
                                                                                                    event
                                                                                                        .target
                                                                                                        .files?.[0];

                                                                                                if (
                                                                                                    file
                                                                                                ) {
                                                                                                    void replaceCourseAsset(
                                                                                                        asset,
                                                                                                        file,
                                                                                                    );
                                                                                                }

                                                                                                event.target.value =
                                                                                                    '';
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="destructive"
                                                                                        onClick={() =>
                                                                                            void deleteCourseAsset(
                                                                                                asset,
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            updatingAssetId ===
                                                                                            asset.id
                                                                                        }
                                                                                    >
                                                                                        <Trash2 className="size-4" />
                                                                                        Delete
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Select a matching video or document block to
                                    insert an upload directly into the lesson.
                                </p>
                            </CardContent>
                        </Card>

                        <div
                            ref={assignmentRef}
                            className={
                                workspaceView === 'assignments' ? '' : 'hidden'
                            }
                        >
                            <Card className={panelClass}>
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle>
                                                Assignment management
                                            </CardTitle>
                                            <CardDescription>
                                                Assign this course to a person,
                                                team, job title, or location and
                                                manage reminders from one place.
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline">
                                            {assignmentStatusCounts.total} total
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">
                                            {assignmentStatusCounts.completed}{' '}
                                            completed
                                        </Badge>
                                        <Badge variant="secondary">
                                            {assignmentStatusCounts.inProgress}{' '}
                                            in progress
                                        </Badge>
                                        <Badge variant="secondary">
                                            {assignmentStatusCounts.overdue}{' '}
                                            overdue
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {selected_assignment_target_type !== null &&
                                        selected_assignment_target_id !==
                                            null && (
                                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                                                <div className="font-medium text-foreground">
                                                    Refresher assignment
                                                    preloaded
                                                </div>
                                                <div className="mt-1 text-muted-foreground">
                                                    This assignment was opened
                                                    from the knowledge-gap
                                                    report and is already
                                                    targeting{' '}
                                                    {selectedAssignmentTarget?.label ??
                                                        'the selected audience'}
                                                    {selected_assignment_due_at
                                                        ? ' with the due date already filled in.'
                                                        : '.'}
                                                </div>
                                            </div>
                                        )}
                                    <div className="grid gap-4 rounded-2xl border bg-slate-50/70 p-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="assignment-target-type">
                                                Assign by
                                            </Label>
                                            <select
                                                id="assignment-target-type"
                                                value={
                                                    assignmentDraft.targetType
                                                }
                                                onChange={(event) =>
                                                    setAssignmentDraft(
                                                        (current) => ({
                                                            ...current,
                                                            targetType: event
                                                                .target
                                                                .value as AssignmentDraft['targetType'],
                                                            targetId: '',
                                                        }),
                                                    )
                                                }
                                                className={baseFieldClass}
                                            >
                                                <option value="user">
                                                    Single employee
                                                </option>
                                                <option value="team">
                                                    Team
                                                </option>
                                                <option value="job_title">
                                                    Job title
                                                </option>
                                                <option value="location">
                                                    Location
                                                </option>
                                            </select>
                                            <p className="text-xs text-muted-foreground">
                                                {assignmentDraft.targetType ===
                                                'user'
                                                    ? 'Choose one employee.'
                                                    : assignmentDraft.targetType ===
                                                        'team'
                                                      ? 'Choose one team.'
                                                      : assignmentDraft.targetType ===
                                                          'job_title'
                                                        ? 'Choose one job title.'
                                                        : 'Choose one location.'}
                                            </p>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="assignment-target">
                                                Target
                                            </Label>
                                            <select
                                                id="assignment-target"
                                                value={assignmentTargetValue}
                                                onChange={(event) =>
                                                    setAssignmentDraft(
                                                        (current) => ({
                                                            ...current,
                                                            targetId:
                                                                event.target
                                                                    .value,
                                                        }),
                                                    )
                                                }
                                                className={baseFieldClass}
                                                disabled={
                                                    assignmentTargetOptions.length ===
                                                    0
                                                }
                                            >
                                                {assignmentTargetOptions.length ===
                                                0 ? (
                                                    <option value="">
                                                        No targets available
                                                    </option>
                                                ) : (
                                                    assignmentTargetOptions.map(
                                                        (option) => (
                                                            <option
                                                                key={option.id}
                                                                value={
                                                                    option.id
                                                                }
                                                            >
                                                                {option.label}
                                                                {option.description
                                                                    ? ` • ${option.description}`
                                                                    : ''}
                                                            </option>
                                                        ),
                                                    )
                                                )}
                                            </select>
                                            <InputError
                                                message={assignmentTargetError}
                                            />
                                            {selectedAssignmentTarget && (
                                                <p className="text-xs text-muted-foreground">
                                                    Ready to assign to{' '}
                                                    {
                                                        selectedAssignmentTarget.label
                                                    }
                                                    {selectedAssignmentTarget.description
                                                        ? ` • ${selectedAssignmentTarget.description}`
                                                        : ''}
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="assignment-due-at">
                                                    Due date
                                                </Label>
                                                <Input
                                                    id="assignment-due-at"
                                                    type="date"
                                                    value={
                                                        assignmentDraft.dueAt
                                                    }
                                                    onChange={(event) =>
                                                        setAssignmentDraft(
                                                            (current) => ({
                                                                ...current,
                                                                dueAt: event
                                                                    .target
                                                                    .value,
                                                            }),
                                                        )
                                                    }
                                                    className={baseFieldClass}
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        assignmentErrors,
                                                        'due_at',
                                                    )}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="assignment-recurs">
                                                    Repeat every
                                                </Label>
                                                <Input
                                                    id="assignment-recurs"
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    value={
                                                        assignmentDraft.recursEveryDays
                                                    }
                                                    onChange={(event) =>
                                                        setAssignmentDraft(
                                                            (current) => ({
                                                                ...current,
                                                                recursEveryDays:
                                                                    event.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                    className={baseFieldClass}
                                                    placeholder="30"
                                                />
                                                <InputError
                                                    message={fieldError(
                                                        assignmentErrors,
                                                        'recurs_every_days',
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <label className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    assignmentDraft.isRequired
                                                }
                                                onChange={(event) =>
                                                    setAssignmentDraft(
                                                        (current) => ({
                                                            ...current,
                                                            isRequired:
                                                                event.target
                                                                    .checked,
                                                        }),
                                                    )
                                                }
                                                className="size-4 rounded border-input"
                                            />
                                            <span>
                                                Mark this assignment as required
                                            </span>
                                        </label>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                onClick={createAssignment}
                                                disabled={
                                                    isAssignmentSaving ||
                                                    assignmentTargetOptions.length ===
                                                        0 ||
                                                    assignmentTargetValue === ''
                                                }
                                            >
                                                {isAssignmentSaving && (
                                                    <Spinner />
                                                )}
                                                <Plus className="size-4" />
                                                Create assignment
                                            </Button>
                                            <div className="text-xs text-muted-foreground">
                                                Managers and learners only see
                                                assignments within their scope.
                                            </div>
                                        </div>
                                    </div>

                                    {assignments.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                            No assignments yet. Create one above
                                            to start tracking due dates and
                                            progress.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {assignments.map((assignment) => {
                                                const isBusy =
                                                    pendingAssignmentAction?.id ===
                                                    assignment.id;
                                                const targetLabel =
                                                    assignment.assigned_to
                                                        .name ||
                                                    assignmentTargetTypeLabel(
                                                        assignment.assigned_to
                                                            .type,
                                                    );

                                                return (
                                                    <div
                                                        key={assignment.id}
                                                        className="rounded-2xl border bg-background p-4 shadow-sm"
                                                    >
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="space-y-2">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Badge
                                                                        variant={assignmentStatusVariant(
                                                                            assignment.status,
                                                                        )}
                                                                    >
                                                                        {
                                                                            assignment.status_label
                                                                        }
                                                                    </Badge>
                                                                    <Badge variant="outline">
                                                                        {assignment.assigned_to.type
                                                                            .split(
                                                                                '_',
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    part,
                                                                                ) =>
                                                                                    part
                                                                                        .charAt(
                                                                                            0,
                                                                                        )
                                                                                        .toUpperCase() +
                                                                                    part.slice(
                                                                                        1,
                                                                                    ),
                                                                            )
                                                                            .join(
                                                                                ' ',
                                                                            )}
                                                                    </Badge>
                                                                    {assignment.is_required ? (
                                                                        <Badge variant="default">
                                                                            Required
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="secondary">
                                                                            Optional
                                                                        </Badge>
                                                                    )}
                                                                    {assignment.recurs_every_days !==
                                                                        null && (
                                                                        <Badge variant="outline">
                                                                            Repeats
                                                                            every{' '}
                                                                            {
                                                                                assignment.recurs_every_days
                                                                            }{' '}
                                                                            day
                                                                            {assignment.recurs_every_days ===
                                                                            1
                                                                                ? ''
                                                                                : 's'}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm font-medium">
                                                                    {
                                                                        course.title
                                                                    }{' '}
                                                                    assigned to{' '}
                                                                    {
                                                                        targetLabel
                                                                    }
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    Due{' '}
                                                                    {formatAssignmentDate(
                                                                        assignment.due_at,
                                                                    )}
                                                                    {' • '}
                                                                    {
                                                                        assignment.recipient_count
                                                                    }{' '}
                                                                    recipient
                                                                    {assignment.recipient_count ===
                                                                    1
                                                                        ? ''
                                                                        : 's'}
                                                                    {' • '}
                                                                    {
                                                                        assignment.completed_count
                                                                    }{' '}
                                                                    completed
                                                                    {' • '}
                                                                    {
                                                                        assignment.overdue_count
                                                                    }{' '}
                                                                    overdue
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {
                                                                        assignment.reminder_count
                                                                    }{' '}
                                                                    reminder
                                                                    {assignment.reminder_count ===
                                                                    1
                                                                        ? ''
                                                                        : 's'}
                                                                    sent
                                                                    {assignment.last_reminded_at
                                                                        ? ` • last sent ${formatAssignmentDateTime(assignment.last_reminded_at)}`
                                                                        : ''}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        runAssignmentAction(
                                                                            assignment,
                                                                            'remind',
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isBusy
                                                                    }
                                                                >
                                                                    <Bell className="size-4" />
                                                                    Send
                                                                    reminder
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        runAssignmentAction(
                                                                            assignment,
                                                                            'reassign',
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isBusy ||
                                                                        assignment.failed_count ===
                                                                            0
                                                                    }
                                                                >
                                                                    <RotateCcw className="size-4" />
                                                                    Reassign
                                                                    failed
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() =>
                                                                        runAssignmentAction(
                                                                            assignment,
                                                                            'delete',
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isBusy
                                                                    }
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div
                            className={
                                workspaceView === 'results' ? '' : 'hidden'
                            }
                        >
                            <Card className={panelClass}>
                                <CardHeader>
                                    <CardTitle>Course results</CardTitle>
                                    <CardDescription>
                                        Completion, overdue work, and failed
                                        attempts across current assignments.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            {
                                                label: 'Assigned learners',
                                                value: resultsSummary.recipients,
                                            },
                                            {
                                                label: 'Completed',
                                                value: resultsSummary.completed,
                                            },
                                            {
                                                label: 'Completion rate',
                                                value: `${resultsSummary.completionRate}%`,
                                            },
                                            {
                                                label: 'Need attention',
                                                value:
                                                    resultsSummary.overdue +
                                                    resultsSummary.failed,
                                            },
                                        ].map((metric) => (
                                            <div
                                                key={metric.label}
                                                className="rounded-2xl border bg-background p-4"
                                            >
                                                <p className="text-xs text-muted-foreground">
                                                    {metric.label}
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold tabular-nums">
                                                    {metric.value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {assignments.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                            Assign this course to start
                                            collecting learner results.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="font-semibold">
                                                        Assignment performance
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Open Assignments to send
                                                        reminders or reassign
                                                        failed training.
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        setWorkspaceView(
                                                            'assignments',
                                                        )
                                                    }
                                                >
                                                    Manage assignments
                                                </Button>
                                            </div>
                                            {assignments.map((assignment) => (
                                                <div
                                                    key={assignment.id}
                                                    className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {assignment
                                                                .assigned_to
                                                                .name ||
                                                                assignmentTargetTypeLabel(
                                                                    assignment
                                                                        .assigned_to
                                                                        .type,
                                                                )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {
                                                                assignment.recipient_count
                                                            }{' '}
                                                            learners
                                                        </p>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-semibold tabular-nums">
                                                            {
                                                                assignment.completed_count
                                                            }
                                                        </span>{' '}
                                                        <span className="text-muted-foreground">
                                                            completed
                                                        </span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-amber-700 tabular-nums">
                                                            {
                                                                assignment.overdue_count
                                                            }
                                                        </span>{' '}
                                                        <span className="text-muted-foreground">
                                                            overdue
                                                        </span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-semibold text-rose-700 tabular-nums">
                                                            {
                                                                assignment.failed_count
                                                            }
                                                        </span>{' '}
                                                        <span className="text-muted-foreground">
                                                            failed
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div
                        className={
                            workspaceView === 'build' ? 'space-y-6' : 'hidden'
                        }
                    >
                        <Card
                            className={`${panelClass} xl:flex xl:h-[calc(100vh-16rem)] xl:min-h-[32rem] xl:flex-col xl:overflow-hidden`}
                        >
                            <CardHeader className="space-y-3 xl:shrink-0">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <CardTitle>
                                            {selectedLesson?.title ||
                                                'Lesson editor'}
                                        </CardTitle>
                                        <CardDescription>
                                            {selectedLesson?.is_final_assessment
                                                ? 'Only questions in this assessment count toward the passing score.'
                                                : courseDraft.description ||
                                                  'Build the lesson in the order learners will experience it.'}
                                        </CardDescription>
                                    </div>
                                    {selectedLesson && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">
                                                {selectedLesson.content.length}{' '}
                                                {selectedLesson.content
                                                    .length === 1
                                                    ? 'block'
                                                    : 'blocks'}
                                            </Badge>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        aria-label="Lesson actions"
                                                    >
                                                        <Ellipsis className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            setLessonSettingsOpen(
                                                                (current) =>
                                                                    !current,
                                                            )
                                                        }
                                                    >
                                                        <Settings2 />
                                                        Lesson settings
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={
                                                            duplicateLesson
                                                        }
                                                        disabled={
                                                            isMicrolearning ||
                                                            selectedLesson.is_final_assessment
                                                        }
                                                    >
                                                        <Copy />
                                                        Duplicate lesson
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onSelect={deleteLesson}
                                                        disabled={
                                                            isMicrolearning &&
                                                            lessonDrafts.length <=
                                                                1
                                                        }
                                                    >
                                                        <Trash2 />
                                                        Delete lesson
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                                {!selectedLesson ? (
                                    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                                        Select a lesson from the outline to
                                        start editing blocks.
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className={
                                                lessonSettingsOpen
                                                    ? 'space-y-4 rounded-2xl border bg-muted/30 p-4'
                                                    : 'hidden'
                                            }
                                        >
                                            <div>
                                                <div>
                                                    <h3 className="text-sm font-semibold">
                                                        Lesson settings
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        Use Save changes when
                                                        you are finished.
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        setLessonSettingsOpen(
                                                            false,
                                                        )
                                                    }
                                                >
                                                    Close
                                                </Button>
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="lesson-duration">
                                                        Estimated duration
                                                    </Label>
                                                    <Input
                                                        id="lesson-duration"
                                                        type="number"
                                                        min="1"
                                                        value={
                                                            selectedLesson.duration_minutes
                                                        }
                                                        onChange={(event) =>
                                                            updateSelectedLesson(
                                                                (lesson) => ({
                                                                    ...lesson,
                                                                    duration_minutes:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                        className={
                                                            baseFieldClass
                                                        }
                                                        placeholder="10"
                                                    />
                                                    <InputError
                                                        message={fieldError(
                                                            lessonErrors,
                                                            'duration_minutes',
                                                        )}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="lesson-status">
                                                        Status
                                                    </Label>
                                                    <select
                                                        id="lesson-status"
                                                        value={
                                                            selectedLesson.status
                                                        }
                                                        onChange={(event) =>
                                                            updateSelectedLesson(
                                                                (lesson) => ({
                                                                    ...lesson,
                                                                    status: event
                                                                        .target
                                                                        .value as Lesson['status'],
                                                                }),
                                                            )
                                                        }
                                                        className={
                                                            baseFieldClass
                                                        }
                                                    >
                                                        <option value="draft">
                                                            Draft
                                                        </option>
                                                        <option value="published">
                                                            Published
                                                        </option>
                                                    </select>
                                                    <InputError
                                                        message={fieldError(
                                                            lessonErrors,
                                                            'status',
                                                        )}
                                                    />
                                                </div>
                                                <div className="hidden">
                                                    <Label htmlFor="lesson-published-at">
                                                        Published at
                                                    </Label>
                                                    <Input
                                                        id="lesson-published-at"
                                                        type="datetime-local"
                                                        value={
                                                            selectedLesson.published_at
                                                        }
                                                        onChange={(event) =>
                                                            updateSelectedLesson(
                                                                (lesson) => ({
                                                                    ...lesson,
                                                                    published_at:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                        className={
                                                            baseFieldClass
                                                        }
                                                    />
                                                    <InputError
                                                        message={fieldError(
                                                            lessonErrors,
                                                            'published_at',
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                                                        Content blocks
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Add, reorder, and edit
                                                        what learners will see.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        openActivityPicker(
                                                            selectedLesson
                                                                .content.length,
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add content
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                {selectedLesson.content
                                                    .length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                                        <Sparkles className="mx-auto mb-3 size-6" />
                                                        <div className="font-medium text-foreground">
                                                            Add the first
                                                            content block
                                                        </div>
                                                        <div className="mt-1">
                                                            Add text, media, or
                                                            a knowledge check to
                                                            this lesson.
                                                        </div>
                                                    </div>
                                                ) : (
                                                    selectedLesson.content.map(
                                                        (block, index) => (
                                                            <div
                                                                key={block.id}
                                                                className="space-y-4"
                                                            >
                                                                {index > 0 && (
                                                                    <div className="group flex items-center gap-3 py-1 opacity-50 transition-opacity focus-within:opacity-100 hover:opacity-100">
                                                                        <div className="h-px flex-1 bg-border" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                openActivityPicker(
                                                                                    index,
                                                                                )
                                                                            }
                                                                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                                                        >
                                                                            <Plus className="size-3.5" />
                                                                            Add
                                                                            content
                                                                        </button>
                                                                        <div className="h-px flex-1 bg-border" />
                                                                    </div>
                                                                )}
                                                                <div
                                                                    ref={(
                                                                        element,
                                                                    ) => {
                                                                        if (
                                                                            element
                                                                        ) {
                                                                            blockElementRefs.current.set(
                                                                                block.id,
                                                                                element,
                                                                            );
                                                                        } else {
                                                                            blockElementRefs.current.delete(
                                                                                block.id,
                                                                            );
                                                                        }
                                                                    }}
                                                                    draggable
                                                                    onDragStart={() => {
                                                                        setDraggingBlockIndex(
                                                                            index,
                                                                        );
                                                                        setDragOverBlockIndex(
                                                                            index,
                                                                        );
                                                                    }}
                                                                    onDragOver={(
                                                                        event,
                                                                    ) => {
                                                                        event.preventDefault();
                                                                        setDragOverBlockIndex(
                                                                            index,
                                                                        );
                                                                    }}
                                                                    onDrop={(
                                                                        event,
                                                                    ) => {
                                                                        event.preventDefault();

                                                                        if (
                                                                            draggingBlockIndex !==
                                                                            null
                                                                        ) {
                                                                            reorderSelectedBlocks(
                                                                                draggingBlockIndex,
                                                                                index,
                                                                            );
                                                                        }
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggingBlockIndex(
                                                                            null,
                                                                        );
                                                                        setDragOverBlockIndex(
                                                                            null,
                                                                        );
                                                                    }}
                                                                    className={`rounded-3xl border p-4 transition ${
                                                                        index ===
                                                                        activeBlockIndex
                                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                                            : 'border-border bg-background'
                                                                    } ${
                                                                        dragOverBlockIndex ===
                                                                        index
                                                                            ? 'ring-2 ring-primary/40'
                                                                            : ''
                                                                    } cursor-grab active:cursor-grabbing`}
                                                                >
                                                                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setActiveBlockIndex(
                                                                                    index,
                                                                                )
                                                                            }
                                                                            className="flex items-center gap-3 text-left"
                                                                        >
                                                                            <GripVertical className="size-4 text-muted-foreground" />
                                                                            <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                                                                                {index +
                                                                                    1}
                                                                            </span>
                                                                            <div>
                                                                                <div className="text-sm font-semibold">
                                                                                    {blockLabel(
                                                                                        block.type,
                                                                                    )}
                                                                                </div>
                                                                                {block.type !==
                                                                                    'text' && (
                                                                                    <div className="text-xs text-muted-foreground">
                                                                                        {getBlockSummary(
                                                                                            block,
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </button>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() =>
                                                                                    duplicateBlock(
                                                                                        index,
                                                                                    )
                                                                                }
                                                                                aria-label="Duplicate block"
                                                                            >
                                                                                <Copy className="size-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() =>
                                                                                    removeBlock(
                                                                                        index,
                                                                                    )
                                                                                }
                                                                                aria-label="Delete block"
                                                                            >
                                                                                <Trash2 className="size-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-4">
                                                                        {block.type ===
                                                                            'text' && (
                                                                            <div className="grid gap-2">
                                                                                <Label>
                                                                                    Text
                                                                                    block
                                                                                </Label>
                                                                                <RichTextEditor
                                                                                    value={String(
                                                                                        block.rich_text ??
                                                                                            block.text ??
                                                                                            '',
                                                                                    )}
                                                                                    isRichText={
                                                                                        typeof block.rich_text ===
                                                                                        'string'
                                                                                    }
                                                                                    onChange={(
                                                                                        html,
                                                                                        plainText,
                                                                                    ) =>
                                                                                        updateSelectedBlock(
                                                                                            index,
                                                                                            (
                                                                                                current,
                                                                                            ) => ({
                                                                                                ...current,
                                                                                                text: plainText,
                                                                                                rich_text:
                                                                                                    html,
                                                                                            }),
                                                                                        )
                                                                                    }
                                                                                    placeholder="Personal protective equipment must be worn at all times..."
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'callout' && (
                                                                            <div className="grid gap-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Message
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.text ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    text: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            4
                                                                                        }
                                                                                        placeholder="Add the information learners should notice..."
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2 sm:max-w-xs">
                                                                                    <Label>
                                                                                        Callout
                                                                                        style
                                                                                    </Label>
                                                                                    <select
                                                                                        value={String(
                                                                                            block.style ??
                                                                                                'information',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    style: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    >
                                                                                        <option value="information">
                                                                                            Information
                                                                                        </option>
                                                                                        <option value="tip">
                                                                                            Tip
                                                                                        </option>
                                                                                        <option value="warning">
                                                                                            Warning
                                                                                        </option>
                                                                                        <option value="stop">
                                                                                            Stop
                                                                                            and
                                                                                            escalate
                                                                                        </option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'image' && (
                                                                            <div className="grid gap-4 md:grid-cols-2">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Image
                                                                                        URL
                                                                                    </Label>
                                                                                    <Input
                                                                                        value={String(
                                                                                            block.url ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    url: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Alt
                                                                                        text
                                                                                    </Label>
                                                                                    <Input
                                                                                        value={String(
                                                                                            block.alt ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    alt: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2 md:col-span-2">
                                                                                    <Label>
                                                                                        Caption
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.caption ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    caption:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'video' && (
                                                                            <div className="grid gap-4 md:grid-cols-2">
                                                                                <div className="grid gap-2 md:col-span-2">
                                                                                    <Label>
                                                                                        Video
                                                                                        URL
                                                                                    </Label>
                                                                                    <Input
                                                                                        value={String(
                                                                                            block.url ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    url: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    />
                                                                                    <div className="grid gap-2 rounded-2xl border border-dashed bg-muted/20 p-3 text-sm">
                                                                                        <Label
                                                                                            htmlFor={`video-upload-${block.id}`}
                                                                                            className="text-xs tracking-[0.18em] text-muted-foreground uppercase"
                                                                                        >
                                                                                            Upload
                                                                                            video
                                                                                        </Label>
                                                                                        <Input
                                                                                            id={`video-upload-${block.id}`}
                                                                                            type="file"
                                                                                            accept="video/*"
                                                                                            disabled={
                                                                                                uploadingMediaBlockId ===
                                                                                                block.id
                                                                                            }
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) => {
                                                                                                const file =
                                                                                                    event
                                                                                                        .target
                                                                                                        .files?.[0];

                                                                                                if (
                                                                                                    file
                                                                                                ) {
                                                                                                    void uploadBlockAsset(
                                                                                                        index,
                                                                                                        file,
                                                                                                        'video',
                                                                                                    );
                                                                                                }

                                                                                                event.target.value =
                                                                                                    '';
                                                                                            }}
                                                                                        />
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            Upload
                                                                                            an
                                                                                            MP4,
                                                                                            MOV,
                                                                                            or
                                                                                            WEBM
                                                                                            file
                                                                                            instead
                                                                                            of
                                                                                            pasting
                                                                                            a
                                                                                            link.
                                                                                        </p>
                                                                                        {uploadingMediaBlockId ===
                                                                                            block.id && (
                                                                                            <p className="text-xs text-muted-foreground">
                                                                                                Uploading
                                                                                                video...
                                                                                            </p>
                                                                                        )}
                                                                                        {mediaUploadError && (
                                                                                            <p className="text-xs text-destructive">
                                                                                                {
                                                                                                    mediaUploadError
                                                                                                }
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid gap-2 md:col-span-2">
                                                                                    <Label>
                                                                                        Caption
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.caption ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    caption:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'document' && (
                                                                            <div className="grid gap-4 md:grid-cols-2">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Document
                                                                                        title
                                                                                    </Label>
                                                                                    <Input
                                                                                        value={String(
                                                                                            block.title ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    title: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    />
                                                                                    <div className="grid gap-2 rounded-2xl border border-dashed bg-muted/20 p-3 text-sm">
                                                                                        <Label
                                                                                            htmlFor={`document-upload-${block.id}`}
                                                                                            className="text-xs tracking-[0.18em] text-muted-foreground uppercase"
                                                                                        >
                                                                                            Upload
                                                                                            PDF
                                                                                            or
                                                                                            job
                                                                                            aid
                                                                                        </Label>
                                                                                        <Input
                                                                                            id={`document-upload-${block.id}`}
                                                                                            type="file"
                                                                                            accept=".pdf,.doc,.docx,application/pdf"
                                                                                            disabled={
                                                                                                uploadingMediaBlockId ===
                                                                                                block.id
                                                                                            }
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) => {
                                                                                                const file =
                                                                                                    event
                                                                                                        .target
                                                                                                        .files?.[0];

                                                                                                if (
                                                                                                    file
                                                                                                ) {
                                                                                                    void uploadBlockAsset(
                                                                                                        index,
                                                                                                        file,
                                                                                                        'document',
                                                                                                    );
                                                                                                }

                                                                                                event.target.value =
                                                                                                    '';
                                                                                            }}
                                                                                        />
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            Upload
                                                                                            a
                                                                                            PDF
                                                                                            or
                                                                                            document
                                                                                            so
                                                                                            learners
                                                                                            can
                                                                                            open
                                                                                            it
                                                                                            from
                                                                                            the
                                                                                            lesson.
                                                                                        </p>
                                                                                        {uploadingMediaBlockId ===
                                                                                            block.id && (
                                                                                            <p className="text-xs text-muted-foreground">
                                                                                                Uploading
                                                                                                document...
                                                                                            </p>
                                                                                        )}
                                                                                        {mediaUploadError && (
                                                                                            <p className="text-xs text-destructive">
                                                                                                {
                                                                                                    mediaUploadError
                                                                                                }
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Document
                                                                                        URL
                                                                                    </Label>
                                                                                    <Input
                                                                                        value={String(
                                                                                            block.url ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    url: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            baseFieldClass
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2 md:col-span-2">
                                                                                    <Label>
                                                                                        Description
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.description ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    description:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'multiple_choice' && (
                                                                            <div className="space-y-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Question
                                                                                        prompt
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.prompt ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    prompt: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            4
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                <div className="space-y-3">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <Label>
                                                                                            Answer
                                                                                            choices
                                                                                        </Label>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        choices:
                                                                                                            [
                                                                                                                ...(Array.isArray(
                                                                                                                    current.choices,
                                                                                                                )
                                                                                                                    ? current.choices
                                                                                                                    : []),
                                                                                                                '',
                                                                                                            ],
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <Plus className="size-4" />
                                                                                            Add
                                                                                            choice
                                                                                        </Button>
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        {(Array.isArray(
                                                                                            block.choices,
                                                                                        )
                                                                                            ? block.choices
                                                                                            : []
                                                                                        ).map(
                                                                                            (
                                                                                                choice,
                                                                                                choiceIndex,
                                                                                            ) => (
                                                                                                <div
                                                                                                    key={`${block.id}-choice-editor-${choiceIndex}`}
                                                                                                    className="flex items-center gap-2"
                                                                                                >
                                                                                                    <Input
                                                                                                        value={String(
                                                                                                            choice ??
                                                                                                                '',
                                                                                                        )}
                                                                                                        onChange={(
                                                                                                            event,
                                                                                                        ) =>
                                                                                                            updateSelectedBlock(
                                                                                                                index,
                                                                                                                (
                                                                                                                    current,
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    choices:
                                                                                                                        (Array.isArray(
                                                                                                                            current.choices,
                                                                                                                        )
                                                                                                                            ? current.choices
                                                                                                                            : []
                                                                                                                        ).map(
                                                                                                                            (
                                                                                                                                currentChoice,
                                                                                                                                currentChoiceIndex,
                                                                                                                            ) =>
                                                                                                                                currentChoiceIndex ===
                                                                                                                                choiceIndex
                                                                                                                                    ? event
                                                                                                                                          .target
                                                                                                                                          .value
                                                                                                                                    : currentChoice,
                                                                                                                        ),
                                                                                                                }),
                                                                                                            )
                                                                                                        }
                                                                                                        className={
                                                                                                            baseFieldClass
                                                                                                        }
                                                                                                        placeholder={`Choice ${choiceIndex + 1}`}
                                                                                                    />
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="icon"
                                                                                                        onClick={() =>
                                                                                                            updateSelectedBlock(
                                                                                                                index,
                                                                                                                (
                                                                                                                    current,
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    choices:
                                                                                                                        (Array.isArray(
                                                                                                                            current.choices,
                                                                                                                        )
                                                                                                                            ? current.choices
                                                                                                                            : []
                                                                                                                        ).filter(
                                                                                                                            (
                                                                                                                                _,
                                                                                                                                currentChoiceIndex,
                                                                                                                            ) =>
                                                                                                                                currentChoiceIndex !==
                                                                                                                                choiceIndex,
                                                                                                                        ),
                                                                                                                    correct_index:
                                                                                                                        Math.min(
                                                                                                                            Number(
                                                                                                                                current.correct_index ??
                                                                                                                                    0,
                                                                                                                            ),
                                                                                                                            Math.max(
                                                                                                                                0,
                                                                                                                                (Array.isArray(
                                                                                                                                    current.choices,
                                                                                                                                )
                                                                                                                                    ? current.choices
                                                                                                                                    : []
                                                                                                                                )
                                                                                                                                    .length -
                                                                                                                                    2,
                                                                                                                            ),
                                                                                                                        ),
                                                                                                                }),
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            (Array.isArray(
                                                                                                                block.choices,
                                                                                                            )
                                                                                                                ? block.choices
                                                                                                                : []
                                                                                                            )
                                                                                                                .length <=
                                                                                                            1
                                                                                                        }
                                                                                                    >
                                                                                                        <Trash2 className="size-4" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            ),
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid gap-4 md:grid-cols-2">
                                                                                    <div className="grid gap-2">
                                                                                        <Label>
                                                                                            Correct
                                                                                            answer
                                                                                        </Label>
                                                                                        <select
                                                                                            value={String(
                                                                                                block.correct_index ??
                                                                                                    0,
                                                                                            )}
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        correct_index:
                                                                                                            Number(
                                                                                                                event
                                                                                                                    .target
                                                                                                                    .value,
                                                                                                            ),
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                            className={
                                                                                                baseFieldClass
                                                                                            }
                                                                                        >
                                                                                            {(Array.isArray(
                                                                                                block.choices,
                                                                                            )
                                                                                                ? block.choices
                                                                                                : []
                                                                                            ).map(
                                                                                                (
                                                                                                    _,
                                                                                                    choiceIndex,
                                                                                                ) => (
                                                                                                    <option
                                                                                                        key={
                                                                                                            choiceIndex
                                                                                                        }
                                                                                                        value={
                                                                                                            choiceIndex
                                                                                                        }
                                                                                                    >
                                                                                                        Choice{' '}
                                                                                                        {choiceIndex +
                                                                                                            1}
                                                                                                    </option>
                                                                                                ),
                                                                                            )}
                                                                                        </select>
                                                                                    </div>
                                                                                    <div className="grid gap-2">
                                                                                        <Label>
                                                                                            Feedback
                                                                                        </Label>
                                                                                        <textarea
                                                                                            value={String(
                                                                                                block.correct_feedback ??
                                                                                                    '',
                                                                                            )}
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        correct_feedback:
                                                                                                            event
                                                                                                                .target
                                                                                                                .value,
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                            className={
                                                                                                textareaClass
                                                                                            }
                                                                                            rows={
                                                                                                3
                                                                                            }
                                                                                            placeholder="Correct. Great job."
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Incorrect
                                                                                        feedback
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.incorrect_feedback ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    incorrect_feedback:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                        placeholder="Review the PPE policy before continuing."
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'true_false' && (
                                                                            <div className="space-y-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Statement
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.statement ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    statement:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            4
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                <div className="grid gap-4 md:grid-cols-2">
                                                                                    <div className="grid gap-2">
                                                                                        <Label>
                                                                                            Correct
                                                                                            answer
                                                                                        </Label>
                                                                                        <select
                                                                                            value={String(
                                                                                                Boolean(
                                                                                                    block.correct_answer ??
                                                                                                    true,
                                                                                                ),
                                                                                            )}
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        correct_answer:
                                                                                                            event
                                                                                                                .target
                                                                                                                .value ===
                                                                                                            'true',
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                            className={
                                                                                                baseFieldClass
                                                                                            }
                                                                                        >
                                                                                            <option value="true">
                                                                                                True
                                                                                            </option>
                                                                                            <option value="false">
                                                                                                False
                                                                                            </option>
                                                                                        </select>
                                                                                    </div>
                                                                                    <div className="grid gap-2">
                                                                                        <Label>
                                                                                            Correct
                                                                                            feedback
                                                                                        </Label>
                                                                                        <textarea
                                                                                            value={String(
                                                                                                block.correct_feedback ??
                                                                                                    '',
                                                                                            )}
                                                                                            onChange={(
                                                                                                event,
                                                                                            ) =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        correct_feedback:
                                                                                                            event
                                                                                                                .target
                                                                                                                .value,
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                            className={
                                                                                                textareaClass
                                                                                            }
                                                                                            rows={
                                                                                                3
                                                                                            }
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Incorrect
                                                                                        feedback
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.incorrect_feedback ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    incorrect_feedback:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'ordering' && (
                                                                            <div className="space-y-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Prompt
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.prompt ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    prompt: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            4
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <div>
                                                                                            <Label>
                                                                                                Items
                                                                                                in
                                                                                                correct
                                                                                                order
                                                                                            </Label>
                                                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                                                Learners
                                                                                                will
                                                                                                receive
                                                                                                these
                                                                                                steps
                                                                                                shuffled.
                                                                                            </p>
                                                                                        </div>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        items: [
                                                                                                            ...(Array.isArray(
                                                                                                                current.items,
                                                                                                            )
                                                                                                                ? current.items
                                                                                                                : []),
                                                                                                            '',
                                                                                                        ],
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <Plus className="size-4" />
                                                                                            Add
                                                                                            item
                                                                                        </Button>
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        {(Array.isArray(
                                                                                            block.items,
                                                                                        )
                                                                                            ? block.items
                                                                                            : []
                                                                                        ).map(
                                                                                            (
                                                                                                item,
                                                                                                itemIndex,
                                                                                            ) => {
                                                                                                const items =
                                                                                                    Array.isArray(
                                                                                                        block.items,
                                                                                                    )
                                                                                                        ? block.items
                                                                                                        : [];

                                                                                                return (
                                                                                                    <div
                                                                                                        key={`${block.id}-ordering-item-${itemIndex}`}
                                                                                                        className="flex items-center gap-2 rounded-xl border bg-background p-2"
                                                                                                    >
                                                                                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                                                                                            {itemIndex +
                                                                                                                1}
                                                                                                        </span>
                                                                                                        <Input
                                                                                                            value={String(
                                                                                                                item ??
                                                                                                                    '',
                                                                                                            )}
                                                                                                            onChange={(
                                                                                                                event,
                                                                                                            ) =>
                                                                                                                updateSelectedBlock(
                                                                                                                    index,
                                                                                                                    (
                                                                                                                        current,
                                                                                                                    ) => ({
                                                                                                                        ...current,
                                                                                                                        items: (Array.isArray(
                                                                                                                            current.items,
                                                                                                                        )
                                                                                                                            ? current.items
                                                                                                                            : []
                                                                                                                        ).map(
                                                                                                                            (
                                                                                                                                currentItem,
                                                                                                                                currentIndex,
                                                                                                                            ) =>
                                                                                                                                currentIndex ===
                                                                                                                                itemIndex
                                                                                                                                    ? event
                                                                                                                                          .target
                                                                                                                                          .value
                                                                                                                                    : currentItem,
                                                                                                                        ),
                                                                                                                    }),
                                                                                                                )
                                                                                                            }
                                                                                                            className={
                                                                                                                baseFieldClass
                                                                                                            }
                                                                                                            placeholder={`Step ${itemIndex + 1}`}
                                                                                                            aria-label={`Ordering step ${itemIndex + 1}`}
                                                                                                        />
                                                                                                        <div className="flex shrink-0 items-center gap-1">
                                                                                                            <Button
                                                                                                                type="button"
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                disabled={
                                                                                                                    itemIndex ===
                                                                                                                    0
                                                                                                                }
                                                                                                                onClick={() =>
                                                                                                                    updateSelectedBlock(
                                                                                                                        index,
                                                                                                                        (
                                                                                                                            current,
                                                                                                                        ) => ({
                                                                                                                            ...current,
                                                                                                                            items: moveItem(
                                                                                                                                Array.isArray(
                                                                                                                                    current.items,
                                                                                                                                )
                                                                                                                                    ? current.items
                                                                                                                                    : [],
                                                                                                                                itemIndex,
                                                                                                                                itemIndex -
                                                                                                                                    1,
                                                                                                                            ),
                                                                                                                        }),
                                                                                                                    )
                                                                                                                }
                                                                                                                aria-label={`Move step ${itemIndex + 1} up`}
                                                                                                            >
                                                                                                                <ArrowUp className="size-4" />
                                                                                                            </Button>
                                                                                                            <Button
                                                                                                                type="button"
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                disabled={
                                                                                                                    itemIndex ===
                                                                                                                    items.length -
                                                                                                                        1
                                                                                                                }
                                                                                                                onClick={() =>
                                                                                                                    updateSelectedBlock(
                                                                                                                        index,
                                                                                                                        (
                                                                                                                            current,
                                                                                                                        ) => ({
                                                                                                                            ...current,
                                                                                                                            items: moveItem(
                                                                                                                                Array.isArray(
                                                                                                                                    current.items,
                                                                                                                                )
                                                                                                                                    ? current.items
                                                                                                                                    : [],
                                                                                                                                itemIndex,
                                                                                                                                itemIndex +
                                                                                                                                    1,
                                                                                                                            ),
                                                                                                                        }),
                                                                                                                    )
                                                                                                                }
                                                                                                                aria-label={`Move step ${itemIndex + 1} down`}
                                                                                                            >
                                                                                                                <ArrowDown className="size-4" />
                                                                                                            </Button>
                                                                                                            <Button
                                                                                                                type="button"
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                disabled={
                                                                                                                    items.length <=
                                                                                                                    2
                                                                                                                }
                                                                                                                onClick={() =>
                                                                                                                    updateSelectedBlock(
                                                                                                                        index,
                                                                                                                        (
                                                                                                                            current,
                                                                                                                        ) => ({
                                                                                                                            ...current,
                                                                                                                            items: (Array.isArray(
                                                                                                                                current.items,
                                                                                                                            )
                                                                                                                                ? current.items
                                                                                                                                : []
                                                                                                                            ).filter(
                                                                                                                                (
                                                                                                                                    _,
                                                                                                                                    currentIndex,
                                                                                                                                ) =>
                                                                                                                                    currentIndex !==
                                                                                                                                    itemIndex,
                                                                                                                            ),
                                                                                                                        }),
                                                                                                                    )
                                                                                                                }
                                                                                                                aria-label={`Remove step ${itemIndex + 1}`}
                                                                                                            >
                                                                                                                <Trash2 className="size-4" />
                                                                                                            </Button>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            },
                                                                                        )}
                                                                                    </div>
                                                                                    {(!Array.isArray(
                                                                                        block.items,
                                                                                    ) ||
                                                                                        block
                                                                                            .items
                                                                                            .length <
                                                                                            2) && (
                                                                                        <p className="text-xs font-medium text-amber-700">
                                                                                            Add
                                                                                            at
                                                                                            least
                                                                                            two
                                                                                            steps.
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'matching' && (
                                                                            <div className="space-y-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Prompt
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.prompt ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    prompt: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-3">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <Label>
                                                                                            Pairs
                                                                                        </Label>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() =>
                                                                                                updateSelectedBlock(
                                                                                                    index,
                                                                                                    (
                                                                                                        current,
                                                                                                    ) => ({
                                                                                                        ...current,
                                                                                                        pairs: [
                                                                                                            ...(Array.isArray(
                                                                                                                current.pairs,
                                                                                                            )
                                                                                                                ? current.pairs
                                                                                                                : []),
                                                                                                            {
                                                                                                                left: '',
                                                                                                                right: '',
                                                                                                            },
                                                                                                        ],
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <Plus className="size-4" />
                                                                                            Add
                                                                                            pair
                                                                                        </Button>
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        {(Array.isArray(
                                                                                            block.pairs,
                                                                                        )
                                                                                            ? block.pairs
                                                                                            : []
                                                                                        ).map(
                                                                                            (
                                                                                                pair,
                                                                                                pairIndex,
                                                                                            ) => (
                                                                                                <div
                                                                                                    key={`${block.id}-pair-editor-${pairIndex}`}
                                                                                                    className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
                                                                                                >
                                                                                                    <Input
                                                                                                        value={String(
                                                                                                            pair?.left ??
                                                                                                                '',
                                                                                                        )}
                                                                                                        onChange={(
                                                                                                            event,
                                                                                                        ) =>
                                                                                                            updateSelectedBlock(
                                                                                                                index,
                                                                                                                (
                                                                                                                    current,
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    pairs: (Array.isArray(
                                                                                                                        current.pairs,
                                                                                                                    )
                                                                                                                        ? current.pairs
                                                                                                                        : []
                                                                                                                    ).map(
                                                                                                                        (
                                                                                                                            currentPair,
                                                                                                                            currentPairIndex,
                                                                                                                        ) =>
                                                                                                                            currentPairIndex ===
                                                                                                                            pairIndex
                                                                                                                                ? {
                                                                                                                                      ...currentPair,
                                                                                                                                      left: event
                                                                                                                                          .target
                                                                                                                                          .value,
                                                                                                                                  }
                                                                                                                                : currentPair,
                                                                                                                    ),
                                                                                                                }),
                                                                                                            )
                                                                                                        }
                                                                                                        className={
                                                                                                            baseFieldClass
                                                                                                        }
                                                                                                        placeholder="Left"
                                                                                                    />
                                                                                                    <span className="hidden items-center justify-center text-muted-foreground md:flex">
                                                                                                        →
                                                                                                    </span>
                                                                                                    <Input
                                                                                                        value={String(
                                                                                                            pair?.right ??
                                                                                                                '',
                                                                                                        )}
                                                                                                        onChange={(
                                                                                                            event,
                                                                                                        ) =>
                                                                                                            updateSelectedBlock(
                                                                                                                index,
                                                                                                                (
                                                                                                                    current,
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    pairs: (Array.isArray(
                                                                                                                        current.pairs,
                                                                                                                    )
                                                                                                                        ? current.pairs
                                                                                                                        : []
                                                                                                                    ).map(
                                                                                                                        (
                                                                                                                            currentPair,
                                                                                                                            currentPairIndex,
                                                                                                                        ) =>
                                                                                                                            currentPairIndex ===
                                                                                                                            pairIndex
                                                                                                                                ? {
                                                                                                                                      ...currentPair,
                                                                                                                                      right: event
                                                                                                                                          .target
                                                                                                                                          .value,
                                                                                                                                  }
                                                                                                                                : currentPair,
                                                                                                                    ),
                                                                                                                }),
                                                                                                            )
                                                                                                        }
                                                                                                        className={
                                                                                                            baseFieldClass
                                                                                                        }
                                                                                                        placeholder="Right"
                                                                                                    />
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="icon"
                                                                                                        onClick={() =>
                                                                                                            updateSelectedBlock(
                                                                                                                index,
                                                                                                                (
                                                                                                                    current,
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    pairs: (Array.isArray(
                                                                                                                        current.pairs,
                                                                                                                    )
                                                                                                                        ? current.pairs
                                                                                                                        : []
                                                                                                                    ).filter(
                                                                                                                        (
                                                                                                                            _,
                                                                                                                            currentPairIndex,
                                                                                                                        ) =>
                                                                                                                            currentPairIndex !==
                                                                                                                            pairIndex,
                                                                                                                    ),
                                                                                                                }),
                                                                                                            )
                                                                                                        }
                                                                                                        disabled={
                                                                                                            (Array.isArray(
                                                                                                                block.pairs,
                                                                                                            )
                                                                                                                ? block.pairs
                                                                                                                : []
                                                                                                            )
                                                                                                                .length <=
                                                                                                            1
                                                                                                        }
                                                                                                    >
                                                                                                        <Trash2 className="size-4" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            ),
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {block.type ===
                                                                            'scenario' && (
                                                                            <div className="space-y-4">
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Prompt
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.prompt ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    prompt: event
                                                                                                        .target
                                                                                                        .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            4
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="grid gap-2">
                                                                                    <Label>
                                                                                        Guidance
                                                                                    </Label>
                                                                                    <textarea
                                                                                        value={String(
                                                                                            block.guidance ??
                                                                                                '',
                                                                                        )}
                                                                                        onChange={(
                                                                                            event,
                                                                                        ) =>
                                                                                            updateSelectedBlock(
                                                                                                index,
                                                                                                (
                                                                                                    current,
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    guidance:
                                                                                                        event
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        className={
                                                                                            textareaClass
                                                                                        }
                                                                                        rows={
                                                                                            3
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                )}
                                                <Button
                                                    variant="outline"
                                                    className="min-h-12 w-full border-dashed"
                                                    onClick={() =>
                                                        openActivityPicker(
                                                            selectedLesson
                                                                .content.length,
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add content
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="rounded-3xl border bg-card/95 p-4 text-sm text-muted-foreground shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <span>
                            Selected lesson:{' '}
                            {selectedLessonIndex >= 0
                                ? selectedLessonIndex + 1
                                : 0}
                        </span>
                        <span>•</span>
                        <span>{course.lesson_count} lessons on the server</span>
                        <span>•</span>
                        <span>{course.assignment_count} assignments</span>
                    </div>
                </div>
            </main>

            <Dialog
                open={activityPickerOpen}
                onOpenChange={(open) => {
                    setActivityPickerOpen(open);

                    if (!open) {
                        setActivitySearch('');
                        setBlockInsertionIndex(null);
                    }
                }}
            >
                <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[760px]">
                    <DialogHeader>
                        <DialogTitle>Add content</DialogTitle>
                        <DialogDescription>
                            Choose the next block to add at this point in the
                            lesson.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={activitySearch}
                            onChange={(event) =>
                                setActivitySearch(event.target.value)
                            }
                            className="h-11 pl-9"
                            placeholder="Search content types..."
                            aria-label="Search content types"
                        />
                    </div>

                    <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
                        {visibleActivityGroups.length === 0 ? (
                            <div className="rounded-2xl border border-dashed p-8 text-center">
                                <p className="font-medium">
                                    No content types found
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Try a different search term.
                                </p>
                            </div>
                        ) : (
                            visibleActivityGroups.map((group) => (
                                <section
                                    key={group.title}
                                    className="space-y-2"
                                >
                                    <h3 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                                        {group.title}
                                    </h3>
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;

                                            return (
                                                <button
                                                    key={item.type}
                                                    type="button"
                                                    onClick={() =>
                                                        addBlock(item.type)
                                                    }
                                                    className="group min-h-32 rounded-2xl border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                                >
                                                    <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white transition-transform group-hover:-translate-y-0.5">
                                                        <Icon className="size-4" />
                                                    </span>
                                                    <span className="block text-sm font-semibold">
                                                        {item.label}
                                                    </span>
                                                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                                        {item.description}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActivityPickerOpen(false)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={readinessOpen} onOpenChange={setReadinessOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Course readiness: {readinessPercent}%
                        </DialogTitle>
                        <DialogDescription>
                            Required items should be complete before publishing.
                            Recommendations improve the learner experience but
                            do not block publishing.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                        {(
                            [
                                'Required before publishing',
                                'Recommended',
                            ] as const
                        ).map((group) => {
                            const required =
                                group === 'Required before publishing';
                            const items = readinessChecklist.filter(
                                (item) => item.required === required,
                            );

                            return (
                                <div key={group} className="space-y-2">
                                    <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                                        {group}
                                    </p>
                                    {items.map((item) => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => {
                                                setWorkspaceView(item.view);
                                                setReadinessOpen(false);
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/40"
                                        >
                                            {item.complete ? (
                                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                                            ) : (
                                                <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                                            )}
                                            <span className="flex-1 text-sm font-medium">
                                                {item.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.complete
                                                    ? 'Complete'
                                                    : 'Review'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={publishReviewOpen}
                onOpenChange={setPublishReviewOpen}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {courseDraft.status === 'published'
                                ? 'Publish course changes'
                                : 'Publish course'}
                        </DialogTitle>
                        <DialogDescription>
                            Choose which lessons learners can access. Unchecked
                            lessons will remain drafts.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">
                                    Lessons to publish
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {publishLessonIds.length} of{' '}
                                    {lessonDrafts.length} selected
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setPublishLessonIds(
                                            lessonDrafts
                                                .filter(lessonHasContent)
                                                .map((lesson) => lesson.id),
                                        )
                                    }
                                >
                                    Select ready
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setPublishLessonIds(
                                            finalAssessment &&
                                                finalAssessmentHasQuestions
                                                ? [finalAssessment.id]
                                                : [],
                                        )
                                    }
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border p-2">
                            {lessonDrafts.length === 0 ? (
                                <div className="p-5 text-center text-sm text-muted-foreground">
                                    Add a lesson before publishing this course.
                                </div>
                            ) : (
                                lessonDrafts.map((lesson, index) => {
                                    const checked = publishLessonIds.includes(
                                        lesson.id,
                                    );
                                    const hasContent = lessonHasContent(lesson);

                                    return (
                                        <label
                                            key={lesson.id}
                                            htmlFor={`publish-lesson-${lesson.id}`}
                                            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40"
                                        >
                                            <Checkbox
                                                id={`publish-lesson-${lesson.id}`}
                                                checked={checked}
                                                disabled={
                                                    lesson.is_final_assessment
                                                }
                                                onCheckedChange={(
                                                    nextChecked,
                                                ) =>
                                                    setPublishLessonIds(
                                                        (current) =>
                                                            nextChecked === true
                                                                ? Array.from(
                                                                      new Set([
                                                                          ...current,
                                                                          lesson.id,
                                                                      ]),
                                                                  )
                                                                : current.filter(
                                                                      (
                                                                          lessonId,
                                                                      ) =>
                                                                          lessonId !==
                                                                          lesson.id,
                                                                  ),
                                                    )
                                                }
                                                className="mt-0.5"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {index + 1}.{' '}
                                                    {lesson.title ||
                                                        'Untitled lesson'}
                                                    {lesson.is_final_assessment && (
                                                        <span className="ml-2 text-xs font-semibold text-emerald-700">
                                                            Final assessment
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {lesson.content.length}{' '}
                                                    content block
                                                    {lesson.content.length === 1
                                                        ? ''
                                                        : 's'}
                                                    {' · '}
                                                    {hasContent
                                                        ? checked
                                                            ? 'Will publish'
                                                            : 'Will stay draft'
                                                        : 'Needs content'}
                                                </span>
                                            </span>
                                            <Badge
                                                variant={
                                                    checked && hasContent
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                            >
                                                {checked ? 'Selected' : 'Draft'}
                                            </Badge>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                                Lessons publishing
                            </span>
                            <span className="font-semibold">
                                {publishLessonIds.length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                                Scored assessment questions
                            </span>
                            <span className="font-semibold">
                                {finalAssessment &&
                                publishLessonIds.includes(finalAssessment.id)
                                    ? finalAssessment.content.filter(
                                          isGradedBlock,
                                      ).length
                                    : 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                                Estimated duration
                            </span>
                            <span className="font-semibold">
                                {courseDraft.estimated_minutes
                                    ? `${courseDraft.estimated_minutes} min`
                                    : 'Not set'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                                Assigned learners
                            </span>
                            <span className="font-semibold">
                                {resultsSummary.recipients}
                            </span>
                        </div>
                    </div>
                    {readinessChecklist.some(
                        (item) => item.required && !item.complete,
                    ) && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            Complete the required readiness items before
                            publishing.
                        </div>
                    )}
                    {publishLessonIds.length === 0 && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            Select at least one lesson to publish.
                        </div>
                    )}
                    {selectedPublishLessonsMissingContent.length > 0 && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            Add content to every selected lesson, or leave the
                            unfinished lessons unchecked.
                        </div>
                    )}
                    {finalAssessmentMissingFromPublish && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            The final assessment must be published with the
                            course.
                        </div>
                    )}
                    {finalAssessment && !finalAssessmentHasQuestions && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            Add at least one question to the final assessment
                            before publishing.
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPublishReviewOpen(false)}
                        >
                            Keep editing
                        </Button>
                        <Button
                            onClick={() => {
                                const publishCourse = () =>
                                    saveCourse('published', publishLessonIds);

                                if (hasUnsavedChanges) {
                                    saveChanges(publishCourse);

                                    return;
                                }

                                publishCourse();
                            }}
                            disabled={
                                publishIsBlocked || saveState === 'saving'
                            }
                        >
                            {saveState === 'saving' && <Spinner />}
                            Publish {publishLessonIds.length}{' '}
                            {publishLessonIds.length === 1
                                ? 'lesson'
                                : 'lessons'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isTesting && (
                <CourseTestRunner
                    courseTitle={courseDraft.title || course.title}
                    courseDescription={
                        courseDraft.description || course.description
                    }
                    learningObjectives={learningObjectives}
                    passingScore={fromNumberField(courseDraft.passing_score)}
                    estimatedMinutes={fromNumberField(
                        courseDraft.estimated_minutes,
                    )}
                    lessons={lessonDrafts}
                    startLessonId={
                        selectedLesson?.id ?? lessonDrafts[0]?.id ?? null
                    }
                    onClose={() => setIsTesting(false)}
                />
            )}
        </>
    );
}

export default function CourseBuilder() {
    const { props } = usePage<PageProps>();

    const courseSignature = `${props.course.id}:${props.course.archived_at ?? ''}`;
    const lessonSignature = props.lessons
        .map((lesson) => `${lesson.id}:${lesson.position}`)
        .join('|');
    const pageKey = `${courseSignature}::${lessonSignature}::${props.selected_lesson_id ?? ''}::${props.selected_workspace_view ?? ''}::${props.selected_preview_mode}::${props.selected_assignment_target_type ?? ''}::${props.selected_assignment_target_id ?? ''}::${props.selected_assignment_due_at ?? ''}`;

    return <CourseBuilderPage key={pageKey} {...props} />;
}
