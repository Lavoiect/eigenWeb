<?php

namespace App\Http\Controllers;

use App\Enums\OrganizationRole;
use App\Models\Course;
use App\Models\JobTitle;
use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationResource;
use App\Models\OrganizationResourceVersion;
use App\Models\Team;
use App\Services\CloudinaryResourceStorage;
use App\Services\ExpoPushService;
use App\Services\NotificationRecipientResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class OrganizationResourceController extends Controller
{
    public function index(Request $request, Organization $organization): Response
    {
        $this->authorize('manageResources', $organization);

        $resources = $organization->resources()
            ->with([
                'course',
                'creator',
                'updater',
                'latestVersion.uploadedBy',
                'versions.uploadedBy',
            ])
            ->orderByDesc('featured')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (OrganizationResource $resource): array => $this->resourcePayload($resource))
            ->values();

        $courses = $organization->courses()
            ->orderBy('title')
            ->get()
            ->map(fn (Course $course): array => [
                'id' => $course->id,
                'title' => $course->title,
                'status' => $course->status,
                'status_label' => ucfirst($course->status),
            ])
            ->values();

        $categoryOptions = $organization->resources()
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->values();

        return Inertia::render('organizations/resources/index', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'resources' => $resources,
            'courses' => $courses,
            'categoryOptions' => $categoryOptions,
            'jobTitles' => $organization->jobTitles()->orderBy('name')->get(['id', 'name']),
            'teams' => $organization->teams()->orderBy('name')->get(['id', 'name']),
            'locations' => $organization->locations()->orderBy('name')->get(['id', 'name']),
            'roleOptions' => [
                ['value' => '', 'label' => 'Any role'],
                ['value' => OrganizationRole::OrganizationAdmin->value, 'label' => OrganizationRole::OrganizationAdmin->label()],
                ['value' => OrganizationRole::Manager->value, 'label' => OrganizationRole::Manager->label()],
                ['value' => OrganizationRole::Learner->value, 'label' => OrganizationRole::Learner->label()],
            ],
        ]);
    }

    public function store(
        Request $request,
        Organization $organization,
        CloudinaryResourceStorage $storage,
        ExpoPushService $pushService,
        NotificationRecipientResolver $recipientResolver,
    ): RedirectResponse {
        $this->authorize('manageResources', $organization);

        $validated = $this->validateResource($request, $organization, true);
        $resource = OrganizationResource::create([
            'organization_id' => $organization->getKey(),
            'created_by_id' => $request->user()->getKey(),
            'updated_by_id' => $request->user()->getKey(),
            'course_id' => $validated['course_ids'][0] ?? ($validated['course_id'] ?? null),
            'resource_type' => $validated['resource_type'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'quick_guide_content' => $validated['quick_guide_content'] ?? null,
            'video_url' => $validated['video_url'] ?? null,
            'external_url' => $validated['external_url'] ?? null,
            'category' => $validated['category'] ?? null,
            'tags' => $validated['tags'],
            'featured' => $validated['featured'] ?? false,
            'organization_role' => $validated['organization_role'] ?? null,
            'audience_everyone' => $validated['audience_everyone'],
            'job_title_ids' => $validated['job_title_ids'],
            'team_ids' => $validated['team_ids'],
            'location_ids' => $validated['location_ids'],
            'course_ids' => $validated['course_ids'],
            'revision_date' => $validated['revision_date'] ?? null,
            'effective_date' => $validated['effective_date'] ?? null,
            'review_date' => $validated['review_date'] ?? null,
            'expiration_date' => $validated['expiration_date'] ?? null,
            'published_at' => now(),
            'status' => 'active',
            'archived_at' => null,
            'current_version' => $request->file('file') instanceof UploadedFile ? 1 : 0,
        ]);

        if ($request->file('file') instanceof UploadedFile) {
            try {
                $this->storeVersion(
                    $storage,
                    $resource,
                    $request->file('file'),
                    $request->user()->getKey(),
                    1,
                );
            } catch (Throwable $throwable) {
                $resource->delete();

                throw $throwable;
            }
        }

        $pushService->sendToUsers(
            $recipientResolver->forResource($resource),
            'Procedure update',
            sprintf('%s is now available in the resource portal.', $resource->title),
            [
                'type' => 'procedure_update',
                'url' => sprintf('/resources?resourceId=%s', $resource->getKey()),
                'resourceId' => (string) $resource->getKey(),
            ],
        );

        return back()->with('status', 'Resource published.');
    }

    public function update(
        Request $request,
        Organization $organization,
        OrganizationResource $resource,
        CloudinaryResourceStorage $storage,
        ExpoPushService $pushService,
        NotificationRecipientResolver $recipientResolver,
    ): RedirectResponse {
        $this->authorize('manageResources', $organization);
        $this->ensureResourceInOrganization($resource, $organization);

        $validated = $this->validateResource($request, $organization, false);

        $resource->forceFill([
            'updated_by_id' => $request->user()->getKey(),
            'course_id' => $validated['course_ids'][0] ?? ($validated['course_id'] ?? null),
            'resource_type' => $validated['resource_type'],
            'title' => $validated['title'],
            'description' => array_key_exists('description', $validated) ? $validated['description'] : $resource->description,
            'quick_guide_content' => $validated['quick_guide_content'] ?? null,
            'video_url' => $validated['video_url'] ?? null,
            'external_url' => $validated['external_url'] ?? null,
            'category' => array_key_exists('category', $validated) ? $validated['category'] : $resource->category,
            'tags' => array_key_exists('tags', $validated) ? $validated['tags'] : $resource->tags,
            'featured' => array_key_exists('featured', $validated) ? $validated['featured'] : $resource->featured,
            'organization_role' => array_key_exists('organization_role', $validated) ? $validated['organization_role'] : $resource->organization_role,
            'audience_everyone' => $validated['audience_everyone'],
            'job_title_ids' => $validated['job_title_ids'],
            'team_ids' => $validated['team_ids'],
            'location_ids' => $validated['location_ids'],
            'course_ids' => $validated['course_ids'],
            'revision_date' => array_key_exists('revision_date', $validated) ? $validated['revision_date'] : $resource->revision_date,
            'effective_date' => $validated['effective_date'] ?? null,
            'review_date' => $validated['review_date'] ?? null,
            'expiration_date' => $validated['expiration_date'] ?? null,
        ]);

        $file = $request->file('file');

        if ($file instanceof UploadedFile) {
            $nextVersion = $resource->current_version + 1;
            $this->storeVersion(
                $storage,
                $resource,
                $file,
                $request->user()->getKey(),
                $nextVersion,
            );

            $resource->current_version = $nextVersion;
        }

        $resource->save();

        $pushService->sendToUsers(
            $recipientResolver->forResource($resource),
            'Procedure update',
            sprintf('%s was updated in the resource portal.', $resource->title),
            [
                'type' => 'procedure_update',
                'url' => sprintf('/resources?resourceId=%s', $resource->getKey()),
                'resourceId' => (string) $resource->getKey(),
            ],
        );

        return back()->with('status', $file instanceof UploadedFile ? 'Resource version replaced.' : 'Resource updated.');
    }

    public function archive(
        Request $request,
        Organization $organization,
        OrganizationResource $resource,
    ): RedirectResponse {
        $this->authorize('manageResources', $organization);
        $this->ensureResourceInOrganization($resource, $organization);

        $resource->forceFill([
            'status' => 'archived',
            'archived_at' => now(),
            'updated_by_id' => $request->user()->getKey(),
        ])->save();

        return back()->with('status', 'Resource archived.');
    }

    /**
     * @return array{
     *     title:string,
     *     description:?string,
     *     category:?string,
     *     tags:?string,
     *     featured:?bool,
     *     organization_role:?string,
     *     course_id:?int,
     *     revision_date:?string,
     *     file:?UploadedFile
     * }
     */
    private function validateResource(Request $request, Organization $organization, bool $create): array
    {
        $quickGuideContent = $request->input('quick_guide_content');
        $request->merge([
            'resource_type' => $request->input('resource_type', 'file'),
            'quick_guide_content' => is_string($quickGuideContent)
                ? json_decode($quickGuideContent, true)
                : $quickGuideContent,
            'audience_everyone' => $request->boolean('audience_everyone', true),
        ]);

        $validated = $request->validate([
            'resource_type' => ['required', Rule::in(['quick_guide', 'file', 'video', 'external_link'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'quick_guide_content' => ['nullable', 'array', 'max:100'],
            'quick_guide_content.*.id' => ['required_with:quick_guide_content', 'string', 'max:100'],
            'quick_guide_content.*.type' => ['required_with:quick_guide_content', Rule::in([
                'heading',
                'paragraph',
                'numbered_steps',
                'bulleted_list',
                'checklist',
                'image',
                'warning',
                'stop',
                'contact',
                'related_course',
                'attached_file',
            ])],
            'video_url' => ['nullable', 'url', 'max:2000'],
            'external_url' => ['nullable', 'url', 'max:2000'],
            'category' => ['nullable', 'string', 'max:120'],
            'tags' => ['nullable', 'string', 'max:1000'],
            'featured' => ['nullable', 'boolean'],
            'organization_role' => ['nullable', Rule::in([
                OrganizationRole::OrganizationAdmin->value,
                OrganizationRole::Manager->value,
                OrganizationRole::Learner->value,
            ])],
            'audience_everyone' => ['required', 'boolean'],
            'job_title_ids' => ['nullable', 'array'],
            'job_title_ids.*' => ['integer', Rule::exists('job_titles', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'team_ids' => ['nullable', 'array'],
            'team_ids.*' => ['integer', Rule::exists('teams', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'location_ids' => ['nullable', 'array'],
            'location_ids.*' => ['integer', Rule::exists('locations', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'course_ids' => ['nullable', 'array'],
            'course_ids.*' => ['integer', Rule::exists('courses', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'course_id' => [
                'nullable',
                'integer',
                Rule::exists('courses', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'revision_date' => ['nullable', 'date'],
            'effective_date' => ['nullable', 'date'],
            'review_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date'],
            'file' => ['nullable', 'file', 'max:102400'],
        ]);

        if ($create && $validated['resource_type'] === 'file' && ! $request->file('file') instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'file' => 'Choose a file to upload.',
            ]);
        }

        if ($validated['resource_type'] === 'quick_guide' && empty($validated['quick_guide_content'])) {
            throw ValidationException::withMessages([
                'quick_guide_content' => 'Add at least one block to the quick guide.',
            ]);
        }

        if ($create && $validated['resource_type'] === 'video' && blank($validated['video_url'] ?? null) && ! $request->file('file') instanceof UploadedFile) {
            throw ValidationException::withMessages([
                'video_url' => 'Add a video link or upload a video file.',
            ]);
        }

        if ($validated['resource_type'] === 'external_link' && blank($validated['external_url'] ?? null)) {
            throw ValidationException::withMessages([
                'external_url' => 'Add the approved website or reference URL.',
            ]);
        }

        $validated['tags'] = $this->parseTags($validated['tags'] ?? null);
        $validated['featured'] = (bool) ($validated['featured'] ?? false);
        $validated['course_id'] = $validated['course_id'] ?? null;
        $validated['job_title_ids'] = array_values($validated['job_title_ids'] ?? []);
        $validated['team_ids'] = array_values($validated['team_ids'] ?? []);
        $validated['location_ids'] = array_values($validated['location_ids'] ?? []);
        $validated['course_ids'] = array_values($validated['course_ids'] ?? ($validated['course_id'] ? [$validated['course_id']] : []));
        $validated['revision_date'] = $validated['revision_date'] ?? null;

        return $validated;
    }

    private function parseTags(?string $tags): array
    {
        if ($tags === null || trim($tags) === '') {
            return [];
        }

        return collect(explode(',', $tags))
            ->map(fn (string $tag): string => trim($tag))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function ensureResourceInOrganization(OrganizationResource $resource, Organization $organization): void
    {
        abort_if($resource->organization_id !== $organization->getKey(), 404);
    }

    private function resourcePayload(OrganizationResource $resource): array
    {
        $latestVersion = $resource->latestVersion;
        $resourceRole = $resource->organization_role !== null
            ? OrganizationRole::tryFrom($resource->organization_role)
            : null;

        return [
            'id' => $resource->id,
            'organization_id' => $resource->organization_id,
            'course_id' => $resource->course_id,
            'course' => $resource->course?->only(['id', 'title', 'status']),
            'resource_type' => $resource->resource_type ?? 'file',
            'resource_type_label' => match ($resource->resource_type ?? 'file') {
                'quick_guide' => 'Quick guide',
                'video' => 'Video',
                'external_link' => 'External link',
                default => $this->fileTypeLabel($latestVersion?->mime_type),
            },
            'title' => $resource->title,
            'description' => $resource->description,
            'quick_guide_content' => $resource->quick_guide_content ?? [],
            'video_url' => $resource->video_url,
            'external_url' => $resource->external_url,
            'category' => $resource->category,
            'tags' => $resource->tags ?? [],
            'featured' => $resource->featured,
            'organization_role' => $resource->organization_role,
            'organization_role_label' => $resourceRole?->label(),
            'audience_everyone' => $resource->audience_everyone ?? $resource->organization_role === null,
            'job_title_ids' => $resource->job_title_ids ?? [],
            'team_ids' => $resource->team_ids ?? [],
            'location_ids' => $resource->location_ids ?? [],
            'course_ids' => $resource->course_ids ?? ($resource->course_id ? [$resource->course_id] : []),
            'job_titles' => JobTitle::query()->whereIn('id', $resource->job_title_ids ?? [])->pluck('name')->values(),
            'teams' => Team::query()->whereIn('id', $resource->team_ids ?? [])->pluck('name')->values(),
            'locations' => Location::query()->whereIn('id', $resource->location_ids ?? [])->pluck('name')->values(),
            'related_courses' => Course::query()
                ->whereIn('id', $resource->course_ids ?? ($resource->course_id ? [$resource->course_id] : []))
                ->get(['id', 'title', 'status'])
                ->values(),
            'revision_date' => $resource->revision_date?->toDateString(),
            'effective_date' => $resource->effective_date?->toDateString(),
            'review_date' => $resource->review_date?->toDateString(),
            'expiration_date' => $resource->expiration_date?->toDateString(),
            'published_at' => $resource->published_at?->toIso8601String(),
            'needs_review' => $resource->status !== 'archived' && $resource->review_date !== null && $resource->review_date->isPast(),
            'status' => $resource->status,
            'status_label' => $resource->isArchived() ? 'Archived' : 'Active',
            'archived_at' => $resource->archived_at?->toIso8601String(),
            'current_version' => $resource->current_version,
            'version_count' => $resource->versions->count(),
            'view_count' => $resource->view_count ?? 0,
            'latest_version' => $latestVersion ? $this->versionPayload($latestVersion) : null,
            'versions' => $resource->versions->map(fn (OrganizationResourceVersion $version): array => $this->versionPayload($version))->values(),
            'created_by' => $resource->creator?->only('id', 'name', 'email'),
            'updated_by' => $resource->updater?->only('id', 'name', 'email'),
            'created_at' => $resource->created_at?->toIso8601String(),
            'updated_at' => $resource->updated_at?->toIso8601String(),
        ];
    }

    private function fileTypeLabel(?string $mimeType): string
    {
        return match (true) {
            $mimeType === 'application/pdf' => 'PDF',
            str_starts_with((string) $mimeType, 'image/') => 'Image',
            str_starts_with((string) $mimeType, 'video/') => 'Video',
            default => 'File',
        };
    }

    private function versionPayload(OrganizationResourceVersion $version): array
    {
        return [
            'id' => $version->id,
            'version_number' => $version->version_number,
            'disk' => $version->disk,
            'path' => $version->path,
            'url' => $version->url,
            'original_name' => $version->original_name,
            'mime_type' => $version->mime_type,
            'size_bytes' => $version->size_bytes,
            'uploaded_by' => $version->uploadedBy?->only('id', 'name', 'email'),
            'created_at' => $version->created_at?->toIso8601String(),
        ];
    }

    private function storeVersion(
        CloudinaryResourceStorage $storage,
        OrganizationResource $resource,
        UploadedFile $file,
        int $uploadedById,
        int $versionNumber,
    ): OrganizationResourceVersion {
        $folder = sprintf(
            'assets/organizations/%s/resources/%s',
            $resource->organization_id,
            $resource->getKey(),
        );
        $publicId = sprintf('%s/v%s', $folder, $versionNumber);
        $upload = $storage->upload($file, $folder, $publicId);

        return OrganizationResourceVersion::create([
            'organization_resource_id' => $resource->getKey(),
            'uploaded_by_id' => $uploadedById,
            'version_number' => $versionNumber,
            'disk' => $upload['disk'],
            'path' => $upload['path'],
            'url' => $upload['url'],
            'original_name' => $upload['original_name'],
            'mime_type' => $upload['mime_type'],
            'size_bytes' => $upload['size_bytes'],
        ]);
    }
}
