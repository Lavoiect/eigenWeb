<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\FormatsLearningApiResponses;
use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganizationContentContext;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Organization;
use App\Services\CoursePublishingService;
use App\Services\MicrolearningStarterTemplate;
use App\Services\PathwayAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrganizationCourseController extends Controller
{
    use FormatsLearningApiResponses;
    use ResolvesOrganizationContentContext;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);

        $courses = $organization->courses()
            ->with(['creator', 'pathway'])
            ->withCount(['lessons', 'assignments'])
            ->orderBy('title')
            ->get()
            ->map(fn (Course $course): array => $this->courseOverviewPayload($course));

        return response()->json([
            'courses' => $courses->values(),
        ]);
    }

    public function store(Request $request, PathwayAssignmentService $pathwayAssignments, MicrolearningStarterTemplate $starterTemplate): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
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
        })->load(['creator', 'pathway'])->loadCount(['lessons', 'assignments']);

        $course->loadMissing('organization');
        $pathwayAssignments->syncCourse($course);

        return response()->json([
            'course' => $this->courseOverviewPayload($course),
        ], 201);
    }

    public function show(Request $request, Course $course): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $course->load([
            'creator',
            'assets',
            'pathway',
            'lessons' => fn ($query) => $query->orderBy('position'),
            'assignments.course',
            'assignments.assignedToUser',
            'assignments.assignedToTeam',
            'assignments.assignedToJobTitle',
            'assignments.assignedToLocation',
            'assignments.assignedBy',
            'assignments.assignedToPathway',
        ])->loadCount(['lessons', 'assignments']);
        $assetUsageDetails = $this->courseAssetUsageDetails($course);

        return response()->json([
            'course' => [
                ...$this->courseOverviewPayload(
                    $course,
                    $course->assignments
                        ->map(fn ($assignment) => $assignment->sourceType())
                        ->unique()
                        ->values()
                        ->all(),
                    $assetUsageDetails,
                ),
                'lessons' => $course->lessons->map(fn (Lesson $lesson): array => $this->lessonPayload($lesson))->values(),
                'assignments' => $course->assignments->map(fn ($assignment): array => $this->assignmentPayload($assignment, $user))->values(),
            ],
        ]);
    }

    public function update(
        Request $request,
        Course $course,
        PathwayAssignmentService $pathwayAssignments,
        CoursePublishingService $coursePublishing,
    ): JsonResponse {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
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

        $course->load(['creator', 'pathway'])->loadCount(['lessons', 'assignments']);

        return response()->json([
            'course' => $this->courseOverviewPayload($course),
        ]);
    }

    public function destroy(Request $request, Course $course): Response
    {
        $user = $request->user()->loadMissing('organization');
        $organization = $this->organizationOrFail($user);
        $this->assertCanAuthorTraining($user, $organization);
        $this->ensureCourseInOrganization($course, $organization);

        $course->delete();

        return response()->noContent();
    }

    private function courseOverviewPayload(
        Course $course,
        array $assignmentSources = [],
        array $assetUsageDetails = [],
    ): array {
        return [
            ...$this->coursePayload($course, null, $assignmentSources, [], $assetUsageDetails),
            'assignment_count' => $course->getAttribute('assignments_count')
                ?? $course->assignments()->count(),
            'created_by' => $course->creator?->only('id', 'name', 'email'),
            'created_at' => $course->created_at?->toIso8601String(),
            'updated_at' => $course->updated_at?->toIso8601String(),
        ];
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
}
