import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Archive,
    ArrowLeft,
    ArrowUpRight,
    BookOpen,
    CheckCircle2,
    ExternalLink,
    File,
    FileText,
    Link2,
    MoreHorizontal,
    Pencil,
    Play,
    Plus,
    Search,
    Sparkles,
    UploadCloud,
    Video,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import Heading from '@/components/heading';
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
import type { Auth } from '@/types';

type ResourceType = 'quick_guide' | 'file' | 'video' | 'external_link';
type LibraryTab = 'all' | 'featured' | 'needs_review' | 'archived';
type GuideBlockType =
    | 'heading'
    | 'paragraph'
    | 'numbered_steps'
    | 'bulleted_list'
    | 'checklist'
    | 'image'
    | 'warning'
    | 'stop'
    | 'contact'
    | 'related_course'
    | 'attached_file';

type NamedOption = { id: number; name: string };
type CourseOption = {
    id: number;
    title: string;
    status: string;
    status_label: string;
};
type GuideBlock = {
    id: string;
    type: GuideBlockType;
    text?: string;
    items?: string[];
    url?: string;
    label?: string;
    course_id?: number | null;
};
type ResourceVersion = {
    id: number;
    version_number: number;
    url: string;
    original_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    uploaded_by: { id: number; name: string; email: string } | null;
    created_at: string | null;
};
type ResourceRow = {
    id: number;
    resource_type: ResourceType;
    resource_type_label: string;
    title: string;
    description: string | null;
    quick_guide_content: GuideBlock[];
    video_url: string | null;
    external_url: string | null;
    category: string | null;
    tags: string[];
    featured: boolean;
    audience_everyone: boolean;
    job_title_ids: number[];
    team_ids: number[];
    location_ids: number[];
    course_ids: number[];
    job_titles: string[];
    teams: string[];
    locations: string[];
    related_courses: { id: number; title: string; status: string }[];
    revision_date: string | null;
    effective_date: string | null;
    review_date: string | null;
    expiration_date: string | null;
    published_at: string | null;
    needs_review: boolean;
    status: string;
    status_label: string;
    current_version: number;
    version_count: number;
    view_count: number;
    latest_version: ResourceVersion | null;
    versions: ResourceVersion[];
    created_by: { id: number; name: string; email: string } | null;
    updated_by: { id: number; name: string; email: string } | null;
    created_at: string | null;
    updated_at: string | null;
};
type PageProps = {
    auth: Auth;
    organization: { id: number; name: string; slug: string };
    resources: ResourceRow[];
    courses: CourseOption[];
    categoryOptions: string[];
    jobTitles: NamedOption[];
    teams: NamedOption[];
    locations: NamedOption[];
};
type ResourceDraft = {
    resource_type: ResourceType;
    title: string;
    description: string;
    category: string;
    tags: string;
    featured: boolean;
    audience_everyone: boolean;
    job_title_ids: number[];
    team_ids: number[];
    location_ids: number[];
    course_ids: number[];
    quick_guide_content: GuideBlock[];
    video_url: string;
    external_url: string;
    effective_date: string;
    review_date: string;
    expiration_date: string;
};

const fieldClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClass =
    'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const resourceChoices: Array<{
    type: ResourceType;
    title: string;
    description: string;
    icon: typeof BookOpen;
}> = [
    {
        type: 'quick_guide',
        title: 'Quick guide',
        description:
            'Build a mobile-friendly checklist or procedure employees can read instantly.',
        icon: BookOpen,
    },
    {
        type: 'file',
        title: 'Upload a file',
        description: 'Add a PDF, document, image, or downloadable job aid.',
        icon: UploadCloud,
    },
    {
        type: 'video',
        title: 'Add a video',
        description: 'Upload or link to a field-support video.',
        icon: Video,
    },
    {
        type: 'external_link',
        title: 'Add an external link',
        description: 'Link to an approved website, system, or reference page.',
        icon: ExternalLink,
    },
];

const guideBlockOptions: Array<{
    type: GuideBlockType;
    label: string;
}> = [
    { type: 'heading', label: 'Heading' },
    { type: 'paragraph', label: 'Paragraph' },
    { type: 'numbered_steps', label: 'Numbered steps' },
    { type: 'bulleted_list', label: 'Bulleted list' },
    { type: 'checklist', label: 'Checklist' },
    { type: 'image', label: 'Image' },
    { type: 'warning', label: 'Warning' },
    { type: 'stop', label: 'Stop and escalate' },
    { type: 'contact', label: 'Contact button' },
    { type: 'related_course', label: 'Related course' },
    { type: 'attached_file', label: 'Attached file' },
];

function uid(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value: string | null): string {
    if (!value) {
        return 'Not set';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Not set';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function audienceLabel(resource: ResourceRow): string {
    if (resource.audience_everyone) {
        return 'Everyone';
    }

    const labels = [
        ...resource.job_titles,
        ...resource.teams,
        ...resource.locations,
    ];

    return labels.length > 0 ? labels.join(', ') : 'Not assigned';
}

function resourceIcon(type: ResourceType) {
    if (type === 'quick_guide') {
        return BookOpen;
    }

    if (type === 'video') {
        return Play;
    }

    if (type === 'external_link') {
        return Link2;
    }

    return FileText;
}

function createGuideBlock(type: GuideBlockType): GuideBlock {
    if (['numbered_steps', 'bulleted_list', 'checklist'].includes(type)) {
        return { id: uid(), type, items: [''] };
    }

    if (type === 'related_course') {
        return { id: uid(), type, course_id: null };
    }

    return { id: uid(), type, text: '', url: '', label: '' };
}

function createDraft(
    type: ResourceType,
    resource: ResourceRow | null,
): ResourceDraft {
    return {
        resource_type: resource?.resource_type ?? type,
        title: resource?.title ?? '',
        description: resource?.description ?? '',
        category: resource?.category ?? '',
        tags: resource?.tags.join(', ') ?? '',
        featured: resource?.featured ?? false,
        audience_everyone: resource?.audience_everyone ?? true,
        job_title_ids: resource?.job_title_ids ?? [],
        team_ids: resource?.team_ids ?? [],
        location_ids: resource?.location_ids ?? [],
        course_ids: resource?.course_ids ?? [],
        quick_guide_content: resource?.quick_guide_content ?? [],
        video_url: resource?.video_url ?? '',
        external_url: resource?.external_url ?? '',
        effective_date: resource?.effective_date ?? '',
        review_date: resource?.review_date ?? '',
        expiration_date: resource?.expiration_date ?? '',
    };
}

function MultiChoice({
    title,
    options,
    selected,
    onChange,
}: {
    title: string;
    options: NamedOption[];
    selected: number[];
    onChange: (ids: number[]) => void;
}) {
    return (
        <div className="space-y-2">
            <Label>{title}</Label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
                {options.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                        No options created yet.
                    </p>
                ) : (
                    options.map((option) => (
                        <label
                            key={option.id}
                            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted/50"
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(option.id)}
                                onChange={() =>
                                    onChange(
                                        selected.includes(option.id)
                                            ? selected.filter(
                                                  (id) => id !== option.id,
                                              )
                                            : [...selected, option.id],
                                    )
                                }
                                className="size-4 rounded border-input"
                            />
                            {option.name}
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}

function GuidePreview({ blocks }: { blocks: GuideBlock[] }) {
    return (
        <div className="space-y-4">
            {blocks.map((block, index) => {
                if (block.type === 'heading') {
                    return (
                        <h3 key={block.id} className="text-xl font-semibold">
                            {block.text || `Section ${index + 1}`}
                        </h3>
                    );
                }

                if (block.type === 'paragraph') {
                    return (
                        <p key={block.id} className="leading-7 text-slate-700">
                            {block.text || 'Guide text'}
                        </p>
                    );
                }

                if (
                    ['numbered_steps', 'bulleted_list', 'checklist'].includes(
                        block.type,
                    )
                ) {
                    const ordered = block.type === 'numbered_steps';
                    const Tag = ordered ? 'ol' : 'ul';

                    return (
                        <Tag
                            key={block.id}
                            className={`space-y-2 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}
                        >
                            {(block.items ?? []).filter(Boolean).map((item) => (
                                <li key={item} className="leading-6">
                                    {block.type === 'checklist'
                                        ? `□ ${item}`
                                        : item}
                                </li>
                            ))}
                        </Tag>
                    );
                }

                if (block.type === 'warning' || block.type === 'stop') {
                    return (
                        <div
                            key={block.id}
                            className={`rounded-2xl border-l-4 p-4 ${
                                block.type === 'stop'
                                    ? 'border-rose-500 bg-rose-50 text-rose-950'
                                    : 'border-amber-500 bg-amber-50 text-amber-950'
                            }`}
                        >
                            <div className="text-xs font-semibold tracking-widest uppercase">
                                {block.type === 'stop'
                                    ? 'Stop and escalate if'
                                    : 'Warning'}
                            </div>
                            <p className="mt-2 leading-6">
                                {block.text || 'Add important guidance.'}
                            </p>
                        </div>
                    );
                }

                if (block.type === 'image') {
                    return block.url ? (
                        <img
                            key={block.id}
                            src={block.url}
                            alt={block.label || 'Guide illustration'}
                            className="w-full rounded-2xl border object-cover"
                        />
                    ) : (
                        <div
                            key={block.id}
                            className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground"
                        >
                            Image placeholder
                        </div>
                    );
                }

                if (block.type === 'contact') {
                    return (
                        <Button key={block.id} className="w-full">
                            {block.label || 'Contact supervisor'}
                        </Button>
                    );
                }

                return (
                    <div
                        key={block.id}
                        className="flex items-center gap-3 rounded-2xl border p-4 text-sm"
                    >
                        <Link2 className="size-4 text-primary" />
                        {block.label ||
                            (block.type === 'related_course'
                                ? 'Related course'
                                : 'Attached resource')}
                    </div>
                );
            })}
        </div>
    );
}

function ResourcePreview({
    open,
    onOpenChange,
    resource,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    resource: ResourceRow | null;
}) {
    if (!resource) {
        return null;
    }

    const url =
        resource.latest_version?.url ??
        resource.video_url ??
        resource.external_url;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-xl">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            {resource.resource_type_label}
                        </Badge>
                        {resource.featured && <Badge>Featured</Badge>}
                    </div>
                    <DialogTitle className="text-2xl">
                        {resource.title}
                    </DialogTitle>
                    <DialogDescription>
                        {resource.description || 'No description provided.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto rounded-3xl border bg-white p-5">
                    {resource.resource_type === 'quick_guide' ? (
                        <GuidePreview blocks={resource.quick_guide_content} />
                    ) : resource.resource_type === 'video' && url ? (
                        <div className="space-y-4 text-center">
                            <div className="flex aspect-video items-center justify-center rounded-2xl bg-slate-950 text-white">
                                <Play className="size-10" />
                            </div>
                            <Button asChild>
                                <a href={url} target="_blank" rel="noreferrer">
                                    Open video{' '}
                                    <ArrowUpRight className="size-4" />
                                </a>
                            </Button>
                        </div>
                    ) : url ? (
                        <div className="space-y-4 text-center">
                            <File className="mx-auto size-12 text-primary" />
                            <p className="text-sm text-muted-foreground">
                                {resource.latest_version?.original_name ?? url}
                            </p>
                            <Button asChild>
                                <a href={url} target="_blank" rel="noreferrer">
                                    Open resource{' '}
                                    <ArrowUpRight className="size-4" />
                                </a>
                            </Button>
                        </div>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground">
                            This resource does not have previewable content yet.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Updated {formatDate(resource.updated_at)}</span>
                    <span>•</span>
                    <span>{audienceLabel(resource)}</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ResourceEditor({
    open,
    onOpenChange,
    organizationId,
    type,
    resource,
    courses,
    categories,
    jobTitles,
    teams,
    locations,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationId: number;
    type: ResourceType;
    resource: ResourceRow | null;
    courses: CourseOption[];
    categories: string[];
    jobTitles: NamedOption[];
    teams: NamedOption[];
    locations: NamedOption[];
}) {
    const [draft, setDraft] = useState(() => createDraft(type, resource));
    const [file, setFile] = useState<File | null>(null);
    const [guideBlockType, setGuideBlockType] =
        useState<GuideBlockType>('paragraph');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const isEditing = resource !== null;

    const updateBlock = (index: number, patch: Partial<GuideBlock>) => {
        setDraft((current) => ({
            ...current,
            quick_guide_content: current.quick_guide_content.map(
                (block, blockIndex) =>
                    blockIndex === index ? { ...block, ...patch } : block,
            ),
        }));
    };

    const submit = () => {
        if (!draft.title.trim()) {
            setErrors({ title: 'Add a title for this resource.' });

            return;
        }

        if (
            isEditing &&
            file &&
            !window.confirm(
                'Publish a new version? The existing version will remain in history.',
            )
        ) {
            return;
        }

        const payload = new FormData();
        payload.append('resource_type', draft.resource_type);
        payload.append('title', draft.title);
        payload.append('description', draft.description);
        payload.append('category', draft.category);
        payload.append('tags', draft.tags);
        payload.append('featured', draft.featured ? '1' : '0');
        payload.append(
            'audience_everyone',
            draft.audience_everyone ? '1' : '0',
        );
        payload.append(
            'quick_guide_content',
            JSON.stringify(draft.quick_guide_content),
        );
        payload.append('video_url', draft.video_url);
        payload.append('external_url', draft.external_url);
        payload.append('effective_date', draft.effective_date);
        payload.append('review_date', draft.review_date);
        payload.append('expiration_date', draft.expiration_date);
        draft.job_title_ids.forEach((id) =>
            payload.append('job_title_ids[]', String(id)),
        );
        draft.team_ids.forEach((id) =>
            payload.append('team_ids[]', String(id)),
        );
        draft.location_ids.forEach((id) =>
            payload.append('location_ids[]', String(id)),
        );
        draft.course_ids.forEach((id) =>
            payload.append('course_ids[]', String(id)),
        );

        if (file) {
            payload.append('file', file);
        }

        setSaving(true);
        setErrors({});
        const url = isEditing
            ? `/organizations/${organizationId}/resources/${resource.id}`
            : `/organizations/${organizationId}/resources`;
        const options = {
            preserveScroll: true,
            onError: (nextErrors: Record<string, string>) =>
                setErrors(nextErrors),
            onSuccess: () => onOpenChange(false),
            onFinish: () => setSaving(false),
        };

        if (isEditing) {
            router.patch(url, payload, options);
        } else {
            router.post(url, payload, options);
        }
    };

    const previewResource: ResourceRow = {
        ...(resource ?? {
            id: 0,
            status: 'active',
            status_label: 'Published',
            current_version: 0,
            version_count: 0,
            view_count: 0,
            latest_version: null,
            versions: [],
            created_by: null,
            updated_by: null,
            created_at: null,
            updated_at: null,
            revision_date: null,
            published_at: null,
            needs_review: false,
            job_titles: [],
            teams: [],
            locations: [],
            related_courses: [],
        }),
        ...draft,
        description: draft.description || null,
        video_url: draft.video_url || null,
        external_url: draft.external_url || null,
        category: draft.category || null,
        tags: draft.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        effective_date: draft.effective_date || null,
        review_date: draft.review_date || null,
        expiration_date: draft.expiration_date || null,
        resource_type_label:
            resourceChoices.find(
                (choice) => choice.type === draft.resource_type,
            )?.title ?? 'Resource',
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl">
                    <DialogHeader className="border-b px-6 pt-6 pb-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {resourceChoices.find(
                                    (choice) =>
                                        choice.type === draft.resource_type,
                                )?.title ?? 'Resource'}
                            </Badge>
                            {isEditing && (
                                <span className="text-xs text-muted-foreground">
                                    Version {resource.current_version}
                                </span>
                            )}
                        </div>
                        <DialogTitle className="text-2xl">
                            {isEditing ? 'Edit resource' : 'Create resource'}
                        </DialogTitle>
                        <DialogDescription>
                            Keep the content focused, searchable, and easy to
                            use at the point of work.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[calc(92vh-190px)] space-y-7 overflow-y-auto px-6 py-5">
                        <section className="space-y-4">
                            <div>
                                <h3 className="font-semibold">Content</h3>
                                <p className="text-sm text-muted-foreground">
                                    Add the resource employees will open.
                                </p>
                            </div>

                            {draft.resource_type === 'quick_guide' && (
                                <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                                    {draft.quick_guide_content.length === 0 && (
                                        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                                            Add the first block to build your
                                            mobile-native guide.
                                        </div>
                                    )}
                                    {draft.quick_guide_content.map(
                                        (block, index) => (
                                            <div
                                                key={block.id}
                                                className="rounded-2xl border bg-background p-4"
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                        {guideBlockOptions.find(
                                                            (option) =>
                                                                option.type ===
                                                                block.type,
                                                        )?.label ?? block.type}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Remove block"
                                                        onClick={() =>
                                                            setDraft(
                                                                (current) => ({
                                                                    ...current,
                                                                    quick_guide_content:
                                                                        current.quick_guide_content.filter(
                                                                            (
                                                                                _,
                                                                                blockIndex,
                                                                            ) =>
                                                                                blockIndex !==
                                                                                index,
                                                                        ),
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                                {[
                                                    'numbered_steps',
                                                    'bulleted_list',
                                                    'checklist',
                                                ].includes(block.type) ? (
                                                    <textarea
                                                        value={(
                                                            block.items ?? []
                                                        ).join('\n')}
                                                        onChange={(event) =>
                                                            updateBlock(index, {
                                                                items: event.target.value.split(
                                                                    '\n',
                                                                ),
                                                            })
                                                        }
                                                        className={
                                                            textareaClass
                                                        }
                                                        rows={4}
                                                        placeholder="One item per line"
                                                    />
                                                ) : block.type ===
                                                  'related_course' ? (
                                                    <select
                                                        value={
                                                            block.course_id ??
                                                            ''
                                                        }
                                                        onChange={(event) =>
                                                            updateBlock(index, {
                                                                course_id: event
                                                                    .target
                                                                    .value
                                                                    ? Number(
                                                                          event
                                                                              .target
                                                                              .value,
                                                                      )
                                                                    : null,
                                                                label:
                                                                    courses.find(
                                                                        (
                                                                            course,
                                                                        ) =>
                                                                            course.id ===
                                                                            Number(
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            ),
                                                                    )?.title ??
                                                                    '',
                                                            })
                                                        }
                                                        className={fieldClass}
                                                    >
                                                        <option value="">
                                                            Choose a course
                                                        </option>
                                                        {courses.map(
                                                            (course) => (
                                                                <option
                                                                    key={
                                                                        course.id
                                                                    }
                                                                    value={
                                                                        course.id
                                                                    }
                                                                >
                                                                    {
                                                                        course.title
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                ) : (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <textarea
                                                            value={
                                                                block.text ?? ''
                                                            }
                                                            onChange={(event) =>
                                                                updateBlock(
                                                                    index,
                                                                    {
                                                                        text: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                )
                                                            }
                                                            className={`${textareaClass} md:col-span-2`}
                                                            rows={3}
                                                            placeholder="Add content..."
                                                        />
                                                        {[
                                                            'image',
                                                            'contact',
                                                            'attached_file',
                                                        ].includes(
                                                            block.type,
                                                        ) && (
                                                            <>
                                                                <Input
                                                                    value={
                                                                        block.label ??
                                                                        ''
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        updateBlock(
                                                                            index,
                                                                            {
                                                                                label: event
                                                                                    .target
                                                                                    .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    placeholder="Button label or image description"
                                                                />
                                                                <Input
                                                                    value={
                                                                        block.url ??
                                                                        ''
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        updateBlock(
                                                                            index,
                                                                            {
                                                                                url: event
                                                                                    .target
                                                                                    .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    placeholder="https://..."
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    )}
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <select
                                            value={guideBlockType}
                                            onChange={(event) =>
                                                setGuideBlockType(
                                                    event.target
                                                        .value as GuideBlockType,
                                                )
                                            }
                                            className={fieldClass}
                                        >
                                            {guideBlockOptions.map((option) => (
                                                <option
                                                    key={option.type}
                                                    value={option.type}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    quick_guide_content: [
                                                        ...current.quick_guide_content,
                                                        createGuideBlock(
                                                            guideBlockType,
                                                        ),
                                                    ],
                                                }))
                                            }
                                        >
                                            <Plus className="size-4" /> Add
                                            block
                                        </Button>
                                    </div>
                                    <InputError
                                        message={errors.quick_guide_content}
                                    />
                                </div>
                            )}

                            {(draft.resource_type === 'file' ||
                                draft.resource_type === 'video') && (
                                <div className="grid gap-3">
                                    {draft.resource_type === 'video' && (
                                        <>
                                            <Label htmlFor="resource-video-url">
                                                Video link
                                            </Label>
                                            <Input
                                                id="resource-video-url"
                                                value={draft.video_url}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        video_url:
                                                            event.target.value,
                                                    }))
                                                }
                                                placeholder="https://..."
                                            />
                                            <InputError
                                                message={errors.video_url}
                                            />
                                            <div className="text-center text-xs text-muted-foreground">
                                                or upload a video
                                            </div>
                                        </>
                                    )}
                                    <label className="cursor-pointer rounded-2xl border border-dashed p-5 transition hover:border-primary/40 hover:bg-primary/5">
                                        <div className="flex items-center gap-3">
                                            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                <UploadCloud className="size-5" />
                                            </span>
                                            <span>
                                                <span className="block font-medium">
                                                    {file?.name ??
                                                        resource?.latest_version
                                                            ?.original_name ??
                                                        'Choose a file'}
                                                </span>
                                                <span className="block text-sm text-muted-foreground">
                                                    {isEditing
                                                        ? 'A replacement creates a new version.'
                                                        : 'PDF, document, image, or video up to 100 MB.'}
                                                </span>
                                            </span>
                                        </div>
                                        <Input
                                            type="file"
                                            className="sr-only"
                                            onChange={(event) =>
                                                setFile(
                                                    event.target.files?.[0] ??
                                                        null,
                                                )
                                            }
                                        />
                                    </label>
                                    <InputError message={errors.file} />
                                </div>
                            )}

                            {draft.resource_type === 'external_link' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="resource-external-url">
                                        Approved URL
                                    </Label>
                                    <Input
                                        id="resource-external-url"
                                        value={draft.external_url}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                external_url:
                                                    event.target.value,
                                            }))
                                        }
                                        placeholder="https://..."
                                    />
                                    <InputError message={errors.external_url} />
                                </div>
                            )}
                        </section>

                        <section className="space-y-4 border-t pt-6">
                            <div>
                                <h3 className="font-semibold">Details</h3>
                                <p className="text-sm text-muted-foreground">
                                    Make this resource easy to recognize and
                                    find.
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="resource-title">
                                        Title
                                    </Label>
                                    <Input
                                        id="resource-title"
                                        autoFocus
                                        value={draft.title}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                title: event.target.value,
                                            }))
                                        }
                                        placeholder="Five-Point Job Completion Check"
                                    />
                                    <InputError message={errors.title} />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="resource-description">
                                        Short description
                                    </Label>
                                    <textarea
                                        id="resource-description"
                                        value={draft.description}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        className={textareaClass}
                                        placeholder="Use before closing every work order."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="resource-category">
                                        Category
                                    </Label>
                                    <Input
                                        id="resource-category"
                                        list="resource-categories"
                                        value={draft.category}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                category: event.target.value,
                                            }))
                                        }
                                        placeholder="Field procedures"
                                    />
                                    <datalist id="resource-categories">
                                        {categories.map((category) => (
                                            <option
                                                key={category}
                                                value={category}
                                            />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="resource-tags">Tags</Label>
                                    <Input
                                        id="resource-tags"
                                        value={draft.tags}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                tags: event.target.value,
                                            }))
                                        }
                                        placeholder="close job, quality, checklist"
                                    />
                                </div>
                            </div>
                            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                                <input
                                    type="checkbox"
                                    checked={draft.featured}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            featured: event.target.checked,
                                        }))
                                    }
                                    className="mt-1 size-4 rounded border-input"
                                />
                                <span>
                                    <span className="block font-medium">
                                        Mark as featured
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        Surface this resource prominently for
                                        learners.
                                    </span>
                                </span>
                            </label>
                        </section>

                        <section className="space-y-4 border-t pt-6">
                            <div>
                                <h3 className="font-semibold">Audience</h3>
                                <p className="text-sm text-muted-foreground">
                                    Choose the workforce groups who should see
                                    it.
                                </p>
                            </div>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4">
                                <input
                                    type="checkbox"
                                    checked={draft.audience_everyone}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            audience_everyone:
                                                event.target.checked,
                                        }))
                                    }
                                    className="size-4 rounded border-input"
                                />
                                Everyone in the organization
                            </label>
                            {!draft.audience_everyone && (
                                <div className="grid gap-4 md:grid-cols-3">
                                    <MultiChoice
                                        title="Job titles"
                                        options={jobTitles}
                                        selected={draft.job_title_ids}
                                        onChange={(ids) =>
                                            setDraft((current) => ({
                                                ...current,
                                                job_title_ids: ids,
                                            }))
                                        }
                                    />
                                    <MultiChoice
                                        title="Teams"
                                        options={teams}
                                        selected={draft.team_ids}
                                        onChange={(ids) =>
                                            setDraft((current) => ({
                                                ...current,
                                                team_ids: ids,
                                            }))
                                        }
                                    />
                                    <MultiChoice
                                        title="Locations"
                                        options={locations}
                                        selected={draft.location_ids}
                                        onChange={(ids) =>
                                            setDraft((current) => ({
                                                ...current,
                                                location_ids: ids,
                                            }))
                                        }
                                    />
                                </div>
                            )}
                        </section>

                        <section className="space-y-4 border-t pt-6">
                            <div>
                                <h3 className="font-semibold">Connections</h3>
                                <p className="text-sm text-muted-foreground">
                                    Link this resource to all relevant courses.
                                </p>
                            </div>
                            <MultiChoice
                                title="Related courses"
                                options={courses.map((course) => ({
                                    id: course.id,
                                    name: course.title,
                                }))}
                                selected={draft.course_ids}
                                onChange={(ids) =>
                                    setDraft((current) => ({
                                        ...current,
                                        course_ids: ids,
                                    }))
                                }
                            />
                        </section>

                        <section className="space-y-4 border-t pt-6">
                            <div>
                                <h3 className="font-semibold">Lifecycle</h3>
                                <p className="text-sm text-muted-foreground">
                                    Created, updated, published, and version
                                    dates are recorded automatically.
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                {(
                                    [
                                        ['effective_date', 'Effective date'],
                                        ['review_date', 'Next review date'],
                                        ['expiration_date', 'Expiration date'],
                                    ] as const
                                ).map(([field, label]) => (
                                    <div key={field} className="grid gap-2">
                                        <Label htmlFor={`resource-${field}`}>
                                            {label}
                                        </Label>
                                        <Input
                                            id={`resource-${field}`}
                                            type="date"
                                            value={draft[field]}
                                            onChange={(event) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    [field]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                            {isEditing && resource.versions.length > 0 && (
                                <div className="rounded-2xl border p-4">
                                    <div className="mb-3 font-medium">
                                        Version history
                                    </div>
                                    <div className="space-y-2">
                                        {resource.versions.map((version) => (
                                            <div
                                                key={version.id}
                                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                                            >
                                                <span>
                                                    v{version.version_number} ·{' '}
                                                    {version.original_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(
                                                        version.created_at,
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <DialogFooter className="border-t px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPreviewOpen(true)}
                            disabled={
                                draft.resource_type === 'quick_guide' &&
                                draft.quick_guide_content.length === 0
                            }
                        >
                            Preview as learner
                        </Button>
                        <Button onClick={submit} disabled={saving}>
                            {saving ? (
                                <Spinner className="size-4" />
                            ) : (
                                <CheckCircle2 className="size-4" />
                            )}
                            {isEditing ? 'Save changes' : 'Publish resource'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ResourcePreview
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                resource={previewResource}
            />
        </>
    );
}

export default function OrganizationResourcesIndex() {
    const {
        organization,
        resources,
        courses,
        categoryOptions,
        jobTitles,
        teams,
        locations,
    } = usePage<PageProps>().props;
    const [tab, setTab] = useState<LibraryTab>('all');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [audienceFilter, setAudienceFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');
    const [updatedFilter, setUpdatedFilter] = useState('all');
    const [sort, setSort] = useState('featured');
    const [choiceOpen, setChoiceOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorType, setEditorType] = useState<ResourceType>('quick_guide');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [previewId, setPreviewId] = useState<number | null>(null);
    const [currentTimestamp] = useState(() => Date.now());

    const editingResource =
        resources.find((resource) => resource.id === editingId) ?? null;
    const previewResource =
        resources.find((resource) => resource.id === previewId) ?? null;

    const counts = {
        all: resources.length,
        featured: resources.filter((resource) => resource.featured).length,
        needs_review: resources.filter((resource) => resource.needs_review)
            .length,
        archived: resources.filter((resource) => resource.status === 'archived')
            .length,
    };

    const filteredResources = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = resources.filter((resource) => {
            if (tab === 'featured' && !resource.featured) {
                return false;
            }

            if (tab === 'needs_review' && !resource.needs_review) {
                return false;
            }

            if (tab === 'archived' && resource.status !== 'archived') {
                return false;
            }

            if (tab !== 'archived' && resource.status === 'archived') {
                return false;
            }

            if (typeFilter !== 'all' && resource.resource_type !== typeFilter) {
                return false;
            }

            if (
                categoryFilter !== 'all' &&
                resource.category !== categoryFilter
            ) {
                return false;
            }

            if (
                courseFilter !== 'all' &&
                !resource.course_ids.includes(Number(courseFilter))
            ) {
                return false;
            }

            if (audienceFilter !== 'all') {
                if (
                    audienceFilter === 'everyone' &&
                    !resource.audience_everyone
                ) {
                    return false;
                }

                if (
                    audienceFilter.startsWith('job:') &&
                    !resource.job_title_ids.includes(
                        Number(audienceFilter.split(':')[1]),
                    )
                ) {
                    return false;
                }

                if (
                    audienceFilter.startsWith('team:') &&
                    !resource.team_ids.includes(
                        Number(audienceFilter.split(':')[1]),
                    )
                ) {
                    return false;
                }

                if (
                    audienceFilter.startsWith('location:') &&
                    !resource.location_ids.includes(
                        Number(audienceFilter.split(':')[1]),
                    )
                ) {
                    return false;
                }
            }

            if (updatedFilter !== 'all') {
                const age =
                    currentTimestamp -
                    new Date(resource.updated_at ?? 0).getTime();

                if (age > Number(updatedFilter) * 86400000) {
                    return false;
                }
            }

            if (!query) {
                return true;
            }

            return [
                resource.title,
                resource.description ?? '',
                resource.category ?? '',
                resource.tags.join(' '),
                resource.latest_version?.original_name ?? '',
                audienceLabel(resource),
                resource.related_courses
                    .map((course) => course.title)
                    .join(' '),
                JSON.stringify(resource.quick_guide_content),
            ]
                .join(' ')
                .toLowerCase()
                .includes(query);
        });

        return filtered.sort((left, right) => {
            if (sort === 'title') {
                return left.title.localeCompare(right.title);
            }

            if (sort === 'views') {
                return right.view_count - left.view_count;
            }

            if (sort === 'created') {
                return String(right.created_at).localeCompare(
                    String(left.created_at),
                );
            }

            if (sort === 'review') {
                return String(left.review_date ?? '9999').localeCompare(
                    String(right.review_date ?? '9999'),
                );
            }

            if (sort === 'featured' && left.featured !== right.featured) {
                return left.featured ? -1 : 1;
            }

            return String(right.updated_at).localeCompare(
                String(left.updated_at),
            );
        });
    }, [
        resources,
        tab,
        search,
        typeFilter,
        categoryFilter,
        audienceFilter,
        courseFilter,
        updatedFilter,
        sort,
        currentTimestamp,
    ]);

    const featuredResources = filteredResources
        .filter((resource) => resource.featured)
        .slice(0, 2);

    const openCreate = (type: ResourceType) => {
        setChoiceOpen(false);
        setEditingId(null);
        setEditorType(type);
        setEditorOpen(true);
    };
    const openEdit = (resource: ResourceRow) => {
        setEditingId(resource.id);
        setEditorType(resource.resource_type);
        setEditorOpen(true);
    };
    const archiveResource = (resource: ResourceRow) => {
        if (
            !window.confirm(
                `Archive ${resource.title}? Its links and version history will remain intact.`,
            )
        ) {
            return;
        }

        router.patch(
            `/organizations/${organization.id}/resources/${resource.id}/archive`,
            {},
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={`${organization.name} resources`} />
            <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <Heading
                        title="Resources"
                        description="Manage job aids, procedures, guides, and downloadable files."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setChoiceOpen(true)}>
                            <Plus className="size-4" /> Create resource
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/dashboard">
                                <ArrowLeft className="size-4" /> Dashboard
                            </Link>
                        </Button>
                    </div>
                </div>

                <div
                    className="flex gap-1 overflow-x-auto border-b"
                    role="tablist"
                >
                    {(
                        [
                            ['all', 'All'],
                            ['featured', 'Featured'],
                            ['needs_review', 'Needs review'],
                            ['archived', 'Archived'],
                        ] as Array<[LibraryTab, string]>
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium transition ${
                                tab === value
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {label}{' '}
                            <span className="ml-1 text-xs">
                                {counts[value]}
                            </span>
                        </button>
                    ))}
                </div>

                <Card className="rounded-3xl">
                    <CardContent className="space-y-3 p-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="h-12 pl-10"
                                placeholder="Search titles, guide text, categories, tags, files, courses, and audiences..."
                                aria-label="Search resources"
                            />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                            <select
                                value={categoryFilter}
                                onChange={(event) =>
                                    setCategoryFilter(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Filter by category"
                            >
                                <option value="all">All categories</option>
                                {categoryOptions.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={audienceFilter}
                                onChange={(event) =>
                                    setAudienceFilter(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Filter by audience"
                            >
                                <option value="all">All audiences</option>
                                <option value="everyone">Everyone</option>
                                {jobTitles.map((option) => (
                                    <option
                                        key={`job-${option.id}`}
                                        value={`job:${option.id}`}
                                    >
                                        Job: {option.name}
                                    </option>
                                ))}
                                {teams.map((option) => (
                                    <option
                                        key={`team-${option.id}`}
                                        value={`team:${option.id}`}
                                    >
                                        Team: {option.name}
                                    </option>
                                ))}
                                {locations.map((option) => (
                                    <option
                                        key={`location-${option.id}`}
                                        value={`location:${option.id}`}
                                    >
                                        Location: {option.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Filter by type"
                            >
                                <option value="all">All types</option>
                                {resourceChoices.map((choice) => (
                                    <option
                                        key={choice.type}
                                        value={choice.type}
                                    >
                                        {choice.title}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={courseFilter}
                                onChange={(event) =>
                                    setCourseFilter(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Filter by related course"
                            >
                                <option value="all">All courses</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.title}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={updatedFilter}
                                onChange={(event) =>
                                    setUpdatedFilter(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Filter by updated date"
                            >
                                <option value="all">Updated anytime</option>
                                <option value="7">Last 7 days</option>
                                <option value="30">Last 30 days</option>
                                <option value="90">Last 90 days</option>
                            </select>
                            <select
                                value={sort}
                                onChange={(event) =>
                                    setSort(event.target.value)
                                }
                                className={fieldClass}
                                aria-label="Sort resources"
                            >
                                <option value="featured">Featured first</option>
                                <option value="updated">
                                    Recently updated
                                </option>
                                <option value="title">Title</option>
                                <option value="created">
                                    Recently created
                                </option>
                                <option value="review">Review date</option>
                                <option value="views">Most viewed</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {featuredResources.length > 0 && tab !== 'archived' && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-amber-500" />
                            <h2 className="font-semibold">
                                Featured resources
                            </h2>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {featuredResources.map((resource) => {
                                const Icon = resourceIcon(
                                    resource.resource_type,
                                );

                                return (
                                    <button
                                        key={resource.id}
                                        type="button"
                                        onClick={() =>
                                            setPreviewId(resource.id)
                                        }
                                        className="group flex min-h-28 items-start gap-4 rounded-3xl border bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                            <Icon className="size-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-semibold">
                                                {resource.title}
                                            </span>
                                            <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                                                {resource.description ||
                                                    resource.resource_type_label}
                                            </span>
                                        </span>
                                        <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold">All resources</h2>
                            <p className="text-sm text-muted-foreground">
                                {filteredResources.length} resource
                                {filteredResources.length === 1 ? '' : 's'}{' '}
                                found
                            </p>
                        </div>
                    </div>

                    {filteredResources.length === 0 ? (
                        <div className="rounded-3xl border border-dashed p-10 text-center">
                            <Search className="mx-auto size-7 text-muted-foreground" />
                            <h3 className="mt-3 font-semibold">
                                No matching resources
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Adjust the search or filters, or create a new
                                resource.
                            </p>
                            <Button
                                className="mt-5"
                                onClick={() => setChoiceOpen(true)}
                            >
                                <Plus className="size-4" /> Create resource
                            </Button>
                        </div>
                    ) : (
                        <Card className="overflow-hidden rounded-3xl">
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b bg-muted/40 text-xs tracking-wider text-muted-foreground uppercase">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">
                                                Resource
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Type
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Category
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Audience
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Used in
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Updated
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="w-14 px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredResources.map((resource) => {
                                            const Icon = resourceIcon(
                                                resource.resource_type,
                                            );

                                            return (
                                                <tr
                                                    key={resource.id}
                                                    className="cursor-pointer transition hover:bg-muted/30"
                                                    onClick={() =>
                                                        setPreviewId(
                                                            resource.id,
                                                        )
                                                    }
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                                                                <Icon className="size-4" />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="block max-w-64 truncate font-medium">
                                                                    {
                                                                        resource.title
                                                                    }
                                                                </span>
                                                                <span className="block text-xs text-muted-foreground">
                                                                    v
                                                                    {resource.current_version ||
                                                                        1}{' '}
                                                                    ·{' '}
                                                                    {
                                                                        resource.view_count
                                                                    }{' '}
                                                                    views
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {
                                                            resource.resource_type_label
                                                        }
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {resource.category ||
                                                            'Uncategorized'}
                                                    </td>
                                                    <td className="max-w-48 truncate px-4 py-4">
                                                        {audienceLabel(
                                                            resource,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {
                                                            resource
                                                                .related_courses
                                                                .length
                                                        }{' '}
                                                        course
                                                        {resource
                                                            .related_courses
                                                            .length === 1
                                                            ? ''
                                                            : 's'}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {formatDate(
                                                            resource.updated_at,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Badge
                                                            variant={
                                                                resource.status ===
                                                                'archived'
                                                                    ? 'secondary'
                                                                    : resource.needs_review
                                                                      ? 'outline'
                                                                      : 'default'
                                                            }
                                                        >
                                                            {resource.status ===
                                                            'archived'
                                                                ? 'Archived'
                                                                : resource.needs_review
                                                                  ? 'Needs review'
                                                                  : 'Published'}
                                                        </Badge>
                                                    </td>
                                                    <td
                                                        className="px-4 py-4"
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label={`Actions for ${resource.title}`}
                                                                >
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setPreviewId(
                                                                            resource.id,
                                                                        )
                                                                    }
                                                                >
                                                                    <BookOpen />{' '}
                                                                    Preview
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        openEdit(
                                                                            resource,
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil />{' '}
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                {resource
                                                                    .latest_version
                                                                    ?.url && (
                                                                    <DropdownMenuItem
                                                                        asChild
                                                                    >
                                                                        <a
                                                                            href={
                                                                                resource
                                                                                    .latest_version
                                                                                    .url
                                                                            }
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                        >
                                                                            <ArrowUpRight />
                                                                            Open
                                                                            file
                                                                        </a>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                {resource.status !==
                                                                    'archived' && (
                                                                    <DropdownMenuItem
                                                                        variant="destructive"
                                                                        onSelect={() =>
                                                                            archiveResource(
                                                                                resource,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Archive />{' '}
                                                                        Archive
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y md:hidden">
                                {filteredResources.map((resource) => {
                                    const Icon = resourceIcon(
                                        resource.resource_type,
                                    );

                                    return (
                                        <button
                                            key={resource.id}
                                            type="button"
                                            onClick={() =>
                                                setPreviewId(resource.id)
                                            }
                                            className="flex w-full items-start gap-3 p-4 text-left"
                                        >
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                                                <Icon className="size-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="font-medium">
                                                    {resource.title}
                                                </span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    {
                                                        resource.resource_type_label
                                                    }{' '}
                                                    ·{' '}
                                                    {resource.category ||
                                                        'Uncategorized'}
                                                </span>
                                                <span className="mt-2 block text-xs text-muted-foreground">
                                                    {audienceLabel(resource)} ·
                                                    Updated{' '}
                                                    {formatDate(
                                                        resource.updated_at,
                                                    )}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </section>
            </main>

            <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                            Create a resource
                        </DialogTitle>
                        <DialogDescription>
                            Choose the format that is easiest for employees to
                            use at the point of work.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {resourceChoices.map((choice) => {
                            const Icon = choice.icon;

                            return (
                                <button
                                    key={choice.type}
                                    type="button"
                                    onClick={() => openCreate(choice.type)}
                                    className="group rounded-2xl border p-5 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                >
                                    <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                                        <Icon className="size-5" />
                                    </span>
                                    <span className="block font-semibold">
                                        {choice.title}
                                    </span>
                                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                        {choice.description}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {editorOpen && (
                <ResourceEditor
                    key={`${editingId ?? 'new'}-${editorType}`}
                    open={editorOpen}
                    onOpenChange={setEditorOpen}
                    organizationId={organization.id}
                    type={editorType}
                    resource={editingResource}
                    courses={courses}
                    categories={categoryOptions}
                    jobTitles={jobTitles}
                    teams={teams}
                    locations={locations}
                />
            )}
            <ResourcePreview
                open={previewId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewId(null);
                    }
                }}
                resource={previewResource}
            />
        </>
    );
}
