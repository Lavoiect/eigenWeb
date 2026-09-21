<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganizationContentContext;
use App\Models\Course;
use App\Models\CourseAsset;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\CourseReview;
use App\Models\JobTitle;
use App\Models\Lesson;
use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationResource;
use App\Models\Team;
use App\Models\User;
use App\Services\CoursePublishingService;
use App\Services\CourseReviewSnapshot;
use App\Services\MicrolearningStarterTemplate;
use App\Services\PathwayAssignmentService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationCourseManagementController extends Controller
{
    use FormatsLearningApiResponses;
    use ResolvesOrganizationContentContext;

    public function index(
        Request $request,
        Organization $organization,
        MicrolearningStarterTemplate $starterTemplate,
    ): Response {
        $this->assertCanAuthorTraining($request->user(), $organization);

        $organizationUsers = $organization->users()
            ->with(['jobTitle', 'teams'])
            ->get();

        $courses = $organization->courses()
            ->with([
                'creator',
                'pathway',
                'lessons',
                'assignments.assignedToTeam.members',
                'progressRecords',
            ])
            ->withCount(['lessons', 'assignments', 'progressRecords'])
            ->orderBy('title')
            ->get()
            ->map(function (Course $course) use ($organizationUsers): array {
                $recipientIds = $course->assignments
                    ->flatMap(fn (CourseAssignment $assignment) => $this->assignmentRecipients($assignment, $organizationUsers))
                    ->pluck('id')
                    ->unique()
                    ->values();
                $recipientProgress = $course->progressRecords
                    ->whereIn('user_id', $recipientIds->all());
                $completedCount = $recipientProgress
                    ->filter(fn (CourseProgress $progress): bool => $progress->completed_at !== null || $progress->status === 'completed')
                    ->pluck('user_id')
                    ->unique()
                    ->count();
                $assessmentCount = $course->lessons
                    ->flatMap(fn (Lesson $lesson): array => $lesson->blocks())
                    ->filter(fn (array $block): bool => in_array(
                        $block['type'] ?? null,
                        ['multiple_choice', 'question', 'true_false', 'ordering', 'matching'],
                        true,
                    ))
                    ->count();
                $healthIssues = collect([
                    blank($course->description) ? 'Add a course description' : null,
                    $course->lessons_count === 0 ? 'Add the first lesson' : null,
                    $course->estimated_minutes === null ? 'Set estimated duration' : null,
                    $assessmentCount === 0 ? 'Add a knowledge check' : null,
                ])->filter()->values();
                $canDelete = $course->published_at === null
                    && $course->assignments_count === 0
                    && $course->progress_records_count === 0;

                return [
                    ...$this->coursePayload($course),
                    'subject' => $course->subject,
                    'estimated_minutes' => $course->estimated_minutes,
                    'completion_window_days' => $course->completion_window_days,
                    'passing_score' => $course->passing_score,
                    'assignment_count' => $course->assignments_count,
                    'assigned_count' => $recipientIds->count(),
                    'completed_count' => $completedCount,
                    'completion_rate' => $recipientIds->isNotEmpty()
                        ? (int) round(($completedCount / $recipientIds->count()) * 100)
                        : null,
                    'lesson_count' => $course->lessons_count,
                    'assessment_count' => $assessmentCount,
                    'health' => [
                        'tone' => $course->status === 'archived'
                            ? 'neutral'
                            : ($healthIssues->isEmpty() ? 'ready' : 'warning'),
                        'label' => match (true) {
                            $course->status === 'archived' => 'Archived and hidden from learners',
                            $healthIssues->isEmpty() && $course->status === 'draft' => 'Ready to publish',
                            $healthIssues->isEmpty() => 'Course setup is complete',
                            default => $healthIssues->first(),
                        },
                        'issue_count' => $healthIssues->count(),
                        'view' => in_array($healthIssues->first(), ['Add the first lesson', 'Add a knowledge check'], true)
                            ? 'build'
                            : 'settings',
                    ],
                    'can_delete' => $canDelete,
                    'delete_block_reason' => $canDelete
                        ? null
                        : 'Archive this course to preserve assignments and learner records.',
                    'created_by' => $course->creator?->only('id', 'name', 'email'),
                    'created_at' => $course->created_at?->toIso8601String(),
                    'updated_at' => $course->updated_at?->toIso8601String(),
                ];
            });

        $pathways = $this->pathwayOptions($organization);

        return Inertia::render('organizations/courses/index', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'courses' => $courses,
            'pathways' => $pathways,
            'microlearning_templates' => $starterTemplate->options(),
            'active_tab' => $request->string('tab')->toString() === 'pathways'
                ? 'pathways'
                : 'courses',
        ]);
    }

    public function show(Request $request, Organization $organization, Course $course): Response
    {
        $this->assertCanAuthorTraining($request->user(), $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $course->load([
            'creator',
            'assets',
            'pathway',
            'assignments.assignedBy',
            'assignments.assignedToUser',
            'assignments.assignedToTeam.members',
            'assignments.assignedToJobTitle',
            'assignments.assignedToLocation',
            'assignments.assignedToPathway',
            'lessons' => fn ($query) => $query->orderBy('position'),
        ])->loadCount(['lessons', 'assignments']);
        $assetUsageCounts = $this->courseAssetUsageCounts($course);
        $assetUsageDetails = $this->courseAssetUsageDetails($course);
        $organizationUsers = $organization->users()
            ->with(['teams', 'managedTeams', 'jobTitle', 'location'])
            ->orderBy('name')
            ->get();
        $courseProgresses = CourseProgress::query()
            ->where('course_id', $course->getKey())
            ->with('user')
            ->get()
            ->keyBy('user_id');
        $assignments = $course->assignments
            ->map(fn (CourseAssignment $assignment): array => $this->courseAssignmentManagementPayload(
                $course,
                $assignment,
                $organizationUsers,
                $courseProgresses,
            ))
            ->values();

        $pathways = $this->pathwayOptions($organization);
        $teams = $organization->teams()->orderBy('name')->get()->map(fn (Team $team): array => $team->only(['id', 'name']));
        $jobTitles = $organization->jobTitles()->orderBy('name')->get()->map(fn (JobTitle $jobTitle): array => $jobTitle->only(['id', 'name']));
        $locations = $organization->locations()->orderBy('name')->get()->map(fn (Location $location): array => $location->only(['id', 'name']));

        $selectedLessonId = $request->integer('lesson') ?: $course->lessons->first()?->id;
        $assignmentTargetType = $request->string('assignment_target_type')->toString();
        $assignmentTargetType = in_array($assignmentTargetType, ['user', 'team', 'job_title', 'location'], true)
            ? $assignmentTargetType
            : null;
        $assignmentTargetId = $request->filled('assignment_target_id')
            ? $request->integer('assignment_target_id')
            : null;
        $assignmentDueAt = $request->filled('assignment_due_at')
            ? CarbonImmutable::parse($request->string('assignment_due_at')->toString())->toDateString()
            : null;
        $selectedWorkspaceView = $request->string('view')->toString();
        $selectedWorkspaceView = in_array($selectedWorkspaceView, ['build', 'settings', 'media', 'assignments', 'results'], true)
            ? $selectedWorkspaceView
            : null;
        $selectedPreviewMode = $request->string('preview')->toString() === 'full'
            ? 'full'
            : 'current';
        $starterTemplate = app(MicrolearningStarterTemplate::class);
        $reviewSnapshots = app(CourseReviewSnapshot::class);
        $latestReview = $course->reviews()
            ->with(['submitter', 'reviewer'])
            ->withCount('comments')
            ->first();
        $resourceLibrary = $organization->resources()
            ->with('latestVersion')
            ->where('status', 'active')
            ->whereNull('archived_at')
            ->orderByDesc('featured')
            ->orderBy('title')
            ->get()
            ->map(function (OrganizationResource $resource): ?array {
                $version = $resource->latestVersion;
                $url = match ($resource->resource_type) {
                    'video' => $version?->url ?: $resource->video_url,
                    'external_link' => $resource->external_url,
                    'file' => $version?->url,
                    default => null,
                };

                if (blank($url)) {
                    return null;
                }

                $mimeType = $version?->mime_type;
                $mediaKind = match (true) {
                    str_starts_with((string) $mimeType, 'image/') => 'image',
                    $resource->resource_type === 'video',
                    str_starts_with((string) $mimeType, 'video/') => 'video',
                    default => 'document',
                };

                return [
                    'id' => $resource->id,
                    'title' => $resource->title,
                    'description' => $resource->description,
                    'category' => $resource->category,
                    'tags' => array_values($resource->tags ?? []),
                    'resource_type' => $resource->resource_type,
                    'media_kind' => $mediaKind,
                    'url' => $url,
                    'mime_type' => $mimeType,
                    'featured' => $resource->featured,
                    'version_id' => $version?->id,
                    'version_number' => $version?->version_number,
                    'original_name' => $version?->original_name,
                    'updated_at' => $resource->updated_at?->toIso8601String(),
                ];
            })
            ->filter()
            ->values();

        return Inertia::render('organizations/courses/show', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'pathways' => $pathways,
            'microlearning_templates' => $starterTemplate->options(),
            'teams' => $teams,
            'jobTitles' => $jobTitles,
            'locations' => $locations,
            'employees' => $organizationUsers->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'organization_role' => $user->organization_role?->value,
                'job_title_id' => $user->job_title_id,
                'location_id' => $user->location_id,
                'team_ids' => $user->teams->pluck('id')->values()->all(),
            ])->values(),
            'reviewers' => $organizationUsers
                ->filter(fn (User $candidate): bool => $candidate->getKey() !== $request->user()->getKey()
                    && $candidate->canReviewTraining($organization)
                    && $candidate->canLogin())
                ->map(fn (User $candidate): array => [
                    'id' => $candidate->id,
                    'name' => $candidate->name,
                    'email' => $candidate->email,
                    'role' => $candidate->organization_role?->value,
                ])
                ->values(),
            'latest_review' => $latestReview === null ? null : [
                'id' => $latestReview->id,
                'revision_number' => $latestReview->revision_number,
                'status' => $latestReview->status,
                'status_label' => $latestReview->statusLabel(),
                'content_matches' => $reviewSnapshots->hashCourse($course) === $latestReview->content_hash,
                'due_at' => $latestReview->due_at?->toDateString(),
                'submitted_at' => $latestReview->submitted_at?->toIso8601String(),
                'decided_at' => $latestReview->decided_at?->toIso8601String(),
                'comments_count' => $latestReview->comments_count,
                'reviewer' => $latestReview->reviewer?->only(['id', 'name', 'email']),
                'submitter' => $latestReview->submitter?->only(['id', 'name', 'email']),
                'url' => route('organizations.course-reviews.show', [$organization, $latestReview]),
            ],
            'resource_library' => $resourceLibrary,
            'course' => [
                ...$this->coursePayload($course, null, [], $assetUsageCounts, $assetUsageDetails),
                'subject' => $course->subject,
                'estimated_minutes' => $course->estimated_minutes,
                'completion_window_days' => $course->completion_window_days,
                'passing_score' => $course->passing_score,
                'assignment_count' => $course->assignments_count,
                'lesson_count' => $course->lessons_count,
                'created_by' => $course->creator?->only('id', 'name', 'email'),
                'created_at' => $course->created_at?->toIso8601String(),
                'updated_at' => $course->updated_at?->toIso8601String(),
            ],
            'assignments' => $assignments,
            'lessons' => $course->lessons->map(fn (Lesson $lesson): array => [
                ...$this->lessonPayload($lesson),
                'created_at' => $lesson->created_at?->toIso8601String(),
                'updated_at' => $lesson->updated_at?->toIso8601String(),
            ])->values(),
            'selected_lesson_id' => $selectedLessonId,
            'selected_assignment_target_type' => $assignmentTargetType,
            'selected_assignment_target_id' => $assignmentTargetId,
            'selected_assignment_due_at' => $assignmentDueAt,
            'selected_workspace_view' => $selectedWorkspaceView,
            'selected_preview_mode' => $selectedPreviewMode,
        ]);
    }

    public function store(
        Request $request,
        Organization $organization,
        PathwayAssignmentService $pathwayAssignments,
        MicrolearningStarterTemplate $starterTemplate,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'content_type' => ['nullable', Rule::in(['course', 'microlearning'])],
            'starter_template' => [
                'nullable',
                'string',
                Rule::in(array_keys($starterTemplate->templates())),
            ],
            'subject' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'learning_objectives' => ['nullable', 'string', 'max:5000'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1'],
            'completion_window_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'passing_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'pathway_id' => [
                'nullable',
                'integer',
                Rule::exists('pathways', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'status' => ['nullable', 'in:draft,published,archived'],
            'published_at' => ['nullable', 'date'],
        ]);

        $course = DB::transaction(function () use (
            $organization,
            $user,
            $validated,
            $starterTemplate,
        ): Course {
            $course = Course::create([
                'organization_id' => $organization->getKey(),
                'created_by_id' => $user->getKey(),
                'title' => $validated['title'],
                'slug' => $this->uniqueCourseSlug(
                    $organization,
                    $validated['slug'] ?? $validated['title'],
                ),
                'content_type' => $validated['content_type'] ?? 'course',
                'subject' => $validated['subject'] ?? null,
                'description' => $validated['description'] ?? null,
                'learning_objectives' => $this->normalizeLearningObjectives($validated['learning_objectives'] ?? null),
                'estimated_minutes' => $validated['estimated_minutes'] ?? null,
                'completion_window_days' => $validated['completion_window_days'] ?? null,
                'passing_score' => $validated['passing_score'] ?? null,
                'pathway_id' => $validated['pathway_id'] ?? null,
                'status' => $validated['status'] ?? 'draft',
                'published_at' => $this->resolvePublishedAt(
                    $validated['status'] ?? 'draft',
                    $validated['published_at'] ?? null,
                ),
            ]);

            if ($course->isMicrolearning()) {
                $this->seedMicrolearningStarterLesson(
                    $course,
                    $starterTemplate,
                    $validated['starter_template'] ?? null,
                );
            }

            return $course;
        });

        $course->loadMissing('organization');
        $pathwayAssignments->syncCourse($course);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course created.',
        ]);

        return redirect()->route('organizations.courses.show', [$organization, $course]);
    }

    public function replaceStarterTemplate(
        Request $request,
        Organization $organization,
        Course $course,
        MicrolearningStarterTemplate $starterTemplate,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        if (! $course->isMicrolearning()) {
            throw ValidationException::withMessages([
                'starter_template' => 'Starter templates are only available for microlearning courses.',
            ]);
        }

        $validated = $request->validate([
            'starter_template' => [
                'required',
                'string',
                Rule::in(array_keys($starterTemplate->templates())),
            ],
        ]);

        if ($course->lessons()->count() > 1) {
            throw ValidationException::withMessages([
                'starter_template' => 'Reduce the course to one lesson before replacing the starter template.',
            ]);
        }

        DB::transaction(function () use ($course, $starterTemplate, $validated): void {
            $lesson = $course->lessons()->orderBy('position')->first();
            $templateTitle = $starterTemplate->title($validated['starter_template']);
            $templateBlocks = $starterTemplate->blocks($validated['starter_template']);

            if ($lesson === null) {
                $course->lessons()->create([
                    'title' => $templateTitle,
                    'slug' => $this->uniqueLessonSlug($course, $templateTitle),
                    'body' => (new Lesson)->bodyFromBlocks($templateBlocks),
                    'content' => $templateBlocks,
                    'position' => 1,
                    'duration_minutes' => $starterTemplate->durationMinutes($validated['starter_template']),
                    'status' => 'draft',
                    'published_at' => null,
                ]);

                return;
            }

            $lesson->fill([
                'title' => $templateTitle,
                'body' => (new Lesson)->bodyFromBlocks($templateBlocks),
                'content' => $templateBlocks,
                'duration_minutes' => $starterTemplate->durationMinutes($validated['starter_template']),
            ]);
            $lesson->position = 1;
            $lesson->save();
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Starter template replaced.',
        ]);

        return back();
    }

    public function update(
        Request $request,
        Organization $organization,
        Course $course,
        PathwayAssignmentService $pathwayAssignments,
        CoursePublishingService $coursePublishing,
        CourseReviewSnapshot $reviewSnapshots,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $previousPathwayId = $course->pathway_id;

        $validated = $request->validate([
            'title' => ['sometimes', 'filled', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'content_type' => ['sometimes', 'nullable', Rule::in(['course', 'microlearning'])],
            'subject' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'learning_objectives' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'estimated_minutes' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'completion_window_days' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:3650'],
            'passing_score' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100'],
            'pathway_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('pathways', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'status' => ['sometimes', 'in:draft,published,archived'],
            'published_at' => ['sometimes', 'nullable', 'date'],
            'published_lesson_ids' => ['sometimes', 'array', 'min:1'],
            'published_lesson_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('lessons', 'id')->where(fn ($query) => $query
                    ->where('course_id', $course->getKey())
                    ->whereNull('deleted_at')),
            ],
        ]);

        $nextContentType = $validated['content_type'] ?? $course->content_type;

        if (
            $nextContentType === 'microlearning' &&
            $course->lessons()->count() > 1
        ) {
            throw ValidationException::withMessages([
                'content_type' => 'Microlearning courses can only keep one lesson.',
            ]);
        }

        if (array_key_exists('title', $validated)) {
            $course->title = $validated['title'];
        }

        if (array_key_exists('slug', $validated)) {
            $slugSource = $validated['slug'] ?? $course->title;
            $course->slug = $this->uniqueCourseSlug($organization, $slugSource, $course);
        }

        if (array_key_exists('description', $validated)) {
            $course->description = $validated['description'];
        }

        if (array_key_exists('content_type', $validated)) {
            $course->content_type = $validated['content_type'] ?? 'course';
        }

        if (array_key_exists('learning_objectives', $validated)) {
            $course->learning_objectives = $this->normalizeLearningObjectives(
                $validated['learning_objectives'],
            );
        }

        if (array_key_exists('subject', $validated)) {
            $course->subject = $validated['subject'];
        }

        if (array_key_exists('estimated_minutes', $validated)) {
            $course->estimated_minutes = $validated['estimated_minutes'];
        }

        if (array_key_exists('completion_window_days', $validated)) {
            $course->completion_window_days = $validated['completion_window_days'];
        }

        if (array_key_exists('passing_score', $validated)) {
            $course->passing_score = $validated['passing_score'];
        }

        if (array_key_exists('pathway_id', $validated)) {
            $course->pathway_id = $validated['pathway_id'];
        }

        if (array_key_exists('status', $validated)) {
            $course->status = $validated['status'];
        }

        if ($course->status === 'archived' && $course->archived_at === null) {
            $course->archived_at = now();
        }

        if ($course->status !== 'archived') {
            $course->archived_at = null;
        }

        $course->published_at = $this->resolvePublishedAt(
            $course->status,
            $validated['published_at'] ?? null,
            $course->published_at,
        );

        if (
            $course->status === 'published' &&
            array_key_exists('published_lesson_ids', $validated)
        ) {
            $latestReview = $course->reviews()->first();

            if ($latestReview !== null && $latestReview->status !== CourseReview::STATUS_APPROVED) {
                throw ValidationException::withMessages([
                    'published_lesson_ids' => 'The latest course review must be approved before publishing.',
                ]);
            }

            if (
                $latestReview !== null &&
                $reviewSnapshots->hashCourse($course) !== $latestReview->content_hash
            ) {
                throw ValidationException::withMessages([
                    'published_lesson_ids' => 'The course changed after review. Send the latest version for review before publishing.',
                ]);
            }

            $finalAssessment = $course->lessons()
                ->where('is_final_assessment', true)
                ->first();

            if ($finalAssessment !== null) {
                $publishedLessonIds = collect($validated['published_lesson_ids'])
                    ->map(fn (int|string $lessonId): int => (int) $lessonId);

                if (! $publishedLessonIds->contains($finalAssessment->getKey())) {
                    throw ValidationException::withMessages([
                        'published_lesson_ids' => 'The final assessment must be published with the course.',
                    ]);
                }

                $hasAssessmentQuestion = collect($finalAssessment->content ?? [])
                    ->contains(fn (mixed $block): bool => is_array($block) && in_array(
                        $block['type'] ?? null,
                        ['multiple_choice', 'true_false', 'ordering', 'matching'],
                        true,
                    ));

                if (! $hasAssessmentQuestion) {
                    throw ValidationException::withMessages([
                        'published_lesson_ids' => 'Add at least one question to the final assessment before publishing.',
                    ]);
                }
            }
        }

        DB::transaction(function () use ($course, $coursePublishing, $validated): void {
            $course->save();

            if (
                $course->status === 'published' &&
                array_key_exists('published_lesson_ids', $validated)
            ) {
                $coursePublishing->syncLessons(
                    $course,
                    $validated['published_lesson_ids'],
                );
            }
        });
        $course->loadMissing('organization');
        $pathwayAssignments->syncCourse($course, $previousPathwayId);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course updated.',
        ]);

        return back();
    }

    public function duplicate(
        Request $request,
        Organization $organization,
        Course $course,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $duplicate = DB::transaction(function () use ($course, $organization, $user): Course {
            $copy = Course::create([
                'organization_id' => $organization->getKey(),
                'created_by_id' => $user->getKey(),
                'pathway_id' => $course->pathway_id,
                'content_type' => $course->content_type,
                'title' => $this->duplicateCourseTitle($course),
                'slug' => $this->uniqueCourseSlug($organization, $course->title.' copy'),
                'subject' => $course->subject,
                'description' => $course->description,
                'learning_objectives' => $course->learning_objectives,
                'estimated_minutes' => $course->estimated_minutes,
                'completion_window_days' => $course->completion_window_days,
                'passing_score' => $course->passing_score,
                'status' => 'draft',
                'published_at' => null,
                'archived_at' => null,
            ]);

            foreach ($course->lessons()->orderBy('position')->get() as $lesson) {
                $copy->lessons()->create([
                    'title' => $lesson->title,
                    'slug' => $this->uniqueLessonSlug($copy, $lesson->title),
                    'body' => $lesson->body,
                    'content' => $lesson->content,
                    'position' => $lesson->position,
                    'duration_minutes' => $lesson->duration_minutes,
                    'status' => 'draft',
                    'published_at' => null,
                ]);
            }

            return $copy;
        });

        $duplicate->loadMissing('organization');
        $pathwayAssignments->syncCourse($duplicate);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course duplicated.',
        ]);

        return redirect()->route('organizations.courses.show', [$organization, $duplicate]);
    }

    public function archive(
        Request $request,
        Organization $organization,
        Course $course,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $course->forceFill([
            'status' => 'archived',
            'archived_at' => now(),
        ])->save();
        $pathwayAssignments->syncCourse($course);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course archived.',
        ]);

        return back();
    }

    public function uploadAsset(
        Request $request,
        Organization $organization,
        Course $course,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'asset_kind' => ['required', 'in:video,document'],
            'file' => ['required', 'file'],
        ]);

        $file = $request->file('file');
        abort_unless($file !== null, 422, 'A file is required.');
        $asset = $this->persistCourseAsset(
            $organization,
            $course,
            $user,
            $file,
            $validated['asset_kind'],
        );
        $assetUsageDetails = $this->courseAssetUsageDetails($course);

        return response()->json([
            'url' => $asset->url,
            'path' => $asset->path,
            'original_name' => $asset->original_name,
            'mime_type' => $asset->mime_type,
            'kind' => $asset->kind,
            'asset' => $this->courseAssetPayload(
                $asset,
                $assetUsageDetails[$asset->id]['usage_count'] ?? 0,
                $assetUsageDetails[$asset->id]['usage_lessons'] ?? [],
            ),
        ]);
    }

    public function replaceAsset(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAsset $asset,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssetInCourse($asset, $course);

        $validated = $request->validate([
            'file' => ['required', 'file'],
        ]);

        $file = $request->file('file');
        abort_unless($file !== null, 422, 'A file is required.');

        $asset = $this->persistCourseAsset(
            $organization,
            $course,
            $user,
            $file,
            $asset->kind,
            $asset,
        );
        $assetUsageDetails = $this->courseAssetUsageDetails($course);

        return response()->json([
            'url' => $asset->url,
            'path' => $asset->path,
            'original_name' => $asset->original_name,
            'mime_type' => $asset->mime_type,
            'kind' => $asset->kind,
            'asset' => $this->courseAssetPayload(
                $asset,
                $assetUsageDetails[$asset->id]['usage_count'] ?? 0,
                $assetUsageDetails[$asset->id]['usage_lessons'] ?? [],
            ),
        ]);
    }

    public function destroyAsset(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAsset $asset,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssetInCourse($asset, $course);

        Storage::disk($asset->disk)->delete($asset->path);
        $assetId = $asset->id;
        $asset->delete();

        return response()->json([
            'deleted' => true,
            'asset_id' => $assetId,
        ]);
    }

    public function reorderAssets(
        Request $request,
        Organization $organization,
        Course $course,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'kind' => ['required', 'in:video,document'],
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
        ]);

        $assetIds = array_map('intval', array_values($validated['asset_ids']));
        $expectedAssetIds = $course->assets()
            ->where('kind', $validated['kind'])
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->pluck('id')
            ->all();

        $sortedAssetIds = $assetIds;
        $sortedExpectedAssetIds = $expectedAssetIds;
        sort($sortedAssetIds);
        sort($sortedExpectedAssetIds);

        if ($sortedAssetIds !== $sortedExpectedAssetIds) {
            throw ValidationException::withMessages([
                'asset_ids' => 'The asset order must include every asset in the selected group.',
            ]);
        }

        DB::transaction(function () use ($course, $validated, $assetIds): void {
            foreach ($assetIds as $index => $assetId) {
                $course->assets()
                    ->whereKey($assetId)
                    ->where('kind', $validated['kind'])
                    ->update(['sort_order' => $index + 1]);
            }
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Asset order updated.',
        ]);

        return back();
    }

    public function destroy(Request $request, Organization $organization, Course $course): RedirectResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        if (
            $course->published_at !== null
            || $course->assignments()->exists()
            || $course->progressRecords()->exists()
        ) {
            throw ValidationException::withMessages([
                'course' => 'This course has publishing or learner history. Archive it instead so those records stay intact.',
            ]);
        }

        $course->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course deleted.',
        ]);

        return redirect()->route('organizations.courses.index', $organization);
    }

    public function storeLesson(Request $request, Organization $organization, Course $course): RedirectResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'content' => ['nullable', 'array'],
            'position' => ['nullable', 'integer', 'min:1'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'is_final_assessment' => ['sometimes', 'boolean'],
            'status' => ['nullable', 'in:draft,published'],
            'published_at' => ['nullable', 'date'],
        ]);

        if ($course->isMicrolearning() && $course->lessons()->exists()) {
            throw ValidationException::withMessages([
                'title' => 'Microlearning courses can only have one lesson.',
            ]);
        }

        $isFinalAssessment = (bool) ($validated['is_final_assessment'] ?? false);

        if ($isFinalAssessment && $course->isMicrolearning()) {
            throw ValidationException::withMessages([
                'is_final_assessment' => 'Final assessments are only available for full courses.',
            ]);
        }

        if ($isFinalAssessment && $course->lessons()->where('is_final_assessment', true)->exists()) {
            throw ValidationException::withMessages([
                'is_final_assessment' => 'This course already has a final assessment.',
            ]);
        }

        $content = $validated['content'] ?? null;
        $body = is_array($content)
            ? (new Lesson)->bodyFromBlocks($content)
            : ($validated['body'] ?? null);

        $lesson = DB::transaction(function () use ($course, $validated, $body, $content, $isFinalAssessment): Lesson {
            $nextPosition = $this->nextLessonPosition($course);
            $finalAssessmentPosition = $course->lessons()
                ->where('is_final_assessment', true)
                ->value('position');
            $maximumPosition = $isFinalAssessment
                ? $nextPosition
                : (int) ($finalAssessmentPosition ?? $nextPosition);
            $position = $isFinalAssessment
                ? $nextPosition
                : min(
                    max((int) ($validated['position'] ?? $maximumPosition), 1),
                    $maximumPosition,
                );

            $course->lessons()
                ->where('position', '>=', $position)
                ->increment('position');

            return $course->lessons()->create([
                'title' => $validated['title'],
                'slug' => $this->uniqueLessonSlug($course, $validated['slug'] ?? $validated['title']),
                'body' => $body,
                'content' => $content,
                'position' => $position,
                'duration_minutes' => $validated['duration_minutes'] ?? null,
                'is_final_assessment' => $isFinalAssessment,
                'status' => $validated['status'] ?? 'draft',
                'published_at' => $this->resolvePublishedAt(
                    $validated['status'] ?? 'draft',
                    $validated['published_at'] ?? null,
                ),
            ]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lesson created.',
        ]);

        return redirect()->route('organizations.courses.show', [
            $organization,
            $course,
            'lesson' => $lesson->id,
        ]);
    }

    public function reorderLessons(
        Request $request,
        Organization $organization,
        Course $course,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'lesson_ids' => ['required', 'array', 'min:1'],
            'lesson_ids.*' => ['integer'],
        ]);

        $lessonIds = array_map('intval', array_values($validated['lesson_ids']));
        $expectedLessonIds = $course->lessons()->pluck('id')->all();
        $sortedLessonIds = $lessonIds;
        $sortedExpectedLessonIds = $expectedLessonIds;
        sort($sortedLessonIds);
        sort($sortedExpectedLessonIds);

        if ($sortedLessonIds !== $sortedExpectedLessonIds) {
            throw ValidationException::withMessages([
                'lesson_ids' => 'The lesson order must include every lesson in the course.',
            ]);
        }

        $finalAssessmentId = $course->lessons()
            ->where('is_final_assessment', true)
            ->value('id');

        if ($finalAssessmentId !== null && end($lessonIds) !== (int) $finalAssessmentId) {
            throw ValidationException::withMessages([
                'lesson_ids' => 'The final assessment must remain at the end of the course.',
            ]);
        }

        DB::transaction(function () use ($course, $lessonIds): void {
            foreach ($lessonIds as $index => $lessonId) {
                $lesson = $course->lessons()
                    ->whereKey($lessonId)
                    ->firstOrFail();

                $lesson->position = $index + 1;
                $lesson->save();
            }
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lesson order updated.',
        ]);

        return back();
    }

    public function duplicateLesson(
        Request $request,
        Organization $organization,
        Course $course,
        Lesson $lesson,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureLessonInCourse($lesson, $course);

        if ($course->isMicrolearning()) {
            throw ValidationException::withMessages([
                'lesson' => 'Microlearning courses keep a single lesson.',
            ]);
        }

        $duplicate = DB::transaction(function () use ($course, $lesson): Lesson {
            $nextPosition = $this->nextLessonPosition($course);
            $finalAssessmentPosition = $course->lessons()
                ->where('is_final_assessment', true)
                ->value('position');
            $position = min(
                $lesson->position + 1,
                (int) ($finalAssessmentPosition ?? $nextPosition),
            );

            $course->lessons()
                ->where('position', '>=', $position)
                ->increment('position');

            return $course->lessons()->create([
                'title' => $lesson->title.' Copy',
                'slug' => $this->uniqueLessonSlug($course, $lesson->title.' copy'),
                'body' => $lesson->body,
                'content' => $lesson->content,
                'position' => $position,
                'duration_minutes' => $lesson->duration_minutes,
                'is_final_assessment' => false,
                'status' => 'draft',
                'published_at' => null,
            ]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lesson duplicated.',
        ]);

        return redirect()->route('organizations.courses.show', [
            $organization,
            $course,
            'lesson' => $duplicate->id,
        ]);
    }

    public function updateLesson(Request $request, Organization $organization, Course $course, Lesson $lesson): RedirectResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureLessonInCourse($lesson, $course);

        $validated = $request->validate([
            'title' => ['sometimes', 'filled', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string'],
            'content' => ['sometimes', 'nullable', 'array'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'status' => ['sometimes', 'in:draft,published'],
            'published_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('title', $validated)) {
            $lesson->title = $validated['title'];
        }

        if (array_key_exists('slug', $validated)) {
            $lesson->slug = $this->uniqueLessonSlug($course, $validated['slug'] ?? $lesson->title, $lesson);
        }

        if (array_key_exists('body', $validated)) {
            $lesson->body = $validated['body'];
        }

        if (array_key_exists('content', $validated)) {
            $lesson->content = $validated['content'];
            if (is_array($validated['content'])) {
                $lesson->body = $lesson->bodyFromBlocks($validated['content']);
            }
        }

        if (array_key_exists('position', $validated)) {
            $lesson->position = $validated['position'];
        }

        if (array_key_exists('duration_minutes', $validated)) {
            $lesson->duration_minutes = $validated['duration_minutes'];
        }

        if (array_key_exists('status', $validated)) {
            $lesson->status = $validated['status'];
        }

        $lesson->published_at = $this->resolvePublishedAt(
            $lesson->status,
            $validated['published_at'] ?? null,
            $lesson->published_at,
        );

        $lesson->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lesson updated.',
        ]);

        return back();
    }

    public function destroyLesson(Request $request, Organization $organization, Course $course, Lesson $lesson): RedirectResponse
    {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureLessonInCourse($lesson, $course);

        if ($course->isMicrolearning() && $course->lessons()->count() <= 1) {
            throw ValidationException::withMessages([
                'lesson' => 'Microlearning courses keep a single lesson.',
            ]);
        }

        DB::transaction(function () use ($course, $lesson): void {
            $deletedPosition = $lesson->position;
            $lesson->delete();

            $course->lessons()
                ->where('position', '>', $deletedPosition)
                ->decrement('position');
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lesson deleted.',
        ]);

        return back();
    }

    private function uniqueCourseSlug(
        Organization $organization,
        string $source,
        ?Course $ignoreCourse = null,
    ): string {
        $baseSlug = Str::slug($source) ?: 'course';
        $candidate = $baseSlug;
        $counter = 2;

        while (
            $organization->courses()
                ->when($ignoreCourse !== null, fn ($query) => $query->whereKeyNot($ignoreCourse->getKey()))
                ->where('slug', $candidate)
                ->exists()
        ) {
            $candidate = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $candidate;
    }

    private function uniqueLessonSlug(
        Course $course,
        string $source,
        ?Lesson $ignoreLesson = null,
    ): string {
        $baseSlug = Str::slug($source) ?: 'lesson';
        $candidate = $baseSlug;
        $counter = 2;

        while (
            $course->lessons()
                ->when($ignoreLesson !== null, fn ($query) => $query->whereKeyNot($ignoreLesson->getKey()))
                ->where('slug', $candidate)
                ->exists()
        ) {
            $candidate = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $candidate;
    }

    private function nextLessonPosition(Course $course): int
    {
        return (int) $course->lessons()->max('position') + 1;
    }

    private function seedMicrolearningStarterLesson(
        Course $course,
        MicrolearningStarterTemplate $starterTemplate,
        ?string $templateKey = null,
    ): Lesson {
        $content = $starterTemplate->blocks($templateKey);

        return $course->lessons()->create([
            'title' => $starterTemplate->title($templateKey),
            'slug' => $this->uniqueLessonSlug($course, $starterTemplate->title($templateKey)),
            'body' => (new Lesson)->bodyFromBlocks($content),
            'content' => $content,
            'position' => 1,
            'duration_minutes' => $starterTemplate->durationMinutes($templateKey),
            'status' => 'draft',
            'published_at' => null,
        ]);
    }

    private function resolvePublishedAt(
        string $status,
        mixed $publishedAt = null,
        mixed $fallback = null,
    ): mixed {
        if ($status === 'draft') {
            return null;
        }

        if ($status === 'archived') {
            return $fallback ?? $publishedAt ?? null;
        }

        if ($publishedAt !== null && $publishedAt !== '') {
            return $publishedAt;
        }

        return $fallback ?? now();
    }

    /**
     * @return array<int, string>|null
     */
    private function normalizeLearningObjectives(mixed $value): ?array
    {
        if ($value === null) {
            return null;
        }

        $items = collect(preg_split('/\r\n|\r|\n/', (string) $value) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->values()
            ->all();

        return $items === [] ? null : $items;
    }

    private function duplicateCourseTitle(Course $course): string
    {
        return Str::contains(Str::lower($course->title), 'copy')
            ? $course->title.' (copy)'
            : $course->title.' Copy';
    }

    /**
     * @return array{id:int,course_id:int,uploaded_by_id:int|null,kind:string,sort_order:int,disk:string,path:string,url:string,original_name:string,mime_type:string|null,size_bytes:int|null,usage_count:int,usage_lessons:array<int, array{lesson_id:int,lesson_title:string,block_count:int}>,created_at:string|null,updated_at:string|null}
     */
    private function courseAssetPayload(
        CourseAsset $asset,
        int $usageCount = 0,
        array $usageLessons = [],
    ): array {
        return [
            'id' => $asset->id,
            'course_id' => $asset->course_id,
            'uploaded_by_id' => $asset->uploaded_by_id,
            'kind' => $asset->kind,
            'sort_order' => $asset->sort_order,
            'disk' => $asset->disk,
            'path' => $asset->path,
            'url' => $asset->url,
            'original_name' => $asset->original_name,
            'mime_type' => $asset->mime_type,
            'size_bytes' => $asset->size_bytes,
            'usage_count' => $usageCount,
            'usage_lessons' => $usageLessons,
            'created_at' => $asset->created_at?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
        ];
    }

    private function persistCourseAsset(
        Organization $organization,
        Course $course,
        User $user,
        UploadedFile $file,
        string $kind,
        ?CourseAsset $asset = null,
    ): CourseAsset {
        $allowedMimes = $kind === 'video'
            ? ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
            : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

        if (! in_array($file->getMimeType(), $allowedMimes, true)) {
            abort(422, 'The uploaded file type is not allowed.');
        }

        if ($asset !== null) {
            Storage::disk($asset->disk)->put(
                $asset->path,
                file_get_contents($file->getRealPath()) ?: '',
            );

            $fileSize = $file->getSize();

            $asset->forceFill([
                'uploaded_by_id' => $user->getKey(),
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $fileSize !== false ? $fileSize : null,
            ])->save();

            return $asset->refresh();
        }

        $nextSortOrder = (int) ($course->assets()
            ->where('kind', $kind)
            ->max('sort_order') ?? 0) + 1;
        $directory = sprintf('course-assets/%s/%s/%s', $organization->getKey(), $course->getKey(), $kind);
        $extension = $file->guessExtension() ?: $file->extension() ?: 'bin';
        $path = $file->storePubliclyAs(
            $directory,
            Str::uuid()->toString().'.'.$extension,
            'public',
        );
        $fileSize = $file->getSize();

        return CourseAsset::create([
            'course_id' => $course->getKey(),
            'uploaded_by_id' => $user->getKey(),
            'kind' => $kind,
            'sort_order' => $nextSortOrder,
            'disk' => 'public',
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $fileSize !== false ? $fileSize : null,
        ]);
    }

    private function ensureAssetInCourse(CourseAsset $asset, Course $course): void
    {
        abort_if($asset->course_id !== $course->getKey(), 404);
    }

    /**
     * @return array{id:int,course_id:int,assigned_by_id:int|null,assigned_to:{type:string,id:int|null,name:string|null},due_at:string|null,is_required:bool,recurs_every_days:int|null,reminder_count:int,last_reminded_at:string|null,status:string,status_label:string,recipient_count:int,completed_count:int,overdue_count:int,failed_count:int,failed_user_ids:array<int>,created_at:string|null,updated_at:string|null}
     */
    private function courseAssignmentManagementPayload(
        Course $course,
        CourseAssignment $assignment,
        Collection $organizationUsers,
        Collection $courseProgresses,
    ): array {
        $recipients = $this->assignmentRecipients($assignment, $organizationUsers);
        $failedUsers = collect();
        $completedCount = 0;
        $overdueCount = 0;

        foreach ($recipients as $recipient) {
            $progress = $courseProgresses->get($recipient->id);

            if ($progress?->completed_at !== null || $progress?->status === 'completed' || $progress?->passed === true) {
                $completedCount++;
            }

            if ($progress?->passed === false) {
                $failedUsers->push($recipient->id);
            }

            if ($assignment->due_at !== null && $assignment->due_at->isPast() && ! ($progress?->completed_at !== null || $progress?->status === 'completed' || $progress?->passed === true)) {
                $overdueCount++;
            }
        }

        $recipientCount = $recipients->count();
        $status = match (true) {
            $recipientCount > 0 && $completedCount >= $recipientCount => 'completed',
            $overdueCount > 0 => 'overdue',
            $completedCount > 0 => 'in_progress',
            default => 'not_started',
        };

        return [
            'id' => $assignment->id,
            'course_id' => $assignment->course_id,
            'assigned_by_id' => $assignment->assigned_by_id,
            'assigned_to' => [
                'type' => $assignment->sourceType(),
                'id' => $assignment->assigned_to_user_id
                    ?? $assignment->assigned_to_team_id
                    ?? $assignment->assigned_to_job_title_id
                    ?? $assignment->assigned_to_location_id
                    ?? $assignment->assigned_to_pathway_id,
                'name' => $assignment->assigned_to_user_id !== null
                    ? $assignment->assignedToUser?->name
                    : ($assignment->assigned_to_team_id !== null
                        ? $assignment->assignedToTeam?->name
                        : ($assignment->assigned_to_job_title_id !== null
                            ? $assignment->assignedToJobTitle?->name
                            : ($assignment->assigned_to_location_id !== null
                                ? $assignment->assignedToLocation?->name
                                : $assignment->assignedToPathway?->name))),
            ],
            'due_at' => $assignment->due_at?->toIso8601String(),
            'is_required' => $assignment->is_required,
            'recurs_every_days' => $assignment->recurs_every_days,
            'reminder_count' => $assignment->reminder_count,
            'last_reminded_at' => $assignment->last_reminded_at?->toIso8601String(),
            'status' => $status,
            'status_label' => match ($status) {
                'completed' => 'Completed',
                'overdue' => 'Overdue',
                'in_progress' => 'In progress',
                default => 'Not started',
            },
            'recipient_count' => $recipientCount,
            'completed_count' => $completedCount,
            'overdue_count' => $overdueCount,
            'failed_count' => $failedUsers->count(),
            'failed_user_ids' => $failedUsers->unique()->values()->all(),
            'created_at' => $assignment->created_at?->toIso8601String(),
            'updated_at' => $assignment->updated_at?->toIso8601String(),
        ];
    }

    private function assignmentRecipients(CourseAssignment $assignment, Collection $organizationUsers): Collection
    {
        return match (true) {
            $assignment->assigned_to_user_id !== null => $organizationUsers->where('id', $assignment->assigned_to_user_id)->values(),
            $assignment->assigned_to_team_id !== null => $assignment->assignedToTeam?->members
                ? $organizationUsers->whereIn('id', $assignment->assignedToTeam->members->pluck('id')->all())->values()
                : collect(),
            $assignment->assigned_to_job_title_id !== null => $organizationUsers->where('job_title_id', $assignment->assigned_to_job_title_id)->values(),
            $assignment->assigned_to_location_id !== null => $organizationUsers->where('location_id', $assignment->assigned_to_location_id)->values(),
            $assignment->assigned_to_pathway_id !== null => $organizationUsers->filter(function (User $user) use ($assignment): bool {
                return $user->jobTitle?->pathway_id === $assignment->assigned_to_pathway_id;
            })->values(),
            default => collect(),
        };
    }

    private function assignmentManagementResponse(
        Request $request,
        Organization $organization,
        Course $course,
        string $message,
    ): RedirectResponse {
        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $message,
        ]);

        return redirect()->route('organizations.courses.show', [$organization, $course]);
    }

    public function storeAssignment(
        Request $request,
        Organization $organization,
        Course $course,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'assigned_to_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'assigned_to_team_id' => ['nullable', 'integer', Rule::exists('teams', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'assigned_to_job_title_id' => ['nullable', 'integer', Rule::exists('job_titles', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'assigned_to_location_id' => ['nullable', 'integer', Rule::exists('locations', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey()))],
            'due_at' => ['nullable', 'date'],
            'is_required' => ['sometimes', 'boolean'],
            'recurs_every_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $targetCount = collect([
            $validated['assigned_to_user_id'] ?? null,
            $validated['assigned_to_team_id'] ?? null,
            $validated['assigned_to_job_title_id'] ?? null,
            $validated['assigned_to_location_id'] ?? null,
        ])->filter(fn ($value): bool => filled($value))->count();

        if ($targetCount !== 1) {
            throw ValidationException::withMessages([
                'assigned_to_user_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_team_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_job_title_id' => ['Choose exactly one target for the assignment.'],
                'assigned_to_location_id' => ['Choose exactly one target for the assignment.'],
            ]);
        }

        CourseAssignment::create([
            'course_id' => $course->getKey(),
            'assigned_by_id' => $user->getKey(),
            'assigned_to_user_id' => $validated['assigned_to_user_id'] ?? null,
            'assigned_to_team_id' => $validated['assigned_to_team_id'] ?? null,
            'assigned_to_job_title_id' => $validated['assigned_to_job_title_id'] ?? null,
            'assigned_to_location_id' => $validated['assigned_to_location_id'] ?? null,
            'due_at' => $validated['due_at'] ?? $course->completionDueAt(),
            'is_required' => $validated['is_required'] ?? true,
            'recurs_every_days' => $validated['recurs_every_days'] ?? null,
            'reminder_count' => 0,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Assignment created.',
        ]);

        return redirect()->route('organizations.courses.index', $organization);
    }

    public function updateAssignment(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAssignment $assignment,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssignmentInCourse($assignment, $course);

        $validated = $request->validate([
            'due_at' => ['nullable', 'date'],
            'is_required' => ['sometimes', 'boolean'],
            'recurs_every_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $assignment->forceFill([
            'due_at' => $validated['due_at'] ?? $assignment->due_at,
            'is_required' => $validated['is_required'] ?? $assignment->is_required,
            'recurs_every_days' => $validated['recurs_every_days'] ?? $assignment->recurs_every_days,
        ])->save();

        return $this->assignmentManagementResponse($request, $organization, $course, 'Assignment updated.');
    }

    public function remindAssignment(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAssignment $assignment,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssignmentInCourse($assignment, $course);

        $assignment->forceFill([
            'reminder_count' => $assignment->reminder_count + 1,
            'last_reminded_at' => now(),
        ])->save();

        return $this->assignmentManagementResponse($request, $organization, $course, 'Reminder logged.');
    }

    public function destroyAssignment(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAssignment $assignment,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssignmentInCourse($assignment, $course);

        $assignment->delete();

        return $this->assignmentManagementResponse($request, $organization, $course, 'Assignment deleted.');
    }

    public function reassignFailedTraining(
        Request $request,
        Organization $organization,
        Course $course,
        CourseAssignment $assignment,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);
        $this->ensureAssignmentInCourse($assignment, $course);

        $validated = $request->validate([
            'due_at' => ['nullable', 'date'],
        ]);

        $organizationUsers = $organization->users()
            ->with(['jobTitle', 'teams', 'managedTeams', 'location'])
            ->get();
        $recipients = $this->assignmentRecipients($assignment, $organizationUsers);
        $courseProgresses = CourseProgress::query()
            ->where('course_id', $course->getKey())
            ->whereIn('user_id', $recipients->pluck('id')->all())
            ->get()
            ->keyBy('user_id');
        $dueAt = $validated['due_at']
            ?? $course->completionDueAt()
            ?? now()->addDays(7)->toDateString();
        $reassignedCount = 0;

        foreach ($recipients as $recipient) {
            $progress = $courseProgresses->get($recipient->id);

            if ($progress?->passed !== false) {
                continue;
            }

            CourseAssignment::updateOrCreate(
                [
                    'course_id' => $course->getKey(),
                    'assigned_to_user_id' => $recipient->id,
                    'assigned_to_team_id' => null,
                    'assigned_to_job_title_id' => null,
                    'assigned_to_location_id' => null,
                    'assigned_to_pathway_id' => null,
                ],
                [
                    'assigned_by_id' => $user->getKey(),
                    'due_at' => $dueAt,
                    'is_required' => true,
                    'recurs_every_days' => null,
                    'reminder_count' => 0,
                    'last_reminded_at' => null,
                ],
            );

            $reassignedCount++;
        }

        return $this->assignmentManagementResponse(
            $request,
            $organization,
            $course,
            $reassignedCount > 0
                ? "{$reassignedCount} failed training assignment".($reassignedCount === 1 ? '' : 's').' reassigned.'
                : 'No failed learners were found for reassignment.',
        );
    }

    /**
     * @return array<int, array{id:int,name:string,description:string|null,sequential_completion:bool,expected_completion_days:int|null,course_count:int,item_count:int,milestone_count:int,job_title_count:int,employee_count:int}>
     */
    private function pathwayOptions(Organization $organization): array
    {
        return $organization->pathways()
            ->with(['jobTitles' => fn ($query) => $query->withCount('users')])
            ->withCount(['courses', 'items', 'milestones', 'jobTitles'])
            ->orderBy('name')
            ->get()
            ->map(fn ($pathway): array => [
                'id' => $pathway->id,
                'name' => $pathway->name,
                'description' => $pathway->description,
                'sequential_completion' => $pathway->sequential_completion,
                'expected_completion_days' => $pathway->expected_completion_days,
                'course_count' => $pathway->courses_count,
                'item_count' => $pathway->items_count,
                'milestone_count' => $pathway->milestones_count,
                'job_title_count' => $pathway->job_titles_count,
                'employee_count' => $pathway->jobTitles->sum('users_count'),
            ])
            ->values()
            ->all();
    }
}
