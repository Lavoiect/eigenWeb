<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseProgress;
use App\Models\JobTitle;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\Pathway;
use App\Models\PathwayItem;
use App\Models\PathwayMilestone;
use App\Models\User;
use App\Services\PathwayAssignmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationPathwayController extends Controller
{
    public function show(Request $request, Organization $organization, Pathway $pathway): Response
    {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $pathway->load([
            'items.course.lessons',
            'items.lesson.course',
            'milestones',
            'jobTitles',
        ]);

        $organizationUsers = $organization->users()
            ->with(['jobTitle.pathway', 'location', 'teams'])
            ->whereHas('jobTitle', fn ($query) => $query->where('pathway_id', $pathway->getKey()))
            ->orderBy('name')
            ->get();

        $courseOptions = $organization->courses()
            ->withCount('lessons')
            ->orderBy('title')
            ->get()
            ->map(fn (Course $course): array => [
                'id' => $course->id,
                'title' => $course->title,
                'description' => $course->description,
                'status' => $course->status,
                'lesson_count' => $course->lessons_count,
            ])
            ->values();

        $lessonOptions = $organization->courses()
            ->with(['lessons' => fn ($query) => $query->orderBy('position')])
            ->orderBy('title')
            ->get()
            ->flatMap(function (Course $course): Collection {
                return $course->lessons
                    ->filter(fn (Lesson $lesson): bool => $lesson->isPublished())
                    ->map(fn (Lesson $lesson): array => [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'description' => $lesson->body,
                        'course_id' => $course->id,
                        'course_title' => $course->title,
                        'status' => $lesson->status,
                    ]);
            })
            ->values();

        $jobTitles = $organization->jobTitles()
            ->with('pathway:id,name')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (JobTitle $jobTitle): array => [
                'id' => $jobTitle->id,
                'name' => $jobTitle->name,
                'employee_count' => $jobTitle->users_count,
                'pathway_id' => $jobTitle->pathway_id,
                'pathway' => $jobTitle->pathway?->only(['id', 'name']),
            ])
            ->values();

        $progress = $this->pathwayProgressRows($pathway, $organizationUsers);

        return Inertia::render('organizations/pathways/show', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'pathway' => $this->pathwayPayload($pathway),
            'courseOptions' => $courseOptions,
            'lessonOptions' => $lessonOptions,
            'jobTitles' => $jobTitles,
            'progress' => $progress,
        ]);
    }

    public function update(Request $request, Organization $organization, Pathway $pathway): RedirectResponse
    {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('pathways', 'name')
                    ->where(fn ($query) => $query->where('organization_id', $organization->getKey()))
                    ->ignore($pathway->getKey()),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'sequential_completion' => ['sometimes', 'boolean'],
            'expected_completion_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $pathway->forceFill([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'sequential_completion' => $validated['sequential_completion'] ?? false,
            'expected_completion_days' => $validated['expected_completion_days'] ?? null,
        ])->save();

        return back()->with('status', 'Pathway updated.');
    }

    public function syncJobTitles(
        Request $request,
        Organization $organization,
        Pathway $pathway,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $this->authorize('manageUsers', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'job_title_ids' => ['present', 'array'],
            'job_title_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('job_titles', 'id')->where(
                    fn ($query) => $query->where('organization_id', $organization->getKey()),
                ),
            ],
        ]);

        $selectedIds = collect($validated['job_title_ids'])
            ->map(fn ($id): int => (int) $id)
            ->values();

        $jobTitles = $organization->jobTitles()
            ->where(function ($query) use ($pathway, $selectedIds): void {
                $query->where('pathway_id', $pathway->getKey());

                if ($selectedIds->isNotEmpty()) {
                    $query->orWhereIn('id', $selectedIds);
                }
            })
            ->get();

        DB::transaction(function () use ($jobTitles, $pathway, $pathwayAssignments, $selectedIds): void {
            foreach ($jobTitles as $jobTitle) {
                $nextPathwayId = $selectedIds->contains($jobTitle->getKey())
                    ? $pathway->getKey()
                    : null;

                if ($jobTitle->pathway_id === $nextPathwayId) {
                    continue;
                }

                $jobTitle->forceFill(['pathway_id' => $nextPathwayId])->save();
                $pathwayAssignments->syncJobTitle($jobTitle);
            }
        });

        return back()->with('status', 'Pathway job titles updated.');
    }

    public function storeItem(
        Request $request,
        Organization $organization,
        Pathway $pathway,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'item_type' => ['required', Rule::in(['course', 'microlearning'])],
            'course_id' => [
                'nullable',
                'integer',
                Rule::exists('courses', 'id')->where(fn ($query) => $query->where('organization_id', $organization->getKey())),
            ],
            'lesson_id' => [
                'nullable',
                'integer',
                Rule::exists('lessons', 'id')->where(fn ($query) => $query->whereIn(
                    'course_id',
                    Course::query()
                        ->select('id')
                        ->where('organization_id', $organization->getKey()),
                )),
            ],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_required' => ['sometimes', 'boolean'],
        ]);

        if ($validated['item_type'] === 'course') {
            if (! filled($validated['course_id'] ?? null)) {
                throw ValidationException::withMessages([
                    'course_id' => 'Choose a course to add to the pathway.',
                ]);
            }

            if (filled($validated['lesson_id'] ?? null)) {
                throw ValidationException::withMessages([
                    'lesson_id' => 'Microlearning items should not include a lesson when adding a course.',
                ]);
            }

            /** @var Course $course */
            $course = Course::query()
                ->where('organization_id', $organization->getKey())
                ->whereKey($validated['course_id'])
                ->firstOrFail();
            $previousPathwayId = $course->pathway_id;
            $course->forceFill([
                'pathway_id' => $pathway->getKey(),
            ])->save();

            PathwayItem::updateOrCreate(
                ['course_id' => $course->getKey()],
                [
                    'pathway_id' => $pathway->getKey(),
                    'item_type' => 'course',
                    'lesson_id' => null,
                    'title' => $course->title,
                    'description' => $validated['description'] ?? $course->description,
                    'sort_order' => $this->nextItemOrder($pathway),
                    'is_required' => $validated['is_required'] ?? true,
                ],
            );

            $pathwayAssignments->syncCourse($course, $previousPathwayId);

            return back()->with('status', 'Course added to pathway.');
        }

        if (! filled($validated['lesson_id'] ?? null)) {
            throw ValidationException::withMessages([
                'lesson_id' => 'Choose a lesson for the microlearning item.',
            ]);
        }

        if (filled($validated['course_id'] ?? null)) {
            throw ValidationException::withMessages([
                'course_id' => 'Microlearning items should only use a lesson.',
            ]);
        }

        /** @var Lesson $lesson */
        $lesson = Lesson::query()
            ->whereKey($validated['lesson_id'])
            ->whereHas('course', fn ($query) => $query->where('organization_id', $organization->getKey()))
            ->firstOrFail();

        PathwayItem::updateOrCreate(
            ['lesson_id' => $lesson->getKey()],
            [
                'pathway_id' => $pathway->getKey(),
                'item_type' => 'microlearning',
                'course_id' => null,
                'title' => $validated['title'] ?? $lesson->title,
                'description' => $validated['description'] ?? $lesson->body,
                'sort_order' => $this->nextItemOrder($pathway),
                'is_required' => $validated['is_required'] ?? true,
            ],
        );

        return back()->with('status', 'Microlearning added to pathway.');
    }

    public function reorderItems(Request $request, Organization $organization, Pathway $pathway): RedirectResponse
    {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'item_ids' => ['required', 'array', 'min:1'],
            'item_ids.*' => ['integer'],
        ]);

        $itemIds = array_map('intval', array_values($validated['item_ids']));
        $expectedItemIds = $pathway->items()->pluck('id')->all();
        $sortedItemIds = $itemIds;
        $sortedExpectedItemIds = $expectedItemIds;
        sort($sortedItemIds);
        sort($sortedExpectedItemIds);

        if ($sortedItemIds !== $sortedExpectedItemIds) {
            throw ValidationException::withMessages([
                'item_ids' => 'The item order must include every item in the pathway.',
            ]);
        }

        foreach ($itemIds as $index => $itemId) {
            $pathway->items()->whereKey($itemId)->update(['sort_order' => $index + 1]);
        }

        return back()->with('status', 'Pathway order updated.');
    }

    public function destroyItem(
        Request $request,
        Organization $organization,
        Pathway $pathway,
        PathwayItem $item,
        PathwayAssignmentService $pathwayAssignments,
    ): RedirectResponse {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);
        abort_unless($item->pathway_id === $pathway->getKey(), 404);

        if ($item->course_id !== null) {
            $course = $item->course;
            if ($course !== null && $course->pathway_id === $pathway->getKey()) {
                $previousPathwayId = $course->pathway_id;
                $course->forceFill(['pathway_id' => null])->save();
                $pathwayAssignments->syncCourse($course, $previousPathwayId);
            }
        }

        $item->delete();

        return back()->with('status', 'Pathway item removed.');
    }

    public function storeMilestone(Request $request, Organization $organization, Pathway $pathway): RedirectResponse
    {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $pathway->milestones()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $this->nextMilestoneOrder($pathway),
        ]);

        return back()->with('status', 'Milestone added.');
    }

    public function reorderMilestones(Request $request, Organization $organization, Pathway $pathway): RedirectResponse
    {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);

        $validated = $request->validate([
            'milestone_ids' => ['required', 'array', 'min:1'],
            'milestone_ids.*' => ['integer'],
        ]);

        $milestoneIds = array_map('intval', array_values($validated['milestone_ids']));
        $expectedMilestoneIds = $pathway->milestones()->pluck('id')->all();
        $sortedMilestoneIds = $milestoneIds;
        $sortedExpectedMilestoneIds = $expectedMilestoneIds;
        sort($sortedMilestoneIds);
        sort($sortedExpectedMilestoneIds);

        if ($sortedMilestoneIds !== $sortedExpectedMilestoneIds) {
            throw ValidationException::withMessages([
                'milestone_ids' => 'The milestone order must include every milestone in the pathway.',
            ]);
        }

        foreach ($milestoneIds as $index => $milestoneId) {
            $pathway->milestones()->whereKey($milestoneId)->update(['sort_order' => $index + 1]);
        }

        return back()->with('status', 'Milestones reordered.');
    }

    public function destroyMilestone(
        Request $request,
        Organization $organization,
        Pathway $pathway,
        PathwayMilestone $milestone,
    ): RedirectResponse {
        $this->authorize('authorTraining', $organization);
        $this->ensurePathwayInOrganization($pathway, $organization);
        abort_unless($milestone->pathway_id === $pathway->getKey(), 404);

        $milestone->delete();

        return back()->with('status', 'Milestone removed.');
    }

    /**
     * @return array<string, mixed>
     */
    private function pathwayPayload(Pathway $pathway): array
    {
        return [
            'id' => $pathway->id,
            'name' => $pathway->name,
            'description' => $pathway->description,
            'sequential_completion' => $pathway->sequential_completion,
            'expected_completion_days' => $pathway->expected_completion_days,
            'job_title_count' => $pathway->jobTitles->count(),
            'course_count' => $pathway->courses->count(),
            'item_count' => $pathway->items->count(),
            'milestone_count' => $pathway->milestones->count(),
            'items' => $pathway->items->map(fn (PathwayItem $item): array => $this->pathwayItemPayload($item))->values(),
            'milestones' => $pathway->milestones->map(fn (PathwayMilestone $milestone): array => [
                'id' => $milestone->id,
                'title' => $milestone->title,
                'description' => $milestone->description,
                'sort_order' => $milestone->sort_order,
            ])->values(),
        ];
    }

    private function pathwayItemPayload(PathwayItem $item): array
    {
        return [
            'id' => $item->id,
            'pathway_id' => $item->pathway_id,
            'item_type' => $item->item_type,
            'title' => $item->title,
            'description' => $item->description,
            'sort_order' => $item->sort_order,
            'is_required' => $item->is_required,
            'course' => $item->course?->only(['id', 'title', 'status']),
            'lesson' => $item->lesson === null
                ? null
                : $item->lesson->only(['id', 'title', 'slug']) + [
                    'course' => $item->lesson->course?->only(['id', 'title']),
                ],
        ];
    }

    /**
     * @param  Collection<int, User>  $users
     * @return Collection<int, array<string, mixed>>
     */
    private function pathwayProgressRows(Pathway $pathway, Collection $users): Collection
    {
        $items = $pathway->items->values();
        $milestones = $pathway->milestones->values();
        $userIds = $users->pluck('id')->all();
        $courseIds = $items->where('item_type', 'course')->pluck('course_id')->filter()->all();
        $lessonIds = $items->where('item_type', 'microlearning')->pluck('lesson_id')->filter()->all();

        $courseProgresses = CourseProgress::query()
            ->whereIn('user_id', $userIds)
            ->when($courseIds !== [], fn ($query) => $query->whereIn('course_id', $courseIds))
            ->get()
            ->groupBy(fn (CourseProgress $progress): string => $progress->user_id.'-'.$progress->course_id);

        $lessonCompletions = LessonCompletion::query()
            ->whereIn('user_id', $userIds)
            ->when($lessonIds !== [], fn ($query) => $query->whereIn('lesson_id', $lessonIds))
            ->get()
            ->groupBy(fn (LessonCompletion $completion): string => $completion->user_id.'-'.$completion->lesson_id);

        return $users
            ->map(fn (User $user): array => $this->pathwayProgressPayload(
                $pathway,
                $user,
                $items,
                $milestones,
                $courseProgresses,
                $lessonCompletions,
            ))
            ->values();
    }

    /**
     * @param  Collection<int, PathwayItem>  $items
     * @param  Collection<int, PathwayMilestone>  $milestones
     * @param  Collection<string, Collection<int, CourseProgress>>  $courseProgresses
     * @param  Collection<string, Collection<int, LessonCompletion>>  $lessonCompletions
     * @return array<string, mixed>
     */
    private function pathwayProgressPayload(
        Pathway $pathway,
        User $user,
        Collection $items,
        Collection $milestones,
        Collection $courseProgresses,
        Collection $lessonCompletions,
    ): array {
        $completedRequiredCount = 0;
        $requiredCount = $items->where('is_required', true)->count();
        $currentItem = null;
        $firstIncompleteRequiredIndex = null;

        foreach ($items as $index => $item) {
            $isComplete = $this->pathwayItemComplete(
                $user,
                $item,
                $courseProgresses,
                $lessonCompletions,
            );

            if ($item->is_required && $isComplete) {
                $completedRequiredCount++;
            }

            if ($item->is_required && ! $isComplete && $firstIncompleteRequiredIndex === null) {
                $firstIncompleteRequiredIndex = $index;
                $currentItem = $item;
            }
        }

        $itemRows = $items->map(function (PathwayItem $item, int $index) use ($user, $courseProgresses, $lessonCompletions, $firstIncompleteRequiredIndex): array {
            $isComplete = $this->pathwayItemComplete($user, $item, $courseProgresses, $lessonCompletions);
            $status = $isComplete
                ? 'completed'
                : ($item->is_required && $firstIncompleteRequiredIndex !== null && $index > $firstIncompleteRequiredIndex
                    ? 'blocked'
                    : 'available');

            return [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'title' => $item->title,
                'description' => $item->description,
                'sort_order' => $item->sort_order,
                'is_required' => $item->is_required,
                'status' => $status,
                'status_label' => match ($status) {
                    'completed' => 'Completed',
                    'blocked' => 'Blocked',
                    default => 'Available',
                },
                'course' => $item->course?->only(['id', 'title', 'status']),
                'lesson' => $item->lesson === null
                    ? null
                    : $item->lesson->only(['id', 'title', 'slug']) + [
                        'course' => $item->lesson->course?->only(['id', 'title']),
                    ],
            ];
        });

        $completionPercent = $requiredCount > 0
            ? (int) round(($completedRequiredCount / $requiredCount) * 100)
            : 0;

        $milestoneRows = $milestones->map(function (PathwayMilestone $milestone, int $index) use ($milestones, $completionPercent): array {
            $milestoneCount = max(1, $milestones->count());
            $threshold = (int) ceil((($index + 1) / $milestoneCount) * 100);
            $reached = $completionPercent >= $threshold;

            return [
                'id' => $milestone->id,
                'title' => $milestone->title,
                'description' => $milestone->description,
                'sort_order' => $milestone->sort_order,
                'threshold_percent' => $threshold,
                'reached' => $reached,
            ];
        });

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'organization_role' => $user->organization_role?->value,
                'job_title' => $user->jobTitle?->only(['id', 'name']),
                'location' => $user->location?->only(['id', 'name']),
            ],
            'pathway' => [
                'id' => $pathway->id,
                'name' => $pathway->name,
            ],
            'completion_percent' => $completionPercent,
            'required_item_count' => $requiredCount,
            'completed_required_count' => $completedRequiredCount,
            'current_item' => $currentItem !== null
                ? [
                    'id' => $currentItem->id,
                    'item_type' => $currentItem->item_type,
                    'title' => $currentItem->title,
                ]
                : null,
            'items' => $itemRows->values(),
            'milestones' => $milestoneRows->values(),
            'sequential_completion' => $pathway->sequential_completion,
            'expected_completion_days' => $pathway->expected_completion_days,
            'status' => $requiredCount === 0
                ? 'empty'
                : ($completionPercent >= 100 ? 'completed' : 'in_progress'),
            'status_label' => $requiredCount === 0
                ? 'No required training'
                : ($completionPercent >= 100 ? 'Complete' : 'In progress'),
        ];
    }

    private function pathwayItemComplete(
        User $user,
        PathwayItem $item,
        Collection $courseProgresses,
        Collection $lessonCompletions,
    ): bool {
        if ($item->item_type === 'course' && $item->course_id !== null) {
            $progress = $courseProgresses->get($user->id.'-'.$item->course_id)?->first();

            return $progress?->completed_at !== null
                || $progress?->status === 'completed'
                || $progress?->passed === true;
        }

        if ($item->item_type === 'microlearning' && $item->lesson_id !== null) {
            return $lessonCompletions->has($user->id.'-'.$item->lesson_id);
        }

        return false;
    }

    private function nextItemOrder(Pathway $pathway): int
    {
        return (int) ($pathway->items()->max('sort_order') ?? 0) + 1;
    }

    private function nextMilestoneOrder(Pathway $pathway): int
    {
        return (int) ($pathway->milestones()->max('sort_order') ?? 0) + 1;
    }

    private function ensurePathwayInOrganization(Pathway $pathway, Organization $organization): void
    {
        abort_unless($pathway->organization_id === $organization->getKey(), 404);
    }
}
